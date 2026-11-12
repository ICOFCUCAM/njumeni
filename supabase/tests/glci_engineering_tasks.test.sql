-- GLCI-09: approved engineering proposals become tasks; executors report back. Rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('c9000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'glci-eng-requester@example.invalid', now(), now()),
  ('c9000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'glci-eng-approver@example.invalid', now(), now()),
  ('c9000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'glci-eng-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select pi.principal_id, 'knowledge_admin' from private.principal_identities pi
where pi.auth_user_id in ('c9000000-0000-4000-8000-0000000000a1', 'c9000000-0000-4000-8000-0000000000a2');
create temporary table k (key text primary key, value text) on commit drop;
grant all on k to authenticated, service_role;

-- operator A asks for a connector change; operator B approves and executes it
set local role authenticated;
set local request.jwt.claim.sub = 'c9000000-0000-4000-8000-0000000000a1';
insert into k select 'request', public.glci_request_engineering_task('NO', 'no-lovdata-current-laws',
  'Update the Lovdata listing monitor: the API now returns sizeBytes as a number.', null)::text;
set local request.jwt.claim.sub = 'c9000000-0000-4000-8000-0000000000a2';
select is(public.glci_decide_proposal(((select value from k where key = 'request')::jsonb ->> 'proposalId')::uuid, 'approved', 'Approved by the second operator'),
  'approved', 'a second operator approves the engineering task');
insert into k select 'task', public.glci_execute_proposal(((select value from k where key = 'request')::jsonb ->> 'proposalId')::uuid) ->> 'engineeringTaskId';
select isnt((select value from k where key = 'task'), null, 'executing the approval creates an engineering task (no longer refused)');
reset role;
select ok((select branch_name ~ '^glci/task-[0-9a-f]{8}$' and status = 'queued' and target_key = 'no-lovdata-current-laws'
  from private.glci_engineering_tasks where id = (select value::uuid from k where key = 'task')), 'the task is queued on its own branch');
select is((select status from private.glci_remediation_proposals where id = ((select value from k where key = 'request')::jsonb ->> 'proposalId')::uuid),
  'executed', 'the proposal is handed over');

set local role authenticated;
set local request.jwt.claim.sub = 'c9000000-0000-4000-8000-0000000000a2';
select is(public.glci_engineering_task_brief((select value::uuid from k where key = 'task')) ->> 'kind', 'njumeni-glci-engineering-task',
  'the brief names the task kind');
select is(public.glci_engineering_task_brief((select value::uuid from k where key = 'task')) -> 'target' ->> 'monitorAdapter',
  'lovdata-public-data-listing', 'and the failing source''s adapter');
-- no executor available: recorded, then retried
select lives_ok($$select public.glci_engineering_task_dispatch_failed((select value::uuid from k where key = 'task'), 'NO_EXECUTOR_CONFIGURED')$$,
  'a failed hand-off is recorded');
select lives_ok($$select public.glci_engineering_task_dispatched((select value::uuid from k where key = 'task'), 'github_action', null)$$,
  'a retry hands it to the GitHub workflow');
select throws_ok($$select public.glci_engineering_task_dispatched((select value::uuid from k where key = 'task'), 'github_action', null)$$,
  'GLCI_ENGINEERING_TASK_NOT_DISPATCHABLE', 'a task in progress is not dispatched twice');
select throws_ok($$select public.glci_engineering_task_report((select value::uuid from k where key = 'task'), 'pr_opened',
  'https://github.com/ICOFCUCAM/njumeni/pull/1', 'x')$$, '42501', null, 'operators cannot report on the executor''s behalf');
set local request.jwt.claim.sub = 'c9000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.glci_engineering_tasks_list()$$, 'GLCI_NOT_AUTHORISED', 'customers cannot see engineering tasks');
reset role;

-- the executor reports (service role)
set local role service_role;
select throws_ok($$select public.glci_engineering_task_report((select value::uuid from k where key = 'task'), 'pr_opened',
  'https://evil.example/pull/1', 'x')$$, '23514', null, 'only GitHub pull request links are accepted');
select is(public.glci_engineering_task_report((select value::uuid from k where key = 'task'), 'pr_opened',
  'https://github.com/ICOFCUCAM/njumeni/pull/42', 'Parse sizeBytes as number or string; tests added.'), 'pr_opened', 'the pull request is reported');
select throws_ok($$select public.glci_engineering_task_report((select value::uuid from k where key = 'task'), 'failed', null, 'late', 'X')$$,
  'GLCI_ENGINEERING_REPORT_INVALID', 'a finished task cannot be reported again');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = 'c9000000-0000-4000-8000-0000000000a1';
select is((public.glci_engineering_tasks_list() -> 0 ->> 'pullRequestUrl'), 'https://github.com/ICOFCUCAM/njumeni/pull/42',
  'the execution history shows the pull request');
reset role;
select is((select array_agg(status order by id) from private.glci_engineering_task_events where task_id = (select value::uuid from k where key = 'task')),
  array['queued', 'failed', 'dispatched', 'pr_opened'], 'every transition is kept');
select throws_ok($$delete from private.glci_engineering_task_events$$, '55000', null, 'the task history is append-only');
select is((select count(*)::int from private.glci_audit_events where event_type like 'engineering.%'), 4, 'and audited');

select * from finish();
rollback;

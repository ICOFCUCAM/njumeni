-- "Ask Njumeni" Phase 0: question capture — consent, validation, optional email, rate cap,
-- operator-only reading and 30-day retention.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('aa000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'rq-operator@example.invalid', now(), now()),
  ('aa000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'rq-customer@example.invalid', now(), now());
insert into private.platform_operators (principal_id, operator_role)
select principal_id, 'knowledge_admin' from private.principal_identities where auth_user_id = 'aa000000-0000-4000-8000-0000000000a1';

set local role anon;
select is(public.research_question_submit('Kan arbeidsgiver si meg opp uten grunn?', 'NO', null, 'nb', null, true),
  'received', 'a visitor without a session can leave a question, without an email address');
select is(public.research_question_submit('Can my landlord keep my deposit?', 'NO', date '2026-11-01', 'en', 'Ada@Example.org', true),
  'received', 'a question with a date and an email address');
select throws_ok($$select public.research_question_submit('A real question?', 'NO', null, 'en', null, false)$$,
  '22023', 'RESEARCH_QUESTION_CONSENT_REQUIRED', 'consent is required');
select throws_ok($$select public.research_question_submit('Hi', 'NO', null, 'en', null, true)$$,
  '22023', 'RESEARCH_QUESTION_INPUT_INVALID', 'a question must have substance');
select throws_ok($$select public.research_question_submit('A real question?', 'no; drop', null, 'en', null, true)$$,
  '22023', 'RESEARCH_QUESTION_INPUT_INVALID', 'the jurisdiction code is validated');
select throws_ok($$select public.research_question_submit('A real question?', 'NO', null, 'xx', null, true)$$,
  '22023', 'RESEARCH_QUESTION_INPUT_INVALID', 'the response language is validated');
select throws_ok($$select public.research_question_submit('A real question?', 'NO', null, 'en', 'not-an-email', true)$$,
  '22023', 'RESEARCH_QUESTION_INPUT_INVALID', 'an email address, when given, is validated');
select throws_ok($$select count(*) from private.research_question_submissions$$, '42501', null, 'visitors cannot read questions');
reset role;
select is((select contact_email from private.research_question_submissions where question like 'Can my landlord%'),
  'ada@example.org', 'email addresses are stored in lower case');

set local role authenticated;
set local request.jwt.claim.sub = 'aa000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.research_question_list()$$, '42501', 'RESEARCH_QUESTION_NOT_AUTHORISED', 'customers cannot read questions');
set local request.jwt.claim.sub = 'aa000000-0000-4000-8000-0000000000a1';
select is(jsonb_array_length(public.research_question_list()), 2, 'platform operators can read questions');
reset role;

insert into private.research_question_submissions (question, jurisdiction_code, response_language, consent_at)
select 'Bulk question ' || g, 'NO', 'en', now() from generate_series(1, 120) g;
set local role anon;
select throws_ok($$select public.research_question_submit('One question too many?', 'NO', null, 'en', null, true)$$,
  '53400', 'RESEARCH_QUESTION_BUSY', 'more than 120 questions an hour are refused');
reset role;
delete from private.research_question_submissions where question like 'Bulk question %';

update private.research_question_submissions set retain_until = now() - interval '1 day' where question like 'Can my landlord%';
select is(public.research_question_purge_expired(), 1, 'questions are deleted when their 30 days have passed');
select * from finish();
rollback;

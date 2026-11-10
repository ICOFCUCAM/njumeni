begin;

create extension if not exists pgtap with schema extensions;
select plan(45);

insert into auth.users (id, email, email_confirmed_at)
values
  ('20000000-0000-4000-8000-000000000003', 'owner@njumeni.test', now()),
  ('20000000-0000-4000-8000-000000000004', 'member@njumeni.test', now()),
  ('20000000-0000-4000-8000-000000000005', 'workspace-member@njumeni.test', now());

select set_config(
  'njumeni.test.owner_user',
  '20000000-0000-4000-8000-000000000003',
  true
);
select set_config(
  'njumeni.test.member_user',
  '20000000-0000-4000-8000-000000000004',
  true
);
select set_config(
  'njumeni.test.workspace_member_user',
  '20000000-0000-4000-8000-000000000005',
  true
);
select set_config(
  'njumeni.test.owner_principal',
  (select principal_id::text from private.principal_identities where auth_user_id = '20000000-0000-4000-8000-000000000003'),
  true
);
select set_config(
  'njumeni.test.member_principal',
  (select principal_id::text from private.principal_identities where auth_user_id = '20000000-0000-4000-8000-000000000004'),
  true
);
select set_config(
  'njumeni.test.workspace_member_principal',
  (select principal_id::text from private.principal_identities where auth_user_id = '20000000-0000-4000-8000-000000000005'),
  true
);

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000003';

select lives_ok(
  $$insert into public.organizations (name, slug, kind)
    values ('Membership Test Organisation', 'membership-test-organisation', 'law_firm')$$,
  'Active owner can create an organisation'
);

select set_config(
  'njumeni.test.organization_id',
  (select id::text from public.organizations where slug = 'membership-test-organisation'),
  true
);

select lives_ok(
  $sql$insert into public.workspaces (organization_id, name, slug, kind)
    values (current_setting('njumeni.test.organization_id')::uuid, 'Restricted Workspace', 'restricted-workspace', 'team')$sql$,
  'Owner can create the workspace used for workspace-scoped invitations'
);

select set_config(
  'njumeni.test.workspace_id',
  (select id::text from public.workspaces
   where organization_id = current_setting('njumeni.test.organization_id')::uuid
     and slug = 'restricted-workspace'),
  true
);

select lives_ok(
  $sql$insert into public.organization_invitations
    (organization_id, email_normalized, token_hash, expires_at)
    values (
      current_setting('njumeni.test.organization_id')::uuid,
      'member@njumeni.test',
      repeat('a', 64),
      now() + interval '7 days'
    )$sql$,
  'Owner can create an email-bound organisation invitation'
);

select lives_ok(
  $sql$insert into public.organization_invitations
    (organization_id, workspace_id, email_normalized, token_hash, expires_at)
    values (
      current_setting('njumeni.test.organization_id')::uuid,
      current_setting('njumeni.test.workspace_id')::uuid,
      'workspace-member@njumeni.test',
      repeat('b', 64),
      now() + interval '7 days'
    )$sql$,
  'Owner can create a workspace-scoped invitation'
);

select is(
  (select count(*) from public.organization_invitations),
  2::bigint,
  'Owner can read invitations in their organisation'
);

select throws_ok(
  $$select token_hash from public.organization_invitations limit 1$$,
  '42501',
  null,
  'Invitation token hashes are not selectable by authenticated users'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000004';

select is(
  (select count(*) from public.organization_invitations),
  0::bigint,
  'Non-owner cannot inspect organisation invitations'
);

select throws_ok(
  $sql$insert into public.organization_invitations
    (organization_id, email_normalized, token_hash, expires_at)
    values (
      current_setting('njumeni.test.organization_id')::uuid,
      'attacker@njumeni.test',
      repeat('f', 64),
      now() + interval '7 days'
    )$sql$,
  '42501',
  null,
  'Non-owner cannot create invitations'
);

select throws_ok(
  $$select * from public.accept_organization_invitation(repeat('a', 64))$$,
  '42501',
  'Invitation cannot be accepted',
  'A different confirmed email cannot accept the invitation'
);

select lives_ok(
  $$select * from public.accept_organization_invitation(repeat('a', 64))$$,
  'The invited confirmed email can accept an organisation invitation'
);

select throws_ok(
  $$select * from public.accept_organization_invitation(repeat('a', 64))$$,
  '42501',
  'Invitation cannot be accepted',
  'An accepted invitation cannot be replayed'
);

select is(
  (select count(*) from public.organizations
   where id = current_setting('njumeni.test.organization_id')::uuid),
  1::bigint,
  'Organisation member can read the organisation'
);

select is(
  (select count(*) from public.workspaces
   where organization_id = current_setting('njumeni.test.organization_id')::uuid),
  0::bigint,
  'Organisation-only invitation does not grant workspace access'
);

select is(
  (select count(*) from public.organization_memberships
   where organization_id = current_setting('njumeni.test.organization_id')::uuid
     and principal_id = current_setting('njumeni.test.member_principal')::uuid
     and status = 'active'),
  1::bigint,
  'Invite acceptance creates one active organisation membership'
);

select is(
  (select count(*) from public.workspace_memberships
   where principal_id = current_setting('njumeni.test.workspace_member_principal')::uuid),
  0::bigint,
  'Organisation-only member cannot inspect another principal workspace membership'
);

select throws_ok(
  $sql$insert into public.organization_memberships (organization_id, principal_id)
    values (
      current_setting('njumeni.test.organization_id')::uuid,
      current_setting('njumeni.test.member_principal')::uuid
    )$sql$,
  '42501',
  null,
  'Authenticated users cannot directly insert membership rows'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000003';

select is(
  (select count(*) from public.organization_memberships
   where organization_id = current_setting('njumeni.test.organization_id')::uuid
     and principal_id = current_setting('njumeni.test.member_principal')::uuid),
  1::bigint,
  'Organisation owner can read member records in their organisation'
);

select lives_ok(
  $sql$select public.set_organization_membership_status(
    (select id from public.organization_memberships
     where organization_id = current_setting('njumeni.test.organization_id')::uuid
       and principal_id = current_setting('njumeni.test.member_principal')::uuid),
    'suspended'
  )$sql$,
  'Owner can suspend an organisation membership'
);

select lives_ok(
  $sql$insert into public.organization_invitations
    (organization_id, email_normalized, token_hash, expires_at)
    values (
      current_setting('njumeni.test.organization_id')::uuid,
      'member@njumeni.test',
      repeat('c', 64),
      now() + interval '7 days'
    )$sql$,
  'Owner can issue a fresh invitation after suspension'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000004';

select is(
  (select status from public.organization_memberships
   where organization_id = current_setting('njumeni.test.organization_id')::uuid
     and principal_id = current_setting('njumeni.test.member_principal')::uuid),
  'suspended',
  'Suspended member can inspect their own membership status'
);

select is(
  (select count(*) from public.organizations
   where id = current_setting('njumeni.test.organization_id')::uuid),
  0::bigint,
  'Suspended organisation membership removes organisation access'
);

select lives_ok(
  $$select * from public.accept_organization_invitation(repeat('c', 64))$$,
  'A new valid invitation can reactivate a suspended membership'
);

select is(
  (select status from public.organization_memberships
   where organization_id = current_setting('njumeni.test.organization_id')::uuid
     and principal_id = current_setting('njumeni.test.member_principal')::uuid),
  'active',
  'Re-invitation restores the existing membership to active'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000003';

select lives_ok(
  $sql$select public.set_organization_membership_status(
    (select id from public.organization_memberships
     where organization_id = current_setting('njumeni.test.organization_id')::uuid
       and principal_id = current_setting('njumeni.test.member_principal')::uuid),
    'revoked'
  )$sql$,
  'Owner can revoke an organisation membership'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000004';

select is(
  (select count(*) from public.organizations
   where id = current_setting('njumeni.test.organization_id')::uuid),
  0::bigint,
  'Revoked organisation membership removes organisation access'
);

select throws_ok(
  $$select * from public.accept_organization_invitation(repeat('b', 64))$$,
  '42501',
  'Invitation cannot be accepted',
  'Wrong email cannot accept a workspace-scoped invitation'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000005';

select lives_ok(
  $$select * from public.accept_organization_invitation(repeat('b', 64))$$,
  'Workspace invitee can accept using their confirmed email'
);

select is(
  (select count(*) from public.organizations
   where id = current_setting('njumeni.test.organization_id')::uuid),
  1::bigint,
  'Workspace member can read the organisation context'
);

select is(
  (select count(*) from public.workspaces
   where organization_id = current_setting('njumeni.test.organization_id')::uuid),
  1::bigint,
  'Workspace invitation grants access only to the selected workspace'
);

select is(
  (select count(*) from public.workspace_memberships
   where workspace_id = current_setting('njumeni.test.workspace_id')::uuid
     and principal_id = current_setting('njumeni.test.workspace_member_principal')::uuid
     and status = 'active'),
  1::bigint,
  'Workspace acceptance creates one active workspace membership'
);

select is(
  (select count(*) from public.organization_invitations),
  0::bigint,
  'Workspace member cannot inspect organisation invitations'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000003';

select lives_ok(
  $sql$select public.set_workspace_membership_status(
    (select id from public.workspace_memberships
     where workspace_id = current_setting('njumeni.test.workspace_id')::uuid
       and principal_id = current_setting('njumeni.test.workspace_member_principal')::uuid),
    'suspended'
  )$sql$,
  'Owner can suspend a workspace membership'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000005';

select is(
  (select count(*) from public.workspaces
   where organization_id = current_setting('njumeni.test.organization_id')::uuid),
  0::bigint,
  'Suspended workspace membership removes workspace access'
);

select is(
  (select count(*) from public.organizations
   where id = current_setting('njumeni.test.organization_id')::uuid),
  1::bigint,
  'Suspending workspace membership preserves organisation membership'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000003';

select lives_ok(
  $sql$select public.set_organization_membership_status(
    (select id from public.organization_memberships
     where organization_id = current_setting('njumeni.test.organization_id')::uuid
       and principal_id = current_setting('njumeni.test.workspace_member_principal')::uuid),
    'revoked'
  )$sql$,
  'Revoking organisation membership also revokes workspace memberships'
);

reset role;
select is(
  (select status from public.workspace_memberships
   where workspace_id = current_setting('njumeni.test.workspace_id')::uuid
     and principal_id = current_setting('njumeni.test.workspace_member_principal')::uuid),
  'revoked',
  'Organisation revocation cascades to workspace membership status'
);

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000003';

select lives_ok(
  $sql$insert into public.organization_invitations
    (organization_id, email_normalized, token_hash, expires_at)
    values (
      current_setting('njumeni.test.organization_id')::uuid,
      'workspace-member@njumeni.test',
      repeat('d', 64),
      now() + interval '7 days'
    )$sql$,
  'Owner can create an invitation that can later be revoked'
);

select lives_ok(
  $sql$select public.revoke_organization_invitation(
    (select id from public.organization_invitations where token_hash = repeat('d', 64))
  )$sql$,
  'Owner can revoke a pending invitation'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000005';

select throws_ok(
  $$select * from public.accept_organization_invitation(repeat('d', 64))$$,
  '42501',
  'Invitation cannot be accepted',
  'A revoked invitation cannot be accepted'
);

reset role;
insert into public.organization_invitations (
  organization_id, email_normalized, token_hash, expires_at,
  created_by_principal_id, created_at, updated_at
)
values (
  current_setting('njumeni.test.organization_id')::uuid,
  'expired@njumeni.test',
  repeat('e', 64),
  now() - interval '1 day',
  current_setting('njumeni.test.owner_principal')::uuid,
  now() - interval '10 days',
  now() - interval '1 day'
);

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000003';

select lives_ok(
  $sql$insert into public.organization_invitations
    (organization_id, email_normalized, token_hash, expires_at)
    values (
      current_setting('njumeni.test.organization_id')::uuid,
      'expired@njumeni.test',
      repeat('f', 64),
      now() + interval '7 days'
    )$sql$,
  'A new invitation can replace an expired pending invitation'
);

select is(
  (select status from public.organization_invitations where token_hash = repeat('e', 64)),
  'expired',
  'Expired pending invitation is transitioned before replacement'
);

select throws_ok(
  $sql$insert into public.organization_invitations
    (organization_id, email_normalized, token_hash, expires_at)
    values (
      current_setting('njumeni.test.organization_id')::uuid,
      'expired@njumeni.test',
      repeat('1', 64),
      now() + interval '7 days'
    )$sql$,
  '23505',
  null,
  'Only one pending invitation exists per email and scope'
);

reset role;
select ok(
  (select count(*) from private.membership_events) >= 10,
  'Invitation and membership lifecycle transitions create private events'
);
select is(
  has_function_privilege('anon', 'public.accept_organization_invitation(text)', 'EXECUTE'),
  false,
  'Anonymous users cannot execute invitation acceptance'
);
select is(
  has_function_privilege('authenticated', 'public.accept_organization_invitation(text)', 'EXECUTE'),
  true,
  'Authenticated users can execute the guarded invitation acceptance RPC'
);

select * from finish();
rollback;

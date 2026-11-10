-- Forward hardening for the role-binding event trigger.
-- Replacing the function body preserves the existing triggers and audit history.

create or replace function private.record_role_binding_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_target uuid;
  v_organization uuid;
  v_workspace uuid;
  v_role text;
  v_action text;
begin
  v_actor := private.current_principal_id();

  if tg_op = 'INSERT' then
    v_target := new.principal_id;
    v_role := new.role_key;
    v_action := 'assigned';
    if tg_table_name = 'organization_role_bindings' then
      v_organization := new.organization_id;
    else
      v_workspace := new.workspace_id;
      select workspace.organization_id into v_organization
      from public.workspaces as workspace
      where workspace.id = new.workspace_id;
    end if;
  else
    v_target := old.principal_id;
    v_role := old.role_key;
    v_action := 'revoked';
    if tg_table_name = 'organization_role_bindings' then
      v_organization := old.organization_id;
    else
      v_workspace := old.workspace_id;
      select workspace.organization_id into v_organization
      from public.workspaces as workspace
      where workspace.id = old.workspace_id;
    end if;
  end if;

  insert into private.role_audit_events (
    actor_principal_id, target_principal_id, organization_id,
    workspace_id, role_key, action
  )
  values (v_actor, v_target, v_organization, v_workspace, v_role, v_action);

  -- This is an AFTER trigger; its return value is ignored.
  return null;
end;
$$;

revoke all on function private.record_role_binding_event() from public, anon, authenticated;

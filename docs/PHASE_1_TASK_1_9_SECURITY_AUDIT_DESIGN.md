# Phase 1 Task 1.9 — Security audit logging

## Status
Implementation written; batch verification pending. Hosted Supabase has not been changed.

## Design
The central stream is `private.security_audit_events`. It is append-only, uses a monotonically increasing identity sequence for stable pagination, and stores tenant/workspace scope, actor, event key, outcome, resource reference, optional request correlation identifier and small structured metadata.

### Sources captured
- Organisation and workspace insert/update/delete lifecycle events.
- Existing role assignment/revocation audit records.
- Existing membership and invitation lifecycle events.

Existing role and membership event stores remain intact for compatibility. Database triggers mirror their records into the central stream.

### Data minimisation
The capture function does not copy arbitrary row JSON. It allow-lists only status, kind and role key, plus operation. Invitation email addresses, token hashes, document text, matter content and arbitrary metadata are excluded. Correlation identifiers are length-limited and character-filtered. Metadata is capped at 2 KiB.

### Immutability and access
- RLS is enabled on the private event table.
- API roles receive no direct table privileges.
- A database trigger rejects UPDATE and DELETE.
- The authenticated read RPC checks organisation-level `audit.read`, validates workspace scope, limits pages to 200 records and supports descending sequence pagination.
- Organisation auditors receive `audit.read` through the role catalogue; tenant owners retain the permission evaluator's owner authority.

### Deliberate boundaries
This migration captures successful database mutations. Denied requests and failures that never reach a database mutation must be recorded by their application/service boundary in a later integration task. Retention, export, legal hold and cryptographic external anchoring remain separate operational controls; this migration does not claim tamper-proofing against database superusers.

## Verification plan
Synthetic pgTAP assertions cover append-only enforcement, direct privilege denial, scoped RPC access, cross-tenant denial, source-event mirroring, lifecycle capture, pagination bounds and metadata minimisation. No hosted migration execution is included.

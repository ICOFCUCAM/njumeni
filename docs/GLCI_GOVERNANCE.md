# GLCI-11 — Approval, audit and production governance

| Field | Value |
|---|---|
| Migration | `20261114300000_glci_governance` |
| UI | Super Admin → Global Legal Observatory → *Governance* |
| Related | [GLCI specification](GLCI_SPECIFICATION.md) §2 engine 7 · [Journey register](GLCI_JOURNEY_REGISTER.md) |

## 1. Policy

**Two-person approval is the default.** Whoever requests a consequential action cannot approve it.

**Solo-owner mode.** Njumeni currently has a single owner, so the policy can be switched to solo-owner mode:
- **Who:** only a `platform_admin` may switch it, with a reason of at least 20 characters (`glci_set_governance_policy`), and the switch is audited.
- **Effect:** while it is on, a requester may approve their own request. Every such decision is recorded as **self-approved**: on the request, the deployment and the remediation note, and in the audit log.
- **Return:** switch back to two-person approval when a second operator joins.

## 2. What needs approval

| Action | How | Approver |
|---|---|---|
| Activate monitoring of an official source | `glci_request_action('activate_target', …)` → `glci_decide_action`. Direct activation is refused (`GLCI_APPROVAL_REQUIRED`); pausing or retiring stays direct | A second operator (or self-approval in solo mode). The lawful-basis rule still applies: no approval can activate a source without a rights review or licence policy |
| Remediation (re-sync, change review, customer notification, engineering task) | Proposal → `glci_decide_proposal` → `glci_execute_proposal` | Operator-raised proposals: a second operator (or self-approval in solo mode). System proposals: any operator |
| Production deployment (database, web, worker, configuration) | `glci_request_action('production_deployment', …)` → approval → `glci_record_deployment` with the result and verification | A second operator (or self-approval in solo mode) |
| Database deployment through GitHub | Workflow *Deploy database to hosted Supabase*: approval by the GitHub `production` environment. Its last step records each applied migration in the register | GitHub environment reviewers |
| Engineering changes to code | Pull request review and merge (GLCI-09). Never automatic | Repository reviewers |
| Source rights, activation for ingestion, AI engine settings, governance policy | Their own audited functions, with reasons | Owner / operators |

## 3. Deployment register

`private.glci_deployments` records every production change:
- kind, reference and checksum;
- the approval request and approver;
- whether it was self-approved;
- the outcome and verification evidence.

The register is append-only. The 52 migrations applied before it existed were backfilled from the hosted migration history. The governance report lists any migration applied without a register entry, so a change made outside the process shows up.

## 4. Audit export and verification

The GLCI audit log (`private.glci_audit_events`) is append-only and hash-chained. Each record's hash is SHA-256 over these fields, in this order:
1. the UTC time;
2. the actor;
3. the actor kind;
4. the event type;
5. the subject type;
6. the subject id;
7. the details;
8. the previous record's hash.

**Checkpoints.** `glci_audit_checkpoint()` (button *Take an audit checkpoint*) pins the head sequence and hash. If records are later rewritten, the chain breaks. If records are removed, the log no longer matches the checkpoint. Both are reported, and pgTAP proves it by tampering inside a rolled-back test.

**Exports.** `glci_audit_export(from, to)` (link *Download the verified audit export*) returns:
- the events;
- the integrity result;
- a SHA-256 digest of the exported events.

Taking the export is itself recorded and audited.

**To verify an export independently:**
1. Recompute each record's hash from its fields.
2. Check that each `previousHash` equals the prior `recordHash`.
3. Recompute the digest over the `events` array.
4. Compare the head with a checkpoint kept outside Njumeni, for example the digest stored with the export file.

## 5. Tests

| Suite | Covers |
|---|---|
| `glci_governance.test.sql` (25) | Default policy; who may change it; activation only by approval; four eyes; the lawful-basis rule under approval; solo-mode self-approval and its record; deployment register (backfill, approved recording, mismatch refused, service-role recording, unrecorded migrations flagged); checkpoints, export digest, tamper and truncation detection; customers refused |
| Browser journey GLCI | Operator A requests monitoring and is refused self-approval. Operator B approves; the source becomes monitored ("not checked"). B downloads the export, which verifies and contains the approval |

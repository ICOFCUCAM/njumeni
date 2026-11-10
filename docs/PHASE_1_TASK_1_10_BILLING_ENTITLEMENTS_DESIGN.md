# Phase 1 Task 1.10 — Subscription identity and entitlement boundary

## Status
Implementation written; combined verification pending. No provider has been selected or connected, and hosted Supabase remains unchanged.

## Commercial identity model
- `private.billing_customers` maps one provider customer identity to one Njumeni organisation per provider.
- `private.subscriptions` binds provider subscription identity, customer, organisation, plan, lifecycle status and billing period. Composite foreign keys prevent a subscription from referencing a customer belonging to another organisation.
- Provider event IDs are recorded in `private.billing_provider_events` for webhook idempotency.
- The initial plan catalogue contains the commercial hypotheses from the master plan (Free, Personal, Personal Plus, Professional, Professional Plus, Law Firm, Enterprise and Institutional). Prices are intentionally not hard-coded into access-control schema.

## Entitlement and usage model
- `private.subscription_entitlements` stores versioned, time-bounded feature and allowance snapshots.
- `private.usage_records` is an append-only, idempotent usage ledger with optional workspace/principal context and bounded metadata.
- `public.get_organization_entitlements` is a bounded data disclosure boundary requiring `billing.read`.
- `public.record_usage_event` validates tenant/workspace scope, requires billing permission and de-duplicates by tenant, usage key and idempotency key.

## Security boundary
- All billing tables are private, RLS-enabled and inaccessible directly to API roles.
- Provider snapshots are applied only by a service-role-only database function. The provider adapter must verify webhook signatures before calling it; this migration does not pretend to verify provider signatures.
- Composite foreign keys enforce customer/subscription/entitlement tenant consistency.
- Billing status and entitlements are not consulted by `private.has_permission()`; a paid plan cannot grant matter, document, workspace or other legal-resource access.
- Usage records are append-only. Billing identities are not authentication identities.
- No payment provider, price, checkout UI, invoice processor or production webhook endpoint is selected in this task.

## Verification plan
Synthetic pgTAP coverage is prepared for tenant binding, direct API denial, entitlement read authorisation, provider-event idempotency, service-role mutation boundary, usage idempotency and ledger immutability. Run with the combined Phase 1 batch after owner approval.

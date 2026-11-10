# Phase 2.5 — Trusted legal ingestion worker deployment

## Purpose

The worker is a separate server-side process. It is not part of the Next.js request path and must never be bundled into browser code. The web application does not receive the Supabase service-role key.

## Runtime entrypoint

The repository exposes `npm run worker:legal-knowledge` as the worker process entrypoint. It runs Node with the React server condition so the `server-only` boundary is respected. The checked-in adapter registration list is intentionally empty; startup fails closed until reviewed, version-pinned source adapters are deliberately registered. Do not add an adapter until source rights, provenance hosts and source-specific technical behavior have been approved.

## Runtime configuration

Required worker environment variables:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Dedicated Njumeni Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker-only service-role credential |
| `LEGAL_INGESTION_WORKER_ID` | Stable operational worker identifier |
| `LEGAL_NORMALISATION_PROFILE` | Versioned normalisation profile label |

Do not place `SUPABASE_SERVICE_ROLE_KEY` in Vercel client-side variables, `NEXT_PUBLIC_*` variables, or any browser bundle. Prefer a dedicated secret store for the worker deployment. Rotate the key if it is ever exposed.

## Adapter policy

- Register adapters with an exact `adapterKey` and `adapterVersion`.
- The registry rejects duplicate key/version pairs.
- The runtime never falls back to a newer adapter version.
- Each adapter manifest must declare an explicit HTTPS host allow-list.
- No adapter is registered by default in the trusted bootstrap.
- A deployment must intentionally provide the registry snapshot it is permitted to execute.

## Source-rights gate

Before each claimed job can proceed, the worker calls the service-role-only `legal_worker_source_config` RPC. The RPC joins the source registry to a separately stored rights-evidence record. Missing evidence fails closed.

Ingestion requires:
- source rights status `approved`;
- source status `active`;
- `ingestion_enabled = true`;
- a non-expired review record;
- explicit retrieve, store, normalise and index permissions;
- a valid HTTPS terms URI, licence identifier and attribution text.

Display, quotation and redistribution permissions remain separate from ingestion permission. No seeded source is activated by this migration.

## Operations

The worker uses durable leases, heartbeat renewal, lease-bound writes, checkpoints and retry scheduling. Run multiple workers only with distinct worker IDs. Stop through SIGINT/SIGTERM; the process wrapper requests graceful shutdown.

Structured logs include job identifiers and status events, not source document contents, service credentials, lease tokens or raw RPC error messages.

## Deployment remains gated

This document is configuration guidance only. It does not authorise deploying Supabase migrations, registering live adapters, approving source licences, enabling source ingestion, or processing customer legal documents. Those actions require separate acceptance and explicit approval.

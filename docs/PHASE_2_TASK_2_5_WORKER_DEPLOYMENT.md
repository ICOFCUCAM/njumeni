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

## Embedding runtime (Task 2.9, added 11 November 2026)

The worker embeds passages locally, at zero cost, with the owner-selected profile `multilingual-e5-small-v1` (`intfloat/multilingual-e5-small`, MIT licence, 384 dimensions, ONNX build `Xenova/multilingual-e5-small`).

- **Runtime.** `@huggingface/transformers` is an *optional* worker-only runtime. It is loaded lazily by `local-embedder.ts` and is never bundled into the web app. Install it only on the worker host, at a pinned version:

  ```bash
  cd apps/web && npm install --no-save @huggingface/transformers@4.3.2
  ```

  Without it, the embedder fails closed with `LEGAL_EMBEDDING_RUNTIME_NOT_INSTALLED`.
- **Model download.** The first run downloads the model (about 120 MB, quantised) from Hugging Face. The host needs outbound access to `huggingface.co` **and its file CDN** (`us.aws.cdn.hf.co` or `us.gcp.cdn.hf.co`; Hugging Face redirects model files there). After that, the model is cached locally. Node's `fetch` ignores `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1` is set.
- **Prefixes.** e5 requires `query: ` for searches and `passage: ` for stored text. The embedder adds them; callers must not.
- **Backfill.** `runEmbeddingBackfill` reads passages without an embedding through `legal_embedding_pending_passages`, then writes them in batches of up to 64 through `legal_embedding_store`. Both functions are service-role only, and only accept passages from rights-approved, active, ingestion-enabled sources. Legal text stays immutable; only the embedding fields can be written.
- **Changing the model** means a new profile row and, if the dimension differs, a forward migration. Embeddings from different profiles are never mixed.

## Lovdata adapter runtime (Task 2.8, added 12 November 2026)

- **bzip2.** Lovdata publishes `tar.bz2` archives. Node has no bzip2 decoder, so the adapter lazily loads the optional worker-only runtime `seek-bzip` (MIT). It is never bundled into the web app:

  ```bash
  cd apps/web && npm install --no-save seek-bzip@2.0.0
  ```

  Without it, the adapter fails closed with `LOVDATA_BZIP2_RUNTIME_NOT_INSTALLED`.
- **Network.** The HTTP source needs `api.lovdata.no`. If Lovdata's edge refuses the worker host, use an operator-downloaded archive: set `LOVDATA_ARCHIVE_PATH`, plus `LOVDATA_ARCHIVE_SIZE_BYTES`, `LOVDATA_ARCHIVE_LAST_MODIFIED` and `LOVDATA_ARCHIVE_RETRIEVED_AT` from the listing (optionally `LOVDATA_ARCHIVE_SHA256`).
- **Normalisation profile.** Set `LEGAL_NORMALISATION_PROFILE=lovdata-nl-html-v1`.
- **Approval.** Registration of the adapter does not approve anything. See the [Task 2.8 record](PHASE_2_TASK_2_8_LOVDATA_PILOT.md) §6.

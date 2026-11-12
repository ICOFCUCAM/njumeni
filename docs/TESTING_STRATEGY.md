# Njumeni — Testing Strategy

| Field | Value |
|---|---|
| Status | Describes the testing actually in place (Phases 0–4) and what each later phase adds |
| Governing plan | [Master Plan v2.0](NJUMENI_MASTER_PLAN.md) §18 |

## 1. Layers

| Layer | Tool | Where | Runs |
|---|---|---|---|
| Repository policy and documentation contracts | Node test runner | `tests/*.test.mjs` | Every push (CI) and `scripts/ci/local-checks.sh` |
| Application units and contracts | Node test runner (`--experimental-strip-types`) | `apps/web/tests/*.test.mjs` (`npm test`) | Every push |
| Database security and behaviour | pgTAP on a fresh local Supabase stack | `supabase/tests/*.test.sql` | Pushes touching `supabase/**` (CI `supabase-local.yml`) and locally with `supabase test db` |
| Migration discipline | `check-migrations.mjs` (naming, order, immutability, hash-pinned corrections) | CI | Every push |
| Schema/type drift | Generated types compared with the committed file | CI `supabase-local.yml` | On schema changes |
| Secrets and content policy | Gitleaks, `check-repository-content.sh` | CI | Every push |
| Release gates and evaluation thresholds | `check-release-gates.mjs` with `quality/release-gates.json` and `quality/evaluation-thresholds.json` | CI | Every push |
| Build | `next build` | CI | Every push |
| End-to-end | Scripted flows against a local stack and the built app (synthetic users and data) | Per phase, before its commit | Recorded in each phase plan |
| Legal-quality evaluation | `retrieval-evaluation.ts` + `npm run eval:retrieval` | `legal-data/evaluation-datasets/` | Per phase; becomes a CI gate once real content exists (Task 2.8) |

## 2. Principles

1. **Test the negative path.** Every security boundary has tests where an outsider, a lower role or a forged input is refused.
2. **Prove tamper evidence by tampering.** Custody and audit chain tests alter records with triggers disabled and expect detection.
3. **Verification can't be bypassed from the client.** Research tests submit forged quotations, invented passages and out-of-date versions directly to the database.
4. **Synthetic data only** (ADR-0003, Stage 0). Fixtures use `example.invalid` addresses and synthetic legal text.
5. **Gates with nothing to measure fail.** An evaluation without cases never passes silently.
6. **Each phase records its evidence:** test counts, end-to-end results and CI run IDs, in the phase plan.

## 3. Current totals (Phase 12)

| Suite | Count |
|---|---|
| pgTAP | 679 assertions in 23 files |
| Application | 250 tests |
| Root policy and documentation | 24 tests |

## 4. Added by later phases

| Phase | Addition |
|---|---|
| 5 | ✅ Agent authorisation and refusal tests (pgTAP); orchestrator, injection and grounding-validation tests; reasoning rubric (`evaluateArgumentGraph`). Model-backed evaluation follows D-5 |
| 6 | ✅ Automated release gates (§18.3, `check-release-gates.mjs`), evaluation-threshold regression guard (§18.2), re-verification and review-gate tests |
| 7 | ✅ Document tests (citation verification, four-eyes approval, versions); DOCX/PDF structure tests; exports checked with `pdftotext` and `python-docx` in the phase end-to-end run |
| 8 | ✅ Matter tests; journey 15.1 end to end over HTTP (bundle manifest verified) |
| 9 | ✅ Conflict, barrier, knowledge and template tests; journey 15.2 with three users over HTTP |
| 10 | ✅ Break-glass, API-key, AI conformity, compliance and SSO tests; HTTP end-to-end with a real operator |
| 11 | ✅ Quota, webhook-signature, invoice-immutability and analytics tests; billing end to end over HTTP |
| 12 | ✅ Jurisdiction model, glossary, readiness (P8) and localisation tests; cross-language research over HTTP |
| 13 | Browser end-to-end journeys (master plan §15) with Playwright |
| 13 | Load, performance, penetration and restore-drill testing |

# Onboarding register

| Field | Value |
|---|---|
| Opened | 2026-11-12, at the owner's request ("open an onboarding register") |
| Scope | How each **jurisdiction and its official sources** is onboarded into Njumeni (GLCI-10), and the **platform activation** steps that are the owner's |
| Live version | Super Admin → Global Legal Observatory → *Onboarding register* (`glci_onboarding_register()`), computed from live data |
| Related | [GLCI specification](GLCI_SPECIFICATION.md) §4 · [GLCI journey register](GLCI_JOURNEY_REGISTER.md) · [AI engines guide](GLCI_AI_ENGINES.md) |

This document is a snapshot. The observatory is the source of truth: its register is computed from the database, never maintained by hand.

## 1. The ten onboarding stages

| # | Stage | Done when | Who |
|---|---|---|---|
| 1 | Catalogued | The jurisdiction exists in the registry | Platform |
| 2 | Monitoring profile | Languages, legal hierarchy, publication schedule, effective-date rules (publication ≠ commencement) and review procedure are recorded | Operator |
| 3 | Official sources registered | At least one official gazette, parliament or legal database is registered with its official address | Operator |
| 4 | Rights reviewed | A source has an approved rights review, or a licence policy covering its host | **Owner** |
| 5 | Monitor assigned | A target has a catalogued monitor (format confirmed against the live source before activation) | Operator |
| 6 | Monitoring active | A lawful target is active | Operator |
| 7 | Source checked | A check succeeded (verified or changed) from a host that can reach the source | **Owner** (runs the worker) |
| 8 | Legal texts ingested | Authorities exist from a source enabled for ingestion | **Owner** (activation) |
| 9 | Evaluation passed | The jurisdiction's recorded retrieval evaluation passes every gate (held-out set before coverage claims) | Operator |
| 10 | Verified current | The latest currency verification says "current" | Operator |

Coverage levels (catalogued, planned, pilot, partial, supported) are separate and enforced by the database: pilot needs a live approved source, and partial needs a passing evaluation.

## 2. Status on 2026-11-12

● done, ○ open. All data comes from the register.

| Jurisdiction | Coverage | Stages | Next step |
|---|---|---|---|
| Norway | planned | ●●●●●○○○○○ 5/10 | Activate monitoring of the Lovdata API listing (licence policy v2 covers it) |
| United Kingdom | planned | ●●●○●○○○○○ 4/10 | **Owner:** rights review of legislation.gov.uk. Atom monitor ready; format confirmed live; licence OGL v3.0 read |
| United States | planned | ●●●○●○○○○○ 4/10 | **Owner:** register and review the Federal Register source. JSON monitor ready; format confirmed live; licence page not readable (bot gate) |
| Denmark | catalogued | ●●●○●○○○○○ 4/10 | **Owner:** rights review of Retsinformation. Daily harvesting-API monitor ready; format confirmed live; terms page not readable |
| European Union | planned | ●●●○○○○○○○ 3/10 | **Owner:** rights review of EUR-Lex (reuse terms read: Decision 2011/833/EU, CC BY 4.0). No RSS feed exists; another official interface is needed |
| Cameroon | planned | ●●●○○○○○○○ 3/10 | **Owner:** rights review; confirm the official gazette's address |
| Sweden, Finland, Uganda | catalogued | ●●●○○○○○○○ 3/10 | **Owner:** rights review of the registered sources. Finland: Finlex open data needs a token; documentation and terms not found |
| EEA, OHADA, Ghana, Kenya, Nigeria, Senegal, South Africa, International | catalogued | ●○○○○○○○○○ 1/10 | Operator: record a monitoring profile |

## 3. Monitors

| Monitor | Kind | Format | Used by |
|---|---|---|---|
| `lovdata-public-data-listing` | Source-specific | Verified against the live listing, 2026-11-12 | Norway: Lovdata current laws, central regulations |
| `atom-feed` | Generic Atom | Confirmed per target | UK: legislation.gov.uk new legislation |
| `rss-feed` | Generic RSS 2.0 | Confirm per source | Available (for example the EU Official Journal, once a feed URL is confirmed) |
| `json-listing` | Generic JSON API, with field mapping in the target's configuration; `{today}`/`{yesterday}` placeholders and `allowEmpty` for daily change lists | Confirmed per target | US: Federal Register; Denmark: Retsinformation |

**Rules for every monitor:**
- **Official host only.** Feed URLs must stay on the target's official host. The database refuses any other.
- **Format changes.** A format change is an integration failure, never "no change", and it opens an engineering issue.
- **Fixes are data.** A format detail is corrected as data (`glci_set_target_monitor`), not as code.

**Verified on 2026-11-12, about 20:15 UTC.** The Lovdata session read the live sources after the owner allowed their hosts. Migration `20261114200000` records each result on its target:

| Source | Format | Licence or terms |
|---|---|---|
| UK legislation.gov.uk `/new/data.feed` | Atom (id, title, updated, published), confirmed | Open Government Licence v3.0 |
| US Federal Register API | JSON `$.results` (document_number, title, html_url, publication_date), confirmed | Not readable (bot gate) |
| Denmark Retsinformation harvesting API `GET /v1/Documents?date=YYYY-MM-DD` | Daily JSON change list, confirmed. Monitored with `{yesterday}`; an empty day means no change | Not readable without a browser |
| EU EUR-Lex | No RSS feed (candidate URLs 404) | Decision 2011/833/EU; CC BY 4.0 for editorial content |
| Finland opendata.finlex.fi | Token required; no public documentation | Not found |

A source is still not activated before its rights are reviewed.

## 4. Platform activation (owner)

| Item | Status | Unlocks |
|---|---|---|
| Lovdata rights review and activation (adapter 1.1.0, policy v2 attribution) | Open | Norwegian monitoring, ingestion and research on hosted |
| `ANTHROPIC_API_KEY` on the web server | Open | Command centre API engine |
| Claude Code routine with API trigger (`GLCI_CLAUDE_CODE_ROUTINE_URL`, `_TOKEN`) | Open | Claude Code answers and engineering tasks |
| `GLCI_GITHUB_TOKEN` (Actions read/write) and the `ANTHROPIC_API_KEY` repository secret | Open | Engineering-task fallback (GitHub workflow) |
| Web hosting of the Next.js app, with the hosted Supabase URL and publishable key | Open | Everything reaching users, including the observatory |
| Leaked-password protection (Supabase Auth setting) | Open | Security advisor recommendation |
| Payment provider, independent penetration test | Open | Commercial launch (Phase 11/13) |

The observatory shows whether each server secret is configured (never its value).

## 5. Onboarding a new country (procedure)

1. **Catalogue** the jurisdiction (registry migration or operator tooling).
2. **Profile:** record it with `glci_upsert_jurisdiction_profile` (languages, hierarchy, schedule, date rules, review).
3. **Sources:** register the official sources with `glci_register_target`, using their official addresses.
4. **Rights (owner):** review the terms. Record a rights review, or a source-specific licence policy if the source publishes a licence.
5. **Monitor:** assign one with `glci_set_target_monitor`, a generic feed or a new adapter. Confirm the format against the live source.
6. **Activate** monitoring with `glci_set_target_status`, giving a reason. Run the monitoring worker from a host that can reach the source.
7. **Ingestion (owner):** pin the source's ingestion adapter, activate it, ingest and embed.
8. **Evaluate:** run a jurisdiction evaluation set, then a held-out set. Record it.
9. **Verify currency;** coverage can then rise to pilot and partial under the database's rules.

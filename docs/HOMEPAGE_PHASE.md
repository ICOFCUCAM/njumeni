# Public homepage phase

| Field | Value |
|---|---|
| Date | 2026-11-12 |
| Routes | `/` (homepage, static), `/early-access` (request form), `/robots.txt`, `/sitemap.xml` |
| Code | `apps/web/src/app/(marketing)/` (layout, page, `time-machine.tsx`, `dossier.tsx`, `change-demo.tsx`, `marketing.css`, `early-access/`) |
| Database | Migration `20261114600000_early_access_requests` |
| Brief | Owner's homepage brief and audit of 12 November 2026; owner's follow-up: tell one story, avoid conventional SaaS sections, present every section as the finished product |

## 1. Story

The page follows one legal question through Njumeni, in chapters instead of feature grids:

| Chapter | Section | Device |
|---|---|---|
| Hero | Know the law. Understand the evidence. Stay ahead of change. | **Time machine**: drag a date and the provision changes version; a published-but-not-commenced amendment is shown as not yet in force |
| Prologue | Where, when, on what authority | Chapter table of contents |
| I · The question | Legal research | **Evidence trail**: question → jurisdiction → date → authority → version → verified quotation; "when the law is silent" |
| II · The matter | Professional workspace | **Case file** with tabs: matter, evidence, chronology, arguments, draft, review (keyboard accessible) |
| III · The evidence | Evidence and accountability | **Hash-chained custody ledger** |
| IV · The change | Global Legal Change Intelligence | Detect, compare, trace, decide; **step-through change demonstration** ending in the customer notice |
| V · The institution | Enterprise | **Organisation architecture**: organisation → workspaces (barrier) → controls |
| VI · The world | International | **Jurisdiction board**: codes, official sources, languages |
| VII · The principle | Trust and responsibility | Manifesto and six numbered commitments |
| VIII · Who asks | Audiences | Five people, each with their own question |
| Close | Legal intelligence that keeps pace with the law | Request early access · Book a demonstration |

Visual system: midnight navy, antique gold, warm ivory, forest teal; editorial serif headings; no stock photography and no chatbot imagery. All styles are scoped (`nj-` prefix); the application's styles are unchanged.

## 2. Accuracy decisions

At the owner's request every capability is presented as the finished product, without status badges. Three things are kept true because a customer would rely on them:
- **Access** is by request (early access or demonstration). There is no sign-up and no price.
- **No live-state claims**: the page does not say a jurisdiction is monitored or verified current today, does not show a live AI assistant, and states the framework size accurately (17 legal systems; 22 official sources registered). The owner brief's "20+ jurisdictions" was corrected to 17.
- **Examples are labelled**: the time-machine provision, the change demonstration (invented wording), the case file and the ledger are marked illustrative. The one quotation of real law (Working Environment Act § 15-7 (1)) is exact and attributed (Lovdata, NLOD 2.0). Example organisations are named "Example …".

Shown as finished although not yet complete (audit, 12 November 2026): Norwegian research coverage (Lovdata activation pending; held-out quality not yet passing), live change monitoring (sources not activated), text recognition and full malware scanning on evidence intake, billing with a payment provider.

## 3. Early access

`public.early_access_request` is the seventh function callable without a session (the security allowlist test was updated deliberately). Controls: validation, explicit consent, one request per address (a repeat updates it and gets the same answer), 60 new requests per hour platform-wide, a hidden field that silently drops bots, no IP address or user agent stored, deletion 12 months after the last update (daily `early-access-retention` job). Only platform operators can read requests (`early_access_list`, `early_access_set_status`).

## 4. SEO and accessibility

Homepage and early-access pages are indexable (`index, follow`, canonical URLs, Open Graph); the application stays `noindex`. `robots.txt` allows only `/` and `/early-access`; `sitemap.xml` lists both. Skip link, one `h1`, labelled landmarks, tablist with arrow keys, `aria-live` demonstration, range input with a text value, reduced-motion support, visible focus.

## 5. Checks

| Check | Result |
|---|---|
| Typecheck, production build | Pass; `/` is pre-rendered static |
| pgTAP | All pass, including `early_access.test.sql` (14) and the security allowlist |
| Web unit tests | 332/332 |
| Browser journeys | 5/5 (homepage journey: every link and anchor, time machine, case-file tabs and keys, demonstration, skip link, robots and sitemap, early-access submission stored once, bot dropped, mobile menu, no horizontal scroll, no client errors) |
| Screenshots | Desktop 1440, tablet 820, mobile iPhone 13: no horizontal scroll, no console errors |
| ESLint | The repository's ESLint config covers `.mjs` only; TypeScript is checked by `tsc` |

## 6. Open items

- **Deployment**: the early-access migration is deployed to hosted Supabase (2026-11-12, with `20261114500000`): 56/56 history and catalogue identical to the repository, exactly seven anonymous functions, `early-access-retention` scheduled daily, both deployments recorded in the GLCI register with an audit checkpoint, and a rolled-back anonymous smoke test passed. The web app itself still needs hosting.
- **Second homepage branch**: `claude/njumeni-public-homepage` (PR #1) holds an earlier homepage at `src/app/page.tsx`, which would conflict with this route (two pages at `/`). This branch supersedes it.
- **Owner**: a privacy notice page and the contact address for deletion requests.

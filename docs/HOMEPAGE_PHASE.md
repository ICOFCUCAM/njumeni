# Public homepage

| Field | Value |
|---|---|
| Current version | v3.1 — Phase 2 premium design refinement of the v3 story (2026-11-13) |
| Routes | `/` (homepage, static), `/early-access` (request form), `/robots.txt`, `/sitemap.xml` |
| Code | `apps/web/src/app/(marketing)/`: `layout.tsx`, `page.tsx`, `research-view.tsx`, `authority-chart.tsx`, `case-file.tsx`, `custody.tsx`, `observatory.tsx`, `atlas.tsx`, `journeys.tsx`, `plans.tsx`, `marketing.css`, `early-access/` |
| Assets | `apps/web/public/home/jurisdiction-atlas.svg` (Equal Earth projection, with sphere and graticule), generated from Natural Earth (public domain) through `world-atlas` 2.0.2, `topojson-client` 3.1.0 and `d3-geo` 3.1.1. These packages were used only at design time; the app has no new dependency |
| Database | Migration `20261114600000_early_access_requests` (unchanged in v3) |
| Screenshots | `docs/assets/homepage-desktop.png` (first screen), `homepage-desktop-full.png`, `homepage-mobile.png`, `homepage-overview.png` |

## 1. Story

The page tells one argument in thirteen steps. It moves from the problem, to the research answer, to professional work, to changing law, and then to institutional trust.

| # | Section | Story | Visual |
|---|---|---|---|
| 01 | Hero | Know the law. Understand its authority. Stay ahead of change. | **Research view built on real data.** It shows Working Environment Act § 15-7 (1), `LOV-2005-06-17-62`, version in force from 1 July 2026, quoted exactly from the Lovdata dataset Njumeni holds. Choosing 15 Jan 2025 shows the engine's real temporal refusal, because no version is held for that date |
| 02 | Proposition | Law is authority, time, evidence and responsibility | **Authority × time chart:** constitution, act and regulation with their versions; a date line selects the version in force at each level (illustrative versions). Evidence and responsibility follow; then the search-engine / chatbot / Njumeni contrast |
| 03 | Legal research | Ask a question, receive the authority | The eight research steps, ending with a refusal; a "why the date matters" panel showing publication versus commencement |
| 04 | Professional workspace | From research to legal work | A finding traced from research to matter to document; a tabbed case file (matter, evidence, chronology, arguments, draft, review) |
| 05 | Evidence | Every record, accounted for | **Custody ledger:** four records, each showing the previous hash and its own, linked; "chain verifies · 4 of 4 links intact" (fictional people). A two-column capability register with status labels |
| 06 | Global Legal Change Intelligence | The law changes; legal knowledge must keep up | **Change observatory** (the signature instrument): a schematic in which one invented amendment travels from the official source through compare, dates, impact, approval and notice, lighting the answers, documents and matters that relied on it, with the record kept at each stage. Beside it: the four currency states and an **observatory status board** of the hosted service today (9 jurisdictions with their registered sources, all "not monitored") |
| 07 | Jurisdictions | One framework, many legal systems | **Jurisdiction atlas:** 14 pins (reference, profiled, catalogued) with a selector; each opens the registry profile: legal system, languages, official sources and "not monitored yet". Then the seven things each jurisdiction requires |
| 08 | Organisations | Built for organisations, from the foundation up | The four organisation types; organisation → workspaces → barrier → controls |
| 09 | AI and responsibility | AI assists. The law provides the authority. Professionals retain responsibility | Where intelligence is used today, with status; four human-responsibility commitments |
| 10 | Security and governance | Protect information, preserve accountability | Seven control layers, with their database mechanisms; plain statement that no penetration test or certification has been completed |
| 11 | Who uses Njumeni | Four kinds of user, four journeys | Tabbed journeys: problem, provision, workspace and four steps each (Master Plan §2.4) |
| 12 | Plans | Clear allowances, room to grow | Tabbed by group (individuals, legal professionals, organisations); a table on larger screens and one card per plan on phones. The eight configured plans, with allowances from migration `20261112600000` (research runs, documents, AI credits, API requests, seats, storage). No prices |
| 13 | Final invitation | Legal intelligence for a world where the law never stands still | Early access, demonstration, explore, sign in |

## 2. Design system

**Tokens** are defined on `.nj`:
- navy `#142638` and deep navy `#0d1b29`;
- ivory `#f5f1e8` and paper `#fcfaf5`;
- champagne gold `#c6a66b`;
- bronze `#7f6236` (darkened from `#9a7846` for contrast);
- slate `#485665`;
- border `#ded5c4`;
- verified green `#33705f` (darkened from `#3e8273` for contrast).

**Type (v3.1):**
- An editorial serif (Iowan Old Style or Palatino) for statements and headings.
- A sans-serif for interface text.
- A monospace face for citations, identifiers and hashes.
- Body text is 17.5px (17px on phones); section headings run from 36 to 58px; leads are about 21px. No running text is smaller than 12px.

**Layout:**
- Background rhythm: navy, ivory, paper, ivory, paper, deep navy, paper, ivory, navy, paper, ivory, paper, deep navy.
- No Roman-numeral chapter labels.

**Motion:** a short fade when the research date, case-file tab, journey or change stage changes. Nothing animates on its own, and `prefers-reduced-motion` turns all of it off.

## 3. Accuracy

These are the rules for the brief's "legal product accuracy editor" role:
- **No invented law.** The one real quotation is the Act's text as held. The change walkthrough uses wording marked as invented. Matters, parties and the organisation are named "Example …".
- **Status labels.** These mark what is built, awaiting activation, in development or planned:
  - research: Norwegian sources await activation, and quality is under independent evaluation;
  - change intelligence: official sources await activation, and every jurisdiction reads "not monitored" today;
  - evidence: OCR and the antivirus engine are in development;
  - operator AI: awaiting activation;
  - customer drafting and reasoning AI: planned.
- **No coverage, certification, customer or price claims.** The framework size is stated exactly: 17 legal systems and 22 registered sources.

## 4. Phase 2 refinement (v3.1)

The narrative, section order and every claim are unchanged. Phase 2 replaced generic visuals with product-specific instruments and reviewed each section at actual browser size (1440 × 900, 820 × 1180, 390 × 844), viewport by viewport.

- **Hero:** the research view is framed as the product (workspace bar, navigation rail, question, parameters, verified result with its four checks). The date is chosen on a timeline that shows where Njumeni holds no version, so the refusal is visible before it is clicked. The headline is sized so that the call to action sits above the fold at 1440 × 900.
- **Proposition, evidence, change intelligence, jurisdictions, plans:** see the Visual column above.
- **Workspace:** the case file sits in an application frame with the matter header (status, deadline, team).
- **Defects found in the review and fixed:**
  - a hero guide line ran through the headline;
  - the timeline's date chips overlapped;
  - map pins sat up to 20px south of their countries because the legend was inside the positioned map;
  - footer column headings inherited the section-heading size;
  - the evidence capability list had lost its styles;
  - on phones and tablets the hero stayed in two columns;
  - the authority chart, observatory schematic, status board and plan table were unreadable or cramped on phones. They now have compact layouts: a stacked chart, larger schematic labels, a non-wrapping status column and plan cards.

## 5. Checks (v3.1)

| Check | Result |
|---|---|
| Typecheck and production build | Pass. `/` is pre-rendered static |
| Repository CI steps (Prettier list, ESLint list, `tsconfig.ci.json`, root tests, release gates, foundation, content policy) | Pass |
| Web unit tests | 332/332 |
| pgTAP | Pass |
| Browser journeys | 5/5 on a fresh database (pgTAP pass first). The homepage journey covers: the research view and its refusal; case-file tabs with keyboard; the change observatory; the status board (every jurisdiction not monitored); plan groups with keyboard; the four journeys and their workspaces; eight plans with no prices; every link and anchor; the skip link; robots and sitemap; early access stored once; the bot field; the mobile menu; no client errors |
| Accessibility (axe-core 4.10.3; WCAG 2 A/AA, 2.1 AA, best practice) | 0 violations at 1440, 820 and 390 px, both on load and after interaction (earlier date, final change stage, organisations plans, another jurisdiction) |
| Responsive | 1440, 820 and 390 px reviewed viewport by viewport: no horizontal scroll and no console errors |

## 6. Open items

- **Web hosting:** Vercel builds the default branch once the deployment quota allows.
- **Owner decisions:**
  - plan prices, which stay unpublished until decided;
  - a privacy notice page;
  - the contact address for deletion requests.
- **Product items that change homepage labels once done:** Lovdata activation, AI provider connection, OCR and antivirus, and the penetration test. Each status label should change when its capability does.

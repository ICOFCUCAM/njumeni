# Public homepage

| Field | Value |
|---|---|
| Current version | v5 — global institutional design excellence (2026-11-13) |
| Routes | `/` (homepage, static), `/early-access` (request form), `/robots.txt`, `/sitemap.xml` |
| Code | `apps/web/src/app/(marketing)/`: `layout.tsx`, `page.tsx`, `research-view.tsx`, `authority-chart.tsx`, `case-file.tsx`, `custody.tsx`, `observatory.tsx`, `atlas.tsx`, `journeys.tsx`, `plans.tsx`, `research-demo.tsx`, `evidence-pipeline.tsx`, `org-explorer.tsx`, `governance-flow.tsx`, `section-nav.tsx`, `marketing.css`, `early-access/` |
| Assets | `apps/web/public/home/jurisdiction-atlas.svg` (Equal Earth projection, with sphere and graticule), generated from Natural Earth (public domain) through `world-atlas` 2.0.2, `topojson-client` 3.1.0 and `d3-geo` 3.1.1. These packages were used only at design time; the app has no new dependency |
| Database | Migration `20261114600000_early_access_requests` (unchanged in v3) |
| Screenshots | `docs/assets/homepage-desktop.png` (first screen), `homepage-desktop-full.png`, `homepage-mobile.png` (first screen), `homepage-overview.png` (desktop, three columns), `homepage-mobile-overview.png` (phone, seven columns) |

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

## 5. Phase 3 refinement (v3.2)

The architecture and the claims are unchanged.

- **Hero:** one composition. Numbered markers in the research interface match a reading key under the call to action. The example says "Cited finding · example"; it no longer says "verified".
- **Research:** an "anatomy of a cited finding" panel shows question, jurisdiction, legal date, authority, provision, exact quotation, citation and checks, marked "Example · not a live answer". The eight steps are an index; "Why the date matters" is a full-width band.
- **Workspace:** one citation (§ 15-7 (1)) is traced from research, to argument 1 of the matter, to footnote 1 of the draft. It uses the case file's own example content.
- **GLCI:** an eight-stage observatory: source, amendment, comparison, commencement, impact, human approval, notification, verified current. One invented amendment passes through an approval gate into a fictional organisation's three workspaces. Below 900px it becomes a list. The status board is labelled "Actual status — not illustrative".
- **Editorial variation:** a full-width statement between change intelligence and jurisdictions ("Not only answers to legal questions. Legal knowledge that stays current."). Security is drawn as a stack: request, seven layers, the organisation's data.
- **Plans:** three audience tracks (ivory, navy, contract plans in deep navy), with monthly allowances first. The full allowance table opens on request. Configured values only, and no prices.
- **Typography:** measured on the rendered page. Uppercase labels are at least 12.5px; interface content at least 14px; notes and captions 14–14.5px; diagram text scales with its container.

## 6. v4 — integrated, interactive experience

The narrative and section order are unchanged. Each section now has one interaction with a clear purpose, and every interaction states what is real and what is illustrative.

| Section | Interaction | Real or illustrative |
|---|---|---|
| Hero | The "law as at" line runs under the headline and the answer, and the date governs the answer. Choosing 15 Jan 2025 shows the real refusal | Real: § 15-7 (1) as held, and the engine's temporal refusal |
| Research | "Run the research": choose a jurisdiction and a legal date, and watch eight steps resolve or stop. Norway gives a cited finding; Sweden and the United Kingdom decline, since no text is held; an earlier date declines, since that version is not held. The verification step states that source permission awaits rights activation | Real text and rules; not a live query |
| Workspace | One citation is traced from research to argument to footnote. The case file gains a Compliance step, a journey bar and "Next step" | Illustrative matter |
| Evidence | Eight-step pipeline (upload, fingerprint, quarantine, scan, custody, hold, versioning, bundle). Scan is marked "partly built": screening is live, the anti-malware engine is not connected. Custody records expand to show what each one seals | Mechanism as built; fictional people |
| Change intelligence | Ten stages: source, amendment, comparison (previous, new or changes), commencement, impact analysis, affected work, remediation proposal, human approval, notification, verified current. A consequence ledger shows each affected item, the action, who decides and its status at each stage. The status board is marked "Actual status"; "Not monitored" is marked as every jurisdiction's state today | Invented wording, fictional firm; the status board is real |
| Jurisdictions | Each profile shows legal system, languages, official sources, authority structure, source rights, monitoring and verification ("not evaluated · no legal coverage is claimed") | Registry framework |
| Organisations | Five environments (personal, professional, law firm, enterprise, institutional). An access check lets you pick a member and a resource and see the database's decision (workspace membership, barrier, `matter.read`, `document.read`, `audit.read`) | Rules as built; fictional people |
| AI | The statement set as three columns. A five-step governance flow (AI suggestion, source-grounded finding, professional review, human approval, recorded decision), each with its safeguard | The AI step is meaning search, which is built; customer AI is shown as planned |
| Plans | A two-question finder suggests and highlights one configured plan; the full comparison opens on request | Configured allowances only; no prices |
| Navigation | The header marks the section being read | — |

Motion: short fades and staggered step reveals; all of it is turned off under `prefers-reduced-motion`.

## 7. v5 — design excellence

- **Design system:** one token layer on `.nj` covers the type scale (`--t-display`, `--t-h2`, `--t-h3`, `--t-lead`, `--t-body`, `--t-ui`, `--t-note`, `--t-label`), spacing (`--s-1` to `--s-8`), radii, shadows, reading widths, focus, easing and duration. Section headings and leads now use it, with wider reading measures. Every interactive control has one shared focus ring and transition.
- **Hero:** the three promises (sources, date, change) sit under the stage, each keyed to a line of the headline.
- **Change intelligence:** a live currency meter (current → behind → current) runs through the ten stages, with all four states always visible. The consequence table appears only once there are consequences.
- **Evidence:** the custody chain can be verified, or a record altered: every link from the altered record onwards fails and the footer reports it.
- **Workspace:** the journey runs Research → Matter → Evidence → Chronology → Arguments → Document → Review → Sign-off → Compliance. Review and sign-off are separate steps; sign-off writes the audit record.
- **Jurisdictions:** a stage filter with counts ("Monitored live · 0"), a name label on the selected pin, and a "Content" row. Norway's legal text is prepared for activation; no jurisdiction has content available to customers.
- **Organisations:** the access check shows the path of checks (organisation, barrier, workspace, permission) and where it stops.
- **AI:** the governance flow starts at the legal source: legal source, AI suggestion, research finding, professional review, human approval, recorded decision.
- **Plans:** the full comparison shows all eight plans side by side, grouped by audience. It is a keyboard-scrollable region, with grouped cards on phones.

**The ten weakest decisions found in review, and what was done:**
1. Section headings were small for their space → new heading scale and reading widths.
2. Currency states were static → live meter in the walkthrough.
3. The consequence table was dense before it meant anything → hidden until the affected-work stage.
4. The custody chain's integrity was asserted, not shown → verify/alter demonstration.
5. The matter journey stopped at review → research and sign-off added.
6. Plan comparison needed three tabs → one grouped table.
7. Map profiles lacked content availability → "Content" row and "Monitored live · 0".
8. Access decisions lacked the reasoning path → checks shown in order.
9. The AI flow began with AI → it now begins with the legal source.
10. Dimmed map buttons failed contrast, the comparison region wasn't keyboard-reachable, and phone landmarks were duplicated → fixed (axe 0 at every width).

## 8. Checks (v5)

| Check | Result |
|---|---|
| Typecheck and production build | Pass. `/` is pre-rendered static |
| Repository CI steps (Prettier list, ESLint list, `tsconfig.ci.json`, root tests, release gates, foundation, content policy) | Pass |
| Web unit tests | 332/332 |
| pgTAP | Pass |
| Browser journeys | 5/5 on a fresh database (pgTAP pass first). The homepage journey covers: the research view and its refusal; the research demonstration (Norway, Sweden, an earlier date); the evidence pipeline and custody records; environments, the access check and the governance flow; the plan finder; version comparison and the consequence ledger; case-file tabs with keyboard; the change observatory; the status board (every jurisdiction not monitored); plan groups with keyboard; the four journeys and their workspaces; eight plans with no prices; every link and anchor; the skip link; robots and sitemap; early access stored once; the bot field; the mobile menu; no client errors |
| Accessibility (axe-core 4.10.3; WCAG 2 A/AA, 2.1 AA, best practice) | 0 violations at 1440, 1280, 768 and 390 px (iPhone 13), both on load and after interaction (earlier date, final change stage, organisations plans, another jurisdiction) |
| Responsive | 1920, 1440, 1280, 1024, 768, 390 and 360 px: no horizontal scroll and no console errors; reviewed viewport by viewport: no horizontal scroll and no console errors |

## 9. Open items

- **Web hosting:** Vercel builds the default branch once the deployment quota allows.
- **Owner decisions:**
  - plan prices, which stay unpublished until decided;
  - a privacy notice page;
  - the contact address for deletion requests.
- **Product items that change homepage labels once done:** Lovdata activation, AI provider connection, OCR and antivirus, and the penetration test. Each status label should change when its capability does.

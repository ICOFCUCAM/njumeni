# Public website

| Field | Value |
|---|---|
| Current version | v9 — Ask Njumeni, phase 0 (2026-11-13) |
| Routes | `/`, `/platform/research`, `/platform/workspace`, `/platform/change-intelligence`, `/platform/jurisdictions`, `/solutions`, `/plans`, `/security`, `/about`, `/documentation`, `/trust`, `/responsible-ai`, `/early-access-programme`, `/contact`, `/privacy`, `/terms`, `/legal`, `/ask`, `/early-access`, `/robots.txt`, `/sitemap.xml` |
| Code | `apps/web/src/app/(marketing)/`: `layout.tsx`, `page.tsx`, `research-view.tsx`, `authority-chart.tsx`, `case-file.tsx`, `custody.tsx`, `observatory.tsx`, `atlas.tsx`, `journeys.tsx`, `plans.tsx`, `research-demo.tsx`, `evidence-pipeline.tsx`, `org-explorer.tsx`, `governance-flow.tsx`, `section-nav.tsx`, `marketing.css`, `early-access/`, `ask/` |
| Assets | `apps/web/public/home/jurisdiction-atlas.svg` (Equal Earth projection, with sphere and graticule), generated from Natural Earth (public domain) through `world-atlas` 2.0.2, `topojson-client` 3.1.0 and `d3-geo` 3.1.1. These packages were used only at design time; the app has no new dependency |
| Database | Migrations `20261114600000_early_access_requests` and `20261114700000_research_question_capture` (v9) |
| Screenshots | `docs/assets/site-desktop-pages.png` and `site-mobile-pages.png` (every page), `homepage-desktop.png` (first screen), `homepage-desktop-full.png`, `homepage-mobile.png` (first screen), `homepage-overview.png` (desktop, three columns), `homepage-mobile-overview.png` (phone, seven columns) |

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

## 8. v6 — a multi-page website

Every navigation item now opens its own page, with its own URL, title, description and main heading. The homepage introduces the platform and links onward; the depth lives on the dedicated pages.

| Page | Route | Contents |
|---|---|---|
| Home | `/` | Hero and promises; why authority matters; one citation from question to signed document; evidence; the change lifecycle at a glance; the position statement; environments; AI and responsibility; four audiences; early access |
| Research | `/platform/research` | Run-the-research demonstration; the eight steps; why the date matters; retrieval, time, verification and refusal; traceability |
| Workspace | `/platform/workspace` | The citation thread; the case file from research to sign-off; capabilities with status; evidence, custody and the evidence pipeline |
| Change intelligence | `/platform/change-intelligence` | Three principles; the ten-stage observatory with currency meter and consequences; the four currency states and the actual status board; governance and auditability |
| Jurisdictions | `/platform/jurisdictions` | The jurisdiction explorer; what each jurisdiction requires; a directory of all 17 legal systems with sources and stage (active, pending, registered, planned — none active yet); how a jurisdiction is onboarded |
| Who it serves | `/solutions` | The four journeys; audiences side by side; environments, organisation structure and the access check |
| Plans | `/plans` | Plan finder, audience tracks and the full comparison (open), with notes. No prices |
| Security | `/security` | The control stack; identity, access and infrastructure, with status (SSO and private deployment are not live); the access check; AI governance |
| About | `/about` | Mission, six founding principles, vision and responsibility |
| Documentation | `/documentation` | Guides by audience, each marked "Available" or "In preparation" |

**Route decision.** `/research` and `/jurisdictions` already belong to the signed-in application, and `/[slug]` serves application modules. The four product pages therefore live under `/platform/`. The public site and the application stay separate, and no application route changed.

**Shared parts.** `site.tsx` holds the page list (one source for the header, footer, sitemap and robots), the page introduction, related links, the call-to-action band, `Tag` and `Kicker`. `section-nav.tsx` marks the current page in the header and the mobile menu.

## 9. v7 — foundations

- **Fonts:** Newsreader (editorial serif, regular and italic) and Inter (sans-serif), both under the SIL Open Font License. They are self-hosted through `next/font`, downloaded at build time and served from the site, so the visitor's browser makes no request to Google. Metric-matched fallbacks avoid layout shift. The page renders identically on macOS, Windows, Android and iOS.
- **Stylesheet:** 201 selectors that referenced classes no longer in any component were removed (7,359 → 6,337 lines). Screenshots of all 11 public pages at 1440 and 390 px were pixel-identical before and after. An attempt to merge repeated rules changed the cascade, so it was reverted.
- **Navigation:** five top-level items.
  - Platform: a menu with Research, Workspace, Change intelligence and Jurisdictions, each with a one-line description.
  - Who it serves, Security and Plans: direct links.
  - Company: a menu with About and Documentation.

  Menus are disclosure buttons. They close on Escape, an outside click or navigation, and mark the current page. The phone menu groups the same items under headings.
- **One home per demonstration:**
  - the homepage keeps only the date line and gains four doorways into the product, with change intelligence as the signature;
  - the custody chain lives on Workspace;
  - the environment selector lives on Who it serves;
  - the access check lives on Security.

## 10. v8 — trust and legal pages

| Page | Route | Contents |
|---|---|---|
| Trust centre | `/trust` | Status of 12 controls (built, awaiting activation, in development, planned); data location and processors: Supabase in the EU (Stockholm, `eu-north-1`), Vercel with its server region still to be fixed in the EU, no AI provider connected; certifications (none yet, planned); vulnerability reporting; documents; no tracking |
| Responsible AI | `/responsible-ai` | Where AI is used today, with status; six commitments (law quoted never generated, AI labelled, no authority no answer, people decide, no training on customer data or licensed legal material, evaluated before claimed); conditions for connecting a provider |
| Early-access programme | `/early-access-programme` | Who it is for; what participants receive and what is asked; three phases paced by evidence; how participants are chosen. Proposed, not a contract |
| Contact | `/contact` | Early access, demonstration, privacy requests, security reports, general enquiries, registered office |
| Privacy notice | `/privacy` | Draft. Controller; scope (controller for accounts and requests, processor for workspace content); data collected; GDPR legal bases; retention (early-access requests 12 months, as built); processors and location; cookies (essential only); rights and Datatilsynet |
| Terms of service | `/terms` | Draft. Parties; early-access service; not legal advice; accounts; acceptable use; your content (no AI training); source licences; plans; availability; liability (to be completed by counsel); ending; governing law |
| Legal notice | `/legal` | Operator, organisation number, address, contact; hosting; NLOD 2.0 attribution in English and Norwegian; not legal advice |

**Owner details live in one file**, `apps/web/src/app/(marketing)/site-details.ts`. It holds the legal name, organisation number, address, contact, privacy and security emails, governing law and the date the legal documents were approved. Anything left empty shows as "To be published before launch"; nothing is invented. While `legalApprovedOn` is empty, the privacy notice, terms and legal notice say "Draft for legal review", are marked `noindex` and are left out of the sitemap.

**Navigation:** Platform · Who it serves · Trust (Security, Trust centre, Responsible AI) · Plans (Plans, Early-access programme) · Company (About, Contact, Documentation). The footer adds a legal row: Privacy, Terms, Legal notice, Documentation.

## 11. v9 — Ask Njumeni, phase 0

"Ask Njumeni" is now the main action on the homepage and in the header. **No live answer is given anywhere.** Live public research waits for phase 1: Lovdata activated on the hosted database, and plain-language retrieval passing its evaluation (today P@5 0.506 / 0.407 and R@10 0.778 / 0.600 on the held-out sets, below the gate).

| Part | What it does |
|---|---|
| Homepage hero | A question box (`GET /ask?q=…`) with the "Ask Njumeni" button, and a note that research opens in Norway first and that questions are kept rather than answered. Secondary links: the demonstration, early access for organisations, sign in |
| Header | The gold button is "Ask Njumeni". Early access stays in the announcement bar, the mobile menu, the footer and every closing call to action |
| `/ask` | States that live research is not open. The form takes the question (prefilled from the homepage), the jurisdiction (Norway first), an optional date, the answer language (English, Bokmål, Nynorsk), an optional email and required consent. It explains what happens to the question and the three modes: demonstration (built, real text, fixed example), early-access research (awaiting activation, organisations), live research for everyone (planned) |
| Confirmation | Says the question has not been answered. No answer, quotation or source is shown |
| Server action | `ask/actions.ts`: the bot field (stores nothing and confirms as normal); consent and input are checked on the server; errors keep the question |
| Database | `private.research_question_submissions`: RLS on, no access for visitors or customers. `research_question_submit` is the only way in (callable without a session; consent required; input checked; 120 an hour across all visitors before `BUSY`). `research_question_list` is for platform operators only. `research_question_purge_expired` runs daily through pg_cron and deletes questions after 30 days. No IP address or user agent is stored |
| Privacy notice | Adds what is collected, the purpose and legal basis (consent), and the 30-day deletion |

**Hosted:** the migration is **not** applied to the hosted database. Until it is, the form on the live site answers "Your question could not be sent" and stores nothing.

## 12. Checks (v9)

| Check | Result |
|---|---|
| Typecheck and production build | Pass. `/` is pre-rendered static |
| Repository CI steps (Prettier list, ESLint list, `tsconfig.ci.json`, root tests, release gates, foundation, content policy) | Pass |
| Web unit tests | 332/332 |
| pgTAP | 1029/1029 on a fresh database (41 files, including `research_question_capture`: 13 tests) |
| Browser journeys | 5/5 on a fresh database (pgTAP pass first). The homepage journey covers: Ask Njumeni (the hero box carries the question to `/ask`; consent checked on the server; stored once, email in lower case, 30-day deletion; no answer or quotation shown; the bot field stores nothing); the research view and its refusal; the research demonstration (Norway, Sweden, an earlier date); the evidence pipeline and custody records; environments, the access check and the governance flow; the plan finder; version comparison and the consequence ledger; case-file tabs with keyboard; the change observatory; the status board (every jurisdiction not monitored); plan groups with keyboard; the four journeys and their workspaces; eight plans with no prices; every link and anchor; the skip link; robots and sitemap; early access stored once; the bot field; the mobile menu; no client errors |
| Accessibility (axe-core 4.10.3; WCAG 2 A/AA, 2.1 AA, best practice) | 0 violations on all 19 pages at 1440, 1280, 768 and 390 px (iPhone 13), plus the Ask Njumeni confirmation and error states, both on load and after interaction (earlier date, final change stage, organisations plans, another jurisdiction) |
| Responsive | 1920, 1440, 1280, 1024, 768, 390 and 360 px: no horizontal scroll and no console errors; reviewed viewport by viewport: no horizontal scroll and no console errors |

## 13. Open items

- **Apply `20261114700000_research_question_capture` to the hosted database** (on the owner's "deploy"), so the Ask Njumeni form stores questions in production.
- **Ask Njumeni phases 1–5** (activation and quality gate, registered research, guest research, AI explanations, change alerts) wait for the owner decisions listed in the assessment: Lovdata activation, guest limits, a bot check, retention, the AI provider, an email provider and languages.
- **Fill in `site-details.ts`** (legal name, organisation number, address, contact, privacy and security emails, governing law), have counsel review the privacy notice and terms (including the liability section), then set `legalApprovedOn`.
- **Pin the Vercel server region to the EU**, and update the trust centre and privacy notice once it is set.

- **Web hosting:** Vercel builds the default branch once the deployment quota allows.
- **Owner decisions:**
  - plan prices, which stay unpublished until decided;
  - a privacy notice page;
  - the contact address for deletion requests.
- **Product items that change homepage labels once done:** Lovdata activation, AI provider connection, OCR and antivirus, and the penetration test. Each status label should change when its capability does.

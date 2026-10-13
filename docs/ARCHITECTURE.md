# Consent-platform marketing site: architecture and design breakdown

How a modern consent-management (CMP) vendor's marketing homepage is put
together, reverse-engineered from full-page screenshots of cookiebot.com
(October 2026). The working skeleton is in [`/site`](../site).

The skeleton copies the **structure, layout system and interaction patterns**.
It uses a placeholder brand ("Njumeni"), rewritten placeholder text and
CSS-drawn stand-ins for illustrations and logos. The original wording,
artwork, client logos and trademarks belong to their owners and are not
included.

> **What's observed and what isn't.** Everything in §1–§4 comes from the
> screenshots. §5–§6 describe how CMP sites and scripts generally work, plus
> a recommended stack for your own build. The reference site's actual
> server-side stack (CMS, hosting, CDN) **was not verified**, because the
> build environment couldn't reach the site. §7 lists how to check it in two
> minutes from your own browser.

---

## 1. Site map / information architecture

```
/                                 Home (this breakdown)
├── Products ▾                    mega menu
│   ├── Core CMP / Advanced CMP   tiered product pages
│   ├── Add-ons                   audience survey, consent mode, …
│   ├── CMS plugins               WordPress, Wix, Shopify …
│   └── Cookie checker            free scanner (lead magnet)
├── Regulations ▾                 one landing page per law
│   ├── GDPR, DMA (EU)
│   ├── CCPA, VCDPA (US)
│   ├── LGPD (BR), POPIA (ZA), FADP (CH) …
│   ├── TCF v2.2, Google / Microsoft consent modes
│   └── View all regulations
├── Partners ▾                    affiliate, partner program, find a partner
├── Resources ▾                   blog, customer stories, hubs, course, calculators
├── Pricing
├── (utility) Search · Log in · Support · Language ▾
└── Footer-only                   About, Careers, Developer docs, legal pages
```

The footer columns (Products / Regulations / Partners / Resources / Company)
mirror the mega-menu groups. Use one data source for both (see §6).

---

## 2. Page anatomy: homepage, top to bottom

| # | Section | Layout | Key components | Background |
|---|---------|--------|----------------|------------|
| 0 | **Utility bar** | right-aligned row | Search (opens overlay), Log in, Support, Language dropdown | white |
| 0 | **Main nav** (sticky) | logo · 4 dropdowns + Pricing · CTA right | mega menus, `START FREE` brand button | white, translucent once scrolled |
| 1 | **Hero** | centred, full bleed | uppercase condensed H1 · lead paragraph · 2 CTAs (solid black / black outline) · 3-item trust row with icons · 3-panel product screenshot collage · floating certification badges | brand blue + faint concentric arcs |
| 2 | **Logo marquee** | single row, infinite scroll | 7+ customer wordmarks, edge fade | page grey |
| 3 | **Stats band** | 4 columns, 2px vertical dividers | big condensed number + label | sunk grey |
| 4 | **Solution picker** | H2 + 2 equal cards + centred outline button | card = title + audience tags + copy + arrow link; light-gradient card vs dark-gradient card (double frame: outer gradient, inner glass panel) | page grey |
| 5 | **Why us** | H2 + 3 columns | blue line icon · H3 · paragraph | sunk grey |
| 6 | **Persona carousel** | prev/next (top right) · card · 3 tabs | card = illustration left / H2 + text + link right; tabs = progress bar + label (Marketers / Tech team / Legal), autoplay fills bar | page grey, white card |
| 7 | **Feature rows ×4** | 2 columns: text left, art right (not alternating) | H2 · paragraph · 3 bullets with shield-check icon · arrow link · laptop line-art with floating tiles + figure | page grey |
| 8 | **Scan band** | left-aligned | H2 · line · URL input + black `SCAN NOW` | brand blue, darker top/bottom rules |
| 9 | **How it works** | H2 + 3 step cards + arrows + CTA | "Step n" · sentence · mini illustration (form / code snippet / banner) | page grey, white cards |
| 10 | **Promo band** | left-aligned | H2 · line · black `ENROLL FOR FREE` | brand blue |
| 11 | **Latest articles** | H2 (narrow) + 3 cards | 16:9 image · bold title · clamped excerpt · category chip | page grey |
| 12 | **CMS downloads** | H2 + 2 cards | platform logo · title · text · brand button | white cards |
| 13 | **Footer** | see below | | black |
| ∞ | **Consent FAB** | fixed bottom-left | round brand button that reopens the consent banner | — |

**Footer, top to bottom:** newsletter (heading + text on the left; email input,
Subscribe button and consent fine print on the right) → 5 link columns →
logo + copyright + trademark line → privacy-rights links (Do not sell/share,
Data subject requests, Manage preferences) → legal links + language and
region selects + social icons → row of certification and review badges.

---

## 3. Design system

All values are in [`site/css/tokens.css`](../site/css/tokens.css). Colours are
sampled by eye from the screenshots, so treat them as close approximations.

### Colour
| Token | Value | Use |
|-------|-------|-----|
| `--c-brand` | `#1aa0f5` | hero, bands, primary buttons, icons, active tab bar |
| `--c-brand-strong` | `#0a7fd1` | text links, hover, band rules |
| `--c-ink` | `#0b0b0c` | headings, black CTA, footer |
| `--c-surface-alt` | `#f5f7fa` | default page background |
| `--c-surface-sunk` | `#eceff3` | alternating bands (stats, features) |
| `--c-dark` / `--c-dark-blue` | `#05090f` / `#0a3d62` | dark solution card gradient |

The palette is deliberately small: **one saturated brand blue, black, and
greys**. Illustrations use only these three.

### Typography
- **Display:** a condensed grotesque, bold (Roboto Condensed in the skeleton). It's used for every heading, button, nav item and stat, and set uppercase for the hero H1, buttons and utility links.
- **Body:** a neo-grotesque, regular (Roboto).
- **Scale:** fluid `clamp()` sizes. Hero ≈ 68px, H2 ≈ 54px, card title ≈ 34px, feature title ≈ 24px, stat ≈ 60px and lead ≈ 22px at desktop width.

### Layout
- Content column ≈ **1408px** wide (282 → 1690px at a 1920px viewport), with fluid gutters.
- Section padding: 64–128px, fluid.
- Grids: 2-up (solutions, feature rows, CMS cards), 3-up (features, steps, articles), 4-up (stats), 5-up (footer).
- Breakpoints: **1100px** (burger nav; everything drops to one column) and **760px** (stats go 2×2, buttons go full width, collage simplifies).

### Shape and depth
- Buttons have **square corners**. Tags have 4px corners, the persona card 10px, solution cards 24px.
- Shadows are very soft. Depth comes mainly from colour blocks, not elevation.

### Iconography and illustration
- Line icons drawn with a 2–3.5px stroke in brand blue.
- Illustrations are flat line art (black outline, blue fills, grey shapes) built around one recurring **laptop frame**, with floating "tiles" for regulations, toggles or scan results.

---

## 4. Component inventory and behaviour

| Component | File / selector | Behaviour |
|-----------|-----------------|-----------|
| Sticky header | `.site-header` | utility bar slides away after 80px of scroll (`.is-condensed`); backdrop blur |
| Dropdown / mega menu | `[data-dropdown]` | click toggles, `aria-expanded`; closes on outside click and Esc |
| Mobile nav | `[data-nav-toggle]` | burger opens a drawer under the header (≤1100px) |
| Search overlay | `[data-search]` | modal dialog, focuses the input |
| Buttons | `.btn--brand / --ink / --outline-ink / --lg` | colour swap on hover |
| Arrow link | `.link-arrow` | arrow nudges right on hover; `--external` variant shows ↗ |
| Logo marquee | `[data-marquee]` | JS clones the list, CSS scrolls it by −50% in a loop; pauses on hover |
| Stat counter | `.stat dd` | counts up when scrolled into view; keeps the "M", "+" and comma formatting |
| Solution card | `.solution-card--light/--dark` | static |
| Persona carousel | `[data-carousel]` | ARIA tabs, prev/next, arrow-key navigation, autoplay every `--persona-dur` with a progress bar, pauses on hover |
| Checklist | `.checklist` | shield-check bullets |
| Inline form | `.inline-form` | input and button joined edge to edge |
| Consent banner + FAB | `[data-consent]`, `.consent-fab` | demo only: stores the choice and fires a `consent:updated` event |

Every animation respects `prefers-reduced-motion`.

---

## 5. How the consent layer works (the product the site sells, running on itself)

A CMP vendor's site runs its own CMP. The general pattern:

1. **One script tag as the first thing in `<head>`**, before any analytics or ad tag:
   `<script id="…" src="https://consent.<vendor>/…js" data-cbid="<site-id>" data-blockingmode="auto">`
2. **Auto-blocking.** The script rewrites or holds back `<script>`, `<iframe>` and pixels that set cookies until the visitor consents. Tags can also be marked by hand (`type="text/plain" data-cookieconsent="marketing"`).
3. **Categories:** Necessary (always on), Preferences, Statistics, Marketing. These are the four toggles in feature-row 2's illustration.
4. **Signals:** the CMP sends consent state to Google Consent Mode v2 (`gtag('consent','update',…)`), Microsoft UET consent mode, Amazon's consent signal, and IAB TCF v2.2 (`__tcfapi`). These match the badges in the hero and feature-row 1.
5. **Scanner:** a crawler visits the site on a schedule, detects cookies and trackers, classifies them, and fills in the cookie declaration (the "Cookie declaration" footer link).
6. **Geo-targeting:** the visitor's region decides which rules and banner apply (GDPR opt-in vs CCPA opt-out with "Do not sell/share").
7. **Reopen:** the floating bottom-left button and the "Manage your preferences" footer link both call the CMP's `renew()` / show-banner API.

The skeleton's demo banner stands in for steps 1–4; swap it for a real CMP script.

---

## 6. Recommended architecture for your own build

```
            ┌──────────────┐   webhooks   ┌──────────────────┐
 editors →  │ Headless CMS │ ───────────▶ │ CI build (SSG)   │
            │  pages, nav, │              │ Astro / Next.js  │
            │  posts, i18n │              │ static export    │
            └──────────────┘              └────────┬─────────┘
                                                   ▼
 visitor ─▶ CDN edge (cache, geo header, redirects, hreflang) ─▶ static HTML/CSS/JS
                 │                                   │
                 ├─ consent script (first in head) ──┤
                 ├─ tag manager (gated by consent) ──┤
                 └─ forms → API (signup, scan, newsletter) → CRM / marketing automation
```

- **Content model:** `Page` (an ordered list of *section blocks*: hero, logos, stats, solutions, features, persona-carousel, feature-row, band, steps, articles, cms-cards), `Post`, `Regulation`, `NavigationMenu` (feeds both the mega menu and the footer), `Locale`.
- **Components:** one component per row of the §2 table, each reading only the §3 tokens. Every page is a stack of blocks, so marketers can build new landing pages without a developer.
- **i18n:** subfolder per locale (`/de/`, `/fr/`…), `hreflang` alternates, and language plus region pickers in the header and footer.
- **SEO:** static HTML, a canonical URL per page, Organization/Product/FAQ JSON-LD, and generated sitemaps.
- **Performance:** self-hosted fonts with `font-display: swap`, responsive AVIF/WebP images, lazy-loaded below-the-fold sections, and no JS needed to read content.
- **Forms:** server endpoints with bot protection; the newsletter keeps the consent fine print and a double opt-in.
- **Accessibility:** skip link, ARIA tabs and menus, visible focus rings, reduced-motion support, and contrast ≥ 4.5:1. Black text on `#1aa0f5` passes; white text on it does **not**, which is why the hero and bands use black text.

---

## 7. Verifying the reference site's real stack (unverified here)

Open the site in your browser, then:

1. **View source** (`Ctrl+U`) and search for:
   - `wp-content` / `wp-json` → WordPress
   - `__NEXT_DATA__` / `/_next/` → Next.js
   - `data-wf-` → Webflow
   - `___gatsby` → Gatsby
   - `consent.cookiebot.com/uc.js` (and its `data-cbid`) → their CMP script
2. **DevTools → Network → the document request → Response headers**:
   `server`, `x-powered-by`, `cf-ray` (Cloudflare), `x-amz-cf-id` (CloudFront), `x-vercel-id`, `x-served-by` (Fastly).
3. **DevTools → Network → JS**: tag manager (`gtm.js`), analytics, chat and A/B-testing scripts.
4. Or run the Wappalyzer / BuiltWith browser extension.

Paste the results back and this section can be filled in with facts.

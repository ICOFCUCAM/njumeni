# njumeni

A marketing-site skeleton for a consent-management platform. Its structure,
design system and interactions are reverse-engineered from a reference CMP
homepage.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): site map, section-by-section page anatomy, design tokens, component inventory, how the consent layer works, recommended build architecture.
- [`site/`](site): dependency-free HTML/CSS/JS skeleton.
  - `css/tokens.css`: colours, type scale, spacing, layout and motion tokens (change the brand here).
  - `css/main.css`: layout and components, in page order, plus responsive rules.
  - `js/main.js`: sticky header, mega menus, mobile nav, search overlay, logo marquee, stat counters, persona carousel, demo consent banner.

## Run

```sh
cd site && python3 -m http.server 8000   # then open http://localhost:8000
```

All text, logos and illustrations are placeholders. Replace them with your own.


## Legal technology research sources

Njumeni maintains selected upstream legal-technology projects as separate local checkouts for engineering research. See [the source register](third-party/legal-open-source/README.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

To obtain the upstream repositories in your local Njumeni workspace, run:

```bash
bash scripts/bootstrap-legal-sources.sh
```

These projects are not merged into the Njumeni application. Review each project's licence and architecture before adopting code.


## Product boundaries

The existing Njumeni site remains the CMP product. The legal AI platform is a separate product and must be developed in a separate GitHub repository. See [the product-boundary decision](docs/PRODUCT_BOUNDARIES.md) and [the legal AI architecture assessment](docs/LEGAL_AI_PLATFORM_ARCHITECTURE.md).

## Legal AI platform direction

A separate proposed architecture assessment is available in [docs/LEGAL_AI_PLATFORM_ARCHITECTURE.md](docs/LEGAL_AI_PLATFORM_ARCHITECTURE.md). It records the product-scope mismatch with the current CMP marketing skeleton, the five upstream project assessments, licence constraints, recommended domain boundaries and implementation sequence. It is a proposal, not an implemented legal application.

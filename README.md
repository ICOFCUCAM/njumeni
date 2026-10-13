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

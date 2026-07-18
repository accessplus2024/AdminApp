---
name: accessplus-design
description: Use this skill to generate well-branded interfaces and assets for Access+Plus (Access+), a Brazilian education-access platform, either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and shadcn-style UI kit components for prototyping the admin web app.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets
out and create static HTML files for the user to view. If working on production code,
you can copy assets and read the rules here to become an expert in designing with this
brand.

If the user invokes this skill without any other guidance, ask them what they want to
build or design, ask some questions, and act as an expert designer who outputs HTML
artifacts _or_ production code, depending on the need.

## Quick map
- `readme.md` — the full design guide: brand context, content & visual foundations,
  iconography, caveats, and an index/manifest.
- `styles.css` — global entry point (link this one file); `@import`s all tokens.
- `tokens/` — colors, typography, spacing, radius, shadows, base, fonts.
- `components/` — shadcn-flavoured React primitives (`core/`, `forms/`, `feedback/`,
  `navigation/`, `data/`), each with `.jsx` + `.d.ts` + `.prompt.md`.
- `components/components.css` — class-based component styling (shipped via styles.css).
- `ui_kits/admin/` — interactive recreation of the Access+ admin web app.
- `guidelines/` — foundation specimen cards.
- `assets/` — A+ app icons, ACCESS+PLUS wordmarks, hero key visual.

## Brand in one line
Loud, optimistic Brazilian-youth energy built on the *vestibular* metaphor — every
colour is named after exam stationery. Display type Futura Std (substitute: Jost);
body Poppins. Primary action colour is **azul `#4101F6`**. Copy is pt-BR, warm,
second-person, often ALL CAPS for hero moments. See `readme.md` for the full system
and the substitution caveats (Futura→Jost, icons→Lucide, raster logos).

# Access+Plus — Design System

> **Para quem busca as próprias oportunidades.**
> _For those who seek out their own opportunities._

This is the design system for **Access+Plus (Access+)**, a Brazilian education-access
platform. Access+ helps **low-income Brazilian students** discover and apply to
competitive, career-boosting opportunities — scholarships, exchange programs,
selective courses, internships, mentorships and other "oportunidades" that are
usually invisible to students without the right networks.

This project specifically holds the design foundations and UI kit for the
**Access+ admin web app** — the internal tool the Access+ team uses to curate
opportunities, manage students and applications, and publish content. The admin
app is built on **shadcn/ui** primitives, re-skinned with the Access+ brand.

---

## Source material

The system was reverse-engineered from the brand's own materials. Keep these on
file for anyone who has access:

| Source | What it is | Location |
| --- | --- | --- |
| `CDF.png` | Master brand key visual / hero banner (mascot + student, magenta→orange diagonal blocks) | `uploads/CDF.png` → `assets/hero-banner.png` |
| Brand book sheet (PNG) | The official brand sheet: iconografia, tipografia, logotipo, cores principais, ícones | `uploads/pasted-1781501055529-0.png` |
| `Accessplus - Board Logotipo.ai` | Vector logo lockups (Adobe Illustrator) | **Not delivered to this project** — see Caveats |

Product domain: `www.accessplus.com.br`.

> **⚠️ Asset caveat.** The `.ai` vector logo was referenced but never landed in the
> filesystem, so all logo/icon assets here are **raster crops** taken from the brand
> sheet PNG. They are crisp at display sizes but not infinitely scalable. Please
> upload the `.ai` (or SVG/PNG exports) for production-grade vector logos.

---

## Brand in one breath

Access+ is **loud, optimistic and unmistakably Brazilian-youth**. The visual world
is built around the metaphor of the **vestibular** (Brazil's high-stakes university
entrance exam) and the everyday stationery students use to study: coloured pens,
highlighters and correction fluid. Every brand colour is literally named after a
piece of exam stationery. The tone is encouraging, direct and peer-to-peer — it
talks to students like a sharp older sibling who has been through it, not like an
institution.

The mark is a chunky, rounded **"A+"** — the grade everyone is chasing — and the
wordmark **ACCESS+PLUS** sets the "+" as a separate, coloured accent.

---

## CONTENT FUNDAMENTALS

How Access+ writes.

- **Language:** Brazilian Portuguese (pt-BR) first. The admin app UI is in pt-BR.
- **Voice:** Encouraging, plain-spoken, action-oriented. Speaks _to_ the student
  ("você"), peer-to-peer — never bureaucratic. Think motivated mentor, not ministry.
- **Address:** Second person ("você", "suas oportunidades"). Avoids the formal
  "o(a) usuário(a)". In the admin tool, copy is functional and concise (it's a
  team tool) but keeps the warm, plain register.
- **Casing:**
  - Display / hero copy is frequently **ALL CAPS** for punch
    (e.g. `PARA QUEM BUSCA AS PRÓPRIAS OPORTUNIDADES`).
  - Within all-caps lines, **key words are emphasised by weight** (BUSCA,
    OPORTUNIDADES set heavier than the rest).
  - UI labels and body use **sentence case**.
- **Tone words:** oportunidade, acesso, futuro, bolsa, conquista, busca, prepara.
- **Emoji:** Not part of the brand system. Don't use emoji in product UI.
  Personality comes from colour, the 3D mascot, and the icon set instead.
- **Punctuation flourish:** The literal "+" is a brand device — used in the logo and
  occasionally in copy as a connector/intensifier. Use sparingly and intentionally.
- **Numbers/stats:** Only when they mean something to the team (counts of open
  opportunities, applications, deadlines). No vanity metrics or decorative figures.

**Examples**

- Hero (marketing): `PARA QUEM BUSCA AS PRÓPRIAS OPORTUNIDADES` / `ACESSE WWW.ACCESSPLUS.COM.BR`
- Admin section title: `Oportunidades` · `Estudantes` · `Candidaturas` · `Conteúdo`
- Admin button: `Nova oportunidade`, `Publicar`, `Salvar rascunho`
- Empty state: `Nenhuma candidatura ainda. Assim que um estudante se inscrever, ela aparece aqui.`
- Confirmation: `Oportunidade publicada com sucesso.`

---

## VISUAL FOUNDATIONS

**Colour.** Seven named brand colours, plus a cool indigo-tinted neutral scale.
The brand colours are vivid and high-energy; the neutrals keep the dense admin UI
calm so colour can mean something.

| Token | Hex | Brand name | Role |
| --- | --- | --- | --- |
| `--azul` | `#4101F6` | _caneta azul vestibular_ | Primary. Actions, links, focus, brand. |
| `--ink` | `#0E0033` | _caneta preta vestibular_ | Foreground text, sidebar, dark surfaces. |
| `--vermelha` | `#FE4633` | _caneta vermelha vestibular_ | Destructive / urgent / alerts. |
| `--corretivo` | `#F9F9F9` | _corretivo apaga caneta_ | Paper / app background. |
| `--grifa-texto` | `#CFF665` | _grifa texto_ | Lime highlight. Positive accents, selection. |
| `--grifa-topicos` | `#F239A7` | _grifa tópicos_ | Pink highlight. Categories, secondary accent. |
| `--citacoes` | `#9CF0E3` | _citações_ | Mint. Quotes, info, soft accent. |

Usage discipline: **azul** is the only "action" colour. The lime/pink/mint
highlighters are accents — for tags, charts, status and small emphasis — never for
primary buttons. The whole palette is saturated, so apply colour in small, decisive
doses against generous neutral space. Imagery is **warm and high-saturation**
(magenta→orange), with bold diagonal colour blocks; the mascot is a glossy 3D
character. No grain, no muted/desaturated photography, no duotone.

**Type.** Two families.
- **Display / headings → Jost** (substituting the brand's _Futura Std_): geometric,
  heavy, often set tight and in caps for hero moments.
- **Body / UI → Poppins**: friendly geometric humanist sans. Light/Regular for
  reading, Medium/SemiBold for UI labels.
See Caveats re: the Futura→Jost substitution.

**Spacing & layout.** 4px base grid. The admin app is a classic fixed
**dark sidebar (ink) + light content canvas** shell: 248px sidebar, 60px top bar,
1280px max content width, 24px gutters. Generous breathing room; content grouped
into cards on the `--corretivo` canvas.

**Corner radius.** The brand lives on **pills and soft geometry** — the logo
lockups and app icons are fully rounded. In product: inputs/buttons ~10px, cards
~14px, modals ~20px, and full pills (`--radius-pill`) for segmented controls,
filter chips and brand lockups.

**Cards.** White (`--card`) on the off-white canvas, `--radius-lg` corners, a
hairline `--border` (1px, `--neutral-200`), and a very soft cool shadow
(`--shadow-sm`). Elevation is restrained — flat-ish surfaces, with real shadow
reserved for overlays (dropdowns, dialogs, toasts → `--shadow-lg`/`--shadow-xl`).

**Shadows.** Soft and **cool-tinted toward the indigo ink** (`rgba(14,0,51,…)`),
never pure black. Five-step ramp (xs→xl).

**Borders.** 1px hairlines in `--neutral-200`. Inputs use `--input`; focus swaps
to a 3px `--azul` ring (`--ring-shadow`).

**Animation.** Quick and purposeful. ~150–200ms ease-out for hovers and state
changes; ~200–250ms for overlays (fade + slight rise/scale). No bouncy or
playful spring physics in the admin tool — energy comes from colour, not motion.
Respect `prefers-reduced-motion`.

**Hover / press.**
- Buttons (primary): hover darkens the azul slightly; press shrinks ~1% (`scale(.99)`).
- Ghost / list rows: hover fills with `--accent` (`--neutral-100`).
- Links: hover underlines.
- Cards (interactive): hover lifts shadow xs→md and border darkens a step.

**Transparency / blur.** Used sparingly: overlay scrims (`rgba(14,0,51,.45)`)
behind dialogs; optional subtle backdrop blur on sticky top bars. Not a glassmorphism
brand — surfaces are mostly solid.

**Protection / legibility.** Over the magenta→orange key visual, text sits either
on the solid colour blocks or inside a pill/capsule (e.g. the URL capsule on the
hero). Prefer **capsules over gradient scrims** for protecting text on imagery.

---

## ICONOGRAPHY

The brand sheet shows a set of **bold, filled, white-on-azul rounded-square icons**
(achievement/flag, climber, translate, graduation cap, A+ medal, pencil/edit,
document, open book, globe). They are solid (not stroked), friendly and chunky —
matching the rounded geometry of the logo.

- **Style of the brand reference set:** filled / solid, rounded corners,
  single-weight, white-on-azul. No SVG sources were provided for them.
- **Product icon system → [Lucide](https://lucide.dev) via CDN.** The admin app is
  built on shadcn/ui, whose native icon set is Lucide, so the product standardises
  on Lucide for every UI glyph (nav, buttons, tables, inputs). Lucide renders as
  inline **SVG** — crisp at any size and reliable in every export/screenshot path.
  Load it once per page:
  `<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>`
  then `lucide.createIcons()`; place icons with `<i data-lucide="name"></i>`.
  **Substitution flag:** Lucide is *stroke* (outline) while the brand's marketing
  icons are *solid/filled*. They're a deliberately different register — product
  chrome (Lucide, light) vs. brand feature illustrations (solid). Provide the real
  solid icon SVGs to use them on the azul "feature tiles" exactly as drawn.
- **Icon container treatment:** brand "feature" icons sit as glyphs inside an
  `--azul` rounded square (`--radius-md`), echoing the brand sheet. Inline UI icons
  are simply `--ink` / `--muted-foreground` glyphs at 16–20px.
- **Emoji:** never used as icons.
- **Unicode glyphs:** avoided as icons; use the icon font instead. (The literal
  brand "+" is treated as a brandmark, not an icon.)

Real brand raster assets that ARE included (`assets/`): the eight **A+ app icons**
(one per brand colour), six **ACCESS+PLUS wordmark lockups**, and the **hero banner**.

---

## CAVEATS / SUBSTITUTIONS

1. **Futura Std → Jost.** Titles should be Futura Std (licensed). Substituted with
   Jost (Google Fonts). Please provide licensed Futura Std web binaries to swap in.
2. **Icon set → Lucide (stroke).** The brand's custom solid icons weren't provided
   as vectors; the product standardises on Lucide (shadcn's set) for reliable SVG
   rendering. Provide the real solid SVGs to match the marketing icons exactly.
3. **Logos are raster crops** from the brand sheet — the `.ai` vector never arrived.
   Upload it (or SVG exports) for scalable logos.
4. **No native "success" green** exists in the brand; `--success` is a derived green
   for functional status. Lime (`--grifa-texto`) is the brand-positive accent.

---

## INDEX / manifest

Root files:
- `styles.css` — global entry point (only `@import`s). **Consumers link this.**
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skill front matter for use in Claude Code.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`,
  `radius.css`, `shadows.css`, `base.css`.
- `components/components.css` — class-based component styling (shipped via styles.css).
- `assets/` — `icon-*.png` (8 app icons), `logo-*.png` (6 wordmarks),
  `hero-banner.png`.
- `guidelines/` — foundation specimen cards (Design System tab).

**Components** (`components/<group>/`) — React primitives, each with `.jsx` +
`.d.ts` + `.prompt.md`, reachable as `window.AccessPlusDesignSystem_ece1f0.<Name>`:
- `core/` — **Button**, **Badge**, **Card** (+ `CardHeader/Title/Description/Body/Footer`), **Avatar**
- `forms/` — **Input**, **Textarea**, **Select**, **Checkbox**, **Switch**, **Field**
- `feedback/` — **Alert**, **Dialog**
- `navigation/` — **Tabs**
- `data/` — **Table**, **Stat**

**UI kits** (`ui_kits/<product>/`):
- `admin/` — interactive recreation of the **Access+ admin web app**
  (login, dashboard, opportunities + full filter rail, opportunity detail,
  create/edit/publish/delete editor, newsletter from Instagram, team members).
  See its `README.md`.

_Generated files (`_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`)
are produced by the compiler — do not edit by hand._

# Access+ Admin — UI Kit

High-fidelity, interactive recreation of the **Access+ admin web app** — the internal
tool the Access+ team uses to curate opportunities and run the newsletter. Built by
composing this design system's component primitives.

## Run
Open `index.html`. It loads `../../styles.css`, the compiled `_ds_bundle.js`,
React + Babel, and Lucide, then mounts the app. Starts on the **login** screen
(any credentials → "Entrar"). Auth + active screen persist in `localStorage`.

## Flows & screens
| File | Surface |
| --- | --- |
| `Login.jsx` | Branded split login (key visual + form). Entry point; "Entrar" opens the app, logout (sidebar) returns here. |
| `AppShell.jsx` | Dark ink sidebar (Visão geral · Oportunidades · Newsletter · Membros do time) + sticky top bar. |
| `Dashboard.jsx` | KPI tiles, recent opportunities, "por tipo" breakdown, activity feed. |
| `Opportunities.jsx` | Opportunity list with the **full filter rail** — Tipo, Inscrições abertas, Nível, Público-alvo, Custo, Interesse — plus live search & sort. |
| `OpportunityDetail.jsx` | Full opportunity page: descrição, elegibilidade & guia, sobre o processo, dicas de contemplados, informações adicionais, **recursos online** (YouTube · Reddit · Instagram), tags relacionadas, resumo + público-alvo sidebar. Editar / Publicar-Despublicar / Excluir. |
| `OpportunityEditor.jsx` | Create / edit form (all fields + classificação chips) with a sticky action bar: Excluir · Salvar rascunho · Publicar. |
| `Newsletter.jsx` | Compose a newsletter from connected **Instagram accounts** — pick accounts, select recent posts, live email preview, save/schedule/publish. "Edições anteriores" tab. |
| `Team.jsx` | Membros do time — roles/permissions table + invite dialog. |
| `data.js` | Mock pt-BR data: rich opportunities, filter taxonomy, team, Instagram accounts/posts, newsletters. |
| `icons.js` | `window.Ic(name, className)` — inline-SVG Lucide renderer (React-safe, exports cleanly). |

## Working interactions
- Login → app → logout. Sidebar nav. Persisted view.
- Opportunities: filters (multi + radio), search, sort; click a card → detail.
- Detail: Publicar/Despublicar flips status; Excluir (confirm dialog) removes it.
- Editor: create new or edit existing; Salvar rascunho / Publicar write back to the
  in-memory list; Excluir from the editor too.
- Newsletter: toggle Instagram accounts, select posts, watch the preview rebuild.
- Team: invite dialog.

## Components used (from the bundle)
`Button`, `Badge`, `Card` (+ sections), `Avatar`, `Stat`, `Table`, `Tabs`,
`Input`, `Select`, `Textarea`, `Checkbox`, `Switch`, `Field`, `Dialog`.

## Notes
- Data is mocked; no backend. Online resources & Instagram posts are representative
  mocks — wire them to the real YouTube / Reddit / Instagram APIs in production.
- Icons render via inline SVG (`window.Ic`) so they survive React re-renders and
  export cleanly.

# Sentinel MCP server

Exposes the Sentinel's research and validation pipeline as an MCP server, so you can run catalog reviews from any MCP client (Claude Desktop, Claude Code, Cursor, an Ollama-based client…) **with whatever model that client uses**.

The server never calls a model itself. Your client's model reads the sources and writes the dossier and the field corrections; the server does everything deterministic around it — fetching sources with provenance, checking every quote literally against the source text, the deadline / geographic-exclusion / structural-ineligibility detectors, taxonomy normalization — and saves the result as a **pending proposal**. Nothing is written to `opportunities` directly: an Admin/Editor still applies or rejects each field on the Sentinel screen, exactly like a regular review.

## Setup

1. `npm install` (or `bun install`) at the repo root.
2. The repo's `.env` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, the same values the panel uses.
3. Sign in once with Google, the same way you sign in to the panel:

   ```sh
   npm run mcp:login
   ```

   This opens Google in your browser and saves the session to `~/.config/access-sentinel/session.json` (mode 600). The server reuses that session and refreshes it automatically. The server acts as you, so Supabase RLS and your role (Admin/Editor) apply exactly as in the panel. It never uses the service-role key.

   **One-time Supabase setting:** under Authentication → URL Configuration → Redirect URLs, add `http://localhost:8976/callback`. Without it, Supabase sends you back to the panel's Site URL instead of the login script. To use a different port, set `ACCESS_LOGIN_PORT` and add that URL instead.

   Accounts that have a password can instead set `ACCESS_EMAIL` / `ACCESS_PASSWORD`.

4. Register it in your client. Claude Code:

   ```sh
   claude mcp add access-sentinel -- node /absolute/path/to/access-admin/mcp/server.js
   ```

   Claude Desktop / Cursor (`mcpServers` in the client's JSON config):

   ```json
   {
     "mcpServers": {
       "access-sentinel": {
         "command": "node",
         "args": ["/absolute/path/to/access-admin/mcp/server.js"]
       }
     }
   }
   ```

   Use `ACCESS_ENV_FILE=/path/to/.env` if the `.env` isn't at the repo root.

## Tools

| Tool | What it does | Writes? |
|---|---|---|
| `whoami` | Which panel account is connected | no |
| `list_opportunities` | Filter catalog by status / title | no |
| `get_opportunity` | All fields of one opportunity | no |
| `check_duplicate` | Sentinel's duplicate + newer-edition rule against the catalog | no |
| `research_url` | Fetch sources for any URL + run deterministic checks | no |
| `start_review` → `submit_research_brief` → `submit_catalog_review` | Full catalog review in 3 steps; each step returns the exact Sentinel prompt for the next | proposal only |
| `list_refresh_candidates` | Whole catalog grouped by deadline situation, most likely to land in the newsletter window first (`month_in_window`, `past_cycle_due`, `empty`…). No network, no model | no |
| `list_discovery_leads` | The Sentinel lead queue (`sentinel_posts` with status `queued`: Instagram, web): short caption, score, date, first link | no |
| `dismiss_lead` | Drop a lead without researching it (same as "descartar" on the Sentinel screen) | lead status only |
| `scrape_instagram` | The Sentinel's Instagram scrape (Apify, active accounts, last 15 days); only queues leads. **Spends Apify credit** | queue only |
| `start_discovery` → `submit_discovery_brief` → `submit_discovery_entry` | Add a **new** opportunity from a queue lead or a URL you found, in 3 steps (`abandon_discovery` to give up) | creates a `Revisar` row |
| `list_newsletter_candidates` | Opportunities that can go in an issue now (same rules as the Newsletter screen), soonest deadline first, flagged if already in an open draft | no |
| `list_newsletters` / `get_newsletter` | Issues and their entries | no |
| `create_newsletter_draft` / `update_newsletter_draft` | Create or edit a **draft** issue | draft only |
| `preview_newsletter` | The beehiiv HTML, exactly as the Newsletter screen builds it | no |

### Newsletter drafts

- **Same selection rules as the screen.** An opportunity must be `Aprovada`, not unqualified, have a deadline between today and the end of next month, and not have gone out in a published issue in the last 365 days. These rules live in `src/lib/newsletterRecords.js`, which the screen and the server both use. If any requested opportunity breaks a rule, nothing is saved and the error lists every problem.
- **Catalog facts are never rewritten.** Each entry's title, deadline, fees and link come from the catalog. The agent can write the entry's `summary` and `eligibility`, plus the issue's title, subject, preheader, intro and outro.
- **Drafts only.** `update_newsletter_draft` refuses issues that are `ready` or `published`. Marking an issue ready or sent stays a human action on the Newsletter screen.

Prompts: `review_opportunity` runs the whole review for an opportunity id; `prepare_newsletter` runs the newsletter prep workflow below. In Claude Code, the project skill `.claude/skills/newsletter-prep` does the same with web search and a report page — just ask for a newsletter post.

### New opportunities (discovery)

Same pipeline as the Sentinel's Instagram/manual discovery (`processPost` → research brief → catalog mapping → `findOrCreateOpportunity`), with the client's answers injected, exactly like the review flow:

1. **`start_discovery(lead_id | url, official_url?)`** claims the lead (`queued` → `pending`, the same conditional update the panel uses) or registers the URL as a manual lead, fetches the official page + adjacent pages, and returns the research-brief prompt. `official_url` overrides the link to research (e.g. an Instagram post with "link in bio").
2. **`submit_discovery_brief`** validates quotes and re-derives qualification. Unqualified → the lead is marked rejected and nothing enters the catalog.
3. **`submit_discovery_entry`** validates every field like the Sentinel does and creates the opportunity with status **`Revisar`** (a human approves it in the Catálogo).

**Duplicates never change the catalog from here.** In the panel, a "newer edition" duplicate overwrites the existing row and sends it back to `Revisar`; on the MCP path (`overwriteDuplicates: false`) the tool returns the existing id and tells the agent to run `start_review`, so the update becomes a field-by-field proposal instead.

Leads left `pending` for more than 10 minutes go back to the queue (`api/lib/staleRecovery.js`); each discovery step refreshes the lead so a slow session doesn't lose it.

### How the review works

1. **`start_review(opportunity_id)`** fetches the official page and relevant adjacent pages and returns them with the research-brief instructions.
2. **`submit_research_brief(review_id, brief)`** drops every fact whose quote isn't literally in a source, re-derives the qualification verdict with the deterministic rules, and tells the model what was dropped and why. It then returns the catalog-mapping instructions.
3. **`submit_catalog_review(review_id, updates, evidence)`**: if some fields are still problematic (thin description, missing level, bad keywords…), it first asks for a final check on just those fields, the same coverage audit the Sentinel does. Then it runs the unchanged Sentinel validation (`researchExistingOpportunity` with the client's answers injected) and saves the proposal. It returns the accepted changes and the validation notes, e.g. `deadline descartado: a citação não foi encontrada literalmente na fonte`.

Review sessions are in memory and last 1 hour.

## Not exposed (yet)

- **Enrichment** (needs `SERPER_API_KEY` / `YOUTUBE_API_KEY`). It could follow the same pattern: the server searches, the client's model judges. (`scrape_instagram` needs `APIFY_API_KEY` in the `.env`.)
- **Applying/rejecting proposals.** Left to the panel on purpose, so a human stays in the loop.

## Running the existing pipeline on another provider (without MCP)

Separately from MCP, `api/sentinel.js` and `api/lib/listingExtractor.js` now accept any OpenAI-compatible provider:

```
SENTINEL_BASE_URL=http://localhost:11434/v1   # e.g. Ollama
SENTINEL_API_KEY=ollama
SENTINEL_MODELS=qwen3:14b
```

Without `SENTINEL_BASE_URL`, they use NVIDIA as before.

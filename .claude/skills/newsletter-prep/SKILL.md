---
name: newsletter-prep
description: Prepare the material for an Access+ newsletter issue — refresh stale catalog opportunities, research new ones (own web search + the Instagram lead queue), push everything through the Sentinel MCP so it lands as human-approvable proposals / "Revisar" rows, and publish a review report. Use when the user asks to "make a newsletter post", "prep the newsletter", "find opportunities for the newsletter", or similar.
---

# Newsletter prep (Access+)

Goal: the user reviews/approves, then builds the newsletter themselves. You do NOT create the newsletter draft unless they ask. Your output is a **shareable report page** listing every change you put in front of them and where to approve it.

Everything goes through the `access-sentinel` MCP tools. Nothing you do publishes: catalog changes become **proposals** (Sentinel screen → "Revisar catálogo"), new opportunities become rows with status **Revisar** (Catálogo). Human control is a product principle — never work around it.

## The newsletter rules (why things qualify)

An opportunity can go in an issue only if: status `Aprovada`, not `unqualified`, deadline between **today and the end of next month** (`window_end`), and not in a published issue in the last 365 days. Rolling deadlines and month-only deadlines ("Junho") never qualify — they need a full date. So the job is: get more approved opportunities with a confirmed date inside the window.

## Workflow

### 0. Baseline (cheap)
- `whoami` (confirm the session works; if it fails, tell the user to run `npm run mcp:login`).
- `list_newsletter_candidates` → what is already eligible.
- `list_refresh_candidates` (status `Aprovada`) → counts per bucket + `window_end`.
- `list_refresh_candidates` with `status: "Revisar"` → the human approval queue. Items in it with an in-window deadline are the fastest wins; list them first in the report.

### 1. Refresh the catalog (existing opportunities)
Pick from buckets in this order: `month_in_window`, `past_cycle_due`, `empty`, then `month_soon`. Each `start_review` dumps full sources into context, so **triage first**:
- Glance at the title/link; skip obvious dead programs. (`research_url` is not cheaper than a review — it returns the same sources.)
- Cap: ~6–8 reviews per session unless the user asks for more (each review still returns ~20–60 KB of sources in step 1).
- The panel keeps only the 15 newest runs and deleting a run deletes its pending proposals; until the pruning fix in `api/sentinel.js` is deployed, tell the user to approve the session's run soon.
- Watch the deadline field in every proposal: the validator can drop a correct deadline (e.g. "open through Dec 11") or recover a wrong yearless one. Flag those in the report as "reject + set manually".

For each pick: `start_review` → `submit_research_brief` → `submit_catalog_review` (do the coverage check if asked). Follow the returned instructions literally. Quotes must be copied **verbatim** from the returned sources, with the exact URL. Record: proposal status, changed fields (before → after), validation notes.

### 2. Find new opportunities
Two lead sources, same pipeline:

**a) Instagram queue** — `list_discovery_leads` (newest/highest score first). Read the captions and decide:
- Clearly not for the catalog (not an opportunity, university/postgrad only, restricted to another country, paid with no aid) → `dismiss_lead` with a reason.
- Out of this issue's window but otherwise good → **leave it queued** (still catalog material) or research it if time allows. Never dismiss for the window.
- Promising → `check_duplicate` (if you can tell the program name/link) → `start_discovery(lead_id, official_url?)`. Use `official_url` when the caption only has "link in bio" or an aggregator link: find the official page with your own web search first.
- `scrape_instagram` only if the queue is nearly empty — it **spends Apify credit**; say so.

**b) Your own web search** — this is where you add the most value. Look for programs open to Brazilian high-school (or gap-year) students with application deadlines inside the window:
- Search in English and Portuguese; vary by type (olimpíadas, competições de redação/escrita, programas de verão, bolsas, mentorias, intercâmbio, MUNs, estágios) and by "deadline December/January".
- Aggregators (opportunitydesk, opportunitiesforyouth, etc.) are only for finding names — always go to the **official** page before `start_discovery(url)`.
- Prefer free / scholarship-backed programs (the catalog only lists Gratuito, Bolsa, Totalmente Financiado).
- Always `check_duplicate(link, title)` first. If it's a duplicate, run `start_review` on the existing id instead (if its deadline is stale).

For each discovery: `start_discovery` → `submit_discovery_brief` → `submit_discovery_entry`. If the sources are the wrong program, `abandon_discovery`. Outcomes: `created` (now in Revisar), `duplicate` (catalog untouched → maybe `start_review`), `rejected` (not for Brazilian youth).

### 3. Report (shareable page)
Publish one artifact page (load the artifact design guidance first). Sections:
1. **Summary** — eligible now vs. eligible if everything is approved; `window_end`.
2. **Approve first: Revisar queue items with in-window deadlines.**
3. **New opportunities** (created in Revisar): title, deadline, type, cost, official link, why it qualifies, validation notes. Where to approve: Catálogo → filter "Revisar".
4. **Catalog updates** (proposals): opportunity, field-by-field before → after, source link, validation notes. Where to approve: Sentinel → "Revisar catálogo" → the run.
5. **Rejected / duplicates / dismissed leads** — one line each with the reason, so nothing is silently lost.
6. **Not done** — leads left in the queue, buckets not reviewed, failures.

Write the report in Portuguese (the team's language) unless the user asks otherwise. In the chat, give a short summary + the link.

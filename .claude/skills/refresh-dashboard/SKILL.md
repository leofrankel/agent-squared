---
name: refresh-dashboard
description: Refresh the agent-squared AI-news dashboard. Searches the web for recent, legit developments in AI agents and the broader AI field, vets and de-duplicates them against the existing data, appends them to data/news.json, then rigorously verifies and commits/pushes the result. Touches only the curated news data — never the user's Library or personal data. Runs on demand or unattended on a schedule. Use when the user asks to refresh, update, or repopulate the dashboard / AI news.
---

# refresh-dashboard

Curate recent AI developments and update the agent-squared dashboard. The audience is one knowledgeable, experienced AI engineer who wants the next new thing — favor signal over volume.

You touch **only the curated news data** (`data/news.json`). The user's personal Library, the app code, and config are never modified by this skill.

## Files you own

- `data/news.json` — **the single source of truth.** Structured items + category registry. De-dupe against this, and edit only this. The deployed dashboard fetches it directly at runtime (`assets/app.js` → `fetch("data/news.json")`), so it is production data — not just a working file.
- `index.html`, `assets/styles.css`, `assets/app.js` — the UI. You normally do **not** touch these during a refresh; only edit if the user asks for UI changes or the schema changes.
- `assets/store.js`, `assets/cloud.js`, `assets/library.js` — the user's personal **Library** feature (saved dashboard items + custom links). Local-first with a split per-identity cache: a guest (signed-out) cache and a signed-in cache that's cleared on sign-out; on first sign-in a guest's items are adopted into the account. When signed in, Supabase is the source of truth and every write mirrors to it. Personal data lives client-side / in the user's account, never in the repo. **Off-limits to this skill** — never read, edit, or stage these during a news refresh.

`data/news.json` is the only news file — there are no generated mirrors to keep in sync. The dashboard loads it with `fetch()`, so it must be served over HTTP: the deploy is on Vercel, and locally you use the preview server (not `file://`).

## Item schema (in `data/news.json` → `items[]`)

```json
{
  "id": "stable-kebab-slug",          // REQUIRED, unique, NEVER changes once assigned
  "title": "Exact title of the thing",
  "description": "1–2 factual sentences. No hype, no summary of the linked content beyond what it is.",
  "url": "https://…",                 // the source link; must resolve
  "source": "Anthropic | OpenAI | Google DeepMind | GitHub | arXiv | Hacker News | <site/author>",
  "category": "model-release | agent-framework | tooling | research | lab-update | community",
  "research_subcategory": "research-agents | research-benchmarks | research-safety | research-science | research-multimodal | research-efficiency | research-training | research-interpretability",
                                       // REQUIRED for category:"research" items. See research_subcategories registry below.
  "significance": "high | normal",     // "high" pins it to the Highlights band
  "published": "YYYY-MM-DD",            // original publish date; omit only if genuinely unknown
  "date_added": "YYYY-MM-DD",           // the date you add it to the dashboard (today). PRIMARY sort key.
  "topics": ["short", "keywords"]       // optional; powers search
}
```

`meta.count` = number of items. `meta.generated` = current UTC timestamp.

The dashboard sorts by `date_added` desc, then `published` desc. Within a category the newest-added items appear first. `significance: "high"` items are pulled into the Highlights band at the top.

### The `id` is sacred

When a user adds a dashboard item to their **Library** (or marks it read / tags it), that personal record references the item by this `id` (stored as a `news_id` column on the Library record). For signed-in users that record is **synced to Supabase** (the `library` table) across all their devices, and resolving its saved/read/tag state back to a dashboard item relies on `news_id` still matching. So **never change or reuse an existing `id`** — doing so orphans that item's saved/read/tag state both locally and in the user's cloud account. Treat every existing id as immutable; only ever *add* new items. Derive new ids from a stable slug of the title or URL (lowercase, hyphenated), e.g. `claude-opus-4-8`, `groupmembench-arxiv-2605-14498`.

## Categories

Current registry (in `news.json` → `categories`):

- `model-release` — new models / model versions
- `agent-framework` — agent libraries, SDKs, orchestration frameworks
- `tooling` — dev tools, infra, protocols (MCP, etc.), IDEs
- `research` — papers, benchmarks, technical write-ups
- `lab-update` — notable moves from big labs/companies (incl. funding, partnerships)
- `community` — discussion, newsletters, notable blog posts, conference recaps

You may **add categories or relabel existing ones** as the landscape shifts (e.g. add `robotics`, `evals`, `safety`). If you do: update the `categories` array in `news.json` and re-categorize affected items. Changing a category's `label` is safe — but **keep category `id`s stable**. The Library snapshots each saved item's category `id` and resolves its label from this registry, so renaming an `id` degrades the label on items users have already saved (locally and in the cloud), the same way changing an item id would. Don't remove a category that still has items without re-homing them. The UI reads the registry dynamically — no code change needed.

## Research subcategories

All `category:"research"` items **must** have a `research_subcategory` field. The UI uses this for subgroup display within the Research section and for a dedicated "Research Topic" filter row.

Current registry (in `news.json` → `research_subcategories`):

- `research-agents` — agent architectures, multi-agent systems, tool use, planning, memory
- `research-benchmarks` — evaluation methodology, benchmark suites, reproducibility
- `research-safety` — AI safety, alignment, reward hacking, privacy, trust, fairness
- `research-science` — AI applied to science (biology, physics, chemistry, mathematics)
- `research-multimodal` — multimodal models, video/image generation, world models
- `research-efficiency` — quantization, efficient inference, on-device AI, pruning, sparsity
- `research-training` — reinforcement learning, post-training, fine-tuning, learning methods
- `research-interpretability` — mechanistic interpretability, circuits, activation analysis

You may add subcategories as new research themes emerge. Keep subcategory `id`s stable for the same reason as category ids. If you add one, add it to the `research_subcategories` array in `news.json`. When a paper doesn't cleanly fit an existing subcat, prefer the closest match over creating a new one for a single item.

## Process

### 1. Load existing state
Read `data/news.json`. Note every existing `id`, `url`, and `title` — this is your de-dupe set. Note the most recent `date_added` / `published` so you know how far back to look.

### 2. Find candidates

**Primary focus: agentic AI.** The audience is building a research radar specifically for agentic AI — autonomous agents, multi-agent systems, tool use, agent planning, agent memory, agent evaluation, agent safety, and the frameworks that underpin them. Prioritize this topic over general AI/ML news; only include model releases, tooling, or lab updates when they have direct agent relevance.

Search for developments since the last refresh. For nightly runs this is 1–2 days; otherwise look back 2–4 weeks.

**Research papers (highest priority):** Aim for the majority of new items each refresh to be papers.
- Browse arXiv listing pages directly: `arxiv.org/list/cs.AI/current`, `arxiv.org/list/cs.MA/current`, `arxiv.org/list/cs.CL/current`. Skim titles for agent-relevant keywords: agent, multi-agent, tool use, planning, memory, benchmark, evaluation, autonomous, harness, orchestration, tool synthesis.
- Search arXiv by topic: e.g. `"agentic" OR "agent" site:arxiv.org`, `multi-agent LLM coordination`, `LLM tool use benchmark`, `agent memory architecture`.
- Papers with Code and Semantic Scholar for cross-referencing.

**Agent frameworks and tooling:** GitHub releases from active agent projects (NousResearch/hermes-agent, openai/openai-agents-python, microsoft/agent-framework, HKUDS/OpenHarness, and similar); trending repos in the agent space; notable new repos from smaller or academic teams.

**Less official sources — actively seek these out:**
- **Hacker News:** "Show HN" and "Ask HN" posts about agent tools, architectures, or experiments; discussion threads with genuine technical signal on agentic topics.
- **Practitioner Substacks and independent blogs:** The Nuanced Perspective, The AI Agent Architect, Simon Willison, and similar. A well-argued post grounded in concrete evidence or a real system is a valid item.
- **Researcher personal blogs and posts:** Output from academic labs (CMU, HKU, Stanford, MIT, AI2, EleutherAI) and independent researchers — especially when linked to a paper or repo.
- **Smaller lab announcements:** Nous Research, EleutherAI, AI2, Cohere, and similar — not just the big-five labs.

**Official lab sources** (Anthropic, OpenAI, Google DeepMind, Microsoft, Meta AI) are still valid but deprioritized — prefer their research output over product announcements.

### 3. Vet for legitimacy & quality — DISCARD aggressively
- Prefer primary sources. Treat SEO/aggregator/listicle sites ("best X of 2026", auto-generated "news" blogs) as **leads to verify, not citations.** Trace claims back to the primary source and link that instead.
- **Verify every link resolves** to the right content with **WebFetch** (`gh` is **not** installed in this environment). For pages that return a bot 403 (e.g. some openai.com URLs), use **WebSearch with `allowed_domains`** to confirm the canonical published path — a bot 403 doesn't mean the link is dead in a browser, but confirm the URL is a real published path before trusting it. Links that require an institutional or university login to read are acceptable — include them and verify only that the URL is a real published path, not that you can read the full content.
- **Verify the date** and only include items dated **on or before today.** Do not include things dated in the future (a post can describe a future release; use the post's publish date, not the title's date).
- Drop anything you can't confirm: vague rumors, unverifiable leaks, fabricated-looking metrics, content farms.
- **Never invent** titles, URLs, dates, or descriptions. If you only know the month, omit `published` rather than guessing a day.

### 4. De-duplicate
Skip any candidate whose URL (ignoring protocol/query/trailing slash) or substantive title already exists in `news.json`. If a new post is a meaningful update to an existing item, prefer adding a new item only if it's genuinely new news; otherwise leave the existing one.

### 5. Write the items
For each surviving candidate, build an item per the schema. Set `date_added` to today (the machine's current date). Set `significance: "high"` only for the few most pertinent/significant items this round — be stingy; highlights lose meaning if everything is high.

### 6. Update `news.json`
Add the new items to `items[]` (order within the array doesn't matter — the UI sorts). Update `meta.count` and `meta.generated` (UTC ISO timestamp).

### 7. Verify
- `python3 -c "import json; d=json.load(open('data/news.json')); print('items', len(d['items']), '| meta.count', d['meta']['count'])"` — confirms `news.json` is valid JSON and prints the counts; `meta.count` must equal the item count.
- Optionally start the preview (`.claude/launch.json` → `dashboard`, port 4178) and confirm the new items render and links open. The dashboard fetches `data/news.json` at runtime, so it must be served over HTTP — don't open `index.html` from `file://`. **Note:** the browser may serve a *cached* old copy — hard-reload / cache-bust (or re-fetch with `cache: "reload"`) so you're verifying the fresh data, not a stale copy.

### 8. Verify rigorously, then commit and push
Pushing publishes straight to production (Vercel auto-deploys on push to `main`), and this skill may run **unattended on a schedule** — so there is no human to ask. Run a hard pre-flight and **push only if every check passes**. If any check fails, do **not** push: fix it, or abort and report the problem. Never push questionable data.

**Pre-flight checks (all must pass):**
- **Valid JSON** — `news.json` parses (step 7).
- **Count matches** — `meta.count` equals `items.length` (step 7).
- **Schema complete** — every item has `id`, `title`, `url`, `source`, `category`; `category` is in the registry; `significance` ∈ {`high`, `normal`}; `published`/`date_added` are `YYYY-MM-DD`; no `published` date is in the future. Every `category:"research"` item has a `research_subcategory` that is in the `research_subcategories` registry.
- **No duplicates** — no repeated `id`; no repeated `url` (ignoring protocol/query/trailing slash).
- **ID stability (critical)** — every pre-existing item `id` and category `id` recorded in step 1 still exists, unchanged. This run only *added* items; it never modified or removed an existing id (which would orphan users' synced Library state).
- **Links resolve** — each *new* item's `url` was fetched/confirmed in step 3.
- **Diff scope** — `git status` shows only `data/news.json` changed; no app/UI/Library/config files.

**If all checks pass:**
- `git add data/news.json` — **never** `git add -A`.
- Commit: `Refresh dashboard: add N items (YYYY-MM-DD)` + a short bullet list of what was added + the standard Co-Authored-By trailer.
- `git push origin main`. **Never force-push.**

**Dry-run / manual mode:** if invoked with a `--no-push` argument (or the user explicitly asks for a manual/preview run), do everything *except* the push — report the diff and the pre-flight results so the user can review and push themselves.

## Guardrails
- Lean toward more items rather than fewer — the goal is building a research radar, so breadth matters. Still skip genuine filler: SEO listicles, non-agentic AI news, vague rumors.
- Keep descriptions factual and link-first — the user reads the source themselves.
- Don't churn ids or rewrite existing items unnecessarily.
- Keep `meta.count` in sync with the item count, every time.

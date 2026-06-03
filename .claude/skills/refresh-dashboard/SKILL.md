---
name: refresh-dashboard
description: Refresh the agent-squared AI-news dashboard. Searches the web for recent, legit developments in AI agents and the broader AI field, vets and de-duplicates them against the existing data, appends them to data/news.json, regenerates the data/news.js and data/news.md mirrors, then rigorously verifies and commits/pushes the result. Touches only the curated news data — never the user's Library or personal data. Runs on demand or unattended on a schedule. Use when the user asks to refresh, update, or repopulate the dashboard / AI news.
---

# refresh-dashboard

Curate recent AI developments and update the agent-squared dashboard. The audience is one knowledgeable, experienced AI engineer who wants the next new thing — favor signal over volume.

You touch **only the curated news data** (`data/news.json` and its two mirrors). The user's personal Library, the app code, and config are never modified by this skill.

## Files you own

- `data/news.json` — **canonical source of truth.** Structured items + category registry. De-dupe against this. Always edit this first.
- `data/news.js` — generated mirror: `window.__NEWS__ = <same object as news.json>`. Lets the dashboard open from `file://` with no server. **Regenerate from news.json every time.**
- `data/news.md` — generated human-readable mirror for browsing in git. **Regenerate from news.json every time.**
- `index.html`, `assets/styles.css`, `assets/app.js` — the UI. You normally do **not** touch these during a refresh; only edit if the user asks for UI changes or the schema changes.
- `assets/store.js`, `assets/cloud.js`, `assets/library.js` — the user's personal **Library** feature (saved dashboard items + custom links; local-first with optional Supabase sync). Personal data lives client-side / in the user's account, never in the repo. **Off-limits to this skill** — never read, edit, or stage these during a news refresh.

These three **news** files (`news.json` / `news.js` / `news.md`) must always stay in sync. `news.js` and `news.md` are derived 100% from `news.json`. **`news.js` is what the deployed site actually serves** (it's loaded via a `<script>` tag as `window.__NEWS__`; `news.json` is only a fallback), so regenerating it is production-critical, not just a `file://` nicety.

## Item schema (in `data/news.json` → `items[]`)

```json
{
  "id": "stable-kebab-slug",          // REQUIRED, unique, NEVER changes once assigned
  "title": "Exact title of the thing",
  "description": "1–2 factual sentences. No hype, no summary of the linked content beyond what it is.",
  "url": "https://…",                 // the source link; must resolve
  "source": "Anthropic | OpenAI | Google DeepMind | GitHub | arXiv | Hacker News | <site/author>",
  "category": "model-release | agent-framework | tooling | research | lab-update | community",
  "significance": "high | normal",     // "high" pins it to the Highlights band
  "published": "YYYY-MM-DD",            // original publish date; omit only if genuinely unknown
  "date_added": "YYYY-MM-DD",           // the date you add it to the dashboard (today). PRIMARY sort key.
  "topics": ["short", "keywords"]       // optional; powers search
}
```

`meta.count` = number of items. `meta.generated` = current UTC timestamp.

The dashboard sorts by `date_added` desc, then `published` desc. Within a category the newest-added items appear first. `significance: "high"` items are pulled into the Highlights band at the top.

### The `id` is sacred

When a user adds a dashboard item to their **Library** (or marks it read / tags it), that personal record references the item by this `id` (stored as `news_id`). For signed-in users it is **synced to Supabase**, keyed by `news_id`, across all their devices. So **never change or reuse an existing `id`** — doing so orphans that item's saved/read/tag state both locally and in the user's cloud account. Treat every existing id as immutable; only ever *add* new items. Derive new ids from a stable slug of the title or URL (lowercase, hyphenated), e.g. `claude-opus-4-8`, `groupmembench-arxiv-2605-14498`.

## Categories

Current registry (in `news.json` → `categories`):

- `model-release` — new models / model versions
- `agent-framework` — agent libraries, SDKs, orchestration frameworks
- `tooling` — dev tools, infra, protocols (MCP, etc.), IDEs
- `research` — papers, benchmarks, technical write-ups
- `lab-update` — notable moves from big labs/companies (incl. funding, partnerships)
- `community` — discussion, newsletters, notable blog posts, conference recaps

You may **add categories or relabel existing ones** as the landscape shifts (e.g. add `robotics`, `evals`, `safety`). If you do: update the `categories` array in `news.json` and re-categorize affected items. Changing a category's `label` is safe — but **keep category `id`s stable**. The Library snapshots each saved item's category `id` and resolves its label from this registry, so renaming an `id` degrades the label on items users have already saved (locally and in the cloud), the same way changing an item id would. Don't remove a category that still has items without re-homing them. The UI reads the registry dynamically — no code change needed.

## Process

### 1. Load existing state
Read `data/news.json`. Note every existing `id`, `url`, and `title` — this is your de-dupe set. Note the most recent `date_added` / `published` so you know how far back to look.

### 2. Find candidates
Search the web for developments since the last refresh (or the last ~2–4 weeks if unsure). Cast a wide net across where developers actually post:

- **Primary sources (preferred):** official blogs — anthropic.com/news, openai.com, blog.google / deepmind.google, microsoft devblogs, nvidia, meta AI; official docs/changelogs; the MCP blog (blog.modelcontextprotocol.io).
- **Code:** GitHub releases/trending, notable new repos.
- **Research:** arXiv (cs.AI, cs.CL, cs.LG), papers with code.
- **Discussion:** Hacker News, reputable newsletters (e.g. Air Street's State of AI), well-known practitioner blogs (e.g. Simon Willison), high-signal social posts.

Small/niche is fine and often desirable. Aim for breadth across categories, not just big-lab headlines.

### 3. Vet for legitimacy & quality — DISCARD aggressively
- Prefer primary sources. Treat SEO/aggregator/listicle sites ("best X of 2026", auto-generated "news" blogs) as **leads to verify, not citations.** Trace claims back to the primary source and link that instead.
- **Verify every link resolves** to the right content with **WebFetch** (`gh` is **not** installed in this environment). For pages that return a bot 403 (e.g. some openai.com URLs), use **WebSearch with `allowed_domains`** to confirm the canonical published path — a bot 403 doesn't mean the link is dead in a browser, but confirm the URL is a real published path before trusting it.
- **Verify the date** and only include items dated **on or before today.** Do not include things dated in the future (a post can describe a future release; use the post's publish date, not the title's date).
- Drop anything you can't confirm: vague rumors, unverifiable leaks, fabricated-looking metrics, content farms.
- **Never invent** titles, URLs, dates, or descriptions. If you only know the month, omit `published` rather than guessing a day.

### 4. De-duplicate
Skip any candidate whose URL (ignoring protocol/query/trailing slash) or substantive title already exists in `news.json`. If a new post is a meaningful update to an existing item, prefer adding a new item only if it's genuinely new news; otherwise leave the existing one.

### 5. Write the items
For each surviving candidate, build an item per the schema. Set `date_added` to today (the machine's current date). Set `significance: "high"` only for the few most pertinent/significant items this round — be stingy; highlights lose meaning if everything is high.

### 6. Update `news.json`
Add the new items to `items[]` (order within the array doesn't matter — the UI sorts). Update `meta.count` and `meta.generated` (UTC ISO timestamp).

### 7. Regenerate the mirrors
- `data/news.js`: write the generated-file header comment, then `window.__NEWS__ = <exact JSON object>;`. It must deep-equal `news.json`.
- `data/news.md`: write the generated-file header comment, a title, a `_Last updated: YYYY-MM-DD · N items_` line, a `## ★ Highlights` section (the high-significance items), then one `##` section per category with items newest-first. Each item: `- **[Title](url)** — Source · YYYY-MM-DD` then an indented description line.

### 8. Verify
- `python3 -c "import json; json.load(open('data/news.json'))"` to confirm valid JSON.
- Confirm the mirror matches, e.g.:
  `node -e "global.window={}; require('./data/news.js'); const j=require('./data/news.json'); console.log('js', window.__NEWS__.items.length, 'json', j.items.length, 'meta', j.meta.count)"` — all three numbers must be equal.
- Optionally start the preview (`.claude/launch.json` → `dashboard`, port 4178) and confirm the new items render and links open. **Note:** the browser may serve a *cached* old copy of a changed file — hard-reload / cache-bust (or re-fetch with `cache: "reload"`) so you're verifying the fresh build, not stale code.

### 9. Verify rigorously, then commit and push
Pushing publishes straight to production (Vercel auto-deploys on push to `main`), and this skill may run **unattended on a schedule** — so there is no human to ask. Run a hard pre-flight and **push only if every check passes**. If any check fails, do **not** push: fix it, or abort and report the problem. Never push questionable data.

**Pre-flight checks (all must pass):**
- **Valid JSON** — `news.json` parses (step 8).
- **Mirrors in sync** — `news.js` item count, `news.md` item count, and `meta.count` all equal `items.length` (step 8).
- **Schema complete** — every item has `id`, `title`, `url`, `source`, `category`; `category` is in the registry; `significance` ∈ {`high`, `normal`}; `published`/`date_added` are `YYYY-MM-DD`; no `published` date is in the future.
- **No duplicates** — no repeated `id`; no repeated `url` (ignoring protocol/query/trailing slash).
- **ID stability (critical)** — every pre-existing item `id` and category `id` recorded in step 1 still exists, unchanged. This run only *added* items; it never modified or removed an existing id (which would orphan users' synced Library state).
- **Links resolve** — each *new* item's `url` was fetched/confirmed in step 3.
- **Diff scope** — `git status` shows only `data/news.json`, `data/news.js`, `data/news.md` changed; no app/UI/Library/config files.

**If all checks pass:**
- `git add data/news.json data/news.js data/news.md` — **never** `git add -A`.
- Commit: `Refresh dashboard: add N items (YYYY-MM-DD)` + a short bullet list of what was added + the standard Co-Authored-By trailer.
- `git push origin main`. **Never force-push.**

**Dry-run / manual mode:** if invoked with a `--no-push` argument (or the user explicitly asks for a manual/preview run), do everything *except* the push — report the diff and the pre-flight results so the user can review and push themselves.

## Guardrails
- Quality over quantity. A handful of high-signal, verified items beats a long list of filler.
- Keep descriptions factual and link-first — the user reads the source themselves.
- Don't churn ids or rewrite existing items unnecessarily.
- Keep the three data files in sync, every time.

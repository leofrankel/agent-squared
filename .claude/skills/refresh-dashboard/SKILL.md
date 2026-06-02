---
name: refresh-dashboard
description: Refresh the agent-squared AI-news dashboard. Searches the web for recent, legit developments in AI agents and the broader AI field, vets and de-duplicates them against the existing data, appends them to data/news.json, regenerates the data/news.js and data/news.md mirrors, and commits the result (asking before pushing). Use when the user asks to refresh, update, or repopulate the dashboard / AI news.
---

# refresh-dashboard

Curate recent AI developments and update the agent-squared dashboard. The audience is one knowledgeable, experienced AI engineer who wants the next new thing — favor signal over volume.

## Files you own

- `data/news.json` — **canonical source of truth.** Structured items + category registry. De-dupe against this. Always edit this first.
- `data/news.js` — generated mirror: `window.__NEWS__ = <same object as news.json>`. Lets the dashboard open from `file://` with no server. **Regenerate from news.json every time.**
- `data/news.md` — generated human-readable mirror for browsing in git. **Regenerate from news.json every time.**
- `index.html`, `assets/styles.css`, `assets/app.js` — the UI. You normally do **not** touch these during a refresh; only edit if the user asks for UI changes or the schema changes.
- `assets/store.js`, `assets/cloud.js`, `assets/library.js` — the user's personal **Library** feature (saved dashboard items + custom links; local-first with optional Supabase sync). Personal data lives client-side / in the user's account, never in the repo. **Off-limits to this skill** — never read, edit, or stage these during a news refresh.

These three data files must always stay in sync. `news.js` and `news.md` are derived 100% from `news.json`.

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

Personal tags (read / saved / custom) are stored in the browser keyed by `id`. **Never change or reuse an existing id**, or the user loses their tags on that item. Derive new ids from a stable slug of the title or URL (lowercase, hyphenated), e.g. `claude-opus-4-8`, `groupmembench-arxiv-2605-14498`.

## Categories

Current registry (in `news.json` → `categories`):

- `model-release` — new models / model versions
- `agent-framework` — agent libraries, SDKs, orchestration frameworks
- `tooling` — dev tools, infra, protocols (MCP, etc.), IDEs
- `research` — papers, benchmarks, technical write-ups
- `lab-update` — notable moves from big labs/companies (incl. funding, partnerships)
- `community` — discussion, newsletters, notable blog posts, conference recaps

You may **add or rename categories** as the landscape shifts (e.g. add `robotics`, `evals`, `safety`). If you do: update the `categories` array in `news.json`, re-categorize affected items, and keep ids stable. Don't remove a category that still has items without re-homing them. The UI reads the registry dynamically — no code change needed.

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
- **Verify every link resolves** to the right content (WebFetch it, or for GitHub use `gh`). A bot 403 (e.g. some openai.com pages) doesn't mean the link is dead for a browser, but confirm the URL is a real published path before trusting it.
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
- Optionally start the preview (`.claude/launch.json` → `dashboard`, port 4178) and confirm the new items render and links open.

### 9. Commit, then ASK before pushing
- Stage only the data files you changed: `git add data/news.json data/news.js data/news.md` (plus UI files only if you intentionally changed them). Do **not** `git add -A`.
- Commit with a message like: `Refresh dashboard: add N items (YYYY-MM-DD)` and a short bullet list of what was added. Append the standard Co-Authored-By trailer.
- Show the user the diff / `git log -1` and **ask before `git push`.** Only push after they confirm. Never force-push.

## Guardrails
- Quality over quantity. A handful of high-signal, verified items beats a long list of filler.
- Keep descriptions factual and link-first — the user reads the source themselves.
- Don't churn ids or rewrite existing items unnecessarily.
- Keep the three data files in sync, every time.

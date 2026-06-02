// SEED / SAMPLE DATA for the "My Links" view.
//
// In the deployed app, "My Links" is each visitor's OWN space: their links live
// in their browser (localStorage), and — once signed in (Phase 2) — sync to their
// account. This file is just the friendly starter content a brand-new visitor sees
// on their very first load, so the feature isn't an empty page. They can delete or
// replace any of it; their changes never touch this file.
//
// Loaded as a plain window assignment so it works with no server (file:// and http).
window.__MYLINKS__ = {
  "meta": { "generated": "2026-06-02T00:00:00Z", "count": 3 },
  "folders": ["Reading list", "Papers", "Tools"],
  "links": [
    {
      "id": "seed-attention-is-all-you-need",
      "url": "https://arxiv.org/abs/1706.03762",
      "title": "Attention Is All You Need",
      "description": "The original Transformer paper — a good example of saving a foundational read.",
      "folder": "Papers",
      "tags": ["transformers", "foundational"],
      "added": "2026-06-02"
    },
    {
      "id": "seed-simonwillison-blog",
      "url": "https://simonwillison.net/",
      "title": "Simon Willison’s blog",
      "description": "High-signal writing on LLMs and practical AI tooling.",
      "folder": "Reading list",
      "tags": ["blog", "llm"],
      "added": "2026-06-02"
    },
    {
      "id": "seed-openai-whisper",
      "url": "https://github.com/openai/whisper",
      "title": "openai/whisper",
      "description": "Open-source speech-to-text model — example of bookmarking a tool/repo.",
      "folder": "Tools",
      "tags": ["speech", "open-source"],
      "added": "2026-06-02"
    }
  ]
};

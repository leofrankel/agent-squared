"use strict";

/* ----------------------------------------------------------------------------
 * agent² — unified personal Library store
 *
 * One per-user collection holding BOTH:
 *   - saved dashboard items (origin "curated", carrying a snapshot + news_id)
 *   - custom links the user adds   (origin "custom")
 * Each item has user tags and a status: "want" (to read) or "read".
 *
 * Local-first: the source of truth is localStorage. When signed in (window.Cloud),
 * Supabase becomes the source of truth and every write mirrors to the cloud.
 * Any change dispatches a "store-changed" event so every view re-renders in sync.
 * -------------------------------------------------------------------------- */
(function () {
  const LS_KEY = "agent2:library:v1";
  let items = load();

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.items)) return p.items.map(normalize);
      }
    } catch (e) {
      console.warn("Could not read library store:", e);
    }
    return [];
  }
  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ items }));
    } catch (e) {
      console.warn("Could not save library store:", e);
    }
  }
  function emit() {
    document.dispatchEvent(new CustomEvent("store-changed"));
  }
  function changed() {
    persist();
    emit();
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "lib-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  }
  function isUuid(s) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
  }
  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function normTags(raw) {
    if (Array.isArray(raw)) raw = raw.join(",");
    return Array.from(
      new Set(
        String(raw || "")
          .split(",")
          .map((t) => t.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase())
          .filter(Boolean)
      )
    );
  }
  function hostOf(url) {
    try {
      return new URL(/^https?:\/\//i.test(url) ? url : "https://" + url).hostname.replace(/^www\./, "");
    } catch (e) {
      return url;
    }
  }
  function normalize(i) {
    return {
      id: i.id || uid(),
      origin: i.origin === "curated" ? "curated" : "custom",
      news_id: i.news_id || null,
      url: i.url || "",
      title: i.title || "",
      description: i.description || "",
      source: i.source || "",
      category: i.category || "",
      folder: i.folder || "",
      tags: Array.isArray(i.tags) ? i.tags : [],
      status: i.status === "read" ? "read" : "want",
      added: i.added || today(),
    };
  }
  function cloudOn() {
    return window.Cloud && window.Cloud.available && window.Cloud.isSignedIn();
  }
  function cloudUpsert(it) {
    if (cloudOn()) window.Cloud.upsert(it);
  }
  function cloudRemove(id) {
    if (cloudOn()) window.Cloud.remove(id);
  }

  const Store = {
    all() {
      return items.slice();
    },
    get(id) {
      return items.find((i) => i.id === id) || null;
    },
    byNewsId(nid) {
      return items.find((i) => i.origin === "curated" && i.news_id === nid) || null;
    },
    isSaved(nid) {
      return !!Store.byNewsId(nid);
    },
    allTags() {
      const s = new Set();
      items.forEach((i) => (i.tags || []).forEach((t) => s.add(t)));
      return Array.from(s).sort((a, b) => a.localeCompare(b));
    },

    /* ----- mutations ----- */

    // Add (or fetch existing) a curated dashboard item, snapshotting its fields.
    addCurated(news, status) {
      let it = Store.byNewsId(news.id);
      if (it) {
        if (status) it.status = status;
      } else {
        it = normalize({
          id: uid(),
          origin: "curated",
          news_id: news.id,
          url: news.url,
          title: news.title,
          description: news.description,
          source: news.source,
          category: news.category,
          status: status || "want",
          added: today(),
        });
        items.push(it);
      }
      changed();
      cloudUpsert(it);
      return it;
    },

    addCustom(data) {
      const it = normalize({
        id: uid(),
        origin: "custom",
        url: data.url,
        title: data.title,
        description: data.description,
        source: hostOf(data.url),
        folder: data.folder,
        tags: normTags(data.tags),
        status: "want",
        added: today(),
      });
      items.push(it);
      changed();
      cloudUpsert(it);
      return it;
    },

    update(id, changes) {
      const it = Store.get(id);
      if (!it) return null;
      if ("tags" in changes) changes.tags = normTags(changes.tags);
      Object.assign(it, changes);
      changed();
      cloudUpsert(it);
      return it;
    },

    setStatus(id, status) {
      return Store.update(id, { status: status === "read" ? "read" : "want" });
    },

    toggleTag(id, tag) {
      const it = Store.get(id);
      if (!it) return;
      const t = normTags(tag)[0];
      if (!t) return;
      if (it.tags.includes(t)) it.tags = it.tags.filter((x) => x !== t);
      else it.tags.push(t);
      changed();
      cloudUpsert(it);
    },

    remove(id) {
      const it = Store.get(id);
      items = items.filter((i) => i.id !== id);
      changed();
      if (it) cloudRemove(id);
    },

    // Bulk merge (used by backup import). Incoming = array of item-like objects.
    importItems(incoming) {
      if (!Array.isArray(incoming)) return { added: 0, updated: 0 };
      const byId = new Map(items.map((i) => [i.id, i]));
      let added = 0,
        updated = 0;
      incoming.forEach((raw) => {
        if (!raw || !raw.url) return;
        const it = normalize(raw);
        if (byId.has(it.id)) {
          Object.assign(byId.get(it.id), it);
          updated++;
        } else {
          items.push(it);
          byId.set(it.id, it);
          added++;
        }
        cloudUpsert(it);
      });
      changed();
      return { added, updated };
    },

    exportObject() {
      return { meta: { generated: new Date().toISOString(), count: items.length }, items: items.slice() };
    },
  };

  /* ----- cloud sync ----- */
  async function syncOnSignIn() {
    try {
      const cloud = (await window.Cloud.fetchAll()).map(normalize);
      const cloudIds = new Set(cloud.map((i) => i.id));
      const cloudNews = new Set(cloud.filter((i) => i.origin === "curated" && i.news_id).map((i) => i.news_id));
      for (const local of items) {
        if (local.origin === "curated" && local.news_id && cloudNews.has(local.news_id)) continue;
        if (cloudIds.has(local.id)) continue;
        if (!isUuid(local.id)) local.id = uid();
        await window.Cloud.upsert(local);
        cloud.push(local);
      }
      items = cloud;
      persist();
      emit();
    } catch (e) {
      console.warn("Library sync on sign-in failed:", e);
    }
  }

  document.addEventListener("cloud-auth", function () {
    if (cloudOn()) syncOnSignIn();
    else emit();
  });

  window.Store = Store;
})();

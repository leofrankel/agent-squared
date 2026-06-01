"use strict";

/* ----------------------------------------------------------------------------
 * agent² — "My Links" view
 * A personal log of articles/links found outside the curated dashboard.
 *
 * Storage model (backendless, cross-device via git):
 *   - data/my-links.js (window.__MYLINKS__) is the committed, git-synced baseline.
 *   - localStorage (MLS_KEY) is the live working store you edit in the browser.
 *   - On a fresh device the baseline seeds localStorage.
 *   - "Export to repo" downloads an updated my-links.js to commit & push.
 *   - "Sync from repo" merges newly-committed links from the baseline into the
 *     local store (baseline wins for matching ids; un-exported local-only links
 *     are kept).
 * This file is intentionally independent of assets/app.js (the curated feed).
 * -------------------------------------------------------------------------- */

const MLS_KEY = "agent2:mylinks:v1";
const VIEW_KEY = "agent2:view";
const UNFILED = "__unfiled__";

let MLS = { links: [], dirty: false, syncedGeneration: null };
const mlFilters = { folder: "all", tag: "all", q: "" };
let editingId = null;

/* ---------- persistence ---------- */
function mlLoad() {
  try {
    const raw = localStorage.getItem(MLS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        links: Array.isArray(p.links) ? p.links : [],
        dirty: !!p.dirty,
        syncedGeneration: p.syncedGeneration || null,
      };
    }
  } catch (e) {
    console.warn("Could not read My Links store:", e);
  }
  return null;
}
function mlSave() {
  try {
    localStorage.setItem(MLS_KEY, JSON.stringify(MLS));
  } catch (e) {
    console.warn("Could not save My Links store:", e);
  }
}
function baseline() {
  const b = window.__MYLINKS__;
  if (b && Array.isArray(b.links)) return b;
  return { meta: {}, folders: [], links: [] };
}

/* ---------- helpers ---------- */
function mlNewId() {
  return "ml-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}
function mlToday() {
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
function isHttp(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return url;
  }
}
function fmtDateML(iso) {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function allFolders() {
  return Array.from(new Set(MLS.links.map((l) => l.folder).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}
function allTags() {
  const s = new Set();
  MLS.links.forEach((l) => (l.tags || []).forEach((t) => s.add(t)));
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}
function sortedLinks() {
  return [...MLS.links].sort((a, b) => {
    const ka = a.added || "", kb = b.added || "";
    if (ka < kb) return 1;
    if (ka > kb) return -1;
    return (a.title || a.url || "").localeCompare(b.title || b.url || "");
  });
}

/* ---------- filtering ---------- */
function mlMatchesSearch(l) {
  if (!mlFilters.q) return true;
  const q = mlFilters.q.toLowerCase();
  return (
    (l.title || "").toLowerCase().includes(q) ||
    (l.description || "").toLowerCase().includes(q) ||
    (l.url || "").toLowerCase().includes(q) ||
    (l.folder || "").toLowerCase().includes(q) ||
    (Array.isArray(l.tags) && l.tags.join(" ").toLowerCase().includes(q))
  );
}
function mlMatchesFolder(l) {
  if (mlFilters.folder === "all") return true;
  if (mlFilters.folder === UNFILED) return !l.folder;
  return l.folder === mlFilters.folder;
}
function mlMatchesTag(l) {
  if (mlFilters.tag === "all") return true;
  return Array.isArray(l.tags) && l.tags.includes(mlFilters.tag);
}
function mlPasses(l) {
  return mlMatchesSearch(l) && mlMatchesFolder(l) && mlMatchesTag(l);
}

/* ---------- filter bars ---------- */
function mlPill(label, active, count, onClick, isTag) {
  const btn = document.createElement("button");
  btn.className = "pill" + (active ? " active" : "") + (isTag ? " tag-pill" : "");
  btn.type = "button";
  const span = document.createElement("span");
  span.textContent = label;
  btn.appendChild(span);
  if (typeof count === "number") {
    const c = document.createElement("span");
    c.className = "count";
    c.textContent = count;
    btn.appendChild(c);
  }
  btn.addEventListener("click", onClick);
  return btn;
}
function renderFolderFilters() {
  const host = document.getElementById("ml-folder-filters");
  host.innerHTML = "";
  const base = sortedLinks().filter((l) => mlMatchesSearch(l) && mlMatchesTag(l));
  host.appendChild(
    mlPill("All", mlFilters.folder === "all", base.length, () => {
      mlFilters.folder = "all";
      renderML();
    })
  );
  allFolders().forEach((f) => {
    const n = base.filter((l) => l.folder === f).length;
    if (n === 0 && mlFilters.folder !== f) return;
    host.appendChild(
      mlPill(f, mlFilters.folder === f, n, () => {
        mlFilters.folder = f;
        renderML();
      })
    );
  });
  const unfiled = base.filter((l) => !l.folder).length;
  if (unfiled > 0 || mlFilters.folder === UNFILED) {
    host.appendChild(
      mlPill("Unfiled", mlFilters.folder === UNFILED, unfiled, () => {
        mlFilters.folder = UNFILED;
        renderML();
      })
    );
  }
}
function renderMLTagFilters() {
  const host = document.getElementById("ml-tag-filters");
  host.innerHTML = "";
  const base = sortedLinks().filter((l) => mlMatchesSearch(l) && mlMatchesFolder(l));
  host.appendChild(
    mlPill("All", mlFilters.tag === "all", base.length, () => {
      mlFilters.tag = "all";
      renderML();
    }, true)
  );
  allTags().forEach((t) => {
    const n = base.filter((l) => (l.tags || []).includes(t)).length;
    if (n === 0 && mlFilters.tag !== t) return;
    host.appendChild(
      mlPill("#" + t, mlFilters.tag === t, n, () => {
        mlFilters.tag = t;
        renderML();
      }, true)
    );
  });
  const block = document.getElementById("ml-tag-block");
  if (block) block.hidden = allTags().length === 0;
}

/* ---------- cards ---------- */
function buildLinkCard(l) {
  const card = document.createElement("article");
  card.className = "card ml-card";

  const top = document.createElement("div");
  top.className = "card-top";
  const badge = document.createElement("span");
  badge.className = "badge badge-folder";
  badge.textContent = l.folder ? l.folder : "Unfiled";
  if (!l.folder) badge.classList.add("is-unfiled");
  top.appendChild(badge);
  card.appendChild(top);

  const h = document.createElement("h3");
  h.className = "card-title";
  const a = document.createElement("a");
  a.textContent = l.title || hostOf(l.url) || "(untitled link)";
  if (isHttp(l.url)) {
    a.href = l.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } else {
    a.href = "#";
  }
  h.appendChild(a);
  card.appendChild(h);

  if (l.description) {
    const p = document.createElement("p");
    p.className = "card-desc";
    p.textContent = l.description;
    card.appendChild(p);
  }

  if (Array.isArray(l.tags) && l.tags.length) {
    const tags = document.createElement("div");
    tags.className = "card-usertags";
    l.tags.slice().sort((a2, b2) => a2.localeCompare(b2)).forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "usertag usertag-static";
      chip.textContent = "#" + t;
      tags.appendChild(chip);
    });
    card.appendChild(tags);
  }

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const src = document.createElement("span");
  src.className = "src";
  src.textContent = hostOf(l.url);
  meta.appendChild(src);
  if (l.added) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.textContent = "•";
    meta.appendChild(dot);
    const date = document.createElement("span");
    date.textContent = fmtDateML(l.added);
    date.title = "Added " + fmtDateML(l.added);
    meta.appendChild(date);
  }
  card.appendChild(meta);

  // actions
  const wrap = document.createElement("div");
  wrap.className = "card-actions";
  const edit = mlAction("Edit", "✎");
  edit.addEventListener("click", () => startEdit(l.id));
  const del = mlAction("Delete", "🗑");
  del.classList.add("danger");
  del.addEventListener("click", () => deleteLink(l.id));
  wrap.appendChild(edit);
  wrap.appendChild(del);
  card.appendChild(wrap);

  return card;
}
function mlAction(label, icon) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "action-btn";
  const i = document.createElement("span");
  i.className = "ico";
  i.textContent = icon;
  b.appendChild(i);
  b.appendChild(document.createTextNode(label));
  return b;
}

/* ---------- main render ---------- */
function renderML() {
  renderFolderFilters();
  renderMLTagFilters();
  refreshFolderDatalist();

  const matched = sortedLinks().filter(mlPasses);
  const groups = document.getElementById("ml-groups");
  groups.innerHTML = "";

  if (mlFilters.folder === "all" && mlFilters.tag === "all" && !mlFilters.q) {
    // group by folder when nothing is narrowing the view
    const byFolder = {};
    matched.forEach((l) => {
      const key = l.folder || UNFILED;
      (byFolder[key] = byFolder[key] || []).push(l);
    });
    const named = Object.keys(byFolder).filter((k) => k !== UNFILED).sort((a, b) => a.localeCompare(b));
    if (byFolder[UNFILED]) named.push(UNFILED);
    named.forEach((key) => {
      const arr = byFolder[key];
      groups.appendChild(mlGroupHeader(key === UNFILED ? "Unfiled" : key, arr.length));
      groups.appendChild(mlGridOf(arr));
    });
  } else if (matched.length) {
    groups.appendChild(mlGridOf(matched));
  }

  document.getElementById("ml-empty").hidden = matched.length > 0;
  document.getElementById("ml-empty").textContent =
    MLS.links.length === 0
      ? "No saved links yet. Paste a link above to start your reading log."
      : "No links match your filters.";
  updateSyncStatus();
}
function mlGroupHeader(label, count) {
  const h = document.createElement("h2");
  h.className = "group-title";
  h.appendChild(document.createTextNode(label));
  const c = document.createElement("span");
  c.className = "group-count";
  c.textContent = count;
  h.appendChild(c);
  return h;
}
function mlGridOf(items) {
  const g = document.createElement("div");
  g.className = "grid";
  items.forEach((l) => g.appendChild(buildLinkCard(l)));
  return g;
}

/* ---------- add / edit ---------- */
function refreshFolderDatalist() {
  const dl = document.getElementById("ml-folder-list");
  if (!dl) return;
  dl.innerHTML = "";
  allFolders().forEach((f) => {
    const o = document.createElement("option");
    o.value = f;
    dl.appendChild(o);
  });
}
function resetForm() {
  editingId = null;
  document.getElementById("ml-url").value = "";
  document.getElementById("ml-title").value = "";
  document.getElementById("ml-desc").value = "";
  document.getElementById("ml-folder").value = "";
  document.getElementById("ml-tags").value = "";
  document.getElementById("ml-add-submit").textContent = "+ Add link";
  document.getElementById("ml-add-cancel").hidden = true;
  document.getElementById("ml-add").classList.remove("editing");
}
function startEdit(id) {
  const l = MLS.links.find((x) => x.id === id);
  if (!l) return;
  editingId = id;
  document.getElementById("ml-url").value = l.url || "";
  document.getElementById("ml-title").value = l.title || "";
  document.getElementById("ml-desc").value = l.description || "";
  document.getElementById("ml-folder").value = l.folder || "";
  document.getElementById("ml-tags").value = (l.tags || []).join(", ");
  document.getElementById("ml-add-submit").textContent = "Save changes";
  document.getElementById("ml-add-cancel").hidden = false;
  document.getElementById("ml-add").classList.add("editing");
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("ml-url").focus();
}
function submitForm(e) {
  e.preventDefault();
  let url = document.getElementById("ml-url").value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url) && !/^[a-z]+:\/\//i.test(url)) url = "https://" + url;
  const title = document.getElementById("ml-title").value.trim();
  const description = document.getElementById("ml-desc").value.trim();
  const folder = document.getElementById("ml-folder").value.trim();
  const tags = normTags(document.getElementById("ml-tags").value);

  if (editingId) {
    const l = MLS.links.find((x) => x.id === editingId);
    if (l) {
      l.url = url;
      l.title = title;
      l.description = description;
      l.folder = folder;
      l.tags = tags;
    }
  } else {
    MLS.links.push({
      id: mlNewId(),
      url,
      title,
      description,
      folder,
      tags,
      added: mlToday(),
    });
  }
  MLS.dirty = true;
  mlSave();
  resetForm();
  renderML();
}
function deleteLink(id) {
  const l = MLS.links.find((x) => x.id === id);
  const name = l ? l.title || l.url : "this link";
  if (!window.confirm("Delete “" + name + "” from your links?")) return;
  MLS.links = MLS.links.filter((x) => x.id !== id);
  if (editingId === id) resetForm();
  MLS.dirty = true;
  mlSave();
  renderML();
}

/* ---------- sync: export / pull ---------- */
function buildExportObject() {
  return {
    meta: { generated: new Date().toISOString(), count: MLS.links.length },
    folders: allFolders(),
    links: MLS.links.slice().sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : 0)),
  };
}
function exportToRepo() {
  const data = buildExportObject();
  const header =
    "// USER-MANAGED FILE — your personal \"My Links\" store for the agent² dashboard.\n" +
    "//\n" +
    "// This is the cross-device source of truth. To update it:\n" +
    "//   1. Add / edit links in the dashboard's \"My Links\" view (held in your browser).\n" +
    "//   2. Click \"Export to repo\" — it downloads a fresh my-links.js.\n" +
    "//   3. Replace this file with the download, then commit & push.\n" +
    "// On another device, pull the repo and open the dashboard; if your browser already\n" +
    "// has older links, click \"Sync from repo\" to merge in the committed ones.\n" +
    "//\n" +
    "// The object below is plain JSON wrapped in a window assignment so the dashboard\n" +
    "// loads it with no server (works via file:// and http). Safe to hand-edit too.\n";
  const content = header + "window.__MYLINKS__ = " + JSON.stringify(data, null, 2) + ";\n";

  const blob = new Blob([content], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my-links.js";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  MLS.dirty = false;
  MLS.syncedGeneration = data.meta.generated;
  mlSave();
  updateSyncStatus();
  flashStatus("Downloaded my-links.js — replace data/my-links.js, then commit & push.");
}
function baselineNewIds() {
  const have = new Set(MLS.links.map((l) => l.id));
  return baseline().links.filter((l) => l && l.id && !have.has(l.id));
}
function syncFromRepo() {
  const base = baseline();
  const byId = new Map(MLS.links.map((l) => [l.id, l]));
  let added = 0, updated = 0;
  base.links.forEach((bl) => {
    if (!bl || !bl.id) return;
    if (byId.has(bl.id)) {
      // baseline (committed) wins for matching ids
      Object.assign(byId.get(bl.id), bl);
      updated++;
    } else {
      const copy = Object.assign({}, bl);
      MLS.links.push(copy);
      byId.set(bl.id, copy);
      added++;
    }
  });
  MLS.syncedGeneration = base.meta && base.meta.generated ? base.meta.generated : MLS.syncedGeneration;
  // dirty only if there are local-only links not yet in the committed baseline
  const baseIds = new Set(base.links.map((l) => l.id));
  MLS.dirty = MLS.links.some((l) => !baseIds.has(l.id));
  mlSave();
  renderML();
  flashStatus("Synced from repo: " + added + " added, " + updated + " updated.");
}
function updateSyncStatus() {
  const status = document.getElementById("ml-sync-status");
  const exportBtn = document.getElementById("ml-export");
  const syncBtn = document.getElementById("ml-sync-from");
  const n = MLS.links.length;
  const count = n + (n === 1 ? " link" : " links");
  if (MLS.dirty) {
    status.textContent = count + " · unsynced changes";
    status.classList.add("dirty");
    exportBtn.classList.add("primary");
  } else {
    status.textContent = count + " · synced";
    status.classList.remove("dirty");
    exportBtn.classList.remove("primary");
  }
  const pending = baselineNewIds().length;
  if (pending > 0) {
    syncBtn.hidden = false;
    syncBtn.textContent = "Sync from repo (" + pending + " new)";
  } else {
    syncBtn.hidden = true;
  }
}
let flashTimer = null;
function flashStatus(msg) {
  const el = document.getElementById("ml-flash");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    el.hidden = true;
  }, 6000);
}

/* ---------- view toggle ---------- */
function setView(view) {
  const isLinks = view === "mylinks";
  document.getElementById("view-dashboard").hidden = isLinks;
  document.getElementById("view-mylinks").hidden = !isLinks;
  document.getElementById("nav-dashboard").classList.toggle("active", !isLinks);
  document.getElementById("nav-mylinks").classList.toggle("active", isLinks);
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch (e) {}
  if (isLinks) renderML();
}

/* ---------- boot ---------- */
(function initML() {
  const stored = mlLoad();
  if (stored) {
    MLS = stored;
  } else {
    // first time on this device → seed from committed baseline
    const base = baseline();
    MLS = {
      links: base.links.map((l) => Object.assign({}, l)),
      dirty: false,
      syncedGeneration: base.meta && base.meta.generated ? base.meta.generated : null,
    };
    mlSave();
  }

  document.getElementById("ml-add").addEventListener("submit", submitForm);
  document.getElementById("ml-add-cancel").addEventListener("click", resetForm);
  document.getElementById("ml-export").addEventListener("click", exportToRepo);
  document.getElementById("ml-sync-from").addEventListener("click", syncFromRepo);

  const search = document.getElementById("ml-search");
  search.addEventListener("input", () => {
    mlFilters.q = search.value.trim();
    renderML();
  });

  document.getElementById("nav-dashboard").addEventListener("click", () => setView("dashboard"));
  document.getElementById("nav-mylinks").addEventListener("click", () => setView("mylinks"));

  let initial = "dashboard";
  try {
    if (localStorage.getItem(VIEW_KEY) === "mylinks") initial = "mylinks";
  } catch (e) {}
  setView(initial);
})();

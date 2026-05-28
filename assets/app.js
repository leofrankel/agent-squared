"use strict";

/* ----------------------------------------------------------------------------
 * agent² dashboard
 * Reads news from window.__NEWS__ (data/news.js) with a fetch fallback to
 * data/news.json. Personal tags (read / saved / custom) live in localStorage.
 * -------------------------------------------------------------------------- */

const STORE_KEY = "agent2:v1";
const BUILTIN_TAGS = [
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
  { id: "saved", label: "Saved for later" },
];

let DATA = { meta: {}, categories: [], items: [] };
let store = loadStore();
const filters = { category: "all", tag: "all", q: "" };
let openEditor = null; // { el, itemId } of the currently open tag popover

/* ---------- persistence ---------- */
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        customTags: Array.isArray(parsed.customTags) ? parsed.customTags : [],
        items: parsed.items && typeof parsed.items === "object" ? parsed.items : {},
      };
    }
  } catch (e) {
    console.warn("Could not read saved tags:", e);
  }
  return { customTags: [], items: {} };
}
function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("Could not save tags:", e);
  }
}
function itemState(id) {
  let s = store.items[id];
  if (!s) {
    s = { read: false, saved: false, tags: [] };
    store.items[id] = s;
  }
  if (!Array.isArray(s.tags)) s.tags = [];
  return s;
}

/* ---------- data loading ---------- */
async function loadData() {
  if (window.__NEWS__ && Array.isArray(window.__NEWS__.items)) {
    DATA = window.__NEWS__;
    return;
  }
  try {
    const res = await fetch("data/news.json", { cache: "no-store" });
    DATA = await res.json();
  } catch (e) {
    console.error("Failed to load news data:", e);
    DATA = { meta: {}, categories: [], items: [] };
  }
}

/* ---------- helpers ---------- */
function categoryLabel(id) {
  const c = DATA.categories.find((c) => c.id === id);
  return c ? c.label : id;
}
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function sortKey(item) {
  return (item.date_added || item.published || "") + "~" + (item.published || "");
}
function sortedItems() {
  return [...DATA.items].sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    if (ka < kb) return 1;
    if (ka > kb) return -1;
    return (a.title || "").localeCompare(b.title || "");
  });
}
function matchesSearch(item) {
  if (!filters.q) return true;
  const q = filters.q.toLowerCase();
  return (
    (item.title || "").toLowerCase().includes(q) ||
    (item.description || "").toLowerCase().includes(q) ||
    (item.source || "").toLowerCase().includes(q) ||
    (Array.isArray(item.topics) && item.topics.join(" ").toLowerCase().includes(q))
  );
}
function matchesCategory(item) {
  return filters.category === "all" || item.category === filters.category;
}
function matchesTag(item) {
  const s = itemState(item.id);
  switch (filters.tag) {
    case "all": return true;
    case "unread": return !s.read;
    case "read": return s.read;
    case "saved": return s.saved;
    default: return s.tags.includes(filters.tag);
  }
}
function passesAll(item) {
  return matchesSearch(item) && matchesCategory(item) && matchesTag(item);
}

/* ---------- filter bars ---------- */
function renderCategoryFilters() {
  const host = document.getElementById("category-filters");
  host.innerHTML = "";
  const base = sortedItems().filter((i) => matchesSearch(i) && matchesTag(i));
  const all = makePill("All", filters.category === "all", base.length, () => {
    filters.category = "all"; render();
  });
  host.appendChild(all);
  DATA.categories.forEach((c) => {
    const n = base.filter((i) => i.category === c.id).length;
    if (n === 0 && filters.category !== c.id) return;
    host.appendChild(
      makePill(c.label, filters.category === c.id, n, () => {
        filters.category = c.id; render();
      })
    );
  });
}
function renderTagFilters() {
  const host = document.getElementById("tag-filters");
  host.innerHTML = "";
  const base = sortedItems().filter((i) => matchesSearch(i) && matchesCategory(i));
  const countFor = (tagId) => base.filter((i) => {
    const s = itemState(i.id);
    if (tagId === "all") return true;
    if (tagId === "unread") return !s.read;
    if (tagId === "read") return s.read;
    if (tagId === "saved") return s.saved;
    return s.tags.includes(tagId);
  }).length;

  host.appendChild(makePill("All", filters.tag === "all", countFor("all"), () => {
    filters.tag = "all"; render();
  }, true));
  BUILTIN_TAGS.forEach((t) => {
    host.appendChild(makePill(t.label, filters.tag === t.id, countFor(t.id), () => {
      filters.tag = t.id; render();
    }, true));
  });
  store.customTags.slice().sort((a, b) => a.localeCompare(b)).forEach((t) => {
    host.appendChild(makePill("#" + t, filters.tag === t, countFor(t), () => {
      filters.tag = t; render();
    }, true));
  });
}
function makePill(label, active, count, onClick, isTag) {
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

/* ---------- cards ---------- */
function buildCard(item) {
  const s = itemState(item.id);
  const card = document.createElement("article");
  card.className = "card" + (item.significance === "high" ? " is-highlight" : "") + (s.read ? " is-read" : "");

  const top = document.createElement("div");
  top.className = "card-top";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = categoryLabel(item.category);
  top.appendChild(badge);
  if (item.significance === "high") {
    const star = document.createElement("span");
    star.className = "sig-star";
    star.textContent = "★";
    star.title = "Flagged as significant";
    top.appendChild(star);
  }
  card.appendChild(top);

  const h = document.createElement("h3");
  h.className = "card-title";
  const a = document.createElement("a");
  a.textContent = item.title || "(untitled)";
  if (typeof item.url === "string" && /^https?:\/\//i.test(item.url)) {
    a.href = item.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } else {
    a.href = "#";
  }
  h.appendChild(a);
  card.appendChild(h);

  if (item.description) {
    const p = document.createElement("p");
    p.className = "card-desc";
    p.textContent = item.description;
    card.appendChild(p);
  }

  const usertags = document.createElement("div");
  usertags.className = "card-usertags";
  renderUserTags(usertags, item);
  card.appendChild(usertags);

  const meta = document.createElement("div");
  meta.className = "card-meta";
  if (item.source) {
    const src = document.createElement("span");
    src.className = "src";
    src.textContent = item.source;
    meta.appendChild(src);
    meta.appendChild(dot());
  }
  const date = document.createElement("span");
  const displayDate = item.published || item.date_added;
  date.textContent = fmtDate(displayDate);
  if (item.date_added) date.title = "Added " + fmtDate(item.date_added);
  meta.appendChild(date);
  card.appendChild(meta);

  card.appendChild(buildActions(item, card, usertags));
  return card;
}
function dot() {
  const d = document.createElement("span");
  d.className = "dot";
  d.textContent = "•";
  return d;
}
function renderUserTags(host, item) {
  host.innerHTML = "";
  const s = itemState(item.id);
  s.tags.slice().sort((a, b) => a.localeCompare(b)).forEach((t) => {
    const chip = document.createElement("span");
    chip.className = "usertag";
    chip.appendChild(document.createTextNode("#" + t));
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "×";
    x.title = "Remove tag";
    x.addEventListener("click", () => {
      s.tags = s.tags.filter((x2) => x2 !== t);
      saveStore();
      render();
    });
    chip.appendChild(x);
    host.appendChild(chip);
  });
}
function buildActions(item, card, usertags) {
  const s = itemState(item.id);
  const wrap = document.createElement("div");
  wrap.className = "card-actions";

  const readBtn = actionButton(s.read ? "Read" : "Mark read", "✓", s.read);
  readBtn.classList.add("read");
  readBtn.addEventListener("click", () => {
    s.read = !s.read;
    saveStore();
    render();
  });

  const saveBtn = actionButton(s.saved ? "Saved" : "Save", s.saved ? "★" : "☆", s.saved);
  saveBtn.classList.add("save");
  saveBtn.addEventListener("click", () => {
    s.saved = !s.saved;
    saveStore();
    render();
  });

  const tagBtn = actionButton("Tag", "#", false);
  tagBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTagEditor(item, wrap, usertags);
  });

  wrap.appendChild(readBtn);
  wrap.appendChild(saveBtn);
  wrap.appendChild(tagBtn);
  return wrap;
}
function actionButton(label, icon, on) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "action-btn" + (on ? " on" : "");
  const i = document.createElement("span");
  i.className = "ico";
  i.textContent = icon;
  b.appendChild(i);
  b.appendChild(document.createTextNode(label));
  return b;
}

/* ---------- tag editor popover ---------- */
function closeEditor() {
  if (openEditor && openEditor.el && openEditor.el.parentNode) {
    openEditor.el.parentNode.removeChild(openEditor.el);
  }
  openEditor = null;
}
function toggleTagEditor(item, actionsWrap, usertags) {
  if (openEditor && openEditor.itemId === item.id) {
    closeEditor();
    return;
  }
  closeEditor();
  const tpl = document.getElementById("tag-editor-template");
  const el = tpl.content.firstElementChild.cloneNode(true);
  const list = el.querySelector(".tag-editor-list");
  const form = el.querySelector(".tag-editor-new");
  const input = el.querySelector(".tag-editor-input");

  const s = itemState(item.id);
  function refreshList() {
    list.innerHTML = "";
    if (store.customTags.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tag-editor-empty";
      empty.textContent = "No custom tags yet.";
      list.appendChild(empty);
      return;
    }
    store.customTags.slice().sort((a, b) => a.localeCompare(b)).forEach((t) => {
      const row = document.createElement("label");
      row.className = "tag-editor-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = s.tags.includes(t);
      cb.addEventListener("change", () => {
        if (cb.checked) {
          if (!s.tags.includes(t)) s.tags.push(t);
        } else {
          s.tags = s.tags.filter((x) => x !== t);
        }
        saveStore();
        renderUserTags(usertags, item);
        renderTagFilters();
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode("#" + t));
      list.appendChild(row);
    });
  }
  refreshList();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase();
    if (!name) return;
    if (!store.customTags.includes(name)) store.customTags.push(name);
    if (!s.tags.includes(name)) s.tags.push(name);
    input.value = "";
    saveStore();
    refreshList();
    renderUserTags(usertags, item);
    renderTagFilters();
  });

  actionsWrap.appendChild(el);
  openEditor = { el, itemId: item.id };
  input.focus();
}

/* ---------- main render ---------- */
function render() {
  closeEditor();
  renderCategoryFilters();
  renderTagFilters();

  const matched = sortedItems().filter(passesAll);
  const highlights = matched.filter((i) => i.significance === "high");
  const rest = matched.filter((i) => i.significance !== "high");

  // Highlights
  const hSection = document.getElementById("highlights-section");
  const hGrid = document.getElementById("highlights-grid");
  hGrid.innerHTML = "";
  if (highlights.length > 0) {
    hSection.hidden = false;
    highlights.forEach((i) => hGrid.appendChild(buildCard(i)));
  } else {
    hSection.hidden = true;
  }

  // Grouped main list
  const groups = document.getElementById("groups");
  groups.innerHTML = "";
  if (filters.category === "all") {
    DATA.categories.forEach((c) => {
      const inCat = rest.filter((i) => i.category === c.id);
      if (inCat.length === 0) return;
      groups.appendChild(groupHeader(c.label, inCat.length));
      groups.appendChild(gridOf(inCat));
    });
  } else {
    if (rest.length > 0) {
      groups.appendChild(groupHeader(categoryLabel(filters.category), rest.length));
      groups.appendChild(gridOf(rest));
    }
  }

  document.getElementById("empty-state").hidden = matched.length > 0;
  updateHeader(matched.length);
}
function groupHeader(label, count) {
  const h = document.createElement("h2");
  h.className = "group-title";
  h.appendChild(document.createTextNode(label));
  const c = document.createElement("span");
  c.className = "group-count";
  c.textContent = count;
  h.appendChild(c);
  return h;
}
function gridOf(items) {
  const g = document.createElement("div");
  g.className = "grid";
  items.forEach((i) => g.appendChild(buildCard(i)));
  return g;
}
function updateHeader(shownCount) {
  const total = DATA.items.length;
  const lu = document.getElementById("last-updated");
  if (DATA.meta && DATA.meta.generated) {
    lu.textContent = "Updated " + fmtDate(DATA.meta.generated);
  }
  const ic = document.getElementById("item-count");
  ic.textContent = shownCount === total ? total + " items" : shownCount + " of " + total + " items";
}

/* ---------- global listeners ---------- */
document.addEventListener("click", (e) => {
  if (openEditor && !e.target.closest(".tag-editor") && !e.target.closest(".action-btn")) {
    closeEditor();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeEditor();
});

/* ---------- boot ---------- */
(async function init() {
  await loadData();
  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    filters.q = search.value.trim();
    render();
  });
  render();
})();

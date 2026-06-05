"use strict";

/* ----------------------------------------------------------------------------
 * agent² dashboard (front page)
 * Renders curated recommendations from window.__NEWS__ (data/news.js, fetch
 * fallback to data/news.json). All personal state — add-to-library, read
 * status, tags — lives in the shared per-user Store (assets/store.js), so the
 * Dashboard and Library stay in sync and sync to the cloud when signed in.
 * -------------------------------------------------------------------------- */

let DATA = { meta: {}, categories: [], research_subcategories: [], items: [] };
const filters = { category: "all", researchSubcat: "all", tag: "all", q: "" };
let openEditor = null; // { el, itemId } of the open tag popover

const TAG_BUILTINS = [
  { id: "in-library", label: "In library" },
  { id: "want", label: "Want to read" },
  { id: "read", label: "Read" },
];

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
function researchSubcatLabel(id) {
  const s = (DATA.research_subcategories || []).find((s) => s.id === id);
  return s ? s.label : id;
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
    const ka = sortKey(a),
      kb = sortKey(b);
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
function matchesResearchSubcat(item) {
  if (filters.researchSubcat === "all") return true;
  return item.category === "research" && item.research_subcategory === filters.researchSubcat;
}
function matchesTag(item) {
  const it = Store.byNewsId(item.id);
  switch (filters.tag) {
    case "all":
      return true;
    case "in-library":
      return !!it;
    case "want":
      return !!it && it.status === "want";
    case "read":
      return !!it && it.status === "read";
    default:
      return !!it && it.tags.includes(filters.tag);
  }
}
function passesAll(item) {
  return matchesSearch(item) && matchesCategory(item) && matchesResearchSubcat(item) && matchesTag(item);
}

/* ---------- filter bars ---------- */
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
function renderCategoryFilters() {
  const host = document.getElementById("category-filters");
  host.innerHTML = "";
  const base = sortedItems().filter((i) => matchesSearch(i) && matchesTag(i));
  host.appendChild(
    makePill("All", filters.category === "all", base.length, () => {
      filters.category = "all";
      render();
    })
  );
  DATA.categories.forEach((c) => {
    const n = base.filter((i) => i.category === c.id).length;
    if (n === 0 && filters.category !== c.id) return;
    host.appendChild(
      makePill(c.label, filters.category === c.id, n, () => {
        filters.category = c.id;
        render();
      })
    );
  });
}
function renderResearchSubcatFilters() {
  const host = document.getElementById("research-subcat-filters");
  const block = document.getElementById("research-subcat-block");
  if (!host || !block) return;

  // Base: items matching search + category + tag (not subcategory itself)
  const base = sortedItems().filter((i) => matchesSearch(i) && matchesCategory(i) && matchesTag(i) && i.category === "research");
  const totalResearch = sortedItems().filter((i) => matchesSearch(i) && matchesCategory(i) && matchesTag(i) && i.category === "research").length;

  // Hide the entire block if there are no research items in the current view
  block.hidden = totalResearch === 0 && filters.researchSubcat === "all";

  host.innerHTML = "";
  const allCount = base.length;
  host.appendChild(
    makePill("All topics", filters.researchSubcat === "all", allCount, () => {
      filters.researchSubcat = "all";
      render();
    })
  );
  (DATA.research_subcategories || []).forEach((s) => {
    const n = base.filter((i) => i.research_subcategory === s.id).length;
    if (n === 0 && filters.researchSubcat !== s.id) return;
    host.appendChild(
      makePill(s.label, filters.researchSubcat === s.id, n, () => {
        filters.researchSubcat = s.id;
        // Also switch category view to research for clarity
        if (filters.category !== "research") {
          filters.category = "all";
        }
        render();
      })
    );
  });
}
function tagCount(tagId, base) {
  return base.filter((i) => {
    const it = Store.byNewsId(i.id);
    if (tagId === "all") return true;
    if (tagId === "in-library") return !!it;
    if (tagId === "want") return !!it && it.status === "want";
    if (tagId === "read") return !!it && it.status === "read";
    return !!it && it.tags.includes(tagId);
  }).length;
}
function renderTagFilters() {
  const host = document.getElementById("tag-filters");
  host.innerHTML = "";
  const base = sortedItems().filter((i) => matchesSearch(i) && matchesCategory(i));
  host.appendChild(
    makePill("All", filters.tag === "all", tagCount("all", base), () => {
      filters.tag = "all";
      render();
    }, true)
  );
  TAG_BUILTINS.forEach((t) => {
    host.appendChild(
      makePill(t.label, filters.tag === t.id, tagCount(t.id, base), () => {
        filters.tag = t.id;
        render();
      }, true)
    );
  });
  Store.allTags().forEach((t) => {
    const n = tagCount(t, base);
    if (n === 0 && filters.tag !== t) return;
    host.appendChild(
      makePill("#" + t, filters.tag === t, n, () => {
        filters.tag = t;
        render();
      }, true)
    );
  });
}

/* ---------- cards ---------- */
function buildCard(item) {
  const it = Store.byNewsId(item.id);
  const card = document.createElement("article");
  card.className =
    "card" +
    (item.significance === "high" ? " is-highlight" : "") +
    (it && it.status === "read" ? " is-read" : "") +
    (it ? " is-saved" : "");

  const top = document.createElement("div");
  top.className = "card-top";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = categoryLabel(item.category);
  top.appendChild(badge);
  if (item.category === "research" && item.research_subcategory) {
    const sub = document.createElement("span");
    sub.className = "badge-sub";
    sub.textContent = researchSubcatLabel(item.research_subcategory);
    sub.title = "Research topic";
    top.appendChild(sub);
  }
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
  date.textContent = fmtDate(item.published || item.date_added);
  if (item.date_added) date.title = "Added " + fmtDate(item.date_added);
  meta.appendChild(date);
  card.appendChild(meta);

  card.appendChild(buildActions(item, usertags));
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
  const it = Store.byNewsId(item.id);
  if (!it) return;
  it.tags
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .forEach((t) => {
      const chip = document.createElement("span");
      chip.className = "usertag";
      chip.appendChild(document.createTextNode("#" + t));
      const x = document.createElement("button");
      x.type = "button";
      x.textContent = "×";
      x.title = "Remove tag";
      x.addEventListener("click", () => {
        Store.toggleTag(it.id, t);
        renderUserTags(host, item);
        renderTagFilters();
      });
      chip.appendChild(x);
      host.appendChild(chip);
    });
}
function buildActions(item, usertags) {
  const it = Store.byNewsId(item.id);
  const wrap = document.createElement("div");
  wrap.className = "card-actions";

  const saved = !!it;
  const saveBtn = actionButton(saved ? "In library" : "Add to library", saved ? "★" : "☆", saved);
  saveBtn.classList.add("save");
  saveBtn.addEventListener("click", () => {
    if (saved) {
      if (window.confirm("Remove “" + (item.title || "this item") + "” from your library?")) {
        Store.remove(it.id);
      }
    } else {
      Store.addCurated(item, "want");
    }
  });

  const read = saved && it.status === "read";
  const readBtn = actionButton(read ? "Read" : "Mark read", "✓", read);
  readBtn.classList.add("read");
  readBtn.addEventListener("click", () => {
    if (read) Store.setStatus(it.id, "want");
    else Store.addCurated(item, "read");
  });

  const tagBtn = actionButton("Tag", "#", false);
  tagBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTagEditor(item, wrap, usertags);
  });

  wrap.appendChild(saveBtn);
  wrap.appendChild(readBtn);
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
  const wasOpen = !!openEditor;
  openEditor = null;
  if (wasOpen) render();
}
function toggleTagEditor(item, actionsWrap, usertags) {
  if (openEditor && openEditor.itemId === item.id) {
    closeEditor();
    return;
  }
  if (openEditor) {
    if (openEditor.el && openEditor.el.parentNode) openEditor.el.parentNode.removeChild(openEditor.el);
    openEditor = null;
  }
  const tpl = document.getElementById("tag-editor-template");
  const el = tpl.content.firstElementChild.cloneNode(true);
  const list = el.querySelector(".tag-editor-list");
  const form = el.querySelector(".tag-editor-new");
  const input = el.querySelector(".tag-editor-input");

  function ensureItem() {
    let it = Store.byNewsId(item.id);
    if (!it) it = Store.addCurated(item, "want");
    return it;
  }
  function refreshList() {
    list.innerHTML = "";
    const it = Store.byNewsId(item.id);
    const all = Store.allTags();
    if (all.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tag-editor-empty";
      empty.textContent = "No tags yet — add one below.";
      list.appendChild(empty);
      return;
    }
    all.forEach((t) => {
      const row = document.createElement("label");
      row.className = "tag-editor-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!it && it.tags.includes(t);
      cb.addEventListener("change", () => {
        const cur = ensureItem();
        Store.toggleTag(cur.id, t);
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
    const cur = ensureItem();
    if (!cur.tags.includes(name)) Store.toggleTag(cur.id, name);
    input.value = "";
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
  renderCategoryFilters();
  renderResearchSubcatFilters();
  renderTagFilters();

  const matched = sortedItems().filter(passesAll);
  const highlights = matched.filter((i) => i.significance === "high");
  const rest = matched.filter((i) => i.significance !== "high");

  const hSection = document.getElementById("highlights-section");
  const hGrid = document.getElementById("highlights-grid");
  hGrid.innerHTML = "";
  if (highlights.length > 0) {
    hSection.hidden = false;
    highlights.forEach((i) => hGrid.appendChild(buildCard(i)));
  } else {
    hSection.hidden = true;
  }

  const groups = document.getElementById("groups");
  groups.innerHTML = "";

  const showingResearch = filters.category === "research" ||
    (filters.category === "all" && filters.researchSubcat !== "all");

  if (filters.category === "all" && filters.researchSubcat === "all") {
    // Default: group by top-level category; Research section groups by subcategory
    DATA.categories.forEach((c) => {
      const inCat = rest.filter((i) => i.category === c.id);
      if (inCat.length === 0) return;
      if (c.id === "research") {
        groups.appendChild(groupHeader(c.label, inCat.length));
        renderResearchGroups(groups, inCat);
      } else {
        groups.appendChild(groupHeader(c.label, inCat.length));
        groups.appendChild(gridOf(inCat));
      }
    });
  } else if (filters.category === "research" && filters.researchSubcat === "all") {
    // Research category selected, no subcat filter: group by subcategory
    if (rest.length > 0) {
      groups.appendChild(groupHeader("Research", rest.length));
      renderResearchGroups(groups, rest);
    }
  } else if (rest.length > 0) {
    const label = filters.researchSubcat !== "all"
      ? researchSubcatLabel(filters.researchSubcat)
      : categoryLabel(filters.category);
    groups.appendChild(groupHeader(label, rest.length));
    groups.appendChild(gridOf(rest));
  }

  document.getElementById("empty-state").hidden = matched.length > 0;
  updateHeader(matched.length);
}
function renderResearchGroups(container, items) {
  const subcats = DATA.research_subcategories || [];
  let hasGrouped = false;
  subcats.forEach((s) => {
    const inSub = items.filter((i) => i.research_subcategory === s.id);
    if (inSub.length === 0) return;
    hasGrouped = true;
    container.appendChild(subgroupHeader(s.label, inSub.length));
    container.appendChild(gridOf(inSub));
  });
  // Fallback: items without a subcategory
  const unclassified = items.filter((i) => !i.research_subcategory);
  if (unclassified.length > 0) {
    if (hasGrouped) container.appendChild(subgroupHeader("Other", unclassified.length));
    container.appendChild(gridOf(unclassified));
  }
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
function subgroupHeader(label, count) {
  const h = document.createElement("h3");
  h.className = "subgroup-title";
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
  if (DATA.meta && DATA.meta.generated) lu.textContent = "Updated " + fmtDate(DATA.meta.generated);
  const ic = document.getElementById("item-count");
  ic.textContent = shownCount === total ? total + " items" : shownCount + " of " + total + " items";
}

/* ---------- listeners ---------- */
document.addEventListener("click", (e) => {
  if (openEditor && !e.target.closest(".tag-editor") && !e.target.closest(".action-btn")) {
    closeEditor();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeEditor();
});
document.addEventListener("store-changed", () => {
  if (openEditor) return; // editor does its own incremental updates
  render();
});

/* ---------- favicon ---------- */
function drawFavicon() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Rounded-square background
  const r = 26;
  ctx.fillStyle = "#0c1320";
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Measure at reference size to find scale factor
  const supRatio = 0.55;
  const refSize = 100;
  const pad = 7;
  ctx.font = `600 ${refSize}px "Fraunces"`;
  const aRefWidth = ctx.measureText("a").width;
  ctx.font = `600 ${refSize * supRatio}px "Fraunces"`;
  const twoRefWidth = ctx.measureText("2").width;

  // Solve: aWidth + twoWidth = size - 2*pad
  const scale = (size - 2 * pad) / (aRefWidth + twoRefWidth);
  const aFontSize = refSize * scale;
  const twoFontSize = aFontSize * supRatio;

  // Measure final widths and ascents
  ctx.font = `600 ${aFontSize}px "Fraunces"`;
  const aM = ctx.measureText("a");
  ctx.font = `600 ${twoFontSize}px "Fraunces"`;
  const twoM = ctx.measureText("2");

  // "a" flush bottom-left
  ctx.fillStyle = "#e6d8b8";
  ctx.font = `600 ${aFontSize}px "Fraunces"`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText("a", pad, size - pad);

  // "2" flush top-right, left edge touching right edge of "a"
  ctx.fillStyle = "#6f97d6";
  ctx.font = `600 ${twoFontSize}px "Fraunces"`;
  ctx.fillText("2", pad + aM.width, pad + twoM.actualBoundingBoxAscent);

  const link = document.getElementById("favicon");
  if (link) {
    link.type = "image/png";
    link.href = canvas.toDataURL("image/png");
  }
}

/* ---------- boot ---------- */
(async function init() {
  await loadData();
  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    filters.q = search.value.trim();
    render();
  });
  render();
  // Draw favicon once fonts are ready, or after 3s if they never resolve
  const faviconTimer = setTimeout(drawFavicon, 3000);
  document.fonts.ready.then(() => { clearTimeout(faviconTimer); drawFavicon(); });
})();

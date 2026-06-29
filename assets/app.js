"use strict";

/* ----------------------------------------------------------------------------
 * agent² dashboard (front page)
 * Renders curated recommendations fetched from data/news.json (the single
 * source of truth). The loaded payload is republished on window.__NEWS__ so the
 * Library view (assets/library.js) can resolve saved items' category labels.
 * All personal state — add-to-library, read status, tags — lives in the shared
 * per-user Store (assets/store.js), so the Dashboard and Library stay in sync
 * and sync to the cloud when signed in.
 * -------------------------------------------------------------------------- */

let DATA = { meta: {}, categories: [], research_subcategories: [], items: [] };
const filters = { category: "all", researchSubcat: "all", tag: "all", dateRange: "all", customDate: null, q: "" };

const DATE_RANGES = [
  { id: "all",    label: "All time" },
  { id: "7d",     label: "Last 7 days" },
  { id: "30d",    label: "Last 30 days" },
  { id: "90d",    label: "Last 90 days" },
  { id: "year",   label: "This year" },
  { id: "custom", label: "Custom…" },
];
let openEditor = null; // { el, itemId } of the open tag popover

const TAG_BUILTINS = [
  { id: "in-library", label: "In library" },
  { id: "want", label: "Want to read" },
  { id: "read", label: "Read" },
];

/* ---------- data loading ---------- */
async function loadData() {
  try {
    const res = await fetch("data/news.json", { cache: "no-store" });
    DATA = await res.json();
  } catch (e) {
    console.error("Failed to load news data:", e);
    DATA = { meta: {}, categories: [], research_subcategories: [], items: [] };
  }
  // Publish for the Library view (assets/library.js), which resolves saved
  // items' category labels from this registry, then signal that it's ready so
  // a Library rendered before the fetch resolved can re-render with labels.
  window.__NEWS__ = DATA;
  document.dispatchEvent(new CustomEvent("news-loaded"));
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
function dateRangeCutoff(rangeId) {
  const now = new Date();
  if (rangeId === "7d")   { const d = new Date(now); d.setDate(d.getDate() - 7);   return d; }
  if (rangeId === "30d")  { const d = new Date(now); d.setDate(d.getDate() - 30);  return d; }
  if (rangeId === "90d")  { const d = new Date(now); d.setDate(d.getDate() - 90);  return d; }
  if (rangeId === "year") { return new Date(now.getFullYear(), 0, 1); }
  return null;
}
function itemDate(item) {
  const raw = item.published || item.date_added;
  if (!raw) return null;
  const d = new Date(raw.length <= 10 ? raw + "T00:00:00" : raw);
  return isNaN(d) ? null : d;
}
function matchesDateRange(item) {
  if (filters.dateRange === "all") return true;
  if (filters.dateRange === "custom") {
    if (!filters.customDate) return true;
    const d = itemDate(item);
    return !!d && d >= filters.customDate;
  }
  const d = itemDate(item);
  if (!d) return false;
  const cutoff = dateRangeCutoff(filters.dateRange);
  return cutoff ? d >= cutoff : true;
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
  return matchesSearch(item) && matchesCategory(item) && matchesResearchSubcat(item) && matchesTag(item) && matchesDateRange(item);
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
  const base = sortedItems().filter((i) => matchesSearch(i) && matchesTag(i) && matchesDateRange(i));
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
  const base = sortedItems().filter((i) => matchesSearch(i) && matchesCategory(i) && matchesTag(i) && matchesDateRange(i) && i.category === "research");
  const totalResearch = base.length;

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
  const base = sortedItems().filter((i) => matchesSearch(i) && matchesCategory(i) && matchesDateRange(i));
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

/* ---------- calendar popover ---------- */
let calendarEl = null;
const calendarView = { year: 0, month: 0 };

function closeCalendar() {
  const overlay = document.querySelector(".dp-overlay");
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  if (calendarEl && calendarEl.parentNode) calendarEl.parentNode.removeChild(calendarEl);
  calendarEl = null;
}

function buildCalendarEl() {
  const ref = filters.customDate || new Date();
  calendarView.year = ref.getFullYear();
  calendarView.month = ref.getMonth();

  const el = document.createElement("div");
  el.className = "date-picker";

  function draw() {
    el.innerHTML = "";

    // — header: prev / month+year / next —
    const hdr = document.createElement("div");
    hdr.className = "dp-header";

    const prev = document.createElement("button");
    prev.type = "button"; prev.className = "dp-nav"; prev.textContent = "‹";
    prev.addEventListener("click", (e) => {
      e.stopPropagation();
      if (--calendarView.month < 0) { calendarView.month = 11; calendarView.year--; }
      draw();
    });

    const title = document.createElement("span");
    title.className = "dp-title";
    title.textContent = new Date(calendarView.year, calendarView.month)
      .toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const next = document.createElement("button");
    next.type = "button"; next.className = "dp-nav"; next.textContent = "›";
    next.addEventListener("click", (e) => {
      e.stopPropagation();
      if (++calendarView.month > 11) { calendarView.month = 0; calendarView.year++; }
      draw();
    });

    hdr.appendChild(prev); hdr.appendChild(title); hdr.appendChild(next);
    el.appendChild(hdr);

    // — weekday labels —
    const wdays = document.createElement("div");
    wdays.className = "dp-weekdays";
    ["Su","Mo","Tu","We","Th","Fr","Sa"].forEach((d) => {
      const s = document.createElement("span"); s.textContent = d; wdays.appendChild(s);
    });
    el.appendChild(wdays);

    // — day grid —
    const grid = document.createElement("div");
    grid.className = "dp-grid";

    const firstDow = new Date(calendarView.year, calendarView.month, 1).getDay();
    const daysInMonth = new Date(calendarView.year, calendarView.month + 1, 0).getDate();
    const today = new Date();
    const selY = filters.customDate ? filters.customDate.getFullYear() : -1;
    const selM = filters.customDate ? filters.customDate.getMonth()    : -1;
    const selD = filters.customDate ? filters.customDate.getDate()     : -1;

    for (let i = 0; i < firstDow; i++) {
      const sp = document.createElement("span"); sp.className = "dp-cell"; grid.appendChild(sp);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "dp-cell dp-day"; btn.textContent = d;
      if (today.getFullYear() === calendarView.year && today.getMonth() === calendarView.month && today.getDate() === d)
        btn.classList.add("dp-today");
      if (selY === calendarView.year && selM === calendarView.month && selD === d)
        btn.classList.add("dp-selected");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        filters.customDate = new Date(calendarView.year, calendarView.month, d);
        filters.dateRange = "custom";
        closeCalendar();
        render();
      });
      grid.appendChild(btn);
    }
    el.appendChild(grid);
  }

  draw();
  return el;
}

function openCalendar() {
  const host = document.getElementById("date-filters");
  if (!host) return;
  // Transparent full-page overlay catches outside clicks without blocking the
  // date-filter pills (which sit in a higher stacking context via z-index).
  const overlay = document.createElement("div");
  overlay.className = "dp-overlay";
  // Defer listener by one tick so the opening click can't immediately close us.
  setTimeout(() => overlay.addEventListener("click", () => {
    closeCalendar();
    if (!filters.customDate) { filters.dateRange = "all"; render(); }
  }), 0);
  document.body.appendChild(overlay);
  calendarEl = buildCalendarEl();
  host.appendChild(calendarEl);
}

function renderDateFilters() {
  const host = document.getElementById("date-filters");
  if (!host) return;
  host.innerHTML = "";
  const base = sortedItems().filter((i) => matchesSearch(i) && matchesCategory(i) && matchesResearchSubcat(i) && matchesTag(i));

  DATE_RANGES.forEach((r) => {
    if (r.id === "custom") {
      const isActive = filters.dateRange === "custom";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill" + (isActive ? " active" : "");

      const labelSpan = document.createElement("span");
      labelSpan.textContent = (isActive && filters.customDate)
        ? "From " + fmtDate(filters.customDate.toISOString().slice(0, 10))
        : "Custom…";
      btn.appendChild(labelSpan);

      if (isActive && filters.customDate) {
        const countSpan = document.createElement("span");
        countSpan.className = "count";
        countSpan.textContent = base.filter((i) => { const d = itemDate(i); return d && d >= filters.customDate; }).length;
        btn.appendChild(countSpan);
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (calendarEl) {
          closeCalendar();
          if (!filters.customDate) { filters.dateRange = "all"; render(); }
          return;
        }
        filters.dateRange = "custom";
        // Update pill appearance without a full re-render (avoids DOM detach
        // issues that cause the outside-click guard to fire immediately).
        btn.classList.add("active");
        openCalendar();
      });
      host.appendChild(btn);
      return;
    }

    const n = r.id === "all"
      ? base.length
      : base.filter((i) => { const d = itemDate(i); return d && d >= dateRangeCutoff(r.id); }).length;
    if (n === 0 && filters.dateRange !== r.id && r.id !== "all") return;
    host.appendChild(
      makePill(r.label, filters.dateRange === r.id, r.id === "all" ? undefined : n, () => {
        filters.dateRange = r.id;
        closeCalendar();
        render();
      })
    );
  });

  // Re-attach the calendar popover if it was open before this rebuild
  if (calendarEl) host.appendChild(calendarEl);
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
  renderDateFilters();

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
  if (e.key === "Escape") { closeEditor(); closeCalendar(); }
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

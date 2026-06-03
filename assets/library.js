"use strict";

/* ----------------------------------------------------------------------------
 * agent² — Library view
 * The user's personal collection: saved dashboard items (origin "curated") and
 * custom links (origin "custom"), read from the shared Store (assets/store.js).
 * Displayed dashboard-style: grouped by section (category / folder), filterable
 * by status (want / read), section, tags, and search. Custom links can be
 * edited; everything can be removed (with confirmation). Includes the cloud
 * account bar (sign in to sync) and JSON backup export/import.
 *
 * All identifiers are lib-prefixed because this file shares global scope with
 * app.js (no modules / build step).
 * -------------------------------------------------------------------------- */

const VIEW_KEY = "agent2:view";
const libFilters = { status: "all", section: "all", tag: "all", q: "" };
let libEditingId = null;
let libAuthFormOpen = false;
let libOpenEditor = null;

const LIB_STATUS = [
  { id: "want", label: "Want to read" },
  { id: "read", label: "Read" },
];

/* ---------- helpers ---------- */
function libCategoryLabel(id) {
  const cats = (window.__NEWS__ && window.__NEWS__.categories) || [];
  const c = cats.find((x) => x.id === id);
  return c ? c.label : id || "";
}
function libFmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function libHostOf(url) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : "https://" + url).hostname.replace(/^www\./, "");
  } catch (e) {
    return url;
  }
}
function libSectionKey(it) {
  return it.origin === "curated" ? "cat:" + (it.category || "") : "folder:" + (it.folder || "");
}
function libSectionLabel(it) {
  if (it.origin === "curated") return libCategoryLabel(it.category) || "Saved";
  return it.folder || "My links";
}
function libSortedItems() {
  return Store.all().sort((a, b) => {
    const ka = a.added || "",
      kb = b.added || "";
    if (ka < kb) return 1;
    if (ka > kb) return -1;
    return (a.title || a.url || "").localeCompare(b.title || b.url || "");
  });
}

/* ---------- filtering ---------- */
function libMatchSearch(it) {
  if (!libFilters.q) return true;
  const q = libFilters.q.toLowerCase();
  return (
    (it.title || "").toLowerCase().includes(q) ||
    (it.description || "").toLowerCase().includes(q) ||
    (it.url || "").toLowerCase().includes(q) ||
    (it.source || "").toLowerCase().includes(q) ||
    libSectionLabel(it).toLowerCase().includes(q) ||
    (Array.isArray(it.tags) && it.tags.join(" ").toLowerCase().includes(q))
  );
}
function libMatchStatus(it) {
  return libFilters.status === "all" || it.status === libFilters.status;
}
function libMatchSection(it) {
  return libFilters.section === "all" || libSectionKey(it) === libFilters.section;
}
function libMatchTag(it) {
  return libFilters.tag === "all" || (Array.isArray(it.tags) && it.tags.includes(libFilters.tag));
}
function libPasses(it) {
  return libMatchSearch(it) && libMatchStatus(it) && libMatchSection(it) && libMatchTag(it);
}

/* ---------- filter bars ---------- */
function libPill(label, active, count, onClick) {
  const btn = document.createElement("button");
  btn.className = "pill" + (active ? " active" : "") + " tag-pill";
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
function libRenderStatusFilters() {
  const host = document.getElementById("lib-status-filters");
  host.innerHTML = "";
  const base = libSortedItems().filter((i) => libMatchSearch(i) && libMatchSection(i) && libMatchTag(i));
  host.appendChild(
    libPill("All", libFilters.status === "all", base.length, () => {
      libFilters.status = "all";
      libRender();
    })
  );
  LIB_STATUS.forEach((s) => {
    host.appendChild(
      libPill(s.label, libFilters.status === s.id, base.filter((i) => i.status === s.id).length, () => {
        libFilters.status = s.id;
        libRender();
      })
    );
  });
}
function libRenderSectionFilters() {
  const host = document.getElementById("lib-section-filters");
  host.innerHTML = "";
  const base = libSortedItems().filter((i) => libMatchSearch(i) && libMatchStatus(i) && libMatchTag(i));
  host.appendChild(
    libPill("All", libFilters.section === "all", base.length, () => {
      libFilters.section = "all";
      libRender();
    })
  );
  const seen = new Map();
  base.forEach((it) => {
    const k = libSectionKey(it);
    if (!seen.has(k)) seen.set(k, { label: libSectionLabel(it), n: 0 });
    seen.get(k).n++;
  });
  Array.from(seen.entries())
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .forEach(([key, info]) => {
      host.appendChild(
        libPill(info.label, libFilters.section === key, info.n, () => {
          libFilters.section = key;
          libRender();
        })
      );
    });
}
function libRenderTagFilters() {
  const host = document.getElementById("lib-tag-filters");
  host.innerHTML = "";
  const base = libSortedItems().filter((i) => libMatchSearch(i) && libMatchStatus(i) && libMatchSection(i));
  host.appendChild(
    libPill("All", libFilters.tag === "all", base.length, () => {
      libFilters.tag = "all";
      libRender();
    })
  );
  Store.allTags().forEach((t) => {
    const n = base.filter((i) => (i.tags || []).includes(t)).length;
    if (n === 0 && libFilters.tag !== t) return;
    host.appendChild(
      libPill("#" + t, libFilters.tag === t, n, () => {
        libFilters.tag = t;
        libRender();
      })
    );
  });
  const block = document.getElementById("lib-tag-block");
  if (block) block.hidden = Store.allTags().length === 0;
}

/* ---------- cards ---------- */
function libActionButton(label, icon, on) {
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
function libBuildCard(it) {
  const card = document.createElement("article");
  card.className = "card lib-card" + (it.status === "read" ? " is-read" : "");

  const top = document.createElement("div");
  top.className = "card-top";
  const badge = document.createElement("span");
  badge.className = "badge" + (it.origin === "custom" ? " badge-folder" : "");
  badge.textContent = libSectionLabel(it);
  top.appendChild(badge);
  const statusChip = document.createElement("span");
  statusChip.className = "status-chip " + (it.status === "read" ? "is-read" : "is-want");
  statusChip.textContent = it.status === "read" ? "Read" : "To read";
  top.appendChild(statusChip);
  card.appendChild(top);

  const h = document.createElement("h3");
  h.className = "card-title";
  const a = document.createElement("a");
  a.textContent = it.title || libHostOf(it.url) || "(untitled)";
  if (typeof it.url === "string" && /^https?:\/\//i.test(it.url)) {
    a.href = it.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } else {
    a.href = "#";
  }
  h.appendChild(a);
  card.appendChild(h);

  if (it.description) {
    const p = document.createElement("p");
    p.className = "card-desc";
    p.textContent = it.description;
    card.appendChild(p);
  }

  const usertags = document.createElement("div");
  usertags.className = "card-usertags";
  libRenderUserTags(usertags, it);
  card.appendChild(usertags);

  const meta = document.createElement("div");
  meta.className = "card-meta";
  if (it.source) {
    const src = document.createElement("span");
    src.className = "src";
    src.textContent = it.source;
    meta.appendChild(src);
    const d = document.createElement("span");
    d.className = "dot";
    d.textContent = "•";
    meta.appendChild(d);
  }
  const date = document.createElement("span");
  date.textContent = libFmtDate(it.added);
  meta.appendChild(date);
  card.appendChild(meta);

  card.appendChild(libBuildActions(it, usertags));
  return card;
}
function libRenderUserTags(host, it) {
  host.innerHTML = "";
  (it.tags || [])
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
        libRenderUserTags(host, it);
        libRenderTagFilters();
      });
      chip.appendChild(x);
      host.appendChild(chip);
    });
}
function libBuildActions(it, usertags) {
  const wrap = document.createElement("div");
  wrap.className = "card-actions";

  const read = it.status === "read";
  const readBtn = libActionButton(read ? "Read" : "Mark read", "✓", read);
  readBtn.classList.add("read");
  readBtn.addEventListener("click", () => Store.setStatus(it.id, read ? "want" : "read"));

  const tagBtn = libActionButton("Tag", "#", false);
  tagBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    libToggleTagEditor(it, wrap, usertags);
  });

  wrap.appendChild(readBtn);
  wrap.appendChild(tagBtn);

  if (it.origin === "custom") {
    const editBtn = libActionButton("Edit", "✎", false);
    editBtn.addEventListener("click", () => libStartEdit(it.id));
    wrap.appendChild(editBtn);
  }

  const removeBtn = libActionButton("Remove", "🗑", false);
  removeBtn.classList.add("danger");
  removeBtn.addEventListener("click", () => {
    const name = it.title || it.url || "this item";
    if (window.confirm("Remove “" + name + "” from your library?")) Store.remove(it.id);
  });
  wrap.appendChild(removeBtn);

  return wrap;
}

/* ---------- tag editor ---------- */
function libCloseEditor() {
  if (libOpenEditor && libOpenEditor.el && libOpenEditor.el.parentNode) {
    libOpenEditor.el.parentNode.removeChild(libOpenEditor.el);
  }
  const wasOpen = !!libOpenEditor;
  libOpenEditor = null;
  if (wasOpen) libRender();
}
function libToggleTagEditor(it, actionsWrap, usertags) {
  if (libOpenEditor && libOpenEditor.itemId === it.id) {
    libCloseEditor();
    return;
  }
  if (libOpenEditor && libOpenEditor.el && libOpenEditor.el.parentNode) {
    libOpenEditor.el.parentNode.removeChild(libOpenEditor.el);
    libOpenEditor = null;
  }
  const tpl = document.getElementById("tag-editor-template");
  const el = tpl.content.firstElementChild.cloneNode(true);
  const list = el.querySelector(".tag-editor-list");
  const form = el.querySelector(".tag-editor-new");
  const input = el.querySelector(".tag-editor-input");

  function refreshList() {
    list.innerHTML = "";
    const cur = Store.get(it.id);
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
      cb.checked = !!cur && cur.tags.includes(t);
      cb.addEventListener("change", () => {
        Store.toggleTag(it.id, t);
        libRenderUserTags(usertags, Store.get(it.id) || it);
        libRenderTagFilters();
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
    const cur = Store.get(it.id);
    if (cur && !cur.tags.includes(name)) Store.toggleTag(it.id, name);
    input.value = "";
    refreshList();
    libRenderUserTags(usertags, Store.get(it.id) || it);
    libRenderTagFilters();
  });

  actionsWrap.appendChild(el);
  libOpenEditor = { el, itemId: it.id };
  input.focus();
}

/* ---------- add / edit custom links ---------- */
function libRefreshFolderDatalist() {
  const dl = document.getElementById("lib-folder-list");
  if (!dl) return;
  dl.innerHTML = "";
  const folders = Array.from(
    new Set(Store.all().filter((i) => i.origin === "custom" && i.folder).map((i) => i.folder))
  ).sort((a, b) => a.localeCompare(b));
  folders.forEach((f) => {
    const o = document.createElement("option");
    o.value = f;
    dl.appendChild(o);
  });
}
function libResetForm() {
  libEditingId = null;
  ["lib-url", "lib-title", "lib-desc", "lib-folder", "lib-tags"].forEach((id) => (document.getElementById(id).value = ""));
  document.getElementById("lib-add-submit").textContent = "+ Add link";
  document.getElementById("lib-add-cancel").hidden = true;
  document.getElementById("lib-add").classList.remove("editing");
}
function libStartEdit(id) {
  const it = Store.get(id);
  if (!it) return;
  libEditingId = id;
  document.getElementById("lib-url").value = it.url || "";
  document.getElementById("lib-title").value = it.title || "";
  document.getElementById("lib-desc").value = it.description || "";
  document.getElementById("lib-folder").value = it.folder || "";
  document.getElementById("lib-tags").value = (it.tags || []).join(", ");
  document.getElementById("lib-add-submit").textContent = "Save changes";
  document.getElementById("lib-add-cancel").hidden = false;
  document.getElementById("lib-add").classList.add("editing");
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("lib-url").focus();
}
function libSubmit(e) {
  e.preventDefault();
  let url = document.getElementById("lib-url").value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url) && !/^[a-z]+:\/\//i.test(url)) url = "https://" + url;
  const data = {
    url,
    title: document.getElementById("lib-title").value.trim(),
    description: document.getElementById("lib-desc").value.trim(),
    folder: document.getElementById("lib-folder").value.trim(),
    tags: document.getElementById("lib-tags").value,
  };
  if (libEditingId) {
    const it = Store.get(libEditingId);
    Store.update(libEditingId, {
      url: data.url,
      title: data.title,
      description: data.description,
      folder: data.folder,
      tags: data.tags,
      source: it && it.origin === "custom" ? libHostOf(data.url) : it ? it.source : libHostOf(data.url),
    });
  } else {
    Store.addCustom(data);
  }
  libResetForm();
}

/* ---------- backup export / import ---------- */
function libExport() {
  const content = JSON.stringify(Store.exportObject(), null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const a = document.createElement("a");
  a.href = url;
  a.download = "agent2-library-" + stamp + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  libFlash("Downloaded a backup of your " + Store.all().length + " library items.");
}
function libImport(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (e) {
      libFlash("Couldn’t read that file — it isn’t valid JSON.");
      return;
    }
    const incoming = Array.isArray(parsed) ? parsed : parsed && parsed.items;
    if (!Array.isArray(incoming)) {
      libFlash("That file doesn’t look like a library backup.");
      return;
    }
    const res = Store.importItems(incoming);
    libFlash("Imported " + res.added + " new, updated " + res.updated + ".");
  };
  reader.readAsText(file);
}
let libFlashTimer = null;
function libFlash(msg) {
  const el = document.getElementById("lib-flash");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(libFlashTimer);
  libFlashTimer = setTimeout(() => (el.hidden = true), 6000);
}

/* ---------- account / cloud ---------- */
function libCloudReady() {
  return window.Cloud && window.Cloud.available;
}
function libRenderAccount() {
  const host = document.getElementById("lib-account");
  if (!host) return;
  host.innerHTML = "";
  if (!libCloudReady()) {
    host.hidden = true;
    return;
  }
  host.hidden = false;

  if (window.Cloud.isSignedIn()) {
    const u = window.Cloud.user();
    const status = document.createElement("span");
    status.className = "ml-account-status";
    status.textContent = "✓ Synced across devices" + (u && u.email ? " as " + u.email : "");
    const out = document.createElement("button");
    out.type = "button";
    out.className = "ml-sync-btn";
    out.textContent = "Sign out";
    out.addEventListener("click", () => window.Cloud.signOut());
    host.appendChild(status);
    host.appendChild(out);
    return;
  }

  const status = document.createElement("span");
  status.className = "ml-account-status";
  status.textContent = "Your library is saved in this browser.";
  host.appendChild(status);

  if (!libAuthFormOpen) {
    const google = document.createElement("button");
    google.type = "button";
    google.className = "ml-sync-btn primary-soft";
    google.textContent = "Continue with Google";
    google.addEventListener("click", () => window.Cloud.signInWithGoogle());

    const emailBtn = document.createElement("button");
    emailBtn.type = "button";
    emailBtn.className = "ml-sync-btn";
    emailBtn.textContent = "Use email instead";
    emailBtn.addEventListener("click", () => {
      libAuthFormOpen = true;
      libRenderAccount();
    });

    host.appendChild(google);
    host.appendChild(emailBtn);
    return;
  }

  const form = document.createElement("form");
  form.className = "ml-signin-form";
  const email = document.createElement("input");
  email.type = "email";
  email.required = true;
  email.placeholder = "you@example.com";
  email.className = "ml-input ml-input-sm";
  const send = document.createElement("button");
  send.type = "submit";
  send.className = "ml-add-btn";
  send.textContent = "Send sign-in link";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ml-cancel-btn";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => {
    libAuthFormOpen = false;
    libRenderAccount();
  });
  form.appendChild(email);
  form.appendChild(send);
  form.appendChild(cancel);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const addr = email.value.trim();
    if (!addr) return;
    send.disabled = true;
    send.textContent = "Sending…";
    const { error } = await window.Cloud.signInWithEmail(addr);
    if (error) {
      libFlash("Sign-in failed: " + error.message);
      send.disabled = false;
      send.textContent = "Send sign-in link";
    } else {
      libAuthFormOpen = false;
      libRenderAccount();
      libFlash("Check your email for a sign-in link, then come back to this page.");
    }
  });
  host.appendChild(form);
  setTimeout(() => email.focus(), 0);
}
function libUpdateStatusText() {
  const el = document.getElementById("lib-status-text");
  if (!el) return;
  const n = Store.all().length;
  const count = n + (n === 1 ? " item" : " items");
  if (libCloudReady() && window.Cloud.isSignedIn()) el.textContent = count + " · synced to your account";
  else el.textContent = count + " · stored in this browser";
}

/* ---------- main render ---------- */
function libGroupHeader(label, count) {
  const h = document.createElement("h2");
  h.className = "group-title";
  h.appendChild(document.createTextNode(label));
  const c = document.createElement("span");
  c.className = "group-count";
  c.textContent = count;
  h.appendChild(c);
  return h;
}
function libGridOf(items) {
  const g = document.createElement("div");
  g.className = "grid";
  items.forEach((it) => g.appendChild(libBuildCard(it)));
  return g;
}
function libRender() {
  libRenderStatusFilters();
  libRenderSectionFilters();
  libRenderTagFilters();
  libRefreshFolderDatalist();
  libUpdateStatusText();

  const matched = libSortedItems().filter(libPasses);
  const groups = document.getElementById("lib-groups");
  groups.innerHTML = "";

  if (libFilters.section === "all") {
    const buckets = new Map();
    matched.forEach((it) => {
      const k = libSectionKey(it);
      if (!buckets.has(k)) buckets.set(k, { label: libSectionLabel(it), items: [] });
      buckets.get(k).items.push(it);
    });
    Array.from(buckets.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((b) => {
        groups.appendChild(libGroupHeader(b.label, b.items.length));
        groups.appendChild(libGridOf(b.items));
      });
  } else if (matched.length) {
    groups.appendChild(libGridOf(matched));
  }

  const empty = document.getElementById("lib-empty");
  empty.hidden = matched.length > 0;
  empty.textContent =
    Store.all().length === 0
      ? "Your library is empty. Save items from the Dashboard with “Add to library”, or add your own link above."
      : "No items match your filters.";
}

/* ---------- view toggle ---------- */
function setView(view) {
  const isLib = view === "library";
  document.getElementById("view-dashboard").hidden = isLib;
  document.getElementById("view-library").hidden = !isLib;
  document.getElementById("nav-dashboard").classList.toggle("active", !isLib);
  document.getElementById("nav-library").classList.toggle("active", isLib);
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch (e) {}
  if (isLib) {
    libRenderAccount();
    libRender();
  }
}

/* ---------- boot ---------- */
(function initLibrary() {
  document.getElementById("lib-add").addEventListener("submit", libSubmit);
  document.getElementById("lib-add-cancel").addEventListener("click", libResetForm);
  document.getElementById("lib-export").addEventListener("click", libExport);
  const importFile = document.getElementById("lib-import-file");
  document.getElementById("lib-import").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    if (importFile.files && importFile.files[0]) libImport(importFile.files[0]);
    importFile.value = "";
  });

  const search = document.getElementById("lib-search");
  search.addEventListener("input", () => {
    libFilters.q = search.value.trim();
    libRender();
  });

  document.getElementById("nav-dashboard").addEventListener("click", () => setView("dashboard"));
  document.getElementById("nav-library").addEventListener("click", () => setView("library"));

  document.addEventListener("store-changed", () => {
    if (libOpenEditor) return;
    if (!document.getElementById("view-library").hidden) libRender();
    else libUpdateStatusText();
  });
  document.addEventListener("cloud-auth", () => {
    libRenderAccount();
    libUpdateStatusText();
  });

  document.addEventListener("click", (e) => {
    if (libOpenEditor && !e.target.closest(".tag-editor") && !e.target.closest(".action-btn")) libCloseEditor();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && libOpenEditor) libCloseEditor();
  });

  let initial = "dashboard";
  try {
    if (localStorage.getItem(VIEW_KEY) === "library") initial = "library";
  } catch (e) {}
  setView(initial);
})();

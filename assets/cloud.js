"use strict";

/* ----------------------------------------------------------------------------
 * agent² — Supabase cloud layer
 * Client + auth (email magic link) + per-user "library" CRUD.
 *
 * The URL and publishable (anon) key below are PUBLIC by design — they're meant
 * to ship in the browser. Row-Level Security on the `library` table is what keeps
 * each user's data private, so committing these is safe.
 *
 * Exposes window.Cloud and dispatches a "cloud-auth" event on the document
 * whenever the sign-in state resolves or changes. store.js consumes both.
 * -------------------------------------------------------------------------- */
(function () {
  const SUPABASE_URL = "https://ledmhtatxhkonppyxjeo.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_L3PHfPxEsId74Egq2fxLtg_HQcKguHS";

  if (!window.supabase || !window.supabase.createClient) {
    console.warn("Supabase library not loaded — cloud sync disabled, app stays local-first.");
    window.Cloud = { available: false, isSignedIn: () => false, user: () => null };
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let currentUser = null;

  function emit(srcEvent) {
    console.log("[MERGE-DEBUG] cloud.emit", { srcEvent: srcEvent || "(getSession)", signedIn: !!currentUser, userId: currentUser && currentUser.id });
    document.dispatchEvent(
      new CustomEvent("cloud-auth", { detail: { signedIn: !!currentUser, user: currentUser } })
    );
  }

  function rowToItem(r) {
    return {
      id: r.id,
      origin: r.origin || "custom",
      news_id: r.news_id || null,
      url: r.url || "",
      title: r.title || "",
      description: r.description || "",
      source: r.source || "",
      category: r.category || "",
      folder: r.folder || "",
      tags: Array.isArray(r.tags) ? r.tags : [],
      status: r.status === "read" ? "read" : "want",
      added: r.added || "",
    };
  }
  function itemToRow(i) {
    // user_id intentionally omitted — the column defaults to auth.uid() on insert.
    return {
      id: i.id,
      origin: i.origin || "custom",
      news_id: i.news_id || null,
      url: i.url,
      title: i.title || "",
      description: i.description || "",
      source: i.source || "",
      category: i.category || "",
      folder: i.folder || "",
      tags: Array.isArray(i.tags) ? i.tags : [],
      status: i.status === "read" ? "read" : "want",
      added: i.added || null,
    };
  }

  window.Cloud = {
    available: true,
    isSignedIn() {
      return !!currentUser;
    },
    user() {
      return currentUser;
    },
    signInWithEmail(email) {
      const redirect = window.location.href.split("#")[0];
      return client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    },
    signInWithGoogle() {
      const redirect = window.location.href.split("#")[0];
      return client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect } });
    },
    signOut() {
      return client.auth.signOut();
    },
    async fetchAll() {
      const { data, error } = await client
        .from("library")
        .select("*")
        .order("added", { ascending: false });
      if (error) {
        console.warn("Cloud fetch failed:", error.message);
        return [];
      }
      return (data || []).map(rowToItem);
    },
    async upsert(item) {
      const { error } = await client.from("library").upsert(itemToRow(item));
      if (error) console.warn("Cloud upsert failed:", error.message);
      return !error;
    },
    async remove(id) {
      const { error } = await client.from("library").delete().eq("id", id);
      if (error) console.warn("Cloud delete failed:", error.message);
      return !error;
    },
  };

  client.auth.onAuthStateChange((_event, session) => {
    currentUser = session && session.user ? session.user : null;
    emit(_event);
  });
  client.auth.getSession().then(({ data }) => {
    currentUser = data && data.session && data.session.user ? data.session.user : null;
    emit();
  });
})();

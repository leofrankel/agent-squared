"use strict";

/* ----------------------------------------------------------------------------
 * agent² — Supabase cloud layer
 * Client + auth (email magic link) + per-user "links" CRUD.
 *
 * The URL and publishable (anon) key below are PUBLIC by design — they're meant
 * to ship in the browser. Row-Level Security on the `links` table is what keeps
 * each user's data private, so committing these is safe.
 *
 * Exposes window.Cloud and dispatches a "cloud-auth" event on the document
 * whenever the sign-in state resolves or changes. mylinks.js consumes both.
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

  function emit() {
    document.dispatchEvent(
      new CustomEvent("cloud-auth", { detail: { signedIn: !!currentUser, user: currentUser } })
    );
  }

  function rowToLink(r) {
    return {
      id: r.id,
      url: r.url || "",
      title: r.title || "",
      description: r.description || "",
      folder: r.folder || "",
      tags: Array.isArray(r.tags) ? r.tags : [],
      added: r.added || "",
    };
  }
  function linkToRow(l) {
    // user_id intentionally omitted — the column defaults to auth.uid() on insert.
    return {
      id: l.id,
      url: l.url,
      title: l.title || "",
      description: l.description || "",
      folder: l.folder || "",
      tags: Array.isArray(l.tags) ? l.tags : [],
      added: l.added || null,
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
    signOut() {
      return client.auth.signOut();
    },
    async fetchAll() {
      const { data, error } = await client
        .from("links")
        .select("*")
        .order("added", { ascending: false });
      if (error) {
        console.warn("Cloud fetch failed:", error.message);
        return [];
      }
      return (data || []).map(rowToLink);
    },
    async upsert(link) {
      const { error } = await client.from("links").upsert(linkToRow(link));
      if (error) console.warn("Cloud upsert failed:", error.message);
      return !error;
    },
    async remove(id) {
      const { error } = await client.from("links").delete().eq("id", id);
      if (error) console.warn("Cloud delete failed:", error.message);
      return !error;
    },
  };

  client.auth.onAuthStateChange((_event, session) => {
    currentUser = session && session.user ? session.user : null;
    emit();
  });
  // Resolve any existing session on load (e.g. returning from a magic link).
  client.auth.getSession().then(({ data }) => {
    currentUser = data && data.session && data.session.user ? data.session.user : null;
    emit();
  });
})();

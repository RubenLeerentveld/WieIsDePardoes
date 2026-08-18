/* ==========================================================================
   auth.js — lightweight client-side sign-in

   THIS IS NOT SECURITY.
   Every PIN sits in data/players.json and data/settings.json, which any
   visitor can download. The login exists so six people at a theme park end
   up on their own dossier — not to keep anyone out. Do not put anything
   sensitive in this project.
   ========================================================================== */

window.WIDM = window.WIDM || {};

(function (WIDM) {
  "use strict";

  const SESSION_KEY = "widm.session.v1";
  const LOGIN_PAGE = "login.html";

  function readSession() {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.kind) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeSession(session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    window.localStorage.removeItem(SESSION_KEY);
  }

  /** Compare loosely: players type their own name, casing and spaces vary. */
  function sameName(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  }

  /**
   * Sign a player in. Requires WIDM.data.load() to have resolved.
   * Returns { ok, session } or { ok:false, reason }.
   */
  function loginPlayer(name, pin) {
    const players = WIDM.data.get("players") || [];
    const player = players.find(function (candidate) {
      return sameName(candidate.name, name) || sameName(candidate.id, name);
    });

    if (!player) {
      return { ok: false, reason: "onbekend" };
    }
    if (String(player.pin) !== String(pin).trim()) {
      return { ok: false, reason: "pin" };
    }

    return {
      ok: true,
      session: writeSession({
        kind: "player",
        id: player.id,
        name: player.name,
        since: new Date().toISOString(),
      }),
    };
  }

  /** Sign the game master in. */
  function loginAdmin(pin) {
    const settings = WIDM.data.get("settings") || {};
    if (String(settings.adminPin) !== String(pin).trim()) {
      return { ok: false, reason: "pin" };
    }
    return {
      ok: true,
      session: writeSession({
        kind: "admin",
        id: "admin",
        name: "Spelleider",
        since: new Date().toISOString(),
      }),
    };
  }

  function logout() {
    clearSession();
    window.location.href = LOGIN_PAGE;
  }

  /**
   * Page guard. Returns the session, or redirects and returns null.
   * `kind` is 'player' or 'admin'.
   */
  function guard(kind) {
    const session = readSession();
    if (!session || (kind && session.kind !== kind)) {
      const target = window.location.pathname.split("/").pop() || "";
      window.location.replace(LOGIN_PAGE + "?next=" + encodeURIComponent(target));
      return null;
    }
    return session;
  }

  /** The player record for the current session, or null. */
  function currentPlayer() {
    const session = readSession();
    if (!session || session.kind !== "player") return null;
    const players = WIDM.data.get("players") || [];
    return players.find(function (player) {
      return player.id === session.id;
    }) || null;
  }

  WIDM.auth = {
    session: readSession,
    loginPlayer: loginPlayer,
    loginAdmin: loginAdmin,
    logout: logout,
    guard: guard,
    currentPlayer: currentPlayer,
  };
})(window.WIDM);

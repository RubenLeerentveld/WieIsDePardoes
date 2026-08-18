/* ==========================================================================
   data.js — the single data layer

   HOW PERSISTENCE WORKS (read this before changing anything)
   ----------------------------------------------------------
   The canonical game data lives in the JSON files under /data. They are the
   source of truth and can only be changed by the administrator replacing the
   files on the server.

   A static site cannot write to those files, so every change made in the
   browser (a submitted test, an edited question) is kept in a SEPARATE
   localStorage "overlay". The overlay is per-device and per-browser.

       canonical  data/*.json      shared by everyone, survives forever
       overlay    localStorage     local to this browser only

   Reads merge overlay over canonical. Writes only ever touch the overlay.
   The admin can export the merged state as JSON files and put those on the
   server, which is how local changes become canonical.
   ========================================================================== */

window.WIDM = window.WIDM || {};

(function (WIDM) {
  "use strict";

  const OVERLAY_KEY = "widm.overlay.v1";

  /** Collection name -> file under /data. */
  const FILES = {
    game: "data/game.json",
    settings: "data/settings.json",
    players: "data/players.json",
    questions: "data/questions.json",
    tests: "data/tests.json",
    results: "data/results.json",
  };

  const NAMES = Object.keys(FILES);

  let canonical = null; // raw contents of the JSON files
  let overlay = null; // local, browser-only changes
  let loading = null; // in-flight load promise

  /* ------------------------------------------------------------------------
     Overlay storage
     ------------------------------------------------------------------------ */
  function readOverlay() {
    try {
      const raw = window.localStorage.getItem(OVERLAY_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.warn("[WIDM] Overlay onleesbaar, wordt genegeerd.", error);
      return {};
    }
  }

  function writeOverlay() {
    try {
      window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
    } catch (error) {
      WIDM.toast("Lokale opslag zit vol of is geblokkeerd.", "error");
      console.error("[WIDM]", error);
    }
  }

  /* ------------------------------------------------------------------------
     Loading
     ------------------------------------------------------------------------ */
  async function fetchJson(url) {
    let response;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch (error) {
      throw new Error("Kan " + url + " niet ophalen (" + error.message + ")");
    }
    if (!response.ok) {
      throw new Error("Kan " + url + " niet ophalen (HTTP " + response.status + ")");
    }
    try {
      return await response.json();
    } catch (error) {
      throw new Error("Ongeldige JSON in " + url + " (" + error.message + ")");
    }
  }

  /**
   * Loads every JSON file once per page and caches the result.
   * Returns the merged database object.
   */
  function load() {
    if (loading) return loading;

    loading = Promise.all(NAMES.map((name) => fetchJson(FILES[name])))
      .then(function (values) {
        canonical = {};
        NAMES.forEach(function (name, index) {
          canonical[name] = values[index];
        });
        overlay = readOverlay();
        return db();
      })
      .catch(function (error) {
        loading = null; // allow a retry
        throw error;
      });

    return loading;
  }

  /** The merged view: overlay wins per collection. */
  function db() {
    const merged = {};
    NAMES.forEach(function (name) {
      merged[name] = overlay && Object.prototype.hasOwnProperty.call(overlay, name)
        ? overlay[name]
        : canonical[name];
    });
    return merged;
  }

  function get(name) {
    if (!canonical) throw new Error("WIDM.data.load() is nog niet voltooid.");
    return db()[name];
  }

  /**
   * Replace a whole collection in the overlay. Everything the admin UI and
   * the test runner change goes through here.
   */
  function set(name, value) {
    if (!NAMES.includes(name)) throw new Error("Onbekende collectie: " + name);
    overlay[name] = value;
    writeOverlay();
    return value;
  }

  /** Convenience: read-modify-write on one collection. */
  function update(name, mutator) {
    const next = mutator(structuredCloneish(get(name)));
    return set(name, next);
  }

  /** Small clone helper — the data is plain JSON, so this is enough. */
  function structuredCloneish(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /* ------------------------------------------------------------------------
     Local-change bookkeeping
     ------------------------------------------------------------------------ */
  function changedCollections() {
    if (!overlay) return [];
    return NAMES.filter(function (name) {
      return Object.prototype.hasOwnProperty.call(overlay, name);
    });
  }

  function hasLocalChanges() {
    return changedCollections().length > 0;
  }

  /** Drop local changes for one collection, or all of them. */
  function revert(name) {
    if (name) {
      delete overlay[name];
    } else {
      overlay = {};
    }
    writeOverlay();
  }

  /* ------------------------------------------------------------------------
     Export / import — the bridge back to the canonical files
     ------------------------------------------------------------------------ */
  function serialize(name) {
    return JSON.stringify(get(name), null, 2) + "\n";
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /** Download one <name>.json exactly as it should land in /data. */
  function exportFile(name) {
    download(name + ".json", serialize(name));
  }

  /** Download every collection that differs from the canonical files. */
  function exportChanged() {
    const changed = changedCollections();
    changed.forEach(function (name, index) {
      // Stagger slightly: some browsers drop rapid consecutive downloads.
      setTimeout(function () {
        exportFile(name);
      }, index * 350);
    });
    return changed;
  }

  /** One bundle containing everything, for backup purposes. */
  function exportBundle() {
    const bundle = { exportedAt: new Date().toISOString(), data: db() };
    download("widm-bundle.json", JSON.stringify(bundle, null, 2) + "\n");
  }

  /**
   * Accepts either a bundle produced by exportBundle() or a single
   * collection file. Returns the list of collections that were imported.
   */
  function importJson(text, hintedName) {
    const parsed = JSON.parse(text);

    // Bundle shape
    if (parsed && parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed)) {
      const imported = [];
      NAMES.forEach(function (name) {
        if (parsed.data[name] !== undefined) {
          set(name, parsed.data[name]);
          imported.push(name);
        }
      });
      if (!imported.length) throw new Error("Geen bekende collecties in dit bestand.");
      return imported;
    }

    // Single collection — infer from the filename, fall back to the shape.
    const name = NAMES.includes(hintedName) ? hintedName : inferName(parsed);
    if (!name) throw new Error("Onbekend bestandstype. Hernoem naar bijvoorbeeld questions.json.");
    set(name, parsed);
    return [name];
  }

  function inferName(value) {
    if (Array.isArray(value)) {
      const first = value[0] || {};
      if ("pin" in first && "name" in first) return "players";
      if ("correctAnswer" in first) return "questions";
      if ("available" in first) return "tests";
      if ("playerId" in first) return "results";
      return null;
    }
    if (value && typeof value === "object") {
      if ("currentDay" in value || "pot" in value) return "game";
      if ("adminPin" in value || "leaderboardVisible" in value) return "settings";
    }
    return null;
  }

  /* ------------------------------------------------------------------------
     Exports
     ------------------------------------------------------------------------ */
  WIDM.data = {
    FILES: FILES,
    NAMES: NAMES,
    load: load,
    db: db,
    get: get,
    set: set,
    update: update,
    clone: structuredCloneish,
    hasLocalChanges: hasLocalChanges,
    changedCollections: changedCollections,
    revert: revert,
    serialize: serialize,
    exportFile: exportFile,
    exportChanged: exportChanged,
    exportBundle: exportBundle,
    importJson: importJson,
  };
})(window.WIDM);

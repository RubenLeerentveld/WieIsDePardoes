/* ==========================================================================
   data.js — de datalaag

   HOE OPSLAAN WERKT (lees dit voordat je iets wijzigt)
   ---------------------------------------------------
   Er zijn drie plekken waar data kan staan:

       data/*.json    uitgangsdata uit het image, alleen lezen
       live/*.json    de levende data op de server, geschreven via HTTP PUT
       localStorage   noodgreep als de server niet schrijfbaar is

   Lezen gaat altijd eerst naar live/ en valt terug op data/. Zo mag live/
   leeg beginnen — belangrijk op een NAS, waar een gekoppelde map niet vanuit
   het image gevuld wordt.

   Schrijven doet de spelleider met een wachtwoord (HTTP basic auth op /live/).
   De wijziging is meteen voor iedereen zichtbaar; niemand hoeft nog bestanden
   te exporteren. Lukt het schrijven niet, dan valt de wijziging terug op
   localStorage en zegt de site dat er iets mis is.

   Inzendingen van spelers gaan naar /inbox/ onder een eigen bestandsnaam, dus
   die kunnen elkaar niet overschrijven.
   ========================================================================== */

window.WIDM = window.WIDM || {};

(function (WIDM) {
  "use strict";

  const OVERLAY_KEY = "widm.overlay.v2";
  const CREDS_KEY = "widm.write.v1";

  const NAMES = ["game", "settings", "players", "questions", "tests", "results", "jokers", "envelopes"];

  const SEED_DIR = "data/";
  const LIVE_DIR = "live/";
  const INBOX_DIR = "inbox/";

  let seed = null; // inhoud van data/*.json
  let live = null; // inhoud van live/*.json, per collectie (of undefined)
  let overlay = null; // lokale noodopslag
  let loading = null;
  let serverWritable = true; // wordt false zodra een PUT faalt

  /* ------------------------------------------------------------------------
     Inloggegevens voor schrijven
     ------------------------------------------------------------------------ */
  function credentials() {
    try {
      const raw = window.sessionStorage.getItem(CREDS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function setCredentials(user, password) {
    window.sessionStorage.setItem(CREDS_KEY, JSON.stringify({ user: user, password: password }));
  }

  function clearCredentials() {
    window.sessionStorage.removeItem(CREDS_KEY);
  }

  function authHeader() {
    const creds = credentials();
    if (!creds) return null;
    return "Basic " + btoa(creds.user + ":" + creds.password);
  }

  /* ------------------------------------------------------------------------
     Lokale noodopslag
     ------------------------------------------------------------------------ */
  function readOverlay() {
    try {
      const raw = window.localStorage.getItem(OVERLAY_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function writeOverlay() {
    try {
      window.localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
    } catch (error) {
      console.error("[WIDM] localStorage vol of geblokkeerd", error);
    }
  }

  /* ------------------------------------------------------------------------
     Laden
     ------------------------------------------------------------------------ */
  async function fetchJson(url, optional) {
    let response;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch (error) {
      if (optional) return undefined;
      throw new Error("Kan " + url + " niet ophalen (" + error.message + ")");
    }
    if (response.status === 404 && optional) return undefined;
    if (!response.ok) {
      if (optional) return undefined;
      throw new Error("Kan " + url + " niet ophalen (HTTP " + response.status + ")");
    }
    try {
      return await response.json();
    } catch (error) {
      if (optional) return undefined;
      throw new Error("Ongeldige JSON in " + url);
    }
  }

  function load() {
    if (loading) return loading;

    loading = Promise.all([
      // De uitgangsdata moet er zijn; live/ mag ontbreken.
      Promise.all(NAMES.map((name) => fetchJson(SEED_DIR + name + ".json", isOptionalSeed(name)))),
      Promise.all(NAMES.map((name) => fetchJson(LIVE_DIR + name + ".json", true))),
    ])
      .then(function (both) {
        seed = {};
        live = {};
        NAMES.forEach(function (name, index) {
          seed[name] = both[0][index] !== undefined ? both[0][index] : emptyFor(name);
          if (both[1][index] !== undefined) live[name] = both[1][index];
        });
        overlay = readOverlay();
        return db();
      })
      .catch(function (error) {
        loading = null;
        throw error;
      });

    return loading;
  }

  /** Nieuwe collecties mogen ontbreken in oudere data-mappen. */
  function isOptionalSeed(name) {
    return name === "jokers" || name === "envelopes";
  }

  function emptyFor(name) {
    return name === "game" || name === "settings" ? {} : [];
  }

  /** De samengevoegde blik: overlay > live > seed. */
  function db() {
    const merged = {};
    NAMES.forEach(function (name) {
      if (overlay && Object.prototype.hasOwnProperty.call(overlay, name)) merged[name] = overlay[name];
      else if (live && Object.prototype.hasOwnProperty.call(live, name)) merged[name] = live[name];
      else merged[name] = seed[name];
    });
    return merged;
  }

  function get(name) {
    if (!seed) throw new Error("WIDM.data.load() is nog niet voltooid.");
    return db()[name];
  }

  /* ------------------------------------------------------------------------
     Schrijven
     ------------------------------------------------------------------------ */
  /**
   * Werkt de collectie direct bij in het geheugen en stuurt hem op de
   * achtergrond naar de server. Bewust niet async: alle aanroepers in de
   * admin blijven zo eenvoudig, en de UI reageert meteen.
   */
  function set(name, value) {
    if (!NAMES.includes(name)) throw new Error("Onbekende collectie: " + name);

    live[name] = value;
    push(name, value);
    return value;
  }

  function update(name, mutator) {
    return set(name, mutator(clone(get(name))));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  /** Eén collectie naar de server sturen. */
  async function push(name, value) {
    const header = authHeader();
    if (!header) {
      fallback(name, value, "Geen schrijfcode ingevoerd.");
      return false;
    }

    try {
      const response = await fetch(LIVE_DIR + name + ".json", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: header },
        body: JSON.stringify(value, null, 2) + "\n",
      });

      if (response.status === 401) {
        fallback(name, value, "De schrijfcode klopt niet.");
        clearCredentials();
        return false;
      }
      if (!response.ok) {
        fallback(name, value, "Server weigerde de wijziging (HTTP " + response.status + ").");
        return false;
      }

      // Gelukt: de noodkopie mag weg.
      if (overlay && Object.prototype.hasOwnProperty.call(overlay, name)) {
        delete overlay[name];
        writeOverlay();
      }
      serverWritable = true;
      document.dispatchEvent(new CustomEvent("widm:saved", { detail: { name: name } }));
      return true;
    } catch (error) {
      fallback(name, value, error.message);
      return false;
    }
  }

  /** Opslaan mislukt: hou de wijziging lokaal vast en waarschuw. */
  function fallback(name, value, reason) {
    overlay[name] = value;
    writeOverlay();
    serverWritable = false;
    document.dispatchEvent(
      new CustomEvent("widm:savefailed", { detail: { name: name, reason: reason } })
    );
  }

  /** Alles wat nog lokaal vastzit alsnog naar de server duwen. */
  async function retryPending() {
    const names = Object.keys(overlay || {});
    const done = [];
    for (const name of names) {
      // eslint-disable-next-line no-await-in-loop
      if (await push(name, overlay[name])) done.push(name);
    }
    return done;
  }

  function pending() {
    return Object.keys(overlay || {});
  }

  /* ------------------------------------------------------------------------
     Inzendingen van spelers
     ------------------------------------------------------------------------ */
  /** Eigen bestandsnaam per speler per dag, dus geen botsingen. */
  async function submitToInbox(record) {
    const file = INBOX_DIR + record.playerId + "-dag" + record.day + ".json";
    const response = await fetch(file, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record, null, 2) + "\n",
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return true;
  }

  /**
   * Welke enveloppen een speler heeft geopend. Staat in /inbox/ naast de
   * inzendingen, zodat hints een speler volgen als hij van toestel wisselt.
   * Geeft null terug als er nog niets op de server staat.
   */
  async function readOpened(playerId) {
    const list = await fetchJson(INBOX_DIR + "opened-" + playerId + ".json", true);
    return Array.isArray(list) ? list : null;
  }

  async function saveOpened(playerId, ids) {
    const response = await fetch(INBOX_DIR + "opened-" + playerId + ".json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids, null, 2) + "\n",
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return true;
  }

  /** Alles ophalen wat spelers hebben ingeleverd. */
  async function readInbox() {
    const listing = await fetchJson(INBOX_DIR, true);
    if (!Array.isArray(listing)) return [];

    const files = listing
      .filter(function (entry) {
        // opened-*.json zijn geopende enveloppen, geen ingeleverde tests.
        return entry.type === "file" &&
          /\.json$/i.test(entry.name) &&
          !/^opened-/i.test(entry.name);
      })
      .map(function (entry) {
        return entry.name;
      });

    const records = [];
    for (const name of files) {
      // eslint-disable-next-line no-await-in-loop
      const record = await fetchJson(INBOX_DIR + name, true);
      // Alleen echte inzendingen: speler, dag en een lijst antwoorden.
      if (record && record.playerId && record.day !== undefined && Array.isArray(record.answers)) {
        records.push(record);
      }
    }
    return records;
  }

  /**
   * Maakt alles in /inbox/ onschadelijk door er een leeg object overheen te
   * schrijven. We hebben bewust geen DELETE aanstaan op de server, en dat
   * hoeft ook niet: readInbox() eist speler, dag en antwoorden, dus een leeg
   * object wordt voortaan genegeerd.
   */
  async function voidInbox() {
    const listing = await fetchJson(INBOX_DIR, true);
    if (!Array.isArray(listing)) return 0;

    const files = listing
      .filter(function (entry) {
        return entry.type === "file" && /\.json$/i.test(entry.name);
      })
      .map(function (entry) {
        return entry.name;
      });

    let cleared = 0;
    for (const name of files) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(INBOX_DIR + name, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (response.ok) cleared += 1;
      } catch (error) {
        /* volgende */
      }
    }
    return cleared;
  }

  /* ------------------------------------------------------------------------
     Back-up (nog steeds handig, maar niet meer nodig om te spelen)
     ------------------------------------------------------------------------ */
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

  function exportFile(name) {
    download(name + ".json", JSON.stringify(get(name), null, 2) + "\n");
  }

  function exportBundle() {
    download(
      "widm-backup.json",
      JSON.stringify({ exportedAt: new Date().toISOString(), data: db() }, null, 2) + "\n"
    );
  }

  function importJson(text, hintedName) {
    const parsed = JSON.parse(text);
    if (parsed && parsed.data && !Array.isArray(parsed)) {
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
    if (!NAMES.includes(hintedName)) throw new Error("Hernoem het bestand naar bijvoorbeeld questions.json.");
    set(hintedName, parsed);
    return [hintedName];
  }

  WIDM.data = {
    NAMES: NAMES,
    load: load,
    db: db,
    get: get,
    set: set,
    update: update,
    clone: clone,

    credentials: credentials,
    setCredentials: setCredentials,
    clearCredentials: clearCredentials,
    isServerWritable: function () {
      return serverWritable;
    },
    retryPending: retryPending,
    pending: pending,

    submitToInbox: submitToInbox,
    readInbox: readInbox,
    readOpened: readOpened,
    voidInbox: voidInbox,
    saveOpened: saveOpened,

    exportFile: exportFile,
    exportBundle: exportBundle,
    importJson: importJson,
  };
})(window.WIDM);

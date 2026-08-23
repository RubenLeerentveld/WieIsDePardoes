/* ==========================================================================
   admin.js — de schil van het archief

   Sinds v2 slaat de admin rechtstreeks op de server op. Er is geen
   exporteer-en-vervang-ritueel meer: wat je hier wijzigt, ziet iedereen bij de
   volgende paginaverversing. Daarvoor is eenmalig het schrijfwachtwoord nodig
   (basic auth op /live/, zie nginx.conf).
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;
  const handlers = [];

  const FILE_LABELS = {
    game: "game.json",
    settings: "settings.json",
    players: "players.json",
    questions: "questions.json",
    tests: "tests.json",
    results: "results.json",
    jokers: "jokers.json",
    envelopes: "envelopes.json",
  };

  /* ------------------------------------------------------------------------
     Modal
     ------------------------------------------------------------------------ */
  let lastFocused = null;

  function openModal(html, onMount) {
    const modal = document.getElementById("editor-modal");
    if (!modal) return null;

    lastFocused = document.activeElement;
    modal.innerHTML = '<div class="card card--pad-lg modal__panel">' + html + "</div>";
    modal.hidden = false;

    const panel = modal.querySelector(".modal__panel");
    if (onMount) onMount(panel);

    const focusable = panel.querySelector("input, select, textarea, button");
    if (focusable) focusable.focus();

    modal.onclick = function (event) {
      if (event.target === modal) closeModal();
    };
    return panel;
  }

  function closeModal() {
    const modal = document.getElementById("editor-modal");
    if (!modal) return;
    modal.hidden = true;
    modal.innerHTML = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
  });

  function confirmDialog(title, text, confirmLabel, danger) {
    return new Promise(function (resolve) {
      openModal(
        '<span class="eyebrow">Bevestigen</span>' +
        '<h2 id="editor-title" class="mt-2">' + util.esc(title) + "</h2>" +
        '<p class="mt-3 muted">' + util.esc(text) + "</p>" +
        '<div class="actionbar">' +
        '<button class="btn btn--ghost" type="button" data-role="cancel">Annuleren</button>' +
        '<button class="btn ' + (danger ? "btn--danger" : "btn--primary") + '" type="button" data-role="ok">' +
        util.esc(confirmLabel || "Bevestigen") + "</button></div>",
        function (panel) {
          panel.querySelector('[data-role="cancel"]').addEventListener("click", function () {
            closeModal();
            resolve(false);
          });
          panel.querySelector('[data-role="ok"]').addEventListener("click", function () {
            closeModal();
            resolve(true);
          });
        }
      );
    });
  }

  /* ------------------------------------------------------------------------
     Schrijftoegang
     ------------------------------------------------------------------------ */
  function askForWriteAccess() {
    openModal(
      '<span class="eyebrow">Schrijftoegang</span>' +
      '<h2 id="editor-title" class="mt-2">Archief ontgrendelen</h2>' +
      '<p class="mt-3 muted">Zonder deze code kun je wel kijken, maar niets opslaan ' +
      "op de server. De code staat in de instellingen van de container " +
      "(<code>WRITE_PASSWORD</code>).</p>" +
      '<div class="stack mt-4">' +
      '<div class="field"><label class="field__label" for="w-user">Gebruiker</label>' +
      '<input class="input" type="text" id="w-user" value="spelleider" autocomplete="username"></div>' +
      '<div class="field"><label class="field__label" for="w-pass">Schrijfcode</label>' +
      '<input class="input" type="password" id="w-pass" autocomplete="current-password"></div>' +
      "</div>" +
      '<div class="actionbar">' +
      '<button class="btn btn--ghost" type="button" data-role="cancel">Later</button>' +
      '<button class="btn btn--primary" type="button" data-role="ok">Ontgrendelen</button></div>',
      function (panel) {
        panel.querySelector('[data-role="cancel"]').addEventListener("click", closeModal);
        panel.querySelector('[data-role="ok"]').addEventListener("click", function () {
          const user = document.getElementById("w-user").value.trim();
          const pass = document.getElementById("w-pass").value;
          if (!user || !pass) return;
          WIDM.data.setCredentials(user, pass);
          closeModal();
          // Meteen uitproberen: alles wat nog lokaal vastzat gaat nu mee.
          WIDM.data.retryPending().then(function () {
            renderStatusBanner();
            WIDM.toast("Archief ontgrendeld.");
          });
        });
      }
    );
  }

  /**
   * Eén balk bovenaan die vertelt of opslaan werkt. Drie toestanden:
   * vergrendeld, alles opgeslagen, of wijzigingen die vastzitten.
   */
  function renderStatusBanner() {
    const host = document.getElementById("sync-banner");
    if (!host) return;

    const unlocked = !!WIDM.data.credentials();
    const stuck = WIDM.data.pending();

    if (!unlocked) {
      host.innerHTML =
        '<div class="card card--danger mb-4"><div class="row row--between">' +
        "<div><span class=\"eyebrow\">Alleen lezen</span>" +
        '<p class="mt-2">Voer de schrijfcode in om wijzigingen op de server op te slaan. ' +
        "Zonder die code blijft alles op dit toestel staan.</p></div>" +
        '<button class="btn btn--primary btn--sm" type="button" data-role="unlock">' +
        WIDM.icon("key", "btn__icon") + "Ontgrendelen</button>" +
        "</div></div>";
      host.querySelector('[data-role="unlock"]').addEventListener("click", askForWriteAccess);
      return;
    }

    if (stuck.length) {
      host.innerHTML =
        '<div class="card card--danger mb-4"><div class="row row--between">' +
        '<div><span class="eyebrow">Niet opgeslagen</span>' +
        '<p class="mt-2">' + stuck.length + " wijziging(en) staan nog op dit toestel: " +
        stuck.map(function (name) {
          return "<strong>" + util.esc(FILE_LABELS[name]) + "</strong>";
        }).join(", ") + ".</p></div>" +
        '<button class="btn btn--primary btn--sm" type="button" data-role="retry">Opnieuw proberen</button>' +
        "</div></div>";
      host.querySelector('[data-role="retry"]').addEventListener("click", function () {
        WIDM.data.retryPending().then(function (done) {
          renderStatusBanner();
          WIDM.toast(done.length ? "Alsnog opgeslagen." : "Opslaan lukt nog steeds niet.", done.length ? "" : "error");
        });
      });
      return;
    }

    host.innerHTML =
      '<div class="notice notice--info mb-4">' + WIDM.icon("check", "notice__icon") +
      '<div><p class="notice__title">Opslaan werkt</p>' +
      '<p class="notice__text">Wijzigingen gaan rechtstreeks naar de server en zijn ' +
      "meteen voor alle spelers zichtbaar.</p></div></div>";
  }

  // De datalaag meldt zelf of een schrijfactie lukte.
  document.addEventListener("widm:saved", renderStatusBanner);
  document.addEventListener("widm:savefailed", function (event) {
    WIDM.toast("Niet opgeslagen: " + event.detail.reason, "error");
    renderStatusBanner();
  });

  /* ------------------------------------------------------------------------
     Inzendingen ophalen
     ------------------------------------------------------------------------ */
  /** Haalt /inbox/ op en voegt nieuwe inzendingen toe aan results. */
  async function collectInbox() {
    let records;
    try {
      records = await WIDM.data.readInbox();
    } catch (error) {
      WIDM.toast("Kan de inbox niet lezen: " + error.message, "error");
      return;
    }

    if (!records.length) {
      WIDM.toast("Geen nieuwe inzendingen gevonden.");
      return;
    }

    let added = 0;
    WIDM.data.update("results", function (list) {
      records.forEach(function (record) {
        const index = list.findIndex(function (entry) {
          return entry.playerId === record.playerId && Number(entry.day) === Number(record.day);
        });
        if (index >= 0) {
          list[index] = record;
        } else {
          list.push(record);
          added += 1;
        }
      });
      return list;
    });

    WIDM.toast(added + " nieuwe inzending(en), " + (records.length - added) + " bijgewerkt.");
    window.setTimeout(function () {
      window.location.reload();
    }, 900);
  }

  /* ------------------------------------------------------------------------
     Gegevenspaneel — back-up, niet meer nodig om te spelen
     ------------------------------------------------------------------------ */
  function renderDataPanel() {
    const host = document.getElementById("data-panel");
    if (!host) return;

    host.innerHTML =
      '<div class="card">' +
      '<div class="card__head"><h2 class="card__title">Gegevens</h2></div>' +
      '<p class="field__hint">Opslaan gaat automatisch naar de server. Deze knoppen ' +
      "zijn voor een back-up of om de inzendingen van spelers binnen te halen.</p>" +
      '<div class="stack stack--tight mt-3">' +
      '<button class="btn btn--block" type="button" data-role="collect">' +
      WIDM.icon("download", "btn__icon") + "Inzendingen ophalen</button>" +
      '<button class="btn btn--block" type="button" data-role="backup">' +
      WIDM.icon("download", "btn__icon") + "Back-up downloaden</button>" +
      '<button class="btn btn--block" type="button" data-role="import">' +
      WIDM.icon("upload", "btn__icon") + "Back-up terugzetten</button>" +
      "</div>" +
      '<input type="file" id="import-input" accept="application/json,.json" hidden>' +
      "</div>";

    host.querySelector('[data-role="collect"]').addEventListener("click", collectInbox);
    host.querySelector('[data-role="backup"]').addEventListener("click", function () {
      WIDM.data.exportBundle();
      WIDM.toast("Back-up gedownload.");
    });

    const input = host.querySelector("#import-input");
    host.querySelector('[data-role="import"]').addEventListener("click", function () {
      input.click();
    });
    input.addEventListener("change", function () {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const imported = WIDM.data.importJson(String(reader.result), file.name.replace(/\.json$/i, ""));
          WIDM.toast("Teruggezet: " + imported.join(", "));
          window.setTimeout(function () {
            window.location.reload();
          }, 800);
        } catch (error) {
          WIDM.toast("Terugzetten mislukt: " + error.message, "error");
        }
      };
      reader.readAsText(file);
      input.value = "";
    });
  }

  /* ------------------------------------------------------------------------
     Overzichtspagina
     ------------------------------------------------------------------------ */
  function renderOverview() {
    const host = document.getElementById("admin-stats");
    if (!host) return;

    const info = G.game();
    const tests = G.tests();
    const open = tests.filter(function (test) {
      return test.available;
    });
    const expected = G.players().length * open.length;
    const submitted = G.results().filter(function (result) {
      return open.some(function (test) {
        return test.day === result.day;
      });
    }).length;

    const jokerTotal = G.jokers().reduce(function (sum, joker) {
      return sum + (Number(joker.count) || 0);
    }, 0);

    host.innerHTML =
      stat("Huidige dag", info.currentDay, "van " + (info.totalDays || tests.length), true) +
      stat("Tot nu toe verdiend", util.money(G.earned()), "geen maximum", true) +
      stat("Nog in het spel", G.activePlayers().length + " / " + G.players().length, null, false) +
      stat("Tests geopend", open.length + " / " + tests.length, null, false) +
      stat("Ingeleverd", submitted + " / " + expected, "voor geopende tests", false) +
      stat("Jokers uitgedeeld", String(jokerTotal), null, false);

    renderActivity();
    renderCoverage();
    renderShortcuts();
  }

  function stat(label, value, note, hero) {
    return (
      '<div class="stat' + (hero ? " stat--hero" : "") + '">' +
      '<span class="stat__label">' + util.esc(label) + "</span>" +
      '<span class="stat__value stat__value--sm numeral' + (hero ? "" : " stat__value--plain") + '">' +
      util.esc(value) + "</span>" +
      (note ? '<span class="stat__note">' + util.esc(note) + "</span>" : "") +
      "</div>"
    );
  }

  function renderActivity() {
    const rows = G.results()
      .slice()
      .sort(function (a, b) {
        return String(b.submittedAt).localeCompare(String(a.submittedAt));
      })
      .slice(0, 8)
      .map(function (result) {
        const player = G.playerById(result.playerId);
        const score = G.scoreResult(result);
        return (
          '<div class="list__item">' +
          '<span class="list__label"><strong>' + util.esc(player ? player.name : result.playerId) +
          "</strong> · dag " + util.esc(result.day) + "</span>" +
          '<span class="list__value">' + score.correct + "/" + score.total +
          (score.jokersUsed ? ' <span class="chip chip--gold">+' + score.jokersUsed + " joker</span>" : "") +
          ' <span class="faint" style="font-size:.78rem">' + util.esc(util.dateTime(result.submittedAt)) + "</span></span>" +
          "</div>"
        );
      })
      .join("");

    util.fill(
      "#admin-activity",
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Recente activiteit</h2>' +
      '<span class="faint" style="font-size:.78rem">Score inclusief jokers</span></div>' +
      (rows ? '<div class="list">' + rows + "</div>"
            : WIDM.emptyState("Nog geen aanwijzingen…", "Er is nog geen enkele test ingeleverd.", "moon")) +
      "</div>"
    );
  }

  function renderCoverage() {
    const players = G.players();
    const rows = G.tests()
      .map(function (test) {
        const count = G.resultsForDay(test.day).length;
        const percentage = players.length ? (count / players.length) * 100 : 0;
        return (
          '<div class="bar"><span class="bar__label">Dag ' + test.day + "</span>" +
          '<div class="bar__track"><div class="bar__fill" style="width:' + percentage + '%"></div></div>' +
          '<span class="bar__value">' + count + "/" + players.length + "</span></div>"
        );
      })
      .join("");

    util.fill(
      "#admin-coverage",
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Ingeleverd per dag</h2></div>' +
      (rows ? '<div class="bars">' + rows + "</div>"
            : WIDM.emptyState("Geen tests", "Maak eerst een testdag aan.", "feather")) +
      "</div>"
    );
  }

  function renderShortcuts() {
    util.fill(
      "#admin-shortcuts",
      '<div class="card">' +
      '<div class="card__head"><h2 class="card__title">Snel naar</h2></div>' +
      '<div class="stack stack--tight">' +
      '<a class="btn btn--block" href="admin-questions.html">Vragen beheren</a>' +
      '<a class="btn btn--block" href="admin-tests.html">Tests openen of sluiten</a>' +
      '<a class="btn btn--block" href="admin-players.html">Spelers, jokers en afvallers</a>' +
      '<a class="btn btn--block" href="admin-archief.html">Enveloppen en codes</a>' +
      '<a class="btn btn--block" href="admin-game.html">Dag en bedrag aanpassen</a>' +
      "</div></div>"
    );
  }

  WIDM.admin = {
    FILE_LABELS: FILE_LABELS,
    openModal: openModal,
    closeModal: closeModal,
    confirm: confirmDialog,
    refreshBanner: renderStatusBanner,
    collectInbox: collectInbox,
    register: function (handler) {
      handlers.push(handler);
    },
  };

  WIDM.page({
    require: "admin",
    run: function (context) {
      renderStatusBanner();
      renderDataPanel();
      renderOverview();
      handlers.forEach(function (handler) {
        handler(context);
      });
      // Nog niet ontgrendeld? Vraag er meteen om; anders lijkt opslaan te werken.
      if (!WIDM.data.credentials()) window.setTimeout(askForWriteAccess, 400);
    },
  });
})(window.WIDM);

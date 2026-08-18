/* ==========================================================================
   admin.js — shared admin shell (sync banner, data panel, modals) and the
   overview page. The individual editors live in admin-editors.js.
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;

  /** Extra page renderers registered by admin-editors.js. */
  const handlers = [];

  const FILE_LABELS = {
    game: "game.json",
    settings: "settings.json",
    players: "players.json",
    questions: "questions.json",
    tests: "tests.json",
    results: "results.json",
  };

  /* ------------------------------------------------------------------------
     Modal helper
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

  /** A themed replacement for window.confirm(). Resolves to a boolean. */
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
     Sync banner — shown whenever the browser holds unsaved changes
     ------------------------------------------------------------------------ */
  function renderSyncBanner() {
    const host = document.getElementById("sync-banner");
    if (!host) return;

    const changed = WIDM.data.changedCollections();
    if (!changed.length) {
      host.innerHTML = "";
      return;
    }

    host.innerHTML =
      '<div class="card card--danger mb-4">' +
      '<div class="row row--between">' +
      "<div>" +
      '<span class="eyebrow">Niet opgeslagen op de server</span>' +
      '<p class="mt-2">Deze browser bevat wijzigingen in ' +
      changed
        .map(function (name) {
          return "<strong>" + util.esc(FILE_LABELS[name]) + "</strong>";
        })
        .join(", ") +
      ". Andere spelers zien ze pas als je de bestanden exporteert en op de server vervangt.</p>" +
      "</div>" +
      '<div class="row">' +
      '<button class="btn btn--primary btn--sm" type="button" data-role="export-changed">' +
      WIDM.icon("download", "btn__icon") + "Exporteer</button>" +
      '<button class="btn btn--danger btn--sm" type="button" data-role="revert-all">Wijzigingen wissen</button>' +
      "</div></div></div>";

    host.querySelector('[data-role="export-changed"]').addEventListener("click", function () {
      const files = WIDM.data.exportChanged();
      WIDM.toast(files.length + " bestand(en) gedownload.");
    });

    host.querySelector('[data-role="revert-all"]').addEventListener("click", async function () {
      const ok = await confirmDialog(
        "Alles terugdraaien?",
        "Alle wijzigingen in deze browser worden gewist, inclusief tests die spelers op dit apparaat hebben ingeleverd. " +
          "De bestanden op de server blijven zoals ze zijn.",
        "Wissen",
        true
      );
      if (!ok) return;
      WIDM.data.revert();
      window.location.reload();
    });
  }

  /* ------------------------------------------------------------------------
     Data panel — export / import
     ------------------------------------------------------------------------ */
  function renderDataPanel() {
    const host = document.getElementById("data-panel");
    if (!host) return;

    const changed = WIDM.data.changedCollections();

    const fileRows = WIDM.data.NAMES.map(function (name) {
      const dirty = changed.includes(name);
      return (
        '<div class="list__item">' +
        '<span class="list__label">' + util.esc(FILE_LABELS[name]) +
        (dirty ? ' <span class="chip chip--red">gewijzigd</span>' : "") + "</span>" +
        '<button class="btn btn--sm btn--ghost" type="button" data-export="' + name + '">Exporteer</button>' +
        "</div>"
      );
    }).join("");

    host.innerHTML =
      '<div class="card">' +
      '<div class="card__head"><h2 class="card__title">Gegevens</h2></div>' +
      '<p class="field__hint">Deze site is statisch: de browser kan de bestanden in <code>data/</code> niet ' +
      "overschrijven. Exporteer wat je wijzigt en zet het bestand op de server.</p>" +
      '<div class="list mt-3">' + fileRows + "</div>" +
      '<div class="actionbar">' +
      '<button class="btn btn--sm" type="button" data-role="export-bundle">' +
      WIDM.icon("download", "btn__icon") + "Volledige back-up</button>" +
      '<button class="btn btn--sm" type="button" data-role="import">' +
      WIDM.icon("upload", "btn__icon") + "Importeren</button>" +
      "</div>" +
      '<input type="file" id="import-input" accept="application/json,.json" hidden>' +
      "</div>";

    util.$$("[data-export]", host).forEach(function (button) {
      button.addEventListener("click", function () {
        WIDM.data.exportFile(button.dataset.export);
        WIDM.toast(FILE_LABELS[button.dataset.export] + " gedownload.");
      });
    });

    host.querySelector('[data-role="export-bundle"]').addEventListener("click", function () {
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
          const hinted = file.name.replace(/\.json$/i, "");
          const imported = WIDM.data.importJson(String(reader.result), hinted);
          WIDM.toast("Geïmporteerd: " + imported.join(", "));
          window.setTimeout(function () {
            window.location.reload();
          }, 700);
        } catch (error) {
          WIDM.toast("Import mislukt: " + error.message, "error");
        }
      };
      reader.readAsText(file);
      input.value = "";
    });
  }

  /* ------------------------------------------------------------------------
     Overview page
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

    host.innerHTML =
      '<div class="stat stat--hero"><span class="stat__label">Huidige dag</span>' +
      '<span class="stat__value numeral">' + util.esc(info.currentDay) + "</span>" +
      '<span class="stat__note">van ' + util.esc(info.totalDays || tests.length) + "</span></div>" +

      '<div class="stat stat--hero"><span class="stat__label">In de pot</span>' +
      '<span class="stat__value numeral">' + util.esc(util.money(info.pot)) + "</span>" +
      '<span class="stat__note">max ' + util.esc(util.money(info.maxPot)) + "</span></div>" +

      '<div class="stat"><span class="stat__label">Spelers</span>' +
      '<span class="stat__value stat__value--sm numeral stat__value--plain">' + G.players().length + "</span></div>" +

      '<div class="stat"><span class="stat__label">Tests geopend</span>' +
      '<span class="stat__value stat__value--sm numeral">' + open.length + " / " + tests.length + "</span></div>" +

      '<div class="stat"><span class="stat__label">Ingeleverd</span>' +
      '<span class="stat__value stat__value--sm numeral">' + submitted + " / " + expected + "</span>" +
      '<span class="stat__note">voor geopende tests</span></div>' +

      '<div class="stat"><span class="stat__label">Vragen</span>' +
      '<span class="stat__value stat__value--sm numeral stat__value--plain">' + G.questions().length + "</span></div>";

    renderActivity();
    renderCoverage();
    renderShortcuts();
  }

  function renderActivity() {
    const recent = G.results()
      .slice()
      .sort(function (a, b) {
        return String(b.submittedAt).localeCompare(String(a.submittedAt));
      })
      .slice(0, 8);

    const rows = recent
      .map(function (result) {
        const player = G.playerById(result.playerId);
        const score = G.scoreResult(result);
        return (
          '<div class="list__item">' +
          '<span class="list__label"><strong>' + util.esc(player ? player.name : result.playerId) +
          "</strong> · dag " + util.esc(result.day) + "</span>" +
          '<span class="list__value">' + score.correct + "/" + score.total +
          ' <span class="faint" style="font-size:.78rem">' + util.esc(util.dateTime(result.submittedAt)) + "</span></span>" +
          "</div>"
        );
      })
      .join("");

    util.fill(
      "#admin-activity",
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Recente activiteit</h2></div>' +
      (rows
        ? '<div class="list">' + rows + "</div>"
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
          '<div class="bar">' +
          '<span class="bar__label">Dag ' + test.day + "</span>" +
          '<div class="bar__track"><div class="bar__fill" style="width:' + percentage + '%"></div></div>' +
          '<span class="bar__value">' + count + "/" + players.length + "</span>" +
          "</div>"
        );
      })
      .join("");

    util.fill(
      "#admin-coverage",
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Ingeleverd per dag</h2></div>' +
      (rows ? '<div class="bars">' + rows + "</div>" : WIDM.emptyState("Geen tests", "Maak eerst een testdag aan.", "feather")) +
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
      '<a class="btn btn--block" href="admin-players.html">Spelers en pincodes</a>' +
      '<a class="btn btn--block" href="admin-game.html">Dag en pot aanpassen</a>' +
      "</div></div>"
    );
  }

  /* ------------------------------------------------------------------------
     Exports + boot
     ------------------------------------------------------------------------ */
  WIDM.admin = {
    FILE_LABELS: FILE_LABELS,
    openModal: openModal,
    closeModal: closeModal,
    confirm: confirmDialog,
    refreshBanner: renderSyncBanner,
    register: function (handler) {
      handlers.push(handler);
    },
  };

  WIDM.page({
    require: "admin",
    run: function (context) {
      renderSyncBanner();
      renderDataPanel();
      renderOverview();
      handlers.forEach(function (handler) {
        handler(context);
      });
    },
  });
})(window.WIDM);

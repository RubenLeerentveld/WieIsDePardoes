/* ==========================================================================
   gate.js — the cover page (index.html) and the sign-in page (login.html)
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;

  /* ------------------------------------------------------------------------
     index.html — cover
     ------------------------------------------------------------------------ */
  function renderCover() {
    const host = document.getElementById("cover-status");
    if (!host) return;

    const info = WIDM.game.game();
    const openTests = WIDM.game.tests().filter(function (test) {
      return test.available;
    }).length;

    host.innerHTML =
      '<span class="eyebrow">' + util.esc(info.edition || "Editie") + "</span>" +
      '<p class="stat__value numeral anim-glow" style="margin-top:.4rem">Dag ' + util.esc(info.currentDay) + "</p>" +
      '<div class="ornament mt-3"><span class="ornament__glyph">✦</span></div>' +
      '<div class="grid grid--2 mt-3" style="gap:.9rem">' +
      '<div><span class="stat__label">In de pot</span>' +
      '<span class="stat__value stat__value--sm numeral">' + util.esc(util.money(info.pot)) + "</span></div>" +
      '<div><span class="stat__label">Tests geopend</span>' +
      '<span class="stat__value stat__value--sm numeral stat__value--plain">' + openTests + " / " + WIDM.game.tests().length + "</span></div>" +
      "</div>";

    // A returning player skips the form entirely.
    const session = WIDM.auth.session();
    const cta = document.getElementById("cover-cta");
    if (session && cta) {
      cta.href = session.kind === "admin" ? "admin.html" : "dashboard.html";
      cta.textContent = "Verder als " + session.name;
    }
  }

  /* ------------------------------------------------------------------------
     login.html — role tabs
     ------------------------------------------------------------------------ */
  function setupTabs() {
    const tabs = util.$$(".segmented__item[role='tab']");
    if (!tabs.length) return;

    function select(id) {
      tabs.forEach(function (tab) {
        const active = tab.id === "tab-" + id;
        tab.setAttribute("aria-selected", String(active));
        const panel = document.getElementById(tab.getAttribute("aria-controls"));
        if (panel) panel.hidden = !active;
      });
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        select(tab.id.replace("tab-", ""));
      });
    });

    // Allow deep links: login.html#spelleider
    const hash = window.location.hash.replace("#", "");
    select(hash === "spelleider" ? "spelleider" : "speler");
  }

  /** Where to go after signing in — honours ?next= set by the auth guard. */
  function destination(fallback) {
    const next = new URLSearchParams(window.location.search).get("next");
    const allowed = [
      "dashboard.html", "test.html", "results.html", "stats.html", "leaderboard.html",
      "admin.html", "admin-questions.html", "admin-tests.html", "admin-players.html", "admin-game.html",
    ];
    return next && allowed.includes(next) ? next : fallback;
  }

  function showError(hostId, title, text) {
    util.fill(document.getElementById(hostId), WIDM.notice(title, text, "danger"));
  }

  function setupForms() {
    const playerForm = document.getElementById("form-player");
    const adminForm = document.getElementById("form-admin");

    if (playerForm) {
      playerForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const name = document.getElementById("player-name").value.trim();
        const pin = document.getElementById("player-pin").value;

        if (!name || !pin) {
          showError("player-error", "Onvolledig", "Vul je naam en pincode in.");
          return;
        }

        const outcome = WIDM.auth.loginPlayer(name, pin);
        if (!outcome.ok) {
          if (outcome.reason === "onbekend") {
            showError("player-error", "Onbekende naam", "Deze naam staat niet in het dossier.");
          } else {
            showError("player-error", "Verkeerde pincode", "De poort blijft gesloten. Probeer het nog eens.");
          }
          document.getElementById("player-pin").value = "";
          document.getElementById("player-pin").focus();
          return;
        }

        window.location.href = destination("dashboard.html");
      });
    }

    if (adminForm) {
      adminForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const pin = document.getElementById("admin-pin").value;

        const outcome = WIDM.auth.loginAdmin(pin);
        if (!outcome.ok) {
          showError("admin-error", "Geen toegang", "Deze code opent het archief niet.");
          document.getElementById("admin-pin").value = "";
          document.getElementById("admin-pin").focus();
          return;
        }

        const next = destination("admin.html");
        window.location.href = next.startsWith("admin") ? next : "admin.html";
      });
    }
  }

  WIDM.page({
    run: function () {
      renderCover();
      setupTabs();
      setupForms();
    },
  });
})(window.WIDM);

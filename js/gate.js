/* ==========================================================================
   gate.js — de voorpagina (index.html) en het inloggen (login.html)

   Voor de opening staat er een aftelklok. Spelers komen er niet langs; de
   spelleider wel, met de toegangscode. Die ontgrendeling geldt alleen voor
   dat ene toestel, zodat je rustig kunt voorbereiden terwijl de rest nog
   buiten staat.
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;

  /* ------------------------------------------------------------------------
     Aftellen
     ------------------------------------------------------------------------ */
  let ticker = null;

  function parts(milliseconds) {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    };
  }

  function unit(value, label) {
    return (
      '<div class="countdown__unit">' +
      '<span class="countdown__value">' + String(value).padStart(2, "0") + "</span>" +
      '<span class="countdown__label">' + label + "</span>" +
      "</div>"
    );
  }

  function renderClock() {
    const host = document.getElementById("countdown");
    if (!host) return;

    const left = WIDM.game.msUntilOpen();

    if (left <= 0) {
      // De poort is opengegaan terwijl iemand stond te kijken.
      window.clearInterval(ticker);
      window.location.reload();
      return;
    }

    const time = parts(left);
    host.innerHTML =
      (time.days ? unit(time.days, "dagen") : "") +
      unit(time.hours, "uur") +
      unit(time.minutes, "min") +
      unit(time.seconds, "sec");
  }

  /** De aftelpagina: geen inloggen, alleen wachten of ontgrendelen. */
  function renderLocked() {
    const opens = WIDM.game.opensAt();
    const when = opens
      ? opens.toLocaleString("nl-NL", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    util.fill(
      "#cover-status",
      '<span class="eyebrow">De poort is nog gesloten</span>' +
      '<div class="countdown mt-3" id="countdown" role="timer" aria-live="off"></div>' +
      '<p class="mt-3 muted">Het onderzoek begint ' + util.esc(when) + ".</p>"
    );

    util.fill(
      "#cover-actions",
      '<p class="whisper text-center">Kom terug wanneer de klok op nul staat.</p>' +
      '<div class="mt-4 text-center">' +
      '<button class="btn btn--ghost btn--sm" type="button" id="bypass-toggle">Ik ben de spelleider</button>' +
      "</div>" +
      '<div id="bypass-panel" hidden>' +
      '<form class="stack mt-4" id="bypass-form">' +
      '<div class="field">' +
      '<label class="field__label" for="bypass-code">Toegangscode</label>' +
      '<input class="input input--pin" type="password" id="bypass-code" ' +
      'inputmode="numeric" autocomplete="current-password" maxlength="12" placeholder="••••">' +
      "</div>" +
      '<div id="bypass-error" role="alert"></div>' +
      '<button class="btn btn--primary btn--block" type="submit">Poort openen</button>' +
      "</form></div>"
    );

    renderClock();
    ticker = window.setInterval(renderClock, 1000);

    const toggle = document.getElementById("bypass-toggle");
    const panel = document.getElementById("bypass-panel");
    toggle.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) document.getElementById("bypass-code").focus();
    });

    document.getElementById("bypass-form").addEventListener("submit", function (event) {
      event.preventDefault();
      const code = document.getElementById("bypass-code").value;

      if (!WIDM.game.unlockWith(code)) {
        util.fill(
          document.getElementById("bypass-error"),
          WIDM.notice("Verkeerde code", "De poort blijft dicht.", "danger")
        );
        document.getElementById("bypass-code").value = "";
        return;
      }

      WIDM.toast("Poort geopend op dit toestel.");
      window.location.href = "login.html";
    });
  }

  /* ------------------------------------------------------------------------
     De gewone voorpagina
     ------------------------------------------------------------------------ */
  function renderOpen() {
    const info = WIDM.game.game();
    const tests = WIDM.game.tests();
    const openTests = tests.filter(function (test) {
      return test.available;
    }).length;

    util.fill(
      "#cover-status",
      '<span class="eyebrow">' + util.esc(info.edition || "Editie") + "</span>" +
      '<p class="stat__value numeral anim-glow" style="margin-top:.4rem">Dag ' + util.esc(info.currentDay) + "</p>" +
      '<div class="ornament mt-3"><span class="ornament__glyph">✦</span></div>' +
      '<div class="grid grid--2 mt-3" style="gap:.9rem">' +
      '<div><span class="stat__label">Tot nu toe verdiend</span>' +
      '<span class="stat__value stat__value--sm numeral">' + util.esc(util.money(WIDM.game.earned())) + "</span></div>" +
      '<div><span class="stat__label">Tests geopend</span>' +
      '<span class="stat__value stat__value--sm numeral stat__value--plain">' +
      openTests + " / " + tests.length + "</span></div>" +
      "</div>"
    );

    const session = WIDM.auth.session();
    const target = session ? (session.kind === "admin" ? "admin.html" : "dashboard.html") : "login.html";
    const label = session ? "Verder als " + session.name : "Betreed het dossier";

    util.fill(
      "#cover-actions",
      '<a class="btn btn--primary btn--lg btn--block" href="' + target + '">' + util.esc(label) + "</a>" +
      '<a class="btn btn--ghost btn--block mt-2" href="login.html#spelleider">Ik ben de spelleider</a>' +
      (WIDM.game.isBypassed() && WIDM.game.isBeforeOpening()
        ? '<p class="field__hint mt-3 text-center">De poort staat nog dicht voor spelers; ' +
          "jij bent doorgelaten met de toegangscode.</p>"
        : "")
    );
  }

  /* ------------------------------------------------------------------------
     login.html
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

    const hash = window.location.hash.replace("#", "");
    select(hash === "spelleider" ? "spelleider" : "speler");
  }

  function destination(fallback) {
    const next = new URLSearchParams(window.location.search).get("next");
    const allowed = [
      "dashboard.html", "test.html", "archief.html", "results.html", "stats.html", "leaderboard.html",
      "admin.html", "admin-questions.html", "admin-tests.html", "admin-players.html",
      "admin-archief.html", "admin-game.html",
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

        // De raaf neemt je mee naar je dossier.
        WIDM.flyAway(function () {
          window.location.href = destination("dashboard.html");
        });
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
      const onCover = !!document.getElementById("cover-status");

      if (onCover) {
        if (WIDM.game.isLocked()) renderLocked();
        else renderOpen();
        return;
      }

      setupTabs();
      setupForms();
    },
  });
})(window.WIDM);

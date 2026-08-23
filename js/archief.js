/* ==========================================================================
   archief.js — verzegelde enveloppen met hints

   De spelleider deelt codes uit (mondeling, op papier, als beloning). Wie een
   code invoert, opent die envelop en houdt hem open. Welke enveloppen jij hebt
   geopend staat in localStorage van je eigen toestel; raak je dat kwijt, dan
   voer je de code gewoon opnieuw in.
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;

  let session = null;

  function storageKey() {
    return "widm.opened." + session.id;
  }

  function openedIds() {
    try {
      const raw = window.localStorage.getItem(storageKey());
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return [];
    }
  }

  function markOpened(id) {
    const list = openedIds();
    if (!list.includes(id)) {
      list.push(id);
      window.localStorage.setItem(storageKey(), JSON.stringify(list));
    }
  }

  /** Codes zijn hoofdletterongevoelig en spaties doen niet mee. */
  function normalise(code) {
    return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function sealedCard(envelope) {
    return (
      '<div class="card card--pad-lg" data-envelope="' + util.esc(envelope.id) + '">' +
      '<div class="row row--between">' +
      '<span class="eyebrow eyebrow--dim">Dag ' + util.esc(envelope.day) + "</span>" +
      '<span class="stamp">Verzegeld</span>' +
      "</div>" +
      '<h2 class="mt-3">' + util.esc(envelope.title) + "</h2>" +
      '<p class="whisper mt-2">Deze envelop is gesloten. Ken jij de code?</p>' +
      '<form class="row mt-4" data-form="' + util.esc(envelope.id) + '">' +
      '<div class="field" style="flex:1;min-width:12rem">' +
      '<label class="visually-hidden" for="code-' + util.esc(envelope.id) + '">Code</label>' +
      '<input class="input" type="text" id="code-' + util.esc(envelope.id) + '" ' +
      'autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code">' +
      "</div>" +
      '<button class="btn btn--primary" type="submit">Openen</button>' +
      "</form>" +
      '<div data-error="' + util.esc(envelope.id) + '" role="alert"></div>' +
      "</div>"
    );
  }

  function openCard(envelope) {
    return (
      '<div class="paper paper--tilt-l anim-rise" data-envelope="' + util.esc(envelope.id) + '">' +
      '<span class="tape"></span>' +
      '<p style="font-family:var(--font-display);font-size:.64rem;letter-spacing:.24em;' +
      'text-transform:uppercase">Dag ' + util.esc(envelope.day) + " · geopend</p>" +
      '<h2 class="mt-2" style="font-size:1.3rem">' + util.esc(envelope.title) + "</h2>" +
      '<p class="whisper" style="color:#6a2231;font-size:1.35rem;line-height:1.4;margin-top:.6rem">' +
      util.esc(envelope.hint) + "</p>" +
      "</div>"
    );
  }

  function render() {
    const host = document.getElementById("envelopes");
    const opened = openedIds();

    const available = G.envelopes().filter(function (envelope) {
      return envelope.available;
    });

    if (!available.length) {
      host.innerHTML =
        '<div class="card card--pad-lg">' +
        WIDM.emptyState("Het archief is leeg", "Er liggen nog geen enveloppen klaar.", "feather") +
        "</div>";
      return;
    }

    host.innerHTML = available
      .map(function (envelope) {
        return opened.includes(envelope.id) ? openCard(envelope) : sealedCard(envelope);
      })
      .join("");

    bind(available);
  }

  function bind(available) {
    util.$$("[data-form]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();

        const id = form.dataset.form;
        const envelope = available.find(function (entry) {
          return entry.id === id;
        });
        if (!envelope) return;

        const input = document.getElementById("code-" + id);
        const errorHost = document.querySelector('[data-error="' + id + '"]');

        if (normalise(input.value) === normalise(envelope.code)) {
          markOpened(id);
          WIDM.toast("De envelop is open.");
          render();
          return;
        }

        util.fill(errorHost, WIDM.notice("Verkeerde code", "Deze envelop blijft gesloten.", "danger"));
        input.value = "";
        input.focus();
      });
    });
  }

  WIDM.page({
    require: "player",
    run: function (context) {
      session = context.session;
      render();
    },
  });
})(window.WIDM);

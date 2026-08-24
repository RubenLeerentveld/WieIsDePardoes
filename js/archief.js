/* ==========================================================================
   archief.js — verzegelde enveloppen met hints

   De spelleider deelt codes uit (mondeling, op papier, als beloning). Wie een
   code invoert, opent die envelop en houdt hem open.

   Wat je hebt geopend staat op de server, in /inbox/opened-<speler>.json, en
   daarnaast op je eigen toestel. Zo volgen je hints je naar een andere
   telefoon en overleven ze een gewiste browser. Ligt de server er even uit,
   dan werkt de lokale kopie gewoon door en wordt hij later bijgewerkt.
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

  function writeLocal(ids) {
    try {
      window.localStorage.setItem(storageKey(), JSON.stringify(ids));
    } catch (error) {
      /* vol of geblokkeerd; de server heeft hem dan nog wel */
    }
  }

  function markOpened(id) {
    const list = openedIds();
    if (list.includes(id)) return;

    list.push(id);
    writeLocal(list);

    WIDM.data.saveOpened(session.id, list).catch(function () {
      // Niet erg: lokaal staat hij open, en bij de volgende sync gaat hij mee.
      console.warn("[WIDM] geopende envelop niet naar de server gestuurd");
    });
  }

  /**
   * Haalt op wat er op de server staat en voegt dat samen met wat dit toestel
   * al wist. Samenvoegen in plaats van overschrijven, zodat er nooit iets
   * verdwijnt als iemand op twee toestellen bezig is geweest.
   */
  async function syncOpened() {
    let remote = null;
    try {
      remote = await WIDM.data.readOpened(session.id);
    } catch (error) {
      return; // server onbereikbaar: lokale lijst blijft leidend
    }

    const local = openedIds();
    if (!remote) {
      // Nog niets op de server; wat hier staat alvast wegschrijven.
      if (local.length) {
        WIDM.data.saveOpened(session.id, local).catch(function () {});
      }
      return;
    }

    const merged = remote.slice();
    local.forEach(function (id) {
      if (!merged.includes(id)) merged.push(id);
    });

    writeLocal(merged);
    if (merged.length !== remote.length) {
      WIDM.data.saveOpened(session.id, merged).catch(function () {});
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
          openWithFlourish(form.closest("[data-envelope]"), envelope);
          return;
        }

        util.fill(errorHost, WIDM.notice("Verkeerde code", "Deze envelop blijft gesloten.", "danger"));
        input.value = "";
        input.focus();
      });
    });
  }

  /**
   * De envelop gaat open: de flap klapt omhoog, het zegel springt weg en de
   * brief schuift eruit. Daarna nemen we de gewone kaart over, zodat de
   * pagina daarna een rustige lay-out heeft.
   */
  function openWithFlourish(card, envelope) {
    if (!card || util.prefersReducedMotion()) {
      WIDM.toast("De envelop is open.");
      render();
      return;
    }

    card.outerHTML =
      '<div class="envelope" data-envelope="' + util.esc(envelope.id) + '">' +
      '<div class="envelope__letter">' +
      '<p style="font-family:var(--font-display);font-size:.62rem;letter-spacing:.24em;' +
      'text-transform:uppercase">Dag ' + util.esc(envelope.day) + "</p>" +
      '<p class="whisper" style="color:#6a2231;font-size:1.2rem;line-height:1.35;margin-top:.3rem">' +
      util.esc(envelope.hint) + "</p></div>" +
      '<div class="envelope__body"></div>' +
      '<div class="envelope__flap"></div>' +
      '<div class="envelope__seal"></div>' +
      "</div>";

    window.setTimeout(function () {
      WIDM.toast("De envelop is open.");
      render();
    }, 1500);
  }

  WIDM.page({
    require: "player",
    run: async function (context) {
      session = context.session;
      await syncOpened();
      render();
    },
  });
})(window.WIDM);

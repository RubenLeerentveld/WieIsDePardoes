/* ==========================================================================
   executie.js — het moment waarop iemand afvalt

   Nagebouwd naar de televisieversie: de spelleider typt een naam, er valt een
   stilte, en dan kleurt het scherm. Groen betekent door, rood betekent einde.

   De spelleider stelt de uitslag van tevoren in en geeft daarna de telefoon
   uit handen. Vanaf dat moment is er niets meer te bedienen en verraadt het
   scherm ook niets — pas na de stilte verschijnt de uitslag.
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;
  const admin = WIDM.admin;

  // Hoe lang de stilte duurt. Lang genoeg om ongemakkelijk te worden.
  const SUSPENSE_MS = 5000;

  let timer = null;

  /* ------------------------------------------------------------------------
     Voorbereiden
     ------------------------------------------------------------------------ */
  function renderSetup() {
    const players = G.players();
    const host = document.getElementById("executie-setup");

    if (!players.length) {
      host.innerHTML =
        '<div class="card card--pad-lg">' +
        WIDM.emptyState("Geen spelers", "Voeg eerst spelers toe bij Spelers.", "feather") +
        "</div>";
      return;
    }

    host.innerHTML =
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Wie is aan de beurt?</h2></div>' +

      '<div class="field">' +
      '<label class="field__label" for="ex-name">Naam</label>' +
      '<input class="input" type="text" id="ex-name" list="ex-players" autocomplete="off" ' +
      'autocapitalize="words" spellcheck="false" placeholder="Typ een naam">' +
      '<datalist id="ex-players">' +
      players
        .map(function (player) {
          return '<option value="' + util.esc(player.name) + '"></option>';
        })
        .join("") +
      "</datalist>" +
      '<span class="field__hint">Zoals in de uitzending: typ de naam voluit.</span>' +
      "</div>" +

      '<div id="ex-error" class="mt-3"></div>' +

      '<div class="card__head mt-4"><h2 class="card__title">De uitslag</h2></div>' +
      '<p class="field__hint">Kies nu, voordat je de telefoon uit handen geeft. ' +
      "Daarna is er niets meer te zien of te bedienen tot de uitslag valt.</p>" +

      '<div class="grid grid--2 mt-3">' +
      '<button class="btn btn--lg" type="button" data-verdict="door">Door</button>' +
      '<button class="btn btn--lg btn--danger" type="button" data-verdict="af">Afgevallen</button>' +
      "</div>" +

      '<p class="field__hint mt-4">Bij <strong>afgevallen</strong> wordt de speler meteen ' +
      "op het bord bijgewerkt. Bij <strong>door</strong> verandert er niets.</p>" +
      "</div>" +

      '<div class="card card--plain mt-4">' +
      '<div class="card__head"><h2 class="card__title">Nog in het spel</h2></div>' +
      '<div class="row">' +
      players
        .map(function (player) {
          return (
            '<span class="chip ' + (player.eliminated ? "chip--red" : "chip--green") + '">' +
            util.esc(player.name) + (player.eliminated ? " · af" : "") +
            "</span>"
          );
        })
        .join("") +
      "</div></div>";

    util.$$("[data-verdict]", host).forEach(function (button) {
      button.addEventListener("click", function () {
        start(button.dataset.verdict);
      });
    });
  }

  /** Naam los typen mag; hoofdletters en spaties doen niet mee. */
  function findPlayer(typed) {
    const needle = String(typed || "").trim().toLowerCase();
    if (!needle) return null;
    return G.players().find(function (player) {
      return player.name.toLowerCase() === needle;
    }) || null;
  }

  /* ------------------------------------------------------------------------
     De ceremonie
     ------------------------------------------------------------------------ */
  function start(verdict) {
    const typed = document.getElementById("ex-name").value;
    const player = findPlayer(typed);

    if (!player) {
      util.fill(
        "#ex-error",
        WIDM.notice("Onbekende naam", "Deze speler staat niet in het dossier.", "danger")
      );
      return;
    }

    util.fill("#ex-error", "");
    suspense(player, verdict);
  }

  function suspense(player, verdict) {
    const stage = document.getElementById("ceremony");
    stage.hidden = false;
    stage.className = "ceremony ceremony--suspense";

    stage.innerHTML =
      '<div class="ceremony__inner">' +
      '<span class="ceremony__eyebrow">Het oordeel</span>' +
      '<p class="ceremony__name">' + util.esc(player.name) + "</p>" +
      '<div class="ceremony__pulse" aria-hidden="true"></div>' +
      '<p class="ceremony__whisper">Kijk naar het scherm.</p>' +
      "</div>";

    // Geen knoppen tijdens de stilte: er valt niets te bedienen en niets af
    // te lezen. De telefoon kan de kring rond.
    timer = window.setTimeout(function () {
      reveal(player, verdict);
    }, SUSPENSE_MS);
  }

  function reveal(player, verdict) {
    const stage = document.getElementById("ceremony");
    const survived = verdict === "door";

    stage.className = "ceremony " + (survived ? "ceremony--door" : "ceremony--af");

    stage.innerHTML =
      '<div class="ceremony__inner ceremony__inner--reveal">' +
      (player.photo
        ? '<span class="seal ceremony__seal"><img src="' + util.esc(player.photo) + '" alt=""></span>'
        : "") +
      '<p class="ceremony__name">' + util.esc(player.name) + "</p>" +
      '<p class="ceremony__verdict">' + (survived ? "Door" : "Afgevallen") + "</p>" +
      '<p class="ceremony__whisper">' +
      (survived
        ? "Je onderzoek gaat verder."
        : "Jouw spel eindigt hier. Pardoes loopt door.") +
      "</p>" +
      '<button class="btn btn--ghost mt-5" type="button" data-role="close">Sluiten</button>' +
      "</div>";

    if (!survived) markEliminated(player);

    stage.querySelector('[data-role="close"]').addEventListener("click", close);
  }

  function markEliminated(player) {
    const day = G.game().currentDay || 1;

    WIDM.data.update("players", function (list) {
      const entry = list.find(function (item) {
        return item.id === player.id;
      });
      if (entry) {
        entry.eliminated = true;
        entry.eliminatedDay = day;
      }
      return list;
    });
  }

  function close() {
    window.clearTimeout(timer);
    const stage = document.getElementById("ceremony");
    stage.hidden = true;
    stage.innerHTML = "";
    stage.className = "ceremony";

    document.getElementById("ex-name").value = "";
    admin.refreshBanner();
    renderSetup();
  }

  // Ontsnappen kan alleen als de uitslag al gevallen is; tijdens de stilte
  // niet, anders drukt iemand hem per ongeluk weg.
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    const stage = document.getElementById("ceremony");
    if (!stage || stage.hidden) return;
    if (stage.classList.contains("ceremony--suspense")) return;
    close();
  });

  admin.register(function () {
    if (document.getElementById("executie-setup")) renderSetup();
  });
})(window.WIDM);

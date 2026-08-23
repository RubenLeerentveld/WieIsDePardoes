/* ==========================================================================
   dashboard.js — het dossier van de speler

   Belangrijk: hier staat nergens een score. Een speler die weet hoeveel hij
   goed had, weet ook of zijn verdenking klopt — en dat is precies het spel.
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;

  const WHISPERS = [
    "Iedereen heeft iets te verbergen.",
    "De waarheid ligt ergens verborgen.",
    "Pardoes kijkt mee.",
    "Let op wie er wegkijkt.",
    "Niet alles wat je zag, gebeurde ook.",
  ];

  function renderWelcome(session) {
    const info = G.game();
    const whisper = WHISPERS[(Number(info.currentDay) || 0) % WHISPERS.length];

    util.fill(
      "#welcome",
      '<span class="eyebrow">' + util.esc(info.edition || "Dossier") + " · " + util.esc(info.location || "") + "</span>" +
      '<h1 class="page-head__title">Welkom terug, ' + util.esc(session.name) + ".</h1>" +
      '<p class="whisper mt-2">' + util.esc(whisper) + "</p>"
    );
  }

  function renderStatus(session) {
    const info = G.game();
    const done = G.completedCount(session.id);
    const total = G.tests().length;
    const active = G.activePlayers().length;

    util.fill(
      "#status",
      '<div class="stat stat--hero">' +
      '<span class="stat__label">Huidige dag</span>' +
      '<span class="stat__value numeral">Dag ' + util.esc(info.currentDay) + "</span>" +
      '<span class="stat__note">van ' + util.esc(info.totalDays || total) + " speeldagen</span>" +
      "</div>" +

      '<div class="stat stat--hero">' +
      '<span class="stat__label">Tot nu toe verdiend</span>' +
      '<span class="stat__value numeral anim-glow">' + util.esc(util.money(G.earned())) + "</span>" +
      '<span class="stat__note">door de hele groep</span>' +
      "</div>" +

      '<div class="stat">' +
      '<span class="stat__label">Tests voltooid</span>' +
      '<span class="stat__value stat__value--sm numeral">' + done + " / " + total + "</span>" +
      '<span class="stat__note">door jou ingeleverd</span>' +
      "</div>" +

      '<div class="stat">' +
      '<span class="stat__label">Nog in het spel</span>' +
      '<span class="stat__value stat__value--sm numeral">' + active + "</span>" +
      '<span class="stat__note">van ' + G.players().length + " onderzoekers</span>" +
      "</div>"
    );
  }

  function renderTestCard(session) {
    const host = document.getElementById("test-card");
    const openTest = G.openTestFor(session.id);
    const info = G.game();

    if (openTest) {
      const count = G.questionsForTest(openTest).length;
      host.innerHTML =
        '<div class="card card--accent card--pad-lg anim-rise">' +
        '<div class="row row--between">' +
        '<span class="eyebrow">Dag ' + util.esc(openTest.day) + " · " + util.esc(openTest.title) + "</span>" +
        '<span class="chip chip--gold chip--live"><span class="chip__dot"></span>Geopend</span>' +
        "</div>" +
        '<h2 class="mt-3">De test is geopend</h2>' +
        '<p class="whisper mt-2">' + util.esc(openTest.subtitle || "Durf jij Pardoes onder ogen te komen?") + "</p>" +
        '<div class="row mt-4">' +
        '<span class="chip">' + count + " vragen</span>" +
        '<span class="chip">1 kans</span>' +
        '<span class="chip">Geen tijdslimiet</span>' +
        "</div>" +
        '<a class="btn btn--primary btn--lg btn--block mt-4" href="test.html?dag=' + util.esc(openTest.day) + '">' +
        "Start de test" + WIDM.icon("arrowRight", "btn__icon") + "</a>" +
        "</div>";
      return;
    }

    const today = G.testForDay(info.currentDay);
    const status = today ? G.testStatus(today.day, session.id) : "locked";

    if (status === "done") {
      const result = G.resultFor(session.id, today.day);
      host.innerHTML =
        '<div class="card card--pad-lg anim-rise">' +
        '<div class="row row--between">' +
        '<span class="eyebrow">Dag ' + util.esc(today.day) + " · " + util.esc(today.title) + "</span>" +
        '<span class="chip chip--green"><span class="chip__dot"></span>Ingeleverd</span>' +
        "</div>" +
        '<h2 class="mt-3">Je waarnemingen zijn verzegeld</h2>' +
        '<p class="mt-2 muted">Ingeleverd op ' + util.esc(util.dateTime(result.submittedAt)) + ".</p>" +
        '<p class="whisper mt-3">Wat je zag, weet alleen jij. En Pardoes.</p>' +
        '<a class="btn btn--block mt-4" href="archief.html">Naar het archief</a>' +
        "</div>";
      return;
    }

    if (status === "empty") {
      host.innerHTML =
        '<div class="card card--pad-lg">' +
        WIDM.emptyState("Het dossier is leeg", "Er zijn nog geen vragen voor deze dag opgesteld.", "feather") +
        "</div>";
      return;
    }

    host.innerHTML =
      '<div class="card card--pad-lg anim-rise">' +
      '<div class="row row--between">' +
      '<span class="eyebrow eyebrow--dim">Dag ' + util.esc(info.currentDay) + "</span>" +
      '<span class="chip">Verzegeld</span>' +
      "</div>" +
      '<h2 class="mt-3">Deze test is nog verzegeld</h2>' +
      '<p class="whisper mt-2">Kom terug wanneer de spelleider het zegel verbreekt.</p>' +
      '<a class="btn btn--block mt-4" href="archief.html">Naar het archief</a>' +
      "</div>";
  }

  /**
   * Vervangt het oude "Jouw onderzoek" met scorebalken. Toont alleen nog wát
   * je hebt vastgelegd, niet hoe goed.
   */
  function renderLogbook(session) {
    const rows = G.tests()
      .map(function (test) {
        const result = G.resultFor(session.id, test.day);
        let mark;
        if (result) {
          mark = '<span class="chip chip--green">Vastgelegd</span>';
        } else if (test.available) {
          mark = '<span class="chip chip--gold">Open</span>';
        } else {
          mark = '<span class="chip">Verzegeld</span>';
        }
        return (
          '<div class="list__item">' +
          '<span class="list__label"><strong>Dag ' + test.day + "</strong> · " +
          util.esc(test.title || "") + "</span>" +
          mark +
          "</div>"
        );
      })
      .join("");

    util.fill(
      "#progress-card",
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Jouw logboek</h2>' +
      '<span class="faint" style="font-size:.8rem">Wat je hebt vastgelegd</span></div>' +
      '<div class="list">' + rows + "</div>" +
      '<p class="field__hint mt-3">Hoeveel je goed had blijft geheim tot het einde. ' +
      "Zo weet niemand of zijn verdenking klopt.</p>" +
      "</div>"
    );
  }

  /** Wie er nog in het spel zit — geen ranglijst, geen punten. */
  function renderRemaining(session) {
    const settings = G.settings();
    const host = document.getElementById("rank-card");

    if (!settings.showEliminationBoard) {
      host.innerHTML =
        '<div class="card">' +
        '<div class="card__head"><h2 class="card__title">Het bord</h2></div>' +
        WIDM.emptyState("Afgedekt", "De spelleider houdt het bord voorlopig gesloten.", "lock") +
        "</div>";
      return;
    }

    const rows = G.players()
      .map(function (player) {
        const me = player.id === session.id;
        const out = !!player.eliminated;
        return (
          '<div class="rank__row' + (me ? " rank__row--me" : "") + '"' +
          (out ? ' style="opacity:.45"' : "") + ">" +
          '<span class="rank__pos numeral">' + (out ? "✕" : "•") + "</span>" +
          '<span class="avatar avatar--sm rank__avatar">' + util.esc(G.initialsOf(player)) + "</span>" +
          '<span class="rank__body"><span class="rank__name">' + util.esc(player.name) + "</span>" +
          '<span class="rank__meta">' +
          (out ? "Afgevallen op dag " + util.esc(player.eliminatedDay || "?") : "Nog in het spel") +
          "</span></span>" +
          "</div>"
        );
      })
      .join("");

    host.innerHTML =
      '<div class="card">' +
      '<div class="card__head"><h2 class="card__title">Nog in het spel</h2>' +
      '<a href="leaderboard.html" style="font-size:.8rem">Het bord</a></div>' +
      '<div class="rank">' + rows + "</div>" +
      "</div>";
  }

  function renderNote(session) {
    const settings = G.settings();
    const spot = G.blindSpot(session.id);
    const player = G.playerById(session.id);

    const meter = settings.showBlindSpot
      ? '<div class="card card--plain mt-4">' +
        '<div class="card__head"><h2 class="card__title">Blinde vlek</h2></div>' +
        '<div class="suspicion">' +
        '<div class="suspicion__track"><div class="suspicion__fill" style="width:' + spot.level + '%"></div></div>' +
        '<span class="suspicion__label">' + util.esc(spot.label) + "</span>" +
        "</div>" +
        '<p class="field__hint mt-2">Een grove indruk van hoeveel er langs je heen ging. ' +
        "Reken er niets aan af.</p>" +
        "</div>"
      : "";

    util.fill(
      "#note-card",
      '<div class="paper paper--tilt-r" style="margin-top:.6rem">' +
      '<span class="pin"></span>' +
      '<p style="font-family:var(--font-display);font-size:.66rem;letter-spacing:.24em;text-transform:uppercase">Notitie</p>' +
      '<p class="whisper" style="color:#6a2231;font-size:1.3rem;line-height:1.35;margin-top:.4rem">' +
      util.esc(player && player.note ? player.note : "Nog geen aantekeningen over jou.") +
      "</p></div>" +
      meter
    );
  }

  WIDM.page({
    require: "player",
    run: function (context) {
      const session = context.session;
      renderWelcome(session);
      renderStatus(session);
      renderTestCard(session);
      renderLogbook(session);
      renderRemaining(session);
      renderNote(session);
    },
  });
})(window.WIDM);

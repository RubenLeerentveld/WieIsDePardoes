/* ==========================================================================
   dashboard.js — the player's dossier
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;

  /** Rotating opening line, so the dossier does not read the same every day. */
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
    const stats = G.playerStats(session.id);
    const settings = G.settings();
    const rank = G.rankOf(session.id);
    const progress = G.potProgress();

    const rankTile = settings.showRankToPlayers && rank
      ? '<div class="stat">' +
        '<span class="stat__label">Jouw plaats</span>' +
        '<span class="stat__value stat__value--sm numeral">' + rank + "e</span>" +
        '<span class="stat__note">van ' + G.players().length + " onderzoekers</span>" +
        "</div>"
      : '<div class="stat">' +
        '<span class="stat__label">Jouw plaats</span>' +
        '<span class="stat__value stat__value--sm numeral stat__value--plain">—</span>' +
        '<span class="stat__note">nog niet vrijgegeven</span>' +
        "</div>";

    util.fill(
      "#status",
      '<div class="stat stat--hero">' +
      '<span class="stat__label">Huidige dag</span>' +
      '<span class="stat__value numeral">Dag ' + util.esc(info.currentDay) + "</span>" +
      '<span class="stat__note">van ' + util.esc(info.totalDays || G.tests().length) + " speeldagen</span>" +
      "</div>" +

      '<div class="stat stat--hero">' +
      '<span class="stat__label">In de pot</span>' +
      '<span class="stat__value numeral anim-glow">' + util.esc(util.money(info.pot)) + "</span>" +
      '<div class="progress mt-2"><div class="progress__fill" style="width:' + progress + '%"></div></div>' +
      '<span class="stat__note">' + progress + "% van " + util.esc(util.money(info.maxPot)) + "</span>" +
      "</div>" +

      '<div class="stat">' +
      '<span class="stat__label">Jouw punten</span>' +
      '<span class="stat__value stat__value--sm numeral">' + stats.totalCorrect + "</span>" +
      '<span class="stat__note">' + stats.testsTaken + " van " + stats.testsTotal + " tests voltooid</span>" +
      "</div>" +

      rankTile
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

    // Nothing open — explain why, in the right tone.
    const today = G.testForDay(info.currentDay);
    const status = today ? G.testStatus(today.day, session.id) : "locked";

    if (status === "done") {
      const result = G.resultFor(session.id, today.day);
      const score = G.scoreResult(result);
      const visible = today.resultsVisible && G.settings().showScoresToPlayers;

      host.innerHTML =
        '<div class="card card--pad-lg anim-rise">' +
        '<div class="row row--between">' +
        '<span class="eyebrow">Dag ' + util.esc(today.day) + " · " + util.esc(today.title) + "</span>" +
        '<span class="chip chip--green"><span class="chip__dot"></span>Voltooid</span>' +
        "</div>" +
        '<h2 class="mt-3">De test is voltooid</h2>' +
        '<p class="mt-2 muted">Ingeleverd op ' + util.esc(util.dateTime(result.submittedAt)) +
        " · " + util.esc(util.duration(result.durationSeconds)) + " minuten.</p>" +
        (visible
          ? '<p class="stat__value numeral mt-3">' + score.correct + " / " + score.total + "</p>" +
            '<p class="whisper">' + util.esc(G.verdict(score.percentage)) + "</p>"
          : '<div class="notice mt-4">' + WIDM.icon("lock", "notice__icon") +
            '<div><p class="notice__title">Nog verzegeld</p>' +
            '<p class="notice__text">De spelleider heeft de uitslag van deze dag nog niet vrijgegeven.</p></div></div>') +
        '<a class="btn btn--block mt-4" href="results.html?dag=' + util.esc(today.day) + '">Bekijk je uitslagen</a>' +
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
      '<a class="btn btn--block mt-4" href="stats.html">Bekijk je statistieken</a>' +
      "</div>";
  }

  function renderProgress(session) {
    const stats = G.playerStats(session.id);

    const rows = stats.byDay
      .map(function (row) {
        if (!row.done) {
          const label = row.available ? "Nog niet voltooid" : "Verzegeld";
          return (
            '<div class="bar bar--empty">' +
            '<span class="bar__label">Dag ' + row.day + "</span>" +
            '<div class="bar__track"></div>' +
            '<span class="bar__value">' + label + "</span>" +
            "</div>"
          );
        }
        const percentage = row.score.total ? (row.score.correct / row.score.total) * 100 : 0;
        return (
          '<div class="bar">' +
          '<span class="bar__label">Dag ' + row.day + "</span>" +
          '<div class="bar__track"><div class="bar__fill" style="width:' + percentage + '%"></div></div>' +
          '<span class="bar__value">' + row.score.correct + "/" + row.score.total + "</span>" +
          "</div>"
        );
      })
      .join("");

    util.fill(
      "#progress-card",
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Jouw onderzoek</h2>' +
      '<span class="faint" style="font-size:.8rem">' + stats.totalCorrect + " punten</span></div>" +
      '<div class="bars">' + rows + "</div>" +
      '<a class="btn btn--sm btn--ghost mt-4" href="stats.html">Volledige statistieken</a>' +
      "</div>"
    );
  }

  function renderRank(session) {
    const settings = G.settings();
    const host = document.getElementById("rank-card");

    if (!settings.leaderboardVisible) {
      host.innerHTML =
        '<div class="card">' +
        '<div class="card__head"><h2 class="card__title">Klassement</h2></div>' +
        WIDM.emptyState("Nog geen klassement", "De spelleider houdt de stand voorlopig geheim.", "lock") +
        "</div>";
      return;
    }

    const top = G.standings().slice(0, 4);
    const rows = top
      .map(function (row) {
        const me = row.player.id === session.id;
        return (
          '<div class="rank__row' + (me ? " rank__row--me" : "") + '">' +
          '<span class="rank__pos numeral">' + util.pad2(row.rank) + "</span>" +
          '<span class="avatar avatar--sm rank__avatar">' + util.esc(G.initialsOf(row.player)) + "</span>" +
          '<span class="rank__body"><span class="rank__name">' + util.esc(row.player.name) + "</span></span>" +
          '<span class="rank__score numeral">' + row.points + "</span>" +
          "</div>"
        );
      })
      .join("");

    host.innerHTML =
      '<div class="card">' +
      '<div class="card__head"><h2 class="card__title">Klassement</h2>' +
      '<a href="leaderboard.html" style="font-size:.8rem">Alles</a></div>' +
      '<div class="rank">' + rows + "</div>" +
      "</div>";
  }

  function renderNote(session) {
    const stats = G.playerStats(session.id);
    const suspicion = G.suspicion(stats.percentage);
    const settings = G.settings();

    // A pinned handwritten note, plus the suspicion meter in its own dark card
    // so the light-on-dark meter styling stays readable.
    const meter = settings.showSuspicionMeter
      ? '<div class="card card--plain mt-4">' +
        '<div class="card__head"><h2 class="card__title">Blinde vlek</h2></div>' +
        '<div class="suspicion">' +
        '<div class="suspicion__track"><div class="suspicion__fill" style="width:' + suspicion.level + '%"></div></div>' +
        '<span class="suspicion__label">' + util.esc(suspicion.label) + "</span>" +
        "</div>" +
        '<p class="field__hint mt-2">Hoeveel er langs je heen ging, over alle tests samen.</p>' +
        "</div>"
      : "";

    util.fill(
      "#note-card",
      '<div class="paper paper--tilt-r" style="margin-top:.6rem">' +
      '<span class="pin"></span>' +
      '<p style="font-family:var(--font-display);font-size:.66rem;letter-spacing:.24em;text-transform:uppercase">Notitie</p>' +
      '<p class="whisper" style="color:#6a2231;font-size:1.3rem;line-height:1.35;margin-top:.4rem">' +
      "Je hebt " + stats.totalCorrect + " van " + (stats.totalQuestions || 0) + " waarnemingen juist. " +
      (stats.testsTaken ? "Blijf kijken." : "Je hebt nog niets vastgelegd.") +
      "</p>" +
      "</div>" +
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
      renderProgress(session);
      renderRank(session);
      renderNote(session);
    },
  });
})(window.WIDM);

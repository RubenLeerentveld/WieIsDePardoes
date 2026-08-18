/* ==========================================================================
   results.js — per-day results for the signed-in player
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;
  const LETTERS = ["A", "B", "C", "D", "E", "F"];

  let session = null;
  let activeDay = null;

  function renderTabs() {
    const tests = G.tests();
    util.fill(
      "#day-tabs",
      tests
        .map(function (test) {
          const done = !!G.resultFor(session.id, test.day);
          return (
            '<button class="segmented__item" type="button" role="tab" data-day="' + test.day + '" ' +
            'aria-selected="' + (test.day === activeDay) + '">' +
            "Dag " + test.day + (done ? " ✦" : "") +
            "</button>"
          );
        })
        .join("")
    );

    util.$$("#day-tabs .segmented__item").forEach(function (tab) {
      tab.addEventListener("click", function () {
        activeDay = Number(tab.dataset.day);
        render();
      });
    });
  }

  /** The score header for one day. */
  function scoreCard(test, result) {
    const score = G.scoreResult(result);
    const settings = G.settings();
    const visible = test.resultsVisible && settings.showScoresToPlayers;
    const rank = G.dayStandings(test.day).find(function (row) {
      return row.player.id === session.id;
    });

    if (!visible) {
      return (
        '<div class="card card--pad-lg anim-rise">' +
        '<div class="row row--between">' +
        '<span class="eyebrow">Dag ' + util.esc(test.day) + " · " + util.esc(test.title) + "</span>" +
        '<span class="stamp">Verzegeld</span>' +
        "</div>" +
        '<h2 class="mt-4">Je uitslag is nog verzegeld</h2>' +
        '<p class="whisper mt-2">Ingeleverd op ' + util.esc(util.dateTime(result.submittedAt)) + "." +
        "</p>" +
        '<p class="muted mt-3">De spelleider geeft deze dag later vrij.</p>' +
        "</div>"
      );
    }

    return (
      '<div class="card card--accent card--pad-lg anim-rise">' +
      '<div class="row row--between">' +
      '<span class="eyebrow">Dag ' + util.esc(test.day) + " · " + util.esc(test.title) + "</span>" +
      '<span class="chip chip--green"><span class="chip__dot"></span>Voltooid</span>' +
      "</div>" +
      '<div class="grid grid--3 mt-4">' +
      '<div class="stat stat--hero"><span class="stat__label">Score</span>' +
      '<span class="stat__value numeral">' + score.correct + " / " + score.total + "</span></div>" +
      '<div class="stat"><span class="stat__label">Fout</span>' +
      '<span class="stat__value stat__value--sm numeral stat__value--plain">' + score.wrong + "</span></div>" +
      '<div class="stat"><span class="stat__label">Tijd</span>' +
      '<span class="stat__value stat__value--sm numeral stat__value--plain">' +
      util.esc(util.duration(result.durationSeconds)) + "</span></div>" +
      (rank
        ? '<div class="stat"><span class="stat__label">Plaats deze dag</span>' +
          '<span class="stat__value stat__value--sm numeral">' + rank.rank + "e</span></div>"
        : "") +
      "</div>" +
      '<p class="whisper mt-4 text-center">' + util.esc(G.verdict(score.percentage)) + "</p>" +
      "</div>"
    );
  }

  /** Question-by-question breakdown. */
  function reviewCard(test, result) {
    const settings = G.settings();
    const visible = test.resultsVisible && settings.showScoresToPlayers;
    if (!visible) return "";

    const rows = G.reviewResult(result)
      .map(function (entry, index) {
        const reveal = settings.showCorrectAnswers;
        const given = entry.given >= 0 ? LETTERS[entry.given] + ". " + entry.question.answers[entry.given] : "Niet beantwoord";

        return (
          '<div class="review__item">' +
          '<span class="review__num numeral">' + util.pad2(index + 1) + "</span>" +
          '<div class="review__q">' + util.esc(entry.question.question) +
          '<div class="faint" style="font-size:.82rem">Jouw antwoord: ' + util.esc(given) + "</div>" +
          (reveal && !entry.isCorrect
            ? '<div class="gold" style="font-size:.82rem">Juist: ' +
              util.esc(LETTERS[entry.correct] + ". " + entry.question.answers[entry.correct]) + "</div>"
            : "") +
          (reveal && entry.question.explanation
            ? '<div class="faint" style="font-size:.82rem;font-style:italic">' +
              util.esc(entry.question.explanation) + "</div>"
            : "") +
          "</div>" +
          '<span class="review__mark ' + (entry.isCorrect ? "review__mark--ok" : "review__mark--no") + '">' +
          (entry.isCorrect ? "Juist" : "Fout") + "</span>" +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Vraag voor vraag</h2>' +
      (settings.showCorrectAnswers
        ? '<span class="chip chip--gold">Antwoorden vrijgegeven</span>'
        : '<span class="chip">Antwoorden nog geheim</span>') +
      "</div>" +
      '<div class="review">' + rows + "</div>" +
      "</div>"
    );
  }

  /** Everyone's score for this day, once the day is released. */
  function dayBoardCard(test) {
    if (!test.resultsVisible || !G.settings().leaderboardVisible) return "";

    const rows = G.dayStandings(test.day);
    if (!rows.length) return "";

    return (
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Deze dag</h2></div>' +
      '<div class="rank">' +
      rows
        .map(function (row) {
          const me = row.player.id === session.id;
          return (
            '<div class="rank__row' + (me ? " rank__row--me" : "") + '">' +
            '<span class="rank__pos numeral">' + util.pad2(row.rank) + "</span>" +
            '<span class="avatar avatar--sm rank__avatar">' + util.esc(G.initialsOf(row.player)) + "</span>" +
            '<span class="rank__body"><span class="rank__name">' + util.esc(row.player.name) + "</span>" +
            '<span class="rank__meta">' + util.esc(util.duration(row.result.durationSeconds)) + " min</span></span>" +
            '<span class="rank__score numeral">' + row.score.correct + "/" + row.score.total + "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div></div>"
    );
  }

  function render() {
    renderTabs();

    const test = G.testForDay(activeDay);
    const host = document.getElementById("result-body");

    if (!test) {
      host.innerHTML = '<div class="card card--pad-lg">' +
        WIDM.emptyState("Geen dossier", "Deze dag bestaat niet.", "moon") + "</div>";
      return;
    }

    const result = G.resultFor(session.id, test.day);

    if (!result) {
      const status = G.testStatus(test.day, session.id);
      host.innerHTML =
        '<div class="card card--pad-lg">' +
        WIDM.emptyState(
          status === "open" ? "Nog niets vastgelegd" : "Nog geen aanwijzingen…",
          status === "open"
            ? "De test van deze dag staat nog open voor je."
            : "Deze dag heb je niet vastgelegd. Het dossier blijft leeg.",
          status === "open" ? "eye" : "moon"
        ) +
        (status === "open"
          ? '<div class="row mt-4" style="justify-content:center">' +
            '<a class="btn btn--primary" href="test.html?dag=' + util.esc(test.day) + '">Start de test</a></div>'
          : "") +
        "</div>";
      return;
    }

    host.innerHTML = scoreCard(test, result) + reviewCard(test, result) + dayBoardCard(test);
  }

  WIDM.page({
    require: "player",
    run: function (context) {
      session = context.session;

      const requested = Number(new URLSearchParams(window.location.search).get("dag"));
      const tests = G.tests();
      if (!tests.length) {
        util.fill(
          "#result-body",
          '<div class="card card--pad-lg">' +
          WIDM.emptyState("Het archief is leeg", "Er zijn nog geen testdagen aangemaakt.", "feather") +
          "</div>"
        );
        return;
      }

      // Default to the most recent day the player actually completed.
      const done = G.resultsForPlayer(session.id);
      activeDay = requested && G.testForDay(requested)
        ? requested
        : done.length
          ? done[done.length - 1].day
          : tests[0].day;

      render();
    },
  });
})(window.WIDM);

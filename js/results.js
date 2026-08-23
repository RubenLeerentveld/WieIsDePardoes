/* ==========================================================================
   results.js — je eigen ingeleverde antwoorden, per dag

   Geen scores. Deze pagina laat zien wát je hebt geantwoord, zodat je je
   eigen redenering kunt teruglezen. Of het goed was hoor je pas als de
   spelleider aan het eind alles vrijgeeft (settings.revealEverything).
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;
  const LETTERS = ["A", "B", "C", "D", "E", "F"];

  let session = null;
  let activeDay = null;

  function renderTabs() {
    util.fill(
      "#day-tabs",
      G.tests()
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

  function headerCard(test, result) {
    return (
      '<div class="card card--pad-lg anim-rise">' +
      '<div class="row row--between">' +
      '<span class="eyebrow">Dag ' + util.esc(test.day) + " · " + util.esc(test.title) + "</span>" +
      '<span class="chip chip--green"><span class="chip__dot"></span>Vastgelegd</span>' +
      "</div>" +
      '<h2 class="mt-3">Wat je hebt vastgelegd</h2>' +
      '<p class="mt-2 muted">Ingeleverd op ' + util.esc(util.dateTime(result.submittedAt)) +
      " · " + util.esc(util.duration(result.durationSeconds)) + " minuten.</p>" +
      '<p class="whisper mt-3">Hoeveel je goed had blijft geheim. Anders wist je of je op de juiste weg zit.</p>' +
      "</div>"
    );
  }

  function answersCard(test, result) {
    const reveal = !!G.settings().revealEverything;

    const rows = G.reviewResult(result)
      .map(function (entry, index) {
        const given = entry.given >= 0
          ? LETTERS[entry.given] + ". " + entry.question.answers[entry.given]
          : "Niet beantwoord";

        // Alleen bij de eindonthulling laten we zien wat juist was.
        const verdict = reveal
          ? '<span class="review__mark ' + (entry.isCorrect ? "review__mark--ok" : "review__mark--no") + '">' +
            (entry.isCorrect ? "Juist" : "Fout") + "</span>"
          : '<span class="review__mark faint">Verzegeld</span>';

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
          "</div>" + verdict +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Vraag voor vraag</h2>' +
      (reveal
        ? '<span class="chip chip--gold">Alles vrijgegeven</span>'
        : '<span class="chip">Antwoorden nog geheim</span>') +
      "</div>" +
      '<div class="review">' + rows + "</div>" +
      "</div>"
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

    host.innerHTML = headerCard(test, result) + answersCard(test, result);
  }

  WIDM.page({
    require: "player",
    run: function (context) {
      session = context.session;

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

      const requested = Number(new URLSearchParams(window.location.search).get("dag"));
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

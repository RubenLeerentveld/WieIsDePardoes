/* ==========================================================================
   test.js — the test runner

   Answers are held in memory while the test is in progress and only written
   to storage on submit. A half-finished test is deliberately NOT resumable:
   one sitting, one chance.
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;
  const LETTERS = ["A", "B", "C", "D", "E", "F"];

  const state = {
    session: null,
    test: null,
    questions: [],
    answers: [],
    index: 0,
    startedAt: 0,
    direction: "next",
    finished: false,
  };

  const root = function () {
    return document.getElementById("test-root");
  };

  /* ------------------------------------------------------------------------
     Blocking screens
     ------------------------------------------------------------------------ */
  function screenBlocked(title, text, actionHtml) {
    root().innerHTML =
      '<div class="card card--pad-lg anim-rise text-center">' +
      WIDM.icon("lock", "empty__glyph") +
      "<h1>" + util.esc(title) + "</h1>" +
      '<p class="whisper mt-3">' + util.esc(text) + "</p>" +
      '<div class="row mt-5" style="justify-content:center">' + (actionHtml || "") + "</div>" +
      "</div>";
  }

  /* ------------------------------------------------------------------------
     Intro
     ------------------------------------------------------------------------ */
  /**
   * Heeft de speler een joker voor deze dag, dan zeggen we dat eerlijk. Een
   * joker is een beloning, geen geheim — en het verraadt niets over je score.
   */
  function jokerNotice() {
    const jokers = G.jokersFor(state.session.id, state.test.day);
    if (!jokers) return "";

    return (
      '<div class="paper paper--tilt-l anim-rise" style="margin-top:1.3rem">' +
      '<span class="pin pin--gold"></span>' +
      '<p style="font-family:var(--font-display);font-size:.64rem;letter-spacing:.24em;' +
      'text-transform:uppercase">' + (jokers === 1 ? "Joker" : jokers + " jokers") + "</p>" +
      '<p class="whisper" style="color:#6a2231;font-size:1.4rem;line-height:1.35;margin-top:.4rem">' +
      (jokers === 1
        ? "Je hebt een joker. Eén fout antwoord telt straks toch als goed."
        : "Je hebt " + jokers + " jokers. Evenveel foute antwoorden tellen straks toch als goed.") +
      "</p></div>"
    );
  }

  function screenIntro() {
    const count = state.questions.length;
    root().innerHTML =
      '<div class="card card--accent card--pad-lg anim-rise text-center">' +
      '<span class="eyebrow">Dag ' + util.esc(state.test.day) + " · " + util.esc(state.test.title) + "</span>" +
      '<h1 class="mt-3">De test is geopend</h1>' +
      '<p class="whisper mt-3">' + util.esc(state.test.subtitle || "Durf jij Pardoes onder ogen te komen?") + "</p>" +
      '<div class="ornament mt-4"><span class="ornament__glyph">✦</span></div>' +
      '<div class="grid grid--3 mt-4">' +
      '<div class="stat"><span class="stat__label">Vragen</span><span class="stat__value stat__value--sm numeral">' + count + "</span></div>" +
      '<div class="stat"><span class="stat__label">Kansen</span><span class="stat__value stat__value--sm numeral">1</span></div>' +
      '<div class="stat"><span class="stat__label">Tijd</span><span class="stat__value stat__value--sm numeral stat__value--plain">Vrij</span></div>' +
      "</div>" +
      '<p class="mt-4 muted">Je antwoorden worden pas vastgelegd als je de test inlevert. ' +
      "Daarna kun je ze niet meer wijzigen.</p>" +
      '<button class="btn btn--primary btn--lg btn--block mt-4" type="button" id="start-test">Start de test</button>' +
      '<a class="btn btn--ghost btn--block mt-2" href="dashboard.html">Nog niet</a>' +
      "</div>" +
      jokerNotice();

    document.getElementById("start-test").addEventListener("click", function () {
      state.startedAt = Date.now();
      state.index = 0;
      state.direction = "next";
      screenQuestion();
    });
  }

  /* ------------------------------------------------------------------------
     Question view
     ------------------------------------------------------------------------ */
  function meterHtml() {
    return (
      '<div class="test-meter" role="presentation">' +
      state.questions
        .map(function (question, index) {
          let modifier = "";
          if (index === state.index) modifier = " test-meter__tick--current";
          else if (state.answers[index] !== null) modifier = " test-meter__tick--done";
          return '<span class="test-meter__tick' + modifier + '"></span>';
        })
        .join("") +
      "</div>"
    );
  }

  function screenQuestion() {
    const question = state.questions[state.index];
    const total = state.questions.length;
    const isLast = state.index === total - 1;
    const answered = state.answers.filter(function (value) {
      return value !== null;
    }).length;

    const options = question.answers
      .map(function (answer, index) {
        const selected = state.answers[state.index] === index;
        return (
          '<button class="option" type="button" data-choice="' + index + '" aria-pressed="' + selected + '">' +
          '<span class="option__key">' + LETTERS[index] + "</span>" +
          "<span>" + util.esc(answer) + "</span>" +
          "</button>"
        );
      })
      .join("");

    root().innerHTML =
      '<div class="card card--pad-lg">' +
      meterHtml() +
      '<div class="row row--between">' +
      '<span class="eyebrow">Vraag ' + (state.index + 1) + " / " + total + "</span>" +
      '<span class="chip">' + answered + " beantwoord</span>" +
      "</div>" +
      '<div class="' + (state.direction === "next" ? "anim-q-next" : "anim-q-prev") + '">' +
      '<h1 class="question mt-3">' + util.esc(question.question) + "</h1>" +
      '<div class="options" id="options">' + options + "</div>" +
      "</div>" +
      '<div class="actionbar">' +
      '<button class="btn btn--ghost" type="button" id="prev-question"' + (state.index === 0 ? " disabled" : "") + ">" +
      WIDM.icon("arrowLeft", "btn__icon") + "Vorige</button>" +
      (isLast
        ? '<button class="btn btn--primary" type="button" id="finish-test">Test inleveren</button>'
        : '<button class="btn btn--primary" type="button" id="next-question">Volgende' +
          WIDM.icon("arrowRight", "btn__icon") + "</button>") +
      "</div>" +
      '<p class="field__hint mt-3">Tip: kies met de toetsen A–D of 1–4.</p>' +
      "</div>";

    bindQuestionEvents();
  }

  function bindQuestionEvents() {
    util.$$("#options .option").forEach(function (button) {
      button.addEventListener("click", function () {
        choose(Number(button.dataset.choice));
      });
    });

    const previous = document.getElementById("prev-question");
    if (previous) {
      previous.addEventListener("click", function () {
        go(-1);
      });
    }

    const next = document.getElementById("next-question");
    if (next) {
      next.addEventListener("click", function () {
        go(1);
      });
    }

    const finish = document.getElementById("finish-test");
    if (finish) {
      finish.addEventListener("click", openConfirm);
    }
  }

  function choose(choice) {
    state.answers[state.index] = choice;
    util.$$("#options .option").forEach(function (button) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.choice) === choice));
    });
    // Refresh the progress meter without re-animating the question.
    const meter = util.$(".test-meter");
    if (meter) meter.outerHTML = meterHtml();
  }

  function go(step) {
    const target = state.index + step;
    if (target < 0 || target >= state.questions.length) return;
    state.direction = step > 0 ? "next" : "prev";
    state.index = target;
    screenQuestion();
    window.scrollTo({ top: 0, behavior: util.prefersReducedMotion() ? "auto" : "smooth" });
  }

  /* ------------------------------------------------------------------------
     Keyboard control
     ------------------------------------------------------------------------ */
  function onKeyDown(event) {
    if (state.finished || !state.startedAt) return;
    if (event.target.closest("input, textarea, select")) return;
    if (!document.getElementById("options")) return;

    const key = event.key.toUpperCase();
    const byLetter = LETTERS.indexOf(key);
    const byNumber = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
    const choice = byLetter >= 0 ? byLetter : byNumber;

    if (choice >= 0 && choice < state.questions[state.index].answers.length) {
      event.preventDefault();
      choose(choice);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }
  }

  /* ------------------------------------------------------------------------
     Confirmation + submit
     ------------------------------------------------------------------------ */
  function openConfirm() {
    const modal = document.getElementById("confirm-modal");
    const missing = state.answers.filter(function (value) {
      return value === null;
    }).length;

    document.getElementById("confirm-text").textContent = missing
      ? "Je hebt " + missing + (missing === 1 ? " vraag" : " vragen") + " nog niet beantwoord. " +
        "Onbeantwoorde vragen tellen als fout."
      : "Alle vragen zijn beantwoord. Hierna kun je niets meer wijzigen.";

    modal.hidden = false;
    document.getElementById("confirm-cancel").focus();
  }

  function closeConfirm() {
    document.getElementById("confirm-modal").hidden = true;
  }

  function submit() {
    closeConfirm();

    const seconds = Math.round((Date.now() - state.startedAt) / 1000);
    // Unanswered questions become -1: never equal to a correct index.
    const answers = state.answers.map(function (value) {
      return value === null ? -1 : value;
    });

    let result;
    try {
      result = G.submitTest(state.session.id, state.test.day, answers, seconds);
    } catch (error) {
      WIDM.toast(error.message, "error");
      return;
    }

    state.finished = true;
    screenDone(result);

    // Naar de server, zodat de spelleider hem meteen heeft. Lukt dat niet,
    // dan blijft de inzending lokaal staan en meldt de site dat eerlijk.
    WIDM.data.submitToInbox(result).catch(function (error) {
      console.warn("[WIDM] inzending niet verstuurd", error);
      WIDM.toast("Je test is opgeslagen op dit toestel, maar nog niet verstuurd.", "error");
    });
  }

  /* ------------------------------------------------------------------------
     Completion
     ------------------------------------------------------------------------ */
  function screenDone(result) {
    root().innerHTML =
      '<div class="card card--accent card--pad-lg anim-rise text-center">' +
      '<div class="anim-seal" style="display:inline-block"><span class="stamp stamp--gold">Ingeleverd</span></div>' +
      '<h1 class="mt-4">De test is voltooid</h1>' +
      '<p class="muted mt-2">Dag ' + util.esc(state.test.day) + " · " + util.esc(state.test.title) +
      " · " + util.esc(util.duration(result.durationSeconds)) + " minuten</p>" +
      '<div class="ornament mt-4"><span class="ornament__glyph">✦</span></div>' +
      '<p class="whisper mt-4">Je waarnemingen zijn verzegeld.</p>' +
      '<p class="muted mt-2">Je hoort niet hoeveel je goed had. Anders zou je weten ' +
      "of je verdenking klopt — en dat is nou juist het spel.</p>" +
      '<div class="stack mt-5">' +
      '<a class="btn btn--primary btn--block" href="dashboard.html">Terug naar je dossier</a>' +
      '<a class="btn btn--ghost btn--block" href="archief.html">Naar het archief</a>' +
      "</div></div>";

    WIDM.toast("Test van dag " + state.test.day + " ingeleverd.");
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function chooseTest(session) {
    const requested = new URLSearchParams(window.location.search).get("dag");
    if (requested) {
      return G.testForDay(Number(requested));
    }
    return G.openTestFor(session.id);
  }

  WIDM.page({
    require: "player",
    run: function (context) {
      state.session = context.session;

      const test = chooseTest(context.session);
      if (!test) {
        screenBlocked(
          "Er wacht geen test",
          "Er staat op dit moment geen test voor je open.",
          '<a class="btn" href="dashboard.html">Terug naar je dossier</a>'
        );
        return;
      }

      state.test = test;
      state.questions = G.questionsForTest(test);

      const status = G.testStatus(test.day, context.session.id);

      if (status === "done") {
        screenBlocked(
          "Deze test is al voltooid",
          "Je hebt deze dag al vastgelegd. Eén kans, weet je nog?",
          '<a class="btn" href="results.html?dag=' + util.esc(test.day) + '">Naar je uitslag</a>' +
          '<a class="btn btn--ghost" href="dashboard.html">Dossier</a>'
        );
        return;
      }

      if (status === "locked") {
        screenBlocked(
          "Deze test is nog verzegeld",
          "Kom terug wanneer de spelleider het zegel verbreekt.",
          '<a class="btn" href="dashboard.html">Terug naar je dossier</a>'
        );
        return;
      }

      if (status === "empty") {
        screenBlocked(
          "Het dossier is leeg",
          "Er zijn nog geen vragen voor deze dag opgesteld.",
          '<a class="btn" href="dashboard.html">Terug naar je dossier</a>'
        );
        return;
      }

      state.answers = state.questions.map(function () {
        return null;
      });

      screenIntro();

      document.addEventListener("keydown", onKeyDown);
      document.getElementById("confirm-cancel").addEventListener("click", closeConfirm);
      document.getElementById("confirm-submit").addEventListener("click", submit);
      document.getElementById("confirm-modal").addEventListener("click", function (event) {
        if (event.target === event.currentTarget) closeConfirm();
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeConfirm();
      });

      // Guard against losing answers to an accidental back-swipe.
      window.addEventListener("beforeunload", function (event) {
        if (state.startedAt && !state.finished) {
          event.preventDefault();
          event.returnValue = "";
        }
      });
    },
  });
})(window.WIDM);

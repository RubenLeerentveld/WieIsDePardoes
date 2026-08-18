/* ==========================================================================
   admin-editors.js — the four editors: questions, tests, players, game.

   Every write goes through WIDM.data.update(), which clones the collection,
   applies the change and stores the result in the local overlay. Nothing here
   touches the JSON files on the server; that is the export step.
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;
  const admin = WIDM.admin;
  const LETTERS = ["A", "B", "C", "D"];

  const CATEGORIES = ["gedrag", "opdracht", "feiten", "uitspraken", "geld", "locatie"];

  /** Re-render the current editor and update the "unsaved" banner. */
  function afterWrite(render) {
    admin.refreshBanner();
    render();
  }

  function fieldRow(label, inputHtml, hint) {
    return (
      '<div class="field">' +
      '<label class="field__label" for="' + inputHtml.match(/id="([^"]+)"/)[1] + '">' + util.esc(label) + "</label>" +
      inputHtml +
      (hint ? '<span class="field__hint">' + util.esc(hint) + "</span>" : "") +
      "</div>"
    );
  }

  /* ========================================================================
     1. QUESTIONS
     ======================================================================== */
  const questionsEditor = {
    filterDay: "all",
    search: "",

    init() {
      const daySelect = document.getElementById("filter-day");
      const search = document.getElementById("filter-search");

      const days = G.tests().map(function (test) {
        return test.day;
      });

      daySelect.innerHTML =
        '<option value="all">Alle dagen</option>' +
        days
          .map(function (day) {
            return '<option value="' + day + '">Dag ' + day + "</option>";
          })
          .join("");

      daySelect.addEventListener("change", function () {
        questionsEditor.filterDay = daySelect.value;
        questionsEditor.render();
      });

      search.addEventListener("input", function () {
        questionsEditor.search = search.value.toLowerCase();
        questionsEditor.render();
      });

      document.getElementById("add-question").addEventListener("click", function () {
        questionsEditor.openEditor(null);
      });

      this.render();
    },

    visible() {
      const all = G.questions();
      return all.filter(function (question) {
        const matchesDay =
          questionsEditor.filterDay === "all" || Number(question.day) === Number(questionsEditor.filterDay);
        const matchesSearch =
          !questionsEditor.search ||
          question.question.toLowerCase().includes(questionsEditor.search) ||
          question.answers.join(" ").toLowerCase().includes(questionsEditor.search);
        return matchesDay && matchesSearch;
      });
    },

    render() {
      const host = document.getElementById("questions-list");
      const list = questionsEditor.visible();

      if (!list.length) {
        host.innerHTML =
          '<div class="card card--pad-lg">' +
          WIDM.emptyState("Geen vragen gevonden", "Pas je filter aan of stel een nieuwe vraag op.", "feather") +
          "</div>";
        return;
      }

      const rows = list
        .map(function (question) {
          return (
            "<tr>" +
            '<td class="numeral">' + util.esc(question.id) + "</td>" +
            "<td>" + util.esc(question.day) + "</td>" +
            '<td style="white-space:normal;min-width:22rem">' + util.esc(question.question) + "</td>" +
            '<td><span class="chip chip--gold">' + LETTERS[question.correctAnswer] + "</span> " +
            util.esc(question.answers[question.correctAnswer] || "—") + "</td>" +
            "<td>" + util.esc(question.category || "—") + "</td>" +
            '<td><div class="table__actions">' +
            '<button class="btn btn--sm btn--ghost" type="button" data-preview="' + util.esc(question.id) + '" title="Voorbeeld">' +
            WIDM.icon("eye", "btn__icon") + "</button>" +
            '<button class="btn btn--sm btn--ghost" type="button" data-edit="' + util.esc(question.id) + '" title="Bewerken">' +
            WIDM.icon("pen", "btn__icon") + "</button>" +
            '<button class="btn btn--sm btn--ghost" type="button" data-duplicate="' + util.esc(question.id) + '" title="Dupliceren">' +
            WIDM.icon("copy", "btn__icon") + "</button>" +
            '<button class="btn btn--sm btn--danger" type="button" data-delete="' + util.esc(question.id) + '" title="Verwijderen">' +
            WIDM.icon("trash", "btn__icon") + "</button>" +
            "</div></td></tr>"
          );
        })
        .join("");

      host.innerHTML =
        '<div class="card card--plain">' +
        '<div class="card__head"><h2 class="card__title">' + list.length + " vragen</h2></div>" +
        '<div class="table-wrap"><table class="table">' +
        "<thead><tr><th>ID</th><th>Dag</th><th>Vraag</th><th>Juist</th><th>Categorie</th><th></th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table></div></div>";

      util.$$("[data-edit]", host).forEach(function (button) {
        button.addEventListener("click", function () {
          questionsEditor.openEditor(G.questionById(button.dataset.edit));
        });
      });

      util.$$("[data-preview]", host).forEach(function (button) {
        button.addEventListener("click", function () {
          questionsEditor.preview(G.questionById(button.dataset.preview));
        });
      });

      util.$$("[data-duplicate]", host).forEach(function (button) {
        button.addEventListener("click", function () {
          questionsEditor.duplicate(button.dataset.duplicate);
        });
      });

      util.$$("[data-delete]", host).forEach(function (button) {
        button.addEventListener("click", function () {
          questionsEditor.remove(button.dataset.delete);
        });
      });
    },

    /** q101 … q411 — keeps the existing numbering scheme going. */
    nextId() {
      const numbers = G.questions()
        .map(function (question) {
          const match = /^q(\d+)$/.exec(question.id);
          return match ? Number(match[1]) : 0;
        })
        .filter(Boolean);
      const next = (numbers.length ? Math.max.apply(null, numbers) : 100) + 1;
      return "q" + next;
    },

    openEditor(question) {
      const isNew = !question;
      const model = question || {
        id: questionsEditor.nextId(),
        day: Number(questionsEditor.filterDay) || G.game().currentDay || 1,
        question: "",
        answers: ["", "", "", ""],
        correctAnswer: 0,
        explanation: "",
        category: "gedrag",
      };

      const answerFields = [0, 1, 2, 3]
        .map(function (index) {
          return fieldRow(
            "Antwoord " + LETTERS[index],
            '<input class="input" type="text" id="q-answer-' + index + '" value="' +
              util.esc(model.answers[index] || "") + '">'
          );
        })
        .join("");

      admin.openModal(
        '<span class="eyebrow">' + (isNew ? "Nieuwe vraag" : "Vraag " + util.esc(model.id)) + "</span>" +
        '<h2 id="editor-title" class="mt-2">' + (isNew ? "Vraag opstellen" : "Vraag bewerken") + "</h2>" +
        '<div class="stack mt-4">' +
        '<div class="grid grid--2">' +
        fieldRow("Dag", '<input class="input" type="number" min="1" id="q-day" value="' + util.esc(model.day) + '">') +
        fieldRow(
          "Categorie",
          '<select class="select" id="q-category">' +
            CATEGORIES.map(function (category) {
              return '<option value="' + category + '"' +
                (category === model.category ? " selected" : "") + ">" + category + "</option>";
            }).join("") +
            "</select>"
        ) +
        "</div>" +
        fieldRow("Vraag", '<textarea class="textarea" id="q-text">' + util.esc(model.question) + "</textarea>") +
        answerFields +
        fieldRow(
          "Juiste antwoord",
          '<select class="select" id="q-correct">' +
            LETTERS.map(function (letter, index) {
              return '<option value="' + index + '"' +
                (index === model.correctAnswer ? " selected" : "") + ">" + letter + "</option>";
            }).join("") +
            "</select>"
        ) +
        fieldRow(
          "Toelichting",
          '<textarea class="textarea" id="q-explanation">' + util.esc(model.explanation || "") + "</textarea>",
          "Optioneel. Wordt alleen getoond als je antwoorden vrijgeeft."
        ) +
        '<div id="q-error"></div>' +
        "</div>" +
        '<div class="actionbar">' +
        '<button class="btn btn--ghost" type="button" data-role="cancel">Annuleren</button>' +
        '<button class="btn btn--primary" type="button" data-role="save">Opslaan</button>' +
        "</div>",
        function (panel) {
          panel.querySelector('[data-role="cancel"]').addEventListener("click", admin.closeModal);
          panel.querySelector('[data-role="save"]').addEventListener("click", function () {
            questionsEditor.save(model.id, isNew);
          });
        }
      );
    },

    save(id, isNew) {
      const answers = [0, 1, 2, 3].map(function (index) {
        return document.getElementById("q-answer-" + index).value.trim();
      });
      const text = document.getElementById("q-text").value.trim();
      const day = Number(document.getElementById("q-day").value);

      if (!text || answers.some(function (answer) { return !answer; }) || !day) {
        util.fill(
          "#q-error",
          WIDM.notice("Onvolledig", "Vul de vraag, alle vier de antwoorden en een dag in.", "danger")
        );
        return;
      }

      const record = {
        id: id,
        day: day,
        category: document.getElementById("q-category").value,
        question: text,
        answers: answers,
        correctAnswer: Number(document.getElementById("q-correct").value),
        explanation: document.getElementById("q-explanation").value.trim(),
      };

      WIDM.data.update("questions", function (list) {
        const index = list.findIndex(function (question) {
          return question.id === id;
        });
        if (index >= 0) list[index] = record;
        else list.push(record);
        return list;
      });

      // A brand-new question joins its day's test automatically.
      if (isNew) {
        WIDM.data.update("tests", function (tests) {
          const test = tests.find(function (entry) {
            return Number(entry.day) === day;
          });
          if (test && Array.isArray(test.questionIds) && !test.questionIds.includes(id)) {
            test.questionIds.push(id);
          }
          return tests;
        });
      }

      admin.closeModal();
      WIDM.toast(isNew ? "Vraag toegevoegd." : "Vraag bijgewerkt.");
      afterWrite(questionsEditor.render);
    },

    duplicate(id) {
      const original = G.questionById(id);
      if (!original) return;
      const copy = WIDM.data.clone(original);
      copy.id = questionsEditor.nextId();
      copy.question = original.question + " (kopie)";

      WIDM.data.update("questions", function (list) {
        list.push(copy);
        return list;
      });

      WIDM.toast("Vraag gedupliceerd als " + copy.id + ".");
      afterWrite(questionsEditor.render);
    },

    async remove(id) {
      const question = G.questionById(id);
      if (!question) return;

      const ok = await admin.confirm(
        "Vraag verwijderen?",
        "“" + question.question + "” verdwijnt uit het dossier en uit elke test waarin hij staat.",
        "Verwijderen",
        true
      );
      if (!ok) return;

      WIDM.data.update("questions", function (list) {
        return list.filter(function (entry) {
          return entry.id !== id;
        });
      });

      WIDM.data.update("tests", function (tests) {
        tests.forEach(function (test) {
          if (Array.isArray(test.questionIds)) {
            test.questionIds = test.questionIds.filter(function (entry) {
              return entry !== id;
            });
          }
        });
        return tests;
      });

      WIDM.toast("Vraag verwijderd.");
      afterWrite(questionsEditor.render);
    },

    /** Shows the question exactly as a player sees it. */
    preview(question) {
      if (!question) return;
      admin.openModal(
        '<span class="eyebrow">Voorbeeld · dag ' + util.esc(question.day) + "</span>" +
        '<h2 id="editor-title" class="question mt-3">' + util.esc(question.question) + "</h2>" +
        '<div class="options">' +
        question.answers
          .map(function (answer, index) {
            const correct = index === question.correctAnswer;
            return (
              '<button class="option' + (correct ? " option--correct" : "") + '" type="button" disabled>' +
              '<span class="option__key">' + LETTERS[index] + "</span><span>" + util.esc(answer) + "</span>" +
              (correct ? '<span class="review__mark review__mark--ok" style="margin-left:auto">Juist</span>' : "") +
              "</button>"
            );
          })
          .join("") +
        "</div>" +
        (question.explanation
          ? '<p class="field__hint mt-3">' + util.esc(question.explanation) + "</p>"
          : "") +
        '<div class="actionbar"><button class="btn btn--ghost" type="button" data-role="close">Sluiten</button></div>',
        function (panel) {
          panel.querySelector('[data-role="close"]').addEventListener("click", admin.closeModal);
        }
      );
    },
  };

  /* ========================================================================
     2. TESTS
     ======================================================================== */
  const testsEditor = {
    init() {
      document.getElementById("add-test").addEventListener("click", function () {
        testsEditor.openEditor(null);
      });
      this.render();
    },

    render() {
      const host = document.getElementById("tests-list");
      const tests = G.tests();

      if (!tests.length) {
        host.innerHTML =
          '<div class="card card--pad-lg">' +
          WIDM.emptyState("Geen testdagen", "Maak de eerste testdag aan om te beginnen.", "feather") +
          "</div>";
        return;
      }

      host.innerHTML = tests
        .map(function (test) {
          const questions = G.questionsForTest(test);
          const submitted = G.resultsForDay(test.day).length;

          return (
            '<div class="card card--pad-lg' + (test.available ? " card--accent" : "") + '">' +
            '<div class="row row--between">' +
            "<div>" +
            '<span class="eyebrow">Dag ' + util.esc(test.day) + "</span>" +
            "<h2 class=\"mt-2\">" + util.esc(test.title || "Naamloos") + "</h2>" +
            '<p class="muted">' + util.esc(test.subtitle || "") + "</p>" +
            "</div>" +
            '<div class="row">' +
            '<span class="chip">' + questions.length + " vragen</span>" +
            '<span class="chip">' + submitted + " ingeleverd</span>" +
            (test.available
              ? '<span class="chip chip--green"><span class="chip__dot"></span>Open</span>'
              : '<span class="chip">Verzegeld</span>') +
            "</div></div>" +

            '<div class="grid grid--3 mt-4">' +
            toggle("Test beschikbaar", "available", test.day, test.available) +
            toggle("Uitslag zichtbaar", "resultsVisible", test.day, test.resultsVisible) +
            toggle("Klassement zichtbaar", "leaderboardVisible", test.day, test.leaderboardVisible) +
            "</div>" +

            '<div class="actionbar">' +
            '<span class="faint" style="margin-right:auto;font-size:.82rem">' +
            util.esc(test.date || "geen datum") + "</span>" +
            '<button class="btn btn--sm" type="button" data-questions="' + test.day + '">Vragen koppelen</button>' +
            '<button class="btn btn--sm" type="button" data-edit="' + test.day + '">Bewerken</button>' +
            '<button class="btn btn--sm btn--danger" type="button" data-delete="' + test.day + '">Verwijderen</button>' +
            "</div></div>"
          );
        })
        .join("");

      util.$$("[data-toggle]", host).forEach(function (input) {
        input.addEventListener("change", function () {
          testsEditor.setFlag(Number(input.dataset.day), input.dataset.toggle, input.checked);
        });
      });

      util.$$("[data-edit]", host).forEach(function (button) {
        button.addEventListener("click", function () {
          testsEditor.openEditor(G.testForDay(Number(button.dataset.edit)));
        });
      });

      util.$$("[data-questions]", host).forEach(function (button) {
        button.addEventListener("click", function () {
          testsEditor.openQuestionPicker(Number(button.dataset.questions));
        });
      });

      util.$$("[data-delete]", host).forEach(function (button) {
        button.addEventListener("click", function () {
          testsEditor.remove(Number(button.dataset.delete));
        });
      });
    },

    setFlag(day, flag, value) {
      WIDM.data.update("tests", function (tests) {
        const test = tests.find(function (entry) {
          return Number(entry.day) === day;
        });
        if (test) test[flag] = value;
        return tests;
      });
      WIDM.toast("Dag " + day + " bijgewerkt.");
      afterWrite(testsEditor.render);
    },

    openEditor(test) {
      const isNew = !test;
      const days = G.tests().map(function (entry) {
        return Number(entry.day);
      });
      const model = test || {
        day: (days.length ? Math.max.apply(null, days) : 0) + 1,
        title: "",
        subtitle: "",
        date: "",
        available: false,
        resultsVisible: false,
        leaderboardVisible: true,
        questionIds: [],
      };

      admin.openModal(
        '<span class="eyebrow">' + (isNew ? "Nieuwe testdag" : "Dag " + util.esc(model.day)) + "</span>" +
        '<h2 id="editor-title" class="mt-2">' + (isNew ? "Testdag aanmaken" : "Testdag bewerken") + "</h2>" +
        '<div class="stack mt-4">' +
        '<div class="grid grid--2">' +
        fieldRow("Dagnummer", '<input class="input" type="number" min="1" id="t-day" value="' + util.esc(model.day) + '"' +
          (isNew ? "" : " readonly") + ">", isNew ? "" : "Het dagnummer ligt vast.") +
        fieldRow("Datum", '<input class="input" type="date" id="t-date" value="' + util.esc(model.date || "") + '">') +
        "</div>" +
        fieldRow("Titel", '<input class="input" type="text" id="t-title" value="' + util.esc(model.title || "") + '">') +
        fieldRow("Ondertitel", '<input class="input" type="text" id="t-subtitle" value="' + util.esc(model.subtitle || "") + '">',
          "Verschijnt als sfeerregel boven de test.") +
        '<div id="t-error"></div>' +
        "</div>" +
        '<div class="actionbar">' +
        '<button class="btn btn--ghost" type="button" data-role="cancel">Annuleren</button>' +
        '<button class="btn btn--primary" type="button" data-role="save">Opslaan</button>' +
        "</div>",
        function (panel) {
          panel.querySelector('[data-role="cancel"]').addEventListener("click", admin.closeModal);
          panel.querySelector('[data-role="save"]').addEventListener("click", function () {
            testsEditor.save(model, isNew);
          });
        }
      );
    },

    save(model, isNew) {
      const day = Number(document.getElementById("t-day").value);
      const title = document.getElementById("t-title").value.trim();

      if (!day || !title) {
        util.fill("#t-error", WIDM.notice("Onvolledig", "Een testdag heeft een dagnummer en een titel nodig.", "danger"));
        return;
      }

      if (isNew && G.testForDay(day)) {
        util.fill("#t-error", WIDM.notice("Bestaat al", "Er is al een testdag met dagnummer " + day + ".", "danger"));
        return;
      }

      const record = {
        day: day,
        title: title,
        subtitle: document.getElementById("t-subtitle").value.trim(),
        date: document.getElementById("t-date").value,
        available: !!model.available,
        resultsVisible: !!model.resultsVisible,
        leaderboardVisible: model.leaderboardVisible !== false,
        // A fresh day starts with every question already tagged for it.
        questionIds: isNew
          ? G.questionsForDay(day).map(function (question) {
              return question.id;
            })
          : model.questionIds || [],
      };

      WIDM.data.update("tests", function (tests) {
        const index = tests.findIndex(function (entry) {
          return Number(entry.day) === Number(model.day);
        });
        if (index >= 0) tests[index] = record;
        else tests.push(record);
        return tests;
      });

      admin.closeModal();
      WIDM.toast(isNew ? "Testdag aangemaakt." : "Testdag bijgewerkt.");
      afterWrite(testsEditor.render);
    },

    async remove(day) {
      const ok = await admin.confirm(
        "Testdag " + day + " verwijderen?",
        "De vragen zelf blijven bestaan, maar de testdag en de koppeling verdwijnen. " +
          "Ingeleverde uitslagen van deze dag blijven in results.json staan.",
        "Verwijderen",
        true
      );
      if (!ok) return;

      WIDM.data.update("tests", function (tests) {
        return tests.filter(function (entry) {
          return Number(entry.day) !== day;
        });
      });

      WIDM.toast("Testdag verwijderd.");
      afterWrite(testsEditor.render);
    },

    /** Pick exactly which questions belong to a test. */
    openQuestionPicker(day) {
      const test = G.testForDay(day);
      if (!test) return;

      const assigned = new Set(test.questionIds || []);
      const candidates = G.questions().filter(function (question) {
        return Number(question.day) === day || assigned.has(question.id);
      });

      const rows = candidates.length
        ? candidates
            .map(function (question) {
              return (
                '<label class="checkline">' +
                '<input type="checkbox" value="' + util.esc(question.id) + '"' +
                (assigned.has(question.id) ? " checked" : "") + ">" +
                '<span class="checkline__text"><strong>' + util.esc(question.id) + "</strong> · " +
                util.esc(question.question) + "</span></label>"
              );
            })
            .join("")
        : WIDM.emptyState("Geen vragen", "Er zijn nog geen vragen voor dag " + day + ".", "feather");

      admin.openModal(
        '<span class="eyebrow">Dag ' + util.esc(day) + " · " + util.esc(test.title) + "</span>" +
        '<h2 id="editor-title" class="mt-2">Vragen koppelen</h2>' +
        '<p class="field__hint mt-2">De volgorde volgt de lijst hieronder.</p>' +
        '<div class="mt-3" id="picker-list">' + rows + "</div>" +
        '<div class="actionbar">' +
        '<button class="btn btn--sm btn--ghost" type="button" data-role="all">Alles van dag ' + util.esc(day) + "</button>" +
        '<button class="btn btn--ghost" type="button" data-role="cancel">Annuleren</button>' +
        '<button class="btn btn--primary" type="button" data-role="save">Opslaan</button>' +
        "</div>",
        function (panel) {
          panel.querySelector('[data-role="all"]').addEventListener("click", function () {
            util.$$("#picker-list input[type=checkbox]", panel).forEach(function (input) {
              input.checked = true;
            });
          });
          panel.querySelector('[data-role="cancel"]').addEventListener("click", admin.closeModal);
          panel.querySelector('[data-role="save"]').addEventListener("click", function () {
            const ids = util.$$("#picker-list input[type=checkbox]:checked", panel).map(function (input) {
              return input.value;
            });

            WIDM.data.update("tests", function (tests) {
              const entry = tests.find(function (candidate) {
                return Number(candidate.day) === day;
              });
              if (entry) entry.questionIds = ids;
              return tests;
            });

            admin.closeModal();
            WIDM.toast(ids.length + " vragen gekoppeld aan dag " + day + ".");
            afterWrite(testsEditor.render);
          });
        }
      );
    },
  };

  function toggle(label, flag, day, checked) {
    return (
      '<label class="switch">' +
      '<input type="checkbox" data-toggle="' + flag + '" data-day="' + day + '"' + (checked ? " checked" : "") + ">" +
      '<span class="switch__track"></span>' +
      '<span class="switch__label">' + util.esc(label) + "</span>" +
      "</label>"
    );
  }

  /* ========================================================================
     3. PLAYERS
     ======================================================================== */
  const playersEditor = {
    showPins: false,

    init() {
      document.getElementById("add-player").addEventListener("click", function () {
        playersEditor.openEditor(null);
      });

      const pinButton = document.getElementById("toggle-pins");
      pinButton.addEventListener("click", function () {
        playersEditor.showPins = !playersEditor.showPins;
        pinButton.textContent = playersEditor.showPins ? "Verberg pincodes" : "Toon pincodes";
        playersEditor.render();
      });

      this.render();
    },

    render() {
      const host = document.getElementById("players-list");
      const standings = G.standings();

      if (!standings.length) {
        host.innerHTML =
          '<div class="card card--pad-lg">' +
          WIDM.emptyState("Geen spelers", "Voeg de eerste onderzoeker toe.", "feather") +
          "</div>";
        util.fill("#players-results", "");
        return;
      }

      const rows = standings
        .map(function (row) {
          const stats = row.stats;
          const average = stats.testsTaken ? stats.average.toFixed(1).replace(".", ",") : "—";
          return (
            "<tr>" +
            "<td>" + util.esc(row.player.name) + "</td>" +
            '<td class="faint numeral">' + util.esc(row.player.id) + "</td>" +
            '<td class="numeral">' +
            (playersEditor.showPins
              ? util.esc(row.player.pin)
              : '<span class="redacted" tabindex="0">' + util.esc(row.player.pin) + "</span>") +
            "</td>" +
            '<td class="table__num">' + stats.testsTaken + "/" + stats.testsTotal + "</td>" +
            '<td class="table__num">' + average + "</td>" +
            '<td class="table__num">' + row.points + "</td>" +
            '<td class="table__num">' + util.pad2(row.rank) + "</td>" +
            '<td><div class="table__actions">' +
            '<button class="btn btn--sm btn--ghost" type="button" data-edit="' + util.esc(row.player.id) + '">' +
            WIDM.icon("pen", "btn__icon") + "</button>" +
            '<button class="btn btn--sm btn--danger" type="button" data-delete="' + util.esc(row.player.id) + '">' +
            WIDM.icon("trash", "btn__icon") + "</button>" +
            "</div></td></tr>"
          );
        })
        .join("");

      host.innerHTML =
        '<div class="card card--plain">' +
        '<div class="table-wrap"><table class="table">' +
        "<thead><tr><th>Naam</th><th>ID</th><th>Pin</th><th>Tests</th><th>Gem.</th><th>Punten</th><th>Plaats</th><th></th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table></div></div>";

      util.$$("[data-edit]", host).forEach(function (button) {
        button.addEventListener("click", function () {
          playersEditor.openEditor(G.playerById(button.dataset.edit));
        });
      });

      util.$$("[data-delete]", host).forEach(function (button) {
        button.addEventListener("click", function () {
          playersEditor.remove(button.dataset.delete);
        });
      });

      playersEditor.renderResults();
    },

    /** Grid of who handed in which day, with the option to withdraw one. */
    renderResults() {
      const tests = G.tests();
      const players = G.players();

      const rows = players
        .map(function (player) {
          const cells = tests
            .map(function (test) {
              const result = G.resultFor(player.id, test.day);
              if (!result) return '<td class="faint">—</td>';
              const score = G.scoreResult(result);
              return (
                "<td>" + score.correct + "/" + score.total +
                ' <button class="btn btn--sm btn--ghost" type="button" data-drop="' +
                util.esc(player.id) + "|" + test.day + '" title="Inzending verwijderen">' +
                WIDM.icon("x", "btn__icon") + "</button></td>"
              );
            })
            .join("");
          return "<tr><td>" + util.esc(player.name) + "</td>" + cells + "</tr>";
        })
        .join("");

      util.fill(
        "#players-results",
        '<div class="card card--plain">' +
        '<div class="card__head"><h2 class="card__title">Ingeleverde tests</h2></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Speler</th>' +
        tests
          .map(function (test) {
            return "<th>Dag " + test.day + "</th>";
          })
          .join("") +
        "</tr></thead><tbody>" + rows + "</tbody></table></div></div>"
      );

      util.$$("[data-drop]").forEach(function (button) {
        button.addEventListener("click", async function () {
          const parts = button.dataset.drop.split("|");
          const player = G.playerById(parts[0]);
          const ok = await admin.confirm(
            "Inzending verwijderen?",
            (player ? player.name : parts[0]) + " kan dag " + parts[1] + " daarna opnieuw invullen.",
            "Verwijderen",
            true
          );
          if (!ok) return;

          WIDM.data.update("results", function (list) {
            return list.filter(function (result) {
              return !(result.playerId === parts[0] && Number(result.day) === Number(parts[1]));
            });
          });

          WIDM.toast("Inzending verwijderd.");
          afterWrite(playersEditor.render);
        });
      });
    },

    openEditor(player) {
      const isNew = !player;
      const model = player || { id: "", name: "", pin: "", note: "", joined: "" };

      admin.openModal(
        '<span class="eyebrow">' + (isNew ? "Nieuwe speler" : util.esc(model.name)) + "</span>" +
        '<h2 id="editor-title" class="mt-2">' + (isNew ? "Speler toevoegen" : "Speler bewerken") + "</h2>" +
        '<div class="stack mt-4">' +
        fieldRow("Naam", '<input class="input" type="text" id="p-name" value="' + util.esc(model.name) + '">',
          "Hiermee logt de speler in.") +
        fieldRow("Pincode", '<input class="input" type="text" id="p-pin" inputmode="numeric" value="' + util.esc(model.pin) + '">') +
        fieldRow("Aantekening", '<input class="input" type="text" id="p-note" value="' + util.esc(model.note || "") + '">',
          "Verschijnt handgeschreven op het onderzoeksbord.") +
        '<div id="p-error"></div>' +
        "</div>" +
        '<div class="actionbar">' +
        '<button class="btn btn--ghost" type="button" data-role="cancel">Annuleren</button>' +
        '<button class="btn btn--primary" type="button" data-role="save">Opslaan</button>' +
        "</div>",
        function (panel) {
          panel.querySelector('[data-role="cancel"]').addEventListener("click", admin.closeModal);
          panel.querySelector('[data-role="save"]').addEventListener("click", function () {
            playersEditor.save(model, isNew);
          });
        }
      );
    },

    save(model, isNew) {
      const name = document.getElementById("p-name").value.trim();
      const pin = document.getElementById("p-pin").value.trim();

      if (!name || !pin) {
        util.fill("#p-error", WIDM.notice("Onvolledig", "Een speler heeft een naam en een pincode nodig.", "danger"));
        return;
      }

      const id = isNew ? util.slug(name) : model.id;

      if (isNew && G.playerById(id)) {
        util.fill("#p-error", WIDM.notice("Bestaat al", "Er is al een speler met deze naam.", "danger"));
        return;
      }

      const record = {
        id: id,
        name: name,
        pin: pin,
        initials: util.initials(name),
        joined: model.joined || new Date().toISOString().slice(0, 10),
        note: document.getElementById("p-note").value.trim(),
      };

      WIDM.data.update("players", function (list) {
        const index = list.findIndex(function (entry) {
          return entry.id === id;
        });
        if (index >= 0) list[index] = record;
        else list.push(record);
        return list;
      });

      admin.closeModal();
      WIDM.toast(isNew ? "Speler toegevoegd." : "Speler bijgewerkt.");
      afterWrite(playersEditor.render);
    },

    async remove(id) {
      const player = G.playerById(id);
      if (!player) return;

      const ok = await admin.confirm(
        player.name + " verwijderen?",
        "De speler en al zijn ingeleverde tests verdwijnen uit het dossier.",
        "Verwijderen",
        true
      );
      if (!ok) return;

      WIDM.data.update("players", function (list) {
        return list.filter(function (entry) {
          return entry.id !== id;
        });
      });

      WIDM.data.update("results", function (list) {
        return list.filter(function (result) {
          return result.playerId !== id;
        });
      });

      WIDM.toast("Speler verwijderd.");
      afterWrite(playersEditor.render);
    },
  };

  /* ========================================================================
     4. GAME & SETTINGS
     ======================================================================== */
  const gameEditor = {
    init() {
      this.render();
    },

    render() {
      const info = G.game();
      const settings = G.settings();

      util.fill(
        "#game-form",
        '<div class="card card--pad-lg">' +
        '<div class="card__head"><h2 class="card__title">Spelgegevens</h2></div>' +
        '<div class="stack">' +
        '<div class="grid grid--2">' +
        fieldRow("Titel", '<input class="input" type="text" id="g-title" value="' + util.esc(info.title || "") + '">') +
        fieldRow("Locatie", '<input class="input" type="text" id="g-location" value="' + util.esc(info.location || "") + '">') +
        "</div>" +
        '<div class="grid grid--2">' +
        fieldRow("Ondertitel", '<input class="input" type="text" id="g-subtitle" value="' + util.esc(info.subtitle || "") + '">') +
        fieldRow("Editie", '<input class="input" type="text" id="g-edition" value="' + util.esc(info.edition || "") + '">') +
        "</div>" +
        '<div class="grid grid--2">' +
        fieldRow("Huidige dag", '<input class="input" type="number" min="1" id="g-currentDay" value="' + util.esc(info.currentDay) + '">') +
        fieldRow("Aantal speeldagen", '<input class="input" type="number" min="1" id="g-totalDays" value="' + util.esc(info.totalDays || G.tests().length) + '">') +
        "</div>" +
        '<div class="grid grid--2">' +
        fieldRow("Pot (€)", '<input class="input" type="number" min="0" step="10" id="g-pot" value="' + util.esc(info.pot || 0) + '">') +
        fieldRow("Maximale pot (€)", '<input class="input" type="number" min="0" step="10" id="g-maxPot" value="' + util.esc(info.maxPot || 0) + '">') +
        "</div>" +
        "</div>" +
        '<div class="actionbar">' +
        '<button class="btn btn--primary" type="button" data-role="save-game">Opslaan</button>' +
        "</div></div>"
      );

      util.fill(
        "#settings-form",
        '<div class="card card--pad-lg">' +
        '<div class="card__head"><h2 class="card__title">Wat spelers zien</h2></div>' +
        '<div class="stack stack--tight">' +
        settingToggle("Klassement zichtbaar", "leaderboardVisible", settings.leaderboardVisible) +
        settingToggle("Scores zichtbaar voor spelers", "showScoresToPlayers", settings.showScoresToPlayers) +
        settingToggle("Plaats in klassement tonen", "showRankToPlayers", settings.showRankToPlayers) +
        settingToggle("Juiste antwoorden vrijgeven", "showCorrectAnswers", settings.showCorrectAnswers) +
        settingToggle("Test opnieuw mogen maken", "allowRetake", settings.allowRetake) +
        settingToggle("Blinde vlek tonen", "showSuspicionMeter", settings.showSuspicionMeter) +
        "</div>" +
        '<div class="mt-4">' +
        fieldRow("Toegangscode spelleider", '<input class="input" type="text" id="s-adminPin" value="' + util.esc(settings.adminPin || "") + '">',
          "Deze code staat leesbaar in settings.json. Gebruik geen wachtwoord dat je elders gebruikt.") +
        "</div>" +
        '<div class="actionbar">' +
        '<button class="btn btn--primary" type="button" data-role="save-settings">Opslaan</button>' +
        "</div></div>"
      );

      util.fill(
        "#danger-zone",
        '<div class="card card--danger card--pad-lg">' +
        '<div class="card__head"><h2 class="card__title">Lokale wijzigingen</h2></div>' +
        '<p class="muted">Alles wat je hier aanpast leeft in deze browser. Exporteer de bestanden ' +
        "en vervang ze op de server om de wijzigingen voor iedereen te laten gelden.</p>" +
        '<div class="actionbar">' +
        '<button class="btn btn--sm" type="button" data-role="export-changed">' +
        WIDM.icon("download", "btn__icon") + "Exporteer gewijzigde bestanden</button>" +
        '<button class="btn btn--sm btn--danger" type="button" data-role="revert">Alles terugdraaien</button>' +
        "</div></div>"
      );

      document.querySelector('[data-role="save-game"]').addEventListener("click", gameEditor.saveGame);
      document.querySelector('[data-role="save-settings"]').addEventListener("click", gameEditor.saveSettings);

      document.querySelector('[data-role="export-changed"]').addEventListener("click", function () {
        const files = WIDM.data.exportChanged();
        WIDM.toast(files.length ? files.length + " bestand(en) gedownload." : "Er is niets gewijzigd.");
      });

      document.querySelector('[data-role="revert"]').addEventListener("click", async function () {
        const ok = await admin.confirm(
          "Alles terugdraaien?",
          "Deze browser valt terug op de JSON-bestanden op de server.",
          "Terugdraaien",
          true
        );
        if (!ok) return;
        WIDM.data.revert();
        window.location.reload();
      });
    },

    saveGame() {
      const next = WIDM.data.clone(G.game());
      next.title = document.getElementById("g-title").value.trim();
      next.subtitle = document.getElementById("g-subtitle").value.trim();
      next.location = document.getElementById("g-location").value.trim();
      next.edition = document.getElementById("g-edition").value.trim();
      next.currentDay = Number(document.getElementById("g-currentDay").value) || 1;
      next.totalDays = Number(document.getElementById("g-totalDays").value) || 1;
      next.pot = Number(document.getElementById("g-pot").value) || 0;
      next.maxPot = Number(document.getElementById("g-maxPot").value) || 0;

      WIDM.data.set("game", next);
      WIDM.toast("Spelgegevens opgeslagen.");
      afterWrite(gameEditor.render);
    },

    saveSettings() {
      const next = WIDM.data.clone(G.settings());
      util.$$("[data-setting]").forEach(function (input) {
        next[input.dataset.setting] = input.checked;
      });
      next.adminPin = document.getElementById("s-adminPin").value.trim() || next.adminPin;

      WIDM.data.set("settings", next);
      WIDM.toast("Instellingen opgeslagen.");
      afterWrite(gameEditor.render);
    },
  };

  function settingToggle(label, key, checked) {
    return (
      '<label class="switch">' +
      '<input type="checkbox" data-setting="' + key + '"' + (checked ? " checked" : "") + ">" +
      '<span class="switch__track"></span>' +
      '<span class="switch__label">' + util.esc(label) + "</span>" +
      "</label>"
    );
  }

  /* ========================================================================
     Dispatch — each page mounts only what it has markup for
     ======================================================================== */
  admin.register(function () {
    if (document.getElementById("questions-list")) questionsEditor.init();
    if (document.getElementById("tests-list")) testsEditor.init();
    if (document.getElementById("players-list")) playersEditor.init();
    if (document.getElementById("game-form")) gameEditor.init();
  });
})(window.WIDM);

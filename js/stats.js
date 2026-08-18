/* ==========================================================================
   stats.js — personal statistics (stats.html) and the investigation board
   (leaderboard.html). One module: both pages read the same derived numbers.
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;

  const CATEGORY_LABELS = {
    gedrag: "Gedrag",
    opdracht: "Opdrachten",
    feiten: "Feiten",
    uitspraken: "Uitspraken",
    geld: "Geld",
    locatie: "Locaties",
  };

  /* ========================================================================
     stats.html
     ======================================================================== */
  function renderStatsPage(session) {
    const stats = G.playerStats(session.id);
    const settings = G.settings();
    const rank = settings.showRankToPlayers ? G.rankOf(session.id) : null;

    util.fill(
      "#stats-head",
      '<span class="eyebrow">Persoonlijk dossier</span>' +
      '<h1 class="page-head__title">' + util.esc(session.name) + "</h1>" +
      '<p class="page-head__sub">' +
      (stats.testsTaken
        ? "Alles wat je tot nu toe hebt vastgelegd."
        : "Je hebt nog niets vastgelegd.") +
      "</p>"
    );

    const average = stats.testsTaken ? stats.average.toFixed(1).replace(".", ",") : "—";

    util.fill(
      "#stats-general",
      tile("Tests voltooid", stats.testsTaken + " / " + stats.testsTotal, null, true) +
      tile("Gemiddelde score", average, stats.testsTaken ? "per test" : "nog geen data", true) +
      tile("Hoogste score", stats.best === null ? "—" : String(stats.best), null, true) +
      tile("Laagste score", stats.worst === null ? "—" : String(stats.worst), null, false) +
      tile("Totaal juist", String(stats.totalCorrect), "van " + stats.totalQuestions + " vragen", false) +
      tile("Totaal fout", String(stats.totalWrong), null, false) +
      tile("Plaats", rank ? rank + "e" : "—", rank ? "van " + G.players().length : "verborgen", true) +
      tile("Tijd besteed", util.duration(stats.totalTime), "minuten totaal", false)
    );

    renderDayBars(stats);
    renderCategories(session);
    renderExtra(session, stats);
  }

  function tile(label, value, note, highlight) {
    return (
      '<div class="stat' + (highlight ? " stat--hero" : "") + '">' +
      '<span class="stat__label">' + util.esc(label) + "</span>" +
      '<span class="stat__value stat__value--sm numeral' + (highlight ? "" : " stat__value--plain") + '">' +
      util.esc(value) + "</span>" +
      (note ? '<span class="stat__note">' + util.esc(note) + "</span>" : "") +
      "</div>"
    );
  }

  function renderDayBars(stats) {
    const rows = stats.byDay
      .map(function (row) {
        if (!row.done) {
          return (
            '<div class="bar bar--empty">' +
            '<span class="bar__label">Dag ' + row.day + "</span>" +
            '<div class="bar__track"></div>' +
            '<span class="bar__value">' + (row.available ? "Open" : "Verzegeld") + "</span>" +
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
      "#stats-days",
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Prestatie per dag</h2></div>' +
      (stats.testsTaken
        ? '<div class="bars">' + rows + "</div>"
        : WIDM.emptyState("Nog geen aanwijzingen…", "Zodra je een test inlevert verschijnt hier je verloop.", "moon")) +
      "</div>"
    );
  }

  /** How well the player reads each kind of clue. */
  function renderCategories(session) {
    const buckets = {};

    G.resultsForPlayer(session.id).forEach(function (result) {
      G.reviewResult(result).forEach(function (entry) {
        const key = entry.question.category || "overig";
        if (!buckets[key]) buckets[key] = { correct: 0, total: 0 };
        buckets[key].total += 1;
        if (entry.isCorrect) buckets[key].correct += 1;
      });
    });

    const keys = Object.keys(buckets).sort(function (a, b) {
      return buckets[b].correct / buckets[b].total - buckets[a].correct / buckets[a].total;
    });

    const rows = keys
      .map(function (key) {
        const bucket = buckets[key];
        const percentage = Math.round((bucket.correct / bucket.total) * 100);
        return (
          '<div class="bar">' +
          '<span class="bar__label">' + util.esc(CATEGORY_LABELS[key] || key) + "</span>" +
          '<div class="bar__track"><div class="bar__fill" style="width:' + percentage + '%"></div></div>' +
          '<span class="bar__value">' + percentage + "%</span>" +
          "</div>"
        );
      })
      .join("");

    util.fill(
      "#stats-categories",
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Waar je op let</h2></div>' +
      (keys.length
        ? '<div class="bars">' + rows + "</div>" +
          '<p class="field__hint mt-3">Percentage juiste antwoorden per soort waarneming.</p>'
        : WIDM.emptyState("Het dossier is leeg", "Nog geen waarnemingen om te ordenen.", "feather")) +
      "</div>"
    );
  }

  function renderExtra(session, stats) {
    const player = G.playerById(session.id);
    const settings = G.settings();

    // Group average per day, so the player can see where they stood out.
    const comparison = stats.byDay
      .filter(function (row) {
        return row.done;
      })
      .map(function (row) {
        const day = G.dayStandings(row.day);
        const groupAverage = day.length
          ? day.reduce(function (sum, entry) {
              return sum + entry.score.correct;
            }, 0) / day.length
          : 0;
        const delta = row.score.correct - groupAverage;
        return (
          '<div class="list__item">' +
          '<span class="list__label">Dag ' + row.day + "</span>" +
          '<span class="list__value">' + (delta >= 0 ? "+" : "") +
          delta.toFixed(1).replace(".", ",") +
          '<span class="faint" style="font-size:.78rem"> t.o.v. groep</span></span>' +
          "</div>"
        );
      })
      .join("");

    util.fill(
      "#stats-extra",
      '<div class="card">' +
      '<div class="card__head"><h2 class="card__title">Onderzoeker</h2></div>' +
      '<div class="row"><span class="avatar avatar--lg">' + util.esc(G.initialsOf(G.playerById(session.id))) + "</span>" +
      "<div><p style=\"font-family:var(--font-display);font-size:1.1rem\">" + util.esc(session.name) + "</p>" +
      '<p class="faint" style="font-size:.82rem">Sinds ' + util.esc(player && player.joined ? util.dateShort(player.joined) : "dag 1") + "</p></div></div>" +
      (player && player.note
        ? '<p class="whisper mt-3">' + util.esc(player.note) + "</p>"
        : "") +
      "</div>" +

      (settings.showSuspicionMeter
        ? '<div class="card">' +
          '<div class="card__head"><h2 class="card__title">Blinde vlek</h2></div>' +
          '<div class="suspicion">' +
          '<div class="suspicion__track"><div class="suspicion__fill" style="width:' +
          G.suspicion(stats.percentage).level + '%"></div></div>' +
          '<span class="suspicion__label">' + util.esc(G.suspicion(stats.percentage).label) + "</span>" +
          "</div></div>"
        : "") +

      (comparison
        ? '<div class="card">' +
          '<div class="card__head"><h2 class="card__title">Tegen de groep</h2></div>' +
          '<div class="list">' + comparison + "</div></div>"
        : "")
    );
  }

  /* ========================================================================
     leaderboard.html
     ======================================================================== */
  function renderLeaderboard(session) {
    const settings = G.settings();
    const board = document.getElementById("board");
    const standingsHost = document.getElementById("standings");

    if (!settings.leaderboardVisible) {
      board.innerHTML =
        '<div class="card card--pad-lg">' +
        WIDM.emptyState("Het bord is afgedekt", "De spelleider houdt de stand voorlopig geheim.", "lock") +
        "</div>";
      standingsHost.innerHTML = "";
      return;
    }

    const rows = G.standings();

    if (!rows.length) {
      board.innerHTML =
        '<div class="card card--pad-lg">' +
        WIDM.emptyState("Geen verdachten", "Er staan nog geen spelers in het dossier.", "feather") +
        "</div>";
      standingsHost.innerHTML = "";
      return;
    }

    renderBoard(board, rows, session);
    renderStandings(standingsHost, rows, session);
  }

  function renderBoard(host, rows, session) {
    const cards = rows
      .map(function (row) {
        const me = row.player.id === session.id;
        return (
          '<article class="suspect">' +
          '<span class="pin' + (me ? " pin--gold" : "") + '"></span>' +
          '<div class="suspect__photo">' + util.esc(G.initialsOf(row.player)) + "</div>" +
          '<h3 class="suspect__name">' + util.esc(row.player.name) + "</h3>" +
          '<p class="suspect__note">' + util.esc(row.player.note || "Geen aantekeningen.") + "</p>" +
          '<p class="suspect__meta">' + row.points + " pnt · " + util.pad2(row.rank) + "e</p>" +
          "</article>"
        );
      })
      .join("");

    host.innerHTML =
      '<div class="board">' +
      '<div class="row row--between" style="position:relative;z-index:2">' +
      '<span class="eyebrow">Verdachten</span>' +
      '<span class="stamp stamp--gold">Vertrouwelijk</span>' +
      "</div>" +
      '<svg class="board__threads" aria-hidden="true"></svg>' +
      '<div class="board__grid mt-4">' + cards + "</div>" +
      '<p class="whisper mt-4" style="position:relative;z-index:2;text-align:center">' +
      "Eén van hen speelt een ander spel.</p>" +
      "</div>";

    drawThreads(host.querySelector(".board"));
  }

  /**
   * Red string between the pinned cards. Positions are measured after layout,
   * so this survives any grid reflow — it is redrawn on resize.
   */
  function drawThreads(board) {
    if (!board) return;
    const svg = board.querySelector(".board__threads");
    const cards = Array.from(board.querySelectorAll(".suspect"));
    if (!svg || cards.length < 2) return;

    function paint() {
      const frame = board.getBoundingClientRect();
      svg.setAttribute("viewBox", "0 0 " + frame.width + " " + frame.height);

      const points = cards.map(function (card) {
        const box = card.getBoundingClientRect();
        return {
          x: box.left - frame.left + box.width / 2,
          y: box.top - frame.top + 10, // near the pin
        };
      });

      let markup = "";
      // Chain every card to the next one…
      for (let index = 0; index < points.length - 1; index += 1) {
        markup += line(points[index], points[index + 1], 0.5);
      }
      // …plus a couple of longer cross-references.
      if (points.length > 2) {
        markup += line(points[0], points[points.length - 1], 0.28);
      }
      if (points.length > 3) {
        markup += line(points[1], points[points.length - 2], 0.22);
      }

      svg.innerHTML = markup;
    }

    function line(from, to, opacity) {
      // Slight sag, like real string between two pins.
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 + Math.abs(to.x - from.x) * 0.08 + 8;
      return (
        '<path d="M' + from.x.toFixed(1) + " " + from.y.toFixed(1) +
        " Q" + midX.toFixed(1) + " " + midY.toFixed(1) +
        " " + to.x.toFixed(1) + " " + to.y.toFixed(1) + '" ' +
        'fill="none" stroke="#8c2438" stroke-width="1.4" opacity="' + opacity + '"/>'
      );
    }

    paint();

    let timer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(paint, 150);
    });
  }

  function renderStandings(host, rows, session) {
    const list = rows
      .map(function (row) {
        const me = row.player.id === session.id;
        const classes =
          "rank__row" + (me ? " rank__row--me" : "") + (row.rank === 1 ? " rank__row--top" : "");
        return (
          '<div class="' + classes + '">' +
          '<span class="rank__pos numeral">' + util.pad2(row.rank) + "</span>" +
          '<span class="avatar avatar--sm rank__avatar">' + util.esc(G.initialsOf(row.player)) + "</span>" +
          '<span class="rank__body">' +
          '<span class="rank__name">' + util.esc(row.player.name) + (me ? " <span class=\"faint\">(jij)</span>" : "") + "</span>" +
          '<span class="rank__meta">' + row.testsTaken + " tests · " +
          util.esc(util.duration(row.totalTime)) + " min</span>" +
          "</span>" +
          '<span class="rank__score numeral">' + row.points + " punten</span>" +
          "</div>"
        );
      })
      .join("");

    host.innerHTML =
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Stand</h2>' +
      '<span class="faint" style="font-size:.8rem">Gelijke punten delen een plaats</span></div>' +
      '<div class="rank">' + list + "</div>" +
      '<p class="field__hint mt-4">Punten zijn juiste antwoorden over alle tests. ' +
      "De hoogste score wint niets — het gaat erom wie de Mol vindt.</p>" +
      "</div>";
  }

  /* ------------------------------------------------------------------------
     Boot — one script, two pages
     ------------------------------------------------------------------------ */
  WIDM.page({
    require: "player",
    run: function (context) {
      if (document.getElementById("stats-general")) {
        renderStatsPage(context.session);
      }
      if (document.getElementById("board")) {
        renderLeaderboard(context.session);
      }
    },
  });
})(window.WIDM);

/* ==========================================================================
   stats.js — persoonlijke statistieken (stats.html) en het onderzoeksbord
   (leaderboard.html).

   Nergens een score of een ranglijst. Wat hier staat mag niets verraden over
   hoe goed iemand de tests maakt: dan zou je weten of je verdenking klopt.
   Wat wél mag: hoeveel je hebt vastgelegd, waar je op let, en wie er nog in
   het spel zit.
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

    util.fill(
      "#stats-head",
      '<span class="eyebrow">Persoonlijk dossier</span>' +
      '<h1 class="page-head__title">' + util.esc(session.name) + "</h1>" +
      '<p class="page-head__sub">' +
      (stats.testsTaken ? "Alles wat je tot nu toe hebt vastgelegd." : "Je hebt nog niets vastgelegd.") +
      "</p>"
    );

    const days = stats.byDay.filter(function (row) {
      return row.done;
    });
    const lastDay = days.length ? "Dag " + days[days.length - 1].day : "—";

    util.fill(
      "#stats-general",
      tile("Tests vastgelegd", stats.testsTaken + " / " + stats.testsTotal, null, true) +
      tile("Vragen beantwoord", String(stats.totalQuestions), "over alle tests", true) +
      tile("Tijd besteed", util.duration(stats.totalTime), "minuten totaal", false) +
      tile("Laatst vastgelegd", lastDay, null, false)
    );

    renderLogbook(stats);
    renderCategories(session);
    renderExtra(session);
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

  /** Per dag: wél of niet vastgelegd. Nadrukkelijk geen score. */
  function renderLogbook(stats) {
    const rows = stats.byDay
      .map(function (row) {
        let mark;
        if (row.done) mark = '<span class="chip chip--green">Vastgelegd</span>';
        else if (row.available) mark = '<span class="chip chip--gold">Open</span>';
        else mark = '<span class="chip">Verzegeld</span>';

        return (
          '<div class="list__item">' +
          '<span class="list__label"><strong>Dag ' + row.day + "</strong> · " + util.esc(row.title || "") + "</span>" +
          mark +
          "</div>"
        );
      })
      .join("");

    util.fill(
      "#stats-days",
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Jouw logboek</h2></div>' +
      (stats.testsTaken
        ? '<div class="list">' + rows + "</div>"
        : WIDM.emptyState("Nog geen aanwijzingen…", "Zodra je een test inlevert verschijnt hier je verloop.", "moon")) +
      "</div>"
    );
  }

  /**
   * Waar je vragen over kreeg, per categorie. Telt aantallen, geen goed/fout:
   * een percentage juist zou je score verraden.
   */
  function renderCategories(session) {
    const buckets = {};

    G.resultsForPlayer(session.id).forEach(function (result) {
      G.questionsForTest(G.testForDay(result.day)).forEach(function (question) {
        const key = question.category || "overig";
        buckets[key] = (buckets[key] || 0) + 1;
      });
    });

    const keys = Object.keys(buckets).sort(function (a, b) {
      return buckets[b] - buckets[a];
    });
    const highest = keys.length ? buckets[keys[0]] : 0;

    const rows = keys
      .map(function (key) {
        const width = highest ? (buckets[key] / highest) * 100 : 0;
        return (
          '<div class="bar">' +
          '<span class="bar__label">' + util.esc(CATEGORY_LABELS[key] || key) + "</span>" +
          '<div class="bar__track"><div class="bar__fill" style="width:' + width + '%"></div></div>' +
          '<span class="bar__value">' + buckets[key] + "</span>" +
          "</div>"
        );
      })
      .join("");

    util.fill(
      "#stats-categories",
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Waar het over ging</h2></div>' +
      (keys.length
        ? '<div class="bars">' + rows + "</div>" +
          '<p class="field__hint mt-3">Aantal vragen per soort waarneming. Of je ze goed had ' +
          "hoor je pas aan het eind.</p>"
        : WIDM.emptyState("Het dossier is leeg", "Nog geen waarnemingen om te ordenen.", "feather")) +
      "</div>"
    );
  }

  function renderExtra(session) {
    const player = G.playerById(session.id);
    const settings = G.settings();
    const spot = G.blindSpot(session.id);

    util.fill(
      "#stats-extra",
      '<div class="card">' +
      '<div class="card__head"><h2 class="card__title">Onderzoeker</h2></div>' +
      '<div class="row"><span class="avatar avatar--lg">' + util.esc(G.initialsOf(player)) + "</span>" +
      '<div><p style="font-family:var(--font-display);font-size:1.1rem">' + util.esc(session.name) + "</p>" +
      '<p class="faint" style="font-size:.82rem">Sinds ' +
      util.esc(player && player.joined ? util.dateShort(player.joined) : "dag 1") + "</p></div></div>" +
      (player && player.eliminated
        ? '<p class="mt-3"><span class="chip chip--red">Afgevallen op dag ' +
          util.esc(player.eliminatedDay || "?") + "</span></p>"
        : '<p class="mt-3"><span class="chip chip--green">Nog in het spel</span></p>') +
      (player && player.note ? '<p class="whisper mt-3">' + util.esc(player.note) + "</p>" : "") +
      "</div>" +

      (settings.showBlindSpot
        ? '<div class="card">' +
          '<div class="card__head"><h2 class="card__title">Blinde vlek</h2></div>' +
          '<div class="suspicion">' +
          '<div class="suspicion__track"><div class="suspicion__fill" style="width:' + spot.level + '%"></div></div>' +
          '<span class="suspicion__label">' + util.esc(spot.label) + "</span>" +
          "</div>" +
          '<p class="field__hint mt-2">Een grove indruk, meer niet.</p></div>'
        : "")
    );
  }

  /* ========================================================================
     leaderboard.html — het onderzoeksbord
     ======================================================================== */
  function renderBoardPage(session) {
    const settings = G.settings();
    const board = document.getElementById("board");
    const listHost = document.getElementById("standings");

    if (!settings.showEliminationBoard) {
      board.innerHTML =
        '<div class="card card--pad-lg">' +
        WIDM.emptyState("Het bord is afgedekt", "De spelleider houdt het bord voorlopig gesloten.", "lock") +
        "</div>";
      listHost.innerHTML = "";
      return;
    }

    const players = G.players();
    if (!players.length) {
      board.innerHTML =
        '<div class="card card--pad-lg">' +
        WIDM.emptyState("Geen verdachten", "Er staan nog geen spelers in het dossier.", "feather") +
        "</div>";
      listHost.innerHTML = "";
      return;
    }

    renderBoard(board, players, session);
    renderRoster(listHost, players, session);
  }

  function renderBoard(host, players, session) {
    const cards = players
      .map(function (player) {
        const me = player.id === session.id;
        const out = !!player.eliminated;
        return (
          '<article class="suspect' + (out ? " suspect--out" : "") + '">' +
          '<span class="pin' + (me ? " pin--gold" : "") + '"></span>' +
          '<div class="suspect__photo">' + util.esc(G.initialsOf(player)) + "</div>" +
          '<h3 class="suspect__name">' + util.esc(player.name) + "</h3>" +
          '<p class="suspect__note">' + util.esc(player.note || "Geen aantekeningen.") + "</p>" +
          '<p class="suspect__meta">' +
          (out ? "Afgevallen · dag " + util.esc(player.eliminatedDay || "?") : "Nog in het spel") +
          "</p>" +
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

  /** Rode draad tussen de spelden. Wordt na elke herindeling opnieuw getekend. */
  function drawThreads(board) {
    if (!board) return;
    const svg = board.querySelector(".board__threads");
    const cards = Array.from(board.querySelectorAll(".suspect"));
    if (!svg || cards.length < 2) return;

    function line(from, to, opacity) {
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 + Math.abs(to.x - from.x) * 0.08 + 8;
      return (
        '<path d="M' + from.x.toFixed(1) + " " + from.y.toFixed(1) +
        " Q" + midX.toFixed(1) + " " + midY.toFixed(1) +
        " " + to.x.toFixed(1) + " " + to.y.toFixed(1) + '" ' +
        'fill="none" stroke="#8c2438" stroke-width="1.4" opacity="' + opacity + '"/>'
      );
    }

    function paint() {
      const frame = board.getBoundingClientRect();
      svg.setAttribute("viewBox", "0 0 " + frame.width + " " + frame.height);

      const points = cards.map(function (card) {
        const box = card.getBoundingClientRect();
        return { x: box.left - frame.left + box.width / 2, y: box.top - frame.top + 10 };
      });

      let markup = "";
      for (let index = 0; index < points.length - 1; index += 1) {
        markup += line(points[index], points[index + 1], 0.5);
      }
      if (points.length > 2) markup += line(points[0], points[points.length - 1], 0.28);
      if (points.length > 3) markup += line(points[1], points[points.length - 2], 0.22);
      svg.innerHTML = markup;
    }

    paint();
    let timer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(paint, 150);
    });
  }

  function renderRoster(host, players, session) {
    const active = players.filter(function (player) {
      return !player.eliminated;
    });
    const out = players.filter(function (player) {
      return player.eliminated;
    });

    function row(player) {
      const me = player.id === session.id;
      const gone = !!player.eliminated;
      return (
        '<div class="rank__row' + (me ? " rank__row--me" : "") + '"' + (gone ? ' style="opacity:.45"' : "") + ">" +
        '<span class="rank__pos numeral">' + (gone ? "✕" : "•") + "</span>" +
        '<span class="avatar avatar--sm rank__avatar">' + util.esc(G.initialsOf(player)) + "</span>" +
        '<span class="rank__body">' +
        '<span class="rank__name">' + util.esc(player.name) + (me ? ' <span class="faint">(jij)</span>' : "") + "</span>" +
        '<span class="rank__meta">' +
        (gone ? "Afgevallen op dag " + util.esc(player.eliminatedDay || "?") : "Nog in het spel") +
        "</span></span></div>"
      );
    }

    host.innerHTML =
      '<div class="card card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Nog in het spel</h2>' +
      '<span class="faint" style="font-size:.8rem">' + active.length + " van " + players.length + "</span></div>" +
      '<div class="rank">' + active.map(row).join("") + "</div>" +
      (out.length
        ? '<div class="card__head mt-5"><h2 class="card__title">Afgevallen</h2></div>' +
          '<div class="rank">' + out.map(row).join("") + "</div>"
        : "") +
      '<p class="field__hint mt-4">Er is geen ranglijst. Wie de meeste vragen goed heeft ' +
      "blijft geheim tot het einde — anders wist je meteen of je de juiste verdenkt.</p>" +
      "</div>";
  }

  WIDM.page({
    require: "player",
    run: function (context) {
      if (document.getElementById("stats-general")) renderStatsPage(context.session);
      if (document.getElementById("board")) renderBoardPage(context.session);
    },
  });
})(window.WIDM);

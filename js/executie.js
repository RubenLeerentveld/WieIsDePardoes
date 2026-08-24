/* ==========================================================================
   executie.js — het moment waarop iemand afvalt

   Twee gescheiden stappen, met opzet:

   1. VOORBEREIDEN — vooraf, alleen jij. De app rekent uit wie er het slechtst
      voorstaat op de test van deze dag en stelt die voor. Jij bevestigt of
      kiest iemand anders. Wat je aanwijst blijft onzichtbaar voor spelers;
      het bord toont alleen wie al echt is afgevallen.

   2. DE CEREMONIE — met z'n allen, op de tv. Je typt een naam, vliegt door
      de poort, en daar staat de uitslag. Er valt op dat moment niets meer te
      beslissen: dat is 's middags al gebeurd.
   ========================================================================== */

(function (WIDM) {
  "use strict";

  const util = WIDM.util;
  const G = WIDM.game;
  const admin = WIDM.admin;

  // Hoe lang de vlucht door de poort duurt.
  const FLIGHT_MS = 6200;

  let timer = null;

  /* ========================================================================
     1. Voorbereiden
     ======================================================================== */
  function renderSetup() {
    const host = document.getElementById("executie-setup");
    const day = G.game().currentDay || 1;
    const ranking = G.eliminationRanking(day);

    if (!ranking.length) {
      host.innerHTML =
        '<div class="card card--pad-lg">' +
        WIDM.emptyState("Geen spelers", "Iedereen is al af, of er zijn nog geen spelers.", "feather") +
        "</div>";
      return;
    }

    const suggestion = ranking[0];
    const marked = G.pendingEliminations();

    host.innerHTML =
      // ---- Voorstel -------------------------------------------------------
      '<div class="card card--danger card--pad-lg">' +
      '<div class="card__head"><h2 class="card__title">Voorstel voor dag ' + day + "</h2>" +
      '<span class="chip">Jij beslist</span></div>' +
      (suggestion.submitted
        ? '<p class="mt-2">Volgens de test staat <strong>' + util.esc(suggestion.player.name) +
          "</strong> er het slechtst voor: " + suggestion.score.correct + " van " +
          suggestion.score.total + " goed in " + util.esc(util.duration(suggestion.seconds)) + "." +
          (suggestion.score.jokersUsed
            ? " Inclusief " + suggestion.score.jokersUsed + " joker."
            : "") +
          "</p>"
        : '<p class="mt-2"><strong>' + util.esc(suggestion.player.name) +
          "</strong> heeft de test van deze dag niet ingeleverd.</p>") +
      '<p class="field__hint mt-2">Minste goede antwoorden eerst, bij gelijke stand de ' +
      "langzaamste. Kijk het na voordat je het vastlegt.</p>" +
      "</div>" +

      // ---- Volledige rangschikking ----------------------------------------
      '<div class="card card--plain mt-4">' +
      '<div class="card__head"><h2 class="card__title">Stand op de test van dag ' + day + "</h2>" +
      '<span class="faint" style="font-size:.78rem">slechtste bovenaan</span></div>' +
      '<div class="table-wrap"><table class="table">' +
      "<thead><tr><th></th><th>Speler</th><th>Score</th><th>Tijd</th><th>Aanwijzen</th></tr></thead><tbody>" +
      ranking
        .map(function (row, index) {
          const isMarked = !!row.player.pendingElimination;
          return (
            "<tr" + (isMarked ? ' style="background:rgba(140,36,56,.16)"' : "") + ">" +
            '<td class="faint numeral">' + (index + 1) + "</td>" +
            '<td><div class="row" style="gap:.6rem;flex-wrap:nowrap">' +
            G.avatar(row.player, "avatar--sm") + util.esc(row.player.name) +
            (index === 0 ? ' <span class="chip chip--red">voorstel</span>' : "") +
            "</div></td>" +
            '<td class="table__num">' +
            (row.submitted
              ? row.score.correct + "/" + row.score.total +
                (row.score.jokersUsed ? ' <span class="chip chip--gold">+' + row.score.jokersUsed + "</span>" : "")
              : '<span class="chip chip--red">niet ingeleverd</span>') +
            "</td>" +
            '<td class="table__num">' + (row.submitted ? util.esc(util.duration(row.seconds)) : "—") + "</td>" +
            "<td>" +
            '<label class="switch"><input type="checkbox" data-mark="' + util.esc(row.player.id) + '"' +
            (isMarked ? " checked" : "") + '><span class="switch__track"></span>' +
            '<span class="switch__label">Valt af</span></label>' +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>" +
      '<p class="field__hint mt-3">Je mag er meer dan een aanwijzen. Spelers zien hier ' +
      "niets van: het bord verandert pas tijdens de ceremonie.</p>" +
      "</div>" +

      // ---- Klaarzetten ----------------------------------------------------
      '<div class="card card--pad-lg mt-4">' +
      '<div class="card__head"><h2 class="card__title">Klaar voor de ceremonie</h2></div>' +
      (marked.length
        ? '<p class="mt-2">Aangewezen: ' +
          marked.map(function (player) {
            return "<strong>" + util.esc(player.name) + "</strong>";
          }).join(", ") + ". Iedereen die je verder intypt krijgt <em>door</em>.</p>"
        : '<p class="mt-2 muted">Nog niemand aangewezen. Dan gaat vanavond iedereen door — ' +
          "ook dat kan een ronde zijn.</p>") +
      '<button class="btn btn--primary btn--lg btn--block mt-4" type="button" data-role="begin">' +
      "Start de ceremonie</button>" +
      '<p class="field__hint mt-3">Zet je scherm op de tv voordat je hierop drukt. ' +
      "De pagina gaat schermvullend en toont alleen nog een invoerveld.</p>" +
      "</div>";

    util.$$("[data-mark]", host).forEach(function (input) {
      input.addEventListener("change", function () {
        setMark(input.dataset.mark, input.checked);
      });
    });

    host.querySelector('[data-role="begin"]').addEventListener("click", beginCeremony);
  }

  function setMark(playerId, marked) {
    WIDM.data.update("players", function (list) {
      const entry = list.find(function (item) {
        return item.id === playerId;
      });
      if (entry) entry.pendingElimination = !!marked;
      return list;
    });
    admin.refreshBanner();
    renderSetup();
  }

  /* ========================================================================
     2. De ceremonie
     ======================================================================== */
  function beginCeremony() {
    const stage = document.getElementById("ceremony");
    stage.hidden = false;

    // Schermvullend voor op de tv. Mag mislukken; dan is het gewoon een
    // overlay over de hele pagina.
    if (stage.requestFullscreen) {
      stage.requestFullscreen().catch(function () {});
    }

    askName();
  }

  function askName() {
    const stage = document.getElementById("ceremony");
    stage.className = "ceremony";

    const names = G.activePlayers()
      .map(function (player) {
        return '<option value="' + util.esc(player.name) + '"></option>';
      })
      .join("");

    stage.innerHTML =
      '<div class="ceremony__inner">' +
      '<span class="ceremony__eyebrow">De executie</span>' +
      '<form id="ceremony-form" class="ceremony__form">' +
      '<label class="visually-hidden" for="ceremony-name">Naam van de speler</label>' +
      '<input class="ceremony__input" type="text" id="ceremony-name" list="ceremony-names" ' +
      'autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Typ een naam">' +
      "<datalist id=\"ceremony-names\">" + names + "</datalist>" +
      "</form>" +
      '<p class="ceremony__whisper">Druk op enter.</p>' +
      '<button class="btn btn--ghost btn--sm ceremony__exit" type="button" data-role="quit">Stoppen</button>' +
      "</div>";

    const input = document.getElementById("ceremony-name");
    input.focus();

    document.getElementById("ceremony-form").addEventListener("submit", function (event) {
      event.preventDefault();
      const player = findPlayer(input.value);
      if (!player) {
        input.value = "";
        input.classList.add("ceremony__input--wrong");
        window.setTimeout(function () {
          input.classList.remove("ceremony__input--wrong");
        }, 600);
        return;
      }
      flyThroughGate(player);
    });

    stage.querySelector('[data-role="quit"]').addEventListener("click", quit);
  }

  function findPlayer(typed) {
    const needle = String(typed || "").trim().toLowerCase();
    if (!needle) return null;
    return G.players().find(function (player) {
      return player.name.toLowerCase() === needle;
    }) || null;
  }

  /** De vlucht door de poort. Twaalf bogen die naar je toe komen. */
  function flyThroughGate(player) {
    const stage = document.getElementById("ceremony");
    stage.className = "ceremony ceremony--flight";

    let arches = "";
    for (let index = 0; index < 12; index += 1) {
      arches += '<span class="gate__arch" style="--i:' + index + '"></span>';
    }

    stage.innerHTML =
      '<div class="gate" aria-hidden="true">' + arches + '<span class="gate__glow"></span></div>' +
      '<div class="ceremony__inner ceremony__inner--flight">' +
      '<p class="ceremony__name">' + util.esc(player.name) + "</p>" +
      "</div>";

    timer = window.setTimeout(function () {
      reveal(player);
    }, FLIGHT_MS);
  }

  function reveal(player) {
    const stage = document.getElementById("ceremony");
    const survived = !player.pendingElimination;

    stage.className = "ceremony " + (survived ? "ceremony--door" : "ceremony--af");

    stage.innerHTML =
      '<div class="ceremony__inner ceremony__inner--reveal">' +
      (player.photo
        ? '<span class="seal ceremony__seal"><img src="' + util.esc(player.photo) + '" alt=""></span>'
        : "") +
      '<p class="ceremony__name">' + util.esc(player.name) + "</p>" +
      '<p class="ceremony__verdict">' + (survived ? "Door" : "Afgevallen") + "</p>" +
      '<p class="ceremony__whisper">' +
      (survived ? "Je onderzoek gaat verder." : "Jouw spel eindigt hier. Pardoes loopt door.") +
      "</p>" +
      '<div class="row mt-5" style="justify-content:center">' +
      '<button class="btn btn--primary" type="button" data-role="next">Volgende naam</button>' +
      '<button class="btn btn--ghost" type="button" data-role="quit">Stoppen</button>' +
      "</div></div>";

    if (!survived) applyElimination(player);

    stage.querySelector('[data-role="next"]').addEventListener("click", askName);
    stage.querySelector('[data-role="quit"]').addEventListener("click", quit);
  }

  /** Nu pas wordt het echt: het bord verandert en de markering gaat weg. */
  function applyElimination(player) {
    const day = G.game().currentDay || 1;

    WIDM.data.update("players", function (list) {
      const entry = list.find(function (item) {
        return item.id === player.id;
      });
      if (entry) {
        entry.eliminated = true;
        entry.eliminatedDay = day;
        entry.pendingElimination = false;
      }
      return list;
    });
  }

  function quit() {
    window.clearTimeout(timer);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    const stage = document.getElementById("ceremony");
    stage.hidden = true;
    stage.innerHTML = "";
    stage.className = "ceremony";
    admin.refreshBanner();
    renderSetup();
  }

  // Tijdens de vlucht doet Escape niets: niemand drukt hem per ongeluk weg.
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    const stage = document.getElementById("ceremony");
    if (!stage || stage.hidden) return;
    if (stage.classList.contains("ceremony--flight")) event.preventDefault();
  });

  admin.register(function () {
    if (document.getElementById("executie-setup")) renderSetup();
  });
})(window.WIDM);

/* ==========================================================================
   game.js — domain logic

   Scores are never stored: a result only holds the answers a player gave.
   Everything else (score, average, ranking) is derived here, so correcting
   a question in the admin instantly corrects every score that depends on it.
   ========================================================================== */

window.WIDM = window.WIDM || {};

(function (WIDM) {
  "use strict";

  const data = WIDM.data;

  /* ------------------------------------------------------------------------
     Raw collections
     ------------------------------------------------------------------------ */
  function game() {
    return data.get("game") || {};
  }

  function settings() {
    return data.get("settings") || {};
  }

  function players() {
    return data.get("players") || [];
  }

  function questions() {
    return data.get("questions") || [];
  }

  function tests() {
    return (data.get("tests") || []).slice().sort(function (a, b) {
      return a.day - b.day;
    });
  }

  function results() {
    return data.get("results") || [];
  }

  function playerById(id) {
    return players().find(function (player) {
      return player.id === id;
    }) || null;
  }

  /** Monogram for avatars and the board — players may set their own. */
  function initialsOf(player) {
    if (!player) return "??";
    return player.initials || WIDM.util.initials(player.name);
  }

  function jokers() {
    return data.get("jokers") || [];
  }

  function envelopes() {
    return data.get("envelopes") || [];
  }

  /**
   * Hoeveel jokers een speler op een dag heeft. Elke joker maakt straks een
   * fout antwoord goed. Spelers zien hier niets van.
   */
  function jokersFor(playerId, day) {
    return jokers()
      .filter(function (joker) {
        return joker.playerId === playerId && Number(joker.day) === Number(day);
      })
      .reduce(function (sum, joker) {
        return sum + (Number(joker.count) || 0);
      }, 0);
  }

  /** Spelers die nog in het spel zitten. */
  function activePlayers() {
    return players().filter(function (player) {
      return !player.eliminated;
    });
  }

  function eliminatedPlayers() {
    return players().filter(function (player) {
      return player.eliminated;
    });
  }

  /* ----------------------------------------------------------------------
     De poort: voor de opening komt alleen de spelleider binnen
     ---------------------------------------------------------------------- */
  const BYPASS_KEY = "widm.bypass.v1";

  /** Het moment waarop de site opengaat. Geen waarde = altijd open. */
  function opensAt() {
    const raw = game().opensAt;
    if (!raw) return null;
    const moment = new Date(raw);
    return isNaN(moment.getTime()) ? null : moment;
  }

  function msUntilOpen() {
    const moment = opensAt();
    return moment ? moment.getTime() - Date.now() : 0;
  }

  function isBeforeOpening() {
    return msUntilOpen() > 0;
  }

  /** Ontgrendeling geldt per toestel, niet voor iedereen. */
  function isBypassed() {
    try {
      return window.localStorage.getItem(BYPASS_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function isLocked() {
    return isBeforeOpening() && !isBypassed();
  }

  /** Opent de poort op dit toestel als de toegangscode klopt. */
  function unlockWith(code) {
    if (String(settings().adminPin) !== String(code).trim()) return false;
    try {
      window.localStorage.setItem(BYPASS_KEY, "1");
    } catch (error) {
      return false;
    }
    return true;
  }

  /** Wat de groep tot nu toe verdiend heeft. Geen maximum meer. */
  function earned() {
    const info = game();
    return Number(info.earned !== undefined ? info.earned : info.pot) || 0;
  }

  /**
   * Avatar van een speler: foto als die er is, anders de initialen.
   * De foto is een data-URI in players.json — zie de spelerseditor.
   */
  function avatar(player, className) {
    const classes = "avatar" + (className ? " " + className : "");
    if (player && player.photo) {
      return (
        '<span class="' + classes + ' avatar--photo">' +
        '<img src="' + WIDM.util.esc(player.photo) + '" alt=""></span>'
      );
    }
    return '<span class="' + classes + '">' + WIDM.util.esc(initialsOf(player)) + "</span>";
  }

  function testForDay(day) {
    return tests().find(function (test) {
      return Number(test.day) === Number(day);
    }) || null;
  }

  function questionById(id) {
    return questions().find(function (question) {
      return question.id === id;
    }) || null;
  }

  function questionsForDay(day) {
    return questions().filter(function (question) {
      return Number(question.day) === Number(day);
    });
  }

  /**
   * The questions of a test, in order. `questionIds` is authoritative; if it
   * is missing or empty we fall back to every question tagged with that day.
   */
  function questionsForTest(test) {
    if (!test) return [];
    if (Array.isArray(test.questionIds) && test.questionIds.length) {
      return test.questionIds
        .map(questionById)
        .filter(Boolean);
    }
    return questionsForDay(test.day);
  }

  /* ------------------------------------------------------------------------
     Results & scoring
     ------------------------------------------------------------------------ */
  function resultFor(playerId, day) {
    return results().find(function (result) {
      return result.playerId === playerId && Number(result.day) === Number(day);
    }) || null;
  }

  function resultsForDay(day) {
    return results().filter(function (result) {
      return Number(result.day) === Number(day);
    });
  }

  function resultsForPlayer(playerId) {
    return results()
      .filter(function (result) {
        return result.playerId === playerId;
      })
      .sort(function (a, b) {
        return a.day - b.day;
      });
  }

  /**
   * { correct, wrong, total, jokersUsed, percentage } voor een ingeleverde test.
   *
   * Jokers worden hier verrekend: elke joker maakt een fout antwoord alsnog
   * goed. Dat gebeurt volledig op de achtergrond — de speler ziet zijn score
   * toch nooit, en in de adminoverzichten staat erbij hoeveel jokers meetelden.
   */
  function scoreResult(result) {
    if (!result) return { correct: 0, wrong: 0, total: 0, jokersUsed: 0, percentage: 0 };

    const list = questionsForTest(testForDay(result.day));
    let correct = 0;
    list.forEach(function (question, index) {
      if (result.answers[index] === question.correctAnswer) correct += 1;
    });

    const total = list.length;
    const jokersUsed = Math.min(total - correct, jokersFor(result.playerId, result.day));
    const scored = correct + jokersUsed;

    return {
      correct: scored,
      wrong: total - scored,
      total: total,
      raw: correct,
      jokersUsed: jokersUsed,
      percentage: total ? Math.round((scored / total) * 100) : 0,
    };
  }

  /** Per-question breakdown, used by the results page. */
  function reviewResult(result) {
    const list = questionsForTest(testForDay(result.day));
    return list.map(function (question, index) {
      const given = result.answers[index];
      return {
        question: question,
        given: given,
        correct: question.correctAnswer,
        isCorrect: given === question.correctAnswer,
      };
    });
  }

  /* ------------------------------------------------------------------------
     Statistics
     ------------------------------------------------------------------------ */
  /**
   * Everything the stats page needs for one player, including a row for
   * every test day — also the ones they have not taken.
   */
  function playerStats(playerId) {
    const all = tests();
    const byDay = all.map(function (test) {
      const result = resultFor(playerId, test.day);
      const score = result ? scoreResult(result) : null;
      return {
        day: test.day,
        title: test.title,
        available: !!test.available,
        done: !!result,
        result: result,
        score: score,
        total: questionsForTest(test).length,
      };
    });

    const taken = byDay.filter(function (row) {
      return row.done;
    });

    const scores = taken.map(function (row) {
      return row.score.correct;
    });

    const totalCorrect = scores.reduce(function (sum, value) {
      return sum + value;
    }, 0);

    const totalQuestions = taken.reduce(function (sum, row) {
      return sum + row.score.total;
    }, 0);

    const totalTime = taken.reduce(function (sum, row) {
      return sum + (Number(row.result.durationSeconds) || 0);
    }, 0);

    return {
      playerId: playerId,
      byDay: byDay,
      testsTaken: taken.length,
      testsTotal: all.length,
      totalCorrect: totalCorrect,
      totalWrong: totalQuestions - totalCorrect,
      totalQuestions: totalQuestions,
      average: taken.length ? totalCorrect / taken.length : 0,
      best: scores.length ? Math.max.apply(null, scores) : null,
      worst: scores.length ? Math.min.apply(null, scores) : null,
      totalTime: totalTime,
      percentage: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    };
  }

  /**
   * The full ranking. Ties break on total time (faster first), then name, so
   * the order is stable between renders.
   */
  function standings() {
    const rows = players().map(function (player) {
      const stats = playerStats(player.id);
      return {
        player: player,
        stats: stats,
        points: stats.totalCorrect,
        testsTaken: stats.testsTaken,
        totalTime: stats.totalTime,
      };
    });

    rows.sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      if (a.testsTaken !== b.testsTaken) return b.testsTaken - a.testsTaken;
      if (a.totalTime !== b.totalTime) return a.totalTime - b.totalTime;
      return a.player.name.localeCompare(b.player.name, "nl");
    });

    // Shared points share a rank ("1, 2, 2, 4").
    let lastPoints = null;
    let lastRank = 0;
    rows.forEach(function (row, index) {
      if (row.points !== lastPoints) {
        lastRank = index + 1;
        lastPoints = row.points;
      }
      row.rank = lastRank;
    });

    return rows;
  }

  function rankOf(playerId) {
    const row = standings().find(function (entry) {
      return entry.player.id === playerId;
    });
    return row ? row.rank : null;
  }

  /** Per-day ranking, used on the results page. */
  function dayStandings(day) {
    const rows = resultsForDay(day)
      .map(function (result) {
        return {
          player: playerById(result.playerId),
          result: result,
          score: scoreResult(result),
        };
      })
      .filter(function (row) {
        return row.player;
      });

    rows.sort(function (a, b) {
      if (b.score.correct !== a.score.correct) return b.score.correct - a.score.correct;
      return (a.result.durationSeconds || 0) - (b.result.durationSeconds || 0);
    });

    rows.forEach(function (row, index) {
      row.rank = index + 1;
    });

    return rows;
  }

  /* ------------------------------------------------------------------------
     Test availability
     ------------------------------------------------------------------------ */
  /** 'locked' | 'open' | 'done' | 'empty' */
  function testStatus(day, playerId) {
    const test = testForDay(day);
    if (!test) return "locked";
    if (resultFor(playerId, day)) return "done";
    if (!test.available) return "locked";
    if (!questionsForTest(test).length) return "empty";
    return "open";
  }

  /**
   * The test a player should be doing right now: the current day if it is
   * open, otherwise the lowest-numbered open day they still owe.
   */
  function openTestFor(playerId) {
    const current = testForDay(game().currentDay);
    if (current && testStatus(current.day, playerId) === "open") return current;
    return (
      tests().find(function (test) {
        return testStatus(test.day, playerId) === "open";
      }) || null
    );
  }

  function completedCount(playerId) {
    return resultsForPlayer(playerId).length;
  }



  /* ------------------------------------------------------------------------
     De executie
     ------------------------------------------------------------------------ */
  /**
   * Wie staat er het slechtst voor op de test van deze dag?
   *
   * Minste goede antwoorden eerst; bij gelijke stand de langzaamste, precies
   * zoals in de uitzending. Wie niets heeft ingeleverd staat bovenaan. Jokers
   * tellen gewoon mee — daar zijn ze voor.
   *
   * Dit is nadrukkelijk een voorstel: de spelleider beslist.
   */
  function eliminationRanking(day) {
    return activePlayers()
      .map(function (player) {
        const result = resultFor(player.id, day);
        const score = result ? scoreResult(result) : null;
        return {
          player: player,
          result: result,
          score: score,
          correct: score ? score.correct : -1,
          seconds: result ? Number(result.durationSeconds) || 0 : Infinity,
          submitted: !!result,
        };
      })
      .sort(function (a, b) {
        if (a.correct !== b.correct) return a.correct - b.correct;
        if (a.seconds !== b.seconds) return b.seconds - a.seconds;
        return a.player.name.localeCompare(b.player.name, "nl");
      });
  }

  /** Wie de spelleider heeft aangewezen, maar nog niet is onthuld. */
  function pendingEliminations() {
    return players().filter(function (player) {
      return player.pendingElimination;
    });
  }

  /* ------------------------------------------------------------------------
     Submitting a test
     ------------------------------------------------------------------------ */
  /**
   * Store a completed test in the local overlay.
   * Returns the stored result. Throws if the day is not open for this player.
   */
  function submitTest(playerId, day, answers, durationSeconds) {
    const test = testForDay(day);
    if (!test) throw new Error("Deze test bestaat niet.");
    if (!test.available) throw new Error("Deze test is nog verzegeld.");

    const existing = resultFor(playerId, day);
    if (existing && !settings().allowRetake) {
      throw new Error("Je hebt deze test al voltooid.");
    }

    const record = {
      playerId: playerId,
      day: Number(day),
      answers: answers.slice(),
      submittedAt: new Date().toISOString(),
      durationSeconds: Math.round(durationSeconds || 0),
    };

    data.update("results", function (list) {
      const next = list.filter(function (result) {
        return !(result.playerId === playerId && Number(result.day) === Number(day));
      });
      next.push(record);
      return next;
    });

    return record;
  }

  /* ------------------------------------------------------------------------
     Flavour text
     ------------------------------------------------------------------------ */
  const VERDICTS = [
    { min: 100, text: "Je hebt alles gezien. Of je hebt hem geholpen." },
    { min: 80, text: "Je verdenking groeit." },
    { min: 60, text: "Je bent op het juiste spoor." },
    { min: 40, text: "De mist trekt nog niet op." },
    { min: 20, text: "Er ontgaat je meer dan je denkt." },
    { min: 0, text: "Je hebt vandaag niets gezien." },
  ];

  function verdict(percentage) {
    const match = VERDICTS.find(function (entry) {
      return percentage >= entry.min;
    });
    return match ? match.text : VERDICTS[VERDICTS.length - 1].text;
  }

  /**
   * Jouw kompas: welke namen jij het vaakst hebt aangewezen.
   *
   * Bewust NIET afgeleid van goed of fout — dat zou verraden of je verdenking
   * klopt. Dit telt alleen de antwoorden die je zelf gaf en die een spelersnaam
   * zijn. Vragen met een getal of een kleur als antwoord tellen niet mee.
   */
  function compass(playerId) {
    const names = {};
    players().forEach(function (player) {
      names[player.name.toLowerCase()] = player.name;
    });

    const tally = {};
    let total = 0;

    resultsForPlayer(playerId).forEach(function (result) {
      const list = questionsForTest(testForDay(result.day));
      list.forEach(function (question, index) {
        const given = result.answers[index];
        if (given === undefined || given < 0) return;
        const answer = question.answers[given];
        const match = names[String(answer || "").toLowerCase()];
        if (!match) return;
        tally[match] = (tally[match] || 0) + 1;
        total += 1;
      });
    });

    const rows = Object.keys(tally)
      .map(function (name) {
        return { name: name, count: tally[name], share: Math.round((tally[name] / total) * 100) };
      })
      .sort(function (a, b) {
        return b.count - a.count || a.name.localeCompare(b.name, "nl");
      });

    return { rows: rows, total: total, leader: rows.length ? rows[0] : null };
  }

  WIDM.game = {
    game: game,
    settings: settings,
    players: players,
    questions: questions,
    tests: tests,
    results: results,
    playerById: playerById,
    initialsOf: initialsOf,
    avatar: avatar,
    jokers: jokers,
    jokersFor: jokersFor,
    envelopes: envelopes,
    activePlayers: activePlayers,
    eliminatedPlayers: eliminatedPlayers,
    earned: earned,
    opensAt: opensAt,
    msUntilOpen: msUntilOpen,
    isBeforeOpening: isBeforeOpening,
    isBypassed: isBypassed,
    isLocked: isLocked,
    unlockWith: unlockWith,
    questionById: questionById,
    testForDay: testForDay,
    questionsForDay: questionsForDay,
    questionsForTest: questionsForTest,
    resultFor: resultFor,
    resultsForDay: resultsForDay,
    resultsForPlayer: resultsForPlayer,
    scoreResult: scoreResult,
    reviewResult: reviewResult,
    playerStats: playerStats,
    standings: standings,
    dayStandings: dayStandings,
    rankOf: rankOf,
    testStatus: testStatus,
    openTestFor: openTestFor,
    completedCount: completedCount,
    eliminationRanking: eliminationRanking,
    pendingEliminations: pendingEliminations,
    submitTest: submitTest,
    verdict: verdict,
    compass: compass,
  };
})(window.WIDM);

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

  /** { correct, wrong, total, percentage } for a single submitted test. */
  function scoreResult(result) {
    if (!result) return { correct: 0, wrong: 0, total: 0, percentage: 0 };
    const list = questionsForTest(testForDay(result.day));
    let correct = 0;
    list.forEach(function (question, index) {
      if (result.answers[index] === question.correctAnswer) correct += 1;
    });
    const total = list.length;
    return {
      correct: correct,
      wrong: total - correct,
      total: total,
      percentage: total ? Math.round((correct / total) * 100) : 0,
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

  /** How full the pot is, 0–100. */
  function potProgress() {
    const info = game();
    const max = Number(info.maxPot) || 0;
    if (!max) return 0;
    return Math.min(100, Math.round((Number(info.pot) || 0) / max * 100));
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

  /** A rough "how much did this player miss" reading, for atmosphere. */
  function suspicion(percentage) {
    const level = 100 - percentage;
    let label = "Onopvallend";
    if (level >= 70) label = "Zeer verdacht";
    else if (level >= 50) label = "Verdacht";
    else if (level >= 30) label = "Twijfelachtig";
    return { level: level, label: label };
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
    potProgress: potProgress,
    submitTest: submitTest,
    verdict: verdict,
    suspicion: suspicion,
  };
})(window.WIDM);

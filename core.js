(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GomokuCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function createBoard(size = 15) {
    return { size, cells: new Int8Array(size * size) };
  }

  function placeStone(board, x, y, color) {
    const { size, cells } = board;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    if (color !== 1 && color !== 2) return false;
    const index = y * size + x;
    if (cells[index] !== 0) return false;
    cells[index] = color;
    return true;
  }

  const DIRECTIONS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  function collectLine(board, x, y, color, dx, dy) {
    const { size, cells } = board;
    let startX = x;
    let startY = y;

    while (
      startX - dx >= 0 &&
      startX - dx < size &&
      startY - dy >= 0 &&
      startY - dy < size &&
      cells[(startY - dy) * size + (startX - dx)] === color
    ) {
      startX -= dx;
      startY -= dy;
    }

    const line = [];
    let cx = startX;
    let cy = startY;
    while (
      cx >= 0 &&
      cx < size &&
      cy >= 0 &&
      cy < size &&
      cells[cy * size + cx] === color
    ) {
      line.push({ x: cx, y: cy });
      cx += dx;
      cy += dy;
    }

    return line;
  }

  function findWinner(board, lastMove) {
    if (!lastMove) return null;
    const { size, cells } = board;
    const { x, y } = lastMove;
    if (x < 0 || x >= size || y < 0 || y >= size) return null;
    const color = cells[y * size + x];
    if (color === 0) return null;

    for (const [dx, dy] of DIRECTIONS) {
      const line = collectLine(board, x, y, color, dx, dy);
      if (line.length >= 5) return { color, line };
    }

    return null;
  }

  function isFull(board) {
    return board.cells.every((cell) => cell !== 0);
  }

  function emptyPoints(board) {
    const { size, cells } = board;
    const points = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (cells[y * size + x] === 0) points.push({ x, y });
      }
    }
    return points;
  }

  function wouldWin(board, point, color) {
    const { size, cells } = board;
    const index = point.y * size + point.x;
    if (cells[index] !== 0) return false;
    cells[index] = color;
    const won = findWinner(board, point) !== null;
    cells[index] = 0;
    return won;
  }

  function countInDirection(board, x, y, dx, dy, color) {
    const { size, cells } = board;
    let count = 0;
    let cx = x + dx;
    let cy = y + dy;
    while (
      cx >= 0 &&
      cx < size &&
      cy >= 0 &&
      cy < size &&
      cells[cy * size + cx] === color
    ) {
      count += 1;
      cx += dx;
      cy += dy;
    }
    const open =
      cx >= 0 && cx < size && cy >= 0 && cy < size && cells[cy * size + cx] === 0;
    return { count, open };
  }

  function lineScore(length, openEnds) {
    if (length >= 5) return 1000000;
    if (length === 4) {
      if (openEnds === 2) return 100000;
      if (openEnds === 1) return 10000;
      return 0;
    }
    if (length === 3) {
      if (openEnds === 2) return 8000;
      if (openEnds === 1) return 1000;
      return 0;
    }
    if (length === 2) {
      if (openEnds === 2) return 500;
      if (openEnds === 1) return 100;
      return 0;
    }
    if (length === 1) return openEnds === 2 ? 10 : 0;
    return 0;
  }

  function pointPatternScore(board, x, y, color) {
    let score = 0;
    for (const [dx, dy] of DIRECTIONS) {
      const forward = countInDirection(board, x, y, dx, dy, color);
      const backward = countInDirection(board, x, y, -dx, -dy, color);
      const length = 1 + forward.count + backward.count;
      const openEnds = (forward.open ? 1 : 0) + (backward.open ? 1 : 0);
      score += lineScore(length, openEnds);
    }
    return score;
  }

  function hasStoneNear(board, x, y) {
    const radius = 2;
    const { size, cells } = board;
    const minX = Math.max(0, x - radius);
    const maxX = Math.min(size - 1, x + radius);
    const minY = Math.max(0, y - radius);
    const maxY = Math.min(size - 1, y + radius);
    for (let cy = minY; cy <= maxY; cy += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        if (cells[cy * size + cx] !== 0) return true;
      }
    }
    return false;
  }

  function generateCandidates(board, color, limit = 30) {
    const { size, cells } = board;
    const scored = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (cells[y * size + x] !== 0) continue;
        if (!hasStoneNear(board, x, y)) continue;
        const attack = pointPatternScore(board, x, y, color);
        const defend = pointPatternScore(board, x, y, 3 - color);
        scored.push({ x, y, score: attack + defend * 0.9 });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  function pickWeighted(candidates, rng) {
    const top = candidates.slice(0, 5);
    const weights = top.map((candidate) => Math.max(candidate.score, 1));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = rng() * total;
    for (let i = 0; i < top.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) return { x: top[i].x, y: top[i].y };
    }
    return { x: top[top.length - 1].x, y: top[top.length - 1].y };
  }

  const OTHER_COLOR = { 1: 2, 2: 1 };
  const WIN_SCORE = 10000000;
  const AI_TIMEOUT = 'AI_TIMEOUT';

  function inBounds(board, x, y) {
    return x >= 0 && x < board.size && y >= 0 && y < board.size;
  }

  function evaluateBoard(board, perspective) {
    const { size, cells } = board;
    let mine = 0;
    let theirs = 0;

    for (const [dx, dy] of DIRECTIONS) {
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const color = cells[y * size + x];
          if (color === 0) continue;

          const prevX = x - dx;
          const prevY = y - dy;
          if (
            inBounds(board, prevX, prevY) &&
            cells[prevY * size + prevX] === color
          ) {
            continue;
          }

          let length = 0;
          let cx = x;
          let cy = y;
          while (
            inBounds(board, cx, cy) &&
            cells[cy * size + cx] === color
          ) {
            length += 1;
            cx += dx;
            cy += dy;
          }

          let openEnds = 0;
          if (
            inBounds(board, prevX, prevY) &&
            cells[prevY * size + prevX] === 0
          ) {
            openEnds += 1;
          }
          if (inBounds(board, cx, cy) && cells[cy * size + cx] === 0) {
            openEnds += 1;
          }

          const value = lineScore(length, openEnds);
          if (color === perspective) mine += value;
          else theirs += value;
        }
      }
    }

    return mine - theirs * 1.1;
  }

  function search(board, color, depth, alpha, beta, deadline, rootDepth) {
    if (Date.now() >= deadline) throw new Error(AI_TIMEOUT);
    if (depth === 0) return evaluateBoard(board, color);

    const candidates = generateCandidates(board, color, depth >= 4 ? 10 : 12);
    if (candidates.length === 0) return evaluateBoard(board, color);

    let best = -Infinity;
    for (const candidate of candidates) {
      const index = candidate.y * board.size + candidate.x;
      board.cells[index] = color;
      try {
        let score;
        if (findWinner(board, candidate) !== null) {
          score = WIN_SCORE - (rootDepth - depth);
        } else {
          score = -search(
            board,
            OTHER_COLOR[color],
            depth - 1,
            -beta,
            -alpha,
            deadline,
            rootDepth,
          );
        }
        if (score > best) best = score;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      } finally {
        board.cells[index] = 0;
      }
    }

    return best;
  }

  function pickNearBest(results, rng) {
    const best = Math.max(...results.map((entry) => entry.score));
    const tolerance = Math.max(Math.abs(best) * 0.01, 1);
    const near = results.filter((entry) => best - entry.score <= tolerance);
    const chosen = near[Math.floor(rng() * near.length)];
    return { x: chosen.x, y: chosen.y };
  }

  function chooseBySearch(board, color, difficulty, rng, candidates, deadline) {
    const maxDepth = difficulty === 'hard' ? 6 : 2;
    const pool = candidates || generateCandidates(board, color, 30);
    if (pool.length === 0) return null;

    let results = null;

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const current = [];
      let alpha = -Infinity;

      try {
        for (const candidate of pool) {
          const index = candidate.y * board.size + candidate.x;
          board.cells[index] = color;
          let score;
          try {
            if (findWinner(board, candidate) !== null) {
              score = WIN_SCORE;
            } else {
              score = -search(
                board,
                OTHER_COLOR[color],
                depth - 1,
                -Infinity,
                -alpha,
                deadline,
                depth,
              );
            }
          } finally {
            board.cells[index] = 0;
          }
          current.push({ x: candidate.x, y: candidate.y, score });
          if (score > alpha) alpha = score;
        }
      } catch (error) {
        if (error.message !== AI_TIMEOUT) throw error;
        break;
      }

      results = current;
      const rank = new Map(
        current
          .slice()
          .sort((a, b) => b.score - a.score)
          .map((entry, index) => [`${entry.x},${entry.y}`, index]),
      );
      pool.sort(
        (a, b) =>
          (rank.get(`${a.x},${a.y}`) ?? 0) - (rank.get(`${b.x},${b.y}`) ?? 0),
      );

      if (results.some((entry) => entry.score >= WIN_SCORE)) break;
      if (Date.now() >= deadline) break;
    }

    if (!results) return pickWeighted(pool, rng);
    return pickNearBest(results, rng);
  }

  function chooseMove(board, color, difficulty, options = {}) {
    const rng = options.rng || Math.random;
    const budget = options.timeBudgetMs || 500;
    const deadline = difficulty === 'hard' ? Date.now() + budget - 25 : Infinity;
    const empties = emptyPoints(board);
    if (empties.length === 0) return null;
    if (empties.length === board.size * board.size) {
      const middle = Math.floor(board.size / 2);
      return { x: middle, y: middle };
    }

    for (const point of empties) {
      if (wouldWin(board, point, color)) return point;
    }

    const opponent = 3 - color;
    for (const point of empties) {
      if (wouldWin(board, point, opponent)) return point;
    }

    const candidates = generateCandidates(board, color);
    if (candidates.length === 0) return empties[0];

    if (difficulty === 'easy') return pickWeighted(candidates, rng);
    return chooseBySearch(board, color, difficulty, rng, candidates, deadline);
  }

  const DIFFICULTIES = ['easy', 'normal', 'hard'];

  function createGame(options = {}) {
    const game = {
      size: options.size || 15,
      humanColor: options.humanColor === 2 ? 2 : 1,
      difficulty: DIFFICULTIES.includes(options.difficulty)
        ? options.difficulty
        : 'normal',
      rng: options.rng || Math.random,
      timeBudgetMs: options.timeBudgetMs,
      board: null,
      turn: 1,
      status: 'playing',
      lastMove: null,
      winner: null,
      history: [],
    };

    game.board = createBoard(game.size);

    function applyMove(point, color) {
      if (!placeStone(game.board, point.x, point.y, color)) return false;

      game.history.push({ x: point.x, y: point.y, color });
      game.lastMove = { x: point.x, y: point.y };

      const won = findWinner(game.board, game.lastMove);
      if (won) {
        game.status = 'won';
        game.winner = won;
      } else if (isFull(game.board)) {
        game.status = 'draw';
        game.winner = null;
      } else {
        game.status = 'playing';
        game.winner = null;
      }

      game.turn = color === 1 ? 2 : 1;
      return true;
    }

    game.humanMove = function humanMove(x, y) {
      if (game.status !== 'playing') {
        return { ok: false, error: 'game-over', status: game.status };
      }
      if (game.turn !== game.humanColor) {
        return { ok: false, error: 'not-your-turn', status: game.status };
      }
      if (!applyMove({ x, y }, game.humanColor)) {
        return { ok: false, error: 'illegal-move', status: game.status };
      }
      return { ok: true, status: game.status };
    };

    game.aiMove = function aiMove() {
      if (game.status !== 'playing') {
        return { ok: false, status: game.status };
      }
      if (game.turn === game.humanColor) {
        return { ok: false, status: game.status };
      }

      const color = game.turn;
      const point = chooseMove(game.board, color, game.difficulty, {
        rng: game.rng,
        timeBudgetMs: game.timeBudgetMs,
      });

      if (!point || !applyMove(point, color)) {
        return { ok: false, status: game.status };
      }

      return { ok: true, point, status: game.status };
    };

    game.undo = function undo() {
      if (game.status !== 'playing') return false;
      if (game.turn !== game.humanColor) return false;
      if (game.history.length < 2) return false;

      const last = game.history[game.history.length - 1];
      const previous = game.history[game.history.length - 2];
      const aiColor = 3 - game.humanColor;
      if (last.color !== aiColor || previous.color !== game.humanColor) {
        return false;
      }

      for (const move of [last, previous]) {
        game.board.cells[move.y * game.size + move.x] = 0;
      }

      game.history.length -= 2;
      game.turn = game.humanColor;
      game.status = 'playing';
      game.winner = null;

      const tail = game.history[game.history.length - 1];
      game.lastMove = tail ? { x: tail.x, y: tail.y } : null;
      return true;
    };

    game.restart = function restart(nextOptions = {}) {
      if (nextOptions.size) game.size = nextOptions.size;
      if (nextOptions.humanColor === 1 || nextOptions.humanColor === 2) {
        game.humanColor = nextOptions.humanColor;
      }
      if (DIFFICULTIES.includes(nextOptions.difficulty)) {
        game.difficulty = nextOptions.difficulty;
      }
      if (nextOptions.rng) game.rng = nextOptions.rng;
      if (nextOptions.timeBudgetMs !== undefined) {
        game.timeBudgetMs = nextOptions.timeBudgetMs;
      }

      game.board = createBoard(game.size);
      game.turn = 1;
      game.status = 'playing';
      game.lastMove = null;
      game.winner = null;
      game.history = [];
    };

    return game;
  }

  return { createBoard, placeStone, findWinner, isFull, chooseMove, createGame };
});

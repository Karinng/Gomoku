const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./core.js');

function seededRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function midgameBoard() {
  const board = core.createBoard();
  const stones = [
    [7, 7, 1],
    [8, 8, 2],
    [6, 8, 1],
    [8, 6, 2],
    [6, 6, 1],
    [9, 7, 2],
    [5, 7, 1],
    [9, 9, 2],
    [7, 9, 1],
    [6, 9, 2],
    [10, 8, 1],
    [4, 8, 2],
    [8, 9, 1],
    [5, 9, 2],
  ];
  for (const [x, y, color] of stones) core.placeStone(board, x, y, color);
  return board;
}

test('新棋盘是 15×15 的空棋盘', () => {
  const board = core.createBoard();
  assert.equal(board.size, 15);
  assert.equal(board.cells.length, 225);
  assert.equal(board.cells.filter((cell) => cell !== 0).length, 0);
});

test('可以在空交叉点落子', () => {
  const board = core.createBoard();
  assert.equal(core.placeStone(board, 7, 7, 1), true);
  assert.equal(board.cells[7 * 15 + 7], 1);
});

test('越界、已占用和非法颜色的落子会被拒绝且棋盘不变', () => {
  const board = core.createBoard();
  core.placeStone(board, 7, 7, 1);

  assert.equal(core.placeStone(board, 7, 7, 2), false);
  assert.equal(core.placeStone(board, -1, 0, 1), false);
  assert.equal(core.placeStone(board, 15, 0, 1), false);
  assert.equal(core.placeStone(board, 0, 0, 3), false);
  assert.equal(board.cells[7 * 15 + 7], 1);
  assert.equal(board.cells.filter((cell) => cell !== 0).length, 1);
});

test('横向五连判胜并返回连线', () => {
  const board = core.createBoard();
  for (let x = 3; x <= 7; x += 1) core.placeStone(board, x, 5, 1);

  const result = core.findWinner(board, { x: 7, y: 5 });

  assert.equal(result.color, 1);
  assert.deepEqual(result.line, [
    { x: 3, y: 5 },
    { x: 4, y: 5 },
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 7, y: 5 },
  ]);
});

test('竖直和两个斜线方向也能判胜', () => {
  const vertical = core.createBoard();
  for (let y = 2; y <= 6; y += 1) core.placeStone(vertical, 4, y, 2);
  assert.deepEqual(core.findWinner(vertical, { x: 4, y: 6 }).line, [
    { x: 4, y: 2 },
    { x: 4, y: 3 },
    { x: 4, y: 4 },
    { x: 4, y: 5 },
    { x: 4, y: 6 },
  ]);

  const down = core.createBoard();
  for (let i = 0; i < 5; i += 1) core.placeStone(down, 2 + i, 2 + i, 1);
  assert.deepEqual(core.findWinner(down, { x: 6, y: 6 }).line, [
    { x: 2, y: 2 },
    { x: 3, y: 3 },
    { x: 4, y: 4 },
    { x: 5, y: 5 },
    { x: 6, y: 6 },
  ]);

  const up = core.createBoard();
  for (let i = 0; i < 5; i += 1) core.placeStone(up, 2 + i, 6 - i, 2);
  assert.deepEqual(core.findWinner(up, { x: 6, y: 2 }).line, [
    { x: 2, y: 6 },
    { x: 3, y: 5 },
    { x: 4, y: 4 },
    { x: 5, y: 3 },
    { x: 6, y: 2 },
  ]);
});

test('六连以上也算胜，四连不算，棋盘边缘的五连也能判出', () => {
  const overline = core.createBoard();
  for (let x = 1; x <= 7; x += 1) core.placeStone(overline, x, 8, 1);
  const result = core.findWinner(overline, { x: 4, y: 8 });
  assert.equal(result.color, 1);
  assert.equal(result.line.length, 7);

  const four = core.createBoard();
  for (let x = 1; x <= 4; x += 1) core.placeStone(four, x, 8, 1);
  assert.equal(core.findWinner(four, { x: 4, y: 8 }), null);

  const edge = core.createBoard();
  for (let x = 0; x < 5; x += 1) core.placeStone(edge, x, 0, 2);
  assert.equal(core.findWinner(edge, { x: 0, y: 0 }).color, 2);
});

test('棋盘下满时 isFull 为真，有空格时为假', () => {
  const board = core.createBoard(3);
  assert.equal(core.isFull(board), false);

  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) core.placeStone(board, x, y, 1);
  }

  assert.equal(core.isFull(board), true);
});

test('三个难度档位都会立即下出制胜一手', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const board = core.createBoard();
    for (let x = 3; x <= 6; x += 1) core.placeStone(board, x, 7, 2);
    core.placeStone(board, 0, 0, 1);

    const move = core.chooseMove(board, 2, difficulty, { rng: () => 0.5 });

    assert.equal(move.y, 7);
    assert.ok(move.x === 2 || move.x === 7);
  }
});

test('三个难度档位都会堵住对方下一步成五的落点', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const board = core.createBoard();
    for (let x = 3; x <= 6; x += 1) core.placeStone(board, x, 7, 1);
    core.placeStone(board, 2, 7, 2);

    const move = core.chooseMove(board, 2, difficulty, { rng: () => 0.5 });

    assert.deepEqual(move, { x: 7, y: 7 });
  }
});

test('空棋盘时三个档位都落中心交叉点', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const move = core.chooseMove(core.createBoard(), 1, difficulty, {
      rng: () => 0.5,
    });

    assert.deepEqual(move, { x: 7, y: 7 });
  }
});

test('电脑对手只在已有棋子附近落子，且相同种子结果可复现', () => {
  const board = core.createBoard();
  core.placeStone(board, 7, 7, 1);
  core.placeStone(board, 8, 8, 2);
  core.placeStone(board, 6, 8, 1);
  core.placeStone(board, 8, 6, 2);
  const stones = [
    [7, 7],
    [8, 8],
    [6, 8],
    [8, 6],
  ];

  const first = core.chooseMove(board, 1, 'easy', { rng: seededRng(42) });
  const second = core.chooseMove(board, 1, 'easy', { rng: seededRng(42) });

  assert.deepEqual(first, second);
  assert.equal(board.cells[first.y * 15 + first.x], 0);
  assert.ok(
    stones.some(
      ([x, y]) =>
        Math.max(Math.abs(first.x - x), Math.abs(first.y - y)) <= 2,
    ),
  );
});

test('困难档会延伸自己的活三', () => {
  const board = core.createBoard();
  for (let x = 5; x <= 7; x += 1) core.placeStone(board, x, 7, 2);
  core.placeStone(board, 0, 0, 1);

  const move = core.chooseMove(board, 2, 'hard', {
    rng: seededRng(7),
    timeBudgetMs: 200,
  });

  assert.equal(move.y, 7);
  assert.ok(move.x === 4 || move.x === 8);
});

test('困难档会阻断对方的活三', () => {
  const board = core.createBoard();
  for (let x = 5; x <= 7; x += 1) core.placeStone(board, x, 7, 1);
  core.placeStone(board, 0, 0, 2);

  const move = core.chooseMove(board, 2, 'hard', {
    rng: seededRng(7),
    timeBudgetMs: 200,
  });

  assert.equal(move.y, 7);
  assert.ok(move.x === 4 || move.x === 8);
});

test('困难档在默认 500ms 预算内返回合法落点', () => {
  const board = midgameBoard();
  const startedAt = Date.now();

  const move = core.chooseMove(board, 1, 'hard', { rng: seededRng(3) });
  const elapsed = Date.now() - startedAt;

  assert.ok(move);
  assert.equal(board.cells[move.y * 15 + move.x], 0);
  assert.ok(elapsed <= 500, `困难档耗时 ${elapsed}ms，超过 500ms`);
});

test('困难档预算极小时仍返回合法落点', () => {
  const board = midgameBoard();

  const move = core.chooseMove(board, 1, 'hard', {
    rng: seededRng(3),
    timeBudgetMs: 1,
  });

  assert.ok(move);
  assert.equal(board.cells[move.y * 15 + move.x], 0);
});

function baselineMove(board, color) {
  const empties = [];
  for (let y = 0; y < board.size; y += 1) {
    for (let x = 0; x < board.size; x += 1) {
      if (board.cells[y * board.size + x] === 0) empties.push({ x, y });
    }
  }

  const wins = (point, stoneColor) => {
    const index = point.y * board.size + point.x;
    board.cells[index] = stoneColor;
    const won = core.findWinner(board, point) !== null;
    board.cells[index] = 0;
    return won;
  };

  for (const point of empties) {
    if (wins(point, color)) return point;
  }
  for (const point of empties) {
    if (wins(point, 3 - color)) return point;
  }
  return empties[0];
}

test(
  '困难档能稳定击败只会堵四的基线玩家',
  { timeout: 30000 },
  () => {
    for (let seed = 1; seed <= 3; seed += 1) {
      const board = core.createBoard();
      const aiColor = 1;
      let turn = 1;
      let winner = null;

      for (let ply = 0; ply < 200 && !winner; ply += 1) {
        const move =
          turn === aiColor
            ? core.chooseMove(board, turn, 'hard', {
                rng: seededRng(seed * 1000 + ply),
                timeBudgetMs: 100,
              })
            : baselineMove(board, turn);

        assert.ok(move, `种子 ${seed} 第 ${ply} 手无点可落`);
        assert.equal(core.placeStone(board, move.x, move.y, turn), true);
        winner = core.findWinner(board, move);
        turn = 3 - turn;
      }

      assert.ok(winner, `种子 ${seed} 的对局没有分出胜负`);
      assert.equal(winner.color, aiColor, `种子 ${seed} 的电脑对手没有获胜`);
    }
  },
);

test('人和电脑对手可以轮流落子', () => {
  const game = core.createGame({
    humanColor: 1,
    difficulty: 'easy',
    rng: seededRng(1),
  });

  const human = game.humanMove(7, 7);
  assert.equal(human.ok, true);
  assert.equal(game.turn, 2);

  const ai = game.aiMove();
  assert.equal(ai.ok, true);
  assert.equal(game.turn, 1);
  assert.equal(game.board.cells.filter((cell) => cell !== 0).length, 2);
});

test('不是玩家回合时落子会被拒绝', () => {
  const game = core.createGame({
    humanColor: 1,
    difficulty: 'easy',
    rng: seededRng(1),
  });

  game.humanMove(7, 7);
  const second = game.humanMove(8, 8);

  assert.equal(second.ok, false);
  assert.equal(second.error, 'not-your-turn');
  assert.equal(game.board.cells.filter((cell) => cell !== 0).length, 1);
});

test('悔棋撤销玩家和电脑对手各一步', () => {
  const game = core.createGame({
    humanColor: 1,
    difficulty: 'easy',
    rng: seededRng(1),
  });

  game.humanMove(7, 7);
  game.aiMove();
  assert.equal(game.board.cells.filter((cell) => cell !== 0).length, 2);

  assert.equal(game.undo(), true);
  assert.equal(game.board.cells.filter((cell) => cell !== 0).length, 0);
  assert.equal(game.turn, 1);
  assert.equal(game.lastMove, null);
});

test('电脑对手回合时不能悔棋', () => {
  const game = core.createGame({
    humanColor: 1,
    difficulty: 'easy',
    rng: seededRng(1),
  });

  game.humanMove(7, 7);

  assert.equal(game.turn, 2);
  assert.equal(game.undo(), false);
  assert.equal(game.board.cells.filter((cell) => cell !== 0).length, 1);
});

test('玩家执白且电脑对手只落了开局一子时不能悔棋', () => {
  const game = core.createGame({
    humanColor: 2,
    difficulty: 'easy',
    rng: seededRng(1),
  });

  const opening = game.aiMove();
  assert.equal(opening.ok, true);
  assert.equal(game.turn, 2);
  assert.equal(game.undo(), false);
  assert.equal(game.board.cells.filter((cell) => cell !== 0).length, 1);
});

test('重开会清空棋盘并保留难度和执子选择', () => {
  const game = core.createGame({
    humanColor: 2,
    difficulty: 'hard',
    rng: seededRng(1),
    timeBudgetMs: 50,
  });

  game.aiMove();
  game.humanMove(6, 6);
  game.restart({ difficulty: 'easy' });

  assert.equal(game.difficulty, 'easy');
  assert.equal(game.humanColor, 2);
  assert.equal(game.status, 'playing');
  assert.equal(game.turn, 1);
  assert.equal(game.board.cells.filter((cell) => cell !== 0).length, 0);
  assert.equal(game.history.length, 0);
});

test('棋盘下满判平局后不能再落子', () => {
  const game = core.createGame({
    size: 3,
    humanColor: 1,
    difficulty: 'easy',
    rng: seededRng(1),
  });

  for (let ply = 0; ply < 9; ply += 1) {
    if (game.turn === game.humanColor) {
      const index = game.board.cells.findIndex((cell) => cell === 0);
      const x = index % game.size;
      const y = Math.floor(index / game.size);
      game.humanMove(x, y);
    } else {
      game.aiMove();
    }
  }

  assert.equal(game.status, 'draw');
  const afterDraw = game.humanMove(0, 0);
  assert.equal(afterDraw.ok, false);
  assert.equal(afterDraw.error, 'game-over');
});

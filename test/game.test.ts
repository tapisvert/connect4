import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reduce, type Store, Table } from '@tapisvert/tapis';
import { connect4, type State } from '../src/game.ts';
import { render } from '../src/render.ts';

function table() {
  let i = 0;
  const t = new Table(connect4, { id: 'c', entropy: (n) => (i++).toString(16).padStart(n * 2, '0') });
  const seats = [t.join('x').token, t.join('o').token];
  return { t, play: (...cols: number[]) => cols.map((c) => t.act(seats[t.store?.game.turn ?? 0], 'drop', c)) };
}

test('four in a row wins, horizontally, vertically and on both diagonals', () => {
  const cases: [string, number[]][] = [
    ['horizontal', [0, 0, 1, 1, 2, 2, 3]],
    ['vertical', [4, 5, 4, 5, 4, 5, 4]],
    ['rising diagonal', [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]],
    ['falling diagonal', [6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]],
  ];
  for (const [name, moves] of cases) {
    const { t, play } = table();
    const results = play(...moves);
    assert.ok(results.every((r) => r.accepted), `${name}: ${results.map((r) => r.error).join(',')}`);
    assert.equal(t.phase, 'finished', name);
    assert.deepEqual(t.store?.outcome, { winners: [0], draw: false }, name);
    assert.equal(t.store?.game.line.length, 4, name);
  }
});

test('three in a row is not a win and play continues', () => {
  const { t, play } = table();
  play(0, 0, 1, 1, 2);
  assert.equal(t.phase, 'playing');
  assert.equal(t.store?.game.turn, 1);
});

test('wrong seat, a full column and a bad column are refused', () => {
  const { t, play } = table();
  play(0, 0, 0, 0, 0, 0);
  assert.equal(play(0)[0].error, 'column is full');
  assert.equal(play(7)[0].error, 'column must be 0-6');
  assert.equal(play(1.5)[0].error, 'column must be 0-6');
  assert.equal(t.store?.game.moves, 6);
});

test('a full board with no line is a draw', () => {
  // Columns filled in pairs 0-1, 2-3, 4-5 with shifted parity, then 6.
  const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
  const { t, play } = table();
  const r = play(...order);
  assert.ok(r.every((x) => x.accepted), r.map((x) => x.error).join(','));
  assert.deepEqual(t.store?.outcome, { winners: [], draw: true });
});

test('the reducer is pure over the store', () => {
  const { t } = table();
  const before = structuredClone(t.store) as Store<State>;
  reduce(connect4, before, { type: 'act', at: 0, seat: 0, action: 'drop', args: 3 });
  assert.deepEqual(before, t.store);
});

test('render marks the winning line', () => {
  const { t, play } = table();
  play(0, 0, 1, 1, 2, 2, 3);
  const text = render(t.store?.game as State);
  assert.match(text.split('\n')[5], /^\|\[X\]\[X\]\[X\]\[X\] \. {2}\. {2}\. \|$/);
});

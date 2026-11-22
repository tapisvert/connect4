import { type Game, GameError } from '@tapisvert/tapis';

export const COLUMNS = 7;
export const ROWS = 6;

export interface State {
  // board[row][col], row 0 at the bottom; -1 empty, otherwise the seat.
  board: number[][];
  turn: number;
  moves: number;
  last: { row: number; col: number } | null;
  winner: number | null;
  line: { row: number; col: number }[];
}

function fourFrom(board: number[][], row: number, col: number): { row: number; col: number }[] {
  const seat = board[row][col];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [{ row, col }];
    for (const sign of [1, -1]) {
      for (let k = 1; k < 4; k++) {
        const r = row + sign * k * dr;
        const c = col + sign * k * dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLUMNS || board[r][c] !== seat) break;
        line.push({ row: r, col: c });
      }
    }
    if (line.length >= 4) return line.sort((a, b) => a.col - b.col || a.row - b.row);
  }
  return [];
}

export const connect4: Game<State> = {
  id: 'connect4',
  version: '1',
  minSeats: 2,
  maxSeats: 2,
  setup: () => ({
    board: Array.from({ length: ROWS }, () => new Array(COLUMNS).fill(-1)),
    turn: 0,
    moves: 0,
    last: null,
    winner: null,
    line: [],
  }),
  act(s, { seat, action, args }) {
    if (action !== 'drop') throw new GameError(`unknown action ${action}`);
    if (seat !== s.turn) throw new GameError('not your turn');
    const col = args as number;
    if (!Number.isInteger(col) || col < 0 || col >= COLUMNS) throw new GameError(`column must be 0-${COLUMNS - 1}`);
    const row = s.board.findIndex((r) => r[col] === -1);
    if (row < 0) throw new GameError('column is full');
    s.board[row][col] = seat;
    s.moves++;
    s.last = { row, col };
    const line = fourFrom(s.board, row, col);
    if (line.length) {
      s.winner = seat;
      s.line = line;
    } else {
      s.turn = 1 - seat;
    }
    return s;
  },
  globalScene: (s) => ({ board: s.board, turn: s.turn, last: s.last, winner: s.winner, line: s.line }),
  outcome(s) {
    if (s.winner !== null) return { winners: [s.winner], draw: false };
    if (s.moves === ROWS * COLUMNS) return { winners: [], draw: true };
    return null;
  },
};

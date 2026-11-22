import { COLUMNS } from './game.ts';

export interface Scene {
  board: number[][];
  turn: number;
  last: { row: number; col: number } | null;
  winner: number | null;
  line: { row: number; col: number }[];
}

const DISC = ['X', 'O'];

// Plain-text board, top row first. The winning line is shown in brackets.
export function render(s: Scene): string {
  const win = new Set(s.line.map((p) => `${p.row},${p.col}`));
  const rows: string[] = [];
  for (let r = s.board.length - 1; r >= 0; r--) {
    let line = '|';
    for (let c = 0; c < COLUMNS; c++) {
      const v = s.board[r][c];
      const d = v < 0 ? '.' : DISC[v];
      line += win.has(`${r},${c}`) ? `[${d}]` : ` ${d} `;
    }
    rows.push(line + '|');
  }
  rows.push(' ' + Array.from({ length: COLUMNS }, (_, c) => ` ${c + 1} `).join(''));
  return rows.join('\n');
}

export function disc(seat: number): string {
  return DISC[seat] ?? '?';
}

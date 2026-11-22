#!/usr/bin/env node
import { networkInterfaces } from 'node:os';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { Host, Table, TapisClient, type View } from '@tapisvert/tapis';
import { COLUMNS, connect4 } from './game.ts';
import { disc, render, type Scene } from './render.ts';

const TABLE = 'connect4';
const USAGE = `usage:
  connect4 host [--bind 0.0.0.0] [--port 7474]
  connect4 play <host:port> [--name NAME] [--token TOKEN] [--auto]`;

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => (i as { address: string }).address);
}

async function host(bind: string, port: number): Promise<void> {
  const h = new Host();
  const table = new Table(connect4, { id: TABLE });
  h.add(table);
  const bound = await h.listen(`${bind}:${port}`);
  const addrs = bind === '0.0.0.0' ? lanAddresses() : [bind];
  console.log(`connect4 table open on port ${bound}. Players join with:`);
  for (const a of addrs) console.log(`  connect4 play ${a}:${bound}`);
  let over = false;
  table.watch('', (u) => {
    if (u.phase === 'finished' && !over) {
      over = true;
      const o = u.outcome;
      console.log(o?.draw ? 'game over: draw' : `game over: ${disc(o?.winners[0] ?? -1)} wins`);
      setTimeout(() => h.close().then(() => process.exit(0)), 2000);
    }
  });
}

function legalColumns(s: Scene): number[] {
  const top = s.board[s.board.length - 1];
  return Array.from({ length: COLUMNS }, (_, c) => c).filter((c) => top[c] === -1);
}

async function play(address: string, name: string, token: string, auto: boolean): Promise<number> {
  const client = new TapisClient(address, TABLE);
  const me = await client.join(name, token);
  console.log(`seat ${me.seat} (${disc(me.seat)}). Rejoin with --token ${me.token}`);
  let view: View | null = null;
  let asked = -1;
  const rl = auto ? null : createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    const finish = (code: number) => {
      stop();
      rl?.close();
      client.close();
      resolve(code);
    };
    const move = async (col: number) => {
      const v = view as View;
      const r = await client.act('drop', col, v.version);
      if (!r.accepted) {
        console.log(`refused: ${r.error}`);
        asked = -1;
        prompt();
      }
    };
    const prompt = () => {
      const v = view;
      if (!v || v.phase !== 'playing' || asked === v.version) return;
      const s = v.global as unknown as Scene;
      if (s.turn !== me.seat) return;
      asked = v.version;
      if (auto) {
        const cols = legalColumns(s);
        setTimeout(() => void move(cols[Math.floor(Math.random() * cols.length)]), 20);
      } else {
        process.stdout.write(`your move (${disc(me.seat)}), column 1-${COLUMNS}: `);
      }
    };
    rl?.on('line', (line) => {
      const v = view;
      if (!v || v.phase !== 'playing' || (v.global as unknown as Scene).turn !== me.seat) return;
      const n = Number(line.trim());
      if (!Number.isInteger(n) || n < 1 || n > COLUMNS) {
        process.stdout.write(`column 1-${COLUMNS}: `);
        return;
      }
      void move(n - 1);
    });
    const stop = client.watch(
      (v) => {
        view = v;
        if (v.phase === 'waiting') {
          console.log(`waiting for players (${v.seats.length}/2)`);
          return;
        }
        const s = v.global as unknown as Scene;
        if (!auto) console.log('\n' + render(s));
        if (v.phase === 'finished') {
          if (auto) console.log(render(s));
          const o = v.outcome;
          console.log(o?.draw ? 'draw' : o?.winners[0] === me.seat ? 'you win' : 'you lose');
          console.log(`result ${o?.draw ? 'draw' : disc(o?.winners[0] ?? -1)} after version ${v.version}`);
          finish(0);
          return;
        }
        if (!auto && s.turn !== me.seat) console.log(`waiting for ${disc(s.turn)}`);
        prompt();
      },
      (e) => {
        console.error(`connection lost: ${e.message}`);
        finish(1);
      },
    );
  });
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      bind: { type: 'string', default: '0.0.0.0' },
      port: { type: 'string', default: '7474' },
      name: { type: 'string', default: '' },
      token: { type: 'string', default: '' },
      auto: { type: 'boolean', default: false },
    },
  });
  const [cmd, address] = positionals;
  if (cmd === 'host') return host(values.bind as string, Number(values.port));
  if (cmd === 'play' && address) process.exit(await play(address, values.name as string, values.token as string, values.auto as boolean));
  console.error(USAGE);
  process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

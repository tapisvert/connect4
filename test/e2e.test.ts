import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

function run(args: string[]): { done: Promise<{ code: number; out: string }>; out: () => string } {
  const p = spawn(process.execPath, [CLI, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  const done = new Promise<{ code: number; out: string }>((resolve) => p.on('close', (code) => resolve({ code: code ?? -1, out })));
  return { done, out: () => out };
}

// The LAN address when there is one, so the test crosses a real interface.
const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address ?? '127.0.0.1';

test(`host plus two auto players finish a game over ${lan}`, async () => {
  const host = run(['host', '--bind', '0.0.0.0', '--port', '0']);
  let port = 0;
  for (let i = 0; i < 200 && !port; i++) {
    await new Promise((r) => setTimeout(r, 25));
    port = Number(/open on port (\d+)/.exec(host.out())?.[1] ?? 0);
  }
  assert.ok(port, `host never reported its port:\n${host.out()}`);
  const a = run(['play', `${lan}:${port}`, '--name', 'a', '--auto']);
  const b = run(['play', `${lan}:${port}`, '--name', 'b', '--auto']);
  const [ra, rb, rh] = await Promise.all([a.done, b.done, host.done]);
  assert.equal(ra.code, 0, ra.out);
  assert.equal(rb.code, 0, rb.out);
  assert.equal(rh.code, 0, rh.out);
  const result = (s: string) => /result (\S+) after version (\d+)/.exec(s)?.slice(1);
  assert.ok(result(ra.out), ra.out);
  assert.deepEqual(result(ra.out), result(rb.out), 'both players saw the same ending');
  assert.match(rh.out, /game over: (draw|X wins|O wins)/);
  const verdicts = [ra.out, rb.out].map((s) => /^(you win|you lose|draw)$/m.exec(s)?.[1]).sort();
  assert.ok(verdicts.join() === 'you lose,you win' || verdicts.join() === 'draw,draw', verdicts.join());
});

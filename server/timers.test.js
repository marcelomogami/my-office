import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_TIMERS, loadTimers, parseTimers } from './config.js';
import { createOffice } from './app.js';

const quiet = () => {};

test('sem timers, ou com só alguns, o resto fica no padrão', () => {
  assert.deepEqual(parseTimers({}), DEFAULT_TIMERS);
  assert.deepEqual(parseTimers({ timers: { rest: 5, restMove: 0 } }), { ...DEFAULT_TIMERS, rest: 5, restMove: 0 });
  assert.deepEqual(loadTimers({ configDir: '/nonexistent' }), DEFAULT_TIMERS);
});

test('valores inválidos ou desconhecidos ficam no padrão, com aviso', () => {
  const logs = [];
  const timers = parseTimers({ timers: { rest: -1, leaveRoom: '240', leaveList: 0, nap: 3, restMove: 20 } }, { log: (m) => logs.push(m) });
  assert.deepEqual(timers, { ...DEFAULT_TIMERS, restMove: 20 });
  assert.equal(logs.length, 4);
  assert.deepEqual(parseTimers({ timers: [] }, { log: quiet }), DEFAULT_TIMERS);
});

test('qualquer valor positivo vale, sem regra de ordem entre os tempos', () => {
  const logs = [];
  assert.deepEqual(parseTimers({ timers: { rest: 300, leaveRoom: 1, leaveList: 2 } }, { log: (m) => logs.push(m) }),
    { ...DEFAULT_TIMERS, rest: 300, leaveRoom: 1, leaveList: 2 });
  assert.equal(logs.length, 0);
});

test('o backend usa os tempos do config.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'my-office-timers-'));
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ timers: { rest: 1, leaveRoom: 2 } }));
  let t = 0;
  const office = createOffice({ memoryFile: join(dir, 'm.json'), sessionsFile: join(dir, 's.json'), configDir: dir, now: () => t });
  try {
    office.state.event({ session_id: 'a', cwd: '/tmp/projeto', event: 'Stop' });
    t = 60_000;
    office.state.tick();
    assert.equal(office.state.list()[0].status, 'idle');
    t = 120_000;
    office.state.tick();
    assert.equal(office.state.list()[0].status, 'idle'); // sair da sala conta do descanso
    t = 180_000;
    office.state.tick();
    assert.equal(office.state.list()[0].status, 'away');
  } finally {
    office.close();
  }
});

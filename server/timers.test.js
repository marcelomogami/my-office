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

test('a ordem do ciclo é fixa: o valor que a quebra volta ao padrão', () => {
  const logs = [];
  // descansar depois de sair da sala: o descanso personalizado é ignorado
  assert.equal(parseTimers({ timers: { rest: 300 } }, { log: (m) => logs.push(m) }).rest, 10);
  // sair da sala depois de sair da lista: a saída da lista personalizada é ignorada
  assert.equal(parseTimers({ timers: { leaveList: 100 } }, { log: (m) => logs.push(m) }).leaveList, 480);
  assert.equal(logs.length, 2);
  // valores personalizados que respeitam a ordem ficam
  assert.deepEqual(parseTimers({ timers: { rest: 1, leaveRoom: 2, leaveList: 3 } }), { ...DEFAULT_TIMERS, rest: 1, leaveRoom: 2, leaveList: 3 });
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
    assert.equal(office.state.list()[0].status, 'away');
  } finally {
    office.close();
  }
});

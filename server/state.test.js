import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { createState } from './state.js';

const ORDER = ['G', 'H', 'F', 'I', 'D', 'E'];
const P = `${homedir()}/projects`;

function setup({ dead = new Set(), saved = [] } = {}) {
  let t = 0;
  const memory = { skins: new Map(), seats: new Map() };
  let saves = 0;
  const state = createState({
    seatOrder: ORDER, memory, onMemoryChange: () => saves++, now: () => t, idleAfterMs: 1000,
    alive: (pid) => !dead.has(pid), saved,
  });
  const ev = (id, event, cwd = `${P}/personal/my-office`) => state.event({ session_id: id, cwd, event });
  return { state, ev, memory, dead, advance: (ms) => (t += ms), saves: () => saves };
}

test('ciclo de vida: entra, trabalha, pronto, ocioso, sai', () => {
  const { state, ev, advance } = setup();
  assert.equal(ev('a', 'SessionStart'), true);
  assert.equal(state.list()[0].status, 'done');
  assert.equal(ev('a', 'UserPromptSubmit'), true);
  assert.equal(ev('a', 'PreToolUse'), false); // continua trabalhando
  assert.equal(state.list()[0].status, 'working');
  ev('a', 'Stop');
  advance(999);
  assert.equal(state.tick(), false);
  advance(1);
  assert.equal(state.tick(), true);
  assert.equal(state.list()[0].status, 'idle');
  assert.equal(ev('a', 'UserPromptSubmit'), true);
  assert.equal(state.list()[0].status, 'working');
  assert.equal(ev('a', 'SessionEnd'), true);
  assert.deepEqual(state.list(), []);
  assert.equal(ev('a', 'SessionEnd'), false);
});

test('eventos desconhecidos não mexem no status nem atrasam o ocioso', () => {
  const { state, ev, advance } = setup();
  ev('a', 'Stop');
  advance(600);
  assert.equal(ev('a', 'Notification'), false);
  advance(400);
  state.tick();
  assert.equal(state.list()[0].status, 'idle');
});

test('sessão que aparece no meio (sem SessionStart) entra mesmo assim', () => {
  const { state, ev } = setup();
  ev('x', 'PostToolUse');
  assert.equal(state.list()[0].status, 'working');
});

test('nomes, skins fixas e baias fixas', () => {
  const { state, ev, memory, saves } = setup();
  ev('1', 'SessionStart', `${P}/MTI/detran`);
  ev('2', 'SessionStart', `${P}/personal/my-office`);
  ev('3', 'SessionStart', `${P}/personal/my-office/src`);
  const [detran, a, b] = state.list();
  assert.deepEqual([detran.name, detran.skin, detran.seat], ['~detran', 's7', 'I']);
  assert.equal(a.name, 'my-office');
  assert.equal(b.name, 'my-office (2)');
  assert.notEqual(a.skin, b.skin);
  assert.ok(saves() > 0);
  assert.equal(memory.skins.has('~detran'), false); // fixa não vai para a memória
  assert.equal(memory.seats.get('my-office'), a.seat);
});

test('sessão que volta reencontra skin e lugar da memória', () => {
  const { state, ev } = setup();
  ev('2', 'SessionStart');
  const first = state.list()[0];
  ev('2', 'SessionEnd');
  ev('3', 'SessionStart');
  ev('9', 'SessionStart', `${P}/outra/coisa`);
  const again = state.list().find((s) => s.name === 'my-office');
  assert.equal(again.skin, first.skin);
  assert.equal(again.seat, first.seat);
});

test('quem já está sentado não é tirado do lugar por quem volta', () => {
  const { state, ev } = setup();
  ev('2', 'SessionStart');
  ev('2', 'SessionEnd');
  ev('9', 'SessionStart', `${P}/outra/coisa`);
  const coisa = state.list()[0].seat;
  ev('3', 'SessionStart');
  assert.equal(state.list().find((s) => s.name === 'coisa').seat, coisa);
});

test('a partir da 7ª sessão não há lugar', () => {
  const { state, ev } = setup();
  for (let i = 0; i < 7; i++) ev(String(i), 'SessionStart', `${P}/personal/p${i}`);
  const list = state.list();
  assert.equal(list.filter((s) => s.seat).length, 6);
  assert.equal(list[6].seat, null);
});

test('sessão cujo processo morreu sai da sala no tick', () => {
  const { state, dead } = setup();
  state.event({ session_id: 'a', cwd: `${P}/personal/a`, event: 'Stop', pid: 111 });
  state.event({ session_id: 'b', cwd: `${P}/personal/b`, event: 'Stop', pid: 222 });
  assert.equal(state.tick(), false);
  dead.add(111);
  assert.equal(state.tick(), true);
  assert.deepEqual(state.list().map((s) => s.name), ['b']);
});

test('snapshot volta num estado novo, já sem as sessões mortas', () => {
  const first = setup();
  first.state.event({ session_id: 'a', cwd: `${P}/MTI/secretario`, event: 'Stop', pid: 111 });
  first.state.event({ session_id: 'b', cwd: `${P}/personal/b`, event: 'UserPromptSubmit', pid: 222 });
  const saved = first.state.snapshot();
  const again = setup({ saved, dead: new Set([222]) });
  assert.deepEqual(again.state.list(), [{ name: '~secretario', status: 'done', skin: 's6', seat: 'F' }]);
  again.advance(1000);
  again.state.tick();
  assert.equal(again.state.list()[0].status, 'idle');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { createState } from './state.js';

const ORDER = ['G', 'H', 'F', 'I', 'D', 'E'];
const P = `${homedir()}/projects`;
// Catálogo padrão mais dois personagens custom, como na máquina do Boss.
const CAST = ['char1', 'char2', 'char3', 'char4', 'char5', 'char6', 'custom1', 'custom2'];

function setup({ dead = new Set(), saved = [] } = {}) {
  let t = 0;
  const memory = { skins: new Map(), seats: new Map() };
  let saves = 0;
  const state = createState({
    seatOrder: ORDER, memory, onMemoryChange: () => saves++, now: () => t, idleAfterMs: 1000,
    alive: (pid) => !dead.has(pid), saved, awayAfterMs: 5000, cast: CAST,
  });
  const ev = (id, event, cwd = `${P}/personal/my-office`) => state.event({ session_id: id, cwd, event });
  return { state, ev, memory, dead, advance: (ms) => (t += ms), saves: () => saves };
}

test('ciclo de vida: entra, trabalha, pronto, ocioso, vai embora ao fechar', () => {
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
  assert.deepEqual(state.list(), [{ name: 'my-office', status: 'away', since: 1000, skin: null, seat: null }]);
  assert.equal(ev('a', 'SessionEnd'), false);
});

test('interrupção encerra o trabalho e inicia a contagem para ociosidade', () => {
  const { state, ev, advance } = setup();
  ev('a', 'UserPromptSubmit');
  assert.equal(state.list()[0].status, 'working');
  assert.equal(ev('a', 'Interrupt'), true);
  assert.equal(state.list()[0].status, 'done');
  advance(1000);
  state.tick();
  assert.equal(state.list()[0].status, 'idle');
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
  assert.deepEqual([detran.name, detran.skin, detran.seat], ['~detran', 'custom2', 'I']);
  assert.equal(a.name, 'my-office');
  assert.equal(b.name, 'my-office (2)');
  assert.notEqual(a.skin, b.skin);
  assert.ok(saves() > 0);
  assert.equal(memory.skins.has('~detran'), false); // fixa não vai para a memória
  assert.equal(memory.seats.get('my-office'), a.seat);
});

test('personagem fixo que não existe no catálogo entra no sorteio', () => {
  const state = createState({ seatOrder: ORDER, memory: { skins: new Map(), seats: new Map() }, cast: ['char1', 'char2'] });
  state.event({ session_id: '1', cwd: `${P}/MTI/detran`, event: 'SessionStart' });
  const [detran] = state.list();
  assert.ok(['char1', 'char2'].includes(detran.skin));
  assert.equal(detran.seat, 'I');
});

test('personagens fixos não entram no sorteio, nem com a sessão fixa fechada', () => {
  const state = createState({ seatOrder: ORDER, memory: { skins: new Map([['velha', 'custom2']]), seats: new Map() }, cast: ['char1', 'char2', 'char5', 'custom1', 'custom2'] });
  state.event({ session_id: '1', cwd: `${P}/velha`, event: 'SessionStart' });
  state.event({ session_id: '2', cwd: `${P}/outra`, event: 'SessionStart' });
  state.event({ session_id: '3', cwd: `${P}/mais-uma`, event: 'SessionStart' });
  const skins = state.list().map((s) => s.skin);
  assert.deepEqual(skins.filter(Boolean).sort(), ['char2']); // só char2 é livre
  assert.equal(skins.filter((s) => !s).length, 2); // as outras ficam sem personagem
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
  const coisa = state.list().find((s) => s.name === 'coisa').seat;
  ev('3', 'SessionStart');
  assert.equal(state.list().find((s) => s.name === 'coisa').seat, coisa);
});

test('sessões não fixas só sentam enquanto houver personagem livre', () => {
  const { state, ev } = setup();
  // 8 personagens, 4 deles de sessões fixas: sobram 4 para o sorteio
  for (let i = 0; i < 5; i++) ev(String(i), 'SessionStart', `${P}/personal/p${i}`);
  const list = state.list();
  assert.equal(list.filter((s) => s.seat).length, 4);
  assert.equal(list[4].seat, null);
});

test('a partir da 7ª sessão não há lugar', () => {
  const { state, ev } = setup();
  ev('f1', 'SessionStart', `${P}/MTI/detran`);
  ev('f2', 'SessionStart', `${P}/MTI/secretario`);
  for (let i = 0; i < 5; i++) ev(String(i), 'SessionStart', `${P}/personal/p${i}`);
  const list = state.list();
  assert.equal(list.filter((s) => s.seat).length, 6);
  assert.equal(list[6].seat, null);
});

test('sessão cujo processo morreu vai embora no tick e continua na lista', () => {
  const { state, dead } = setup();
  state.event({ session_id: 'a', cwd: `${P}/personal/a`, event: 'Stop', pid: 111 });
  state.event({ session_id: 'b', cwd: `${P}/personal/b`, event: 'Stop', pid: 222 });
  assert.equal(state.tick(), false);
  dead.add(111);
  assert.equal(state.tick(), true);
  assert.deepEqual(state.list().map((s) => [s.name, s.status, s.seat]), [['a', 'away', null], ['b', 'done', 'H']]);
  assert.equal(state.tick(), false);
});

test('snapshot volta num estado novo, com as sessões mortas já fora da sala', () => {
  const first = setup();
  first.state.event({ session_id: 'a', cwd: `${P}/MTI/secretario`, event: 'Stop', pid: 111 });
  first.state.event({ session_id: 'b', cwd: `${P}/personal/b`, event: 'UserPromptSubmit', pid: 222 });
  const saved = first.state.snapshot();
  const again = setup({ saved, dead: new Set([222]) });
  assert.deepEqual(again.state.list(), [
    { name: '~secretario', status: 'done', since: 0, skin: 'custom1', seat: 'F' },
    { name: 'b', status: 'away', since: 0, skin: null, seat: null },
  ]);
  again.advance(1000);
  again.state.tick();
  assert.equal(again.state.list()[0].status, 'idle');
});

test('4 horas (aqui, 5 s) sem evento: vai embora, libera a baia e volta ao agir', () => {
  const { state, ev, advance } = setup();
  ev('a', 'Stop');
  ev('b', 'Stop', `${P}/personal/outro`);
  const seat = state.list()[0].seat;
  advance(1000);
  state.tick();
  assert.equal(state.list()[0].status, 'idle');
  advance(3999);
  assert.equal(state.tick(), false);
  advance(1);
  ev('b', 'UserPromptSubmit', `${P}/personal/outro`); // b continua ativo
  assert.equal(state.tick(), true);
  const [a, b] = state.list();
  assert.deepEqual(a, { name: 'my-office', status: 'away', since: 0, skin: null, seat: null });
  assert.equal(b.status, 'working');
  assert.equal(ev('a', 'UserPromptSubmit'), true);
  const back = state.list()[0];
  assert.equal(back.status, 'working');
  assert.equal(back.seat, seat);
});

test('StopFailure: cota para rate_limit e billing_error, erro para o resto', () => {
  const { state } = setup();
  const fail = (id, error) => state.event({ session_id: id, cwd: `${P}/personal/${id}`, event: 'StopFailure', error });
  fail('a', 'rate_limit');
  fail('b', 'billing_error');
  fail('c', 'server_error');
  fail('d', undefined);
  assert.deepEqual(state.list().map((s) => s.status), ['quota', 'quota', 'error', 'error']);
});

test('cota descansa, vai embora e volta ao agir', () => {
  const { state, advance } = setup();
  state.event({ session_id: 'a', cwd: `${P}/personal/a`, event: 'StopFailure', error: 'rate_limit' });
  assert.equal(state.list()[0].status, 'quota');
  advance(1000);
  assert.equal(state.tick(), true);
  assert.equal(state.list()[0].status, 'idle');
  advance(4000);
  state.tick();
  assert.equal(state.list()[0].status, 'away');
  state.event({ session_id: 'a', cwd: `${P}/personal/a`, event: 'UserPromptSubmit' });
  assert.equal(state.list()[0].status, 'working');
});

test('falha do modelo mostra erro e nova tentativa retoma trabalho', () => {
  const { state, ev } = setup();
  ev('a', 'UserPromptSubmit');
  ev('a', 'CodexModelFailed');
  assert.equal(state.list()[0].status, 'error');
  ev('a', 'CodexModelStarted');
  assert.equal(state.list()[0].status, 'working');
  ev('a', 'Stop');
  assert.equal(state.list()[0].status, 'done');
});

test('expõe início da parada, preserva na copa e atualiza após novo término', () => {
  const { state, ev, advance } = setup();
  advance(100);
  ev('a', 'Stop');
  assert.equal(state.list()[0].since, 100);
  advance(1000); state.tick();
  assert.equal(state.list()[0].since, 100);
  ev('a', 'Stop');
  assert.equal(state.list()[0].since, 1100);
  advance(10);
  assert.equal(ev('a', 'Stop'), true);
  assert.equal(state.list()[0].since, 1110);
});

test('descansa após 10 minutos e desaparece da lista após 8 horas sem atividade', () => {
  let t = 0;
  const state = createState({ seatOrder: ORDER, memory: { skins: new Map(), seats: new Map() }, now: () => t });
  const event = (name) => state.event({ session_id: 'a', cwd: `${P}/personal/a`, event: name });
  event('Stop');
  t = 10 * 60_000 - 1; state.tick(); assert.equal(state.list()[0].status, 'done');
  t++; state.tick(); assert.equal(state.list()[0].status, 'idle');
  t = 4 * 3600_000; state.tick(); assert.equal(state.list()[0].status, 'away');
  t = 8 * 3600_000 - 1; state.tick(); assert.equal(state.list().length, 1);
  t++; state.tick(); assert.deepEqual(state.list(), []);
  event('UserPromptSubmit'); assert.equal(state.list()[0].status, 'working');
});

test('atividade durante a ausência reinicia o prazo de remoção', () => {
  let t = 0;
  const state = createState({ seatOrder: ORDER, memory: { skins: new Map(), seats: new Map() }, now: () => t });
  const event = (name) => state.event({ session_id: 'a', cwd: `${P}/personal/a`, event: name });
  event('Stop'); t = 7 * 3600_000; state.tick(); assert.equal(state.list()[0].status, 'away');
  event('UserPromptSubmit'); event('Stop');
  t = 8 * 3600_000; state.tick(); assert.equal(state.list().length, 1);
});

test('home office some depois de uma hora sem atividade e volta no próximo evento', () => {
  let t = 0;
  const state = createState({ seatOrder: [], memory: { skins: new Map(), seats: new Map() }, now: () => t });
  const event = (name) => state.event({ session_id: 'a', cwd: `${P}/personal/a`, event: name });
  event('Stop'); t = 3_600_000 - 1; state.tick(); assert.equal(state.list().length, 1);
  t++; state.tick(); assert.equal(state.list().length, 0);
  event('UserPromptSubmit'); assert.equal(state.list()[0].status, 'working');
  t += 4_000_000; state.tick(); assert.equal(state.list()[0].status, 'working');
});

test('reinício preserva os prazos de quem possui baia', () => {
  const now = 3_600_000;
  const saved = [{ id: 'a', name: 'a', status: 'idle', since: 0 }];
  const state = createState({ seatOrder: ORDER, memory: { skins: new Map(), seats: new Map() }, now: () => now, saved });
  assert.equal(state.list().length, 1);
  assert.equal(state.list()[0].status, 'idle');
});

test('detecta saída só do Codex confirmado no servidor, após duas ausências', () => {
  const { state } = setup();
  state.event({session_id:'codex-a',cwd:'/tmp/codex',event:'Stop',agent:'codex'});
  state.event({session_id:'claude-a',cwd:'/tmp/claude',event:'Stop'});
  const snap = () => state.codexCandidates();
  state.reconcileCodex(new Set(['codex-a']), snap());
  assert.equal(state.reconcileCodex(new Set(), snap()), false);
  assert.equal(state.reconcileCodex(new Set(), snap()), true);
  assert.deepEqual(state.list().map(s => [s.name, s.status]), [['codex', 'away'], ['claude', 'done']]);
  assert.equal(state.reconcileCodex(new Set(), snap()), false);
});

test('sessões não observadas no servidor e eventos durante a consulta não são removidos', () => {
  const { state } = setup();
  state.event({session_id:'a',cwd:'/tmp/a',event:'Stop',agent:'codex'});
  state.reconcileCodex(new Set(), state.codexCandidates());
  state.reconcileCodex(new Set(), state.codexCandidates());
  assert.equal(state.list().length, 1);
  state.reconcileCodex(new Set(['a']), state.codexCandidates());
  state.reconcileCodex(new Set(), state.codexCandidates());
  const old = state.codexCandidates();
  state.event({session_id:'a',cwd:'/tmp/a',event:'UserPromptSubmit',agent:'codex'});
  assert.equal(state.reconcileCodex(new Set(), old), false);
  assert.equal(state.list().length, 1);
});

test('indisponibilidade limpa a confirmação de presença antes de retomar consultas', () => {
  const { state } = setup();
  state.event({session_id:'a',cwd:'/tmp/a',event:'Stop',agent:'codex'});
  state.reconcileCodex(new Set(['a']), state.codexCandidates());
  state.reconcileCodex(new Set(), state.codexCandidates());
  state.codexUnavailable();
  state.reconcileCodex(new Set(), state.codexCandidates());
  state.reconcileCodex(new Set(), state.codexCandidates());
  assert.equal(state.list().length, 1);
});

test('identificação de Codex sobrevive ao snapshot', () => {
  const first = setup();
  first.state.event({session_id:'a',cwd:'/tmp/a',event:'Stop',agent:'codex'});
  const again = setup({ saved: first.state.snapshot() });
  assert.equal(again.state.codexCandidates().has('a'), true);
});

test('sessão fechada fica na lista como "foi embora" e sai depois de 8 horas', () => {
  const { state, ev, advance } = setup();
  ev('a', 'SessionStart');
  advance(60_000);
  ev('a', 'SessionEnd');
  advance(8 * 3600_000 - 1);
  state.tick();
  assert.equal(state.list()[0].status, 'away');
  advance(1);
  assert.equal(state.tick(), true);
  assert.deepEqual(state.list(), []);
});

test('sessão fechada volta se mandar um evento novo', () => {
  const { state, ev } = setup();
  ev('a', 'SessionStart');
  const seat = state.list()[0].seat;
  ev('a', 'SessionEnd');
  ev('a', 'UserPromptSubmit');
  assert.deepEqual([state.list()[0].status, state.list()[0].seat], ['working', seat]);
});

test('sessão nova no mesmo projeto substitui a que foi embora, sem virar "(2)"', () => {
  const { state, ev } = setup();
  ev('a', 'SessionStart');
  ev('a', 'SessionEnd');
  ev('x', 'SessionStart', `${P}/personal/outro`);
  ev('b', 'SessionStart');
  assert.deepEqual(state.list().map((s) => [s.name, s.status]), [['outro', 'done'], ['my-office', 'done']]);
});

test('sessão aberta no mesmo projeto continua com sufixo', () => {
  const { state, ev } = setup();
  ev('a', 'SessionStart');
  ev('b', 'SessionStart');
  assert.deepEqual(state.list().map((s) => s.name), ['my-office', 'my-office (2)']);
});

test('erro descansa depois do mesmo prazo do pronto', () => {
  const { state, ev, advance } = setup();
  ev('a', 'CodexModelFailed');
  advance(999);
  assert.equal(state.tick(), false);
  assert.equal(state.list()[0].status, 'error');
  advance(1);
  assert.equal(state.tick(), true);
  assert.equal(state.list()[0].status, 'idle');
  ev('a', 'CodexModelStarted');
  assert.equal(state.list()[0].status, 'working');
});

test('cota do Codex reconhecida pelo hook mostra cota e nova tentativa retoma trabalho', () => {
  const { state, ev } = setup();
  ev('a', 'CodexQuotaExceeded');
  assert.equal(state.list()[0].status, 'quota');
  ev('a', 'CodexModelStarted');
  assert.equal(state.list()[0].status, 'working');
});

import { layout } from '../src/sessions.js';
import { projectName, uniqueName } from './names.js';

// Estado das sessões abertas, alimentado pelos eventos dos hooks.
//
// Cada sessão é identificada pelo `session_id` do Claude Code e ganha um nome
// na primeira vez que aparece (o nome não muda se a sessão trocar de pasta).
// A lista sai na ordem em que as sessões apareceram, já com skin e lugar.

export const IDLE_AFTER_MS = 10 * 60 * 1000;
// Sem atividade por tanto tempo, o personagem vai embora: sai da sala e
// libera a baia; após oito horas sem atividade, sai também da lista. Sessão
// fechada (SessionEnd, processo encerrado ou Codex ausente no App Server) vai
// embora na hora e fica na lista pelo mesmo prazo, contado do fechamento.
export const AWAY_AFTER_MS = 4 * 60 * 60 * 1000;
export const REMOVE_AFTER_MS = 8 * 60 * 60 * 1000;
export const HOME_OFFICE_REMOVE_AFTER_MS = 60 * 60 * 1000;

// Evento do Claude Code -> status. Eventos fora da lista (Notification,
// SubagentStop...) são ignorados: o Notification de "esperando você" chega
// sozinho depois de um minuto parado e não pode atrasar o "ocioso".
const STATUS_OF = {
  SessionStart: 'done',
  UserPromptSubmit: 'working',
  PreToolUse: 'working',
  PostToolUse: 'working',
  PreCompact: 'working',
  Stop: 'done',
  Interrupt: 'done', // turno do Codex interrompido pelo usuário
  CodexModelStarted: 'working',
  CodexModelFailed: 'error',
  CodexQuotaExceeded: 'quota', // falha do Codex reconhecida como fim de cota pelo hook
  StopFailure: 'error', // ou 'quota', conforme o tipo do erro (abaixo)
};

// Tipos de erro do StopFailure que querem dizer "acabou a cota".
const QUOTA_ERRORS = new Set(['rate_limit', 'billing_error']);

// Status que vão descansar depois de `idleAfterMs` sem evento: pronto, erro e
// cota seguem a mesma regra (descansa, vai embora, sai da lista).
const CAN_REST = new Set(['done', 'error', 'quota']);

// Status que, sem evento por `awayAfterMs`, vão embora da sala.
const CAN_LEAVE = new Set(['idle', 'error', 'quota']);

// Processo ainda existe? EPERM quer dizer que existe, só não é nosso.
export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

// `saved`: sessões gravadas antes de um reinício do backend (ver snapshot()).
// `pid` é o processo do Claude Code da sessão: quando ele some (terminal
// fechado sem SessionEnd), a sessão vai embora no próximo tick.
export function createState({
  seatOrder,
  memory,
  onMemoryChange = () => {},
  now = Date.now,
  idleAfterMs = IDLE_AFTER_MS,
  awayAfterMs = AWAY_AFTER_MS,
  removeAfterMs = REMOVE_AFTER_MS,
  homeOfficeRemoveAfterMs = HOME_OFFICE_REMOVE_AFTER_MS,
  alive = isAlive,
  saved = [],
}) {
  const sessions = new Map(); // session_id -> { name, status, since, pid }
  for (const { id, name, status, since, pid, agent } of saved) sessions.set(id, { name, status, since, pid, agent });
  const revisions = new Map();
  const codexSeen = new Set();
  const codexMisses = new Map();
  let placed = { skins: new Map(), seats: new Map() };

  function arrange() {
    const names = [...sessions.values()].filter((s) => s.status !== 'away').map((s) => s.name);
    const result = layout(names, seatOrder, memory, placed);
    placed = { skins: result.skins, seats: result.seats };
    if (result.changed) onMemoryChange(memory);
  }

  // Sessão fechada: sai da sala e libera a baia, mas continua na lista como
  // "foi embora" até `removeAfterMs` depois do fechamento. Quem chama arruma
  // as baias.
  function leave(id, s) {
    codexSeen.delete(id);
    codexMisses.delete(id);
    delete s.pid;
    if (s.status === 'away') return false;
    s.status = 'away';
    s.since = now();
    return true;
  }

  // Nome do projeto sem o sufixo de repetição: "my-office (2)" -> "my-office".
  const baseName = (name) => name.replace(/ \(\d+\)$/, '');

  // Aplica um evento; devolve true se a lista mudou.
  function event({ session_id: id, cwd, event: name, pid, error, agent }) {
    revisions.set(id, (revisions.get(id) ?? 0) + 1);
    codexMisses.delete(id);
    if (name === 'SessionEnd') {
      const s = sessions.get(id);
      if (!s || !leave(id, s)) return false;
      arrange();
      return true;
    }
    let s = sessions.get(id);
    const isNew = !s;
    if (isNew) {
      codexSeen.delete(id);
      // Sessão nova no mesmo projeto substitui quem já foi embora dali, para
      // não virar "nome (2)" por causa de uma sessão que já fechou.
      const project = projectName(cwd);
      for (const [other, x] of sessions) if (x.status === 'away' && baseName(x.name) === project) sessions.delete(other);
      const taken = new Set([...sessions.values()].map((x) => x.name));
      s = { name: uniqueName(project, taken), status: 'done', since: now(), pid };
      sessions.set(id, s);
      arrange();
    }
    if (pid) s.pid = pid;
    const agentChanged = agent === 'codex' && s.agent !== agent;
    if (agentChanged) s.agent = agent;
    const status = name === 'StopFailure' && QUOTA_ERRORS.has(error) ? 'quota' : STATUS_OF[name];
    if (!status) return isNew || agentChanged;
    const before = s.status;
    const previousSince = s.since;
    s.status = status;
    s.since = now();
    if (before === 'away') arrange(); // voltou: pega baia de novo
    return isNew || agentChanged || before !== status || (status !== 'working' && previousSince !== s.since);
  }

  // Pronto, erro ou cota há mais de `idleAfterMs` vira ocioso, ocioso há mais de
  // `awayAfterMs` (desde o último evento) vai embora, e sessão cujo processo
  // morreu vai embora na hora; devolve true se algo mudou.
  function tick() {
    let changed = false;
    for (const [id, s] of sessions) {
      if (s.pid && !alive(s.pid)) {
        if (leave(id, s)) changed = true;
        continue;
      }
      // `since` é o último evento: os dois prazos contam a partir dele
      const quiet = now() - s.since;
      if (CAN_REST.has(s.status) && quiet >= idleAfterMs) {
        s.status = 'idle';
        changed = true;
      }
      if (s.status !== 'working' && s.status !== 'away' && !placed.seats.has(s.name) && quiet >= homeOfficeRemoveAfterMs) {
        sessions.delete(id);
        changed = true;
        continue;
      }
      if (CAN_LEAVE.has(s.status) && quiet >= awayAfterMs) {
        s.status = 'away';
        changed = true;
      }
      if (s.status === 'away' && quiet >= removeAfterMs) {
        sessions.delete(id);
        changed = true;
      }
    }
    if (changed) arrange();
    return changed;
  }

  // Só remove sessões Codex que já foram vistas neste servidor e faltaram
  // duas vezes; um evento durante a consulta invalida a respectiva amostra.
  function codexCandidates() {
    return new Map([...sessions].filter(([, s]) => s.agent === 'codex').map(([id]) => [id, revisions.get(id) ?? 0]));
  }
  function reconcileCodex(loaded, candidates) {
    let changed = false;
    for (const [id, revision] of candidates) {
      const s = sessions.get(id);
      if (!s || s.agent !== 'codex' || (revisions.get(id) ?? 0) !== revision) continue;
      if (loaded.has(id)) { codexSeen.add(id); codexMisses.delete(id); continue; }
      if (!codexSeen.has(id)) continue;
      const misses = (codexMisses.get(id) ?? 0) + 1;
      codexMisses.set(id, misses);
      if (misses >= 2 && leave(id, s)) changed = true;
    }
    if (changed) arrange();
    return changed;
  }
  function codexUnavailable() { codexSeen.clear(); codexMisses.clear(); }

  function list() {
    return [...sessions.values()].map(({ name, status, since }) => ({
      name,
      status,
      since,
      skin: placed.skins.get(name) ?? null,
      seat: placed.seats.get(name) ?? null,
    }));
  }

  // O que precisa sobreviver a um reinício do backend.
  function snapshot() {
    return [...sessions].map(([id, { name, status, since, pid, agent }]) => ({ id, name, status, since, pid, ...(agent ? { agent } : {}) }));
  }

  if (sessions.size) {
    arrange();
    tick();
  }

  return { event, tick, list, snapshot, codexCandidates, reconcileCodex, codexUnavailable };
}

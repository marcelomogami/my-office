import { layout } from '../src/sessions.js';
import { projectName, uniqueName } from './names.js';

// Estado das sessões abertas, alimentado pelos eventos dos hooks.
//
// Cada sessão é identificada pelo `session_id` do Claude Code e ganha um nome
// na primeira vez que aparece (o nome não muda se a sessão trocar de pasta).
// A lista sai na ordem em que as sessões apareceram, já com skin e lugar.

export const IDLE_AFTER_MS = 30 * 60 * 1000;

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
};

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
// fechado sem SessionEnd), a sessão sai da sala no próximo tick.
export function createState({
  seatOrder,
  memory,
  onMemoryChange = () => {},
  now = Date.now,
  idleAfterMs = IDLE_AFTER_MS,
  alive = isAlive,
  saved = [],
}) {
  const sessions = new Map(); // session_id -> { name, status, since, pid }
  for (const { id, name, status, since, pid } of saved) sessions.set(id, { name, status, since, pid });
  let placed = { skins: new Map(), seats: new Map() };

  function arrange() {
    const names = [...sessions.values()].map((s) => s.name);
    const result = layout(names, seatOrder, memory, placed);
    placed = { skins: result.skins, seats: result.seats };
    if (result.changed) onMemoryChange(memory);
  }

  // Aplica um evento; devolve true se a lista mudou.
  function event({ session_id: id, cwd, event: name, pid }) {
    if (name === 'SessionEnd') {
      if (!sessions.delete(id)) return false;
      arrange();
      return true;
    }
    let s = sessions.get(id);
    const isNew = !s;
    if (isNew) {
      const taken = new Set([...sessions.values()].map((x) => x.name));
      s = { name: uniqueName(projectName(cwd), taken), status: 'done', since: now(), pid };
      sessions.set(id, s);
      arrange();
    }
    if (pid) s.pid = pid;
    const status = STATUS_OF[name];
    if (!status) return isNew;
    const before = s.status;
    s.status = status;
    s.since = now();
    return isNew || before !== status;
  }

  // "Pronto" há mais de `idleAfterMs` vira ocioso, e sessão cujo processo
  // morreu sai da sala; devolve true se algo mudou.
  function tick() {
    let changed = false;
    for (const [id, s] of sessions) {
      if (s.pid && !alive(s.pid)) {
        sessions.delete(id);
        changed = true;
        continue;
      }
      if (s.status === 'done' && now() - s.since >= idleAfterMs) {
        s.status = 'idle';
        changed = true;
      }
    }
    if (changed) arrange();
    return changed;
  }

  function list() {
    return [...sessions.values()].map(({ name, status }) => ({
      name,
      status,
      skin: placed.skins.get(name) ?? null,
      seat: placed.seats.get(name) ?? null,
    }));
  }

  // O que precisa sobreviver a um reinício do backend.
  function snapshot() {
    return [...sessions].map(([id, { name, status, since, pid }]) => ({ id, name, status, since, pid }));
  }

  if (sessions.size) {
    tick();
    arrange();
  }

  return { event, tick, list, snapshot };
}

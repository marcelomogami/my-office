import { createReadStream, readFileSync } from 'node:fs';
import { createState } from './state.js';
import { loadCharacters, CONFIG_DIR } from './characters.js';
import { loadConfig } from './config.js';
import { castOf } from '../src/characters.js';
import { loadMemory, saveMemory, loadSessions, saveSessions, MEMORY_FILE, SESSIONS_FILE } from './memory.js';

// Rotas do backend, usadas tanto pelo servidor (server/index.js) quanto pelo
// plugin do Vite durante o desenvolvimento:
//
//   POST /api/evento  evento de um hook: { session_id, cwd, event, pid, error, agent }
//   GET  /api/stream  server-sent events com a lista de sessões a cada mudança
//   GET  /api/characters              catálogo de personagens (padrão + custom)
//   GET  /api/characters/<folha>.png  folha de personagens (default ou custom)
//   GET  /api/fixed   sessões fixas da configuração local, para a demonstração

const scene = JSON.parse(readFileSync(new URL('../src/scene.json', import.meta.url), 'utf8'));

const MAX_BODY = 4096;
const FIELD = /^[^\u0000-\u001f\u007f]{1,512}$/u; // texto curto, sem caracteres de controle
const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function createOffice({
  memoryFile = MEMORY_FILE,
  sessionsFile = SESSIONS_FILE,
  tickMs = 30_000,
  heartbeatMs = 25_000,
  codexLoad = null,
  configDir = CONFIG_DIR,
  ...options
} = {}) {
  const memory = loadMemory(memoryFile);
  // Lido na partida: personagem novo no catálogo entra depois de reiniciar.
  const characters = loadCharacters({ configDir });
  const cast = castOf(characters.characters);
  const fixed = loadConfig({ configDir, cast, desks: scene.seatOrder });
  const state = createState({
    seatOrder: scene.seatOrder,
    memory,
    onMemoryChange: (m) => saveMemory(m, memoryFile),
    saved: loadSessions(sessionsFile),
    cast,
    fixed,
    ...options,
  });
  const clients = new Set();

  const payload = () => `data: ${JSON.stringify(state.list())}\n\n`;
  const broadcast = () => {
    saveSessions(state.snapshot(), sessionsFile);
    const data = payload();
    for (const res of clients) res.write(data);
  };

  let checkingCodex = false;
  let closed = false;
  async function checkCodex() {
    if (!codexLoad || checkingCodex) return;
    const candidates = state.codexCandidates();
    if (!candidates.size) return;
    checkingCodex = true;
    try {
      const loaded = await codexLoad();
      if (!closed && state.reconcileCodex(loaded, candidates)) broadcast();
    } catch {
      state.codexUnavailable();
    } finally {
      checkingCodex = false;
    }
  }
  const timers = [
    setInterval(() => { if (state.tick()) broadcast(); void checkCodex(); }, tickMs),
    // comentário vazio de tempos em tempos, para proxies não fecharem o stream
    setInterval(() => clients.forEach((res) => res.write(':\n\n')), heartbeatMs),
  ];
  timers.forEach((t) => t.unref());

  function receive(req, res) {
    // Eventos só da própria máquina: pela rede, a sala é só para ver.
    if (!LOCAL.has(req.socket.remoteAddress)) return reply(res, 403);
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) req.destroy();
    });
    req.on('end', () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return reply(res, 400);
      }
      // só os metadados combinados; qualquer outro campo é descartado
      const { session_id, cwd, event, pid, error, agent } = data ?? {};
      if (![session_id, cwd, event].every((v) => typeof v === 'string' && FIELD.test(v))) return reply(res, 400);
      // pid do processo do Claude Code, opcional, para saber quando a sessão morreu
      if (pid !== undefined && !/^[1-9]\d{0,9}$/.test(String(pid))) return reply(res, 400);
      // tipo do erro do StopFailure, opcional: uma palavra, nunca a mensagem
      if (error !== undefined && !(typeof error === 'string' && /^[a-z_]{1,40}$/.test(error))) return reply(res, 400);
      if (agent !== undefined && agent !== 'codex') return reply(res, 400);
      if (state.event({ session_id, cwd, event, pid: pid && Number(pid), error, agent })) broadcast();
      reply(res, 204);
    });
  }

  function stream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(payload());
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  function characterRoute(path, res) {
    if (path === '/api/characters') {
      return json(res, { characters: characters.characters });
    }
    const sheet = characters.sheets[path.match(/^\/api\/characters\/([a-z]+)\.png$/)?.[1]];
    if (!sheet) return reply(res, 404);
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' });
    createReadStream(sheet).on('error', () => res.end()).pipe(res);
  }

  // Middleware no formato do Connect (o do Vite): o que não é da API segue.
  function handle(req, res, next) {
    const path = req.url.split('?')[0];
    if (path === '/api/evento' && req.method === 'POST') return receive(req, res);
    if (path === '/api/stream' && req.method === 'GET') return stream(req, res);
    if (path.startsWith('/api/characters') && req.method === 'GET') return characterRoute(path, res);
    if (path === '/api/fixed' && req.method === 'GET') return json(res, { fixed });
    if (path.startsWith('/api/')) return reply(res, 404);
    return next();
  }

  function close() {
    closed = true;
    timers.forEach(clearInterval);
    for (const res of clients) res.end();
    clients.clear();
  }

  return { handle, close, state, clients };
}

function json(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(data));
}

function reply(res, code) {
  res.writeHead(code).end();
}

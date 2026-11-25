import notifications from './codex-notifications.json' with { type: 'json' };

// Uma conexão sem inscrição em conversas: apenas lista IDs carregados.
export async function loadCodexThreads(url, { Socket = WebSocket, timeoutMs = 3000 } = {}) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'ws:' || endpoint.hostname !== '127.0.0.1' || endpoint.username || endpoint.password) {
    throw new Error('O App Server deve estar em 127.0.0.1');
  }
  const ws = new Socket(endpoint.href);
  const pending = new Map();
  let nextId = 0;
  let timer;
  let rejectFailure;
  const failure = new Promise((_, reject) => { rejectFailure = reject; });
  ws.addEventListener('error', () => rejectFailure(new Error('App Server indisponível')));
  ws.addEventListener('close', () => rejectFailure(new Error('Conexão encerrada')));
  ws.addEventListener('message', (event) => {
    // Notificações são ignoradas sem interpretar seu conteúdo.
    if (typeof event.data !== 'string' || !/^\s*\{\s*"id"\s*:/.test(event.data)) return;
    let message;
    try { message = JSON.parse(event.data); } catch { return rejectFailure(new Error('Resposta inválida')); }
    const callback = pending.get(message.id);
    if (callback) { pending.delete(message.id); callback(message); }
  });
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => message.error ? reject(new Error('Requisição recusada')) : resolve(message.result));
    ws.send(JSON.stringify({ id, method, params }));
  });
  try {
    return await Promise.race([failure, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Tempo esgotado')), timeoutMs); }), (async () => {
      await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
      await request('initialize', { clientInfo: { name: 'my_office', title: 'My Office', version: '0.5.0' }, capabilities: { experimentalApi: false, requestAttestation: false, optOutNotificationMethods: notifications } });
      ws.send(JSON.stringify({ method: 'initialized', params: {} }));
      const ids = new Set(); const cursors = new Set(); let cursor = null;
      do {
        const page = await request('thread/loaded/list', { cursor });
        if (!page || !Array.isArray(page.data) || !page.data.every((id) => typeof id === 'string') || !(page.nextCursor == null || typeof page.nextCursor === 'string')) throw new Error('Lista inválida');
        page.data.forEach((id) => ids.add(id));
        cursor = page.nextCursor ?? null;
        if (cursor && cursors.has(cursor)) throw new Error('Paginação inválida');
        if (cursor) cursors.add(cursor);
        if (cursors.size > 1000) throw new Error('Paginação extensa');
      } while (cursor);
      return ids;
    })()]);
  } finally { clearTimeout(timer); ws.close(); }
}

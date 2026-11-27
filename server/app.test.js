import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOffice } from './app.js';

const dir = mkdtempSync(join(tmpdir(), 'my-office-'));
const memoryFile = join(dir, 'memory.json');
const sessionsFile = join(dir, 'sessions.json');
// Pasta de configuração própria do teste, com uma sessão fixa.
writeFileSync(join(dir, 'config.json'), JSON.stringify({ projects: { fixo: { character: 'char2', desk: 1 } } }));
// e uma folha custom de interface, que troca um ícone.
mkdirSync(join(dir, 'ui'));
writeFileSync(join(dir, 'ui', 'custom.json'), JSON.stringify({ items: { iconDone: [0, 19, 9, 9] } }));
copyFileSync(new URL('../assets/ui/default.png', import.meta.url), join(dir, 'ui', 'custom.png'));
const office = createOffice({ memoryFile, sessionsFile, configDir: dir });
const server = createServer((req, res) => office.handle(req, res, () => res.writeHead(418).end()));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => {
  office.close();
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const post = (body) =>
  fetch(`${base}/api/evento`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

test('evento válido responde 204 e só guarda os metadados', async () => {
  const r = await post({ session_id: 's1', cwd: '/tmp/demo', event: 'UserPromptSubmit', tool: 'Bash', prompt: 'segredo' });
  assert.equal(r.status, 204);
  assert.deepEqual(Object.keys(office.state.list()[0]).sort(), ['agent', 'face', 'name', 'seat', 'since', 'skin', 'status']);
  assert.ok(!readFileSync(memoryFile, 'utf8').includes('segredo'));
});

test('sessão fixa da configuração ganha personagem e baia, e /api/fixed as expõe', async () => {
  assert.equal((await post({ session_id: 'f1', cwd: '/tmp/fixo', event: 'SessionStart' })).status, 204);
  const fixo = office.state.list().find((s) => s.name === 'fixo');
  assert.deepEqual([fixo.skin, fixo.seat, fixo.face], ['char2', '1', 'char2']);
  assert.deepEqual(await (await fetch(`${base}/api/fixed`)).json(), { fixed: { fixo: { skin: 'char2', seat: '1' } } });
});

test('/api/sheets expõe só as folhas custom encontradas, e serve o PNG delas', async () => {
  assert.deepEqual(await (await fetch(`${base}/api/sheets`)).json(), { ui: { iconDone: [0, 19, 9, 9] } });
  const png = await fetch(`${base}/api/sheets/ui.png`);
  assert.equal(png.status, 200);
  assert.equal(png.headers.get('content-type'), 'image/png');
  await png.arrayBuffer();
  assert.equal((await fetch(`${base}/api/sheets/office.png`)).status, 404);
});

test('/api/settings manda o idioma (inglês sem a opção)', async () => {
  assert.deepEqual(await (await fetch(`${base}/api/settings`)).json(), { language: 'en' });
});

test('eventos inválidos respondem 400', async () => {
  assert.equal((await post('não é json')).status, 400);
  assert.equal((await post({ session_id: 's1', cwd: '/tmp' })).status, 400);
  assert.equal((await post({ session_id: 's1', cwd: '/tmp\n', event: 'Stop' })).status, 400);
  assert.equal((await post(null)).status, 400);
  assert.equal((await post({ session_id: 's1', cwd: '/tmp', event: 'Stop', pid: 'abc' })).status, 400);
  assert.equal((await post({ session_id: 's1', cwd: '/tmp', event: 'Stop', pid: '0' })).status, 400);
  assert.equal((await post({ session_id: 's1', cwd: '/tmp', event: 'StopFailure', error: 'API Error: x' })).status, 400);
  assert.equal((await post({ session_id: 's1', cwd: '/tmp', event: 'StopFailure', error: 1 })).status, 400);
});

test('corpo grande demais é cortado', async () => {
  await assert.rejects(post({ session_id: 's1', cwd: '/tmp', event: 'Stop', x: 'a'.repeat(10000) }).then((r) => {
    if (r.status === 204) throw new Error('aceitou');
    throw new Error('cortado');
  }));
});

test('rotas desconhecidas da API dão 404; o resto segue adiante', async () => {
  assert.equal((await fetch(`${base}/api/nada`)).status, 404);
  assert.equal((await fetch(`${base}/index.html`)).status, 418);
});

test('stream manda a lista na conexão e a cada mudança', async () => {
  const messages = [];
  const req = request(`${base}/api/stream`);
  const got = new Promise((resolve) => {
    req.on('response', (res) => {
      assert.equal(res.headers['content-type'], 'text/event-stream; charset=utf-8');
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk;
        for (let i; (i = buf.indexOf('\n\n')) >= 0; buf = buf.slice(i + 2)) {
          const line = buf.slice(0, i);
          if (line.startsWith('data: ')) messages.push(JSON.parse(line.slice(6)));
          if (messages.length === 2) resolve();
        }
      });
    });
  });
  req.end();
  await new Promise((r) => setTimeout(r, 50));
  await post({ session_id: 's2', cwd: '/tmp/outra', event: 'SessionStart' });
  await got;
  req.destroy();
  assert.equal(messages[1].length, messages[0].length + 1);
  assert.equal(messages[1].at(-1).name, 'outra');
});

test('sessões ficam gravadas e voltam num backend novo', async () => {
  assert.equal((await post({ session_id: 's3', cwd: '/tmp/gravada', event: 'Stop', pid: String(process.pid) })).status, 204);
  const saved = JSON.parse(readFileSync(sessionsFile, 'utf8'));
  assert.ok(saved.some((s) => s.id === 's3' && s.pid === process.pid));
  const again = createOffice({ memoryFile, sessionsFile });
  try {
    assert.ok(again.state.list().some((s) => s.name === 'gravada' && s.status === 'done'));
  } finally {
    again.close();
  }
});

test('StopFailure com tipo de erro vira cota na lista', async () => {
  assert.equal((await post({ session_id: 's4', cwd: '/tmp/cota', event: 'StopFailure', error: 'rate_limit' })).status, 204);
  assert.equal(office.state.list().find((s) => s.name === 'cota').status, 'quota');
});

test('guarda somente a identificação de agente Codex aceita', async () => {
  assert.equal((await post({ session_id: 'codex-1', cwd: '/tmp/codex', event: 'Stop', agent: 'codex', prompt: 'segredo' })).status, 204);
  const saved = JSON.parse(readFileSync(sessionsFile, 'utf8'));
  assert.equal(saved.find(s => s.id === 'codex-1').agent, 'codex');
  assert.ok(!readFileSync(sessionsFile, 'utf8').includes('segredo'));
  assert.equal((await post({ session_id: 'codex-2', cwd: '/tmp/codex', event: 'Stop', agent: 'outro' })).status, 400);
});

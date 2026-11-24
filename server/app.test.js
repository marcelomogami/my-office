import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOffice } from './app.js';

const dir = mkdtempSync(join(tmpdir(), 'my-office-'));
const memoryFile = join(dir, 'memory.json');
const office = createOffice({ memoryFile });
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
  assert.deepEqual(Object.keys(office.state.list()[0]).sort(), ['name', 'seat', 'skin', 'status']);
  assert.ok(!readFileSync(memoryFile, 'utf8').includes('segredo'));
});

test('eventos inválidos respondem 400', async () => {
  assert.equal((await post('não é json')).status, 400);
  assert.equal((await post({ session_id: 's1', cwd: '/tmp' })).status, 400);
  assert.equal((await post({ session_id: 's1', cwd: '/tmp\n', event: 'Stop' })).status, 400);
  assert.equal((await post(null)).status, 400);
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

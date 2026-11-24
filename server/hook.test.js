import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// tools/hook.sh contra um backend falso que só registra o que recebe.
const HOOK = fileURLToPath(new URL('../tools/hook.sh', import.meta.url));
const received = [];
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    received.push(JSON.parse(body));
    res.writeHead(204).end();
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

const run = (input, env = { MY_OFFICE_URL: url }) =>
  spawnSync('bash', [HOOK], { input, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 5000 });
const waitFor = async (n) => {
  for (let i = 0; i < 50 && received.length < n; i++) await new Promise((r) => setTimeout(r, 20));
};

test('envia só identificador, pasta, evento e o pid de quem chamou', async () => {
  const r = run(JSON.stringify({
    session_id: 'a', cwd: '/x', hook_event_name: 'UserPromptSubmit',
    prompt: 'segredo', transcript_path: '/t', tool_input: { command: 'rm' },
  }));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  await waitFor(1);
  assert.deepEqual(received.at(-1), { session_id: 'a', cwd: '/x', event: 'UserPromptSubmit', pid: String(process.pid) });
});

test('entrada ruim: não envia nada e termina com sucesso', async () => {
  const before = received.length;
  for (const input of ['', 'lixo', '{"cwd":"/x","hook_event_name":"Stop"}', '{"session_id":1,"cwd":"/x","hook_event_name":"Stop"}']) {
    const r = run(input);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  }
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(received.length, before);
});

test('backend fora do ar: termina na hora, com sucesso', () => {
  const t = Date.now();
  const r = run('{"session_id":"b","cwd":"/x","hook_event_name":"Stop"}', { MY_OFFICE_URL: 'http://127.0.0.1:9' });
  assert.equal(r.status, 0);
  assert.ok(Date.now() - t < 1000);
});

test('StopFailure manda o tipo do erro, nunca a mensagem', async () => {
  const before = received.length;
  run(JSON.stringify({
    session_id: 'c', cwd: '/x', hook_event_name: 'StopFailure', error: 'rate_limit',
    last_assistant_message: 'API Error: Rate limit reached', error_details: 'segredo',
  }));
  run(JSON.stringify({ session_id: 'd', cwd: '/x', hook_event_name: 'StopFailure', error: 'Texto Livre com espaços' }));
  run(JSON.stringify({ session_id: 'e', cwd: '/x', hook_event_name: 'PostToolUse', error: 'rate_limit' }));
  await waitFor(before + 3);
  const [c, d, e] = received.slice(before).sort((x, y) => x.session_id.localeCompare(y.session_id));
  assert.deepEqual(c, { session_id: 'c', cwd: '/x', event: 'StopFailure', pid: String(process.pid), error: 'rate_limit' });
  assert.equal(d.error, undefined);
  assert.equal(e.error, undefined);
});

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('../tools/codex-hook.sh', import.meta.url));
const received = [];
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => { received.push(JSON.parse(body)); res.writeHead(204).end(); });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
after(() => server.close());
const url = `http://127.0.0.1:${server.address().port}`;
const run = (input, endpoint = url) => spawnSync('bash', [hook], {
  input, env: { ...process.env, MY_OFFICE_URL: endpoint }, encoding: 'utf8', timeout: 3000,
});
const waitFor = async (count) => {
  for (let i = 0; i < 100 && received.length < count; i++) await new Promise((resolve) => setTimeout(resolve, 20));
};

test('eventos do Codex enviam somente metadados permitidos', async () => {
  const events = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PreCompact', 'Stop', 'Interrupt', 'SessionEnd'];
  for (const event of events) {
    const result = run(JSON.stringify({ session_id: event, cwd: '/tmp/codex', hook_event_name: event,
      prompt: 'segredo', last_assistant_message: 'segredo', tool_input: { secret: 'segredo' }, error: 'rate_limit' }));
    assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
  }
  await waitFor(events.length);
  assert.equal(received.length, events.length);
  assert.deepEqual(received.slice().sort((a,b) => a.event.localeCompare(b.event)), events.map((event) => ({
    session_id: event, cwd: '/tmp/codex', event,
  })).sort((a,b) => a.event.localeCompare(b.event)));
});

test('entradas inválidas e eventos não reconhecidos são ignorados', async () => {
  const before = received.length;
  for (const input of ['', 'lixo', '{"session_id":1,"cwd":"/x","hook_event_name":"Stop"}',
    '{"session_id":"a","cwd":"/x","hook_event_name":"StopFailure"}']) {
    const result = run(input);
    assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(received.length, before);
});

test('backend indisponível não bloqueia nem produz saída', () => {
  const start = Date.now();
  const result = run('{"session_id":"a","cwd":"/x","hook_event_name":"Stop"}', 'http://127.0.0.1:9');
  assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
  assert.ok(Date.now() - start < 1000);
});

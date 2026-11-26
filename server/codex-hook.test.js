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
    session_id: event, cwd: '/tmp/codex', event, agent: 'codex',
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

test('falha de modelo e nova tentativa enviam somente a categoria do evento', async () => {
  const before = received.length;
  for (const [event, status] of [['PostModelRequest', 'failed'], ['PreModelRequest', null]]) {
    const r = run(JSON.stringify({ session_id: event, cwd: '/x', hook_event_name: event,
      status, error: 'mensagem privada', prompt: 'segredo', token_usage: { total_tokens: 123 } }));
    assert.equal(r.status, 0); assert.equal(r.stdout, ''); assert.equal(r.stderr, '');
    await waitFor(before + (event === 'PostModelRequest' ? 1 : 2));
  }
  assert.deepEqual(received.slice(before), [
    { session_id: 'PostModelRequest', cwd: '/x', event: 'CodexModelFailed', agent: 'codex' },
    { session_id: 'PreModelRequest', cwd: '/x', event: 'CodexModelStarted', agent: 'codex' },
  ]);
});

test('resultado bem sucedido, cancelado ou desconhecido não vira erro', async () => {
  const before = received.length;
  for (const status of ['completed', 'cancelled', 'outro', null]) {
    const r = run(JSON.stringify({ session_id: 'a', cwd: '/x', hook_event_name: 'PostModelRequest', status }));
    assert.equal(r.status, 0); assert.equal(r.stdout, ''); assert.equal(r.stderr, '');
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(received.length, before);
});

test('falha por limite de uso, cota ou créditos vira cota, sem enviar a mensagem', async () => {
  const before = received.length;
  const quota = [
    'You’ve hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings/usage to purchase more credits or try again at 3:45 PM.',
    'You’ve hit your usage limit for GPT-5. Switch to another model now, or try again later.',
    'Quota exceeded. Check your plan and billing details.',
    'Your workspace is out of credits. Add credits to continue.',
    'You hit your spend cap set in your workspace. Increase your spend cap to continue.',
    'Your API key has reached its spend limit.',
    'rate limit exceeded: try again in 20s',
    'budget reached',
    'To use Codex with your ChatGPT plan, upgrade to Plus: https://chatgpt.com/explore/plus.',
  ];
  const other = ['Selected model is at capacity. Please try a different model.', 'stream disconnected before completion: eof', null];
  for (const [i, error] of [...quota, ...other].entries()) {
    const r = run(JSON.stringify({ session_id: `q${i}`, cwd: '/x', hook_event_name: 'PostModelRequest', status: 'failed', error }));
    assert.equal(r.status, 0); assert.equal(r.stdout, ''); assert.equal(r.stderr, '');
  }
  await waitFor(before + quota.length + other.length);
  const got = received.slice(before).sort((a, b) => Number(a.session_id.slice(1)) - Number(b.session_id.slice(1)));
  assert.deepEqual(got.map((e) => e.event), [...quota.map(() => 'CodexQuotaExceeded'), ...other.map(() => 'CodexModelFailed')]);
  for (const e of got) assert.deepEqual(Object.keys(e).sort(), ['agent', 'cwd', 'event', 'session_id']);
});

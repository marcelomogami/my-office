import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// tools/install-hooks.sh, sempre numa pasta pessoal temporária.
const SCRIPT = fileURLToPath(new URL('../tools/install-hooks.sh', import.meta.url));
const HOOK = fileURLToPath(new URL('../tools/hook.sh', import.meta.url));
const CODEX_HOOK = fileURLToPath(new URL('../tools/codex-hook.sh', import.meta.url));

function home() {
  const dir = mkdtempSync(join(tmpdir(), 'my-office-install-'));
  return dir;
}
function run(dir, ...args) {
  const env = { ...process.env, HOME: dir };
  delete env.CLAUDE_CONFIG_DIR;
  delete env.CODEX_HOME;
  return spawnSync('bash', [SCRIPT, ...args], { env, encoding: 'utf8' });
}
const settings = (dir) => JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
const commands = (config) =>
  Object.fromEntries(Object.entries(config.hooks ?? {}).map(([ev, groups]) => [ev, groups.flatMap((g) => g.hooks.map((h) => h.command))]));

const OTHER = { type: 'command', command: '/usr/bin/other-tool hook' };

test('sem --apply só mostra a mudança e não grava nada', () => {
  const dir = home();
  const r = run(dir, '--agent', 'claude-code');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--apply/);
  assert.ok(!existsSync(join(dir, '.claude', 'settings.json')));
});

test('instala do zero, em todos os eventos, e rodar de novo não muda nada', () => {
  const dir = home();
  assert.equal(run(dir, '--agent', 'claude-code', '--apply').status, 0);
  const cmds = commands(settings(dir));
  assert.deepEqual(Object.keys(cmds), ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PreCompact', 'Stop', 'StopFailure', 'SessionEnd']);
  for (const list of Object.values(cmds)) assert.deepEqual(list, [HOOK]);
  assert.equal(settings(dir).hooks.Stop[0].hooks[0].timeout, 5);
  const again = run(dir, '--agent', 'claude-code', '--apply');
  assert.match(again.stdout, /already up to date/);
  assert.equal(readdirSync(join(dir, '.claude')).filter((f) => f.includes('.bak-')).length, 0);
});

test('preserva os outros hooks e opções, faz backup e troca o caminho de um clone antigo', () => {
  const dir = home();
  mkdirSync(join(dir, '.claude'));
  const before = {
    theme: 'dark',
    hooks: {
      Stop: [{ hooks: [OTHER, { type: 'command', command: '/old/clone/my-office/tools/hook.sh' }] }],
      Notification: [{ matcher: '', hooks: [OTHER] }],
    },
  };
  writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify(before));
  assert.equal(run(dir, '--agent', 'claude-code', '--apply').status, 0);
  const after = settings(dir);
  assert.equal(after.theme, 'dark');
  assert.deepEqual(commands(after).Stop, [OTHER.command, HOOK]);
  assert.deepEqual(after.hooks.Notification, before.hooks.Notification);
  const backups = readdirSync(join(dir, '.claude')).filter((f) => f.startsWith('settings.json.bak-'));
  assert.equal(backups.length, 1);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, '.claude', backups[0]), 'utf8')), before);
});

test('desinstalar remove só as entradas do My Office', () => {
  const dir = home();
  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [{ hooks: [OTHER] }] } }));
  run(dir, '--agent', 'claude-code', '--apply');
  assert.equal(run(dir, '--agent', 'claude-code', '--uninstall', '--apply').status, 0);
  assert.deepEqual(settings(dir), { hooks: { Stop: [{ hooks: [OTHER] }] } });
});

test('Codex vai para CODEX_HOME/hooks.json, sem timeout', () => {
  const dir = home();
  const codexHome = join(dir, 'codex-home');
  const env = { ...process.env, HOME: dir, CODEX_HOME: codexHome };
  assert.equal(spawnSync('bash', [SCRIPT, '--agent', 'codex', '--apply'], { env, encoding: 'utf8' }).status, 0);
  const config = JSON.parse(readFileSync(join(codexHome, 'hooks.json'), 'utf8'));
  assert.ok(commands(config).PostModelRequest.includes(CODEX_HOOK));
  assert.equal(config.hooks.Stop[0].hooks[0].timeout, undefined);
});

test('JSON inválido ou agente desconhecido não mexem em nada', () => {
  const dir = home();
  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, '.claude', 'settings.json'), '{ quebrado');
  const r = run(dir, '--agent', 'claude-code', '--apply');
  assert.equal(r.status, 1);
  assert.equal(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'), '{ quebrado');
  assert.equal(run(dir, '--agent', 'gemini').status, 2);
});

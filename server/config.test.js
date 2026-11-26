import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, parseConfig } from './config.js';

const cast = ['char1', 'char2', 'custom1'];
const desks = ['1', '2', '3', '4', '5', '6'];
const parse = (data) => {
  const messages = [];
  return { fixed: parseConfig(data, { cast, desks, log: (m) => messages.push(m) }), messages };
};

test('projeto com personagem e baia, ou só um dos dois', () => {
  const { fixed, messages } = parse({ projects: { a: { character: 'custom1', desk: 1 }, b: { character: 'char1' }, c: { desk: 6 } } });
  assert.deepEqual(fixed, { a: { skin: 'custom1', seat: '1' }, b: { skin: 'char1' }, c: { seat: '6' } });
  assert.deepEqual(messages, []);
});

test('personagem e baia desconhecidos são recusados com mensagem', () => {
  const { fixed, messages } = parse({ projects: { a: { character: 'boss', desk: 7 }, b: { character: 'char2', desk: '2' } } });
  assert.deepEqual(fixed, { b: { skin: 'char2' } });
  assert.equal(messages.length, 3);
  assert.match(messages[0], /personagem desconhecido "boss"/);
  assert.match(messages[1], /baia desconhecida 7/);
  assert.match(messages[2], /baia desconhecida "2"/);
});

test('personagem ou baia em dois projetos: o segundo é recusado', () => {
  const { fixed, messages } = parse({ projects: { a: { character: 'char1', desk: 1 }, b: { character: 'char1', desk: 1 } } });
  assert.deepEqual(fixed, { a: { skin: 'char1', seat: '1' } });
  assert.match(messages[0], /"char1" já é do projeto "a"/);
  assert.match(messages[1], /baia 1 já é do projeto "a"/);
});

test('formato errado é ignorado com mensagem', () => {
  assert.deepEqual(parse([]).fixed, {});
  assert.deepEqual(parse({ projects: [] }).fixed, {});
  const { fixed, messages } = parse({ projects: { a: 'char1' } });
  assert.deepEqual(fixed, {});
  assert.match(messages[0], /projeto "a": a entrada precisa ser um objeto/);
});

test('lê config.json da pasta de configuração; sem arquivo, sem fixas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'my-office-config-'));
  try {
    const messages = [];
    const log = (m) => messages.push(m);
    assert.deepEqual(loadConfig({ configDir: dir, cast, desks, log }), {});
    writeFileSync(join(dir, 'config.json'), '{ quebrado');
    assert.deepEqual(loadConfig({ configDir: dir, cast, desks, log }), {});
    assert.match(messages[0], /JSON inválido/);
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ projects: { a: { character: 'char2', desk: 3 } } }));
    assert.deepEqual(loadConfig({ configDir: dir, cast, desks, log }), { a: { skin: 'char2', seat: '3' } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import locales from '../src/locales.json' with { type: 'json' };
import { normalizeLanguage, translator } from '../src/i18n.js';
import { STATUS } from '../src/status.js';
import { loadLanguage, parseLanguage } from './config.js';

test('todo idioma traduz as mesmas chaves do inglês', () => {
  const keys = Object.keys(locales.en).sort();
  for (const [lang, strings] of Object.entries(locales)) assert.deepEqual(Object.keys(strings).sort(), keys, lang);
  for (const status of Object.keys(STATUS)) assert.ok(`status.${status}` in locales.en, status);
});

test('idioma sem diferenciar maiúsculas, padrão inglês e queda para o inglês', () => {
  assert.equal(normalizeLanguage('pt-br'), 'pt-BR');
  assert.equal(normalizeLanguage('xx'), null);
  assert.equal(translator('PT-BR')('status.working'), 'trabalhando');
  assert.equal(translator()('status.working'), 'working');
  assert.equal(translator('xx')('manager'), 'MANAGER');
  assert.equal(translator('pt-BR')('chave-inexistente'), 'chave-inexistente');
});

test('o idioma vem do config.json e um idioma desconhecido vira inglês com aviso', () => {
  const logs = [];
  assert.equal(parseLanguage({ language: 'pt-br' }), 'pt-BR');
  assert.equal(parseLanguage({}), 'en');
  assert.equal(parseLanguage({ language: 'klingon' }, { log: (m) => logs.push(m) }), 'en');
  assert.equal(logs.length, 1);
  const dir = mkdtempSync(join(tmpdir(), 'my-office-lang-'));
  assert.equal(loadLanguage({ configDir: dir }), 'en');
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ language: 'pt-BR', projects: {} }));
  assert.equal(loadLanguage({ configDir: dir }), 'pt-BR');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { castOf, mergeCatalogs, seatedAt } from '../src/characters.js';
import { DEFAULT_CAST, loadCharacters } from './characters.js';

const cell = [21, 24];
const entry = (id, col) => ({ id, seated: [col, 0], standing: [col + 1, 0], face: [3, 3, 13, 14] });

test('catálogo padrão tem o Boss e seis personagens no sorteio', () => {
  const { characters } = loadCharacters({ configDir: '/nonexistent' });
  assert.equal(characters[0].id, 'boss');
  assert.deepEqual(DEFAULT_CAST, ['char1', 'char2', 'char3', 'char4', 'char5', 'char6']);
  assert.deepEqual(characters[1].standing, [69, 0, 21, 24]);
});

test('custom substitui pelo id e acrescenta ids novos', () => {
  const merged = mergeCatalogs({
    default: { cell, gap: 2, characters: [entry('boss', 0), entry('char1', 2)] },
    custom: { cell, gap: 2, characters: [entry('boss', 0), entry('custom1', 2), { id: 'Inválido' }] },
  });
  assert.deepEqual(merged.map((c) => [c.id, c.sheet]), [['boss', 'custom'], ['char1', 'default'], ['custom1', 'custom']]);
  assert.deepEqual(castOf(merged), ['char1', 'custom1']);
});

test('custom só entra com catálogo e folha', () => {
  const dir = mkdtempSync(join(tmpdir(), 'my-office-chars-'));
  mkdirSync(join(dir, 'characters'));
  const custom = { sheet: 'custom.png', cell, gap: 2, characters: [entry('custom1', 0)] };
  writeFileSync(join(dir, 'characters', 'custom.json'), JSON.stringify(custom));
  assert.equal(loadCharacters({ configDir: dir }).sheets.custom, undefined);
  copyFileSync(new URL('../assets/characters/default.png', import.meta.url), join(dir, 'characters', 'custom.png'));
  const loaded = loadCharacters({ configDir: dir });
  assert.ok(loaded.sheets.custom);
  assert.ok(castOf(loaded.characters).includes('custom1'));
});

test('a mesma regra senta qualquer personagem, inclusive em cadeira espelhada', () => {
  assert.deepEqual(seatedAt(40, 199, false, 21), { x: 39, y: 195 });
  assert.deepEqual(seatedAt(91, 199, true, 21), { x: 82, y: 195 });
});

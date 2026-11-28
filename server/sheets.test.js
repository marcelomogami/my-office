import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { customItems, loadSheets } from './sheets.js';

const PNG = new URL('../assets/ui/default.png', import.meta.url);

function configWith(kind, map, { sheet = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'my-office-sheets-'));
  mkdirSync(join(dir, kind));
  writeFileSync(join(dir, kind, 'custom.json'), JSON.stringify(map));
  if (sheet) copyFileSync(PNG, join(dir, kind, 'custom.png'));
  return dir;
}

test('sem pasta custom, não há folhas custom', () => {
  assert.deepEqual(loadSheets({ configDir: '/nonexistent', log: () => {} }), {});
});

test('objetos: o custom só substitui sprites que existem no padrão', () => {
  const logs = [];
  const dir = configWith('office', { items: { desk: [0, 0, 17, 19], sofaRosa: [0, 0, 40, 24] } });
  const sheets = loadSheets({ configDir: dir, log: (m) => logs.push(m) });
  assert.deepEqual(sheets.office.items, { desk: [0, 0, 17, 19] });
  assert.ok(sheets.office.sheet.endsWith(join('office', 'custom.png')));
  assert.ok(logs.some((m) => m.includes('sofaRosa')));
});

test('interface: o custom substitui e também acrescenta ícones', () => {
  const dir = configWith('ui', { items: { iconDone: [0, 19, 9, 9], iconHappy: [11, 19, 9, 9] } });
  const sheets = loadSheets({ configDir: dir, log: () => {} });
  assert.deepEqual(sheets.ui.items, { iconDone: [0, 19, 9, 9], iconHappy: [11, 19, 9, 9] });
});

test('sem a folha PNG, o mapa custom é ignorado', () => {
  const logs = [];
  const dir = configWith('ui', { items: { iconDone: [0, 19, 9, 9] } }, { sheet: false });
  assert.deepEqual(loadSheets({ configDir: dir, log: (m) => logs.push(m) }), {});
  assert.equal(logs.length, 1);
});

test('retângulos e nomes inválidos são descartados', () => {
  const items = customItems(
    { items: { desk: [0, 0, 0, 19], chair0: [0, 0, 16], 'a:b': [0, 0, 1, 1], plant: [1, 2, 3, 4] } },
    { desk: [], chair0: [], plant: [] },
    { log: () => {} },
  );
  assert.deepEqual(items, { plant: [1, 2, 3, 4] });
  assert.deepEqual(customItems({ items: [] }, {}, { log: () => {} }), {});
});

test('emotes custom precisam apontar para sprites disponíveis', async () => {
  const { emoteCatalog } = await import('./sheets.js');
  const dir = configWith('ui', { items: { iconNovo: [0, 30, 9, 9] }, emotes: { novo: 'iconNovo', heart: 'iconNovo', broken: 'missing', proto: 'toString' } });
  const catalog = emoteCatalog(loadSheets({ configDir: dir, log: () => {} }));
  assert.equal(catalog.novo, 'iconNovo');
  assert.equal(catalog.heart, 'iconNovo');
  assert.equal(catalog.broken, undefined);
  assert.equal(catalog.proto, undefined);
});

test('mapa custom nulo não impede a inicialização', () => {
  const dir = configWith('ui', null);
  assert.deepEqual(loadSheets({ configDir: dir, log: () => {} }), {});
});

test('emote custom pode usar sprite padrão sem acrescentar itens', async () => {
  const { emoteCatalog } = await import('./sheets.js');
  const dir = configWith('ui', { items: {}, emotes: { love: 'iconHeart' } });
  assert.equal(emoteCatalog(loadSheets({ configDir: dir, log: () => {} })).love, 'iconHeart');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelFace } from '../src/panel.js';

test('home office mantém a skin fixa ou a skin já atribuída', () => {
  const cache = new Map();
  assert.equal(panelFace('~secretario', null, cache), 's6');
  assert.equal(panelFace('projeto', 's2', cache), 's2');
});

test('sem skin, sorteia rosto estável sem usar o gerente', () => {
  const cache = new Map();
  const first = panelFace('projeto', null, cache, () => 0.99);
  assert.ok(first && first !== 's5');
  assert.equal(panelFace('projeto', null, cache, () => 0), first);
});

test('home office mantém indicação de pronto sem tempo ao descansar', async () => {
  const { panelDetails } = await import('../src/panel.js');
  assert.deepEqual(panelDetails('projeto', 'idle', false, 0, 600000), { title: 'projeto (home office)', text: '👍 pronto' });
  assert.deepEqual(panelDetails('projeto', 'done', false, 0, 600000), { title: 'projeto (home office)', text: '👍 pronto' });
  assert.deepEqual(panelDetails('projeto', 'error', false, 0, 600000), { title: 'projeto (home office)', text: '❗ deu erro' });
});

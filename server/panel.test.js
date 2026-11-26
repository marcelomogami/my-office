import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelFace } from '../src/panel.js';

test('home office mantém a skin fixa ou a skin já atribuída', () => {
  const cache = new Map();
  const cast = ['char1', 'char2', 'custom1'];
  assert.equal(panelFace('~secretario', null, cache, cast), 'custom1');
  assert.equal(panelFace('projeto', 'char2', cache, cast), 'char2');
});

test('sem skin, sorteia rosto estável entre os personagens do sorteio', () => {
  const cache = new Map();
  const cast = ['char1', 'char2'];
  const first = panelFace('projeto', null, cache, cast, () => 0.99);
  assert.equal(first, 'char2');
  assert.equal(panelFace('projeto', null, cache, cast, () => 0), first);
});

test('rosto sorteado nunca é o de uma sessão fixa', () => {
  const cast = ['char1', 'char2', 'custom1'];
  for (const r of [0, 0.5, 0.99]) assert.equal(panelFace(`p${r}`, null, new Map(), cast, () => r), 'char2');
});

test('home office mantém indicação de pronto sem tempo ao descansar', async () => {
  const { panelDetails } = await import('../src/panel.js');
  assert.deepEqual(panelDetails('projeto', 'idle', false, 0, 600000), { title: 'projeto (home office)', text: '👍 pronto' });
  assert.deepEqual(panelDetails('projeto', 'done', false, 0, 600000), { title: 'projeto (home office)', text: '👍 pronto' });
  assert.deepEqual(panelDetails('projeto', 'error', false, 0, 600000), { title: 'projeto (home office)', text: '❗ deu erro' });
});

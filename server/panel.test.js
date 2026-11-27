import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelFace } from '../src/panel.js';
import { translator } from '../src/i18n.js';

test('home office mantém a skin fixa ou a skin já atribuída', () => {
  const cache = new Map();
  const cast = ['char1', 'char2', 'custom1'];
  const fixed = { fixo: { skin: 'custom1' } };
  assert.equal(panelFace('fixo', null, cache, cast, fixed), 'custom1');
  assert.equal(panelFace('projeto', 'char2', cache, cast, fixed), 'char2');
});

test('sem skin, sorteia rosto estável entre os personagens do sorteio', () => {
  const cache = new Map();
  const cast = ['char1', 'char2'];
  const first = panelFace('projeto', null, cache, cast, {}, () => 0.99);
  assert.equal(first, 'char2');
  assert.equal(panelFace('projeto', null, cache, cast, {}, () => 0), first);
});

test('rosto sorteado nunca é o de uma sessão fixa', () => {
  const cast = ['char1', 'char2', 'custom1'];
  const fixed = { a: { skin: 'char1' }, b: { skin: 'custom1' } };
  for (const r of [0, 0.5, 0.99]) assert.equal(panelFace(`p${r}`, null, new Map(), cast, fixed, () => r), 'char2');
});

test('home office mantém indicação de pronto sem tempo ao descansar', async () => {
  const { panelDetails } = await import('../src/panel.js');
  const pt = translator('pt-BR');
  assert.deepEqual(panelDetails('projeto', 'idle', false, 0, 600000, pt), { title: 'projeto (home office)', text: '👍 pronto' });
  assert.deepEqual(panelDetails('projeto', 'done', false, 0, 600000, pt), { title: 'projeto (home office)', text: '👍 pronto' });
  assert.deepEqual(panelDetails('projeto', 'error', false, 0, 600000, pt), { title: 'projeto (home office)', text: '❗ deu erro' });
});

test('o quadro fala inglês por padrão e mostra o tempo parado', async () => {
  const { panelDetails } = await import('../src/panel.js');
  assert.deepEqual(panelDetails('projeto', 'idle', true, 0, 600000), { title: 'projeto', text: '☕ resting · 10m' });
  assert.deepEqual(panelDetails('projeto', 'quota', true, 0, 60000), { title: 'projeto', text: '🪫 out of quota · 01m' });
});

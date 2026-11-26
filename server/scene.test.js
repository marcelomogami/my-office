import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = JSON.parse(readFileSync(new URL('../src/scene.json', import.meta.url), 'utf8'));

test('sete lugares de descanso, um por baia mais o do Boss', () => {
  const rest = Object.entries(scene.rest);
  assert.deepEqual(rest.map(([id]) => id), ['1', '2', '3', '4', '5', '6', '7']);
  assert.ok(rest.length > scene.seatOrder.length);
  for (const [id, place] of rest) {
    assert.ok(place.stand || place.chair, `lugar ${id} sem posição`);
    // quem senta precisa de um marcador na ordem de desenho
    if (place.chair) assert.ok(scene.items.some(([name]) => name === `rest:${id}`), `rest:${id} fora da cena`);
  }
});

test('o sofá tem dois lugares, desenhados depois dele', () => {
  const sofa = scene.items.findIndex(([name]) => name === 'sofaOrange');
  const slots = ['rest:4', 'rest:5'].map((n) => scene.items.findIndex(([name]) => name === n));
  assert.ok(slots.every((i) => i > sofa));
  assert.equal(scene.items.filter(([name]) => name === 'cat').length, 1);
  assert.equal(scene.items.filter(([name]) => name === 'dog').length, 1);
});

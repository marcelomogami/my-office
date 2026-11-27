import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextMoveAt, pickSpot } from '../src/rest.js';

test('a próxima troca cai entre o intervalo e um terço a mais; 0 desliga', () => {
  assert.equal(nextMoveAt(1000, 15, () => 0), 1000 + 15 * 60_000);
  assert.equal(nextMoveAt(1000, 15, () => 0.999999), 1000 + 15 * 60_000 * (1 + 0.999999 / 3));
  assert.ok(nextMoveAt(0, 15, () => 1) <= 20 * 60_000);
  assert.equal(nextMoveAt(1000, 0), null);
  assert.equal(nextMoveAt(1000, undefined), null);
});

test('o lugar novo nunca é o atual nem um ocupado', () => {
  const spots = ['1', '2', '3', '4'];
  for (let i = 0; i < 50; i++) {
    const spot = pickSpot(spots, new Set(['2']), '1');
    assert.ok(spot === '3' || spot === '4');
  }
  assert.equal(pickSpot(['1', '2'], new Set(['2']), '1'), null);
});

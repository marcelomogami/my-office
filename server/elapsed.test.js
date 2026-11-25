import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elapsedLabel } from '../src/elapsed.js';

test('mostra minutos e horas em formato compacto', () => {
  assert.equal(elapsedLabel(0, 2 * 60000), '02m');
  assert.equal(elapsedLabel(0, 38 * 60000), '38m');
  assert.equal(elapsedLabel(0, 125 * 60000), '2h05m');
  assert.equal(elapsedLabel(60000, 0), '00m');
  assert.equal(elapsedLabel(null, 0), '');
});

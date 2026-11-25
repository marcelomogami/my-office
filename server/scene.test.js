import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scene = JSON.parse(readFileSync(new URL('../src/scene.json', import.meta.url), 'utf8'));
test('sofá tem o sexto lugar de descanso, virado para o gato', () => {
  assert.equal(Object.keys(scene.meeting).length, 3);
  assert.equal(scene.meeting.S.flip, 1);
  const sofa = scene.items.findIndex(([name]) => name === 'sofaOrange');
  const cat = scene.items.findIndex(([name]) => name === 'cat');
  const slot = scene.items.findIndex(([name]) => name === 'meet:S');
  assert.ok(sofa >= 0 && sofa < cat && cat < slot);
  assert.equal(scene.items[cat][1], 70);
  assert.equal(scene.items.filter(([name]) => name === 'dog').length, 1);
});

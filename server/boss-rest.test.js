import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBossRest } from '../src/boss-rest.js';

test('Boss espera lugar livre, descansa pelo tempo definido e sorteia novo intervalo', () => {
  let time = 0;
  const boss = createBossRest({ intervalMax: 120, duration: 25, now: () => time, random: () => 0 });
  time = 59; assert.equal(boss.tick(() => true), null);
  time = 60; assert.equal(boss.tick(() => false), null);
  time = 70; assert.equal(boss.tick(() => true), 'rest');
  time = 94; assert.equal(boss.tick(() => true), null);
  time = 95; assert.equal(boss.tick(() => true), 'work');
  time = 154; assert.equal(boss.tick(() => true), null);
  time = 155; assert.equal(boss.tick(() => true), 'rest');
});

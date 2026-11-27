import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOW_AFTER_MS, STALE_AFTER_MS, isStale, showDisconnected } from '../src/connection.js';

test('conexão de pé e recente não mostra aviso', () => {
  assert.equal(showDisconnected({ downSince: null, lastSeen: 1000 }, 30_000), false);
  assert.equal(isStale(1000, 30_000), false);
});

test('conexão caída só avisa depois de 10 s', () => {
  assert.equal(showDisconnected({ downSince: 0, lastSeen: 0 }, SHOW_AFTER_MS - 1), false);
  assert.equal(showDisconnected({ downSince: 0, lastSeen: 0 }, SHOW_AFTER_MS), true);
});

test('conexão parada sem mensagens conta como caída depois de 60 s', () => {
  assert.equal(isStale(0, STALE_AFTER_MS), true);
  assert.equal(showDisconnected({ downSince: null, lastSeen: 0 }, STALE_AFTER_MS + SHOW_AFTER_MS - 1), false);
  assert.equal(showDisconnected({ downSince: null, lastSeen: 0 }, STALE_AFTER_MS + SHOW_AFTER_MS), true);
});

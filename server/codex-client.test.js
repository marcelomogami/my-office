import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCodexThreads } from './codex-client.js';

function fakeSocket(pages, fail = false) {
  return class extends EventTarget {
    constructor() { super(); queueMicrotask(() => this.dispatchEvent(new Event(fail ? 'error' : 'open'))); }
    send(raw) {
      const req = JSON.parse(raw);
      if (req.id === undefined) return;
      const result = req.method === 'initialize' ? {} : pages.shift();
      queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id: req.id, result }) })));
    }
    close() {}
  };
}
test('consulta somente identificadores, incluindo todas as páginas', async () => {
  const Socket = fakeSocket([{ data: ['a'], nextCursor: 'next' }, { data: ['b'], nextCursor: null }]);
  assert.deepEqual([...await loadCodexThreads('ws://127.0.0.1:8767', { Socket })], ['a', 'b']);
});
test('recusa endereços externos e falhas não viram lista vazia', async () => {
  await assert.rejects(loadCodexThreads('ws://example.com:8767', { Socket: fakeSocket([]) }));
  await assert.rejects(loadCodexThreads('ws://127.0.0.1:8767', { Socket: fakeSocket([], true) }));
  await assert.rejects(loadCodexThreads('ws://127.0.0.1:8767', { Socket: fakeSocket([{ data: null }]) }));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMemory, loadSessions } from './memory.js';

test('memória e sessões da 0.7 são convertidas: skins, baias em letras e nomes com til', () => {
  const dir = mkdtempSync(join(tmpdir(), 'my-office-memory-'));
  try {
    const memoryFile = join(dir, 'memory.json');
    const sessionsFile = join(dir, 'sessions.json');
    writeFileSync(memoryFile, JSON.stringify({ skins: { a: 's2', b: 'char4' }, seats: { a: 'G', '~fixo': 'I', b: '3' } }));
    writeFileSync(sessionsFile, JSON.stringify([{ id: 'x', name: '~fixo', status: 'done' }, { id: 'y', name: 'b', status: 'done' }]));
    const memory = loadMemory(memoryFile);
    assert.deepEqual([...memory.skins], [['a', 'char2'], ['b', 'char4']]);
    assert.deepEqual([...memory.seats], [['a', '6'], ['fixo', '1'], ['b', '3']]);
    assert.deepEqual(loadSessions(sessionsFile).map((s) => s.name), ['fixo', 'b']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

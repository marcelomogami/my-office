import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// Memória de skin e lugar de cada sessão, num arquivo JSON local, para valer
// em qualquer navegador e sobreviver a reinícios do backend.

export const MEMORY_FILE = join(process.env.XDG_STATE_HOME || join(homedir(), '.local/state'), 'my-office/memory.json');

export function loadMemory(file = MEMORY_FILE) {
  try {
    const { skins = {}, seats = {} } = JSON.parse(readFileSync(file, 'utf8'));
    return { skins: new Map(Object.entries(skins)), seats: new Map(Object.entries(seats)) };
  } catch {
    return { skins: new Map(), seats: new Map() };
  }
}

// Grava num arquivo temporário e renomeia, para nunca deixar o JSON pela metade.
export function saveMemory(memory, file = MEMORY_FILE) {
  try {
    mkdirSync(dirname(file), { recursive: true });
    const data = { skins: Object.fromEntries(memory.skins), seats: Object.fromEntries(memory.seats) };
    writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 1) + '\n');
    renameSync(`${file}.tmp`, file);
  } catch (err) {
    console.error(`my-office: não deu para gravar ${file}: ${err.message}`);
  }
}

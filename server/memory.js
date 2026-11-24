import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// Arquivos de estado locais, para sobreviver a reinícios do backend:
// - memory.json: skin e lugar de cada sessão (vale em qualquer navegador);
// - sessions.json: as sessões abertas, para a sala não esvaziar quando o
//   backend reinicia com sessões paradas.

const STATE_DIR = join(process.env.XDG_STATE_HOME || join(homedir(), '.local/state'), 'my-office');
export const MEMORY_FILE = join(STATE_DIR, 'memory.json');
export const SESSIONS_FILE = join(STATE_DIR, 'sessions.json');

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Grava num arquivo temporário e renomeia, para nunca deixar o JSON pela metade.
function writeJson(file, data) {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 1) + '\n');
    renameSync(`${file}.tmp`, file);
  } catch (err) {
    console.error(`my-office: não deu para gravar ${file}: ${err.message}`);
  }
}

export function loadMemory(file = MEMORY_FILE) {
  const { skins = {}, seats = {} } = readJson(file) ?? {};
  return { skins: new Map(Object.entries(skins)), seats: new Map(Object.entries(seats)) };
}

export function saveMemory(memory, file = MEMORY_FILE) {
  writeJson(file, { skins: Object.fromEntries(memory.skins), seats: Object.fromEntries(memory.seats) });
}

export function loadSessions(file = SESSIONS_FILE) {
  const list = readJson(file);
  return Array.isArray(list) ? list.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string') : [];
}

export function saveSessions(list, file = SESSIONS_FILE) {
  writeJson(file, list);
}

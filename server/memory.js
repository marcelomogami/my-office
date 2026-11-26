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

// Ids da folha antiga (até a 0.7), convertidos para os do catálogo.
const LEGACY_SKINS = { s0: 'char1', s1: 'char3', s2: 'char2', s3: 'char5', s4: 'char4', s6: 'custom1', s7: 'custom2' };

// Baias em letras (até a 0.7), convertidas para os números de agora.
const LEGACY_SEATS = { I: '1', F: '2', E: '3', D: '4', H: '5', G: '6' };
// Até a 0.7, algumas sessões tinham nome especial com til ("~projeto").
const legacyName = (name) => name.replace(/^~/, '');

export function loadMemory(file = MEMORY_FILE) {
  const { skins = {}, seats = {} } = readJson(file) ?? {};
  const skinOf = ([name, skin]) => [legacyName(name), LEGACY_SKINS[skin] ?? skin];
  const seatOf = ([name, seat]) => [legacyName(name), LEGACY_SEATS[seat] ?? seat];
  return { skins: new Map(Object.entries(skins).map(skinOf)), seats: new Map(Object.entries(seats).map(seatOf)) };
}

export function saveMemory(memory, file = MEMORY_FILE) {
  writeJson(file, { skins: Object.fromEntries(memory.skins), seats: Object.fromEntries(memory.seats) });
}

export function loadSessions(file = SESSIONS_FILE) {
  const list = readJson(file);
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string')
    .map((s) => ({ ...s, name: legacyName(s.name) }));
}

export function saveSessions(list, file = SESSIONS_FILE) {
  writeJson(file, list);
}

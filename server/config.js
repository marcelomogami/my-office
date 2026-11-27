import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_DIR } from './characters.js';
import { DEFAULT_LANGUAGE, LANGUAGES, normalizeLanguage } from '../src/i18n.js';

// Configuração local (config.json na pasta de configuração, a mesma dos
// personagens custom), fora do repositório. Ela diz o idioma da interface e
// quais projetos têm personagem e baia fixos:
//
//   { "language": "pt-BR",
//     "timers": { "rest": 10, "leaveRoom": 240, ... },
//     "projects": { "<projeto>": { "character": "<id>", "desk": <número> } } }
//
// `character` e `desk` são opcionais. O resultado é o mapa de sessões fixas
// de src/sessions.js: { projeto: { skin, seat } }, com a baia como texto
// ("1" a "6", os ids de src/scene.json). Entradas inválidas são descartadas
// com uma mensagem em `log`; o resto da configuração continua valendo.

export function parseConfig(data, { cast, desks, log = console.error, file = 'config.json' }) {
  const fixed = {};
  const warn = (msg) => log(`my-office: ${file}: ${msg}`);
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    warn('o arquivo precisa ser um objeto JSON; configuração ignorada');
    return fixed;
  }
  const projects = data.projects ?? {};
  if (typeof projects !== 'object' || Array.isArray(projects)) {
    warn('"projects" precisa ser um objeto; configuração ignorada');
    return fixed;
  }
  const owner = { skin: new Map(), seat: new Map() };
  for (const [name, entry] of Object.entries(projects)) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      warn(`projeto "${name}": a entrada precisa ser um objeto; ignorada`);
      continue;
    }
    const item = {};
    if (entry.character !== undefined) {
      if (!cast.includes(entry.character)) {
        warn(`projeto "${name}": personagem desconhecido "${entry.character}" (disponíveis: ${cast.join(', ')}); ignorado`);
      } else if (owner.skin.has(entry.character)) {
        warn(`projeto "${name}": o personagem "${entry.character}" já é do projeto "${owner.skin.get(entry.character)}"; ignorado`);
      } else {
        item.skin = entry.character;
        owner.skin.set(entry.character, name);
      }
    }
    if (entry.desk !== undefined) {
      const seat = String(entry.desk);
      if (!Number.isInteger(entry.desk) || !desks.includes(seat)) {
        warn(`projeto "${name}": baia desconhecida ${JSON.stringify(entry.desk)} (use um número de ${desks[0]} a ${desks.at(-1)}); ignorada`);
      } else if (owner.seat.has(seat)) {
        warn(`projeto "${name}": a baia ${seat} já é do projeto "${owner.seat.get(seat)}"; ignorada`);
      } else {
        item.seat = seat;
        owner.seat.set(seat, name);
      }
    }
    if (item.skin || item.seat) fixed[name] = item;
  }
  return fixed;
}

// Lê <configDir>/config.json; null sem arquivo ou com JSON inválido.
function readConfig(configDir, log) {
  const file = join(configDir, 'config.json');
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') log(`my-office: não deu para ler ${file}: ${err.message}`);
    return null;
  }
  try {
    return { data: JSON.parse(text), file };
  } catch (err) {
    log(`my-office: ${file}: JSON inválido (${err.message}); configuração ignorada`);
    return null;
  }
}

// Sessões fixas do config.json. Sem arquivo, não há sessões fixas.
export function loadConfig({ configDir = CONFIG_DIR, cast, desks, log = console.error }) {
  const config = readConfig(configDir, log);
  return config ? parseConfig(config.data, { cast, desks, log, file: config.file }) : {};
}

// Idioma da interface: "language" no config.json, sem diferenciar maiúsculas
// ("pt-BR" ou "pt-br"). Sem a opção, ou com um idioma sem tradução, inglês.
export function parseLanguage(data, { log = console.error, file = 'config.json' } = {}) {
  const value = data?.language;
  if (value === undefined) return DEFAULT_LANGUAGE;
  const language = normalizeLanguage(value);
  if (language) return language;
  log(`my-office: ${file}: idioma desconhecido ${JSON.stringify(value)} (disponíveis: ${LANGUAGES.join(', ')}); usando ${DEFAULT_LANGUAGE}`);
  return DEFAULT_LANGUAGE;
}

export function loadLanguage({ configDir = CONFIG_DIR, log = console.error } = {}) {
  const config = readConfig(configDir, log);
  return config ? parseLanguage(config.data, { log, file: config.file }) : DEFAULT_LANGUAGE;
}

// Tempos do ciclo das sessões, em minutos. Cada um é opcional: o que faltar,
// ou for inválido, fica com o padrão.
//   rest                 pronto, erro ou cota sem evento: vai descansar
//   leaveRoom            sem evento: sai da sala e libera a baia
//   leaveList            fechada ou fora da sala: sai também da lista
//   homeOfficeLeaveList  home office sem evento: sai da lista
//   restMove             descansando: troca de lugar (sorteio entre o valor e
//                        um terço a mais); 0 desliga
// A ordem do ciclo é fixa (descansar, sair da sala, sair da lista): um valor
// personalizado que a quebre é ignorado, com aviso.
export const DEFAULT_TIMERS = { rest: 10, leaveRoom: 240, leaveList: 480, homeOfficeLeaveList: 60, restMove: 15 };
const ORDER = ['rest', 'leaveRoom', 'leaveList'];

export function parseTimers(data, { log = console.error, file = 'config.json' } = {}) {
  const timers = { ...DEFAULT_TIMERS };
  const source = data?.timers;
  if (source === undefined) return timers;
  const warn = (msg) => log(`my-office: ${file}: timers: ${msg}`);
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    warn('precisa ser um objeto; usando os tempos padrão');
    return timers;
  }
  const custom = new Set();
  for (const [name, value] of Object.entries(source)) {
    if (!(name in DEFAULT_TIMERS)) {
      warn(`tempo desconhecido "${name}" (disponíveis: ${Object.keys(DEFAULT_TIMERS).join(', ')}); ignorado`);
    } else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (value === 0 && name !== 'restMove')) {
      warn(`"${name}" precisa ser um número de minutos maior que zero${name === 'restMove' ? ' (ou 0 para desligar)' : ''}; usando ${DEFAULT_TIMERS[name]}`);
    } else {
      timers[name] = value;
      custom.add(name);
    }
  }
  for (let i = 1; i < ORDER.length; i++) {
    const [before, after] = [ORDER[i - 1], ORDER[i]];
    if (timers[before] < timers[after]) continue;
    // quebra a ordem: volta ao padrão o valor personalizado do par
    const undo = custom.has(after) ? after : before;
    warn(`"${before}" (${timers[before]}) precisa ser menor que "${after}" (${timers[after]}); usando ${DEFAULT_TIMERS[undo]} em "${undo}"`);
    timers[undo] = DEFAULT_TIMERS[undo];
    custom.delete(undo);
    i = 0; // confere a ordem de novo desde o começo
  }
  return timers;
}

export function loadTimers({ configDir = CONFIG_DIR, log = console.error } = {}) {
  const config = readConfig(configDir, log);
  return config ? parseTimers(config.data, { log, file: config.file }) : { ...DEFAULT_TIMERS };
}

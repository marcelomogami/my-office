import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_DIR } from './characters.js';

// Folhas custom de objetos e de interface, na pasta de configuração local
// (<configDir>/office e <configDir>/ui), fora do repositório. Como nos
// personagens, o custom se sobrepõe ao padrão sprite a sprite: cada nome do
// custom.json substitui o sprite de mesmo nome da folha padrão, e o que não
// estiver nele continua vindo do padrão. Na folha de objetos só valem nomes
// que existem no mapa padrão, porque a disposição da sala é a do projeto; na
// de interface, nomes novos acrescentam balões e ícones (emotes). O custom só
// entra se tiver o mapa e a folha.

export const KINDS = ['office', 'ui'];
const ADDS = new Set(['ui']); // folhas em que o custom pode acrescentar sprites

const DEFAULT_MAPS = Object.fromEntries(
  KINDS.map((kind) => [kind, JSON.parse(readFileSync(new URL(`../assets/${kind}/default.json`, import.meta.url), 'utf8')).items]),
);

const isRect = (r) => Array.isArray(r) && r.length === 4 && r.every((n) => Number.isInteger(n) && n >= 0) && r[2] > 0 && r[3] > 0;

// Sprites válidos do mapa custom: retângulo [x, y, largura, altura] e nome
// conhecido (ou qualquer nome válido, com `adds`).
export function customItems(data, defaults, { adds = false, log = console.error, file = 'custom.json' } = {}) {
  const items = {};
  const source = data?.items;
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    log(`my-office: ${file}: "items" precisa ser um objeto; folha custom ignorada`);
    return items;
  }
  for (const [name, rect] of Object.entries(source)) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(name)) log(`my-office: ${file}: nome de sprite inválido "${name}"; ignorado`);
    else if (!adds && !(name in defaults)) log(`my-office: ${file}: sprite desconhecido "${name}"; ignorado`);
    else if (!isRect(rect)) log(`my-office: ${file}: "${name}" precisa ser [x, y, largura, altura]; ignorado`);
    else items[name] = rect;
  }
  return items;
}

function readCustom(dir, defaults, adds, log) {
  const file = join(dir, 'custom.json');
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') log(`my-office: não deu para ler ${file}: ${err.message}`);
    return null;
  }
  const sheet = join(dir, typeof data?.sheet === 'string' ? data.sheet.replace(/[\\/]/g, '') : 'custom.png');
  if (!existsSync(sheet)) {
    log(`my-office: ${file}: folha ${sheet} não encontrada; folha custom ignorada`);
    return null;
  }
  const items = customItems(data, defaults, { adds, log, file });
  const source = data?.emotes;
  const validEmotes = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const emotes = Object.fromEntries(Object.entries(validEmotes).filter(([name, sprite]) => /^[a-z0-9][a-z0-9_-]{0,39}$/.test(name) && typeof sprite === 'string' && (Object.hasOwn(items, sprite) || Object.hasOwn(defaults, sprite))));
  return Object.keys(items).length || Object.keys(emotes).length ? { items, sheet, emotes } : null;
}

// { office?: { items, sheet }, ui?: { items, sheet } }, só com as folhas custom encontradas.
export function loadSheets({ configDir = CONFIG_DIR, log = console.error } = {}) {
  const found = {};
  for (const kind of KINDS) {
    const custom = readCustom(join(configDir, kind), DEFAULT_MAPS[kind], ADDS.has(kind), log);
    if (custom) found[kind] = custom;
  }
  return found;
}

export function emoteCatalog(sheets) {
  const defaults = JSON.parse(readFileSync(new URL('../assets/ui/default.json', import.meta.url), 'utf8'));
  return { ...defaults.emotes, ...sheets.ui?.emotes };
}

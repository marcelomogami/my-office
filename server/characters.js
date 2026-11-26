import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { castOf, mergeCatalogs } from '../src/characters.js';

// Folhas e catálogos de personagens: o padrão, no repositório, e o custom, na
// pasta de configuração local (MY_OFFICE_CONFIG_DIR ou ~/.config/my-office),
// que nunca vai para o repositório. O custom só entra se tiver o catálogo e a
// folha.

const DEFAULT_DIR = fileURLToPath(new URL('../assets/characters/', import.meta.url));
export const CONFIG_DIR = process.env.MY_OFFICE_CONFIG_DIR || join(homedir(), '.config', 'my-office');

function readCatalog(dir, name) {
  const file = join(dir, `${name}.json`);
  try {
    const catalog = JSON.parse(readFileSync(file, 'utf8'));
    const sheet = join(dir, typeof catalog.sheet === 'string' ? catalog.sheet.replace(/[\\/]/g, '') : `${name}.png`);
    return existsSync(sheet) ? { catalog, sheet } : null;
  } catch {
    return null;
  }
}

// { characters, sheets: { default: caminho, custom?: caminho } }
export function loadCharacters({ configDir = CONFIG_DIR } = {}) {
  const found = {
    default: readCatalog(DEFAULT_DIR, 'default'),
    custom: readCatalog(join(configDir, 'characters'), 'custom'),
  };
  const sheets = {};
  const catalogs = {};
  for (const [name, entry] of Object.entries(found)) {
    if (!entry) continue;
    sheets[name] = entry.sheet;
    catalogs[name] = entry.catalog;
  }
  return { characters: mergeCatalogs(catalogs), sheets };
}

// Personagens do sorteio só com o catálogo padrão (sem custom).
export const DEFAULT_CAST = castOf(loadCharacters({ configDir: '/nonexistent' }).characters);

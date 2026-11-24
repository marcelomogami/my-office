import { homedir } from 'node:os';
import { basename, join, sep } from 'node:path';

// Nome de cada sessão na sala, a partir da pasta de trabalho (`cwd`) que o
// hook informa. As pastas das sessões fixas viram o nome com til; as outras
// usam o nome do projeto (a pasta logo abaixo da família em ~/projects, ou o
// nome da própria pasta fora dali). Uma subpasta conta como o projeto.

export const PROJECTS = join(homedir(), 'projects');

const FIXED_PATHS = {
  'MTI/detran': '~detran',
  'MTI/secretario': '~secretario',
  'MTI/secretario-dev': '~secretario-dev',
  'personal/chat-ferramentas': 'chat-ferramentas',
};

const inside = (dir, root) => dir === root || dir.startsWith(root + sep);

export function projectName(cwd, projects = PROJECTS) {
  const dir = cwd.replace(/\/+$/, '') || '/';
  for (const [path, name] of Object.entries(FIXED_PATHS)) {
    if (inside(dir, join(projects, path))) return name;
  }
  if (inside(dir, projects) && dir !== projects) {
    const parts = dir.slice(projects.length + 1).split(sep);
    return parts[1] ?? parts[0];
  }
  return basename(dir) || dir;
}

// Duas sessões no mesmo projeto: a segunda vira "nome (2)", e assim por diante.
export function uniqueName(name, taken) {
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) if (!taken.has(`${name} (${n})`)) return `${name} (${n})`;
}

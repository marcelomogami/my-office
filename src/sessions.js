// Quem é quem no escritório, e onde cada um senta.
//
// Skin = personagem do catálogo (src/characters.js), pelo id. As sessões
// fixas ganham sempre o mesmo personagem; as demais ganham um personagem livre
// sorteado. O lugar (baia) é escolhido à parte: a primeira baia livre na ordem
// de preferência da cena, e o personagem vai junto.

// Sessões fixas: personagem e, se tiver, baia própria. Mude aqui para trocar
// quem é quem (a #5 leva isso para um arquivo de configuração). As baias fixas
// ficam na frente da mesa de chefe. Personagem que não existe no catálogo é
// ignorado e a sessão entra no sorteio.
export const FIXED = {
  '~detran': { skin: 'custom2', seat: 'I' }, // à direita de quem olha
  '~secretario': { skin: 'custom1', seat: 'F' }, // à esquerda de quem olha
  '~secretario-dev': { skin: 'char5' },
  'chat-ferramentas': { skin: 'char1' },
};

// Sessões que não são fixas ganham uma skin livre sorteada. As skins das
// sessões fixas só entram no sorteio se as outras já estiverem todas ocupadas
// (emprestadas enquanto a sessão fixa não está aberta).
const reserved = new Set(Object.values(FIXED).map((f) => f.skin));
const reservedSeats = new Set(Object.values(FIXED).map((f) => f.seat).filter(Boolean));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Distribui skins (ids de `cast`, os personagens do sorteio) para a lista de
// sessões abertas. `remembered` (nome -> skin) é a skin que cada sessão já
// teve: ela volta com a mesma sempre que estiver livre. Sessões que não
// couberem ficam sem skin.
export function assignSkins(names, remembered, cast) {
  const known = new Set(cast);
  const result = new Map();
  const taken = new Set();
  const give = (name, skin) => {
    result.set(name, skin);
    taken.add(skin);
  };
  for (const name of names) if (known.has(FIXED[name]?.skin)) give(name, FIXED[name].skin);
  for (const name of names) {
    const skin = remembered.get(name);
    if (!result.has(name) && known.has(skin) && !taken.has(skin)) give(name, skin);
  }
  for (const name of names) {
    if (result.has(name)) continue;
    const free = cast.filter((s) => !taken.has(s));
    const preferred = free.filter((s) => !reserved.has(s));
    const skin = pick(preferred.length ? preferred : free);
    if (skin) give(name, skin);
  }
  return result;
}

// Memória de qual skin e qual lugar cada sessão ganhou, para não mudar a cada
// recarregamento. Na demonstração fica no navegador (localStorage; se não der
// para gravar, o sorteio só não é lembrado); com o backend, num arquivo.
export function loadRemembered(KEY) {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(KEY) ?? '{}')));
  } catch {
    return new Map();
  }
}
export function saveRemembered(KEY, map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(map)));
  } catch {
    // sem armazenamento disponível: segue sem lembrar
  }
}

// Distribui lugares: sessão fixa com baia própria vai direto para ela; as
// outras voltam para o lugar que já tinham, se estiver livre, senão pegam o
// primeiro livre na ordem de preferência. As baias fixas só são emprestadas
// quando não há outra livre (e são devolvidas quando a sessão fixa abre).
export function assignSeats(names, order, remembered = new Map()) {
  const result = new Map();
  const taken = new Set();
  const give = (name, seat) => {
    result.set(name, seat);
    taken.add(seat);
  };
  for (const name of names) {
    const seat = FIXED[name]?.seat;
    if (seat && order.includes(seat)) give(name, seat);
  }
  for (const name of names) {
    const seat = remembered.get(name);
    if (!result.has(name) && seat && order.includes(seat) && !taken.has(seat) && !reservedSeats.has(seat)) give(name, seat);
  }
  for (const name of names) {
    if (result.has(name)) continue;
    const seat = order.find((s) => !taken.has(s) && !reservedSeats.has(s)) ?? order.find((s) => !taken.has(s));
    if (seat) give(name, seat);
  }
  return result;
}

// Distribui skins e lugares para as sessões abertas, nesta ordem de
// preferência: o que a sessão já tem agora (`current`), o que ela teve antes
// (`memory`) e o sorteio entre os personagens de `cast`. Atualiza `memory`
// (skins só das sessões que não são fixas) e diz se ela mudou, para quem chama
// gravar.
export function layout(names, seatOrder, memory, current = { skins: new Map(), seats: new Map() }, cast = []) {
  const skins = assignSkins(names, new Map([...memory.skins, ...current.skins]), cast);
  const seated = names.filter((n) => skins.has(n));
  const seats = assignSeats(seated, seatOrder, new Map([...memory.seats, ...current.seats]));
  let changed = false;
  const keep = (map, name, value) => {
    if (map.get(name) === value) return;
    map.set(name, value);
    changed = true;
  };
  for (const [name, skin] of skins) if (!FIXED[name]) keep(memory.skins, name, skin);
  for (const [name, seat] of seats) keep(memory.seats, name, seat);
  return { skins, seats, changed };
}

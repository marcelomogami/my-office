// Quem é quem no escritório, e onde cada um senta.
//
// Skin = personagem do catálogo (src/characters.js), pelo id. As sessões
// fixas ganham sempre o mesmo personagem; as demais ganham um personagem livre
// sorteado. O lugar (baia) é escolhido à parte: a primeira baia livre na ordem
// de preferência da cena, e o personagem vai junto.

// Sessões fixas vêm da configuração local (server/config.js), no formato
// { nome: { skin, seat } }, com skin e seat opcionais. Quem não está nela
// entra no sorteio.

// Sessões que não são fixas ganham um personagem sorteado entre os que não
// são de sessões fixas, nem quando a sessão fixa está fechada. Só se todos
// forem fixos o sorteio usa o elenco inteiro.
const reservedSkins = (fixed) => new Set(Object.values(fixed).map((f) => f.skin).filter(Boolean));
const reservedSeats = (fixed) => new Set(Object.values(fixed).map((f) => f.seat).filter(Boolean));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Personagens que podem ser sorteados (ou lembrados) por sessões não fixas.
export function drawable(cast, fixed = {}) {
  const reserved = reservedSkins(fixed);
  const free = cast.filter((s) => !reserved.has(s));
  return free.length ? free : cast;
}

// Distribui skins (ids de `cast`, os personagens do catálogo fora o Boss) para
// a lista de sessões abertas. `remembered` (nome -> skin) é a skin que cada
// sessão já teve: ela volta com a mesma sempre que estiver livre. Enquanto
// houver personagem do sorteio sem dono, ninguém repete; depois, repete o
// menos usado.
export function assignSkins(names, remembered, cast, fixed = {}) {
  const known = new Set(cast);
  const free = new Set(drawable(cast, fixed));
  const uses = (skin) => [...result.values()].filter((s) => s === skin).length;
  const result = new Map();
  const taken = new Set();
  const give = (name, skin) => {
    result.set(name, skin);
    taken.add(skin);
  };
  for (const name of names) if (known.has(fixed[name]?.skin)) give(name, fixed[name].skin);
  for (const name of names) {
    const skin = remembered.get(name);
    if (!result.has(name) && free.has(skin) && !taken.has(skin)) give(name, skin);
  }
  for (const name of names) {
    if (result.has(name)) continue;
    const least = Math.min(...[...free].map(uses));
    const skin = pick([...free].filter((s) => uses(s) === least));
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
export function assignSeats(names, order, remembered = new Map(), fixed = {}) {
  const reserved = reservedSeats(fixed);
  const result = new Map();
  const taken = new Set();
  const give = (name, seat) => {
    result.set(name, seat);
    taken.add(seat);
  };
  for (const name of names) {
    const seat = fixed[name]?.seat;
    if (seat && order.includes(seat)) give(name, seat);
  }
  for (const name of names) {
    const seat = remembered.get(name);
    if (!result.has(name) && seat && order.includes(seat) && !taken.has(seat) && !reserved.has(seat)) give(name, seat);
  }
  for (const name of names) {
    if (result.has(name)) continue;
    const seat = order.find((s) => !taken.has(s) && !reserved.has(s)) ?? order.find((s) => !taken.has(s));
    if (seat) give(name, seat);
  }
  return result;
}

// Distribui skins e lugares para as sessões abertas, nesta ordem de
// preferência: o que a sessão já tem agora (`current`), o que ela teve antes
// (`memory`) e o sorteio entre os personagens de `cast`. `fixed` são as
// sessões fixas da configuração. Atualiza `memory` (skins só das sessões que
// não têm personagem fixo) e diz se ela mudou, para quem chama gravar.
export function layout(names, seatOrder, memory, current = { skins: new Map(), seats: new Map() }, cast = [], fixed = {}) {
  const skins = assignSkins(names, new Map([...memory.skins, ...current.skins]), cast, fixed);
  const seated = names.filter((n) => skins.has(n));
  const seats = assignSeats(seated, seatOrder, new Map([...memory.seats, ...current.seats]), fixed);
  let changed = false;
  const keep = (map, name, value) => {
    if (map.get(name) === value) return;
    map.set(name, value);
    changed = true;
  };
  for (const [name, skin] of skins) if (!fixed[name]?.skin) keep(memory.skins, name, skin);
  for (const [name, seat] of seats) keep(memory.seats, name, seat);
  return { skins, seats, changed };
}

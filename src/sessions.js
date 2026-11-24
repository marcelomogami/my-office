// Quem é quem no escritório, e onde cada um senta.
//
// Skin = personagem da folha (`sN` sentado, `pN` em pé). As sessões que
// existem sempre ganham sempre a mesma skin; as demais ganham uma skin livre
// sorteada. O lugar (baia) é escolhido à parte: a primeira baia livre na ordem
// de preferência da cena, e a skin vai junto.

// `decor`: personagem que é só decoração da sala e não representa sessão.
// `fit`: deslocamento [x, y] do sprite sentado em relação à cadeira, para o
// contorno do tronco ficar logo depois de 1 pixel colorido do encosto e o
// quadril na linha 15 da cadeira. Em cadeira espelhada, o x é espelhado.
export const SKINS = {
  s0: { label: 'guri de cabelo preto', fit: [1, -3] },
  s1: { label: 'guri do topete', fit: [1, -4] },
  s2: { label: 'o de óculos', fit: [2, -1] },
  s3: { label: 'menina ruiva', fit: [-1, -4] },
  s4: { label: 'menina de cabelo preto', fit: [-1, -4] },
  s5: { label: 'Boss', fit: [2, -1], decor: true }, // na mesa de chefe, fora do sorteio
  s6: { label: 'custom1', fit: [2, -1] },
  s7: { label: 'custom2', fit: [2, -1] },
};

// Sessões fixas: skin e, se tiver, baia própria. Mude aqui para trocar quem é
// quem. As baias fixas ficam na frente da mesa de chefe.
export const FIXED = {
  '~detran': { skin: 's7', seat: 'I' }, // custom2, à direita de quem olha
  '~secretario': { skin: 's6', seat: 'F' }, // custom1, à esquerda de quem olha
  '~secretario-dev': { skin: 's3' },
  'chat-ferramentas': { skin: 's0' }, // sessão do Codex (ainda não ligada)
};

// Sessões que não são fixas ganham uma skin livre sorteada. As skins das
// sessões fixas só entram no sorteio se as outras já estiverem todas ocupadas
// (emprestadas enquanto a sessão fixa não está aberta).
const reserved = new Set(Object.values(FIXED).map((f) => f.skin));
const reservedSeats = new Set(Object.values(FIXED).map((f) => f.seat).filter(Boolean));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Distribui skins para a lista de sessões abertas. `remembered` (nome -> skin)
// é a skin que cada sessão já teve: ela volta com a mesma sempre que estiver
// livre. Sessões que não couberem ficam sem skin.
export function assignSkins(names, remembered = new Map()) {
  const result = new Map();
  const taken = new Set();
  const give = (name, skin) => {
    result.set(name, skin);
    taken.add(skin);
  };
  for (const name of names) if (FIXED[name]) give(name, FIXED[name].skin);
  for (const name of names) {
    const skin = remembered.get(name);
    if (!result.has(name) && skin && !taken.has(skin)) give(name, skin);
  }
  for (const name of names) {
    if (result.has(name)) continue;
    const free = Object.keys(SKINS).filter((s) => !taken.has(s) && !SKINS[s].decor);
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
// (`memory`) e o sorteio. Atualiza `memory` (skins só das sessões que não são
// fixas) e diz se ela mudou, para quem chama gravar.
export function layout(names, seatOrder, memory, current = { skins: new Map(), seats: new Map() }) {
  const skins = assignSkins(names, new Map([...memory.skins, ...current.skins]));
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

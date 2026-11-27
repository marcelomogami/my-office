import { panelDetails, panelFace } from './panel.js';
import { Application, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import './style.css';
import officeUrl from '../assets/office/default.png';
import officeMap from '../assets/office/default.json';
import uiUrl from '../assets/ui/default.png';
import uiMap from '../assets/ui/default.json';
import scene from './scene.json';
import { createBubbles } from './bubbles.js';
import { STATUS } from './status.js';
import { layout, loadRemembered, saveRemembered } from './sessions.js';
import { BOSS, castOf, seatedAt } from './characters.js';

// Cena baseada no exemplo do 2dPig, sem o céu. A disposição está em
// scene.json (dá para conferir com tools/compose_scene.py); este
// arquivo só desenha. Coordenadas em pixels lógicos 1x; cada pixel lógico vira
// U x U na tela. Móveis vêm de assets/office, balões e ícones de assets/ui e
// personagens do catálogo servido pelo backend (padrão + custom): folhas 1x,
// mapeadas por célula.
const U = 5;
const { crop } = scene;

const app = new Application();
await app.init({ width: crop.width * U, height: crop.height * U, background: '#41a6f6', antialias: false, preference: 'webgl' });
// As animações são lentas (pontinhos, pulinho): 10 quadros por segundo bastam
// e poupam a máquina com a aba aberta.
app.ticker.maxFPS = 10;
document.querySelector('#office').appendChild(app.canvas);

// Folhas 1x ampliadas U vezes ao carregar: cada pixel lógico vira U x U.
async function loadSheet(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width * U;
  canvas.height = img.height * U;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const source = Texture.from(canvas).source;
  source.scaleMode = 'nearest';
  return source;
}
const SHEETS = [
  { map: officeMap.items, source: await loadSheet(officeUrl) },
  { map: uiMap.items, source: await loadSheet(uiUrl) },
];

// Personagens: cada pose vira um sprite `id:seated` / `id:standing`.
const { characters } = await (await fetch('/api/characters')).json();
const CAST = castOf(characters);
const characterById = new Map(characters.map((c) => [c.id, c]));
const characterSources = new Map();
for (const name of new Set(characters.map((c) => c.sheet))) {
  const source = await loadSheet(`/api/characters/${name}.png`);
  characterSources.set(name, source);
  const map = {};
  for (const c of characters.filter((x) => x.sheet === name)) {
    map[`${c.id}:seated`] = c.seated;
    map[`${c.id}:standing`] = c.standing;
  }
  SHEETS.push({ map, source });
}

const world = new Container();
world.scale.set(U);
world.position.set(-crop.x * U, -crop.y * U);
app.stage.addChild(world);

// ---------------------------------------------------------------- objetos
const cache = new Map();
const texture = (name) => {
  if (cache.has(name)) return cache.get(name);
  const { map, source } = SHEETS.find((sh) => name in sh.map) ?? {};
  if (!map) throw new Error(`sprite sem mapa: ${name}`);
  const [x, y, w, h] = map[name];
  const tex = new Texture({ source, frame: new Rectangle(x * U, y * U, w * U, h * U) });
  cache.set(name, tex);
  return tex;
};

// ---------------------------------------------------------------- fundo
// Parede e piso repetem os sprites `wall` e `floor` da folha. A parede sobe
// a partir do piso; o piso desce de 16 em 16 (o sprite tem três faixas e o
// desenho se repete a cada duas, então a terceira cobre a primeira da
// próxima peça). `floorX` desloca os tijolos na horizontal.
{
  const { floorY, floorX } = scene.background;
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;
  const tile = (name, x, y) => {
    const s = new Sprite(texture(name));
    s.scale.set(1 / U);
    s.position.set(x, y);
    world.addChild(s);
    return s;
  };
  const [wallW, wallH] = [texture('wall').width / U, texture('wall').height / U];
  for (let y = floorY - wallH; y + wallH > crop.y; y -= wallH)
    for (let x = crop.x; x < right; x += wallW) tile('wall', x, y);
  const floorW = texture('floor').width / U;
  for (let y = floorY; y < bottom; y += 16)
    for (let x = floorX; x < right; x += floorW) tile('floor', x, y);
}

// Lugares (baias com cadeira). Na lista da cena, cada "seat:X" marca em que
// ponto da ordem de desenho entra quem senta no lugar X: depois da cadeira e
// da mesa, antes do computador.
// A copa fica numa camada logo antes das divisórias: quem está lá aparece na
// frente da cafeteira e do sofá, mas atrás das baias.
// Gerente: Boss na mesa de chefe, só decoração. Aparece no quadro lateral
// acima das sessões e no tooltip.
const MANAGER = { skin: BOSS, name: 'Boss', status: 'stress', bubbleX: 191, bubbleDY: 7 };
let managerSprite = null;
const SEAT_ORDER = scene.seatOrder; // a fileira de cima está fora de uso por enquanto
const slots = new Map(); // lugar -> Container
const restSlots = new Map(); // lugar de descanso sentado -> Container
const cups = new Map(); // lugar -> xícara
const copa = new Container();
const makeSprite = (name, x, y, flip) => {
  const s = new Sprite(texture(name));
  s.scale.set(flip ? -1 / U : 1 / U, 1 / U);
  s.position.set(flip ? x + s.texture.width / U : x, y);
  return s;
};
for (const [name, x, y, flip] of scene.items) {
  if (name === 'partition' && !copa.parent) world.addChild(copa);
  if (name.startsWith('seat:') || name.startsWith('rest:')) {
    const slot = new Container();
    world.addChild(slot);
    (name.startsWith('seat:') ? slots : restSlots).set(name.slice(5), slot);
    continue;
  }
  if (name.startsWith('cup:')) {
    // xícara do lugar: só aparece quando o lugar está ocupado
    const seatId = name.slice(4);
    const cup = makeSprite(...scene.seats[seatId].cup);
    cup.visible = false;
    world.addChild(cup);
    cups.set(seatId, cup);
    continue;
  }
  const sp = makeSprite(name, x, y, flip);
  if (name === `${MANAGER.skin}:standing`) managerSprite = sp;
  world.addChild(sp);
}

// Cada skin tem o sprite sentado (entra no lugar da sessão) e o em pé (copa).
const people = new Map();
for (const id of CAST) {
  const seated = new Sprite(texture(`${id}:seated`));
  const standing = new Sprite(texture(`${id}:standing`));
  for (const sp of [seated, standing]) {
    sp.scale.set(1 / U);
    sp.visible = false;
  }
  copa.addChild(standing);
  people.set(id, { seated, standing, anchor: null, idle: null });
}

// Põe a skin sentada numa cadeira ({ chair, flip }), pela regra única de
// encaixe das células, dentro do contêiner que a coloca na ordem de desenho
// certa.
function sitOn(person, id, { chair, flip }, slot) {
  const sp = person.seated;
  const w = sp.texture.width / U;
  const { x, y } = seatedAt(chair[0], chair[1], flip, w);
  sp.scale.set(flip ? -1 / U : 1 / U, 1 / U);
  sp.position.set(flip ? x + w : x, y);
  slot.addChild(sp);
  return { x, y, w };
}

function seatIn(person, id, seatId) {
  person.anchor = { ...sitOn(person, id, scene.seats[seatId], slots.get(seatId)), bx: scene.seats[seatId].bubbleX };
}

// Ociosos: cada um ganha um lugar de descanso livre sorteado (scene.rest),
// em pé na copa ou sentado no sofá e na mesa de reunião, e fica nele até
// sair do descanso. Com tudo cheio, quem mais ficar ocioso continua sentado
// na própria baia, sem balão.
const REST = Object.entries(scene.rest);
const idleTaken = new Set();

// `only`: lugar escolhido (para a demonstração de descanso); sem ele, sorteia.
function goIdle(person, id, only) {
  if (person.idle) return true;
  const free = REST.filter(([spot]) => !idleTaken.has(spot) && (!only || spot === only));
  if (!free.length) return false;
  const [spot, place] = free[Math.floor(Math.random() * free.length)];
  if (place.stand) {
    const { standing } = person;
    const w = standing.texture.width / U;
    const h = standing.texture.height / U;
    const left = Math.round(place.stand[0] - w / 2);
    standing.scale.x = place.flip ? -1 / U : 1 / U;
    standing.position.set(place.flip ? left + w : left, place.stand[1] - h);
    standing.visible = true;
    person.seated.visible = false;
  } else {
    sitOn(person, id, place, restSlots.get(spot));
    person.seated.visible = true;
  }
  person.idle = spot;
  idleTaken.add(spot);
  return true;
}

function leaveIdle(person) {
  if (!person.idle) return;
  idleTaken.delete(person.idle);
  person.idle = null;
  person.standing.visible = false;
}

// ---------------------------------------------------------------- balões
// Numa camada própria por cima de toda a cena.
const bubbleLayer = new Container();
world.addChild(bubbleLayer);
const bubbles = createBubbles({ world: bubbleLayer, texture, U, ticker: app.ticker });
if (managerSprite) {
  const { x, y } = managerSprite;
  // balão ao lado da cabeça, um pouco mais baixo que o das baias
  bubbles.set('manager', { x, y: y + MANAGER.bubbleDY, w: managerSprite.texture.width / U, bx: MANAGER.bubbleX }, MANAGER.status);
}

// Mostra a skin `id` no lugar `seatId` com o status pedido; sem lugar, some.
// A baia continua reservada enquanto a sessão está ociosa.
function showSkin(id, seatId, status) {
  const person = people.get(id);
  bubbles.clear(id);
  if (!seatId) {
    leaveIdle(person);
    person.seated.visible = false;
    return;
  }
  if (status === 'idle' && goIdle(person, id)) return;
  leaveIdle(person);
  seatIn(person, id, seatId);
  person.seated.visible = true;
  if (status !== 'idle') bubbles.set(id, person.anchor, status);
}

// ---------------------------------------------------------------- sessões
// Lista das sessões abertas, na ordem em que apareceram. Do backend, cada uma
// já vem com skin, lugar e rosto do quadro: { name, status, skin, seat, face }.
// Na demonstração (?demo na URL), a própria página distribui e lembra no
// navegador, com as sessões fixas da configuração local.
const DEMO = new URLSearchParams(location.search).has('demo');
const DEMO_FIXED = DEMO ? (await (await fetch('/api/fixed')).json()).fixed : {};
let sessions = [];
let skinOf = new Map(); // nome da sessão -> skin
let seatOf = new Map(); // nome da sessão -> lugar
const SKINS_KEY = 'my-office:skins';
const SEATS_KEY = 'my-office:seats';
const demoMemory = DEMO ? { skins: loadRemembered(SKINS_KEY), seats: loadRemembered(SEATS_KEY) } : null;

function arrange() {
  if (!DEMO) {
    skinOf = new Map(sessions.filter((s) => s.skin).map((s) => [s.name, s.skin]));
    seatOf = new Map(sessions.filter((s) => s.skin && s.seat).map((s) => [s.name, s.seat]));
    return;
  }
  const names = sessions.map((s) => s.name);
  const result = layout(names, SEAT_ORDER, demoMemory, { skins: skinOf, seats: seatOf }, CAST, DEMO_FIXED);
  skinOf = result.skins;
  seatOf = result.seats;
  if (result.changed) {
    saveRemembered(SKINS_KEY, demoMemory.skins);
    saveRemembered(SEATS_KEY, demoMemory.seats);
  }
}

function render() {
  arrange();
  const occupied = new Set(seatOf.values());
  for (const [seatId, cup] of cups) cup.visible = occupied.has(seatId);
  const sessionOfSkin = new Map([...skinOf].map(([name, skin]) => [skin, name]));
  for (const id of people.keys()) {
    const name = sessionOfSkin.get(id);
    const seat = name && seatOf.get(name);
    showSkin(id, seat, seat ? sessions.find((s) => s.name === name).status : null);
  }
  renderPanel();
}

function setSessions(list) {
  sessions = list.map(({ name, status, skin, seat, since, face }) => ({ name, status, skin, seat, since, face }));
  render();
}

function update(name, status) {
  const s = sessions.find((x) => x.name === name);
  if (s) s.status = status;
  else sessions.push({ name, status });
  render();
}

function close(name) {
  sessions = sessions.filter((s) => s.name !== name);
  render();
}

// ---------------------------------------------------------------- quadro lateral
// Rosto de cada personagem: o recorte `face` do catálogo, dentro da célula em
// pé, a 3x. A folha carregada é U vezes maior, e cada bloco de U vira 3
// pixels exatos.
const FACE_SCALE = 3;
function face(skin) {
  const c = document.createElement('canvas');
  const { sheet, standing, face: [fx, fy, w, h] } = characterById.get(skin);
  const x = standing[0] + fx;
  const y = standing[1] + fy;
  c.width = w * FACE_SCALE;
  c.height = h * FACE_SCALE;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(characterSources.get(sheet).resource, x * U, y * U, w * U, h * U, 0, 0, c.width, c.height);
  c.className = 'session-face';
  return c;
}

const panel = document.querySelector('#sessions');
const homeFaces = new Map();
function statusText(status) {
  const st = STATUS[status];
  return `${st.emoji} ${st.label}`;
}
function card(skin, title, subtitle) {
  const li = document.createElement('li');
  if (skin) li.append(face(skin));
  else li.append(Object.assign(document.createElement('span'), { className: 'session-face empty', textContent: '?' }));
  const text = document.createElement('div');
  text.append(
    Object.assign(document.createElement('strong'), { textContent: title }),
    Object.assign(document.createElement('small'), { textContent: subtitle }),
  );
  li.append(text);
  return li;
}
document.querySelector('#manager')?.replaceChildren(card(MANAGER.skin, MANAGER.name, statusText(MANAGER.status)));

function renderPanel() {
  panel.replaceChildren(
    ...sessions.map(({ name, status, since, face }) => {
      const seated = seatOf.has(name);
      const homeOffice = !seated && status !== 'away';
      const homeFace = DEMO ? panelFace(name, skinOf.get(name), homeFaces, CAST, DEMO_FIXED) : face;
      const skin = homeOffice ? homeFace : seated && skinOf.get(name);
      const { title, text } = panelDetails(name, status, seated, since);
      return card(skin, title, text);
    }),
  );
}

// ---------------------------------------------------------------- tooltip
// Atualiza o tempo sem reconstruir a cena Pixi.
setInterval(renderPanel, 10000);

// Passando o mouse num personagem (sentado ou na copa), mostra a sessão.
const tooltip = document.querySelector('#tooltip');
function spriteRect(sprite) {
  const w = sprite.texture.width / U;
  const h = sprite.texture.height / U;
  const x = sprite.scale.x < 0 ? sprite.x - w : sprite.x;
  return { x, y: sprite.y, w, h };
}
app.canvas.addEventListener('pointermove', (e) => {
  const k = app.canvas.width / app.canvas.clientWidth / U;
  const lx = e.offsetX * k + crop.x;
  const ly = e.offsetY * k + crop.y;
  let hit = null;
  for (const [name, skin] of skinOf) {
    const p = people.get(skin);
    const sprite = p.standing.visible ? p.standing : p.seated.visible ? p.seated : null;
    if (!sprite) continue;
    const r = spriteRect(sprite);
    if (lx >= r.x && lx < r.x + r.w && ly >= r.y && ly < r.y + r.h) hit = name;
  }
  let title = hit;
  let subtitle = hit && statusText(sessions.find((x) => x.name === hit).status);
  if (!hit && managerSprite) {
    const r = spriteRect(managerSprite);
    if (lx >= r.x && lx < r.x + r.w && ly >= r.y && ly < r.y + r.h) [title, subtitle] = [MANAGER.name, statusText(MANAGER.status)];
  }
  if (!title) {
    tooltip.hidden = true;
    return;
  }
  tooltip.replaceChildren(
    Object.assign(document.createElement('strong'), { textContent: title }),
    Object.assign(document.createElement('span'), { textContent: subtitle }),
  );
  tooltip.style.left = `${e.offsetX + 14}px`;
  tooltip.style.top = `${e.offsetY + 14}px`;
  tooltip.hidden = false;
});
app.canvas.addEventListener('pointerleave', () => (tooltip.hidden = true));

// ---------------------------------------------------------------- sessões reais
// O backend manda a lista completa a cada mudança; o navegador reconecta
// sozinho se o backend cair ou reiniciar.
if (!DEMO) {
  const source = new EventSource('/api/stream');
  source.onmessage = (e) => setSessions(JSON.parse(e.data));
}

// ---------------------------------------------------------------- demonstração
// Com ?demo na URL, as sessões fixas da configuração local e outras de
// exemplo, até cinco; com ?demo&ciclo, os status giram a cada 2,5 s.
// Com ?demo&descanso, um personagem em cada lugar de descanso, na ordem dos
// números, para conferir as posições. ?demo&descanso=char3,char1,... escolhe
// quem fica em cada lugar.
if (DEMO && new URLSearchParams(location.search).has('descanso')) {
  const chosen = new URLSearchParams(location.search).get('descanso').split(',').filter((id) => people.has(id));
  const order = [...new Set([...chosen, ...CAST])];
  REST.forEach(([spot], i) => {
    const id = order[i];
    if (id) goIdle(people.get(id), id, spot);
  });
} else if (DEMO) {
  const demoNames = [...new Set([...Object.keys(DEMO_FIXED), 'my-office', 'website', 'api', 'notes', 'scripts'])].slice(0, 5);
  const demoStatus = ['working', 'error', 'idle', 'done', 'quota'];
  setSessions(demoNames.map((name, i) => ({ name, status: demoStatus[i] })));
  if (new URLSearchParams(location.search).has('ciclo')) {
    const names = Object.keys(STATUS).filter((st) => st !== 'stress' && st !== 'away');
    let k = 0;
    setInterval(() => {
      k++;
      sessions.forEach((s, i) => (s.status = names[(k + i) % names.length]));
      render();
    }, 2500);
  }
}

// No console do navegador, para testar na demonstração:
//   office.update('paracetacaro', 'working')  abre ou atualiza uma sessão
//   office.close('my-office')                 fecha uma sessão
window.office = { setSessions, update, close, statuses: Object.keys(STATUS) };

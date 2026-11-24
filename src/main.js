import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import './style.css';
import sheetUrl from '../assets/pixel-office-2dpig/PixelOfficeAssetsNew2.png';
import frames from './frames.json';
import background from './background.json';
import scene from './scene.json';
import { createBubbles } from './bubbles.js';
import { STATUS } from './status.js';
import { layout, loadRemembered, saveRemembered, SKINS } from './sessions.js';

// Cena baseada no exemplo do 2dPig, sem o céu. A disposição está em
// scene.json (dá para conferir com tools/compose_scene.py); este
// arquivo só desenha. Coordenadas em pixels lógicos 1x; as texturas são as
// versões "Big" (5x), então cada pixel lógico vira U x U na tela.
const U = 5;
const { crop } = scene;

const app = new Application();
await app.init({ width: crop.width * U, height: crop.height * U, background: '#41a6f6', antialias: false, preference: 'webgl' });
// As animações são lentas (pontinhos, pulinho): 10 quadros por segundo bastam
// e poupam a máquina com a aba aberta.
app.ticker.maxFPS = 10;
document.querySelector('#office').appendChild(app.canvas);

const sheet = await Assets.load(sheetUrl);
sheet.source.scaleMode = 'nearest';

const world = new Container();
world.scale.set(U);
world.position.set(-crop.x * U, -crop.y * U);
app.stage.addChild(world);

// ---------------------------------------------------------------- fundo
const hex = (s) => Number.parseInt(s.slice(1), 16);
const g = new Graphics();
world.addChild(g);
const W = crop.x + crop.width;
const H = crop.y + crop.height;

for (const band of background.wall) g.rect(0, band.y, W, band.h ?? 1).fill(hex(band.color));

// Piso em faixas de tijolos; a emenda alterna de posição a cada faixa.
const f = background.floor;
for (let y0 = f.y, k = 0; y0 < H; y0 += f.band, k++) {
  const h = Math.min(f.band, H - y0);
  g.rect(0, y0, W, h).fill(hex(f.base));
  g.rect(0, y0, W, 1).fill(hex(f.light));
  if (h === f.band) g.rect(0, y0 + f.band - 1, W, 1).fill(hex(f.dark));
  for (let x = f.seams[k % f.seams.length]; x < W; x += f.brick) {
    g.rect(x, y0, 1, Math.min(f.band - 1, h)).fill(hex(f.dark));
    if (h > 1) g.rect(x + 1, y0 + 1, 1, Math.min(f.band - 2, h - 1)).fill(hex(f.light));
  }
}

// ---------------------------------------------------------------- objetos
const cache = new Map();
const texture = (name) => {
  if (cache.has(name)) return cache.get(name);
  const [x, y, w, h] = frames[name];
  const tex = new Texture({ source: sheet.source, frame: new Rectangle(x * U, y * U, w * U, h * U) });
  cache.set(name, tex);
  return tex;
};

// Lugares (baias com cadeira). Na lista da cena, cada "seat:X" marca em que
// ponto da ordem de desenho entra quem senta no lugar X: depois da cadeira e
// da mesa, antes do teclado e do monitor.
// A copa fica numa camada logo antes das divisórias: quem está lá aparece na
// frente da cafeteira e do sofá, mas atrás das baias.
// Gerente: Boss na mesa de chefe, só decoração. Aparece no quadro lateral
// acima das sessões e no tooltip.
const MANAGER = { skin: 's5', name: 'boss', status: 'stress', bubbleX: 191, bubbleDY: 4 };
let managerSprite = null;
const SEAT_ORDER = scene.seatOrder; // a fileira de cima está fora de uso por enquanto
const slots = new Map(); // lugar -> Container
const meetSlots = new Map(); // cadeira da mesa de reunião -> Container
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
  if (name.startsWith('seat:') || name.startsWith('meet:')) {
    const slot = new Container();
    world.addChild(slot);
    (name.startsWith('seat:') ? slots : meetSlots).set(name.slice(5), slot);
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
  if (name === `p${MANAGER.skin.slice(1)}`) managerSprite = sp;
  world.addChild(sp);
}

// Cada skin tem o sprite sentado (entra no lugar da sessão) e o em pé (copa).
const people = new Map();
for (const id of Object.keys(SKINS)) {
  const seated = new Sprite(texture(id));
  const standing = new Sprite(texture(`p${id.slice(1)}`));
  for (const sp of [seated, standing]) {
    sp.scale.set(1 / U);
    sp.visible = false;
  }
  copa.addChild(standing);
  people.set(id, { seated, standing, anchor: null, idle: null });
}

// Põe a skin sentada numa cadeira ({ chair, flip }), encaixada pela regra
// `fit`, dentro do contêiner que a coloca na ordem de desenho certa.
function sitOn(person, id, { chair, flip }, slot) {
  const [dx, dy] = SKINS[id].fit;
  const w = frames[id][2];
  const x = flip ? chair[0] + 11 - dx - w : chair[0] + dx;
  const y = chair[1] + dy;
  const sp = person.seated;
  sp.scale.set(flip ? -1 / U : 1 / U, 1 / U);
  sp.position.set(flip ? x + w : x, y);
  slot.addChild(sp);
  return { x, y, w };
}

function seatIn(person, id, seatId) {
  person.anchor = { ...sitOn(person, id, scene.seats[seatId], slots.get(seatId)), bx: scene.seats[seatId].bubbleX };
}

// Ociosos: os 3 primeiros ficam em pé na copa, ao lado da cafeteira (centro
// de cada lugar e se o personagem fica espelhado; a linha do pé é comum). O
// 4º e o 5º sentam na mesa de reunião do outro lado. Com tudo cheio, quem
// mais ficar ocioso continua sentado na própria baia, sem balão.
const COPA_FEET = 126;
const COPA_SPOTS = [{ x: 18 }, { x: 38 }, { x: 64, flip: true }];
const MEETING = Object.keys(scene.meeting);
const idleTaken = new Set();

function goIdle(person, id) {
  if (person.idle) return true;
  const copaSpot = COPA_SPOTS.find((c) => !idleTaken.has(c));
  if (copaSpot) {
    const { standing } = person;
    const w = standing.texture.width / U;
    const h = standing.texture.height / U;
    const left = Math.round(copaSpot.x - w / 2);
    standing.scale.x = copaSpot.flip ? -1 / U : 1 / U;
    standing.position.set(copaSpot.flip ? left + w : left, COPA_FEET - h);
    standing.visible = true;
    person.seated.visible = false;
    person.idle = copaSpot;
  } else {
    const chairId = MEETING.find((c) => !idleTaken.has(c));
    if (!chairId) return false; // copa e mesa cheias
    sitOn(person, id, scene.meeting[chairId], meetSlots.get(chairId));
    person.seated.visible = true;
    person.idle = chairId;
  }
  idleTaken.add(person.idle);
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
  bubbles.set('manager', { x, y: y + MANAGER.bubbleDY, w: frames[`p${MANAGER.skin.slice(1)}`][2], bx: MANAGER.bubbleX }, MANAGER.status);
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
// já vem com skin e lugar: { name, status, skin, seat }. Na demonstração
// (?demo na URL), a própria página distribui e lembra no navegador.
const DEMO = new URLSearchParams(location.search).has('demo');
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
  const result = layout(names, SEAT_ORDER, demoMemory, { skins: skinOf, seats: seatOf });
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
  sessions = list.map(({ name, status, skin, seat }) => ({ name, status, skin, seat }));
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
// Rosto de cada personagem, recortado da folha: as 14 primeiras linhas do
// sprite em pé, a 3x. A folha é 5x, e cada bloco de 5 vira 3 pixels exatos.
const sheetImage = sheet.source.resource;
const FACE_ROWS = 14;
const FACE_SCALE = 3;
function face(skin) {
  const c = document.createElement('canvas');
  const [x, y, w] = frames[`p${skin.slice(1)}`];
  c.width = w * FACE_SCALE;
  c.height = FACE_ROWS * FACE_SCALE;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheetImage, x * U, y * U, w * U, FACE_ROWS * U, 0, 0, c.width, c.height);
  c.className = 'session-face';
  return c;
}

const panel = document.querySelector('#sessions');
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
    ...sessions.map(({ name, status }) => {
      const skin = seatOf.has(name) && skinOf.get(name);
      const text = skin || status === 'away' ? statusText(status) : 'sem lugar na sala';
      return card(skin, name, text);
    }),
  );
}

// ---------------------------------------------------------------- tooltip
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
// Com ?demo na URL, sessões fixas de exemplo; com ?demo&ciclo, os status
// giram a cada 2,5 s.
if (DEMO) {
  setSessions([
    { name: '~detran', status: 'working' },
    { name: '~secretario', status: 'error' },
    { name: '~secretario-dev', status: 'idle' },
    { name: 'my-office', status: 'done' },
    { name: 'chat-ferramentas', status: 'quota' },
  ]);
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

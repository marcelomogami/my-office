import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import sheetUrl from '../../assets/pixel-office-2dpig/PixelOfficeAssetsNew3.png';
import frames from '../../tools/dock/frames.json';
import background from '../background.json';
import { SKINS } from '../sessions.js';

// Prévia independente: as coordenadas do escritório atual não são alteradas.
const UNIT = 2;
const WIDTH = 478;
const HEIGHT = 72;
const app = new Application();
await app.init({ width: WIDTH * UNIT, height: HEIGHT * UNIT, antialias: false, background: '#41a6f6' });
document.querySelector('#preview').appendChild(app.canvas);
const sheet = await Assets.load(sheetUrl);
sheet.source.scaleMode = 'nearest';
const world = new Container();
world.scale.set(UNIT);
app.stage.addChild(world);
const floor = background.floor;
const color = (hex) => Number.parseInt(hex.slice(1), 16);
const graphics = new Graphics();
world.addChild(graphics);
for (let y = 20, row = 0; y < HEIGHT; y += floor.band, row++) {
  const h = Math.min(floor.band, HEIGHT - y);
  graphics.rect(0, y, WIDTH, h).fill(color(floor.base));
  graphics.rect(0, y, WIDTH, 1).fill(color(floor.light));
  if (h === floor.band) graphics.rect(0, y + h - 1, WIDTH, 1).fill(color(floor.dark));
  for (let x = floor.seams[row % floor.seams.length]; x < WIDTH; x += floor.brick) {
    graphics.rect(x, y, 1, Math.min(floor.band - 1, h)).fill(color(floor.dark));
    if (h > 1) graphics.rect(x + 1, y + 1, 1, Math.min(floor.band - 2, h - 1)).fill(color(floor.light));
  }
}
// O tile da folha já contém as duas faixas de parede.
const wallTexture = new Texture({ source: sheet.source, frame: new Rectangle(0, 330, 26, 20) });
for (let x = 0; x < WIDTH; x += 26) {
  const wall = new Sprite(wallTexture);
  wall.position.set(x, 0);
  world.addChild(wall);
}
const textures = new Map();
function sprite(name, x, y, flip = false) {
  if (!textures.has(name)) {
    const [sx, sy, w, h] = frames[name];
    textures.set(name, new Texture({ source: sheet.source, frame: new Rectangle(sx, sy, w, h) }));
  }
  const item = new Sprite(textures.get(name));
  item.scale.set(flip ? -1 : 1, 1);
  item.position.set(flip ? x + frames[name][2] : x, y);
  world.addChild(item);
}
function person(id, chairX, chairY, flip) {
  const [dx, dy] = SKINS[id].fit;
  const x = flip ? chairX + 11 - dx - frames[id][2] : chairX + dx;
  sprite(id, x, chairY + dy, flip);
}
// A dupla reproduz a divisória, mesas, cadeiras e computadores da referência.
function workstation(x, leftSkin, rightSkin, leftChair, rightChair, leftDecoration, rightDecoration) {
  const y = 6;
  sprite('partition', x, y);
  sprite(leftDecoration, x + 3, y + 4);
  sprite(rightDecoration, x + (rightDecoration === 'doc1' ? 67 : 64), y + 4);
  sprite('pole', x + 36, y + 5, true);
  sprite(leftChair, x + 7, y + 7);
  sprite(rightChair, x + 58, y + 7, true);
  sprite('desk', x + 19, y + 11);
  sprite('desk', x + 40, y + 11, true);
  person(leftSkin, x + 7, y + 7, false);
  sprite('computerLeft', x + 21, y + 7);
  sprite('mugCoffee', x + 27, y + 24, true);
  person(rightSkin, x + 58, y + 7, true);
  sprite('computerRight', x + 41, y + 7);
  sprite('mugRed', x + 41, y + 24);
  sprite('partition', x, y + 30);
}
// Relógio na parede, em frente à baia do Boss.
sprite('clock', 417, 1);
sprite('window', 224, -11);
sprite('windowNote', 45, -11);
sprite('door', 314, -11);
sprite('calendar', 100, 1);

// Café e mesa de descanso à esquerda das baias.
sprite('vending', 4, 1);
sprite('cooler', 30, 18);
sprite('tableSmall', 42, 18, true);
sprite('coffee', 54, 17);
sprite('mug', 44, 20);
sprite('p7', 22, 20);
sprite('p6', 63, 18, true);
sprite('chair5', 78, 12);
sprite('chair5', 125, 12, true);
person('s2', 78, 12, false);
person('s3', 125, 12, true);
sprite('tableSmall', 95, 18);
sprite('boxGreen', 97, 16, true);
sprite('mugCoffee', 111, 17);

workstation(151, 's0', 's1', 'officeBlue', 'officeGrey', 'stickies', 'flagBR');
workstation(244, 's2', 's3', 'officeOrange', 'officeGreen', 'posterSun', 'doc1');
workstation(337, 's7', 's6', 'officeYellow', 'officeWhite', 'posterBlue', 'flagUS');

function singleWorkstation(x, skin) {
  const y = 6;
  sprite('partitionSingle', x, y, true);
  sprite('pole', x, y + 5);
  sprite('officeBlue', x + 22, y + 7, true);
  sprite('desk', x + 4, y + 11, true);
  person(skin, x + 22, y + 7, true);
  sprite('computerLeft', x + 5, y + 7, true);
  sprite('mugCoffee', x + 5, y + 24);
  sprite('partitionSingle', x, y + 30, true);
}
singleWorkstation(430, 's5');

// Decoração e área de impressão no corredor em frente às baias.
sprite('plant', 42, 45);
sprite('sofaGreen', 58, 48);
sprite('p1', 66, 39);
sprite('sofaOrange', 155, 42);
sprite('p4', 163, 33);
sprite('plant', 200, 39);
sprite('plant', 343, 39);
sprite('cat', 320, 53);
sprite('binRed', 386, 44);
sprite('binBlue', 259, 44);
sprite('tableLong', 270, 42, true);
sprite('doc1', 285, 44);
sprite('printer', 274, 42);
sprite('dog', 443, 44, true);

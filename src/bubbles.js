import { Container, Sprite } from 'pixi.js';
import { STATUS } from './status.js';

// Balão de pensamento de cada personagem: o balão vazio da folha de interface
// (célula 13x17, com as bolinhas descendo) e, por cima, o ícone do status
// (célula 9x9, com 1 pixel de folga dentro da borda). Ícone novo é só desenhar
// na fileira de ícones de assets/ui e mapear em default.json.

const BW = 13;
const BHEIGHT = 17;
const ICON_OFFSET = [2, 1];

// Canto superior esquerdo do balão. Com `bx` (lugar com corredor definido),
// o balão vai para o corredor, na altura da cabeça, para não cobrir quem está
// na baia de cima; sem ele, fica centralizado acima da cabeça.
function frameOf({ x, y, w, bx }) {
  if (bx !== undefined) return { bx, by: y - 10 };
  const hx = Math.round(x + w / 2);
  return { bx: hx - Math.floor(BW / 2), by: y - BHEIGHT };
}

export function createBubbles({ world, texture, U, ticker }) {
  const bubbles = new Map();

  function make() {
    const box = new Container();
    const balloon = new Sprite(texture('bubbleThought'));
    const icon = new Sprite();
    balloon.scale.set(1 / U);
    icon.scale.set(1 / U);
    box.addChild(balloon, icon);
    world.addChild(box);
    return { box, balloon, icon, status: null };
  }

  // Quadro da animação dos pontinhos e o pulinho dos status com `bounce`.
  function animate(b, phase, hop) {
    const st = b.emote ? { icon: b.emote } : STATUS[b.status];
    const icons = st.icon;
    b.icon.texture = texture(Array.isArray(icons) ? icons[phase % icons.length] : icons);
    const { bx, by } = frameOf(b.anchor);
    const y = by - (st.bounce ? hop : 0);
    // As bolinhas da folha descem inclinadas para a direita. Com o balão à
    // direita do personagem, o balão é espelhado para elas apontarem de volta
    // para a cabeça; o ícone, por cima, nunca vira.
    const { x, w } = b.anchor;
    const flip = bx + BW / 2 > x + w / 2;
    b.balloon.scale.x = flip ? -1 / U : 1 / U;
    b.balloon.position.set(flip ? bx + BW : bx, y);
    b.icon.position.set(bx + ICON_OFFSET[0], y + ICON_OFFSET[1]);
  }

  let t = 0;
  const frame = () => ({ phase: Math.floor(t / 400), hop: Math.floor(t / 500) % 2 });
  ticker.add((tk) => {
    t += tk.deltaMS;
    const { phase, hop } = frame();
    for (const b of bubbles.values()) if (b.status || b.emote) animate(b, phase, hop);
  });

  return {
    // anchor: { x, y, w, bx? } do sprite do personagem, em pixels lógicos
    set(id, anchor, status) {
      if (!STATUS[status]?.icon) throw new Error(`status sem balão: ${status}`);
      let b = bubbles.get(id);
      if (!b) bubbles.set(id, (b = make()));
      Object.assign(b, { anchor, status, emote: null });
      b.box.visible = true;
      const { phase, hop } = frame();
      animate(b, phase, hop);
    },
    setEmote(id, anchor, emote) {
      let b = bubbles.get(id);
      if (!b) bubbles.set(id, (b = make()));
      Object.assign(b, { anchor, status: null, emote });
      b.box.visible = true;
      const { phase, hop } = frame();
      animate(b, phase, hop);
    },
    clear(id) {
      const b = bubbles.get(id);
      if (!b) return;
      b.status = null;
      b.emote = null;
      b.box.visible = false;
    },
  };
}

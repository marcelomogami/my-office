// Catálogo de personagens, comum à página e ao backend.
//
// Cada folha (assets/characters/default.png e, se houver, a custom em
// ~/.config/my-office/characters/) vem com um catálogo JSON: tamanho da
// célula, espaçamento e, por personagem, a célula de cada pose em [coluna,
// linha] e o recorte do rosto dentro da célula em pé. O custom se soma ao
// padrão; com o mesmo id, substitui. O personagem `boss` é o da mesa de chefe
// e fica fora do sorteio das sessões.

// Todas as células têm os pés na última linha e o quadril 5 linhas acima,
// então a mesma regra senta qualquer personagem: o canto da célula sentada
// fica 1 pixel à esquerda e 4 acima do canto da cadeira (de 11 pixels de
// largura). Em cadeira espelhada, o x é espelhado.
export const SEAT_OFFSET = [-1, -4];
export const CHAIR_WIDTH = 11;
export const BOSS = 'boss';

const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const isInt = (v) => Number.isInteger(v) && v >= 0;
const isCell = (v) => Array.isArray(v) && v.length === 2 && v.every(isInt);
const isRect = (v) => Array.isArray(v) && v.length === 4 && v.every(isInt);

// Junta os catálogos ({ default, custom }) numa lista de personagens com os
// retângulos já em pixels da folha: { id, sheet, seated, standing, face }.
// Entradas inválidas são ignoradas.
export function mergeCatalogs(catalogs) {
  const byId = new Map();
  for (const [sheet, catalog] of Object.entries(catalogs)) {
    if (!catalog || !isCell(catalog.cell) || !Array.isArray(catalog.characters)) continue;
    const [cw, ch] = catalog.cell;
    const gap = isInt(catalog.gap) ? catalog.gap : 0;
    const rect = ([col, row]) => [col * (cw + gap), row * (ch + gap), cw, ch];
    for (const c of catalog.characters) {
      if (!ID.test(c?.id) || !isCell(c.seated) || !isCell(c.standing) || !isRect(c.face)) continue;
      byId.set(c.id, { id: c.id, sheet, seated: rect(c.seated), standing: rect(c.standing), face: c.face });
    }
  }
  return [...byId.values()];
}

// Personagens que podem representar sessões (todos menos o Boss).
export const castOf = (characters) => characters.map((c) => c.id).filter((id) => id !== BOSS);

// Canto superior esquerdo da célula sentada numa cadeira em (cx, cy).
export function seatedAt(cx, cy, flip, cellWidth) {
  const [dx, dy] = SEAT_OFFSET;
  return { x: flip ? cx + CHAIR_WIDTH - dx - cellWidth : cx + dx, y: cy + dy };
}

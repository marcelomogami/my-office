"""Folhas de sprites e mapas compartilhados com a página web.

Móveis vêm de assets/office e balões e ícones de assets/ui, mapeados por
célula inteira em default.json. Personagens vêm do catálogo padrão
(assets/characters) somado ao custom da pasta de configuração
(MY_OFFICE_CONFIG_DIR ou ~/.config/my-office/characters), com a mesma regra
de src/characters.js: o custom substitui pelo id e acrescenta ids novos. Cada
pose vira um sprite `id:seated` / `id:standing`.
"""
import json
import os
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def _load(folder):
    data = json.loads((ROOT / 'assets' / folder / 'default.json').read_text())
    sheet = Image.open(ROOT / 'assets' / folder / data['sheet']).convert('RGBA')
    return data['items'], sheet


CONFIG_DIR = Path(os.environ.get('MY_OFFICE_CONFIG_DIR') or Path.home() / '.config' / 'my-office')
BOSS = 'boss'
# Mesma regra de src/characters.js: canto da célula sentada em relação à cadeira.
SEAT_OFFSET, CHAIR_WIDTH = (-1, -4), 11
_ID = re.compile(r'^[a-z0-9][a-z0-9-]{0,31}$')


def _characters():
    """Lista [(id, face)] em ordem e um mapa/folha por catálogo encontrado."""
    found = {}
    sources = []
    for folder, name in ((ROOT / 'assets/characters', 'default'), (CONFIG_DIR / 'characters', 'custom')):
        try:
            catalog = json.loads((folder / f'{name}.json').read_text())
            sheet = Image.open(folder / Path(str(catalog.get('sheet', f'{name}.png'))).name).convert('RGBA')
            cw, ch = catalog['cell']
            gap = catalog.get('gap', 0)
        except (OSError, ValueError, KeyError, TypeError):
            continue
        items = {}
        for c in catalog.get('characters', []):
            try:
                cid = c['id']
                if not _ID.match(cid):
                    continue
                for pose in ('seated', 'standing'):
                    col, row = c[pose]
                    items[f'{cid}:{pose}'] = [col * (cw + gap), row * (ch + gap), cw, ch]
                found[cid] = list(c['face'])
            except (KeyError, TypeError, ValueError):
                continue
        sources.append((items, sheet))
    # o custom vem depois e ganha na busca por nome
    return found, tuple(reversed(sources))


FACES, _CHARACTER_SHEETS = _characters()
CAST = tuple(cid for cid in FACES if cid != BOSS)
SHEETS = (_load('office'), _load('ui'), *_CHARACTER_SHEETS)


def seated_at(cx, cy, flip, width):
    """Canto superior esquerdo da célula sentada numa cadeira em (cx, cy)."""
    dx, dy = SEAT_OFFSET
    return (cx + CHAIR_WIDTH - dx - width if flip else cx + dx), cy + dy


def face(cid):
    """Rosto do personagem: o recorte `face` do catálogo na célula em pé."""
    fx, fy, w, h = FACES[cid]
    return crop(f'{cid}:standing').crop((fx, fy, fx + w, fy + h))


def frame(name):
    """Retângulo [x, y, largura, altura] do sprite na sua folha."""
    for items, _ in SHEETS:
        if name in items:
            return items[name]
    raise KeyError(f'sprite sem mapa: {name}')


def crop(name):
    """Recorte do sprite, em 1x."""
    for items, sheet in SHEETS:
        if name in items:
            x, y, w, h = items[name]
            return sheet.crop((x, y, x + w, y + h))
    raise KeyError(f'sprite sem mapa: {name}')

"""Folhas de sprites e mapas compartilhados com a página web.

Móveis vêm de assets/office e balões e ícones de assets/ui, mapeados por
célula inteira em default.json. Os personagens ainda vêm da folha antiga
(PixelOfficeAssetsNew3.png) com as coordenadas de tools/dock/frames.json, até
a #6.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def _load(folder):
    data = json.loads((ROOT / 'assets' / folder / 'default.json').read_text())
    sheet = Image.open(ROOT / 'assets' / folder / data['sheet']).convert('RGBA')
    return data['items'], sheet


_CHARACTERS = (json.loads((ROOT / 'tools/dock/frames.json').read_text()),
               Image.open(ROOT / 'assets/pixel-office-2dpig/PixelOfficeAssetsNew3.png').convert('RGBA'))
SHEETS = (_load('office'), _load('ui'), _CHARACTERS)


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

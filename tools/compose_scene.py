"""Gera um PNG da cena sem navegador, com a mesma lógica do src/main.js.

Uso: python3 tools/compose_scene.py [saida.png]
     (padrão: office.png no diretório atual, ampliado 5x)"""
import json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
# Personagens do catálogo padrão (o Boss aparece na cena como "boss:standing").
CHARS = json.loads((ROOT / "assets/characters/default.json").read_text())
CHAR_SHEET = Image.open(ROOT / "assets/characters" / CHARS["sheet"]).convert("RGBA")
OFFICE = json.loads((ROOT / "assets/office/default.json").read_text())["items"]
OFFICE_SHEET = Image.open(ROOT / "assets/office/default.png").convert("RGBA")

def sprite(name, flip=False):
    if name in OFFICE:
        fx, fy, fw, fh = OFFICE[name]; src = OFFICE_SHEET
    else:
        cid, pose = name.split(":")
        (cw, ch), gap = CHARS["cell"], CHARS["gap"]
        col, row = next(c[pose] for c in CHARS["characters"] if c["id"] == cid)
        fx, fy, fw, fh = col * (cw + gap), row * (ch + gap), cw, ch; src = CHAR_SHEET
    spr = src.crop((fx, fy, fx + fw, fy + fh))
    return spr.transpose(Image.FLIP_LEFT_RIGHT) if flip else spr

def background(scene, w, h):
    """Parede e piso repetindo os sprites da folha, como em src/main.js."""
    im = Image.new("RGBA", (w, h))
    floor_y, floor_x = scene["background"]["floorY"], scene["background"]["floorX"]
    wall, floor = sprite("wall"), sprite("floor")
    y = floor_y - wall.height
    while y + wall.height > 0:
        for x in range(0, w, wall.width): im.paste(wall, (x, y))
        y -= wall.height
    for y in range(floor_y, h, 16):
        for x in range(floor_x, w, floor.width): im.paste(floor, (x, y))
    return im

def compose(scene):
    im = background(scene, 256, 224)
    for it in scene["items"]:
        if it[0].startswith(("seat:", "cup:", "rest:")):  # personagem e xícara entram pela página
            continue
        im.alpha_composite(sprite(it[0], len(it) > 3 and it[3]), (it[1], it[2]))
    return im

def main():
    scene = json.loads((ROOT / "src/scene.json").read_text())
    c = scene["crop"]
    im = compose(scene).crop((c["x"], c["y"], c["x"] + c["width"], c["y"] + c["height"]))
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("office.png")
    im.resize((im.width * 5, im.height * 5), Image.NEAREST).convert("RGB").save(out)
    print("gerado:", out)

if __name__ == "__main__":
    main()

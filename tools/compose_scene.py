"""Gera um PNG da cena sem navegador, com a mesma lógica do src/main.js.

Uso: python3 tools/compose_scene.py [saida.png]
     (padrão: office.png no diretório atual, ampliado 5x)"""
import json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FRAMES = json.loads((ROOT / "src" / "frames.json").read_text())
BG = json.loads((ROOT / "src" / "background.json").read_text())

def hexc(s): return tuple(int(s[i:i+2], 16) for i in (1, 3, 5)) + (255,)

def background(w, h):
    im = Image.new("RGBA", (w, h)); px = im.load()
    def row(y, c):
        for x in range(w): px[x, y] = c
    for band in BG["wall"]:
        for y in range(band["y"], band["y"] + band.get("h", 1)): row(y, hexc(band["color"]))
    f = BG["floor"]
    top, bh, pitch = f["y"], f["band"], f["brick"]
    k = 0
    for y0 in range(top, h, bh):
        seam = f["seams"][k % len(f["seams"])]; k += 1
        for dy in range(bh):
            y = y0 + dy
            if y >= h: break
            for x in range(w):
                on_seam = (x - seam) % pitch == 0
                after = (x - seam) % pitch == 1
                if dy == bh - 1: c = f["dark"]
                elif on_seam: c = f["dark"]
                elif dy == 0: c = f["light"]
                elif after: c = f["light"]
                else: c = f["base"]
                px[x, y] = hexc(c)
    return im

def small(path):
    big = Image.open(ROOT / path).convert("RGBA")
    return big.resize((big.width // 5, big.height // 5), Image.NEAREST)

SHEET = small("assets/pixel-office-2dpig/PixelOfficeAssetsNew2.png")

def sprite(name, flip=False):
    fx, fy, fw, fh = FRAMES[name]; src = SHEET
    spr = src.crop((fx, fy, fx + fw, fy + fh))
    return spr.transpose(Image.FLIP_LEFT_RIGHT) if flip else spr

def compose(items):
    im = background(256, 224)
    for it in items:
        if it[0].startswith(("seat:", "cup:", "meet:")):  # personagem e xícara entram pela página
            continue
        im.alpha_composite(sprite(it[0], len(it) > 3 and it[3]), (it[1], it[2]))
    return im

def main():
    scene = json.loads((ROOT / "src/scene.json").read_text())
    c = scene["crop"]
    im = compose(scene["items"]).crop((c["x"], c["y"], c["x"] + c["width"], c["y"] + c["height"]))
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("office.png")
    im.resize((im.width * 5, im.height * 5), Image.NEAREST).convert("RGB").save(out)
    print("gerado:", out)

if __name__ == "__main__":
    main()

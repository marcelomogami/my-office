#!/usr/bin/env python3
"""Desenha o escritório no protocolo gráfico do Kitty, a partir do stream local."""
import argparse
import base64
import io
import json
import queue
import random
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
FRAMES = json.loads((ROOT / 'tools/dock/frames.json').read_text())
SHEET = Image.open(ROOT / 'assets/pixel-office-2dpig/PixelOfficeAssetsNew3.png').convert('RGBA')
WIDTH, HEIGHT, SCALE = 478, 72, 2
FIT = {'s0': (1, -3), 's1': (1, -4), 's2': (2, -1), 's3': (-1, -4),
       's4': (-1, -4), 's5': (2, -1), 's6': (2, -1), 's7': (2, -1)}
PAIR = [(151, 'officeBlue', 'officeGrey', 'stickies', 'flagBR'),
        (244, 'officeOrange', 'officeGreen', 'posterSun', 'doc1'),
        (337, 'officeYellow', 'officeWhite', 'posterBlue', 'flagUS')]
STATUSES = {'working': ('iconWork1', 'iconWork2', 'iconWork3'), 'done': ('iconDone',),
            'error': ('iconError',), 'quota': ('iconQuota',)}


def layout(sessions, previous=None):
    """Preserva lugares enquanto possível, dando prioridade às duas sessões fixas."""
    previous = previous or {}
    candidates = [s for s in sessions if s.get('skin') in FIT and s.get('seat') and s.get('status') != 'away']
    assigned, occupied = {}, set()
    for s in candidates:
        fixed = 4 if s['name'] == '~detran' else 5 if s['name'] == '~secretario' else None
        if fixed is not None and fixed not in occupied:
            assigned[s['name']] = fixed
            occupied.add(fixed)
    for s in candidates:
        if s['name'] in assigned:
            continue
        old = previous.get(s['name'])
        if old in range(4) and old not in occupied:
            assigned[s['name']] = old
            occupied.add(old)
    for s in candidates:
        if s['name'] in assigned:
            continue
        available = next((i for i in (0, 1, 2, 3, 4, 5) if i not in occupied), None)
        if available is not None:
            assigned[s['name']] = available
            occupied.add(available)
    return assigned


def rest_layout(sessions, seats, previous=None, rng=random):
    """Sorteia lugares livres e mantém a posição durante o mesmo descanso."""
    previous = previous or {}
    resting = [s['name'] for s in sessions if s.get('status') == 'idle' and s['name'] in seats]
    result, occupied = {}, set()
    for name in resting:
        old = previous.get(name)
        if old in range(6) and old not in occupied:
            result[name] = old
            occupied.add(old)
    for name in resting:
        if name in result:
            continue
        free = [slot for slot in range(6) if slot not in occupied]
        if free:
            slot = rng.choice(free)
            result[name] = slot
            occupied.add(slot)
    return result


def render(sessions, seats, phase=0, rest_seats=None):
    im = Image.new('RGBA', (WIDTH, HEIGHT), '#41a6f6')
    draw = ImageDraw.Draw(im)
    for row, y in enumerate(range(20, HEIGHT, 8)):
        h = min(8, HEIGHT-y)
        draw.rectangle((0,y,WIDTH-1,y+h-1), fill='#41a6f6')
        draw.line((0,y,WIDTH-1,y), fill='#73eff7')
        if h == 8:
            draw.line((0,y+7,WIDTH-1,y+7), fill='#29366f')
        for x in range((54,20)[row % 2], WIDTH, 73):
            draw.line((x,y,x,y+min(7,h)-1), fill='#29366f')
            if h > 1:
                draw.line((x+1,y+1,x+1,y+min(7,h)-1), fill='#73eff7')

    def sprite(name, x, y, flip=False):
        sx, sy, w, h = FRAMES[name]
        part = SHEET.crop((sx, sy, sx+w, sy+h))
        if flip:
            part = part.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        im.alpha_composite(part, (x,y))

    def person(skin, x, y, flip=False):
        dx, dy = FIT[skin]
        w = FRAMES[skin][2]
        px = x + 11 - dx - w if flip else x + dx
        sprite(skin, px, y + dy, flip)
        return px, y + dy, w

    def bubble(anchor, status, bx):
        if status not in STATUSES:
            return
        x, y, w = anchor
        flip = bx + 7 > x + w/2
        by = max(0, y - 14)
        sprite('bubble', bx, by, flip)
        icons = STATUSES[status]
        sprite(icons[phase % len(icons)], bx + 1, by + 1)

    for x in range(0, WIDTH, 26): sprite('wall', x, 0)
    for item in [('clock',417,1), ('window',224,-11), ('windowNote',45,-11),
                 ('door',314,-11), ('calendar',100,1), ('vending',4,1),
                 ('cooler',30,18), ('tableSmall',42,18,True), ('coffee',54,17),
                 ('mug',44,20), ('chair5',78,12), ('chair5',125,12,True)]: sprite(*item)
    live = {s['name']: s for s in sessions}
    rest_seats = rest_seats if rest_seats is not None else rest_layout(sessions, seats)
    resting = {slot: live[name] for name, slot in rest_seats.items() if name in live}
    if 0 in resting: sprite('p'+resting[0]['skin'][1:],22,20)
    if 1 in resting: sprite('p'+resting[1]['skin'][1:],63,18,True)
    if 2 in resting: person(resting[2]['skin'],78,12)
    if 3 in resting: person(resting[3]['skin'],125,12,True)
    for item in [('tableSmall',95,18), ('boxGreen',97,16,True), ('mugCoffee',111,17)]: sprite(*item)
    anchors = []
    for i, (x, lc, rc, ld, rd) in enumerate(PAIR):
        y=6
        for item in [('partition',x,y),(ld,x+3,y+4),(rd,x+(67 if rd=='doc1' else 64),y+4),
                     ('pole',x+36,y+5,True),(lc,x+7,y+7),(rc,x+58,y+7,True),
                     ('desk',x+19,y+11),('desk',x+40,y+11,True)]: sprite(*item)
        for side in (0,1):
            session = next((live[n] for n, slot in seats.items() if slot == i*2+side), None)
            if session and session['status'] != 'idle':
                anchor = person(session['skin'],x+(58 if side else 7),y+7,bool(side))
                anchors.append((anchor,session['status'],x+(75 if side else -7)))
            if side == 0:
                sprite('computerLeft',x+21,y+7)
                if session: sprite('mugCoffee',x+27,y+24,True)
            else:
                sprite('computerRight',x+41,y+7)
                if session: sprite('mugRed',x+41,y+24)
        sprite('partition',x,y+30)
    x,y=430,6
    for item in [('partitionSingle',x,y,True),('pole',x,y+5),('officeBlue',x+22,y+7,True),('desk',x+4,y+11,True)]: sprite(*item)
    person('s5',x+22,y+7,True)
    for item in [('computerLeft',x+5,y+7,True),('mugCoffee',x+5,y+24),('partitionSingle',x,y+30,True),
                 ('plant',42,45),('sofaGreen',58,48)]: sprite(*item)
    if 4 in resting: sprite('p'+resting[4]['skin'][1:],66,39)
    sprite('sofaOrange',155,42)
    if 5 in resting: sprite('p'+resting[5]['skin'][1:],163,33)
    for item in [('plant',200,39),('plant',343,39),('cat',320,53),('binRed',386,44),
                 ('binBlue',259,44),('tableLong',270,42,True),('doc1',285,44),('printer',274,42),('dog',443,44,True)]: sprite(*item)
    for anchor,status,bx in anchors: bubble(anchor,status,bx)
    return im.resize((WIDTH*SCALE,HEIGHT*SCALE), Image.Resampling.NEAREST)


def stream(url, events):
    while True:
        try:
            with urllib.request.urlopen(url, timeout=90) as response:
                for line in response:
                    if line.startswith(b'data:'):
                        try:
                            data = json.loads(line[5:])
                            if isinstance(data, list): events.put(data)
                        except (ValueError, UnicodeDecodeError):
                            continue
        except (OSError, urllib.error.URLError):
            time.sleep(2)


def send_image(im):
    output = io.BytesIO()
    im.save(output, format='PNG')
    encoded = base64.b64encode(output.getvalue()).decode('ascii')
    out = sys.stdout
    out.write('\x1b[H\x1b_Ga=d,d=i,i=1,q=2\x1b\\')
    chunks = [encoded[i:i+4096] for i in range(0,len(encoded),4096)]
    for i, part in enumerate(chunks):
        more = int(i < len(chunks)-1)
        header = f'a=T,f=100,i=1,q=2,m={more}' if i == 0 else f'm={more}'
        out.write(f'\x1b_G{header};{part}\x1b\\')
    out.flush()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5199/api/stream')
    parser.add_argument('--png', type=Path, help='Gera um quadro vazio para inspeção')
    parser.add_argument('--test-idle-seconds', type=float, help='Prazo temporário de descanso apenas no dock')
    args = parser.parse_args()
    if args.png:
        render([],{}).save(args.png)
        return
    if not sys.stdout.isatty():
        parser.error('execute dentro de um terminal Kitty')
    events = queue.Queue()
    threading.Thread(target=stream, args=(args.url,events), daemon=True).start()
    sessions, raw_sessions, seats, rest_seats, phase = [], [], {}, {}, 0
    sys.stdout.write('\x1b[?25l\x1b[2J')
    try:
        needs_redraw = True
        while True:
            projected = [dict(s, status='idle') if args.test_idle_seconds is not None
                         and s.get('status') == 'done' and isinstance(s.get('since'), (int, float))
                         and time.time() * 1000 - s['since'] >= args.test_idle_seconds * 1000
                         else s for s in raw_sessions]
            if projected != sessions:
                sessions = projected
                seats = layout(sessions, seats)
                rest_seats = rest_layout(sessions, seats, rest_seats)
                needs_redraw = True
            if needs_redraw or any(s.get('status') == 'working' for s in sessions):
                send_image(render(sessions, seats, phase, rest_seats))
                needs_redraw = False
                phase += 1
            try:
                raw_sessions = events.get(timeout=.4)
                while not events.empty(): raw_sessions = events.get_nowait()
            except queue.Empty:
                pass
    except KeyboardInterrupt:
        pass
    finally:
        sys.stdout.write('\x1b_Ga=d,d=I,i=1,q=2\x1b\\\x1b[?25h')
        sys.stdout.flush()

if __name__ == '__main__': main()

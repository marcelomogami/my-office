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

from session_panel import compose
from sheets import BOSS, FACES, crop, frame, seated_at

WIDTH, HEIGHT, SCALE = 478, 72, 2
DESKS = ('1', '2', '3', '4', '5', '6')
# Lugares de descanso, numerados da esquerda para a direita e de cima para
# baixo (índices 0 a 7): em pé na copa ('stand', canto da célula), sentado nas
# cadeiras da copa e dois em cada sofá ('chair', canto da cadeira, pela regra
# única de encaixe).
REST = (('stand', 20, 19, False), ('stand', 60, 17, True), ('chair', 78, 12, False), ('chair', 125, 12, True),
        ('chair', 56, 43, False), ('chair', 78, 43, True), ('chair', 153, 37, False), ('chair', 175, 37, True))
PAIR = [(151, 'officeBlue', 'officeGrey', 'stickies', 'flagBR'),
        (244, 'officeOrange', 'officeGreen', 'posterSun', 'doc1'),
        (337, 'officeYellow', 'officeWhite', 'posterBlue', 'flagUS')]
STATUSES = {'working': ('iconWork1', 'iconWork2', 'iconWork3'), 'done': ('iconDone',),
            'error': ('iconError',), 'quota': ('iconQuota',)}


def layout(sessions):
    """Baia de cada sessão no dock, a partir da baia que o backend escolheu.

    As baias têm a mesma numeração da página web, a partir do Boss, da direita
    para a esquerda: a 1 e a 2 são o par ao lado do Boss, a 5 e a 6 o par da
    ponta esquerda. A posição no dock (0 a 5, da esquerda para a direita) é
    6 menos o número.
    """
    return {s['name']: 6 - int(s['seat']) for s in sessions
            if s.get('skin') in FACES and s.get('status') != 'away' and s.get('seat') in DESKS}


def rest_layout(sessions, seats, previous=None, rng=random):
    """Sorteia lugares livres e mantém a posição durante o mesmo descanso."""
    previous = previous or {}
    resting = [s['name'] for s in sessions if s.get('status') == 'idle' and s['name'] in seats]
    result, occupied = {}, set()
    for name in resting:
        old = previous.get(name)
        if old in range(len(REST)) and old not in occupied:
            result[name] = old
            occupied.add(old)
    for name in resting:
        if name in result:
            continue
        free = [slot for slot in range(len(REST)) if slot not in occupied]
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

    # Coordenadas dos móveis: canto superior esquerdo da célula no mapa.
    def sprite(name, x, y, flip=False):
        part = crop(name)
        if flip:
            part = part.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        im.alpha_composite(part, (x,y))

    # Personagem sentado na cadeira em (x, y), pela regra única das células.
    def person(skin, x, y, flip=False):
        w = frame(f'{skin}:seated')[2]
        px, py = seated_at(x, y, flip, w)
        sprite(f'{skin}:seated', px, py, flip)
        return px, py, w

    def bubble(anchor, status, bx):
        if status not in STATUSES:
            return
        x, y, w = anchor
        flip = bx + 6 > x + w/2
        by = max(0, y - 14)
        sprite('bubbleThought', bx, by, flip)
        icons = STATUSES[status]
        sprite(icons[phase % len(icons)], bx + 2, by + 1)

    for x in range(0, WIDTH, 26): sprite('wall', x, 0)
    for item in [('clock',417,-17), ('window',224,-14), ('windowNote',45,-14),
                 ('door',314,-20), ('calendar',100,-12), ('vending',4,-5),
                 ('cooler',30,11), ('tableSmall',38,4,True), ('coffee',54,4),
                 ('mug',44,3), ('chair5',78,10), ('chair5',120,10,True)]: sprite(*item)
    live = {s['name']: s for s in sessions}
    rest_seats = rest_seats if rest_seats is not None else rest_layout(sessions, seats)
    resting = {slot: live[name] for name, slot in rest_seats.items() if name in live}
    def rest(slots):
        for slot in slots:
            if slot in resting:
                kind, x, y, flip = REST[slot]
                if kind == 'stand': sprite(resting[slot]['skin']+':standing', x, y, flip)
                else: person(resting[slot]['skin'], x, y, flip)
    rest((0, 1, 2, 3))
    for item in [('tableSmall',95,4), ('boxGreen',92,0,True), ('mugCoffee',111,0)]: sprite(*item)
    anchors = []
    for i, (x, lc, rc, ld, rd) in enumerate(PAIR):
        y=6
        for item in [('partition',x,y),(ld,x+3,y-12),(rd,x+(67 if rd=='doc1' else 64),y-(12 if rd=='doc1' else 11)),
                     ('divider',x+36,y+5,True),(lc,x+7,y+5),(rc,x+53,y+5,True),
                     ('desk',x+19,y+11),('desk',x+40,y+11,True)]: sprite(*item)
        for side in (0,1):
            session = next((live[n] for n, slot in seats.items() if slot == i*2+side), None)
            if session and session['status'] != 'idle':
                anchor = person(session['skin'],x+(58 if side else 7),y+7,bool(side))
                anchors.append((anchor,session['status'],x+(75 if side else -7)))
            if side == 0:
                sprite('computerSide1',x+21,y+5)
                if session: sprite('mugCoffee',x+19,y+7,True)
            else:
                sprite('computerSide2',x+41,y+5)
                if session: sprite('mugRed',x+41,y+7)
        sprite('partition',x,y+30)
    x,y=430,6
    for item in [('partitionSingle',x,y,True),('divider',x,y+5),('officeBlue',x+17,y+5,True),('desk',x+4,y+11,True)]: sprite(*item)
    person(BOSS,x+22,y+7,True)
    for item in [('computerSide1',x-5,y+5,True),('mugCoffee',x+5,y+7),('partitionSingle',x,y+30,True),
                 ('plant',42,40),('sofaGreen',58,40)]: sprite(*item)
    rest((4, 5))
    sprite('sofaOrange',155,34)
    rest((6, 7))
    for item in [('plant',200,34),('plant',343,34),('cat',320,36),('binRed',386,34),
                 ('binBlue',259,34),('tableLong',270,34,True),('doc1',285,28),('printer',274,27),('dog',437,25,True)]: sprite(*item)
    for anchor,status,bx in anchors: bubble(anchor,status,bx)
    room = im.resize((WIDTH*SCALE, HEIGHT*SCALE), Image.Resampling.NEAREST)
    return compose(room, sessions, seats)


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
        last_timers = None
        while True:
            projected = [dict(s, status='idle') if args.test_idle_seconds is not None
                         and s.get('status') == 'done' and isinstance(s.get('since'), (int, float))
                         and time.time() * 1000 - s['since'] >= args.test_idle_seconds * 1000
                         else s for s in raw_sessions]
            if projected != sessions:
                sessions = projected
                seats = layout(sessions)
                rest_seats = rest_layout(sessions, seats, rest_seats)
                needs_redraw = True
            now_ms = time.time() * 1000
            timers = tuple((s['name'], int(max(0, now_ms - s['since']) // 60000))
                           for s in sessions if s.get('name') in seats
                           and s.get('status') in ('done', 'idle', 'error', 'quota')
                           and isinstance(s.get('since'), (int, float)))
            if needs_redraw or timers != last_timers or any(s.get('status') == 'working' for s in sessions):
                send_image(render(sessions, seats, phase, rest_seats))
                needs_redraw = False
                last_timers = timers
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

#!/usr/bin/env python3
"""Desenha o escritório no protocolo gráfico do Kitty, a partir do stream local."""
import argparse
import base64
import io
import fcntl
import json
import math
import os
import queue
import re
import select
import shlex
import struct
import subprocess
import termios
import tty
import random
import sys
import threading
import time
import urllib.error
import urllib.request
import urllib.parse
from pathlib import Path

from PIL import Image

from session_panel import compose, LEFT, TOP, CARD_WIDTH, CARD_HEIGHT
from sheets import BOSS, CAST, CONFIG_DIR, FACES, crop, frame, seated_at

WIDTH, HEIGHT, SCALE = 478, 72, 2
# Onde começa o piso e o deslocamento horizontal dos tijolos (como o
# "background" de src/scene.json).
FLOOR_Y, FLOOR_X = 20, -18
DESKS = ('1', '2', '3', '4', '5', '6')
# Lugares de descanso, numerados como as baias, a partir do Boss: da direita
# para a esquerda e de cima para baixo (índices 0 a 7). Em pé na copa
# ('stand', canto da célula), sentado nas cadeiras da copa e dois em cada sofá
# ('chair', canto da cadeira, pela regra única de encaixe).
REST = (('chair', 125, 12, True), ('chair', 82, 12, False), ('stand', 60, 17, True), ('stand', 20, 21, False),
        ('chair', 177, 40, True), ('chair', 155, 40, False), ('chair', 80, 43, True), ('chair', 58, 43, False))
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


DEFAULT_REST_MOVE = 15


def rest_move_minutes(config_dir=CONFIG_DIR):
    """timers.restMove do config.json local (minutos; 0 desliga), como no
    backend; sem a opção, ou com um valor inválido, o padrão."""
    try:
        value = json.loads((config_dir / 'config.json').read_text()).get('timers', {}).get('restMove')
    except (OSError, ValueError, AttributeError):
        return DEFAULT_REST_MOVE
    valid = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0
    return value if valid else DEFAULT_REST_MOVE


def boss_timer(name, default, config_dir=CONFIG_DIR):
    try:
        value = json.loads((config_dir / 'config.json').read_text()).get('timers', {}).get(name)
    except (OSError, ValueError, AttributeError):
        return default
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0 else default


class BossRest:
    def __init__(self, now, interval, duration, rng=random):
        self.interval, self.duration, self.rng = interval * 60, duration * 60, rng
        self.resting = False
        self.deadline = now + self.interval * (.5 + rng.random() * .5)

    def tick(self, now, positions):
        if now < self.deadline:
            return False
        if self.resting:
            positions.pop(None, None)
            self.resting = False
            self.deadline = now + self.interval * (.5 + self.rng.random() * .5)
            return True
        free = [slot for slot in range(len(REST)) if slot not in positions.values()]
        if not free:
            return False
        positions[None] = self.rng.choice(free)
        self.resting = True
        self.deadline = now + self.duration
        return True


def next_move_at(start, minutes, rng=random):
    """Próxima troca de lugar: entre o intervalo e um terço a mais depois de
    `start` (segundos); None com a troca desligada. Mesma regra de src/rest.js."""
    return start + minutes * 60 * (1 + rng.random() / 3) if minutes > 0 else None


def move_resting(positions, moves, now, minutes, rng=random):
    """Troca de lugar quem está descansando há tempo suficiente.

    `positions`: {nome: lugar} de quem descansa; `moves`: {nome: próxima troca},
    marcada quando a sessão entra em descanso (contando dali). O lugar novo é
    sorteado entre os livres, nunca o mesmo; sem lugar livre, tenta depois de
    outro intervalo. Devolve True se alguém mudou de lugar."""
    for name in [n for n in moves if n not in positions]:
        del moves[name]
    changed = False
    for name, slot in positions.items():
        if name not in moves:
            moves[name] = next_move_at(now, minutes, rng)
            continue
        if moves[name] is None or now < moves[name]:
            continue
        taken = set(positions.values())
        free = [s for s in range(len(REST)) if s != slot and s not in taken]
        if free:
            positions[name] = rng.choice(free)
            changed = True
        moves[name] = next_move_at(now, minutes, rng)
    return changed


def rest_layout(sessions, seats, previous=None, rng=random):
    """Sorteia lugares livres e mantém a posição durante o mesmo descanso."""
    previous = previous or {}
    resting = [s['name'] for s in sessions if s.get('status') == 'idle' and s['name'] in seats]
    result = {None: previous[None]} if None in previous else {}
    occupied = set(result.values())
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


def render(sessions, seats, phase=0, rest_seats=None, offline=False, boss=None):
    im = Image.new('RGBA', (WIDTH, HEIGHT))
    # Piso: o sprite `floor` repetido de 16 em 16 (três faixas, desenho a
    # cada duas), com os tijolos deslocados como na página web.
    floor = crop('floor')
    for y in range(FLOOR_Y, HEIGHT, 16):
        for x in range(FLOOR_X, WIDTH, floor.width):
            im.paste(floor, (x, y))

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
        by = max(0, y - 8)
        sprite('bubbleThought', bx, by, flip)
        icons = STATUSES[status]
        sprite(icons[phase % len(icons)], bx + 2, by + 1)

    for x in range(0, WIDTH, 26): sprite('wall', x, 0)
    for item in [('clock',417,-17), ('window',224,-14), ('windowNote',45,-14),
                 ('door',314,-20), ('calendar',100,-12), ('vending',4,-5),
                 ('cooler',30,11), ('tableSmall',38,4,True), ('coffee',54,0),
                 ('mug',46,4), ('chair5',82,10), ('chair5',120,10,True)]: sprite(*item)
    live = {s['name']: s for s in sessions}
    rest_seats = rest_seats if rest_seats is not None else rest_layout(sessions, seats)
    resting = {slot: live[name] for name, slot in rest_seats.items() if name in live}
    if None in rest_seats: resting[rest_seats[None]] = {'skin': BOSS}
    boss_anchor = None
    def rest(slots):
        nonlocal boss_anchor
        for slot in slots:
            if slot in resting:
                kind, x, y, flip = REST[slot]
                skin = resting[slot]['skin']
                if kind == 'stand':
                    sprite(skin+':standing', x, y, flip)
                    anchor = (x, y, frame(skin+':standing')[2])
                else: anchor = person(skin, x, y, flip)
                if skin == BOSS: boss_anchor = anchor
    rest((0, 1, 2, 3))
    for item in [('tableSmall',96,4), ('boxGreen',93,4,True), ('mugCoffee',112,3)]: sprite(*item)
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
                anchors.append((anchor,session['status'],x+(68 if side else -5)))
            if side == 0:
                sprite('computerSide1',x+21,y+5)
                if session: sprite('mugCoffee',x+19,y+7,True)
            else:
                sprite('computerSide2',x+41,y+5)
                if session: sprite('mugRed',x+41,y+7)
        sprite('partition',x,y+30)
    x,y=430,6
    for item in [('partitionSingle',x,y,True),('divider',x,y+5),('officeBlue',x+17,y+5,True),('desk',x+4,y+11,True)]: sprite(*item)
    if None not in rest_seats: boss_anchor = person(BOSS,x+22,y+7,True)
    for item in [('computerSide1',x-5,y+5,True),('mugCoffee',x+5,y+7),('partitionSingle',x,y+30,True),
                 ('plant',42,40),('sofaGreen',58,40)]: sprite(*item)
    rest((6, 7))
    sprite('sofaOrange',155,37)
    rest((4, 5))
    for item in [('plant',200,34),('plant',343,34),('cat',320,36),('binRed',386,34),
                 ('binBlue',259,34),('tableLong',270,34,True),('doc1',285,28),('printer',274,27),('dog',437,25,True)]: sprite(*item)
    for anchor,status,bx in anchors: bubble(anchor,status,bx)
    icon = (boss or {}).get('emotes', {}).get((boss or {}).get('emote'))
    if boss_anchor and icon and None not in rest_seats:
        try:
            bx = min(WIDTH - 13, max(0, boss_anchor[0] + boss_anchor[2] - 2))
            by = max(0, boss_anchor[1] - 8)
            sprite('bubbleThought', bx, by, bx + 6 > boss_anchor[0] + boss_anchor[2] / 2)
            sprite(icon, bx + 2, by + 1)
        except KeyError:
            pass
    room = im.resize((WIDTH*SCALE, HEIGHT*SCALE), Image.Resampling.NEAREST)
    return compose(room, sessions, seats, offline=offline, boss=boss)


def rest_demo(chosen=()):
    """Um personagem em cada lugar de descanso, na ordem dos números, para
    conferir as posições. `chosen` escolhe quem fica nos primeiros lugares."""
    order = list(dict.fromkeys([c for c in chosen if c in FACES] + list(CAST)))
    # com menos personagens que lugares, repete do começo
    skins = [order[i % len(order)] for i in range(len(REST))]
    sessions = [{'name': f'lugar {i + 1}', 'skin': cid, 'status': 'idle', 'seat': None, 'face': cid}
                for i, cid in enumerate(skins)]
    return sessions, {}, {s['name']: i for i, s in enumerate(sessions)}


def desk_demo(chosen=()):
    """Um personagem em cada baia, com status variados, para conferir os
    balões. `chosen` escolhe quem fica nas primeiras baias."""
    order = list(dict.fromkeys([c for c in chosen if c in FACES] + list(CAST)))
    statuses = ('working', 'done', 'error', 'quota')
    sessions = [{'name': f'baia {d}', 'skin': order[i % len(order)], 'status': statuses[i % len(statuses)],
                 'seat': d, 'face': order[i % len(order)]} for i, d in enumerate(DESKS)]
    return sessions, layout(sessions), {}


def watch_and_show(sessions, seats, rest_seats):
    """Mostra a demonstração e reinicia o processo quando o código do dock muda."""
    files = list(Path(__file__).parent.glob('*.py'))
    stamp = lambda: [f.stat().st_mtime for f in files]
    start = stamp()
    send_image(render(sessions, seats, 0, rest_seats))
    while stamp() == start:
        time.sleep(.3)
    sys.stdout.write('\x1b_Ga=d,d=I,i=1,q=2\x1b\\')
    sys.stdout.flush()
    os.execv(sys.executable, [sys.executable, *sys.argv])


# Mesmas regras de src/connection.js: uma conexão fechada é percebida na hora;
# uma parada, depois de 60 s sem nenhuma linha (o backend manda um sinal de
# vida a cada 25 s); o aviso aparece depois de 10 s fora.
STALE_AFTER, SHOW_AFTER = 60, 10


def stream(url, events, link):
    """Lê o stream do backend; `link['down_since']` marca desde quando está fora."""
    while True:
        try:
            with urllib.request.urlopen(url, timeout=STALE_AFTER) as response:
                link['down_since'] = None
                event_type = ''
                for line in response:
                    if line.startswith(b'event:'):
                        event_type = line[6:].strip().decode('utf8')
                    if line.startswith(b'data:'):
                        try:
                            data = json.loads(line[5:])
                            if isinstance(data, list): events.put(('sessions', data))
                            elif event_type == 'boss' and isinstance(data, dict): events.put(('boss', data))
                            event_type = ''
                        except (ValueError, UnicodeDecodeError):
                            continue
        except (OSError, urllib.error.URLError):
            pass
        if link['down_since'] is None:
            link['down_since'] = time.time()
        time.sleep(2)


_MOUSE = re.compile(rb'\x1b\[<([0-9]+);([0-9]+);([0-9]+)([Mm])')


def boss_card_hit(column, row, cell_width, cell_height):
    """O cartão ocupa a primeira posição da lista, em pixels da imagem."""
    x, y = (column - .5) * cell_width, (row - .5) * cell_height
    return LEFT <= x < LEFT + CARD_WIDTH and TOP <= y < TOP + CARD_HEIGHT


def mouse_reader(events, stop):
    """Recebe cliques SGR sem alterar o foco do dock."""
    buffer = b''
    while not stop.is_set():
        try:
            if not select.select([sys.stdin], [], [], .3)[0]:
                continue
            buffer += os.read(sys.stdin.fileno(), 256)
            for match in _MOUSE.finditer(buffer):
                button, x, y, action = match.groups()
                if button == b'0' and action == b'M':
                    rows, cols, width, height = struct.unpack('HHHH', fcntl.ioctl(sys.stdin.fileno(), termios.TIOCGWINSZ, bytes(8)))
                    if rows and cols and width and height and boss_card_hit(int(x), int(y), width / cols, height / rows):
                        events.put(('edit_boss', None))
            last = buffer.rfind(b'\x1b')
            buffer = buffer[last:] if last >= 0 and _MOUSE.fullmatch(buffer[last:]) is None else b''
            if len(buffer) > 64: buffer = b''
        except (OSError, ValueError):
            return


def open_boss_editor(url):
    """Abre um overlay sobre a janela com foco, usando permissão do dock."""
    base = urllib.parse.urlsplit(url)._replace(path='', query='', fragment='').geturl()
    script = Path(__file__).with_name('boss_editor.py')
    args = ' '.join(shlex.quote(str(value)) for value in
                    ('--type=overlay', '--env', f'MY_OFFICE_URL={base}', '--env', f'MY_OFFICE_CONFIG_DIR={CONFIG_DIR}', sys.executable, script))
    try:
        subprocess.Popen(['kitten', '@', 'action', '--match', 'state:focused', 'launch', args],
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError:
        pass  # O dock continua funcionando mesmo sem o executável kitten.


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
    parser.add_argument('--descanso', nargs='?', const='', metavar='IDS',
                        help='Demonstração: um personagem em cada lugar de descanso (ex.: char3,char1), '
                             'recarregada quando o código muda')
    parser.add_argument('--baias', nargs='?', const='', metavar='IDS',
                        help='Demonstração: um personagem em cada baia, com balões de status variados')
    args = parser.parse_args()
    demo = (rest_demo(args.descanso.split(',')) if args.descanso is not None
            else desk_demo(args.baias.split(',')) if args.baias is not None else None)
    if args.png:
        (render(demo[0], demo[1], 0, demo[2]) if demo else render([], {})).save(args.png)
        return
    if not sys.stdout.isatty():
        parser.error('execute dentro de um terminal Kitty')
    if demo:
        sys.stdout.write('\x1b[?25l\x1b[2J')
        try:
            watch_and_show(*demo)
        except KeyboardInterrupt:
            sys.stdout.write('\x1b_Ga=d,d=I,i=1,q=2\x1b\\\x1b[?25h')
            sys.stdout.flush()
        return
    events = queue.Queue()
    mouse_stop = threading.Event()
    old_terminal = termios.tcgetattr(sys.stdin.fileno())
    tty.setcbreak(sys.stdin.fileno())
    sys.stdout.write('\x1b[?1000h\x1b[?1006h')
    sys.stdout.flush()
    threading.Thread(target=mouse_reader, args=(events, mouse_stop), daemon=True).start()
    link = {'down_since': None}
    threading.Thread(target=stream, args=(args.url, events, link), daemon=True).start()
    sessions, raw_sessions, seats, rest_seats, phase = [], [], {}, {}, 0
    rest_move, rest_moves = rest_move_minutes(), {}
    boss = {}
    boss_rest = BossRest(time.time(), boss_timer('bossRestIntervalMax', 120), boss_timer('bossRestDuration', 25))
    sys.stdout.write('\x1b[?25l\x1b[2J')
    try:
        needs_redraw = True
        last_timers = None
        offline = False
        while True:
            down_since = link['down_since']
            now_offline = down_since is not None and time.time() - down_since >= SHOW_AFTER
            if now_offline != offline:
                offline = now_offline
                needs_redraw = True
            projected = [dict(s, status='idle') if args.test_idle_seconds is not None
                         and s.get('status') == 'done' and isinstance(s.get('since'), (int, float))
                         and time.time() * 1000 - s['since'] >= args.test_idle_seconds * 1000
                         else s for s in raw_sessions]
            if projected != sessions:
                sessions = projected
                seats = layout(sessions)
                rest_seats = rest_layout(sessions, seats, rest_seats)
                needs_redraw = True
            if boss_rest.tick(time.time(), rest_seats):
                rest_seats = rest_layout(sessions, seats, rest_seats)
                needs_redraw = True
            if move_resting(rest_seats, rest_moves, time.time(), rest_move):
                needs_redraw = True
            now_ms = time.time() * 1000
            timers = tuple((s['name'], int(max(0, now_ms - s['since']) // 60000))
                           for s in sessions if s.get('name') in seats
                           and s.get('status') in ('done', 'idle', 'error', 'quota')
                           and isinstance(s.get('since'), (int, float)))
            if needs_redraw or timers != last_timers or any(s.get('status') == 'working' for s in sessions):
                send_image(render(sessions, seats, phase, rest_seats, offline, boss))
                needs_redraw = False
                last_timers = timers
                phase += 1
            try:
                kind, data = events.get(timeout=.4)
                if kind == 'boss': boss = data; needs_redraw = True
                elif kind == 'edit_boss': open_boss_editor(args.url)
                else: raw_sessions = data
                while not events.empty():
                    kind, data = events.get_nowait()
                    if kind == 'boss': boss = data; needs_redraw = True
                    elif kind == 'edit_boss': open_boss_editor(args.url)
                    else: raw_sessions = data
            except queue.Empty:
                pass
    except KeyboardInterrupt:
        pass
    finally:
        mouse_stop.set()
        termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, old_terminal)
        sys.stdout.write('\x1b[?1000l\x1b[?1006l\x1b_Ga=d,d=I,i=1,q=2\x1b\\\x1b[?25h')
        sys.stdout.flush()

if __name__ == '__main__': main()

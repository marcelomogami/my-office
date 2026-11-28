#!/usr/bin/env python3
"""Editor do status do Boss em uma janela ou overlay do Kitty."""
import base64
import io
import json
import fcntl
import struct
import termios
import os
import readline
import sys
import urllib.error
import urllib.request
from urllib.parse import urljoin

from PIL import Image, ImageDraw

from sheets import crop
from session_panel import font, fit_text, translator


def request(base, method='GET', data=None):
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(urljoin(base, '/api/boss'), data=body, method=method,
                                 headers={'Content-Type': 'application/json'} if body else {})
    with urllib.request.urlopen(req, timeout=5) as response:
        return json.load(response)


def emote_grid(emotes, current, columns):
    """Gera a grade numerada a partir do catálogo e das folhas disponíveis."""
    entries = []
    for name, sprite in emotes.items():
        try:
            entries.append((name, crop(sprite)))
        except (KeyError, TypeError):
            continue
    cell_w, cell_h = 88, 36
    rows = (len(entries) + columns - 1) // columns
    image = Image.new('RGBA', (columns * cell_w, max(1, rows) * cell_h), '#172430')
    draw = ImageDraw.Draw(image)
    face = font(11)
    for i, (name, icon) in enumerate(entries):
        x, y = (i % columns) * cell_w, (i // columns) * cell_h
        draw.rounded_rectangle((x + 2, y + 2, x + cell_w - 3, y + cell_h - 3), 5,
                               fill='#e9bc76' if name == current else '#e8eff1')
        icon = icon.resize((27, 27), Image.Resampling.NEAREST)
        image.alpha_composite(icon, (x + 4, y + 4))
        draw.text((x + 33, y + 3), str(i + 1), font=face, fill='#172430')
        draw.text((x + 33, y + 18), fit_text(draw, name, face, cell_w - 37), font=face, fill='#172430')
    return image, [name for name, _ in entries]


def image_columns(image, terminal):
    # Deixa espaço para o título, instruções e entrada mesmo em janela baixa.
    try:
        rows, cols, pixel_w, pixel_h = struct.unpack('HHHH', fcntl.ioctl(sys.stdout.fileno(), termios.TIOCGWINSZ, bytes(8)))
        cell_w = pixel_w / cols if pixel_w and cols else 9
        cell_h = pixel_h / rows if pixel_h and rows else 18
    except (OSError, ValueError, ZeroDivisionError):
        cell_w, cell_h = 9, 18
    available_height = max(1, terminal.lines - 7) * cell_h
    return max(1, min(terminal.columns - 1, int(image.width / cell_w), int(available_height * image.width / image.height / cell_w)))


def show_image(image, columns):
    """Envia a grade pelo protocolo gráfico do Kitty, avançando o cursor."""
    output = io.BytesIO()
    image.save(output, format='PNG')
    encoded = base64.b64encode(output.getvalue()).decode('ascii')
    parts = [encoded[i:i + 4096] for i in range(0, len(encoded), 4096)]
    for i, part in enumerate(parts):
        more = int(i < len(parts) - 1)
        header = f'a=T,f=100,q=2,c={columns},m={more}' if i == 0 else f'm={more}'
        sys.stdout.write(f'\x1b_G{header};{part}\x1b\\')
    sys.stdout.write('\n')
    sys.stdout.flush()


def edit(base=None, input_fn=input, output=sys.stdout):
    base = base or os.environ.get('MY_OFFICE_URL', 'http://127.0.0.1:5199')
    t = translator()
    try:
        state = request(base)
        terminal = os.get_terminal_size() if sys.stdout.isatty() else os.terminal_size((80, 24))
        columns = max(1, min(6, (terminal.columns - 2) // 14))
        image, names = emote_grid(state['emotes'], state.get('emote'), columns)
        print('\x1b[2J\x1b[H' + t('boss.title') + '\n', file=output, flush=True)
        if output is sys.stdout:
            show_image(image, image_columns(image, terminal))
        print(t('boss.terminalChoice'), file=output, flush=True)
        while True:
            choice = input_fn('> ').strip().lower()
            if choice == 'q':
                return False
            if choice == '0':
                request(base, 'DELETE')
                return True
            if not choice and state.get('emote') in names:
                emote = state['emote']
                break
            if choice.isdecimal() and 1 <= int(choice) <= len(names):
                emote = names[int(choice) - 1]
                break
            print(t('boss.terminalInvalid'), file=output, flush=True)
        print(t('boss.terminalText'), file=output, flush=True)
        # Readline permite editar o texto atual, incluindo esvaziá-lo.
        readline.set_startup_hook(lambda: readline.insert_text(state.get('text', '')))
        try:
            while True:
                text = input_fn('> ')
                if len(text) <= 160 and not any(ord(c) < 32 or ord(c) == 127 for c in text):
                    break
                print(t('boss.tooLong'), file=output, flush=True)
        finally:
            readline.set_startup_hook(None)
        request(base, 'PUT', {'emote': emote, 'text': text})
        return True
    except (KeyboardInterrupt, EOFError):
        print(file=output)
        return False
    except (OSError, ValueError, KeyError, urllib.error.URLError) as error:
        print(f"{t('boss.error')} ({error})", file=output, flush=True)
        if sys.stdin.isatty():
            try:
                input_fn(t('boss.terminalClose'))
            except (EOFError, KeyboardInterrupt):
                pass
        return False


if __name__ == '__main__':
    edit()

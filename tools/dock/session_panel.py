"""Lista de sessões desenhada ao lado da sala do dock."""
import hashlib
import math
import time

from PIL import Image, ImageDraw, ImageFont

from sheets import BOSS, CAST, crop, face as face_crop

CARD_WIDTH, CARD_HEIGHT, GAP = 178, 44, 6
TOP, LEFT = 4, 968
PANEL_WIDTH, PANEL_HEIGHT = 1514, 148
# Mesmas sessões fixas de src/sessions.js (a #5 leva isso para um arquivo de
# configuração). Personagem fora do catálogo é ignorado.
FIXED_FACES = {'~detran': 'custom2', '~secretario': 'custom1', '~secretario-dev': 'char5', 'chat-ferramentas': 'char1'}
LABELS = {'working': 'trabalhando', 'done': 'pronto', 'idle': 'descansando',
          'away': 'foi embora', 'error': 'erro', 'quota': 'cota acabou'}
ICONS = {'working': 'iconWork3', 'done': 'iconDone', 'idle': 'mugCoffee',
         'away': 'mugCoffee', 'error': 'iconError', 'quota': 'iconQuota'}


def font(size, bold=False):
    try:
        return ImageFont.truetype('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf', size)
    except OSError:
        return ImageFont.load_default()


BOLD, NORMAL, SMALL = font(12, True), font(11), font(9)


def fit_text(draw, text, face, width):
    if draw.textlength(text, font=face) <= width:
        return text
    while text and draw.textlength(text + '…', font=face) > width:
        text = text[:-1]
    return text + '…'


def details(session, seated, now):
    name = session['name']
    status = session.get('status', 'working')
    if session.get('_boss'):
        return name, None, ''
    home = not seated and status != 'away'
    shown = 'done' if home and status == 'idle' else status
    title = f'{name} (home office)' if home else name
    timer = ''
    since = session.get('since')
    if not home and status in ('done', 'idle', 'error', 'quota') and isinstance(since, (int, float)) and math.isfinite(since):
        minutes = int(max(0, now - since) // 60000)
        timer = f'{minutes // 60}h{minutes % 60:02d}m' if minutes >= 60 else f'{minutes:02d}m'
    return title, shown, timer


def face_for(session):
    if session.get('_boss'):
        return BOSS
    name = session['name']
    for skin in (FIXED_FACES.get(name), session.get('skin')):
        if skin in CAST:
            return skin
    index = int.from_bytes(hashlib.sha256(name.encode('utf-8')).digest()[:4], 'big') % len(CAST)
    return CAST[index]


def panel_entries(sessions):
    """O Boss ocupa o primeiro cartão, seguido por até oito sessões."""
    return [{'name': 'Boss', 'skin': BOSS, '_boss': True}, *sessions[:8]]


def compose(room, sessions, seats, now=None):
    """Desenha o Boss e até oito sessões em três colunas de três cartões."""
    now = time.time() * 1000 if now is None else now
    canvas = Image.new('RGBA', (PANEL_WIDTH, PANEL_HEIGHT), (0, 0, 0, 0))
    canvas.alpha_composite(room, (0, TOP))
    draw = ImageDraw.Draw(canvas)
    for i, session in enumerate(panel_entries(sessions)):
        col, row = divmod(i, 3)
        x, y = LEFT + col * (CARD_WIDTH + GAP), TOP + row * (CARD_HEIGHT + GAP)
        draw.rounded_rectangle((x, y, x + CARD_WIDTH - 1, y + CARD_HEIGHT - 1),
                               radius=5, fill='#172430', outline='#2a3844')
        skin = face_for(session)
        face = face_crop(skin)
        face = face.resize((face.width * 2, face.height * 2), Image.Resampling.NEAREST)
        canvas.alpha_composite(face, (x + (44 - face.width) // 2, y + 1))
        title, status, timer = details(session, session['name'] in seats, now)
        if timer:
            tw = draw.textlength(timer, font=SMALL)
            draw.text((x + (44 - tw) / 2, y + 29), timer, font=SMALL, fill='#a5b7bc')
        draw.text((x + 44, y + 5), fit_text(draw, title, BOLD, 133), font=BOLD, fill='#e8eff1')
        if session.get('_boss'):
            continue
        icon_name = ICONS.get(status, 'iconWork3')
        icon = crop(icon_name)
        icon = icon.crop(icon.getbbox() or (0, 0, icon.width, icon.height))
        icon.thumbnail((13, 11), Image.Resampling.NEAREST)
        draw.rounded_rectangle((x + 44, y + 23, x + 59, y + 36), radius=2, fill='#f4f4f4')
        canvas.alpha_composite(icon, (x + 44 + (16 - icon.width) // 2, y + 23 + (14 - icon.height) // 2))
        label = LABELS.get(status, status)
        draw.text((x + 64, y + 23), fit_text(draw, label, NORMAL, 113), font=NORMAL, fill='#a5b7bc')
    return canvas

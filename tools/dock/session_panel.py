"""Lista de sessões desenhada ao lado da sala do dock."""
import hashlib
import json
import math
import time

from PIL import Image, ImageDraw, ImageFont

from sheets import BOSS, CAST, CONFIG_DIR, ROOT, crop, face as face_crop

CARD_WIDTH, CARD_HEIGHT, GAP = 178, 44, 6
TOP, LEFT = 4, 968
PANEL_WIDTH, PANEL_HEIGHT = 1514, 148


def translator(config_dir=CONFIG_DIR):
    """Textos de src/locales.json no idioma do config.json local, com a mesma
    regra de src/i18n.js: padrão inglês, sem diferenciar maiúsculas, e o que
    faltar no idioma escolhido cai no inglês."""
    locales = json.loads((ROOT / 'src' / 'locales.json').read_text())
    try:
        wanted = json.loads((config_dir / 'config.json').read_text()).get('language')
    except (OSError, ValueError, AttributeError):
        wanted = None
    chosen = next((lang for lang in locales if isinstance(wanted, str) and lang.lower() == wanted.strip().lower()), 'en')
    return lambda key: locales[chosen].get(key, locales['en'].get(key, key))


t = translator()
# Cor de cada agente (harnesses.json, o mesmo da página web).
HARNESSES = json.loads((ROOT / 'src' / 'harnesses.json').read_text())
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
    title = f"{name} ({t('homeOffice')})" if home else name
    timer = ''
    since = session.get('since')
    if not home and status in ('done', 'idle', 'error', 'quota') and isinstance(since, (int, float)) and math.isfinite(since):
        minutes = int(max(0, now - since) // 60000)
        timer = f'{minutes // 60}h{minutes % 60:02d}m' if minutes >= 60 else f'{minutes:02d}m'
    return title, shown, timer


def face_for(session):
    if session.get('_boss'):
        return BOSS
    # o backend manda o rosto de cada sessão (com as sessões fixas da
    # configuração); sem ele, um rosto estável pelo nome
    for skin in (session.get('face'), session.get('skin')):
        if skin in CAST:
            return skin
    index = int.from_bytes(hashlib.sha256(session['name'].encode('utf-8')).digest()[:4], 'big') % len(CAST)
    return CAST[index]


def panel_entries(sessions):
    """O Boss ocupa o primeiro cartão, seguido por até oito sessões."""
    return [{'name': 'Boss', 'skin': BOSS, '_boss': True}, *sessions[:8]]


def compose(room, sessions, seats, now=None, offline=False):
    """Desenha o Boss e até oito sessões em três colunas de três cartões.

    Com `offline`, o cartão do Boss avisa que o dock está desconectado do
    backend (o que aparece pode estar desatualizado)."""
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
        harness = None if session.get('_boss') else HARNESSES.get(session.get('agent'))
        if harness:
            # bolinha do agente entre o avatar e o nome
            draw.ellipse((x + 44, y + 8, x + 51, y + 15), fill=harness['color'])
            draw.text((x + 55, y + 5), fit_text(draw, title, BOLD, 122), font=BOLD, fill='#e8eff1')
        else:
            draw.text((x + 44, y + 5), fit_text(draw, title, BOLD, 133), font=BOLD, fill='#e8eff1')
        if session.get('_boss'):
            if offline:
                label = fit_text(draw, t('disconnected'), BOLD, 128)
                lw = draw.textlength(label, font=BOLD)
                draw.rounded_rectangle((x + 44, y + 22, x + 44 + lw + 11, y + 37), radius=7, fill='#b13e53')
                draw.text((x + 50, y + 23), label, font=BOLD, fill='#ffffff')
            continue
        icon_name = ICONS.get(status, 'iconWork3')
        icon = crop(icon_name)
        icon = icon.crop(icon.getbbox() or (0, 0, icon.width, icon.height))
        icon.thumbnail((13, 11), Image.Resampling.NEAREST)
        draw.rounded_rectangle((x + 44, y + 23, x + 59, y + 36), radius=2, fill='#f4f4f4')
        canvas.alpha_composite(icon, (x + 44 + (16 - icon.width) // 2, y + 23 + (14 - icon.height) // 2))
        label = t(f'short.{status}')
        draw.text((x + 64, y + 23), fit_text(draw, label, NORMAL, 113), font=NORMAL, fill='#a5b7bc')
    return canvas

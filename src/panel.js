import { FIXED, SKINS } from './sessions.js';
import { STATUS } from './status.js';
import { elapsedLabel } from './elapsed.js';

// O rosto do home office é apenas visual e pode repetir o de outra sessão.
export function panelFace(name, assigned, remembered, random = Math.random) {
  if (FIXED[name]) return FIXED[name].skin;
  if (assigned) return assigned;
  if (!remembered.has(name)) {
    const choices = Object.keys(SKINS).filter((skin) => !SKINS[skin].decor);
    remembered.set(name, choices[Math.floor(random() * choices.length)]);
  }
  return remembered.get(name);
}

// Em home office, a indicação de pronto permanece até voltar a trabalhar.
export function panelDetails(name, status, seated, since, now = Date.now()) {
  const home = !seated && status !== 'away';
  const visibleStatus = home && status === 'idle' ? 'done' : status;
  const shortLabel = { done: '👍 pronto', idle: '☕ descansando' };
  const st = STATUS[visibleStatus];
  const text = shortLabel[visibleStatus] ?? `${st.emoji} ${st.label}`;
  const elapsed = !home && ['done', 'idle', 'error', 'quota'].includes(status) ? elapsedLabel(since, now) : '';
  return { title: home ? `${name} (home office)` : name, text: elapsed ? `${text} · ${elapsed}` : text };
}

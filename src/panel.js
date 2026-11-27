import { drawable } from './sessions.js';
import { STATUS } from './status.js';
import { elapsedLabel } from './elapsed.js';
import { translator } from './i18n.js';

// O rosto do home office é apenas visual e pode repetir o de outra sessão
// não fixa, mas só usa o personagem de uma sessão fixa se todos forem fixos.
// `cast`: ids dos personagens que podem representar sessões; `fixed`: as
// sessões fixas da configuração.
export function panelFace(name, assigned, remembered, cast, fixed = {}, random = Math.random) {
  if (cast.includes(fixed[name]?.skin)) return fixed[name].skin;
  if (assigned) return assigned;
  const pool = drawable(cast, fixed);
  if (!remembered.has(name)) remembered.set(name, pool[Math.floor(random() * pool.length)]);
  return remembered.get(name);
}

// Em home office, a indicação de pronto permanece até voltar a trabalhar.
// `t`: a função de tradução (src/i18n.js).
export function panelDetails(name, status, seated, since, now = Date.now(), t = translator()) {
  const home = !seated && status !== 'away';
  const visibleStatus = home && status === 'idle' ? 'done' : status;
  const st = STATUS[visibleStatus];
  // pronto e descansando usam o texto curto; os outros, o do balão
  const label = ['done', 'idle'].includes(visibleStatus) ? t(`short.${visibleStatus}`) : t(`status.${visibleStatus}`);
  const text = `${st.emoji} ${label}`;
  const elapsed = !home && ['done', 'idle', 'error', 'quota'].includes(status) ? elapsedLabel(since, now) : '';
  return { title: home ? `${name} (${t('homeOffice')})` : name, text: elapsed ? `${text} · ${elapsed}` : text };
}

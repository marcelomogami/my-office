// Status que um personagem pode mostrar. Pensados a partir dos eventos que
// uma sessão de agente expõe (no Claude Code, via hooks):
//
//   UserPromptSubmit, PreToolUse, PostToolUse, PreCompact -> working
//   Stop (terminou e respondeu, ou parou com uma pergunta)  -> done
//   falha que interrompe a sessão (API, ferramenta)         -> error
//   limite de uso / cota atingido                           -> quota
//   muito tempo em "done" sem novo pedido (30 min)         -> idle
//   4 horas sem nenhum evento                               -> away
//
// `icon` é o ícone da folha desenhado dentro do balão (uma lista vira
// animação, um quadro a cada 400 ms); `emoji` é só o ícone usado no quadro
// lateral e no tooltip.
// `idle` não tem balão: o personagem levanta e vai para a copa. `away` some
// da sala (a baia fica livre) e só aparece no quadro lateral.
export const STATUS = {
  working: { label: 'trabalhando', emoji: '···', icon: ['iconWork1', 'iconWork2', 'iconWork3'] },
  done: { label: 'pronto, respondeu', emoji: '👍', icon: 'iconDone' },
  error: { label: 'deu erro', emoji: '❗', icon: 'iconError', bounce: true },
  quota: { label: 'cota acabou', emoji: '🪫', icon: 'iconQuota' },
  idle: { label: 'sem tarefa há um tempo', emoji: '☕' },
  away: { label: 'foi embora', emoji: '🏠' },
  // Só do gerente (mesa de chefe), não vem de sessão.
  stress: { label: 'stress...', emoji: '💢', icon: 'iconStress' },
};

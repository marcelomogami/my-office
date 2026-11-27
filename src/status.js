// Status que um personagem pode mostrar. Pensados a partir dos eventos que
// uma sessão de agente expõe (no Claude Code, via hooks):
//
//   UserPromptSubmit, PreToolUse, PostToolUse, PreCompact -> working
//   Stop (terminou e respondeu, ou parou com uma pergunta)  -> done
//   StopFailure (turno interrompido por erro da API)        -> error
//   StopFailure com rate_limit ou billing_error             -> quota
//   10 min em "done", "error" ou "quota" sem novo evento    -> idle
//   4 horas sem nenhum evento                               -> away
//   8 horas sem nenhum evento                               -> removido da lista
//
// O texto de cada status fica em locales.json (`status.<nome>`).
// `icon` é o ícone da folha desenhado dentro do balão (uma lista vira
// animação, um quadro a cada 400 ms); `emoji` é só o ícone usado no quadro
// lateral e no tooltip.
// `idle` não tem balão: o personagem levanta e vai para a copa. `away` some
// da sala (a baia fica livre) e só aparece no quadro lateral.
export const STATUS = {
  working: { emoji: '···', icon: ['iconWork1', 'iconWork2', 'iconWork3'] },
  done: { emoji: '👍', icon: 'iconDone' },
  error: { emoji: '❗', icon: 'iconError', bounce: true },
  quota: { emoji: '🪫', icon: 'iconQuota' },
  idle: { emoji: '☕' },
  away: { emoji: '🏠' },
  // Só do gerente (mesa de chefe), não vem de sessão.
  stress: { emoji: '💢', icon: 'iconAnger' },
};

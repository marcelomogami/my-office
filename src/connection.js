// Quando avisar que a sala está desconectada do backend.
//
// A página e o dock ficam com o stream aberto, e o backend manda um sinal de
// vida (`ping`) a cada 25 s. Uma conexão fechada é percebida na hora; uma
// que parou sem fechar, depois de 60 s sem nenhuma mensagem (dois sinais
// perdidos). O aviso só aparece depois de 10 s fora, para uma reconexão
// rápida (o serviço reiniciando, por exemplo) não piscar na tela.

export const SHOW_AFTER_MS = 10_000;
export const STALE_AFTER_MS = 60_000;

// `downSince`: quando a conexão caiu (null se está de pé); `lastSeen`: a
// última mensagem recebida.
export function isStale(lastSeen, now) {
  return now - lastSeen >= STALE_AFTER_MS;
}

export function showDisconnected({ downSince, lastSeen }, now) {
  const since = downSince ?? (isStale(lastSeen, now) ? lastSeen + STALE_AFTER_MS : null);
  return since !== null && now - since >= SHOW_AFTER_MS;
}

// Tempo desde que a sessão parou, em minutos inteiros.
export function elapsedLabel(since, now = Date.now()) {
  if (typeof since !== 'number' || !Number.isFinite(since)) return '';
  const minutes = Math.floor(Math.max(0, now - since) / 60000);
  const hours = Math.floor(minutes / 60);
  const remainder = String(minutes % 60).padStart(2, '0');
  return hours ? `${hours}h${remainder}m` : `${remainder}m`;
}

// Troca de lugar no descanso: quem está descansando muda para outro lugar
// livre de tempos em tempos (timers.restMove no config.json, em minutos).
// Cada troca sorteia entre o valor e um terço a mais, contado de quando o
// personagem entrou em descanso ou da troca anterior; 0 desliga.

// Quando será a próxima troca, ou null se a troca está desligada.
export function nextMoveAt(from, minutes, random = Math.random) {
  if (!(minutes > 0)) return null;
  return from + minutes * 60_000 * (1 + random() / 3);
}

// Um lugar livre sorteado que não seja o atual, ou null se não houver.
export function pickSpot(spots, taken, current, random = Math.random) {
  const free = spots.filter((spot) => spot !== current && !taken.has(spot));
  return free.length ? free[Math.floor(random() * free.length)] : null;
}

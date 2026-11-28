// Ciclo visual independente do Boss. Os tempos são em milissegundos.
export function createBossRest({ intervalMax, duration, now = Date.now, random = Math.random }) {
  let resting = false;
  let deadline = now() + intervalMax * (0.5 + random() * 0.5);
  return {
    get resting() { return resting; },
    tick(canRest) {
      const time = now();
      if (time < deadline) return null;
      if (!resting) {
        if (!canRest()) return null;
        resting = true;
        deadline = time + duration;
        return 'rest';
      }
      resting = false;
      deadline = time + intervalMax * (0.5 + random() * 0.5);
      return 'work';
    },
  };
}

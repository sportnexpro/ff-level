import { DestroyRef, inject } from '@angular/core';

/**
 * Runs `fn` now and then every `ms` while the calling component is alive.
 * Call from a constructor / field initializer (needs an injection context).
 */
export function every(ms: number, fn: () => unknown) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await fn(); } finally { busy = false; }
  };
  tick();
  const id = setInterval(tick, ms);
  inject(DestroyRef).onDestroy(() => clearInterval(id));
  return tick;
}

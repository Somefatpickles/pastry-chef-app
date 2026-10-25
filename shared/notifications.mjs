export const NOTIFICATION_EXIT_MS = 300;

/** Timers and stages survive moving a notice into a native dialog's top layer. */
export function createNotificationQueue({ onChange, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, limit = 3, prefix = 'notice', reducedMotion = () => false }) {
  const entries = new Map();
  const waiting = new Map();
  const capacity = Math.max(1, Math.floor(limit));
  let active = false;
  let sequence = 0;

  const emit = () => onChange([...entries.values()].map(({ id, message, kind, stage }) => ({ id, message, kind, stage })));
  function stopTimer(entry) {
    entry.revision++;
    if (entry.timer === undefined) return;
    clearTimer(entry.timer);
    entry.timer = undefined;
    entry.remaining = Math.max(0, entry.remaining - Math.max(0, now() - entry.started));
  }
  function beginExit(entry) {
    if (entry.stage === 'exiting') return;
    stopTimer(entry);
    entry.stage = 'exiting';
    entry.remaining = reducedMotion() ? 0 : NOTIFICATION_EXIT_MS;
    if (entry.remaining === 0) entries.delete(entry.id);
    else schedule(entry);
  }
  function rebalance(protectedEntry) {
    // Outgoing cards retain their slots until their fade ends. Waiting feedback
    // never creates a fourth card or takes focus from a card being read.
    while (true) {
      while (entries.size < capacity && waiting.size) {
        const entry = waiting.values().next().value;
        waiting.delete(entry.id);
        entries.set(entry.id, entry);
        schedule(entry);
      }
      const exiting = [...entries.values()].filter(entry => entry.stage === 'exiting').length;
      if (waiting.size <= exiting) return;
      const oldest = [...entries.values()].find(entry => entry !== protectedEntry && entry.stage !== 'exiting' && !entry.paused.has('focus'));
      if (!oldest) return;
      beginExit(oldest);
    }
  }
  function dismiss(id) {
    const entry = entries.get(id);
    if (!entry) {
      if (waiting.delete(id)) emit();
      return;
    }
    if (entry.stage === 'exiting') return;
    beginExit(entry);
    rebalance();
    emit();
  }
  function schedule(entry) {
    if (!active || entries.get(entry.id) !== entry || entry.timer !== undefined || (entry.stage !== 'exiting' && entry.paused.size)) return;
    entry.started = now();
    const revision = ++entry.revision;
    entry.timer = setTimer(() => {
      if (revision !== entry.revision || !active || entries.get(entry.id) !== entry || (entry.stage !== 'exiting' && entry.paused.size)) return;
      entry.timer = undefined;
      entry.remaining = 0;
      if (entry.stage === 'exiting') {
        entries.delete(entry.id);
        rebalance();
        emit();
      } else dismiss(entry.id);
    }, entry.remaining);
  }
  function notify(message, kind = 'info') {
    if (!active || typeof message !== 'string' || !message.trim()) return undefined;
    const text = message.trim().slice(0, 1000);
    const normalizedKind = ['success', 'error', 'info'].includes(kind) ? kind : 'info';
    const lifetime = normalizedKind === 'error' ? 10000 : 8000;
    const duplicate = [...entries.values(), ...waiting.values()].find(entry => entry.message === text && entry.kind === normalizedKind);
    if (duplicate) {
      stopTimer(duplicate);
      if (duplicate.stage === 'exiting') duplicate.stage = 'visible';
      duplicate.remaining = lifetime;
      schedule(duplicate);
      rebalance(duplicate);
      emit();
      return duplicate.id;
    }
    const id = `${prefix}-${++sequence}`;
    const entry = { id, message: text, kind: normalizedKind, stage: reducedMotion() ? 'visible' : 'entering', remaining: lifetime, started: now(), timer: undefined, revision: 0, paused: new Set() };
    waiting.set(id, entry);
    // Bound pending feedback as well as the visible stack during rapid actions.
    while (waiting.size > capacity) waiting.delete(waiting.keys().next().value);
    rebalance();
    emit();
    return id;
  }
  function reveal(id) {
    const entry = entries.get(id);
    if (!active || !entry || entry.stage !== 'entering') return;
    entry.stage = 'visible';
    emit();
  }
  function pause(id, reason = 'pointer') {
    const entry = entries.get(id);
    if (!entry || entry.stage === 'exiting' || entry.paused.has(reason)) return;
    entry.paused.add(reason);
    stopTimer(entry);
  }
  function resume(id, reason = 'pointer') {
    const entry = entries.get(id);
    if (!entry) return;
    entry.paused.delete(reason);
    schedule(entry);
    rebalance();
    emit();
  }
  return {
    notify, dismiss, reveal, pause, resume,
    has(id) { return entries.has(id) || waiting.has(id); },
    start() { active = true; for (const entry of [...entries.values()]) schedule(entry); },
    stop() { active = false; for (const entry of entries.values()) stopTimer(entry); },
    isActive() { return active; },
  };
}

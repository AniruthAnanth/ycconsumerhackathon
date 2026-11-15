/**
 * The moment this player locks a lineup, said by the code that locked it.
 *
 * The notifications host puts the system's permission question just after that moment. It used
 * to work the moment out for itself, from the roster query going from unlocked to locked, but
 * that also happens when the player locked nothing: under Switch Player the same query starts
 * returning a seeded player's locked roster, and iOS put its dialog on the Demo controls
 * screen. Only the code that performed the lock knows it was the player's own, so it says so
 * here, the way the check-in prompt says a place was reached (arrival.ts).
 *
 * An announcement is an event, not a state: it reaches whoever is listening at that moment and
 * is not kept. A lineup locked before the app opened therefore says nothing, and neither does
 * a lock made while nothing listens (the web, where the host is not mounted).
 *
 * Pure: it only calls its listeners, so it is safe to call on the web and in Expo Go.
 */
const listeners = new Set<() => void>();

/** Says that this player's own Lock Lineup has just succeeded. */
export function announceLineupLocked(): void {
  listeners.forEach((listener) => listener());
}

/** Calls `listener` each time a lineup is locked from now on. Returns the function that stops it. */
export function onLineupLocked(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

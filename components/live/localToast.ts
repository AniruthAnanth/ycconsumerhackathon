/**
 * A toast the app raises itself, such as the perfect week, as opposed to the leaguemate proofs
 * LiveToastHost finds in the feed. The host listens here and queues these with the rest.
 */
type Listener = (text: string) => void;

const listeners = new Set<Listener>();

export function showToast(text: string) {
  for (const listener of listeners) listener(text);
}

export function onToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * One copy of the system's answer to "may Lineup notify?", for everything that acts on it.
 *
 * The notifications host, the League tab's Push switch and the demo's preview all need the
 * answer, and any of them can be the one that learns it. Each used to keep its own copy, so a
 * grant made from the switch reached the host, which enables the device and registers its push
 * token, only when the app next came to the foreground. With one copy, whoever learns an answer
 * publishes it and every subscriber has it at once.
 *
 * Pure: no React and no Expo. native.ts holds the app's one store and publishes to it;
 * usePermission.ts subscribes components to it.
 */
export type Permission = "granted" | "denied" | "undetermined";

export type PermissionStore = {
  /** The answer as last learned, or undefined before the first one. */
  last(): Permission | undefined;
  /** Records an answer and returns it, telling the subscribers when it differs from the last. */
  publish(answer: Permission): Permission;
  /** Calls `listener` whenever the answer changes. Returns the function that stops it. */
  subscribe(listener: () => void): () => void;
};

export function permissionStore(): PermissionStore {
  let last: Permission | undefined;
  const listeners = new Set<() => void>();
  return {
    last: () => last,
    publish(answer) {
      // The answer is read again each time the app returns to the foreground and is nearly
      // always the same one, which is news to nobody.
      if (answer !== last) {
        last = answer;
        listeners.forEach((listener) => listener());
      }
      return answer;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

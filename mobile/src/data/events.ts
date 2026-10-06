type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to "something in the database changed" notifications. Returns an unsubscribe function. */
export function subscribeToDataChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call after any write so that screens re-run their queries. */
export function notifyDataChanged(): void {
  for (const listener of Array.from(listeners)) {
    listener();
  }
}

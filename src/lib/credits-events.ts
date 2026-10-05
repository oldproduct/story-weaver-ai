/** Lightweight signal so the credits badge refreshes after each recording. */
const EVENT = "chorus:credits-changed";

export function notifyCreditsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function onCreditsChanged(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

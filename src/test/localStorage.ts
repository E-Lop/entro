// Map-backed in-memory Storage used across tests. Node 25+ ships an experimental
// built-in `localStorage` global that, without `--localstorage-file`, resolves to
// `undefined` (see vitest#8757 / nodejs#60303); jsdom under an opaque origin doesn't
// expose one either. This factory gives tests a deterministic, spec-shaped Storage.
export function makeLocalStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

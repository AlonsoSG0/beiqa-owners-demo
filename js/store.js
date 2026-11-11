// Estado de la demostración: solo vive en la pestaña actual.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BeiqaStore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const KEY = 'beiqa-owners-demo';
  const empty = () => ({ draft: null, evaluation: null, decisions: {}, history: [], undo: [] });
  const clone = (value) => structuredClone(value);

  function createStore(storage) {
    function read() {
      try {
        const saved = storage.getItem(KEY);
        return saved ? Object.assign(empty(), JSON.parse(saved)) : empty();
      } catch { return empty(); }
    }
    function write(state) { storage.setItem(KEY, JSON.stringify(state)); return clone(state); }
    function change(patch, action) {
      const state = read();
      const before = {};
      Object.keys(patch).forEach((key) => { before[key] = clone(state[key] === undefined ? null : state[key]); });
      Object.assign(state, clone(patch));
      if (action) {
        const entry = { by: action.by || 'Owner', what: action.what, why: action.why || '', at: new Date().toISOString() };
        state.history.push(entry);
        state.undo.push({ before, entry });
      }
      return write(state);
    }
    function undo() {
      const state = read();
      const previous = state.undo.pop();
      if (!previous) return state;
      Object.assign(state, previous.before);
      state.history.push({ by: previous.entry.by, what: 'Deshacer: ' + previous.entry.what, why: 'Corrección de la acción anterior', at: new Date().toISOString() });
      return write(state);
    }
    return { read, change, undo };
  }
  return { createStore, KEY };
});

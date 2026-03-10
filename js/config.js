// js/config.js
// Centralized config for the availability form. Change only this file when you roll months.
//
// Example month change:
//   window.POLICY = makePolicy({ windowISO: '2025-12', startISO: '2025-12-01', endISO: '2025-12-31' });
//
(() => {
  function makePolicy(overrides = {}) {
    const base = {
      specVersion: 'v1.4',
      policyVersion: 'windowed-dates-v1',
      windowISO: '2025-11',
      startISO: '2025-11-01',
      endISO:   '2025-11-30',
    };
    const merged = Object.assign({}, base, overrides);
    return Object.freeze(merged);
  }

  window.makePolicy = makePolicy;
  window.POLICY = makePolicy();
})();

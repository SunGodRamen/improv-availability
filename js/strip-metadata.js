(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('availability-form');
    if (!form) return;

    // Remove any _meta[...] fields before submit
    form.addEventListener('submit', () => {
      const REMOVE_POLICY = false;

      // Remove all telemetry/metadata
      form.querySelectorAll('input[name^="_meta["]').forEach(n => n.remove());

      if (REMOVE_POLICY) {
        form.querySelectorAll(
          'input[name="_policy_start"],input[name="_policy_end"],input[name="_policy_version"],input[name="_policy_window"]'
        ).forEach(n => n.remove());
      }
    }, { capture: true });
  });
})();
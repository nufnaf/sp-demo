/* Progressive enhancement only: business actions remain native HTML forms. */
(() => {
  const key = 'novaflow:appearance';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (['light', 'dark', 'system'].includes(saved)) preference = saved;
  } catch { /* Browser storage can be unavailable; the page remains usable. */ }
  const apply = () => {
    document.documentElement.dataset.theme = preference === 'system'
      ? system.matches ? 'dark' : 'light' : preference;
  };
  apply();
  system.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    const control = document.querySelector('[data-theme-select]');
    control.value = preference;
    control.closest('label').hidden = false;
    control.addEventListener('change', () => {
      preference = control.value;
      try { localStorage.setItem(key, preference); } catch { /* Optional storage. */ }
      apply();
    });
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      preference = ['light', 'dark'].includes(event.newValue) ? event.newValue : 'system';
      control.value = preference;
      apply();
    });
    document.addEventListener('submit', event => {
      const form = event.target;
      if (form.dataset.submitting) { event.preventDefault(); return; }
      form.dataset.submitting = 'true';
      form.setAttribute('aria-busy', 'true');
      const button = event.submitter;
      // Do not disable the button: its name/value (draft vs submitted) must post.
      if (button?.tagName === 'BUTTON') {
        button.dataset.originalLabel = button.textContent;
        button.textContent = form.method === 'post' ? '正在保存…' : '正在查询…';
        button.setAttribute('aria-disabled', 'true');
      }
    });
  });
  window.addEventListener('pageshow', () => {
    for (const form of document.querySelectorAll('[data-submitting]')) {
      delete form.dataset.submitting;
      form.removeAttribute('aria-busy');
      for (const button of form.querySelectorAll('[data-original-label]')) {
        button.textContent = button.dataset.originalLabel;
        delete button.dataset.originalLabel;
        button.removeAttribute('aria-disabled');
      }
    }
  });
})();

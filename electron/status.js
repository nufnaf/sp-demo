const splash = document.getElementById('splash');
const retry = document.getElementById('retry');
const error = document.getElementById('error');
const loading = document.getElementById('loading');
let current = 'starting';
const unsubscribe = window.syntropicStartup.subscribe(state => {
  const previous = current;
  current = state.phase;
  // Flush the restored opaque state even when a fast retry finishes in one frame.
  if (current === 'revealing') void splash.offsetWidth;
  splash.dataset.phase = current;
  error.hidden = current !== 'error';
  loading.hidden = current !== 'starting';
  document.getElementById('title').textContent = state.title || '暂时无法打开工作空间';
  document.getElementById('detail').textContent = state.detail || '';
  retry.hidden = !state.retry;
  retry.disabled = false;
  if (current === 'error' && previous !== 'error' && state.retry) retry.focus();
});
splash.addEventListener('transitionend', event => {
  if (event.target === splash && event.propertyName === 'opacity' && current === 'revealing') {
    window.syntropicStartup.hidden();
  }
});
retry.addEventListener('click', async () => {
  retry.disabled = true;
  try { await window.syntropicStartup.retry(); }
  finally { retry.disabled = false; }
});
window.addEventListener('pagehide', unsubscribe, { once: true });

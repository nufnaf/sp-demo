const state = new URLSearchParams(window.location.search);
document.getElementById('title').textContent = state.get('title') || '正在启动本机后台…';
document.getElementById('detail').textContent = state.get('detail') || '正在准备工作空间，请稍候。服务就绪后将自动打开工作台。';
const retry = document.getElementById('retry');
retry.hidden = state.get('retry') !== 'true';
retry.addEventListener('click', () => { retry.disabled = true; void window.syntropicDesktop.retry(); });

const screen = document.getElementById('screen');
const status = document.getElementById('status');
const connect = document.getElementById('connect');
const disconnect = document.getElementById('disconnect');
const placeholder = document.getElementById('placeholder');
const message = document.getElementById('message');
const settings = document.getElementById('settings');
let connected = false;

function reset(text = '已断开') {
  connected = false;
  screen.hidden = true;
  screen.removeAttribute('src');
  placeholder.hidden = false;
  disconnect.hidden = true;
  status.className = '';
  status.textContent = text;
}

window.computerPreview.onFrame(frame => {
  if (frame.error) { reset('连接已暂停'); message.textContent = frame.error; return; }
  if (!connected) return;
  screen.src = frame.dataUrl;
});
screen.addEventListener('load', () => {
  if (!connected) return;
  screen.hidden = false;
  placeholder.hidden = true;
  disconnect.hidden = false;
  status.textContent = '实时画面';
  status.className = 'live';
});
screen.addEventListener('error', () => {
  reset('连接已暂停');
  message.textContent = '暂时无法显示飞书画面，请重新连接。';
  void window.computerPreview.disconnect();
});
connect.addEventListener('click', async () => {
  connect.disabled = true;
  settings.hidden = true;
  status.textContent = '正在连接';
  try {
    const result = await window.computerPreview.connect();
    if (result.error) {
      settings.hidden = !result.permissions;
      reset('连接未完成');
      message.textContent = result.error;
      return;
    }
    connected = true;
  } catch {
    reset('连接未完成'); message.textContent = '暂时无法连接飞书，请重试。';
  } finally { connect.disabled = false; }
});
settings.addEventListener('click', () => window.computerPreview.settings());
disconnect.addEventListener('click', () => { reset(); void window.computerPreview.disconnect(); });

// Disposable, local-only acceptance fixture. All mutations require real form
// submission; GET /audit is read-only verification for the test runner.
import { createServer } from 'node:http';
const records = [
  { id: 'R-101', name: 'Alpha', status: '已完成', note: '' },
  { id: 'R-102', name: 'Beta', status: '待处理', note: '' },
  { id: 'R-103', name: 'Gamma', status: '待处理', note: '' },
];
const audit = [];
const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const html = (body) => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>网页操作测试台</title><style>body{font:17px system-ui;max-width:900px;margin:45px auto;padding:0 25px;color:#213547;background:#f5f7fa}main{background:white;padding:30px;border:1px solid #dce3e8;border-radius:14px}input,select,textarea,button{font:inherit;padding:10px;margin:8px;border:1px solid #bac7d0;border-radius:6px}textarea{display:block;width:80%;height:130px}table{width:100%;border-collapse:collapse;margin:25px 0}td,th{padding:15px;text-align:left;border-bottom:1px solid #ddd}a{color:#1265aa}.success{background:#e5f5e9;padding:16px}</style><h1>网页操作测试台</h1><p>临时验收页面 · 所有内容均为测试数据</p><main>${body}</main></html>`;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && url.pathname === '/audit') {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ records, audit })); return;
  }
  const record = records.find((item) => url.pathname === `/records/${item.id}`);
  if (record && req.method === 'POST') {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 20000) { res.writeHead(413).end(); return; } }
    record.note = new URLSearchParams(body).get('note') ?? '';
    audit.push({ action: 'save', id: record.id, note: record.note, at: new Date().toISOString() });
    res.writeHead(303, { Location: `${url.pathname}?saved=1` }).end(); return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (record) {
    audit.push({ action: 'detail', id: record.id });
    res.end(html(`<a href="/">返回记录列表</a><h2>${escape(record.id)} · ${escape(record.name)}</h2><p>状态：${record.status}</p>${url.searchParams.has('saved') ? `<p class="success" role="status">保存成功。记录 ${record.id} 的备注：${escape(record.note)}</p>` : ''}<form method="post"><label for="note">备注</label><textarea id="note" name="note">${escape(record.note)}</textarea><button type="submit">保存备注</button></form>`)); return;
  }
  const q = url.searchParams.get('q') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const filtered = records.filter((item) => (!q || `${item.id} ${item.name}`.toLowerCase().includes(q.toLowerCase())) && (!status || status === item.status));
  if (q || status) audit.push({ action: 'filter', q, status });
  res.end(html(`<h2>记录列表</h2><form method="get"><label for="q">编号或名称</label><input id="q" name="q" value="${escape(q)}"><label for="status">状态</label><select id="status" name="status"><option value="">全部</option><option ${status === '待处理' ? 'selected' : ''}>待处理</option><option ${status === '已完成' ? 'selected' : ''}>已完成</option></select><button type="submit">筛选</button></form><p>找到 ${filtered.length} 条记录</p><table><thead><tr><th>编号</th><th>名称</th><th>状态</th><th>操作</th></tr></thead><tbody>${filtered.map((item) => `<tr><td>${item.id}</td><td>${item.name}</td><td>${item.status}</td><td><a href="/records/${item.id}">查看 ${item.id} 详情</a></td></tr>`).join('')}</tbody></table><div style="margin-top:900px">页面底部 · 手动滚动验收</div>`));
});
server.listen(30142, '127.0.0.1', () => console.log('测试网页：http://127.0.0.1:30142'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());

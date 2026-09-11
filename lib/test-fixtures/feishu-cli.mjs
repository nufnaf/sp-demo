#!/usr/bin/env node
// Subprocess boundary fixture: no real credentials or Feishu traffic.
const args = process.argv.slice(2);
const send = value => process.stdout.write(JSON.stringify(value));
if (args[0] === '--version') { process.stdout.write('lark-cli version 1.0.95'); }
else if (args[0] === 'auth') {
  send({ appId: process.env.FEISHU_FIXTURE_APP || 'test-app', identities: { user: { available: true, verified: true, status: 'ready', openId: 'test-user', userName: '测试用户' } } });
} else {
  const index = flag => args.indexOf(flag);
  const params = index('--params') < 0 ? {} : JSON.parse(args[index('--params') + 1]);
  let path, method = 'GET';
  if (args[0] === 'api') { method = args[1]; path = args[2].replace('/open-apis', ''); }
  else if (args[0] === 'calendar' && args[1] === 'events') {
    path = `/calendar/v4/calendars/${encodeURIComponent(params.calendar_id)}/events`;
    if (params.event_id) path += `/${encodeURIComponent(params.event_id)}`;
    if (args[2] === 'instance_view') path += '/instance_view';
    if (args[2] === 'create') method = 'POST';
    if (args[2] === 'delete') method = 'DELETE';
    delete params.calendar_id; delete params.event_id;
  } else if (args[0] === 'drive') path = '/drive/v1/files';
  else throw Error(`Unsupported fixture command: ${args.slice(0, 3).join(' ')}`);
  if (Object.keys(params).length) path += `?${new URLSearchParams(params)}`;
  const body = index('--data') < 0 ? undefined : args[index('--data') + 1];
  const response = await fetch(process.env.FEISHU_FIXTURE_ORIGIN, { method: 'POST', body: JSON.stringify({ path, method, body }) });
  send(await response.json());
}

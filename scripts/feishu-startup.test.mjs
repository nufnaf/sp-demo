import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = process.env.FEISHU_PREVIEW_ORIGIN;
test('startup gates the desktop through authorization, failed preparation, retry and subsequent launch', { skip: !origin, timeout: 60000 }, async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
   window.syntropicDesktop = {
    ready: () => {},
    getComputerPermissions: async () => ({ supported: true, accessibility: sessionStorage.getItem('accessibility') === 'yes', screenRecording: sessionStorage.getItem('screenRecording') === 'yes', captureVerified: sessionStorage.getItem('screenRecording') === 'yes' && sessionStorage.getItem('capture') === 'yes', initializationComplete: sessionStorage.getItem('complete') === 'yes' }),
    completeInitialization: async value => {sessionStorage.setItem('complete',value?'yes':'no');return window.syntropicDesktop.getComputerPermissions();},
    requestComputerPermission: async kind => {
     if(kind==='screenRecording' && sessionStorage.getItem(kind)==='yes')sessionStorage.setItem('capture','yes');
     sessionStorage.setItem(kind, 'yes');
     return window.syntropicDesktop.getComputerPermissions();
    },
   };
  });
  let authenticated = false, prepCount = 0, fail = true;
  const actions = [];
  const opened = [];
  await page.exposeFunction('__recordOpened', url => { opened.push(url); });
  await page.addInitScript(() => {
   window.open = url => { window.__recordOpened(String(url)); return null; };
  });
  await page.route(`${origin}/api/apps/feishu`, async route => {
   if(route.request().method()==='GET') return route.fulfill({json:{installed:true,configured:true,authState:authenticated?'authenticated':'not_authenticated',authDetail:'',account:'体验者'}});
   const data=route.request().postDataJSON();
   if(data.action==='login_status') return route.fulfill({json:{state:authenticated?'succeeded':'pending'}});
   actions.push(data.action);
   if(data.action==='login')return route.fulfill({json:{kind:'login',flowId:'fixture',verificationUrl:'https://open.feishu.cn/fixture'}});
   if(data.action==='complete_login')authenticated=true;
   return route.fulfill({json:{started:true}});
  });
  await page.route(`${origin}/api/desktop/prepare`, async route=>{
   prepCount++;
   await new Promise(resolve=>setTimeout(resolve,300));
   return route.fulfill({status:fail?503:200,json:fail?{error:'网络暂时不可用'}:{ready:true}});
  });
  await page.goto(origin);
  await page.getByRole('button',{name:'连接飞书',exact:true}).waitFor();
  assert.equal(await page.locator('.agent-os-desktop').count(),0);
  await page.getByRole('button',{name:'连接飞书',exact:true}).click();
  await page.getByText('请在浏览器中继续').waitFor();
  await page.getByText('已完成 1 / 3').waitFor();
  assert.equal(prepCount,0,'normal preparation waits until all three tasks finish');
  await page.getByRole('button',{name:'打开辅助功能权限设置'}).click();
  await page.getByText('已完成 2 / 3').waitFor();
  await page.getByRole('button',{name:'打开屏幕录制权限设置'}).click();
  await page.getByRole('button',{name:'验证屏幕访问',exact:true}).waitFor();
  assert.equal(prepCount,0,'TCC grant alone is not capture readiness');
  await page.getByRole('button',{name:'验证屏幕访问',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'网络暂时不可用'}).waitFor();
  assert.equal(await page.locator('.feishu-startup').count(),0);
  assert.equal(await page.locator('.agent-os-desktop').count(),1);
  assert.equal(await page.getByRole('button',{name:'重新同步',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'重新授权',exact:true}).count(),0,'preparation/network failure must not ask for authorization');
  assert.equal(await page.locator('.agent-os-desktop').count(),1);
  assert.equal(prepCount,1);assert.deepEqual(actions,['login','complete_login']);
  assert.deepEqual(opened,['https://open.feishu.cn/fixture'],'connecting opens the Feishu page in the system browser');
  fail=false;
  await page.getByRole('button',{name:'重新同步',exact:true}).click();
  await page.locator('.agent-os-desktop').waitFor();
  assert.equal(prepCount,2);
  await page.reload();
  await page.locator('.agent-os-desktop').waitFor();
  assert.equal(await page.getByRole('heading',{name:'演示前的一次性准备'}).count(),0,'completed startup must not flash checklist');
  assert.equal(prepCount,3);
  assert.deepEqual(actions,['login','complete_login'],'subsequent launch does not authorize again');
  assert.equal(await page.locator('[data-nextjs-dialog]').count(),0);
  await page.evaluate(() => {sessionStorage.removeItem('screenRecording');sessionStorage.removeItem('capture');});
  await page.reload();
  await page.getByText('已完成 2 / 3').waitFor();
  assert.equal(await page.locator('.agent-os-desktop').count(),0,'revoked permission blocks next launch');
  await page.getByRole('button',{name:'打开屏幕录制权限设置'}).click();
  await page.getByRole('button',{name:'验证屏幕访问',exact:true}).click();
  await page.locator('.feishu-startup').waitFor({state:'detached'});
  assert.deepEqual(actions,['login','complete_login']);
 } finally { await browser.close(); }
});

test('browser preview never claims native grants, and permission denial stays at preparation', { skip: !origin, timeout: 30000 }, async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 try {
  const page = await browser.newPage();
  await page.route(`${origin}/api/apps/feishu`, route => route.fulfill({json:{installed:true,configured:true,authState:'authenticated',account:'体验者'}}));
  await page.route(`${origin}/api/desktop/prepare`, route => route.fulfill({json:{ready:true}}));
  await page.goto(origin);
  await page.getByText('已完成 1 / 3').waitFor();
  assert.equal(await page.getByText('在 macOS 系统设置中授权').count(),2);
  assert.equal(await page.getByRole('button',{name:'打开辅助功能权限设置'}).isDisabled(),true);
  assert.equal(await page.locator('.agent-os-desktop').count(),0);
  await page.addInitScript(() => {
   window.syntropicDesktop={ready:()=>{},
    getComputerPermissions:async()=>({supported:true,accessibility:false,screenRecording:false}),
    requestComputerPermission:async()=>({supported:true,accessibility:false,screenRecording:false})};
  });
  await page.reload();
  await page.getByRole('button',{name:'打开屏幕录制权限设置'}).click();
  await page.getByRole('status').filter({hasText:'开启后返回此处'}).waitFor();
  assert.equal(await page.locator('.agent-os-desktop').count(),0);
  assert.equal(await page.getByText('已完成 1 / 3').count(),1);
  assert.equal(await page.getByRole('button',{name:'打开屏幕录制权限设置'}).isEnabled(),true);
  await page.evaluate(() => {
   window.syntropicDesktop.getComputerPermissions = async () => {throw new Error('ipc failed');};
   window.dispatchEvent(new Event('focus'));
  });
  await page.getByRole('alert').filter({hasText:'暂时无法检查权限'}).waitFor();
  assert.equal(await page.locator('.agent-os-desktop').count(),0);
  await page.evaluate(() => {
   window.syntropicDesktop.getComputerPermissions=async()=>({supported:true,accessibility:true,screenRecording:true,captureVerified:true});
  });
  await page.getByRole('button',{name:'重新检查权限'}).click();
  await page.locator('.feishu-startup').waitFor({state:'detached'});
 } finally {await browser.close();}
});

test('re-authorization waits for this attempt despite a valid old account, including reload, failure and retry', {skip: !origin, timeout: 60000}, async () => {
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage();
  await page.addInitScript(()=>{window.open=()=>null;window.syntropicDesktop={ready:()=>{},getComputerPermissions:async()=>({supported:true,accessibility:true,screenRecording:true,captureVerified:true})};});
  let flow, result, prepared=0, allowPrepare=false, logins=0;
  await page.route(`${origin}/api/apps/feishu`,async route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{installed:true,configured:true,authState:'authenticated',account:'Old valid account',...(flow?{authorization:{flow,result}}:{})}});
   const {action}=route.request().postDataJSON();
   if(action==='login'){flow={kind:'login',flowId:`fixture-${++logins}`,verificationUrl:'https://open.feishu.cn/fixture'};result={state:'pending'};return route.fulfill({json:flow});}
   if(action==='login_status')return route.fulfill({json:result});
   if(action==='cancel'){flow=undefined;result=undefined;}
   return route.fulfill({json:{started:true}});
  });
  await page.route(`${origin}/api/desktop/prepare`,route=>{prepared++;return route.fulfill({status:allowPrepare?200:503,json:allowPrepare?{ready:true}:{error:'资料需要额外权限',requiresAuthorization:true}});});
  await page.goto(origin);
  await page.getByRole('alert').filter({hasText:'资料需要额外权限'}).waitFor();
  await page.getByRole('button',{name:'重新授权',exact:true}).click();
  await page.getByText('请在浏览器中继续',{exact:true}).waitFor();
  await page.waitForTimeout(3200);assert.equal(prepared,1,'old valid token must not complete new authorization');
  await page.reload();await page.getByText('请在浏览器中继续',{exact:true}).waitFor();
  await page.waitForTimeout(3200);assert.equal(prepared,1,'reload must resume pending authorization');
  result={state:'failed',message:'本次授权未包含全部请求的权限'};
  await page.getByRole('alert').filter({hasText:'本次授权未包含全部请求的权限'}).waitFor();
  assert.equal(prepared,1);
  await page.getByRole('button',{name:'重新授权',exact:true}).click();
  await page.getByText('请在浏览器中继续',{exact:true}).waitFor();
  await page.getByRole('button',{name:'取消连接',exact:true}).click();
  assert.equal(prepared,1);
  // Recreate a missing-permission result without completing a login.
  await page.reload();await page.getByRole('alert').filter({hasText:'资料需要额外权限'}).waitFor();
  await page.getByRole('button',{name:'重新授权',exact:true}).click();
  await page.getByText('请在浏览器中继续',{exact:true}).waitFor();
  const before=prepared;
  result={state:'succeeded'};allowPrepare=true;
  await page.locator('.feishu-startup').waitFor({state:'detached'});
  assert.equal(prepared,before+1);
 }finally{await browser.close();}
});

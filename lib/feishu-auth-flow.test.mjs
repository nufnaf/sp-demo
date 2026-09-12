import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createJiti } from 'jiti';
const api = await createJiti(import.meta.url).import('./feishu-cli.ts');
test('authorization completion tracks the current CLI run, reports failure and survives status reads', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'feishu-auth-test-'));
 const command = join(dir, 'cli'), control = join(dir, 'result');
 const prior = process.env.SYNTROPIC_FEISHU_CLI;
 await writeFile(command, `#!${process.execPath}\nconst fs=require('node:fs');
 if(process.argv.includes('--no-wait')){console.log(JSON.stringify({device_code:'fixture',verification_url:'https://open.feishu.cn/fixture'}));process.exit(0);}
 const timer=setInterval(()=>{if(!fs.existsSync(${JSON.stringify(control)}))return;
 const result=fs.readFileSync(${JSON.stringify(control)},'utf8');clearInterval(timer);
 if(!process.argv.includes('--json'))throw Error('completion must request structured output');
 const completed={event:'authorization_complete',user_open_id:'ou_fixture',scope:'docs:document.content:read',granted:['docs:document.content:read'],missing:[]};
 if(result==='success'){console.log(JSON.stringify(completed));process.exit(0);}
 if(result==='partial'){console.log(JSON.stringify({...completed,missing:['vc:meeting.realtime:read'],warning:{type:'missing_scope'}}));console.error('scope warning');process.exit(3);}
 if(result==='invalid'){console.log(JSON.stringify({event:'authorization_complete'}));process.exit(3);}
 if(result==='empty')process.exit(0);
 console.error(JSON.stringify({error:{subtype:'missing_scope'}}));process.exit(1);},25);`,{mode:0o700});
 process.env.SYNTROPIC_FEISHU_CLI=command;
 const settled=async id=>{for(let i=0;i<100;i++){const r=api.getFeishuLoginResult(id);if(r.state!=='pending')return r;await delay(25);}throw Error('fixture did not settle');};
 try {
  const first=await api.startFeishuLogin();api.completeFeishuLogin(first.flowId);
  assert.equal(api.getFeishuLoginResult(first.flowId).state,'pending');
  assert.throws(()=>api.assertFeishuAuthorizationComplete(),/本次飞书授权/);
  await writeFile(control,'failure');
  const failure=await settled(first.flowId);assert.equal(failure.state,'failed');assert.match(failure.message,/权限/);
  assert.equal(api.activeFeishuAuthorization().result.state,'failed');
  assert.throws(()=>api.assertFeishuAuthorizationComplete(),/权限/);
  await rm(control);
  const second=await api.startFeishuLogin();api.completeFeishuLogin(second.flowId);
  assert.notEqual(first.flowId,second.flowId);assert.equal(api.getFeishuLoginResult(first.flowId).state,'expired');
  api.completeFeishuLogin(second.flowId); // Duplicate requests share one poller.
  await writeFile(control,'success');assert.equal((await settled(second.flowId)).state,'succeeded');
  api.assertFeishuAuthorizationComplete();
  assert.equal(api.getFeishuLoginResult(second.flowId).state,'succeeded','terminal state retained for polling/reload');
  await writeFile(control,'partial');
  const partial=await api.startFeishuLogin();api.completeFeishuLogin(partial.flowId);
  assert.deepEqual(await settled(partial.flowId),{state:'succeeded',missingScopes:['vc:meeting.realtime:read']});
  api.assertFeishuAuthorizationComplete();
  for(const outcome of ['invalid','empty']){
   await writeFile(control,outcome);
   const invalid=await api.startFeishuLogin();api.completeFeishuLogin(invalid.flowId);
   assert.equal((await settled(invalid.flowId)).state,'failed','requires an explicit complete result for this flow');
   assert.throws(()=>api.assertFeishuAuthorizationComplete());
  }
  await rm(control);
  const third=await api.startFeishuLogin();api.completeFeishuLogin(third.flowId);api.cancelFeishuConfiguration();
  await delay(50);assert.equal(api.getFeishuLoginResult(third.flowId).state,'expired');
  assert.equal(api.activeFeishuAuthorization(),undefined);
 } finally {
  api.cancelFeishuConfiguration();
  if(prior===undefined)delete process.env.SYNTROPIC_FEISHU_CLI;else process.env.SYNTROPIC_FEISHU_CLI=prior;
  await rm(dir,{recursive:true,force:true});
 }
});

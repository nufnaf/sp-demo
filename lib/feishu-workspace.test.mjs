import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { prepareWorkspace } = await jiti.import('./feishu-workspace.ts');
const { FeishuUserError, cliData } = await jiti.import('./feishu-user-api.ts');
const { BUSINESS_SECTIONS } = await jiti.import('./feishu-business-template.ts');
const fullBody = BUSINESS_SECTIONS.flat().join('\n');
const { RECRUITING_JD_DEMO } = await jiti.import('./recruiting-jd-fixture.ts');
const { feishuEnvironment } = await jiti.import('./feishu-paths.ts');
function harness() {
 const state = {version:1,identity:'a'.repeat(64),nonce:'7e2fb9f0-5101-4823-987e-97f503cde965',account:'测试用户',consent:true,resources:{},ready:false};
 const records=[],calls=[],cloudFiles=[]; let calendar, space, wiki, failOnce, deny, body=fullBody;
 const command=async (identity,args)=>{
  assert.equal(identity,state.identity);calls.push(args);
  const opt=name=>args.includes(name)?JSON.parse(args[args.indexOf(name)+1]):{};
  const value=name=>args[args.indexOf(name)+1];
  const data=opt('--data'),params=opt('--params');
  const key=args.slice(0,3).join(' ');
  if(deny===key) throw new FeishuUserError('permission',false);
  let result;
  if(key==='drive files create_folder'){cloudFiles.push({token:'folder',type:'folder',name:data.name,parent:''});result={token:'folder'};}
  else if(key==='drive files list')result={files:cloudFiles.filter(f=>f.parent===params.folder_token),has_more:false};
  else if(args[0]==='docs'&&args[1]==='+create'){const id=value('--title')==='星流科技业务介绍'?'business':'weekly';cloudFiles.push({token:id,type:'docx',name:value('--title'),parent:value('--parent-token')});result={document:{document_id:id}};}
  else if(args[0]==='docs'&&args[1]==='+fetch')result={document:{revision_id:3,content:'<title id="title">星流科技业务介绍</title>'+RECRUITING_JD_DEMO.about.map((p,i)=>`<p id="block${i}">${p}</p>`).join('')}};
  else if(args[0]==='docs'&&args[1]==='+update'){assert.equal(value('--revision-id'),'3');assert.equal(value('--start-block-id'),'block0');assert.equal(value('--end-block-id'),'block1');body=fullBody;result={result:'success'};}
  else if(args[0]==='api'&&args[2].endsWith('/raw_content'))result={content:body};
  else if(key==='sheets spreadsheets create'){cloudFiles.push({token:'sheet',type:'sheet',name:data.title,parent:data.folder_token});result={spreadsheet:{spreadsheet_token:'sheet'}};}
  else if(args[2]==='/open-apis/bitable/v1/apps'){cloudFiles.push({token:'base',type:'bitable',name:data.name,parent:data.folder_token});result={app:{app_token:'base'}};}
  else if(key==='wiki spaces create'){assert(args.includes('--yes'));assert.equal(data.open_sharing,'closed');space={space_id:'space',...data};result={space};}
  else if(key==='wiki spaces list')result={items:[space],has_more:false};
  else if(key==='wiki nodes create'){wiki={node_token:'wiki',title:data.title};result={node:wiki};}
  else if(key==='wiki spaces get_node')result={node:{...wiki,space_id:'space'}};
  else if(key==='wiki nodes list')result={items:[wiki],has_more:false};
  else if(key==='calendar calendars create'){assert.equal(data.permissions,'private');calendar={calendar_id:'calendar',type:'shared',role:'owner',...data};result={calendar};}
  else if(key==='calendar calendars get')result={...calendar};
  else if(key==='calendar calendars list')result={calendar_list:[calendar],has_more:false};
  else throw Error(`Unexpected command ${key}`);
  if(failOnce===key){failOnce=undefined;throw new FeishuUserError('lost response',true);}
  return result;
 };
 const save=async s=>records.push(structuredClone(s));
 return {state,command,save,records,calls,cloudFiles,lose(key){failOnce=key;},deny(key){deny=key;},calendar(){return calendar},edit(content){body=content}};
}
test('first connection creates isolated real resource types; restarts preserve resources and edited body',async()=>{
 const h=harness();await prepareWorkspace(h.state,h.save,h.command);
 assert.equal(h.state.ready,true);assert.equal(h.state.resources.business,'business');assert.equal(h.state.resources.wiki,'wiki');
 assert(h.records.some(s=>s.pending==='business'&&!s.resources.business));
 const before=h.calls.length;h.edit('用户修改了业务介绍');await prepareWorkspace(h.state,h.save,h.command);
 assert(!h.calls.slice(before).some(a=>a.includes('create')||a.includes('+create')));
 assert(!h.calls.slice(before).some(a=>a[2]?.endsWith('/raw_content')));
 assert(h.calls.every(a=>!a.includes('primary')));
 assert(!h.calls.some(a=>a[2]?.endsWith('/subscribe')),'existing calendar must not require an extra subscription scope');
});
test('a lost creation reply is reconciled against the owned folder without replaying the create',async()=>{
 const h=harness();h.lose('docs +create --title');
 await assert.rejects(prepareWorkspace(h.state,h.save,h.command),/lost response/);
 assert.equal(h.state.pending,'business');assert.equal(h.state.resources.business,undefined);
 await prepareWorkspace(h.state,h.save,h.command);
 assert.equal(h.calls.filter(a=>a[0]==='docs'&&a[a.indexOf('--title')+1]==='星流科技业务介绍').length,1);
 assert.equal(h.state.ready,true);
});
test('calendar availability checks all pages and reports missing calendar without re-subscribing',async()=>{
 const h=harness();await prepareWorkspace(h.state,h.save,h.command);
 let pages=0;
 const paged=async(identity,args)=>{
  if(args.slice(0,3).join(' ')==='calendar calendars list'){
   pages++;
   const params=JSON.parse(args[args.indexOf('--params')+1]);
   if(!params.page_token)return {calendar_list:[],has_more:true,page_token:'next'};
   assert.equal(params.page_token,'next');
  }
  return h.command(identity,args);
 };
 await prepareWorkspace(h.state,h.save,paged);assert.equal(pages,2);
 const hidden=async(identity,args)=>args.slice(0,3).join(' ')==='calendar calendars list'?{calendar_list:[],has_more:false}:h.command(identity,args);
 await assert.rejects(prepareWorkspace(h.state,h.save,hidden),/日历列表/);
 assert(!h.calls.some(a=>a[2]?.endsWith('/subscribe')));
});
test('a rejected scope can be retried; ambiguous absent creations stay blocked',async()=>{
 const h=harness();h.deny('drive files create_folder');await assert.rejects(prepareWorkspace(h.state,h.save,h.command),/permission/);assert.equal(h.state.pending,undefined);
 h.deny(undefined);h.state.pending='folder';await assert.rejects(prepareWorkspace(h.state,h.save,h.command),/尚未确认/);
 assert.equal(h.calls.filter(a=>a[2]==='create_folder').length,1);
});
test('no consent, removed files and altered calendar ownership fail closed',async()=>{
 const h=harness();h.state.consent=false;await assert.rejects(prepareWorkspace(h.state,h.save,h.command),/连接飞书/);assert.equal(h.calls.length,0);
 h.state.consent=true;await prepareWorkspace(h.state,h.save,h.command);
 h.calendar().role='reader';await assert.rejects(prepareWorkspace(h.state,h.save,h.command),/所有者/);
 h.calendar().role='owner';h.calendar().permissions='public';await assert.rejects(prepareWorkspace(h.state,h.save,h.command),/可见范围/);
 h.calendar().permissions='private';h.calendar().calendar_id='different';await assert.rejects(prepareWorkspace(h.state,h.save,h.command),/不一致/);
 h.calendar().calendar_id='calendar';
 h.calendar().role='owner';h.cloudFiles.splice(h.cloudFiles.findIndex(f=>f.token==='business'),1);
 await assert.rejects(prepareWorkspace(h.state,h.save,h.command),/移动或删除/);
 assert.equal(h.calls.filter(a=>a[0]==='docs').length,2);
});
test('user environment never borrows global CLI credentials, token or profile; errors do not leak upstream text',()=>{
 const previous=process.env.LARKSUITE_CLI_APP_SECRET;process.env.LARKSUITE_CLI_APP_SECRET='must-not-leak';
 try{const env=feishuEnvironment();assert.equal(env.LARKSUITE_CLI_APP_SECRET,undefined);assert(env.LARKSUITE_CLI_CONFIG_DIR.endsWith('/cli'));}finally{if(previous===undefined)delete process.env.LARKSUITE_CLI_APP_SECRET;else process.env.LARKSUITE_CLI_APP_SECRET=previous;}
 assert.throws(()=>cliData(JSON.stringify({ok:false,error:{message:'must-not-leak'}})),e=>!e.message.includes('must-not-leak')&&e.uncertain);
});

test('legacy two-paragraph introduction is upgraded once; user edits are preserved',async()=>{
 const h=harness();await prepareWorkspace(h.state,h.save,h.command);
 h.state.resources.businessVerified='1';h.edit('星流科技业务介绍\n'+RECRUITING_JD_DEMO.about.join('\n')+'\n');
 await prepareWorkspace(h.state,h.save,h.command);
 assert.equal(h.state.resources.businessVerified,'2');
 assert.equal(h.calls.filter(a=>a[1]==='+update').length,1);
 await prepareWorkspace(h.state,h.save,h.command);
 assert.equal(h.calls.filter(a=>a[1]==='+update').length,1);
 h.state.resources.businessVerified='1';h.edit('用户自己的业务介绍');
 await prepareWorkspace(h.state,h.save,h.command);
 assert.equal(h.calls.filter(a=>a[1]==='+update').length,1);
});
test('identical legacy text with extra rich content is not overwritten',async()=>{
 const h=harness();await prepareWorkspace(h.state,h.save,h.command);
 h.state.resources.businessVerified='1';h.edit(RECRUITING_JD_DEMO.about.join('\n'));
 const command=async(identity,args)=>{const result=await h.command(identity,args);if(args[1]==='+fetch')result.document.content+='<img token="userImage"/>';return result;};
 await prepareWorkspace(h.state,h.save,command);
 assert(!h.calls.some(a=>a[1]==='+update'));
});

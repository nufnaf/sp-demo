import test from 'node:test';import assert from 'node:assert/strict';
import {fork} from 'node:child_process';import {mkdtemp,copyFile,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {once} from 'node:events';
test('worker shares initialization, retains a paused task without viewers, and stop interrupts the pre-save handshake', {timeout:10000},async t=>{
 const root=await mkdtemp(join(tmpdir(),'computer-worker-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await copyFile(new URL('./worker.mjs',import.meta.url),join(root,'worker.mjs'));
 await writeFile(join(root,'driver.mjs'),`import {appendFile} from 'node:fs/promises';const log=v=>appendFile(process.env.TEST_LOG,v+'\\n');export class ComputerUseDriver{static async create(){await log('created');await new Promise(r=>setTimeout(r,30));return new ComputerUseDriver()}async listWindows(){return[{title:'飞书',windowId:'1',bounds:{width:800}}]}async bind(){this.target={windowId:'1',title:'飞书'};this.liveCapture={frame:async()=>({image:{mimeType:'image/jpeg',dataBase64:'test'}})}}async previewFrame(){return this.liveCapture ? {...await this.liveCapture.frame(),windowId:this.target.windowId}:null}async unbind(){this.target=null;this.liveCapture=null;await log('unbound')}async close(){await log('closed')}}`);
 await writeFile(join(root,'calendar-agent.mjs'),`export async function runCalendarAgent({waitReady,beforeSubmit,signal}){await new Promise(r=>setTimeout(r,80));await waitReady();await beforeSubmit();signal.throwIfAborted();throw Error('Save must never be reached in this test')}`);
 const log=join(root,'lifecycle.txt');const child=fork(join(root,'worker.mjs'),{execArgv:[],env:{...process.env,TEST_LOG:log},stdio:['ignore','ignore','ignore','ipc']});t.after(()=>{if(child.connected)child.disconnect();if(child.exitCode===null)child.kill();});
 const messages=[];child.on('message',m=>messages.push(m));
 const wait=async predicate=>{const deadline=Date.now()+5000;while(Date.now()<deadline){const found=messages.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,10));}assert.fail(JSON.stringify(messages));};
 child.send({type:'view',enabled:true});child.send({type:'run',id:'test',draft:{},calendarName:'demo'});child.send({type:'pause'});
 await wait(m=>m.patch?.phase==='paused');child.send({type:'view',enabled:false});await new Promise(r=>setTimeout(r,100));
 assert(!messages.some(m=>m.type==='result'));assert(!String(await readFile(log)).includes('unbound'));
 child.send({type:'resume'});await wait(m=>m.type==='before-submit');child.send({type:'stop'});
 const result=await wait(m=>m.type==='result');assert.match(result.error,/已停止/);assert(messages.some(m=>m.patch?.phase==='stopped'));assert(!messages.some(m=>m.submitted));
 const exit=once(child,'exit');child.disconnect();await exit;
 const events=String(await readFile(log)).trim().split('\n');assert.equal(events.filter(v=>v==='created').length,1);assert(events.includes('unbound'));assert.equal(events.filter(v=>v==='closed').length,1);
});

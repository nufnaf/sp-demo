import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePresentationCalendar } from './prepare-presentation.mjs';
test('desktop preparation waits for confirmed remote initialization before ready', async()=>{
  let release, complete=false;
  const pending=new Promise(resolve=>{release=resolve;});
  const work=preparePresentationCalendar({root:'/demo-run',request:async(url,init)=>{
    assert.equal(url,'http://127.0.0.1:30141/api/desktop/prepare');assert.equal(init.method,'POST');assert.equal(init.headers.Origin,'http://127.0.0.1:30141');
    await pending;return Response.json({ready:true});
  }}).then(()=>{complete=true;});
  await Promise.resolve();assert.equal(complete,false);release();await work;assert.equal(complete,true);
});
test('ordinary Web skips preparation; network, permission and malformed success remain failures',async()=>{
  await preparePresentationCalendar({root:'',request:()=>{throw Error('should not call');}});
  for(const request of [async()=>{throw Error('secret upstream');},async()=>Response.json({error:'secret upstream'},{status:503}),async()=>Response.json({})]){
    await assert.rejects(preparePresentationCalendar({root:'/demo',request}),e=>e.message.includes('演示日程')&&!e.message.includes('secret'));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const {GET}=await createJiti(import.meta.url,{alias:{'@':root}}).import('./route.ts');
test('calendar endpoint rejects cross-site requests and invalid dates before accessing configuration',async()=>{
 const denied=await GET(new Request('http://localhost/api/apps/feishu/calendar',{headers:{host:'localhost',origin:'https://evil.example'}}));assert.equal(denied.status,403);
 for(const date of ['not-date','2026-02-30']) {
   const response=await GET(new Request(`http://localhost/api/apps/feishu/calendar?date=${date}`,{headers:{host:'localhost'}}));assert.equal(response.status,400);
 }
});

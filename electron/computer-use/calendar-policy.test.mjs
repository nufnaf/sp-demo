import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCalendarAction,participantSignature,selectedCalendar} from './calendar-policy.mjs';
const state={windowBounds:{x:100,y:100,width:400,height:400},screenshotWidth:800,screenshotHeight:800,elements:[
{role:'AXTextField',value:'',elementToken:'title'},
{role:'AXStaticText',value:'添加联系人、群或邮箱',elementToken:'invite',frame:{x:120,y:150,w:200,h:30}},
{role:'AXComboBox',elementToken:'contacts',frame:{x:120,y:150,w:200,h:30}},
{role:'AXStaticText',value:'2026年9月12日'},
{role:'AXTextArea',elementToken:'description'},
{role:'AXButton',label:'保存',elementToken:'save',frame:{x:400,y:450,w:60,h:30}}]};
test('calendar input refuses direct Save and participant clicks by token and scaled pixel coordinates',()=>{
 for(const action of [{elementToken:'save'},{elementToken:'invite'},{x:60,y:130},{x:650,y:730}])assert.throws(()=>assertCalendarAction(state,{kind:'click',...action}));
 assert.throws(()=>assertCalendarAction(state,{kind:'setValue',elementToken:'contacts',text:'person'}));
 assert.doesNotThrow(()=>assertCalendarAction(state,{kind:'setValue',elementToken:'description',text:'Names in description only'}));
});
test('only the selected calendar field qualifies, not sidebar text or an unselected picker option',()=>{
 const label={role:'AXStaticText',value:'团队日历',parentIndex:'form'};
 const form={elements:[label,{role:'AXComboBox',parentIndex:'form'},{role:'AXButton',label:'保存'}]};
 assert(selectedCalendar(form,'团队日历'));
 assert(!selectedCalendar({elements:[label]},'团队日历'));
 assert(!selectedCalendar({elements:[{role:'AXButton',label:'保存'},label]},'团队日历'));
 assert(!selectedCalendar({elements:[...form.elements,label]},'团队日历'));
});
test('participant changes are detected independently of ephemeral tokens and position',()=>{
 const moved=structuredClone(state);for(const e of moved.elements){e.elementToken='new';delete e.frame;}assert.equal(participantSignature(moved),participantSignature(state));
 moved.elements.splice(2,0,{role:'AXStaticText',value:'实际参会人'});assert.notEqual(participantSignature(moved),participantSignature(state));
});

test('personal calendar name in the availability sidebar does not invalidate the selected form field',()=>{
 const name='刘星（星流科技HR）';
 const field={role:'AXStaticText',value:name,parentIndex:20,frame:{x:170,y:850,w:160,h:22}};
 const save={role:'AXButton',label:'保存',frame:{x:700,y:950,w:60,h:32}};
 const sidebar={role:'AXStaticText',value:name,parentIndex:120,frame:{x:820,y:180,w:160,h:22}};
 const elements=[field,{role:'AXComboBox',parentIndex:20},save,sidebar];
 assert(selectedCalendar({elements},name));
 assert(!selectedCalendar({elements},'另一个人的日历'));
 for(const patch of [{frame:undefined},{frame:{x:200,y:850,w:160,h:22}},{role:'AXMenuItem'}]) {
  assert(!selectedCalendar({elements:[...elements.slice(0,3),{...sidebar,...patch}]},name));
 }
 assert(!selectedCalendar({elements:[{...field,role:'AXMenuItem'},...elements.slice(1)]},name));
 assert(!selectedCalendar({elements:[field,{role:'AXComboBox',parentIndex:99},save]},name));
});

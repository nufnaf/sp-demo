import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDraft } from './draft-validation.mjs';

const expected = { title: '面试标准对齐', date: '2026年9月12日', times: ['14:00', '14:30'], description: '讨论评价标准。' };
function form() {
  const item = (role, value, x, y = 100) => ({ role, value, frame: { x, y, w: 40, h: 22 } });
  return { elements: [item('AXTextField', expected.title, 10, 20), item('AXStaticText', expected.date, 10),
    item('AXStaticText', '14:00', 150), item('AXStaticText', '14:30', 210), item('AXStaticText', expected.date, 300),
    item('AXStaticText', expected.description, 10, 300), { role: 'AXButton', label: '保存' }] };
}
test('accepts the committed unsaved form', () => assert.equal(validateDraft(form(), expected).passed, true));
test('rejects correct-looking values still in edit fields and unrelated timeline labels', () => {
  const state = form();
  state.elements[2].role = 'AXTextField';
  state.elements.push({ role: 'AXStaticText', value: '14:00', frame: { x: 600, y: 100, w: 40, h: 22 } });
  assert.equal(validateDraft(state, expected).passed, false);
});
test('rejects a hidden rich-text value without rendered form content', () => {
  const state = form();
  state.elements[5].role = 'AXTextArea';
  state.elements[5].frame.h = 2;
  assert.equal(validateDraft(state, expected).passed, false);
});

test('multi-paragraph descriptions require visible children of the same description editor', () => {
  const state = form();
  const description = '讨论评价标准。\n由 Syntropic 安排';
  state.elements.splice(5,1,
    {role:'AXTextArea',elementIndex:'91',value:description,frame:{x:10,y:300,w:300,h:100}},
    {role:'AXStaticText',parentIndex:'91',value:'讨论评价标准。',frame:{x:20,y:310,w:150,h:17}},
    {role:'AXStaticText',parentIndex:'91',value:'\u200b'},
    {role:'AXStaticText',parentIndex:'91',value:'由 Syntropic 安排',frame:{x:20,y:345,w:150,h:17}});
  assert(validateDraft(state,{...expected,description}).passed);
  for (const patch of [{parentIndex:'sidebar'}, {frame:undefined}, {value:'由另一个应用安排'}, {frame:{x:500,y:345,w:150,h:17}}]) {
    const changed=structuredClone(state);Object.assign(changed.elements[8],patch);
    assert(!validateDraft(changed,{...expected,description}).passed);
  }
  const hidden=structuredClone(state);hidden.elements.splice(6,3);
  assert(!validateDraft(hidden,{...expected,description}).passed);
});

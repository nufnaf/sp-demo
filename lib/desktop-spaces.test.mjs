import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialSpaces,addSpace,moveToSpace,removeSpace,restoreSpaces,spaceOf,focusSpaceWindow} from './desktop-spaces.ts';
test('moving a window changes only its desktop and keeps other windows on their original desktop',()=>{
 let s=initialSpaces();s=addSpace(s,'desktop-second');s=moveToSpace(s,'computer','desktop-second');
 assert.equal(spaceOf(s,'computer'),'desktop-second');assert.equal(spaceOf(s,'calendar'),'desktop-1');
 s=removeSpace(s,'desktop-second');assert.equal(spaceOf(s,'computer'),'desktop-1');assert.equal(s.active,'desktop-1');
});
test('invalid storage is discarded and a final desktop cannot be removed',()=>{
 assert.deepEqual(restoreSpaces({spaces:[]}),initialSpaces());assert.deepEqual(removeSpace(initialSpaces(),'desktop-1'),initialSpaces());
});
test('closing a window cannot move a fallback from another Space; explicitly opening it switches Spaces',()=>{
 let s=focusSpaceWindow(initialSpaces(),'calendar');s=addSpace(s,'desktop-second');s=focusSpaceWindow(s,'computer');
 assert.equal(focusSpaceWindow(s,'calendar',false),s);const opened=focusSpaceWindow(s,'calendar');
 assert.equal(opened.active,'desktop-1');assert.equal(spaceOf(opened,'computer'),'desktop-second');
});

test('opening and clicking the floating preview preserves the foreground app',()=>{
 let s=focusSpaceWindow(initialSpaces(),'browser');s=focusSpaceWindow(s,'insights');
 const preview=focusSpaceWindow(s,'computer');
 assert.equal(preview.fronts['desktop-1'],'insights');assert.equal(spaceOf(preview,'computer'),'desktop-1');
 assert.equal(focusSpaceWindow(preview,'computer'),preview);
 assert.equal(focusSpaceWindow(preview,'browser').fronts['desktop-1'],'browser');
});

test('moving and revealing PiP preserves each Space foreground, including an empty destination',()=>{
 let s=focusSpaceWindow(initialSpaces(),'insights');s=focusSpaceWindow(s,'computer');
 s=addSpace(s,'desktop-second');s=focusSpaceWindow(s,'calendar');
 s=moveToSpace(s,'computer','desktop-second');
 assert.deepEqual(s.fronts,{'desktop-1':'insights','desktop-second':'calendar'});
 s=focusSpaceWindow(s,'insights');s=focusSpaceWindow(s,'computer');
 assert.equal(s.active,'desktop-second');assert.equal(s.fronts[s.active],'calendar');
 s=addSpace(s,'desktop-empty');s=moveToSpace(s,'computer','desktop-empty');
 assert.equal(s.fronts['desktop-empty'],undefined);
 s=removeSpace(s,'desktop-empty');assert.equal(s.fronts['desktop-second'],'calendar');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

test('settings window remains opaque over changing desktop cards while General scrolls', async () => {
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
  await page.setContent(`<style>:root{--bg:#fff;--bg-panel:#f5f5f5;--border:#ddd;--text:#222}*{box-sizing:border-box}body{margin:0;background:#f00}</style><article class="agent-os-window agent-os-window-settings is-front" style="left:80px;top:80px;width:980px;height:640px"><header class="agent-os-window-bar"></header><div class="agent-os-window-body"><div class="agent-settings-app"><aside class="agent-settings-sidebar"></aside><main class="agent-settings-content"><section class="agent-settings-section-host"><div class="agent-settings-general">${Array.from({length:30},(_,i)=>`<section style="height:90px">Setting ${i}</section>`).join('')}</div></section></main></div></div></article>`);
  await page.addStyleTag({content:await readFile(process.env.SETTINGS_SCROLL_CSS || new URL('../components/AgentDesktop.css',import.meta.url),'utf8')});
  const win=page.locator('.agent-os-window-settings');
  await win.waitFor();
  await page.waitForTimeout(400);
  for(const dark of [false,true]) {
   await page.evaluate(dark=>{document.documentElement.style.setProperty('--bg',dark?'#202020':'#ffffff');document.documentElement.style.setProperty('--bg-panel',dark?'#303030':'#f5f5f5');},dark);
   let baseline;
   for(let i=0;i<12;i++) {
    await page.evaluate(i=>{document.body.style.background=i%2?'#00ff00':'#ff00ff';document.querySelector('.agent-settings-general').scrollTop=i%2?1700:0;},i);
    const box=await win.boundingBox();
    const image=await page.screenshot({clip:{x:box.x+20,y:box.y+16,width:100,height:5}});
    const pixels=await sharp(image).removeAlpha().raw().toBuffer();
    if(!baseline)baseline=pixels;
    assert.deepEqual(pixels,baseline,'scrolling must not reveal changing desktop colors through the window');
    assert.equal(await page.locator('.agent-settings-general').evaluate(el=>el.scrollTop),i%2?1700:0);
   }
  }
 } finally {await browser.close();}
});

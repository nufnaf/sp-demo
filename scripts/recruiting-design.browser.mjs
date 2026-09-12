/** Isolated browser coverage for the company redesign; never uses live business data.
 * Run: node scripts/recruiting-design.browser.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createJiti } from 'jiti';
import { createHandler } from '../apps/recruiting/src/handler.mjs';
import { FileStore } from '../apps/recruiting/src/store.mjs';

const root = await mkdtemp(join(tmpdir(), 'xingliu-design-check-'));
const stores = new Map();
const getStore = scope => {
  const key = scope || 'main';
  if (!stores.has(key)) stores.set(key, new FileStore(join(root, `${key}.json`)));
  return stores.get(key);
};
const { renderRecruitingJdDemo } = await createJiti(import.meta.url).import('../lib/recruiting-jd-demo-renderer.ts');
const jd = renderRecruitingJdDemo();
await writeFile(join(root, 'xingliu-jd.html'), jd);
const handler = createHandler(async scope => getStore(scope));
const server = createServer((req, res) => {
  if (req.url === '/jd-preview') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(jd); }
  return handler(req, res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|Refused to/.test(message.text())) errors.push(message.text()); });
page.setDefaultTimeout(10000);
let checked = 0;
const routes = ['/', '/jobs/ai-agent', '/candidates', '/reviews?finished=1&missing=1', '/candidates/NF-1001', '/jobs/new', '/settings', '/?q=no-matching-job', '/missing-page', '/jd-preview'];
async function submit(button) { await Promise.all([page.waitForNavigation(), button.click()]); }
async function noOverflow() {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `page overflow: ${page.url()}`);
}
// Composite translucent text over its actual ancestor backgrounds; test visible text.
async function textContrast() {
  return page.evaluate(() => {
    const rgba = value => {
      const values = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
      return [...values.slice(0, 3), values[3] ?? 1];
    };
    const blend = (front, back) => [...front.slice(0,3).map((c,i) => c * front[3] + back[i] * (1-front[3])), 1];
    const luminance = c => c.slice(0,3).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((s,x,i) => s + x * [.2126,.7152,.0722][i], 0);
    const issues = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim()) || el.closest('svg,script,style,option,select,[hidden]') || !el.checkVisibility()) continue;
      if (el.getBoundingClientRect().width === 0) continue;
      const style = getComputedStyle(el);
      const ancestors = []; for (let a = el; a; a = a.parentElement) ancestors.unshift(a);
      let bg = [255,255,255,1];
      for (const a of ancestors) bg = blend(rgba(getComputedStyle(a).backgroundColor), bg);
      const fg = blend(rgba(style.color), bg);
      const a = luminance(fg), b = luminance(bg);
      const ratio = (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5) - .03) issues.push({text: el.textContent.trim().slice(0,50),ratio: ratio.toFixed(2)});
    }
    return issues;
  });
}
try {
  for (const theme of process.env.DESIGN_FLOW_ONLY ? [] : ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(origin);
    await page.getByLabel('外观主题').selectOption('system');
    for (const width of [375,768,1440]) {
      await page.setViewportSize({width,height: width === 375 ? 812 : 1000});
      for (const route of routes) {
        await page.goto(origin + route);
        await noOverflow();
        assert.deepEqual(await textContrast(), [], `${theme}/${width}${route} contrast`);
        assert.ok(await page.locator('h1').count(), route);
        if (route === '/jd-preview') {
          const emphasis = await page.locator('.status').evaluate(el => ({
            text: getComputedStyle(el).color,
            dot: getComputedStyle(el.querySelector('i')).backgroundColor,
          }));
          const primary = theme === 'light' ? 'rgb(10, 102, 194)' : 'rgb(112, 181, 249)';
          assert.equal(emphasis.text, primary);
          assert.equal(emphasis.dot, primary);
        }
        if (route === '/') {
          assert.equal(await page.locator('.progress-track i').first().evaluate(el => getComputedStyle(el).backgroundColor),
            theme === 'light' ? 'rgb(10, 102, 194)' : 'rgb(112, 181, 249)');
        }
        if (route !== '/jd-preview') {
          assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
          assert.equal(await page.getByRole('link', {name:'系统设置', exact:true}).isVisible(), true);
          assert.equal(await page.locator('.brand-mark').evaluate(img => img.complete && img.naturalWidth > 0), true);
        }
        if (['/', '/candidates/NF-1001', '/jobs/new', '/jd-preview'].includes(route)) {
          const name = route === '/' ? 'jobs' : route.split('/').at(-1);
          await page.screenshot({path:join(root,`${name}-${theme}-${width}.png`),fullPage: false});
        }
        checked++;
      }
    }
  }
  if (checked) console.log(`PASS ${checked} page/theme/width combinations, text contrast and page overflow`);
  if (!process.env.DESIGN_VISUAL_ONLY) {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(origin);
  await page.getByLabel('外观主题').selectOption('light');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.emulateMedia({colorScheme:'dark'});
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.getByLabel('外观主题').selectOption('system');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.emulateMedia({colorScheme:'light'});
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className),'skip-link');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id),'main');
  await page.getByLabel('搜索职位', {exact:true}).fill('AI Agent');
  await submit(page.getByRole('button',{name:'搜索职位',exact:true}));
  assert.equal(await page.locator('.job-card').count(),1);
  await page.getByRole('link',{name:'查看职位',exact:false}).click();
  await page.getByRole('link',{name:'面试结束 · 待结论',exact:false}).click();
  assert.equal(await page.locator('.stage-strip [aria-current="true"]').count(),1);
  await page.goto(origin + '/reviews?finished=1&missing=1');
  await page.getByRole('link',{name:'清除',exact:true}).click();
  assert.equal(new URL(page.url()).pathname,'/reviews');
  // Draft and submit buttons share the same form. Enhancement must retain their distinct payloads.
  await page.goto(origin + '/candidates/NF-1001');
  assert.equal(await page.getByRole('button',{name:'保存招聘结论',exact:true}).count(),0);
  await page.getByLabel('团队面试评价意见',{exact:true}).fill('具备完整项目交付经验，能够解释关键技术取舍。');
  await submit(page.getByRole('button',{name:'保存团队面试草稿',exact:true}));
  assert.equal((await getStore().read()).data.applications.find(a=>a.id==='NF-1001').interviews[1].review.status,'draft');
  assert.equal(await page.getByRole('button',{name:'保存招聘结论',exact:true}).count(),0);
  await submit(page.getByRole('button',{name:'提交团队面试评价',exact:true}));
  assert.ok((await page.getByRole('alert').innerText()).includes('提交评价时必须选择明确结论'));
  assert.equal((await getStore().read()).data.applications.find(a=>a.id==='NF-1001').interviews[1].review.status,'draft');
  await page.getByRole('link',{name:'返回并读取最新数据',exact:true}).click();
  await page.getByRole('combobox',{name:'团队面试结论',exact:true}).selectOption('yes');
  await submit(page.getByRole('button',{name:'提交团队面试评价',exact:true}));
  assert.equal((await getStore().read()).data.applications.find(a=>a.id==='NF-1001').interviews[1].review.status,'submitted');
  await page.getByLabel('决策说明',{exact:true}).fill('所有面试评价已齐全，确认符合岗位要求。');
  await submit(page.getByRole('button',{name:'保存招聘结论',exact:true}));
  assert.equal((await getStore().read()).data.applications.find(a=>a.id==='NF-1001').decision,'passed');
  await page.reload();
  assert.ok((await page.locator('.candidate-heading').innerText()).includes('面试通过'));
  // Native validation blocks an incomplete submission, without a false loading state.
  await page.goto(origin + '/jobs/new');
  await page.getByRole('button',{name:'发布职位',exact:true}).click();
  assert.equal(await page.locator('[data-submitting]').count(),0);
  const jdText = '岗位介绍\n星流科技提供企业 Agent 研发与交付服务。\n职责：负责系统集成与评估。\n要求：能够交付可维护的应用。';
  await page.getByLabel('岗位名称',{exact:true}).fill('设计验收工程师');
  await page.getByLabel('岗位 JD',{exact:true}).fill(jdText);
  await submit(page.getByRole('button',{name:'发布职位',exact:true}));
  assert.ok((await page.locator('.notice.success').innerText()).includes('职位发布成功'));
  const newJobUrl = page.url();
  assert.equal(await page.locator('.job-description').innerText(),jdText);
  await page.reload();
  assert.equal(page.url(),newJobUrl);
  assert.equal((await getStore().read()).data.jobs.filter(j=>j.title==='设计验收工程师').length,1);
  await page.locator('.edit-job summary').click();
  await page.getByLabel('招聘目标（人）',{exact:true}).fill('8');
  await submit(page.getByRole('button',{name:'保存职位设置',exact:true}));
  assert.equal((await getStore().read()).data.jobs.find(j=>j.title==='设计验收工程师').target,8);
  // A stale page receives a readable conflict instead of overwriting another tab's changes.
  const other = await context.newPage();
  await other.goto(page.url());
  const store = getStore(); const before = await store.read();
  await store.update(before.revision,data=>data);
  await other.locator('.edit-job summary').click();
  await Promise.all([other.waitForNavigation(), other.getByRole('button',{name:'保存职位设置',exact:true}).click()]);
  assert.ok((await other.getByRole('alert').innerText()).includes('数据已被另一页面修改'));
  await other.close();
  // Verify scoped CSS, scripts and images and that actual form navigation keeps the run prefix.
  const prefix = `/demo/${'b'.repeat(32)}`;
  await page.goto(origin + prefix + '/jobs/new');
  assert.equal(await page.locator('script[src]').getAttribute('src'), prefix+'/ui.js');
  assert.equal(await page.locator('.brand-mark').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  await page.getByLabel('岗位名称',{exact:true}).fill('隔离轮次岗位');
  await page.getByLabel('岗位 JD',{exact:true}).fill(jdText);
  await submit(page.getByRole('button',{name:'发布职位',exact:true}));
  assert.ok(new URL(page.url()).pathname.startsWith(prefix + '/jobs/'));
  assert.equal((await getStore().read()).data.jobs.some(j=>j.title==='隔离轮次岗位'),false);
  // No JavaScript: theme falls back to the OS; native forms remain usable.
  const noScript = await browser.newContext({javaScriptEnabled:false,colorScheme:'dark'});
  const plain = await noScript.newPage();
  await plain.goto(origin + '/jobs/new');
  await plain.getByLabel('岗位名称',{exact:true}).fill('无脚本岗位');
  await plain.getByLabel('岗位 JD',{exact:true}).fill(jdText);
  await Promise.all([plain.waitForNavigation(),plain.getByRole('button',{name:'发布职位',exact:true}).click()]);
  assert.ok((await plain.locator('.notice.success').innerText()).includes('职位发布成功'));
  await noScript.close();
  // Blocked localStorage must not prevent form rendering or theme selection.
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => { Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}); });
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(origin);
  await blockedPage.getByLabel('外观主题').selectOption('dark');
  assert.equal(await blockedPage.locator('html').getAttribute('data-theme'),'dark');
  await blocked.close();
  // Export embeds its assets; no server requests or scripts are required.
  assert.doesNotMatch(jd, /<script|src="https?:/);
  assert.ok(jd.includes((await readFile(new URL('../public/icons/company-careers-logo.svg',import.meta.url))).toString('base64')));
  await page.goto(origin + '/jd-preview');
  await page.emulateMedia({media:'print',colorScheme:'dark'});
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  await page.emulateMedia({media:'screen',reducedMotion:'reduce'});
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).scrollBehavior),'auto');
  assert.deepEqual(errors,[]);
  console.log('PASS theme persistence, keyboard, filters, drafts, final decisions, publication, refresh, conflict, scoped runs, no-JS, blocked storage, offline JD, print and reduced motion');
  }
  console.log(`Artifacts: ${root}`);
} catch (error) {
  await page.screenshot({path:join(root,'failure.png')});
  console.error(`Failed at ${page.url()}; artifacts: ${root}`);
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

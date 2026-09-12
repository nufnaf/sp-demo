import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createJiti } from 'jiti';
const { extractRecruitingJd, recruitingPublicationTask } = await createJiti(import.meta.url).import('./recruiting-publication.ts');
const html = '<!doctype html><html><head><title>岗位介绍</title><style>hidden CSS</style></head><body><nav>导航</nav><h1>AI Agent 工程师</h1><section><p>星流科技 &amp; 工程团队</p><p>招聘 6 人，杭州 / 上海</p><ul><li>工具调用 &lt;评测&gt;</li><li>可靠性 &#x4e2d;&#25991;</li></ul></section><script>hidden script</script><button>下载</button></body></html>';
const norm = s => s.replace(/\s+/g, '');

test('HTML extraction preserves all JD text and decodes entities without executable or navigation content', () => {
  const result = extractRecruitingJd(html, 'jd.html');
  assert.equal(result.title, 'AI Agent 工程师');
  assert.equal(norm(result.text), 'AIAgent工程师星流科技&工程团队招聘6人，杭州/上海工具调用<评测>可靠性中文');
  assert.match(result.text, /工程团队\n招聘/);
  assert.equal(extractRecruitingJd('# 职位\n正文全文', 'jd.md').text, '# 职位\n正文全文');
  assert.throws(() => extractRecruitingJd('<body><style>only CSS</style></body>', 'jd.html'), /正文为空/);
  assert.throws(() => extractRecruitingJd('字'.repeat(9001), 'jd.txt'), /过长/);
});

test('tool reads current full artifact; rejects cross-workspace files, symlinks, invalid target and draft', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jd-reference-'));
  const cwd = join(root, 'workspace');
  await mkdir(cwd);
  const file = join(cwd, 'jd.html');
  const prior = process.env.SYNTROPIC_RECRUITING_URL;
  process.env.SYNTROPIC_RECRUITING_URL = 'http://127.0.0.1:30143';
  const urlFor = f => 'http://127.0.0.1:30143/jobs/new?draft=' + createHash('sha256').update(`${cwd}\n${f}`).digest('hex').slice(0, 32);
  try {
    await writeFile(file, html);
    const goal = await recruitingPublicationTask(cwd, urlFor(file), file);
    assert.ok(goal.includes('<jd-content>\n' + extractRecruitingJd(html, file).text + '\n</jd-content>'));
    assert.match(goal, /通过网页表单提交/);
    assert.match(goal, /不要使用业务 API/);
    await writeFile(file, html.replace('可靠性', '更新后的可靠性'));
    assert.match(await recruitingPublicationTask(cwd, urlFor(file), 'jd.html'), /更新后的可靠性/);
    await assert.rejects(recruitingPublicationTask(cwd, urlFor(file).replace('30143', '30144'), file), /已登记/);
    await assert.rejects(recruitingPublicationTask(cwd, urlFor(file).replace('/jobs/new', '/other'), file), /已登记/);
    await assert.rejects(recruitingPublicationTask(cwd, urlFor(file) + 'wrong', file), /发布标识/);
    const outside = join(root, 'outside.html');
    await writeFile(outside, html);
    await assert.rejects(recruitingPublicationTask(cwd, urlFor(outside), outside), /当前工作台/);
    const link = join(cwd, 'link.html');
    await symlink(outside, link);
    await assert.rejects(recruitingPublicationTask(cwd, urlFor(link), link), /以外/);
    await assert.rejects(recruitingPublicationTask(cwd, urlFor(file), 'missing.html'), /ENOENT/);
    await writeFile(file, '字'.repeat(9001));
    await assert.rejects(recruitingPublicationTask(cwd, urlFor(file), file), /过长/);
  } finally {
    if (prior === undefined) delete process.env.SYNTROPIC_RECRUITING_URL; else process.env.SYNTROPIC_RECRUITING_URL = prior;
    await rm(root, { recursive: true, force: true });
  }
});

test('presentation publication is bound to its run URL and cannot target another run or the legacy page', async () => {
  const { recruitingSiteUrl } = await createJiti(import.meta.url).import('./business-sites.ts');
  const root = await mkdtemp(join(tmpdir(), 'jd-scoped-'));
  const cwd = join(root, 'workspace'); await mkdir(cwd);
  const file = join(cwd, 'jd.html'); await writeFile(file, html);
  const beforeRoot = process.env.SYNTROPIC_PRESENTATION_ROOT;
  const beforeSite = process.env.SYNTROPIC_RECRUITING_URL;
  process.env.SYNTROPIC_PRESENTATION_ROOT = root;
  process.env.SYNTROPIC_RECRUITING_URL = 'https://recruiting.example.test';
  try {
    const base = recruitingSiteUrl(); assert.match(base.pathname,/^\/demo\/[a-f0-9]{32}\/$/);
    const url = new URL('jobs/new',base);
    url.searchParams.set('draft',createHash('sha256').update(`${cwd}\n${file}`).digest('hex').slice(0,32));
    assert.match(await recruitingPublicationTask(cwd,url.href,file),/完整文档内容/);
    const legacy = new URL(url); legacy.pathname='/jobs/new';
    await assert.rejects(recruitingPublicationTask(cwd,legacy.href,file),/已登记/);
    process.env.SYNTROPIC_PRESENTATION_ROOT=root+'-another-run';
    assert.notEqual(recruitingSiteUrl().pathname,base.pathname);
    await assert.rejects(recruitingPublicationTask(cwd,url.href,file),/已登记/);
  } finally {
    if (beforeRoot===undefined) delete process.env.SYNTROPIC_PRESENTATION_ROOT; else process.env.SYNTROPIC_PRESENTATION_ROOT=beforeRoot;
    if (beforeSite===undefined) delete process.env.SYNTROPIC_RECRUITING_URL; else process.env.SYNTROPIC_RECRUITING_URL=beforeSite;
    await rm(root,{recursive:true,force:true});
  }
});

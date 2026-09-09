import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { renderRecruitingJd, countRecruitingJdCharacters } = await jiti.import('./recruiting-jd-renderer.ts');
const { saveRecruitingJd, createRecruitingJdExtension } = await jiti.import('./recruiting-jd-extension.ts');
const { extractRecruitingJd } = await jiti.import('./browser/recruiting-publication.ts');
const content = { title: 'AI Agent 工程师', sections: [
  { heading: '公司背景', content: '星流科技研发企业 Agent 系统。\n这句话来自本次材料。' },
  { heading: '岗位信息', content: 'Agent 研发 · 杭州 / 上海 · 6 人\n薪资待确认' },
  { heading: '职责与要求', content: '工具调用、可靠性及 <script>alert("x")</script> 字面文本。\n保留 A & B 以及长中文正文。' },
] };

test('fixed HTML renders every generated section safely and preserves publication text', () => {
  const html = renderRecruitingJd(content);
  assert.match(html, /^<!doctype html>/);
  assert.doesNotMatch(html, /<script>/);
  const extracted = extractRecruitingJd(html, 'jd.html');
  assert.equal(extracted.title, content.title);
  const compact = text => text.replace(/\s+/g, '');
  for (const section of content.sections) assert.ok(compact(extracted.text).includes(compact(section.heading + section.content)));
  assert.throws(() => renderRecruitingJd({ title: '', sections: [] }));
});

test('combined character limit accepts 1200 and rejects 1201 without truncating', () => {
  const draft = { title: '岗位', sections: [
    { heading: '背景', content: '星流科技' },
    { heading: '信息', content: '杭州 / 上海 · 6 人\n' },
    { heading: '要求', content: '开发🧑' },
  ] };
  const base = countRecruitingJdCharacters(draft);
  draft.sections[2].content += '字'.repeat(1200 - base);
  assert.equal(countRecruitingJdCharacters(draft), 1200);
  assert.ok(renderRecruitingJd(draft).includes(draft.sections[2].content));
  draft.sections[2].content += '🧑';
  assert.equal(countRecruitingJdCharacters(draft), 1201);
  assert.throws(() => renderRecruitingJd(draft), /1201.*1200.*尚未写入/);
});

test('saving is scoped, verified, cancellation-safe and does not follow a destination symlink', async () => {
  const root = await mkdtemp(join(tmpdir(), 'jd-renderer-'));
  const previous = process.env.SYNTROPIC_PRESENTATION_ROOT;
  process.env.SYNTROPIC_PRESENTATION_ROOT = root;
  const cwd = join(root, 'workspace');
  await mkdir(cwd);
  try {
    const outside = join(root, 'keep.txt');
    await writeFile(outside, 'keep');
    await symlink(outside, join(cwd, 'ai-agent-engineer-jd.html'));
    const saved = await saveRecruitingJd(cwd, content);
    assert.equal(saved.verified, true);
    assert.equal(saved.characters, countRecruitingJdCharacters(content));
    await assert.rejects(saveRecruitingJd(cwd, {
      ...content, sections: content.sections.map(section => ({ ...section, content: '字'.repeat(500) })),
    }), /超过 1200/);
    assert.equal(await readFile(saved.path, 'utf8'), renderRecruitingJd(content));
    assert.equal(await readFile(outside, 'utf8'), 'keep');
    assert.equal(await readFile(saved.path, 'utf8'), renderRecruitingJd(content));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(saveRecruitingJd(cwd, { ...content, title: 'must not overwrite' }, controller.signal));
    assert.equal(await readFile(saved.path, 'utf8'), renderRecruitingJd(content));
    await assert.rejects(saveRecruitingJd(root, content), /招聘工作台/);
    assert.deepEqual(await readdir(cwd), ['ai-agent-engineer-jd.html']);
    const names = [];
    createRecruitingJdExtension(root).factory({ registerTool: tool => names.push(tool.name) });
    assert.deepEqual(names, []);
    createRecruitingJdExtension(cwd).factory({ registerTool: tool => names.push(tool.name) });
    assert.deepEqual(names, ['save_recruiting_jd']);
  } finally {
    if (previous === undefined) delete process.env.SYNTROPIC_PRESENTATION_ROOT; else process.env.SYNTROPIC_PRESENTATION_ROOT = previous;
    await rm(root, { recursive: true, force: true });
  }
});

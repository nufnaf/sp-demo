import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("./RecruitingPublication.tsx", import.meta.url), "utf8");
const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 });
const require = createRequire(import.meta.url);

// Exercise the component's effects and event handlers without business services.
function harness(saved = {}) {
  const slots = [], storage = new Map(), timers = new Map();
  let cursor = 0, dirty = false, effects = [], output;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { const next = typeof value === "function" ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; } }];
    },
    useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!deps || !previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
      }
    },
  };
  const artifact = { cwd: "/fixture", sessionId: "jd-session", filePath: "/fixture/engineer-jd.md", taskTitle: "生成岗位 JD" };
  const report = { cwd: "/fixture", sessionId: "report", filePath: "/fixture/report.html", title: "面试官评价标准不一致", summary: "5 位候选人的推进判断存在分歧。", modified: "2026-09-09" };
  storage.set("syntropic:notifications:/fixture", JSON.stringify(saved));
  const calls = [];
  const props = { cwd: "/fixture", notice: null, insights: [], browserTasks: [], viewedArtifact: null,
    onStartTask: async message => { calls.push(message); return "publication-session"; },
    onTaskStarted() {}, onPublished() {}, onSettled() {}, onNotice() {}, onDismissNotice() {},
    onOpenInsight: insight => calls.push(insight.filePath), children: value => ({ ...value, publicationInsight: value.widgetInsights.find(item => item.id.startsWith("publication:")) ?? null }),
  };
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, { module: testModule, exports: testModule.exports, TextEncoder, crypto: webcrypto, URL, AbortSignal,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    setTimeout: (fn, delay) => { const id = {}; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
    fetch: async url => ({ ok: true, json: async () => String(url).includes("/api/files/") ? { content: "# AI Agent 工程师\n岗位说明" } : String(url).includes("internal-recruiting") ? { baseUrl: "http://localhost" } : { tasks: [] } }),
    require: id => id === "react" ? react : id === "react/jsx-runtime" ? require(id) : id === "./DesktopNotification" ? { DesktopNotification() {} } : id.includes("file-paths") ? { encodeFilePathForApi: encodeURIComponent } : { isJdDemoArtifact: item => item.filePath.endsWith("jd.md"), publicationPrompt: (url, title, path) => `${url} ${title} ${path}` },
  });
  const render = () => {
    let count = 0;
    do {
      assert.ok(count++ < 20, "effects settle"); dirty = false; cursor = 0; effects = [];
      output = testModule.exports.RecruitingPublication(props);
      effects.forEach(fn => fn());
    } while (dirty);
    return output;
  };
  return { props, artifact, report, calls, storage, render,
    recognize() { props.viewedArtifact = artifact; render(); for (const [id, timer] of timers) if (timer.delay === 1400) { timers.delete(id); timer.fn(); } return render(); },
    async settle() { for (let i = 0; i < 10; i++) { await new Promise(resolve => setImmediate(resolve)); render(); } return output; },
  };
}

test("JD notification and desktop suggestion appear together with one publication action", () => {
  const h = harness();
  assert.equal(h.render().publicationInsight, null);
  const { notification, publicationInsight } = h.recognize();
  assert.ok(publicationInsight.detail.includes("岗位 JD 已准备好"));
  assert.equal(notification.props.action.onClick, publicationInsight.onOpen);
});

test("dismissing a JD notification preserves the widget and lets queued report notifications through, including after reload", () => {
  const h = harness(); h.props.insights = [h.report];
  h.recognize().notification.props.onDismiss();
  const surfaces = h.render();
  assert.ok(surfaces.publicationInsight);
  assert.equal(surfaces.widgetInsights[0].title, h.report.title);
  assert.equal(surfaces.widgetInsights[0].detail, h.report.summary);
  assert.equal(surfaces.notification.props.title, h.report.title);
  surfaces.notification.props.action.onClick();
  assert.deepEqual(h.calls, [h.report.filePath]);
  assert.equal(h.render().notification, null);
  assert.equal(h.props.insights.length, 1, "reading a report never removes it from the widget source");
  const restored = harness(JSON.parse(h.storage.get("syntropic:notifications:/fixture")));
  assert.ok(restored.render().publicationInsight);
  assert.equal(restored.render().notification, null);
});

test("the dismissed widget can publish and becomes disabled while that same publication is pending", async () => {
  const h = harness(); h.recognize().notification.props.onDismiss();
  h.render().publicationInsight.onOpen();
  const surfaces = await h.settle();
  assert.equal(h.calls.length, 1);
  assert.ok(h.calls[0].includes(h.artifact.filePath));
  assert.equal(surfaces.publicationInsight.disabled, true);
  assert.equal(surfaces.publicationInsight.actionLabel, "正在发布…");
});

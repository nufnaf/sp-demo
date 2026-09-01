import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");

test("new artifacts append independent full desktop windows without limiting their count", () => {
  assert.match(desktopSource, /const \[openArtifacts, setOpenArtifacts\] = useState<Artifact\[\]>\(\[\]\)/);
  assert.match(desktopSource, /const newlyGenerated = nextArtifacts\.filter/);
  assert.match(desktopSource, /return \[\.\.\.current, \.\.\.newlyGenerated\.filter/);
  assert.match(desktopSource, /openArtifacts\.map\(\(artifact, index\) =>/);
  assert.match(desktopSource, /key=\{identity\}/);
  assert.doesNotMatch(desktopSource, /slice\(0, ARTIFACT_DESKTOP_SLOTS/);
  assert.doesNotMatch(desktopSource, /DraggableArtifactPreview|agent-os-artifact-preview/);
});

test("closing a desktop window preserves the artifact in the library", () => {
  assert.match(desktopSource, /const remaining = openArtifacts\.filter/);
  assert.match(desktopSource, /setOpenArtifacts\(remaining\)/);
  assert.doesNotMatch(desktopSource, /setArtifacts\(\(current\) => current\.filter/);
  assert.match(desktopSource, /artifacts=\{artifacts\}/);
});

test("the Dock opens a flat artifact library with grid, list, and temporary Quick Look", () => {
  assert.match(desktopSource, /function ArtifactLibrary/);
  assert.match(desktopSource, /data-label="产物库"/);
  assert.match(desktopSource, /aria-label="Quick Look"/);
  assert.match(desktopSource, /useState<"grid" \| "list">\("grid"\)/);
  assert.match(desktopSource, /aria-label="图标视图"/);
  assert.match(desktopSource, /aria-label="列表视图"/);
  assert.match(desktopSource, /viewMode === "grid" && isHtmlArtifact\(artifact\) \? <FileViewer/);
  assert.match(desktopSource, /initialDisplayMode="preview"[\s\S]*?watchEnabled=\{false\}/);
  assert.match(desktopSource, /return <div[\s\S]*?role="option"[\s\S]*?tabIndex=\{0\}/);
  assert.doesNotMatch(desktopSource, /return <button[\s\S]*?role="option"/);
  assert.match(desktopSource, /<strong>名称<\/strong><span>最后修改时间<\/span><span>最后关联的任务<\/span>/);
  assert.match(desktopSource, /formatArtifactModified\(artifact\.modified\)/);
  assert.match(desktopSource, /agent-os-library-associated-task/);
  assert.match(desktopSource, /event\.code !== "Space"/);
  assert.match(desktopSource, /event\.key === "Escape"/);
  assert.match(desktopSource, /onDoubleClick=\{\(\) => onOpen\(artifact\)\}/);
  assert.match(desktopSource, /initialDisplayMode=\{isHtmlArtifact\(selected\) \? "preview" : undefined\}/);
  assert.match(cssSource, /\.agent-os-library-files\.is-grid/);
  assert.match(cssSource, /\.agent-os-library-file-icon\.has-preview iframe\{[^}]*transform:scale\(\.25\)/);
  assert.match(cssSource, /\.agent-os-library-files\.is-list/);
  assert.match(cssSource, /\.agent-os-library-quicklook \{[^}]*position:absolute/);
  assert.match(desktopSource, /startQuickLookDrag/);
  assert.match(desktopSource, /setPointerCapture\(event\.pointerId\)/);
  assert.match(cssSource, /\.agent-os-library-quicklook > header \{[^}]*cursor:grab[^}]*touch-action:none/);
});

test("file windows remain directly draggable and HTML opens in rendered preview", () => {
  assert.match(desktopSource, /kind="file"/);
  assert.match(desktopSource, /cascadeIndex=\{index\}/);
  assert.match(desktopSource, /initialDisplayMode=\{isHtmlArtifact\(artifact\) \? "preview" : undefined\}/);
  assert.match(desktopSource, /setPointerCapture\(event\.pointerId\)/);
  assert.match(cssSource, /\.agent-os-window-bar \{[^}]*cursor: grab[^}]*touch-action: none/);
  assert.match(cssSource, /\.agent-os-file-app \.file-viewer-toolbar \{ display:none!important \}/);
  assert.match(cssSource, /prefers-reduced-motion: reduce/);
  assert.match(cssSource, /prefers-reduced-transparency: reduce/);
  assert.match(cssSource, /prefers-contrast: more/);
});

test("desktop windows open centered in the work area with macOS-style file cascading", () => {
  assert.match(desktopSource, /useState<\{ x: number; y: number \} \| null>\(null\)/);
  assert.match(desktopSource, /const cascadeStep = kind === "file" \? cascadeIndex % 6 : 0/);
  assert.match(desktopSource, /translate: "-50% -50%"/);
  assert.match(desktopSource, /getBoundingClientRect\(\)/);
  assert.match(desktopSource, /windowRect\.left - layerRect\.left/);
  assert.match(desktopSource, /position[\s\S]*?translate: "none"[\s\S]*?: centeredPosition/);
  assert.match(cssSource, /\.agent-os-window-library \{ width: min\(900px, calc\(100vw - 180px\)\); height: min\(560px, calc\(100vh - 226px\)\); \}/);
  assert.match(cssSource, /\.agent-os-window-file \{ width: min\(960px, calc\(100vw - 220px\)\); height: min\(640px, calc\(100vh - 226px\)\); \}/);
  assert.match(cssSource, /translate: none !important/);
});

test("the Dock uses neutral controls, open indicators, and semantic badges", () => {
  assert.doesNotMatch(desktopSource, /updateDockMagnification|resetDockMagnification/);
  assert.match(desktopSource, /aria-label="产物库"/);
  assert.match(desktopSource, /dock-library\$\{artifactLibraryOpen \? " is-open" : ""\}/);
  assert.doesNotMatch(desktopSource, /artifacts\.length > 0 && <em>/);
  assert.match(cssSource, /\.agent-os-dock > button\.is-open::after/);
  assert.doesNotMatch(cssSource, /#c9f0db|#8ed8af|#d6f3e3|#9addba/);
  assert.doesNotMatch(cssSource, /--dock-scale|--dock-lift|--dock-shift/);
  assert.match(cssSource, /background: rgba\(255,255,255,\.48\)/);
  assert.match(cssSource, /\.agent-os-dock > button:focus-visible/);
});

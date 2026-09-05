"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { FileExplorer } from "./FileExplorer";
import { FileViewer } from "./FileViewer";
import { getFileIcon } from "./FileIcons";
import { encodeFilePathForApi, getFileName, getRelativeFilePath } from "@/lib/file-paths";
import { getFileExt, isAudioPath, isDocumentPreviewPath, isImagePath } from "@/lib/file-types";
import { useTheme } from "@/hooks/useTheme";
import type { FileOpenRequest } from "@/lib/files-app/types";
import "./FilesApp.css";

interface FilesAppProps {
  cwd: string;
  openRequest?: FileOpenRequest | null;
  onDirtyChange?: (dirty: boolean) => void;
}

interface CodeFileData {
  content: string;
  language: string;
  size: number;
  revision: string;
  modified: string;
}

interface CodeTab {
  filePath: string;
  name: string;
  content: string;
  savedContent: string;
  language: string;
  revision: string;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  conflict: boolean;
  error: string | null;
  view: "code" | "preview";
  reveal?: { line: number; column: number; nonce: number };
}

function fileUrl(filePath: string, type: "read" | "watch"): string {
  return `/api/files/${encodeFilePathForApi(filePath)}?type=${type}`;
}

function isPreviewOnly(filePath: string): boolean {
  return isImagePath(filePath) || isAudioPath(filePath) || isDocumentPreviewPath(filePath);
}

function supportsPreview(filePath: string): boolean {
  return ["html", "htm", "md", "markdown", "svg"].includes(getFileExt(filePath));
}

function FileBreadcrumb({ filePath, cwd }: { filePath: string; cwd: string }) {
  const pathParts = getRelativeFilePath(filePath, cwd).split(/[\\/]+/).filter(Boolean);
  const segments = [getFileName(cwd), ...pathParts];
  return (
    <nav className="agent-file-breadcrumb" aria-label="文件路径" title={filePath}>
      {segments.map((segment, index) => <span key={`${index}:${segment}`}>
        {index > 0 ? <i aria-hidden="true">›</i> : null}
        <em aria-current={index === segments.length - 1 ? "page" : undefined}>{segment}</em>
      </span>)}
    </nav>
  );
}

async function loadTextFile(filePath: string): Promise<CodeFileData> {
  const response = await fetch(fileUrl(filePath, "read"), { cache: "no-store" });
  const body = await response.json() as CodeFileData & { error?: string };
  if (!response.ok || body.error) throw new Error(body.error ?? `读取文件失败（HTTP ${response.status}）`);
  return body;
}

function languageExtension(language: string, filePath: string) {
  if (language === "typescript") return javascript({ typescript: true, jsx: /\.tsx$/i.test(filePath) });
  if (language === "javascript") return javascript({ jsx: /\.jsx$/i.test(filePath) });
  if (language === "html") return html();
  if (language === "css") return css();
  if (language === "json") return json();
  if (language === "markdown") return markdown();
  if (language === "python") return python();
  return [];
}

function CodeEditor({
  tab,
  onChange,
  onSave,
  onCursorChange,
}: {
  tab: CodeTab;
  onChange: (content: string) => void;
  onSave: () => void;
  onCursorChange: (line: number, column: number) => void;
}) {
  const { isDark } = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onCursorChangeRef = useRef(onCursorChange);
  const applyingContentRef = useRef(false);
  const initialContentRef = useRef(tab.content);
  const initialPathRef = useRef(tab.filePath);
  if (initialPathRef.current !== tab.filePath) {
    initialPathRef.current = tab.filePath;
    initialContentRef.current = tab.content;
  }
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onCursorChangeRef.current = onCursorChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const theme = EditorView.theme({
      "&": { height: "100%", color: "var(--text)", backgroundColor: "var(--bg)" },
      ".cm-content": { fontFamily: "var(--font-mono)", fontSize: "12px", caretColor: "var(--accent)" },
      ".cm-scroller": { overflow: "auto" },
      ".cm-gutters": { backgroundColor: "var(--bg-panel)", color: "var(--text-dim)", border: "none" },
      ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--accent) 7%, transparent)" },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)" },
      ".cm-cursor": { borderLeftColor: "var(--accent)" },
    }, { dark: isDark });
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialContentRef.current,
        extensions: [
          basicSetup,
          languageExtension(tab.language, tab.filePath),
          ...(isDark ? [oneDark] : []),
          theme,
          keymap.of([
            { key: "Mod-s", preventDefault: true, run: () => { onSaveRef.current(); return true; } },
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !applyingContentRef.current) onChangeRef.current(update.state.doc.toString());
            if (update.docChanged || update.selectionSet) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              onCursorChangeRef.current(line.number, head - line.from + 1);
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    onCursorChangeRef.current(line.number, head - line.from + 1);
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isDark, tab.filePath, tab.language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === tab.content) return;
    applyingContentRef.current = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: tab.content } });
    applyingContentRef.current = false;
  }, [tab.content]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !tab.reveal) return;
    const targetLine = view.state.doc.line(Math.min(tab.reveal.line, view.state.doc.lines));
    const position = Math.min(targetLine.to, targetLine.from + Math.max(0, tab.reveal.column - 1));
    view.dispatch({
      selection: { anchor: position },
      effects: EditorView.scrollIntoView(position, { y: "center" }),
    });
    view.focus();
  }, [tab.reveal]);

  return <div className="agent-code-editor" ref={hostRef}/>;
}

export function FilesApp({ cwd, openRequest, onDirtyChange }: FilesAppProps) {
  const [tabs, setTabs] = useState<CodeTab[]>([]);
  const tabsRef = useRef(tabs);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [refreshKey, setRefreshKey] = useState(0);
  tabsRef.current = tabs;

  const hasDirtyTabs = tabs.some((tab) => tab.dirty);
  useEffect(() => onDirtyChange?.(hasDirtyTabs), [hasDirtyTabs, onDirtyChange]);
  useEffect(() => {
    if (!hasDirtyTabs) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasDirtyTabs]);

  const updateTab = useCallback((filePath: string, update: Partial<CodeTab> | ((tab: CodeTab) => Partial<CodeTab>)) => {
    setTabs((current) => {
      const next = current.map((tab) => tab.filePath === filePath
        ? { ...tab, ...(typeof update === "function" ? update(tab) : update) }
        : tab);
      tabsRef.current = next;
      return next;
    });
  }, []);

  const reloadFile = useCallback(async (filePath: string) => {
    try {
      const data = await loadTextFile(filePath);
      updateTab(filePath, {
        content: data.content,
        savedContent: data.content,
        language: data.language,
        revision: data.revision,
        loading: false,
        dirty: false,
        conflict: false,
        error: null,
      });
    } catch (error) {
      updateTab(filePath, { loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  }, [updateTab]);

  const openFile = useCallback((filePath: string, name = getFileName(filePath), line?: number, column = 1) => {
    setTabs((current) => {
      const existing = current.find((tab) => tab.filePath === filePath);
      if (existing) return line
        ? current.map((tab) => tab.filePath === filePath ? { ...tab, reveal: { line, column, nonce: Date.now() } } : tab)
        : current;
      const previewOnly = isPreviewOnly(filePath);
      return [...current, {
        filePath,
        name,
        content: "",
        savedContent: "",
        language: "text",
        revision: "",
        loading: !previewOnly,
        saving: false,
        dirty: false,
        conflict: false,
        error: null,
        view: previewOnly ? "preview" : "code",
        ...(line ? { reveal: { line, column, nonce: Date.now() } } : {}),
      }];
    });
    setActivePath(filePath);
    if (!isPreviewOnly(filePath) && !tabsRef.current.some((tab) => tab.filePath === filePath)) void reloadFile(filePath);
  }, [reloadFile]);

  useEffect(() => {
    if (!openRequest || openRequest.cwd !== cwd) return;
    openFile(openRequest.filePath, getFileName(openRequest.filePath), openRequest.line, openRequest.column);
  }, [cwd, openFile, openRequest]);

  useEffect(() => {
    if (!activePath || isPreviewOnly(activePath)) return;
    const source = new EventSource(fileUrl(activePath, "watch"));
    const handleChange = () => {
      const tab = tabsRef.current.find((item) => item.filePath === activePath);
      if (!tab || tab.saving) return;
      if (tab.dirty) updateTab(activePath, { conflict: true });
      else void reloadFile(activePath);
      setRefreshKey((value) => value + 1);
    };
    source.addEventListener("change", handleChange);
    return () => source.close();
  }, [activePath, reloadFile, updateTab]);

  const activeTab = useMemo(() => tabs.find((tab) => tab.filePath === activePath) ?? null, [activePath, tabs]);

  const saveFile = useCallback(async (filePath: string, force = false) => {
    const tab = tabsRef.current.find((item) => item.filePath === filePath);
    if (!tab || tab.loading || tab.saving || !tab.dirty) return;
    updateTab(filePath, { saving: true, error: null });
    try {
      const response = await fetch(`/api/files/${encodeFilePathForApi(filePath)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: tab.content, expectedRevision: tab.revision, ...(force ? { force: true } : {}) }),
      });
      const body = await response.json() as { revision?: string; conflict?: boolean; error?: string };
      if (response.status === 409 || body.conflict) {
        updateTab(filePath, { saving: false, conflict: true });
        return;
      }
      if (!response.ok || !body.revision) throw new Error(body.error ?? `保存失败（HTTP ${response.status}）`);
      updateTab(filePath, (current) => ({
        revision: body.revision!,
        savedContent: tab.content,
        dirty: current.content !== tab.content,
        conflict: false,
        saving: false,
      }));
      setRefreshKey((value) => value + 1);
    } catch (error) {
      updateTab(filePath, { saving: false, error: error instanceof Error ? error.message : String(error) });
    }
  }, [updateTab]);

  const closeTab = useCallback((filePath: string) => {
    const tab = tabsRef.current.find((item) => item.filePath === filePath);
    if (tab?.dirty && !window.confirm(`${tab.name} 有未保存的修改，确定关闭吗？`)) return;
    setTabs((current) => {
      const index = current.findIndex((item) => item.filePath === filePath);
      const next = current.filter((item) => item.filePath !== filePath);
      if (activePath === filePath) setActivePath(next[Math.min(index, next.length - 1)]?.filePath ?? null);
      return next;
    });
  }, [activePath]);

  return (
    <div className={`agent-code-app${sidebarOpen ? "" : " sidebar-closed"}`}>
      <aside className={sidebarOpen ? "is-open" : ""}>
        <header>
          <strong>{getFileName(cwd)}</strong>
        </header>
        <div className="agent-code-files">
          <FileExplorer
            cwd={cwd}
            onOpenFile={(filePath, name) => openFile(filePath, name)}
            refreshKey={refreshKey}
            changesCollapsed
            fileSearchOpen
          />
        </div>
      </aside>

      <main>
        <header className="agent-code-toolbar">
          <button type="button" onClick={() => setSidebarOpen((value) => !value)} title={sidebarOpen ? "隐藏文件树" : "显示文件树"}>☰</button>
          <div className="agent-code-tabs" role="tablist" aria-label="打开的文件">
            {tabs.map((tab) => <div role="tab" tabIndex={0} aria-selected={tab.filePath === activePath} key={tab.filePath} className={tab.filePath === activePath ? "active" : ""} onClick={() => setActivePath(tab.filePath)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setActivePath(tab.filePath); }} title={tab.filePath}>
              <span>{getFileIcon(tab.name, 13)}</span><em>{tab.name}</em>{tab.dirty ? <i/> : null}
              <button type="button" aria-label={`关闭 ${tab.name}`} onClick={(event) => { event.stopPropagation(); closeTab(tab.filePath); }}>×</button>
            </div>)}
          </div>
        </header>

        <section className="agent-code-content">
          {!activeTab ? <div className="agent-code-empty"><span>⌘</span><strong>打开一个文件开始查看或编辑</strong><small>左侧展示当前工作台的文件，Agent 也可以帮你打开文件并定位内容。</small></div> : null}
          {activeTab?.loading ? <div className="agent-code-empty"><strong>正在读取文件…</strong></div> : null}
          {activeTab?.error ? <div className="agent-code-empty is-error"><strong>{activeTab.error}</strong><button type="button" onClick={() => void reloadFile(activeTab.filePath)}>重试</button></div> : null}
          {activeTab && !activeTab.loading && !activeTab.error ? <>
            {!isPreviewOnly(activeTab.filePath) ? <div className="agent-file-detail-toolbar">
              <FileBreadcrumb filePath={activeTab.filePath} cwd={cwd}/>
              {supportsPreview(activeTab.filePath) ? <div className="agent-file-mode-switch" aria-label="文件显示方式">
                <button type="button" aria-pressed={activeTab.view === "code"} onClick={() => updateTab(activeTab.filePath, { view: "code" })}>代码</button>
                <button type="button" aria-pressed={activeTab.view === "preview"} disabled={activeTab.dirty} onClick={() => updateTab(activeTab.filePath, { view: "preview" })}>预览</button>
              </div> : null}
            </div> : null}
            <div className="agent-file-body">
              {isPreviewOnly(activeTab.filePath) || activeTab.view === "preview" ? (
                <FileViewer
                  key={`${activeTab.filePath}:${activeTab.revision}:${activeTab.view}`}
                  filePath={activeTab.filePath}
                  cwd={cwd}
                  initialDisplayMode="preview"
                  watchEnabled
                  gitRefreshKey={refreshKey}
                  onOpenFile={(filePath) => openFile(filePath)}
                />
              ) : (
                <CodeEditor
                  tab={activeTab}
                  onChange={(content) => updateTab(activeTab.filePath, { content, dirty: content !== activeTab.savedContent })}
                  onSave={() => void saveFile(activeTab.filePath)}
                  onCursorChange={(line, column) => setCursor({ line, column })}
                />
              )}
            </div>
          </> : null}
          {activeTab?.conflict ? <div className="agent-code-conflict" role="alert"><span>文件已被 Agent 或其他程序修改。</span><button type="button" onClick={() => void reloadFile(activeTab.filePath)}>重新载入</button><button type="button" onClick={() => void saveFile(activeTab.filePath, true)}>覆盖保存</button></div> : null}
        </section>

        <footer className="agent-code-status">
          <span>{activeTab ? getRelativeFilePath(activeTab.filePath, cwd) : "就绪"}</span>
          {activeTab && !isPreviewOnly(activeTab.filePath) ? <><span>{activeTab.saving ? "保存中…" : activeTab.dirty ? "未保存 · ⌘/Ctrl+S" : activeTab.language}</span><span>Ln {cursor.line}, Col {cursor.column}</span></> : null}
        </footer>
      </main>
    </div>
  );
}

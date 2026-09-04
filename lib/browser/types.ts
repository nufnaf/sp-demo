export type BrowserController = "shared";

export interface BrowserFocusState {
  editable: true;
  caret: { x: number; y: number; height: number } | null;
}

export interface BrowserPageState {
  pageId: string;
  taskSessionId: string | null;
  cwd: string;
  url: string;
  title: string;
  revision: number;
  loading: boolean;
  controller: BrowserController;
  viewport: { width: number; height: number };
  focus: BrowserFocusState | null;
  updatedAt: string;
}

export type BrowserSystemEvent =
  | { type: "browser.opened"; page: BrowserPageState; foreground: boolean }
  | { type: "browser.updated"; page: BrowserPageState }
  | { type: "browser.closed"; pageId: string; cwd: string };

export type BrowserAction =
  | { action: "click"; ref: string }
  | { action: "type"; ref: string; text: string }
  | { action: "select"; ref: string; value: string }
  | { action: "insert_text"; text: string }
  | { action: "press"; key: string; ref?: string }
  | { action: "scroll"; deltaX?: number; deltaY: number }
  | { action: "coordinate_click"; x: number; y: number };

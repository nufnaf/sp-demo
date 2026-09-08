export interface FileOpenRequest {
  type: "file.open";
  cwd: string;
  filePath: string;
  line?: number;
  column?: number;
  foreground: boolean;
}

export type FileSystemEvent = FileOpenRequest | { type: "insight.updated"; cwd: string };

import fs from "node:fs";
import path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type InlineExtension } from "@earendil-works/pi-coding-agent";
import { isPathWithinRoots } from "../path-security";
import { emitFileEvent } from "./events";

export const FILES_APP_EXTENSION_NAME = "pi-web-files-app";

function result(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    details: undefined,
    ...(isError ? { isError: true } : {}),
  };
}

export function createFilesAppExtension(): InlineExtension {
  return {
    name: FILES_APP_EXTENSION_NAME,
    hidden: true,
    factory(pi) {
      pi.registerTool(defineTool({
        name: "file_open",
        label: "Open file",
        description: "Open any workspace file in Syntropic's visible Files app and optionally reveal a line in text files. The user sees the same file while you continue to use the normal read/edit/write tools for file contents.",
        promptSnippet: "Open workspace files in the visible Syntropic Files app",
        parameters: Type.Object({
          path: Type.String({ description: "Workspace-relative or absolute file path." }),
          line: Type.Optional(Type.Number({ minimum: 1 })),
          column: Type.Optional(Type.Number({ minimum: 1 })),
          foreground: Type.Optional(Type.Boolean({ description: "Bring the Files app to the front. Defaults to true." })),
        }),
        async execute(_id, params, _signal, _update, ctx) {
          try {
            const filePath = path.resolve(ctx.cwd, params.path);
            const cwdRealPath = fs.realpathSync(ctx.cwd);
            const fileRealPath = fs.realpathSync(filePath);
            if (!isPathWithinRoots(fileRealPath, new Set([cwdRealPath]))) {
              return result("The requested file is outside the current workspace.", true);
            }
            if (!fs.statSync(fileRealPath).isFile()) return result("The requested path is not a file.", true);

            emitFileEvent({
              type: "file.open",
              cwd: ctx.cwd,
              filePath,
              ...(params.line ? { line: Math.floor(params.line) } : {}),
              ...(params.column ? { column: Math.floor(params.column) } : {}),
              foreground: params.foreground !== false,
            });
            return result(`Opened ${filePath}${params.line ? ` at line ${Math.floor(params.line)}` : ""}.`);
          } catch (error) {
            return result(error instanceof Error ? error.message : String(error), true);
          }
        },
      }));
    },
  };
}

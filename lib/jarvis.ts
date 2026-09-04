import { Type } from "@earendil-works/pi-ai";
import { defineTool, type InlineExtension } from "@earendil-works/pi-coding-agent";
import type { SessionEntry } from "./types";

/** Marks a session as the desktop's Jarvis conversation. */
export const JARVIS_META_TYPE = "pi-web:jarvis";
/** Marks a task session that Jarvis started. */
export const JARVIS_TASK_ORIGIN_TYPE = "pi-web:jarvis-task-origin";
/** Custom message delivered to Jarvis when one of its tasks finishes. */
export const JARVIS_TASK_NOTIFICATION_TYPE = "pi-web:jarvis-task-notification";
export const JARVIS_EXTENSION_NAME = "pi-web-jarvis";
export const JARVIS_TOOL_NAMES = ["start_task", "task_status", "steer_task", "abort_task", "list_tasks"] as const;
export const JARVIS_SESSION_NAME = "Jarvis";

export type JarvisTaskStatus = "running" | "completed" | "aborted";

export interface JarvisTaskInfo {
  sessionId: string;
  jarvisSessionId: string;
  description: string;
  status: JarvisTaskStatus;
  createdAt: string;
  completedAt?: string;
  /** Latest assistant text from the task session, trimmed for the voice assistant. */
  summary?: string;
}

/** Details attached to the batched task notification Jarvis receives. */
export interface JarvisTaskBatchDetails {
  kind: "pi-web:jarvis-task-batch";
  tasks: JarvisTaskDetails[];
}

/** Details attached to Jarvis tool results and task notifications. */
export interface JarvisTaskDetails {
  kind: "pi-web:jarvis-task";
  sessionId: string;
  description: string;
  status: JarvisTaskStatus;
  createdAt: string;
  completedAt?: string;
}

export interface JarvisMetadata {
  version: 1;
  createdAt: string;
}

export interface JarvisTaskOrigin {
  version: 1;
  jarvisSessionId: string;
  description: string;
  createdAt: string;
}

export interface JarvisRuntime {
  startTask(request: { jarvisSessionId: string; prompt: string; description: string }): Promise<JarvisTaskInfo>;
  getTask(jarvisSessionId: string, taskId: string): Promise<JarvisTaskInfo | null>;
  steerTask(jarvisSessionId: string, taskId: string, message: string): Promise<void>;
  abortTask(jarvisSessionId: string, taskId: string): Promise<void>;
  listTasks(jarvisSessionId: string): JarvisTaskInfo[];
}

const SUMMARY_MAX_CHARS = 2_000;

export function isJarvisSession(entries: readonly SessionEntry[]): boolean {
  return entries.some((entry) => entry.type === "custom" && entry.customType === JARVIS_META_TYPE);
}

export function readJarvisTaskOrigin(entries: readonly SessionEntry[]): JarvisTaskOrigin | null {
  for (const entry of entries) {
    if (entry.type !== "custom" || entry.customType !== JARVIS_TASK_ORIGIN_TYPE) continue;
    const data = entry.data as Partial<JarvisTaskOrigin> | undefined;
    if (data?.version === 1 && typeof data.jarvisSessionId === "string") {
      return {
        version: 1,
        jarvisSessionId: data.jarvisSessionId,
        description: typeof data.description === "string" ? data.description : "",
        createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      };
    }
  }
  return null;
}

export function jarvisTaskDetails(task: JarvisTaskInfo): JarvisTaskDetails {
  return {
    kind: "pi-web:jarvis-task",
    sessionId: task.sessionId,
    description: task.description,
    status: task.status,
    createdAt: task.createdAt,
    ...(task.completedAt ? { completedAt: task.completedAt } : {}),
  };
}

export function trimTaskSummary(text: string | undefined): string {
  const normalized = (text ?? "").trim();
  if (normalized.length <= SUMMARY_MAX_CHARS) return normalized;
  return `${normalized.slice(0, SUMMARY_MAX_CHARS).trimEnd()}…`;
}

const STATUS_TEXT: Record<JarvisTaskStatus, string> = {
  running: "还在进行中",
  completed: "已经完成",
  aborted: "已被停止",
};

export function jarvisTaskStatusText(task: JarvisTaskInfo): string {
  const head = `任务「${task.description}」${STATUS_TEXT[task.status]}（ID: ${task.sessionId}）。`;
  return task.summary ? `${head}\n最新回复：\n${task.summary}` : head;
}

const BATCH_SUMMARY_MAX_CHARS = 800;

/** One message for every task that settled since Jarvis last had a chance to report. */
export function jarvisTaskBatchMessage(tasks: readonly JarvisTaskInfo[]): { content: string; details: JarvisTaskBatchDetails } {
  const lines = tasks.map((task, index) => {
    const summary = task.summary && task.summary.length > BATCH_SUMMARY_MAX_CHARS
      ? `${task.summary.slice(0, BATCH_SUMMARY_MAX_CHARS).trimEnd()}…`
      : task.summary;
    const head = `${index + 1}. 任务「${task.description}」${STATUS_TEXT[task.status]}（ID: ${task.sessionId}）`;
    return summary ? `${head}\n结果：${summary}` : head;
  });
  const content = tasks.length === 1
    ? `[任务通知] ${lines[0].replace(/^1\. /, "")}`
    : `[任务通知] 有 ${tasks.length} 个任务有了结果：\n${lines.join("\n")}`;
  return { content, details: { kind: "pi-web:jarvis-task-batch", tasks: tasks.map(jarvisTaskDetails) } };
}

export function buildJarvisSystemPrompt(cwd: string): string {
  return [
    "你是 Jarvis，运行在 Agent OS 桌面里的常驻语音助手。用户主要通过语音和你交谈，你的每一句回复都会被朗读出来。",
    "",
    "说话方式：",
    "- 口语化、简短，通常一到三句话；重要信息放在最前面。",
    "- 不要使用 Markdown、标题、列表、代码块、链接或表情符号；数字、路径和命令尽量口语化地描述。",
    "- 不要复述用户的话，不要客套开场白。",
    "",
    "职责分工：",
    "- 你负责陪用户聊天、回答问题、帮用户把需求理清楚。",
    "- 一旦需要实际执行工作（写代码、改文件、查资料、处理文档、发邮件、安排日程等），就用 start_task 把任务交给后台的 Pi Agent，然后立刻告诉用户已经派出去了，并继续对话，不要等待任务结束。",
    "- 派任务时，prompt 要写成完整、自足的任务说明（目标、范围、约束、已知信息），description 是六到十二个字的任务名。同一件事不要重复派发；相互独立的事可以并行派多个任务。",
    "- 对于代价大或含义模糊的事（会改很多文件、对外发送、删除内容、你不确定用户到底要什么），先用一句话确认再派；小事直接派，不要啰嗦。",
    "- 任务进行中：用户问进度就用 task_status；用户改需求就用 steer_task；用户要停就用 abort_task；list_tasks 可以看全部任务。不要主动反复汇报进度。",
    "",
    "任务结果的汇报方式：",
    "- 任务完成后你会收到一条以「[任务通知]」开头的消息，可能一次包含多个任务。像同事汇报那样，把这些结果合并成一段话说完，先说结论，再说值得注意的点，通常两三句以内。",
    "- 如果通知里有失败、被停止或结果不符合预期的任务，直接说明并给出下一步建议。",
    "- 如果某个结果你已经通过 task_status 告诉过用户，通知来了只需一句话带过，或者不再重复。",
    "- 语音识别偶尔会把回声或噪音识别成几个字的碎片（比如「呈亮色」「哪里」）。听不懂时不要展开分析，用一句话轻轻确认，或者当作没听清等用户再说。",
    "- 细节、文件路径、代码等不要念，告诉用户可以在任务卡片里查看即可。",
    "",
    "拿不准的事直接问用户，不要臆测。",
    `当前工作目录：${cwd}`,
  ].join("\n");
}

function taskResult(text: string, task?: JarvisTaskInfo, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    details: task ? jarvisTaskDetails(task) : undefined,
    ...(isError ? { isError: true } : {}),
  };
}

function failure(error: unknown) {
  return taskResult(error instanceof Error ? error.message : String(error), undefined, true);
}

export function createJarvisExtension(runtime: JarvisRuntime): InlineExtension {
  return {
    name: JARVIS_EXTENSION_NAME,
    hidden: true,
    factory: (pi) => {
      pi.registerTool(defineTool({
        name: "start_task",
        label: "Start task",
        description: "Hand a piece of real work to a background Pi Agent session. Returns immediately with the task ID; you will receive a notification message when it finishes.",
        promptSnippet: "Delegate real work to a background Pi Agent task",
        promptGuidelines: [
          "Use start_task whenever the user needs something done rather than discussed.",
          "Write the prompt as a complete, self-contained brief.",
          "Never start the same task twice.",
        ],
        executionMode: "parallel",
        parameters: Type.Object({
          prompt: Type.String({ description: "The complete task brief for the Pi Agent." }),
          description: Type.String({ description: "Short task name shown in the UI, 6 to 12 characters." }),
        }),
        async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
          try {
            const task = await runtime.startTask({
              jarvisSessionId: ctx.sessionManager.getSessionId(),
              prompt: params.prompt,
              description: params.description,
            });
            return taskResult(`任务「${task.description}」已经在后台启动，ID: ${task.sessionId}。完成后你会收到通知。`, task);
          } catch (error) {
            return failure(error);
          }
        },
      }));

      pi.registerTool(defineTool({
        name: "task_status",
        label: "Task status",
        description: "Check the status and latest output of a task you started.",
        parameters: Type.Object({
          task_id: Type.String({ description: "Task ID returned by start_task." }),
        }),
        async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
          try {
            const task = await runtime.getTask(ctx.sessionManager.getSessionId(), params.task_id);
            if (!task) return taskResult(`没有找到任务 ${params.task_id}。`, undefined, true);
            return taskResult(jarvisTaskStatusText(task), task);
          } catch (error) {
            return failure(error);
          }
        },
      }));

      pi.registerTool(defineTool({
        name: "steer_task",
        label: "Steer task",
        description: "Send a new instruction to a running task, for example a changed requirement.",
        parameters: Type.Object({
          task_id: Type.String({ description: "Task ID returned by start_task." }),
          message: Type.String({ description: "Instruction for the task's Pi Agent." }),
        }),
        async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
          try {
            await runtime.steerTask(ctx.sessionManager.getSessionId(), params.task_id, params.message);
            return taskResult(`已经把新的指示转给任务 ${params.task_id}。`);
          } catch (error) {
            return failure(error);
          }
        },
      }));

      pi.registerTool(defineTool({
        name: "abort_task",
        label: "Abort task",
        description: "Stop a running task.",
        parameters: Type.Object({
          task_id: Type.String({ description: "Task ID returned by start_task." }),
        }),
        async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
          try {
            await runtime.abortTask(ctx.sessionManager.getSessionId(), params.task_id);
            return taskResult(`任务 ${params.task_id} 已经停止。`);
          } catch (error) {
            return failure(error);
          }
        },
      }));

      pi.registerTool(defineTool({
        name: "list_tasks",
        label: "List tasks",
        description: "List every task you started in this conversation with its status.",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
          const tasks = runtime.listTasks(ctx.sessionManager.getSessionId());
          if (!tasks.length) return taskResult("目前没有任何任务。");
          const lines = tasks.map((task) => `- ${task.description}（${STATUS_TEXT[task.status]}，ID: ${task.sessionId}）`);
          return taskResult(lines.join("\n"));
        },
      }));
    },
  };
}

const CODE_FENCE_RE = /```[\s\S]*?```/g;
const HTML_TAG_RE = /<[^>]+>/g;
const MARKDOWN_LINK_RE = /\[([^\]]+)]\([^)]*\)/g;
const MARKDOWN_PREFIX_RE = /^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm;
const TABLE_RULE_RE = /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/gm;

/** Turn an assistant answer into text that is safe and comfortable to read aloud. */
export function normalizeTextForSpeech(input: string, maxLength = 1_500): string {
  const normalized = input
    .replace(CODE_FENCE_RE, " 代码内容已显示在页面中。 ")
    .replace(MARKDOWN_LINK_RE, "$1")
    .replace(HTML_TAG_RE, " ")
    .replace(TABLE_RULE_RE, " ")
    .replace(MARKDOWN_PREFIX_RE, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/\|/g, "，")
    .replace(/https?:\/\/\S+/g, "链接")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, Math.max(0, maxLength - 9)).trimEnd();
  return `${clipped}。更多内容请查看页面。`;
}

export function isVoiceAbortCommand(input: string): boolean {
  const value = input.trim().replace(/[。！!，,]/g, "");
  return /^(停止|取消|停下来|别做了|终止任务|停止任务|cancel|stop)$/i.test(value);
}

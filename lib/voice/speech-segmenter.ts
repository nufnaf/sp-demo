import { normalizeTextForSpeech } from "./text";

export interface SpeechSegmenterOptions {
  /** Spoken in place of fenced code blocks. */
  codePlaceholder?: string;
  /** Maximum spoken characters per text source before the remainder is skipped. */
  maxChars?: number;
  /** Spoken once when `maxChars` is exceeded. */
  overflowNotice?: string;
}

export interface SpeechSegmenter {
  /**
   * Feed the full text seen so far. Returns sentences that became complete since
   * the previous call. A text that no longer extends the previous one starts a
   * new source: the pending remainder of the old source is flushed first.
   */
  push(fullText: string): string[];
  /** Emit whatever is still pending as a final sentence. */
  flush(): string[];
  reset(): void;
}

const SENTENCE_END_RE = /[。！？!?；;…]+["”’)）』」]*|\.(?=\s|$)|\n+/g;
const FENCE = "```";
const MIN_SENTENCE_CHARS = 2;

/**
 * Incrementally split streamed assistant text into speakable sentences while
 * skipping fenced code and keeping decimals, URLs, and partial fences intact.
 */
export function createSpeechSegmenter(options: SpeechSegmenterOptions = {}): SpeechSegmenter {
  const codePlaceholder = options.codePlaceholder ?? "代码内容已显示在页面中。";
  const maxChars = options.maxChars ?? 1_500;
  const overflowNotice = options.overflowNotice ?? "更多内容请查看页面。";

  let source = "";
  let cursor = 0;
  let spokenChars = 0;
  let overflowed = false;

  const finalize = (raw: string): string | null => {
    const text = normalizeTextForSpeech(raw, Number.POSITIVE_INFINITY);
    if (text.length < MIN_SENTENCE_CHARS && !/[\p{L}\p{N}]/u.test(text)) return null;
    if (!text) return null;
    if (overflowed) return null;
    if (spokenChars + text.length > maxChars) {
      overflowed = true;
      return overflowNotice;
    }
    spokenChars += text.length;
    return text;
  };

  const reset = () => {
    source = "";
    cursor = 0;
    spokenChars = 0;
    overflowed = false;
  };

  const scan = (allowTail: boolean): string[] => {
    const out: string[] = [];
    while (cursor < source.length) {
      const rest = source.slice(cursor);
      const fenceAt = rest.indexOf(FENCE);
      // A lone backtick run at the tail might grow into a fence; wait for more text.
      const tailTicks = /`{1,2}$/.exec(rest);
      const limit = fenceAt >= 0 ? fenceAt : (tailTicks && !allowTail ? rest.length - tailTicks[0].length : rest.length);
      const chunk = rest.slice(0, limit);
      SENTENCE_END_RE.lastIndex = 0;
      let consumed = 0;
      let match: RegExpExecArray | null;
      while ((match = SENTENCE_END_RE.exec(chunk))) {
        const end = match.index + match[0].length;
        const sentence = finalize(chunk.slice(consumed, end));
        consumed = end;
        if (sentence) out.push(sentence);
      }
      cursor += consumed;
      if (fenceAt >= 0 && consumed === limit) {
        const close = source.indexOf(FENCE, cursor + FENCE.length);
        if (close === -1) {
          if (!allowTail) return out;
          cursor = source.length;
          const sentence = finalize(codePlaceholder);
          if (sentence) out.push(sentence);
          return out;
        }
        cursor = close + FENCE.length;
        const sentence = finalize(codePlaceholder);
        if (sentence) out.push(sentence);
        continue;
      }
      if (fenceAt >= 0 && consumed < limit) {
        // Text before the fence that has no terminator yet: speak it before the code.
        const sentence = finalize(chunk.slice(consumed));
        cursor += limit - consumed;
        if (sentence) out.push(sentence);
        continue;
      }
      if (!allowTail) return out;
      const sentence = finalize(rest.slice(consumed));
      cursor = source.length;
      if (sentence) out.push(sentence);
      return out;
    }
    return out;
  };

  return {
    push(fullText) {
      if (fullText === source) return [];
      if (fullText.startsWith(source)) {
        source = fullText;
        return scan(false);
      }
      const flushed = scan(true);
      reset();
      source = fullText;
      return [...flushed, ...scan(false)];
    },
    flush() {
      return scan(true);
    },
    reset,
  };
}

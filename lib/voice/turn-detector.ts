export interface AsrUtteranceLike {
  text?: unknown;
  definite?: unknown;
  start_time?: unknown;
}

export interface AsrResultLike {
  text?: unknown;
  utterances?: unknown;
}

export interface TurnUpdate {
  /** Utterances that the recognizer finalized since the previous update. */
  committed: string[];
  /** Text of the utterance still being spoken, or an empty string. */
  partial: string;
  /** Whether the recognizer reports utterance boundaries at all. */
  hasUtterances: boolean;
}

export interface TurnTracker {
  update(result: AsrResultLike | null | undefined): TurnUpdate;
  /** Text-only recognizers: remember that this partial was already committed. */
  markCommitted(text: string): void;
}

function utterancesOf(result: AsrResultLike): Array<{ key: string; text: string; definite: boolean }> {
  if (!Array.isArray(result.utterances)) return [];
  return result.utterances
    .filter((item): item is AsrUtteranceLike => Boolean(item) && typeof item === "object")
    .map((item, index) => {
      const text = typeof item.text === "string" ? item.text.trim() : "";
      const start = typeof item.start_time === "number" ? item.start_time : null;
      return { key: start === null ? `${index}:${text}` : `${start}:${text}`, text, definite: item.definite === true };
    });
}

/**
 * Track streaming ASR results for one recognizer connection. Doubao reports the
 * whole connection's utterances on every message, marking finished ones as
 * `definite`; this tracker turns that into newly finished utterances plus the
 * live partial. Finished utterances are remembered by identity, so it does not
 * matter whether the recognizer keeps or drops them from later messages. When a
 * recognizer offers no utterances, the accumulated text minus what has been
 * committed is reported as the partial instead.
 */
export function createTurnTracker(): TurnTracker {
  const seen = new Set<string>();
  let committedText = "";

  return {
    update(result) {
      if (!result) return { committed: [], partial: "", hasUtterances: false };
      const utterances = utterancesOf(result);
      if (utterances.length) {
        const committed: string[] = [];
        for (const item of utterances) {
          if (!item.definite || seen.has(item.key)) continue;
          seen.add(item.key);
          if (item.text) committed.push(item.text);
        }
        const partial = utterances.filter((item) => !item.definite).map((item) => item.text).join("").trim();
        return { committed, partial, hasUtterances: true };
      }
      const text = typeof result.text === "string" ? result.text.trim() : "";
      const partial = text.startsWith(committedText) ? text.slice(committedText.length).trim() : text;
      return { committed: [], partial, hasUtterances: false };
    },
    markCommitted(text) {
      committedText = `${committedText}${text}`.trim();
    },
  };
}

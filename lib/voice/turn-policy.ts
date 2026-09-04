/**
 * End-of-turn judgement for finalized utterances. The recognizer finalizes at
 * every pause of half a second or so, which is far shorter than the pauses
 * people take mid-sentence, so the engine waits longer when an utterance
 * looks unfinished.
 */

const TERMINAL_RE = /[。！？!?]["”’)）』」]*$/;
/** Words a Chinese or English sentence rarely ends on; the speaker is mid-thought. */
const DANGLING_RE = /(再|帮我|给我|让我|请|然后|还有|另外|以及|和|跟|把|将|我想|我要|那个|这个|一个|and|or|the|to|of|with|please)$/i;
const MIN_COMPLETE_CHARS = 4;

export function looksCompleteUtterance(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const body = trimmed.replace(TERMINAL_RE, "");
  if (body.length < MIN_COMPLETE_CHARS) return false;
  if (DANGLING_RE.test(body)) return false;
  return TERMINAL_RE.test(trimmed);
}

export interface TurnWaitOptions {
  /** Wait after an utterance that reads as a finished sentence. */
  completeMs: number;
  /** Wait after an utterance that reads as unfinished. */
  incompleteMs: number;
}

export function turnWaitFor(text: string, options: TurnWaitOptions): number {
  return looksCompleteUtterance(text) ? options.completeMs : options.incompleteMs;
}

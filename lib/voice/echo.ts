/**
 * Text-level echo detection. Acoustic echo cancellation lets fragments of the
 * assistant's own speech leak into the recognizer; those fragments read like
 * pieces of what was just said, so recognized text that mostly overlaps the
 * recent speech is treated as echo rather than the user's words.
 */

const STRIP_RE = /[\s\p{P}\p{S}]+/gu;

export function normalizeForEcho(text: string): string {
  return text.replace(STRIP_RE, "").toLowerCase();
}

function bigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (let index = 0; index + 1 < text.length; index += 1) set.add(text.slice(index, index + 2));
  return set;
}

/**
 * Share of the candidate's character bigrams that also occur in the recently
 * spoken text, in the 0..1 range. Short candidates fall back to substring
 * matching because they have too few bigrams to score.
 */
export function echoOverlap(candidate: string, spoken: string): number {
  const text = normalizeForEcho(candidate);
  const reference = normalizeForEcho(spoken);
  if (!text || !reference) return 0;
  if (reference.includes(text)) return 1;
  if (text.length < 4) return 0;
  const referenceGrams = bigrams(reference);
  let hits = 0;
  let total = 0;
  for (const gram of bigrams(text)) {
    total += 1;
    if (referenceGrams.has(gram)) hits += 1;
  }
  return total ? hits / total : 0;
}

export const ECHO_OVERLAP_THRESHOLD = 0.6;

export function looksLikeEcho(candidate: string, spoken: string, threshold = ECHO_OVERLAP_THRESHOLD): boolean {
  return echoOverlap(candidate, spoken) >= threshold;
}

/** Keeps the last few seconds of spoken text for echo comparison. */
export function createSpokenTextWindow(maxChars = 600, ttlMs = 6_000) {
  const entries: Array<{ text: string; at: number }> = [];
  return {
    add(text: string, now = Date.now()) {
      entries.push({ text, at: now });
      while (entries.length > 1 && entries.reduce((sum, item) => sum + item.text.length, 0) > maxChars) entries.shift();
    },
    /** Text spoken recently, or still audible if `speaking` is true. */
    text(now = Date.now(), speaking = false): string {
      if (!speaking) {
        while (entries.length && now - entries[0].at > ttlMs) entries.shift();
      }
      return entries.map((item) => item.text).join("");
    },
    /** Mark the current moment as when speech stopped, so the window expires from here. */
    touch(now = Date.now()) {
      for (const entry of entries) entry.at = now;
    },
    clear() {
      entries.length = 0;
    },
  };
}

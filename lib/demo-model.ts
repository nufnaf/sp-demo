export const DEFAULT_DEMO_MODEL = { provider: "openai-codex", modelId: "gpt-5.6-luna", thinkingLevel: "low" } as const;
export const OPENROUTER_DEMO_MODEL = { provider: "openrouter", modelId: "openai/gpt-5.6-luna", thinkingLevel: "low" } as const;

/** Set only by the desktop launcher after preparing its isolated bundled credentials. */
export function readDemoModel() {
  if (process.env.SYNTROPIC_PRESENTATION_ROOT && process.env.SYNTROPIC_DEMO_DEEPSEEK_MODEL) {
    return { provider: "deepseek", modelId: process.env.SYNTROPIC_DEMO_DEEPSEEK_MODEL, thinkingLevel: "low" } as const;
  }
  return process.env.SYNTROPIC_DEMO_OPENROUTER === "1" && process.env.SYNTROPIC_PRESENTATION_ROOT
    ? OPENROUTER_DEMO_MODEL
    : DEFAULT_DEMO_MODEL;
}

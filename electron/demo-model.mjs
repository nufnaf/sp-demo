import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Also used by the packager. Errors deliberately omit file contents.
export async function readDemoApiKey(configPath) {
  let config;
  try { config = JSON.parse(await readFile(configPath, 'utf8')); }
  catch { throw new Error('无法读取 OpenRouter 演示配置，请提供有效的 .env.openrouter-demo.json。'); }
  if (typeof config?.apiKey !== 'string' || !config.apiKey.trim() || /\s/.test(config.apiKey.trim())) {
    throw new Error('OpenRouter 演示配置缺少有效 apiKey。');
  }
  return config.apiKey.trim();
}

export async function prepareDemoModelEnvironment({ configPath, presentationRoot }) {
  const key = await readDemoApiKey(configPath);
  const agentDir = join(presentationRoot, 'model-agent');
  await mkdir(agentDir, { recursive: true, mode: 0o700 });
  await writeFile(join(agentDir, 'auth.json'), JSON.stringify({ openrouter: { type: 'api_key', key } }), { mode: 0o600 });
  await writeFile(join(agentDir, 'settings.json'), JSON.stringify({
    defaultProvider: 'openrouter', defaultModel: 'openai/gpt-5.6-luna', defaultThinkingLevel: 'low',
    enabledModels: ['openrouter/openai/gpt-5.6-luna'],
  }), { mode: 0o600 });
  return { PI_CODING_AGENT_DIR: agentDir, SYNTROPIC_DEMO_OPENROUTER: '1' };
}

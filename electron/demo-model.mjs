import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Also used by the packager. Errors deliberately omit file contents.
export async function readDemoModelConfig(configPath, provider = 'openrouter') {
  if (!['openrouter', 'deepseek'].includes(provider)) throw new Error('不支持的模型服务。');
  const label = provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter';
  let config;
  try { config = JSON.parse(await readFile(configPath, 'utf8')); }
  catch { throw new Error(`无法读取 ${label} 模型服务配置，请联系管理员。`); }
  if (typeof config?.apiKey !== 'string' || !config.apiKey.trim() || /\s/.test(config.apiKey.trim())) {
    throw new Error(`${label} 模型服务缺少有效的 API 密钥。`);
  }
  const modelId = provider === 'deepseek' ? (config.modelId || 'deepseek-flash') : 'openai/gpt-5.6-luna';
  if (typeof modelId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9./_-]{0,127}$/.test(modelId)) {
    throw new Error(`${label} 模型配置无效。`);
  }
  return { apiKey: config.apiKey.trim(), modelId };
}

export async function readDemoApiKey(configPath) {
  return (await readDemoModelConfig(configPath)).apiKey;
}

export async function prepareDemoModelEnvironment({ configPath, presentationRoot, provider = 'openrouter' }) {
  const { apiKey: key, modelId } = await readDemoModelConfig(configPath, provider);
  const agentDir = join(presentationRoot, 'model-agent');
  await mkdir(agentDir, { recursive: true, mode: 0o700 });
  await writeFile(join(agentDir, 'auth.json'), JSON.stringify({ [provider]: { type: 'api_key', key } }), { mode: 0o600 });
  if (provider === 'deepseek') {
    // Register the official model even when the SDK's bundled catalog predates it.
    await writeFile(join(agentDir, 'models.json'), JSON.stringify({ providers: { deepseek: {
      baseUrl: 'https://api.deepseek.com', api: 'openai-completions',
      models: [{ id: modelId, name: 'DeepSeek V4.1 Flash', reasoning: true,
        input: ['text', 'image'], contextWindow: 1000000, maxTokens: 384000,
        thinkingLevelMap: { low: 'low', high: 'high', max: 'max' },
        compat: { supportsStore: false, supportsDeveloperRole: false, supportsStrictMode: false,
          maxTokensField: 'max_tokens', requiresReasoningContentOnAssistantMessages: true, thinkingFormat: 'deepseek' },
      }],
    } } }), { mode: 0o600 });
  }
  await writeFile(join(agentDir, 'settings.json'), JSON.stringify({
    defaultProvider: provider, defaultModel: modelId, defaultThinkingLevel: 'low',
    enabledModels: [`${provider}/${modelId}`],
  }), { mode: 0o600 });
  return { PI_CODING_AGENT_DIR: agentDir, ...(provider === 'deepseek'
    ? { SYNTROPIC_DEMO_DEEPSEEK_MODEL: modelId }
    : { SYNTROPIC_DEMO_OPENROUTER: '1' }) };
}

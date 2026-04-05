const fetch = require('node-fetch');
const { getSettingValue } = require('../db/queries/settings');
const localModelLifecycleService = require('./localModelLifecycleService');

const DEFAULT_LOCAL_MODEL = 'llama3.2:3b';

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getLocalConfig(db) {
  return {
    enabled: String(getSettingValue(db, 'ai_local_enabled', '0') || '0') === '1',
    mode: String(getSettingValue(db, 'ai_local_mode', 'managed_ollama') || 'managed_ollama').trim() || 'managed_ollama',
    baseUrl: localModelLifecycleService.getBaseUrl(db),
    defaultModel: String(getSettingValue(db, 'ai_local_default_model', DEFAULT_LOCAL_MODEL) || DEFAULT_LOCAL_MODEL).trim() || DEFAULT_LOCAL_MODEL,
  };
}

async function ensureConfigured(db, requestedModel = '') {
  const config = getLocalConfig(db);
  if (!config.enabled) {
    throw createError(400, 'Local AI runtime is disabled in Settings.');
  }
  const status = await localModelLifecycleService.detect(db);
  if (!status.health?.ok) {
    throw createError(503, 'Local AI runtime is not running or not healthy. Start it from Admin > System.');
  }
  const model = String(requestedModel || config.defaultModel || DEFAULT_LOCAL_MODEL).trim();
  if (!model) {
    throw createError(400, 'No local AI model is configured.');
  }
  const installedNames = new Set((status.models || []).map((entry) => entry.name));
  if (!installedNames.has(model)) {
    throw createError(503, `Local AI model "${model}" is not installed. Pull it from Admin > System first.`);
  }
  return {
    ...config,
    model,
    status,
  };
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Local model HTTP ${response.status}`);
  }
  return data;
}

async function generateChatCompletion(db, {
  model = '',
  systemPrompt = '',
  messages = [],
  temperature = 0.4,
  maxTokens = 700,
  responseFormat = 'text',
}) {
  const config = await ensureConfigured(db, model);
  const payloadMessages = [];
  if (systemPrompt) payloadMessages.push({ role: 'system', content: String(systemPrompt) });
  messages.forEach((entry) => {
    payloadMessages.push({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: String(entry.content || ''),
    });
  });

  const data = await requestJson(`${config.baseUrl}/api/chat`, {
    model: config.model,
    messages: payloadMessages,
    stream: false,
    format: responseFormat === 'json' ? 'json' : undefined,
    options: {
      temperature,
      num_predict: maxTokens,
    },
  });

  const content = String(data?.message?.content || '').trim();
  if (!content) throw new Error('Local model returned an empty response');
  return {
    provider: 'local',
    model: config.model,
    mode: 'llm',
    content,
    raw: data,
  };
}

module.exports = {
  DEFAULT_LOCAL_MODEL,
  getLocalConfig,
  ensureConfigured,
  generateChatCompletion,
};

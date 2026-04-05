const { decrypt } = require('../../lib/crypto');
const { getSettingValue } = require('../../db/queries/settings');
const { DEFAULT_LOCAL_MODEL } = require('../localModelService');

const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  claude: 'claude-3-5-sonnet-latest',
  gemini: 'gemini-1.5-flash',
  local: DEFAULT_LOCAL_MODEL,
};

function getDefaultModelForProvider(provider) {
  return DEFAULT_MODELS[String(provider || '').trim().toLowerCase()] || DEFAULT_MODELS.openai;
}

function getProviderApiKey(db, provider) {
  const keyMap = {
    openai: 'ai_openai_key_enc',
    claude: 'ai_claude_key_enc',
    gemini: 'ai_gemini_key_enc',
  };
  const settingsKey = keyMap[provider];
  if (!settingsKey) return '';
  const encrypted = getSettingValue(db, settingsKey, '');
  if (encrypted) {
    try {
      const decrypted = decrypt(encrypted);
      if (decrypted && !decrypted.includes('...')) return decrypted;
    } catch {}
  }
  const envMap = {
    openai: process.env.OPENAI_API_KEY || '',
    claude: process.env.ANTHROPIC_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  };
  return envMap[provider] || '';
}

function resolveProviderModelSetting(rawValue, fallbackProvider = 'claude') {
  const fallback = String(fallbackProvider || 'claude').trim().toLowerCase() || 'claude';
  const normalized = String(rawValue || '').trim();
  const lowered = normalized.toLowerCase();
  if (!normalized) {
    return {
      provider: fallback,
      model: getDefaultModelForProvider(fallback),
    };
  }

  if (normalized.includes(':')) {
    const [providerPart, ...modelParts] = normalized.split(':');
    const maybeProvider = String(providerPart || fallback).trim().toLowerCase() || fallback;
    if (DEFAULT_MODELS[maybeProvider]) {
      const model = modelParts.join(':').trim() || getDefaultModelForProvider(maybeProvider);
      return { provider: maybeProvider, model };
    }
    return { provider: fallback, model: normalized };
  }

  if (lowered === 'gpt4') {
    return { provider: 'openai', model: getDefaultModelForProvider('openai') };
  }

  if (lowered === 'ollama' || lowered === 'local') {
    return { provider: 'local', model: getDefaultModelForProvider('local') };
  }

  if (DEFAULT_MODELS[lowered]) {
    return {
      provider: lowered,
      model: getDefaultModelForProvider(lowered),
    };
  }

  return {
    provider: fallback,
    model: normalized,
  };
}

module.exports = {
  DEFAULT_MODELS,
  getDefaultModelForProvider,
  getProviderApiKey,
  resolveProviderModelSetting,
};

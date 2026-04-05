const { getAllSettings } = require('../db/queries/settings');
const { decrypt } = require('../lib/crypto');
const onyxLifecycleService = require('./onyxLifecycleService');

function safeDecrypt(value) {
  if (!value) return '';
  try {
    return decrypt(value);
  } catch {
    return '';
  }
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function parsePersonaId(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function loadSettings(db) {
  const rows = getAllSettings(db);
  const settings = {};
  rows.forEach((row) => {
    settings[row.key] = row.value;
  });
  return settings;
}

async function getConfig(db) {
  const settings = loadSettings(db);
  const shared = {
    enabled: String(settings.onyx_enabled || '0') === '1',
    mode: String(settings.onyx_mode || '').trim() || 'auto',
    localEnabled: String(settings.onyx_local_enabled || '1') !== '0',
    externalEnabled: String(settings.onyx_external_enabled || '1') !== '0',
    apiKey: safeDecrypt(settings.onyx_api_key_enc),
    defaultPersonaId: parsePersonaId(settings.onyx_default_persona_id),
    teamPersonaId: parsePersonaId(settings.onyx_team_persona_id),
    quotePersonaId: parsePersonaId(settings.onyx_quote_persona_id),
  };
  const externalBaseUrl = normalizeBaseUrl(settings.onyx_base_url);
  const localBaseUrl = onyxLifecycleService.getBaseUrl(db);
  const localStatus = await onyxLifecycleService.detect(db);

  let activeMode = shared.mode;
  if (!activeMode || activeMode === 'auto') {
    if (shared.localEnabled && localStatus.health?.ok) activeMode = 'managed_local';
    else if (shared.externalEnabled && externalBaseUrl) activeMode = 'external';
    else activeMode = shared.localEnabled ? 'managed_local' : 'external';
  }

  const baseUrl = activeMode === 'managed_local' ? localBaseUrl : externalBaseUrl;
  return {
    ...shared,
    activeMode,
    baseUrl,
    localBaseUrl,
    externalBaseUrl,
    localStatus,
  };
}

async function ensureConfigured(db) {
  const config = await getConfig(db);
  if (!config.enabled) {
    const error = new Error('Onyx integration is disabled in Settings.');
    error.statusCode = 400;
    throw error;
  }
  if (config.activeMode === 'managed_local') {
    if (!config.localEnabled) {
      const error = new Error('Managed local Onyx is disabled in Settings.');
      error.statusCode = 400;
      throw error;
    }
    if (config.localStatus?.auth_type && config.localStatus.auth_type !== 'disabled') {
      const error = new Error(`Managed local Onyx is configured with ${config.localStatus.auth_type} auth. Restart it from Admin > System so BadShuffle can apply local companion settings.`);
      error.statusCode = 503;
      throw error;
    }
    if (!config.localStatus?.health?.ok) {
      const error = new Error('Managed local Onyx is not running or not healthy. Start it from Admin > System.');
      error.statusCode = 503;
      throw error;
    }
    if (!config.apiKey) {
      const error = new Error('Managed local Onyx requires an Onyx API key in Settings. Create one in Onyx, then paste it into BadShuffle Settings.');
      error.statusCode = 503;
      throw error;
    }
  }
  if (config.activeMode === 'external') {
    if (!config.externalEnabled) {
      const error = new Error('External Onyx mode is disabled in Settings.');
      error.statusCode = 400;
      throw error;
    }
    if (!config.baseUrl) {
      const error = new Error('Onyx base URL is required for external mode.');
      error.statusCode = 400;
      throw error;
    }
    if (!config.apiKey) {
      const error = new Error('External Onyx requires an Onyx API key in Settings.');
      error.statusCode = 400;
      throw error;
    }
  }
  if (!config.baseUrl) {
    const error = new Error('Onyx base URL is required in Settings.');
    error.statusCode = 400;
    throw error;
  }
  return config;
}

async function onyxRequest(db, requestPath, options = {}) {
  const config = await ensureConfigured(db);
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  const response = await fetch(`${config.baseUrl}${requestPath}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.detail;
    const detailMessage = Array.isArray(detail)
      ? detail.map((entry) => entry?.msg).filter(Boolean).join('; ')
      : null;
    let message = data?.error || data?.error_msg || detailMessage || `Onyx request failed (${response.status})`;
    if (
      response.status === 403
      && config.activeMode === 'managed_local'
      && config.localStatus?.auth_type
      && config.localStatus.auth_type !== 'disabled'
    ) {
      message = `Managed local Onyx rejected the request because it is using ${config.localStatus.auth_type} auth. Restart it from Admin > System so BadShuffle can apply local companion settings.`;
    }
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return { data, config };
}

function getPersonaId(config, mode) {
  if (mode === 'quote') return config.quotePersonaId || config.defaultPersonaId || null;
  if (mode === 'team') return config.teamPersonaId || config.defaultPersonaId || null;
  return config.defaultPersonaId || null;
}

async function createChatSession(db, { mode = 'team', description = '', title = '' } = {}) {
  const config = await ensureConfigured(db);
  const personaId = getPersonaId(config, mode);
  const { data } = await onyxRequest(db, '/api/chat/create-chat-session', {
    method: 'POST',
    body: {
      persona_id: personaId,
      description: description || title || null,
    },
  });
  return {
    chatSessionId: data?.chat_session_id || null,
    personaId: data?.persona_id || personaId,
    description: data?.description || description || title || '',
    mode: config.activeMode,
    baseUrl: config.baseUrl,
  };
}

async function sendChatMessage(db, {
  mode = 'team',
  message,
  chatSessionId = null,
  additionalContext = null,
  description = '',
  includeCitations = true,
}) {
  const config = await ensureConfigured(db);
  const personaId = getPersonaId(config, mode);
  const { data } = await onyxRequest(db, '/api/chat/send-chat-message', {
    method: 'POST',
    body: {
      message,
      stream: false,
      include_citations: includeCitations,
      origin: 'api',
      chat_session_id: chatSessionId || null,
      chat_session_info: {
        persona_id: personaId,
        description: description || null,
      },
      additional_context: additionalContext || null,
    },
  });

  return {
    answer: data?.answer || '',
    answerCitationless: data?.answer_citationless || data?.answer || '',
    onyxMessageId: data?.message_id || null,
    chatSessionId: data?.chat_session_id || chatSessionId || null,
    topDocuments: Array.isArray(data?.top_documents) ? data.top_documents : [],
    citationInfo: Array.isArray(data?.citation_info) ? data.citation_info : [],
    toolCalls: Array.isArray(data?.tool_calls) ? data.tool_calls : [],
    errorMsg: data?.error_msg || null,
    personaId,
    activeMode: config.activeMode,
    baseUrl: config.baseUrl,
  };
}

module.exports = {
  getConfig,
  createChatSession,
  sendChatMessage,
};

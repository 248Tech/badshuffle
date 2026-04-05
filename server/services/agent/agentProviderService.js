let OpenAI;
try { OpenAI = require('openai'); } catch {}

const { getSettingValue } = require('../../db/queries/settings');
const localModelService = require('../localModelService');
const { getProviderApiKey, getDefaultModelForProvider } = require('./providerConfig');

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getAssistantConfig(db) {
  const enabled = String(getSettingValue(db, 'ai_agent_enabled', '1') || '1') === '1';
  const provider = String(getSettingValue(db, 'ai_agent_provider', 'openai') || 'openai').trim().toLowerCase();
  const model = String(getSettingValue(db, 'ai_agent_model', getDefaultModelForProvider(provider)) || getDefaultModelForProvider(provider)).trim();
  return { enabled, provider, model };
}

function buildFallbackReply({ prompt, toolResults, quoteName }) {
  const lines = [`Quote assistant fallback for ${quoteName || 'this project'}.`];
  const overview = toolResults.find((entry) => entry.name === 'quote_overview')?.result;
  if (overview) {
    lines.push(`Status: ${overview.status}. Event: ${overview.event_date || 'not scheduled yet'}. Client: ${overview.client_name || 'not set'}.`);
    if (Array.isArray(overview.visible_items) && overview.visible_items.length > 0) {
      lines.push(`Visible line items: ${overview.visible_items.slice(0, 5).map((item) => `${item.title} x${item.quantity}`).join(', ')}.`);
    }
  }
  const financials = toolResults.find((entry) => entry.name === 'quote_financials')?.result;
  if (financials) {
    lines.push(`Total: $${financials.total.toFixed(2)}. Paid: $${financials.amount_paid.toFixed(2)}. Remaining: $${financials.remaining_balance.toFixed(2)}.`);
  }
  const lineItems = toolResults.find((entry) => entry.name === 'quote_line_items')?.result;
  if (lineItems && Array.isArray(lineItems.items) && lineItems.items.length > 0) {
    lines.push(`Quoted quantities: ${lineItems.items.slice(0, 6).map((item) => `${item.title} x${item.quantity}`).join(', ')}.`);
  }
  const pressure = toolResults.find((entry) => entry.name === 'inventory_pressure')?.result;
  if (pressure && pressure.pressure_items.length > 0) {
    lines.push(`Inventory pressure: ${pressure.pressure_items.map((item) => `${item.title} (${item.requested}/${item.in_stock})`).join(', ')}.`);
  }
  const recommendations = toolResults.find((entry) => entry.name === 'item_recommendations')?.result;
  if (recommendations && recommendations.suggestions.length > 0) {
    lines.push(`Recommended items: ${recommendations.suggestions.slice(0, 3).map((item) => item.title).join(', ')}.`);
  }
  lines.push(`Prompt: ${prompt}`);
  lines.push('Live LLM synthesis is unavailable, so this response is based on BadShuffle tool output only.');
  return lines.join('\n\n');
}

function buildPromptPayload({ prompt, quote, toolResults, history }) {
  return [
    {
      role: 'system',
      content: [
        'You are BadShuffle Assistant, an internal operator copilot for event rental staff.',
        'You are read-only. Do not claim that you changed data, sent messages, or reserved inventory.',
        'Use the provided tool outputs as the source of truth.',
        'Be concise, practical, and specific to the quote.',
        'When discussing items, cite concrete item names and quantities from the quote_line_items or quote_overview data.',
        'When suggesting items, avoid repeating items already on the quote and explain why the suggested item fills a gap.',
        'If data is missing, say so directly.',
      ].join(' '),
    },
    ...history.slice(-8).map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: String(entry.content || ''),
    })),
    {
      role: 'user',
      content: [
        `Quote: ${quote.name || 'Untitled quote'} (#${quote.id})`,
        `Prompt: ${prompt}`,
        'Tool results:',
        ...toolResults.map((entry) => `## ${entry.name}\n${safeJson(entry.result)}`),
      ].join('\n\n'),
    },
  ];
}

async function generateWithOpenAI({ apiKey, model, messages, temperature = 0.3, maxTokens = 700, responseFormat = 'text' }) {
  if (!OpenAI) throw new Error('OpenAI SDK is not installed');
  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
  });
  return completion.choices?.[0]?.message?.content?.trim() || '';
}

async function generateWithClaude({ apiKey, model, systemPrompt, messages, temperature = 0.3, maxTokens = 700 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt || undefined,
      max_tokens: maxTokens,
      temperature,
      messages: messages.map((entry) => ({
        role: entry.role === 'assistant' ? 'assistant' : 'user',
        content: String(entry.content || ''),
      })),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `Anthropic HTTP ${response.status}`);
  return Array.isArray(data.content)
    ? data.content.filter((entry) => entry.type === 'text').map((entry) => entry.text).join('\n').trim()
    : '';
}

async function generateWithGemini({ apiKey, model, systemPrompt, messages, temperature = 0.3 }) {
  const contents = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: `System instructions:\n${systemPrompt}` }] });
  }
  messages.forEach((entry) => {
    contents.push({
      role: entry.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(entry.content || '') }],
    });
  });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
  return data?.candidates?.[0]?.content?.parts?.map((entry) => entry.text || '').join('\n').trim() || '';
}

async function generateProviderReply(db, {
  provider,
  model,
  systemPrompt = '',
  messages = [],
  temperature = 0.3,
  maxTokens = 700,
  responseFormat = 'text',
}) {
  const normalizedProvider = String(provider || 'openai').trim().toLowerCase() || 'openai';
  if (normalizedProvider === 'local') {
    return localModelService.generateChatCompletion(db, {
      model,
      systemPrompt,
      messages,
      temperature,
      maxTokens,
      responseFormat,
    });
  }

  const apiKey = getProviderApiKey(db, normalizedProvider);
  if (!apiKey) {
    throw createError(400, `No ${normalizedProvider} API key is configured for this AI feature.`);
  }

  if (normalizedProvider === 'openai') {
    const content = await generateWithOpenAI({
      apiKey,
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages,
      ],
      temperature,
      maxTokens,
      responseFormat,
    });
    return { provider: normalizedProvider, model, mode: 'llm', content };
  }

  if (normalizedProvider === 'claude') {
    const content = await generateWithClaude({ apiKey, model, systemPrompt, messages, temperature, maxTokens });
    return { provider: normalizedProvider, model, mode: 'llm', content };
  }

  if (normalizedProvider === 'gemini') {
    const content = await generateWithGemini({ apiKey, model, systemPrompt, messages, temperature });
    return { provider: normalizedProvider, model, mode: 'llm', content };
  }

  throw createError(400, `Unsupported assistant provider: ${normalizedProvider}`);
}

async function generateGenericAssistantReply(db, {
  systemPrompt = '',
  history = [],
  userPrompt = '',
  contextSections = [],
  temperature = 0.3,
  maxTokens = 700,
}) {
  const config = getAssistantConfig(db);
  if (!config.enabled) {
    throw createError(400, 'BadShuffle AI Assistant is disabled in Settings.');
  }
  if (config.provider !== 'local' && !getProviderApiKey(db, config.provider)) {
    throw createError(400, `No ${config.provider} API key is configured for the BadShuffle AI Assistant.`);
  }

  const messages = [
    ...history.slice(-8).map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: String(entry.content || ''),
    })),
    {
      role: 'user',
      content: [userPrompt, ...contextSections.filter(Boolean)].join('\n\n'),
    },
  ];

  try {
    const reply = await generateProviderReply(db, {
      provider: config.provider,
      model: config.model,
      systemPrompt,
      messages,
      temperature,
      maxTokens,
    });
    if (!reply.content) throw new Error('Assistant returned an empty response');
    return reply;
  } catch (error) {
    if (error.statusCode) throw error;
    throw createError(502, `Assistant fallback failed: ${error.message}`);
  }
}

async function generateAssistantReply(db, payload) {
  const config = getAssistantConfig(db);
  if ((config.provider !== 'local') && !getProviderApiKey(db, config.provider)) {
    return {
      provider: config.provider || 'fallback',
      model: config.model || 'fallback',
      mode: 'fallback',
      content: buildFallbackReply(payload),
    };
  }

  try {
    const promptPayload = buildPromptPayload(payload);
    const systemPrompt = promptPayload[0]?.role === 'system' ? String(promptPayload[0].content || '') : '';
    const messages = promptPayload.slice(systemPrompt ? 1 : 0).map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));
    const reply = await generateProviderReply(db, {
      provider: config.provider,
      model: config.model,
      systemPrompt,
      messages,
      temperature: 0.3,
      maxTokens: 700,
    });
    const text = reply.content?.trim();
    if (text) return { ...reply, content: text };
  } catch (error) {
    console.error('Quote assistant LLM error:', error.message);
  }

  return {
    provider: config.provider || 'fallback',
    model: config.model || 'fallback',
    mode: 'fallback',
    content: buildFallbackReply(payload),
  };
}

module.exports = {
  generateProviderReply,
  generateAssistantReply,
  generateGenericAssistantReply,
};

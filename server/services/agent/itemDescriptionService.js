let OpenAI;
try { OpenAI = require('openai'); } catch {}

const fs = require('fs');
const path = require('path');
const { getSettingValue } = require('../../db/queries/settings');
const { getFileById, listFileVariants } = require('../../db/queries/files');
const { getProviderApiKey, DEFAULT_MODELS, getDefaultModelForProvider, resolveProviderModelSetting } = require('./providerConfig');
const { generateProviderReply } = require('./agentProviderService');

const ORG_ID = 1;
const UPLOADS_DIR = process.env.UPLOADS_DIR || (typeof process.pkg !== 'undefined'
  ? path.join(path.dirname(process.execPath), 'uploads')
  : path.join(__dirname, '../../../uploads'));

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function flagEnabled(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value) === '1' || value === true || value === 'true';
}

function resolveFeatureConfig(db) {
  const agentEnabled = flagEnabled(getSettingValue(db, 'ai_agent_enabled', '1'), true);
  if (agentEnabled) {
    const provider = String(getSettingValue(db, 'ai_agent_provider', 'openai') || 'openai').trim().toLowerCase();
    return {
      source: 'assistant',
      provider,
      model: String(getSettingValue(db, 'ai_agent_model', getDefaultModelForProvider(provider)) || getDefaultModelForProvider(provider)).trim(),
    };
  }

  const descriptionEnabled = flagEnabled(getSettingValue(db, 'ai_description_enabled', '0'), false);
  if (!descriptionEnabled) {
    throw createError(400, 'Enable AI Assistant or AI Item Descriptions in Settings first.');
  }

  const legacyConfig = resolveProviderModelSetting(getSettingValue(db, 'ai_description_model', 'claude'), 'claude');
  return {
    source: 'legacy-description',
    provider: legacyConfig.provider,
    model: legacyConfig.model,
  };
}

function normalizeMimeType(mimeType) {
  const normalized = String(mimeType || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'image/jpg') return 'image/jpeg';
  return normalized;
}

function isSupportedVisionMime(mimeType) {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(normalizeMimeType(mimeType));
}

function chooseLocalVariant(db, fileId) {
  const file = getFileById(db, fileId, ORG_ID);
  if (!file) return null;
  if (Number(file.is_image) === 1 && file.storage_mode === 'image_variants') {
    const variants = listFileVariants(db, fileId);
    const preferred = variants.find((variant) => variant.variant_key === 'ui' && variant.mime_type === 'image/webp')
      || variants.find((variant) => variant.variant_key === 'ui' && isSupportedVisionMime(variant.mime_type))
      || variants.find((variant) => isSupportedVisionMime(variant.mime_type));
    if (preferred) {
      return {
        storedName: preferred.stored_name,
        mimeType: normalizeMimeType(preferred.mime_type),
      };
    }
  }
  if (!isSupportedVisionMime(file.mime_type)) return null;
  return {
    storedName: file.stored_name,
    mimeType: normalizeMimeType(file.mime_type),
  };
}

async function fetchRemoteImageBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image fetch failed with HTTP ${response.status}`);
  const mimeType = normalizeMimeType(response.headers.get('content-type'));
  if (!isSupportedVisionMime(mimeType)) throw new Error(`Unsupported image format: ${mimeType || 'unknown'}`);
  const arrayBuffer = await response.arrayBuffer();
  return {
    mimeType,
    buffer: Buffer.from(arrayBuffer),
  };
}

async function loadImagePayload(db, photoUrl) {
  const reference = String(photoUrl || '').trim();
  if (!reference) return { image: null, warnings: [] };
  try {
    if (/^\d+$/.test(reference)) {
      const chosen = chooseLocalVariant(db, Number(reference));
      if (!chosen) {
        return { image: null, warnings: ['Attached photo format is not supported for AI vision input.'] };
      }
      const filePath = path.join(UPLOADS_DIR, chosen.storedName);
      if (!fs.existsSync(filePath)) {
        return { image: null, warnings: ['Attached photo could not be found on disk, so AI used text only.'] };
      }
      return {
        image: {
          mimeType: chosen.mimeType,
          buffer: fs.readFileSync(filePath),
        },
        warnings: [],
      };
    }

    if (/^https?:\/\//i.test(reference)) {
      const remote = await fetchRemoteImageBytes(reference);
      return { image: remote, warnings: [] };
    }

    return { image: null, warnings: ['Photo format is not usable for AI vision input, so AI used text only.'] };
  } catch (error) {
    return { image: null, warnings: [`Photo could not be used for AI vision input: ${error.message}`] };
  }
}

function buildPrompt({ item, accessories, associations }) {
  return buildPromptWithControls({ item, accessories, associations, controls: {} });
}

function normalizeControlValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeControls(controls = {}) {
  const customInstructions = String(controls.customInstructions || '').trim();
  return {
    stylePreset: normalizeControlValue(controls.stylePreset) || 'catalog',
    personaPreset: normalizeControlValue(controls.personaPreset) || 'planner',
    variationLevel: normalizeControlValue(controls.variationLevel) || 'balanced',
    customInstructions,
  };
}

function buildStyleGuidance(style) {
  switch (normalizeControlValue(style)) {
    case 'editorial':
      return 'Style preset: editorial. Write like a showroom copywriter. Lead with visual mood and spatial impression, use polished but readable phrasing, and make the item feel design-forward without inventing facts.';
    case 'luxury':
      return 'Style preset: luxury. Use refined, elevated language with a premium tone. Favor elegant phrasing, restraint, and confidence. Avoid sounding generic, casual, or overly salesy.';
    case 'playful':
      return 'Style preset: playful. Keep the copy energetic, modern, and expressive. Use brighter rhythm and more personality while remaining polished and appropriate for clients.';
    case 'technical':
      return 'Style preset: technical. Prioritize usability, setup context, compatibility, and operational clarity. Use straightforward language and favor concrete function over atmosphere.';
    case 'minimal':
      return 'Style preset: minimal. Keep the paragraph lean, direct, and tightly edited. Use fewer adjectives, shorter sentences, and clean product-first phrasing.';
    default:
      return 'Style preset: catalog. Write polished, broadly useful rental catalog copy with a balanced mix of appeal, clarity, and browsing utility.';
  }
}

function buildPersonaGuidance(persona) {
  switch (normalizeControlValue(persona)) {
    case 'designer':
      return 'Persona preset: designer. Prioritize silhouette, finish, styling flexibility, and how the piece shapes the look of a room or installation.';
    case 'sales':
      return 'Persona preset: sales. Prioritize immediate client appeal, broad fit, pairing ease, and why someone would choose this item quickly.';
    case 'logistics':
      return 'Persona preset: logistics. Prioritize practical setup context, deployment clarity, use cases, and operational confidence over decorative language.';
    case 'stylist':
      return 'Persona preset: stylist. Prioritize texture, shape, color story, layering, and pairing potential with other pieces in a visual composition.';
    default:
      return 'Persona preset: planner. Balance event design appeal with practical rental decision-making and venue flexibility.';
  }
}

function buildVariationGuidance(variation) {
  switch (normalizeControlValue(variation)) {
    case 'high':
      return 'Variation level: high. Force noticeable variation in opening angle, sentence rhythm, and phrasing. Do not reuse the same first clause, adjective stack, or paragraph shape used for typical catalog items.';
    case 'low':
      return 'Variation level: low. Keep tone and paragraph structure consistent and restrained. Favor stable brand voice over experimentation.';
    default:
      return 'Variation level: balanced. Keep brand consistency, but vary openings, sentence cadence, and emphasis enough that entries do not feel templated.';
  }
}

function getTemperatureForVariation(variation) {
  switch (normalizeControlValue(variation)) {
    case 'high':
      return 0.9;
    case 'low':
      return 0.35;
    default:
      return 0.65;
  }
}

function buildPromptWithControls({ item, accessories, associations, controls }) {
  const normalizedControls = normalizeControls(controls);
  const customInstructions = normalizedControls.customInstructions;
  return [
    'You write SEO-aware, client-facing rental product descriptions for BadShuffle inventory.',
    'Return JSON only in the format {"description":"..."} with a single polished paragraph.',
    'Instruction priority: factual accuracy and product data first, then custom writing direction, then style/persona/variation presets, then the default BadShuffle voice.',
    'Use only supported claims from the provided item data. Do not invent materials, dimensions, brands, delivery promises, or inventory guarantees.',
    'Do not mention internal notes, hidden operations language, or that the text was AI-generated.',
    'Write for public product/catalog usage. Keep it concise, natural, conversion-friendly, and clearly shaped by the selected writing controls.',
    '',
    'Applied writing controls:',
    buildStyleGuidance(normalizedControls.stylePreset),
    buildPersonaGuidance(normalizedControls.personaPreset),
    buildVariationGuidance(normalizedControls.variationLevel),
    customInstructions ? `Custom direction: ${customInstructions}` : 'Custom direction: none',
    '',
    'Output requirements:',
    'Write exactly one paragraph of 45 to 95 words.',
    'Anchor the copy in the item title and known category instead of generic rental filler.',
    'Avoid generic openings such as "This elegant piece", "Perfect for", "Ideal for", or "Designed to".',
    'If a current description already exists, do not lightly paraphrase it. Rewrite from a fresh angle while preserving supported facts.',
    'If the selected controls conflict with the current description, prefer the selected controls and rewrite accordingly.',
    '',
    `Title: ${item.title}`,
    `Category: ${item.category || 'not set'}`,
    `Unit price: ${Number(item.unit_price || 0).toFixed(2)}`,
    `Quantity in stock: ${Number(item.quantity_in_stock || 0)}`,
    `Item type: ${item.item_type || 'product'}`,
    `Taxable: ${Number(item.taxable || 0) === 1 ? 'yes' : 'no'}`,
    `Subrental: ${Number(item.is_subrental || 0) === 1 ? 'yes' : 'no'}`,
    `Source: ${item.source || 'manual'}`,
    `Current description: ${item.description || 'none'}`,
    `Internal notes: ${item.internal_notes || 'none'}`,
    `Permanent accessories: ${accessories.length ? accessories.map((entry) => entry.title).join(', ') : 'none'}`,
    `Associated items: ${associations.length ? associations.map((entry) => entry.title).join(', ') : 'none'}`,
  ].join('\n');
}

function parseJsonDescription(rawText) {
  if (!rawText) throw new Error('No description returned');
  const trimmed = String(rawText).trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(trimmed);
  const description = String(parsed.description || '').trim();
  if (!description) throw new Error('Model returned empty description');
  return description;
}

async function generateWithOpenAI({ apiKey, model, prompt, image, temperature }) {
  if (!OpenAI) throw new Error('OpenAI SDK is not installed');
  const client = new OpenAI({ apiKey });
  const content = [{ type: 'text', text: prompt }];
  let mode = 'text';
  if (image) {
    mode = 'vision';
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.buffer.toString('base64')}`,
      },
    });
  }
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
    temperature,
    max_tokens: 400,
  });
  return {
    description: parseJsonDescription(completion.choices?.[0]?.message?.content),
    mode,
  };
}

async function generateWithClaude({ apiKey, model, prompt, image, temperature }) {
  const content = [{ type: 'text', text: prompt }];
  let mode = 'text';
  if (image) {
    mode = 'vision';
    content.unshift({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimeType,
        data: image.buffer.toString('base64'),
      },
    });
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      temperature,
      messages: [{ role: 'user', content }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Anthropic HTTP ${response.status}`);
  }
  const text = Array.isArray(data.content)
    ? data.content.filter((entry) => entry.type === 'text').map((entry) => entry.text).join('\n')
    : '';
  return {
    description: parseJsonDescription(text),
    mode,
  };
}

async function generateWithGemini({ apiKey, model, prompt, image, temperature }) {
  const parts = [{ text: prompt }];
  let mode = 'text';
  if (image) {
    mode = 'vision';
    parts.unshift({
      inline_data: {
        mime_type: image.mimeType,
        data: image.buffer.toString('base64'),
      },
    });
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((entry) => entry.text || '').join('\n') || '';
  return {
    description: parseJsonDescription(text),
    mode,
  };
}

async function generateItemDescription(db, { item, accessories = [], associations = [], controls = {} }) {
  const config = resolveFeatureConfig(db);
  if (config.provider !== 'local' && !getProviderApiKey(db, config.provider)) {
    throw createError(400, `No ${config.provider} API key is configured for item description generation.`);
  }

  const normalizedControls = normalizeControls(controls);
  const prompt = buildPromptWithControls({ item, accessories, associations, controls: normalizedControls });
  const temperature = getTemperatureForVariation(normalizedControls.variationLevel);
  const { image, warnings } = await loadImagePayload(db, item.photo_url);
  const nextWarnings = [...warnings];

  let result;
  try {
    if (config.provider === 'local') {
      if (image) nextWarnings.push('Local AI currently uses text-only item description generation. Attached product photos were ignored.');
      const reply = await generateProviderReply(db, {
        provider: config.provider,
        model: config.model,
        systemPrompt: 'Return JSON only in the format {"description":"..."} with a single polished paragraph.',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        maxTokens: 400,
        responseFormat: 'json',
      });
      result = {
        description: parseJsonDescription(reply.content),
        mode: 'text',
      };
    } else if (config.provider === 'openai') {
      result = await generateWithOpenAI({ apiKey, model: config.model, prompt, image, temperature });
    } else if (config.provider === 'claude') {
      result = await generateWithClaude({ apiKey, model: config.model, prompt, image, temperature });
    } else if (config.provider === 'gemini') {
      result = await generateWithGemini({ apiKey, model: config.model, prompt, image, temperature });
    } else {
      throw createError(400, `Unsupported AI provider: ${config.provider}`);
    }
  } catch (error) {
    if (error.statusCode) throw error;
    throw createError(502, `AI description generation failed: ${error.message}`);
  }

  return {
    description: result.description,
    provider: config.provider,
    model: config.model,
    mode: result.mode,
    controls: normalizedControls,
    warnings: nextWarnings,
  };
}

module.exports = {
  generateItemDescription,
};

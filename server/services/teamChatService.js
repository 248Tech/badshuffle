const quoteCoreService = require('./quoteCoreService');
const quoteSectionService = require('./quoteSectionService');
const quotePatternMemoryService = require('./quotePatternMemoryService');
const onyxService = require('./onyxService');
const { getSettingValue } = require('../db/queries/settings');
const { generateGenericAssistantReply } = require('./agent/agentProviderService');
const { requireQuoteById } = require('../db/queries/quotes');

const ORG_ID = 1;

function cleanText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function parseMetadata(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function listTeamThreads(db) {
  return db.prepare(`
    SELECT
      t.*,
      creator.email AS created_by_email,
      (
        SELECT body_text
        FROM team_chat_messages m
        WHERE m.thread_id = t.id
        ORDER BY m.id DESC
        LIMIT 1
      ) AS last_message_text,
      (
        SELECT created_at
        FROM team_chat_messages m
        WHERE m.thread_id = t.id
        ORDER BY m.id DESC
        LIMIT 1
      ) AS last_message_created_at
    FROM team_chat_threads t
    LEFT JOIN users creator ON creator.id = t.created_by_user_id
    WHERE t.org_id = ? AND t.thread_type = 'team'
    ORDER BY COALESCE(t.last_message_at, t.created_at) DESC, t.id DESC
  `).all(ORG_ID).map((row) => ({
    id: Number(row.id),
    title: row.title,
    thread_type: row.thread_type,
    quote_id: row.quote_id ? Number(row.quote_id) : null,
    onyx_chat_session_id: row.onyx_chat_session_id || null,
    onyx_persona_id: row.onyx_persona_id ? Number(row.onyx_persona_id) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message_at: row.last_message_at,
    created_by_email: row.created_by_email || null,
    last_message_text: row.last_message_text || '',
    last_message_created_at: row.last_message_created_at || null,
  }));
}

function createTeamThread(db, body, actor) {
  const title = cleanText(body?.title);
  if (!title) {
    const error = new Error('title required');
    error.statusCode = 400;
    throw error;
  }
  const result = db.prepare(`
    INSERT INTO team_chat_threads (
      org_id, thread_type, title, created_by_user_id, created_at, updated_at, last_message_at
    ) VALUES (?, 'team', ?, ?, datetime('now'), datetime('now'), datetime('now'))
  `).run(ORG_ID, title, actor?.sub || actor?.id || null);
  const threadId = Number(result.lastInsertRowid);
  db.prepare(`
    INSERT OR IGNORE INTO team_chat_participants (thread_id, user_id)
    VALUES (?, ?)
  `).run(threadId, actor?.sub || actor?.id || null);
  return getThreadById(db, threadId, 'team');
}

function getThreadById(db, threadId, expectedType = null) {
  const row = db.prepare(`
    SELECT t.*, q.name AS quote_name
    FROM team_chat_threads t
    LEFT JOIN quotes q ON q.id = t.quote_id
    WHERE t.id = ? AND t.org_id = ?
  `).get(Number(threadId), ORG_ID);
  if (!row) {
    const error = new Error('Not found');
    error.statusCode = 404;
    throw error;
  }
  if (expectedType && row.thread_type !== expectedType) {
    const error = new Error('Not found');
    error.statusCode = 404;
    throw error;
  }
  return {
    id: Number(row.id),
    title: row.title,
    thread_type: row.thread_type,
    quote_id: row.quote_id ? Number(row.quote_id) : null,
    quote_name: row.quote_name || null,
    onyx_chat_session_id: row.onyx_chat_session_id || null,
    onyx_persona_id: row.onyx_persona_id ? Number(row.onyx_persona_id) : null,
    created_by_user_id: row.created_by_user_id ? Number(row.created_by_user_id) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_message_at: row.last_message_at,
  };
}

function listThreadMessages(db, threadId) {
  getThreadById(db, threadId);
  return db.prepare(`
    SELECT m.*, t.thread_type, t.quote_id
    FROM team_chat_messages m
    JOIN team_chat_threads t ON t.id = m.thread_id
    WHERE m.thread_id = ?
    ORDER BY m.id ASC
  `).all(Number(threadId)).map((row) => ({
    id: Number(row.id),
    thread_id: Number(row.thread_id),
    thread_type: row.thread_type,
    quote_id: row.quote_id ? Number(row.quote_id) : null,
    role: row.role,
    body_text: row.body_text,
    message_kind: row.message_kind,
    source: row.source,
    onyx_message_id: row.onyx_message_id ? Number(row.onyx_message_id) : null,
    created_by_user_id: row.created_by_user_id ? Number(row.created_by_user_id) : null,
    created_by_email: row.created_by_email || null,
    metadata: parseMetadata(row.metadata_json),
    created_at: row.created_at,
  }));
}

function saveThreadMessage(db, {
  threadId,
  role,
  bodyText,
  messageKind = 'text',
  source = 'local',
  onyxMessageId = null,
  actor = null,
  metadata = null,
}) {
  const result = db.prepare(`
    INSERT INTO team_chat_messages (
      thread_id, role, body_text, message_kind, source, onyx_message_id,
      created_by_user_id, created_by_email, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    Number(threadId),
    role,
    bodyText,
    messageKind,
    source,
    onyxMessageId,
    actor?.sub || actor?.id || null,
    actor?.email || null,
    metadata ? JSON.stringify(metadata) : null,
  );
  db.prepare(`
    UPDATE team_chat_threads
    SET updated_at = datetime('now'), last_message_at = datetime('now')
    WHERE id = ?
  `).run(Number(threadId));
  return db.prepare('SELECT * FROM team_chat_messages WHERE id = ?').get(result.lastInsertRowid);
}

function buildAiFailureText(error, fallback) {
  const message = cleanText(error?.message);
  if (!message) return fallback;
  return `${fallback}\n\n${message}`;
}

function toMessagePayload(row) {
  return {
    id: Number(row.id),
    thread_id: Number(row.thread_id),
    role: row.role,
    body_text: row.body_text,
    source: row.source,
    created_by_email: row.created_by_email || null,
    metadata: parseMetadata(row.metadata_json),
    created_at: row.created_at,
  };
}

function summarizeEntityRefs(db, message) {
  const refs = [];
  const patterns = [
    { key: 'quote', regex: /\b(?:quote|project)\s+#?(\d+)\b/gi },
    { key: 'client', regex: /\bclient\s+#?(\d+)\b/gi },
    { key: 'venue', regex: /\bvenue\s+#?(\d+)\b/gi },
    { key: 'item', regex: /\b(?:item|inventory)\s+#?(\d+)\b/gi },
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(message))) {
      refs.push({ type: pattern.key, id: Number(match[1]) });
    }
  }
  const unique = new Map();
  refs.forEach((ref) => unique.set(`${ref.type}:${ref.id}`, ref));
  const rows = [];
  for (const ref of unique.values()) {
    if (ref.type === 'quote') {
      const row = db.prepare('SELECT id, name, status, event_date, venue_name, guest_count FROM quotes WHERE id = ? AND org_id = ?').get(ref.id, ORG_ID);
      if (row) rows.push(`Project ${row.id}: ${row.name || `Quote ${row.id}`} · ${row.status || 'draft'}${row.event_date ? ` · ${row.event_date}` : ''}${row.venue_name ? ` · ${row.venue_name}` : ''}${row.guest_count ? ` · ${row.guest_count} guests` : ''}`);
    } else if (ref.type === 'client') {
      const row = db.prepare('SELECT id, name, email, phone FROM clients WHERE id = ?').get(ref.id);
      if (row) rows.push(`Client ${row.id}: ${row.name || 'Unnamed client'}${row.email ? ` · ${row.email}` : ''}${row.phone ? ` · ${row.phone}` : ''}`);
    } else if (ref.type === 'venue') {
      const row = db.prepare('SELECT id, name, address, contact_name FROM venues WHERE id = ?').get(ref.id);
      if (row) rows.push(`Venue ${row.id}: ${row.name || 'Unnamed venue'}${row.address ? ` · ${row.address}` : ''}${row.contact_name ? ` · ${row.contact_name}` : ''}`);
    } else if (ref.type === 'item') {
      const row = db.prepare('SELECT id, title, category, quantity_in_stock, unit_price FROM items WHERE id = ?').get(ref.id);
      if (row) rows.push(`Item ${row.id}: ${row.title || 'Untitled item'}${row.category ? ` · ${row.category}` : ''} · stock ${Number(row.quantity_in_stock || 0)} · $${Number(row.unit_price || 0).toFixed(2)}`);
    }
  }
  return rows;
}

async function buildQuoteContext(db, quoteId) {
  const quote = requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const detail = await quoteCoreService.getQuoteDetail(db, quoteId, {
    quoteSectionService,
    route: 'onyx-quote-chat',
  });
  const visibleItems = (detail.items || []).filter((item) => Number(item.hidden_from_quote || 0) !== 1);
  const similarQuotes = quotePatternMemoryService.listSimilarQuotes(db, quoteId, 3);
  const recentMessages = db.prepare(`
    SELECT direction, from_email, body_text, sent_at
    FROM messages
    WHERE quote_id = ?
    ORDER BY id DESC
    LIMIT 5
  `).all(Number(quoteId));

  return [
    `Project: ${quote.name || `Quote ${quote.id}`}`,
    `Status: ${quote.status || 'draft'}`,
    quote.event_date ? `Event date: ${quote.event_date}` : '',
    detail.venue_name ? `Venue: ${detail.venue_name}` : '',
    detail.client_email ? `Client email: ${detail.client_email}` : '',
    detail.guest_count ? `Guest count: ${detail.guest_count}` : '',
    `Visible line items: ${visibleItems.map((item) => `${item.label || item.title} x${Number(item.quantity || 0)}`).slice(0, 12).join(' | ') || 'none'}`,
    similarQuotes.length
      ? `Similar quotes: ${similarQuotes.map((entry) => `${entry.quote_name} (score ${entry.score})`).join(' | ')}`
      : '',
    recentMessages.length
      ? `Recent quote thread messages: ${recentMessages.map((row) => `${row.direction} ${row.from_email || 'unknown'}: ${String(row.body_text || '').replace(/\s+/g, ' ').slice(0, 180)}`).join(' | ')}`
      : '',
  ].filter(Boolean).join('\n');
}

function buildTeamContext(db, message) {
  const entitySummaries = summarizeEntityRefs(db, message);
  if (!entitySummaries.length) return '';
  return `Referenced BadShuffle records:\n${entitySummaries.join('\n')}`;
}

function teamChatFallbackEnabled(db) {
  return String(getSettingValue(db, 'team_chat_ai_fallback_enabled', '1') || '1') === '1';
}

function buildThreadHistory(db, threadId) {
  return db.prepare(`
    SELECT role, body_text
    FROM team_chat_messages
    WHERE thread_id = ?
    ORDER BY id DESC
    LIMIT 8
  `).all(Number(threadId)).reverse().map((row) => ({
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.body_text || '',
  }));
}

async function tryFallbackAssistantReply(db, thread, message) {
  if (!teamChatFallbackEnabled(db)) return null;
  const history = buildThreadHistory(db, thread.id);
  const context = buildTeamContext(db, message);
  return generateGenericAssistantReply(db, {
    systemPrompt: [
      'You are BadShuffle Team Chat Assistant, an internal operations copilot for event rental staff.',
      'Answer the team directly and concisely.',
      'You are read-only. Do not claim that you changed records, sent messages, or reserved inventory.',
      'Use the provided BadShuffle context when available, and if information is missing, say so plainly.',
    ].join(' '),
    history,
    userPrompt: message,
    contextSections: [
      `Thread: ${thread.title || 'Team chat'}`,
      context || '',
    ],
    temperature: 0.35,
    maxTokens: 700,
  });
}

async function ensureQuoteAiThread(db, quoteId, actor) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const existing = db.prepare(`
    SELECT *
    FROM team_chat_threads
    WHERE org_id = ? AND thread_type = 'quote' AND quote_id = ?
    LIMIT 1
  `).get(ORG_ID, Number(quoteId));
  if (existing) return getThreadById(db, existing.id, 'quote');
  const quote = db.prepare('SELECT id, name FROM quotes WHERE id = ? AND org_id = ?').get(Number(quoteId), ORG_ID);
  const result = db.prepare(`
    INSERT INTO team_chat_threads (
      org_id, thread_type, title, quote_id, created_by_user_id, created_at, updated_at, last_message_at
    ) VALUES (?, 'quote', ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
  `).run(ORG_ID, quote?.name || `Quote ${quoteId} AI`, Number(quoteId), actor?.sub || actor?.id || null);
  return getThreadById(db, result.lastInsertRowid, 'quote');
}

async function sendTeamChatMessage(db, threadId, body, actor) {
  const thread = getThreadById(db, threadId, 'team');
  const message = cleanText(body?.message);
  if (!message) {
    const error = new Error('message required');
    error.statusCode = 400;
    throw error;
  }

  const savedUser = saveThreadMessage(db, {
    threadId: thread.id,
    role: 'user',
    bodyText: message,
    source: 'local',
    actor,
  });

  let sessionId = thread.onyx_chat_session_id;
  let personaId = thread.onyx_persona_id;
  let ai;
  try {
    if (!sessionId) {
      const session = await onyxService.createChatSession(db, {
        mode: 'team',
        title: thread.title,
        description: thread.title,
      });
      sessionId = session.chatSessionId;
      personaId = session.personaId;
      db.prepare("UPDATE team_chat_threads SET onyx_chat_session_id = ?, onyx_persona_id = ?, updated_at = datetime('now') WHERE id = ?").run(sessionId, personaId, thread.id);
    }

    ai = await onyxService.sendChatMessage(db, {
      mode: 'team',
      message,
      chatSessionId: sessionId,
      description: thread.title,
      additionalContext: buildTeamContext(db, message),
    });
  } catch (error) {
    let fallbackReply = null;
    try {
      fallbackReply = await tryFallbackAssistantReply(db, thread, message);
    } catch (fallbackError) {
      fallbackReply = {
        content: buildAiFailureText(fallbackError, 'Team chat AI is currently unavailable.'),
        provider: 'system',
        model: 'fallback-error',
        mode: 'error',
      };
    }
    const savedAssistant = saveThreadMessage(db, {
      threadId: thread.id,
      role: 'assistant',
      bodyText: fallbackReply?.content || buildAiFailureText(error, 'Team chat AI is currently unavailable.'),
      source: fallbackReply ? 'fallback' : 'system',
      actor,
      metadata: {
        ai_unavailable: !fallbackReply,
        onyx_unavailable: true,
        fallback_used: Boolean(fallbackReply),
        fallback_provider: fallbackReply?.provider || null,
        fallback_model: fallbackReply?.model || null,
        error_message: error?.message || 'Team chat AI is currently unavailable.',
      },
    });
    return {
      thread: getThreadById(db, thread.id, 'team'),
      user_message: toMessagePayload(savedUser),
      assistant_message: toMessagePayload(savedAssistant),
    };
  }

  const savedAssistant = saveThreadMessage(db, {
    threadId: thread.id,
    role: 'assistant',
    bodyText: ai.answer || ai.answerCitationless || 'No response returned.',
    source: 'onyx',
    onyxMessageId: ai.onyxMessageId,
    actor,
    metadata: {
      citations: ai.citationInfo,
      top_documents: ai.topDocuments,
      tool_calls: ai.toolCalls,
      onyx_chat_session_id: ai.chatSessionId || sessionId,
      onyx_persona_id: ai.personaId || personaId,
    },
  });

  return {
    thread: getThreadById(db, thread.id, 'team'),
    user_message: toMessagePayload(savedUser),
    assistant_message: toMessagePayload(savedAssistant),
  };
}

async function sendQuoteAiMessage(db, quoteId, body, actor) {
  const thread = await ensureQuoteAiThread(db, quoteId, actor);
  const message = cleanText(body?.message);
  if (!message) {
    const error = new Error('message required');
    error.statusCode = 400;
    throw error;
  }

  const savedUser = saveThreadMessage(db, {
    threadId: thread.id,
    role: 'user',
    bodyText: message,
    source: 'local',
    actor,
  });

  let sessionId = thread.onyx_chat_session_id;
  let personaId = thread.onyx_persona_id;
  let ai;
  try {
    if (!sessionId) {
      const session = await onyxService.createChatSession(db, {
        mode: 'quote',
        title: thread.title,
        description: `${thread.title} quote AI conversation`,
      });
      sessionId = session.chatSessionId;
      personaId = session.personaId;
      db.prepare("UPDATE team_chat_threads SET onyx_chat_session_id = ?, onyx_persona_id = ?, updated_at = datetime('now') WHERE id = ?").run(sessionId, personaId, thread.id);
    }

    ai = await onyxService.sendChatMessage(db, {
      mode: 'quote',
      message,
      chatSessionId: sessionId,
      description: thread.title,
      additionalContext: await buildQuoteContext(db, quoteId),
    });
  } catch (error) {
    const savedAssistant = saveThreadMessage(db, {
      threadId: thread.id,
      role: 'assistant',
      bodyText: buildAiFailureText(error, 'Quote AI is currently unavailable.'),
      source: 'system',
      actor,
      metadata: {
        ai_unavailable: true,
        error_message: error?.message || 'Quote AI is currently unavailable.',
        quote_id: Number(quoteId),
      },
    });
    return {
      thread: getThreadById(db, thread.id, 'quote'),
      user_message: toMessagePayload(savedUser),
      assistant_message: toMessagePayload(savedAssistant),
    };
  }

  const savedAssistant = saveThreadMessage(db, {
    threadId: thread.id,
    role: 'assistant',
    bodyText: ai.answer || ai.answerCitationless || 'No response returned.',
    source: 'onyx',
    onyxMessageId: ai.onyxMessageId,
    actor,
    metadata: {
      citations: ai.citationInfo,
      top_documents: ai.topDocuments,
      tool_calls: ai.toolCalls,
      onyx_chat_session_id: ai.chatSessionId || sessionId,
      onyx_persona_id: ai.personaId || personaId,
      quote_id: Number(quoteId),
    },
  });

  return {
    thread: getThreadById(db, thread.id, 'quote'),
    user_message: toMessagePayload(savedUser),
    assistant_message: toMessagePayload(savedAssistant),
  };
}

async function listQuoteAiMessages(db, quoteId, actor) {
  const thread = await ensureQuoteAiThread(db, quoteId, actor);
  return {
    thread,
    messages: listThreadMessages(db, thread.id),
  };
}

module.exports = {
  listTeamThreads,
  createTeamThread,
  listThreadMessages,
  sendTeamChatMessage,
  listQuoteAiMessages,
  sendQuoteAiMessage,
};

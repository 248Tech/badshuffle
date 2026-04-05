const quoteRepository = require('../db/repositories/quoteRepository');
const quoteService = require('./quoteService');
const quoteSectionService = require('./quoteSectionService');
const quoteCoreService = require('./quoteCoreService');
const { requireQuoteById } = require('../db/queries/quotes');
const { generateAssistantReply } = require('./agent/agentProviderService');
const { suggestItems } = require('./agent/itemSuggestionService');
const quotePricingEngineService = require('./quotePricingEngineService');
const quotePatternMemoryService = require('./quotePatternMemoryService');

const ORG_ID = 1;
const MAX_HISTORY = 24;

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeMessage(text) {
  return String(text || '').replace(/\r/g, '').trim();
}

function listMessages(db, quoteId) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const rows = db.prepare(`
    SELECT id, quote_id, role, content, metadata_json, created_at, created_by, user_email
    FROM quote_agent_messages
    WHERE quote_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(Number(quoteId), MAX_HISTORY).reverse();

  return {
    messages: rows.map((row) => ({
      id: row.id,
      quote_id: row.quote_id,
      role: row.role,
      content: row.content,
      metadata: parseMetadata(row.metadata_json),
      created_at: row.created_at,
      created_by: row.created_by,
      user_email: row.user_email,
    })),
  };
}

function parseMetadata(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildToolPreview(toolResults) {
  return toolResults.map((entry) => {
    if (entry.name === 'quote_financials') {
      return {
        name: entry.name,
        label: 'Financials',
        summary: `Total $${Number(entry.result.total || 0).toFixed(2)} • Remaining $${Number(entry.result.remaining_balance || 0).toFixed(2)}`,
      };
    }
    if (entry.name === 'inventory_pressure') {
      const count = Array.isArray(entry.result.pressure_items) ? entry.result.pressure_items.length : 0;
      return {
        name: entry.name,
        label: 'Inventory Pressure',
        summary: count > 0
          ? entry.result.pressure_items.slice(0, 3).map((item) => `${item.title} ${item.requested}/${item.in_stock}`).join(' • ')
          : 'No current shortage flags',
      };
    }
    if (entry.name === 'item_recommendations') {
      return {
        name: entry.name,
        label: 'Recommendations',
        summary: (entry.result.suggestions || []).slice(0, 3).map((item) => item.title).join(' • ') || 'No recommendations',
      };
    }
    if (entry.name === 'similar_quotes') {
      return {
        name: entry.name,
        label: 'Similar Quotes',
        summary: (entry.result.matches || []).slice(0, 3).map((item) => item.quote_name).join(' • ') || 'No strong pattern matches',
      };
    }
    if (entry.name === 'quote_line_items') {
      return {
        name: entry.name,
        label: 'Quoted Items',
        summary: (entry.result.items || []).slice(0, 4).map((item) => `${item.title} x${item.quantity}`).join(' • ') || 'No line items',
      };
    }
    if (entry.name === 'activity_digest') {
      return {
        name: entry.name,
        label: 'Recent Activity',
        summary: (entry.result.recent_events || []).slice(0, 2).map((item) => item.description).join(' • ') || 'No recent activity',
      };
    }
    if (entry.name === 'client_follow_up_draft') {
      return {
        name: entry.name,
        label: 'Follow-up Draft',
        summary: entry.result.subject || 'Draft prepared',
      };
    }
    if (entry.name === 'quote_overview') {
      return {
        name: entry.name,
        label: 'Overview',
        summary: `${entry.result.status || 'draft'} • ${entry.result.item_count || 0} items • ${entry.result.guest_count || 0} guests`,
      };
    }
    return {
      name: entry.name,
      label: entry.name,
      summary: 'Tool data available',
    };
  });
}

function buildAssistantEvidence(toolResults) {
  const similarQuotes = toolResults.find((entry) => entry.name === 'similar_quotes')?.result?.matches || [];
  const recommendations = toolResults.find((entry) => entry.name === 'item_recommendations')?.result || null;
  const inventoryPressure = toolResults.find((entry) => entry.name === 'inventory_pressure')?.result || null;
  const lineItems = toolResults.find((entry) => entry.name === 'quote_line_items')?.result || null;

  return {
    similar_quotes: similarQuotes.slice(0, 4),
    pattern_suggestions: Array.isArray(recommendations?.pattern_suggestions) ? recommendations.pattern_suggestions.slice(0, 4) : [],
    recommendation_suggestions: Array.isArray(recommendations?.suggestions) ? recommendations.suggestions.slice(0, 5) : [],
    pressure_items: Array.isArray(inventoryPressure?.pressure_items) ? inventoryPressure.pressure_items.slice(0, 5) : [],
    visible_items: Array.isArray(lineItems?.items) ? lineItems.items.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      category: item.category || null,
      section_title: item.section_title || null,
    })) : [],
  };
}

function saveMessage(db, quoteId, role, content, actor, metadata = null) {
  const result = db.prepare(`
    INSERT INTO quote_agent_messages (
      quote_id, role, content, metadata_json, created_by, user_email
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    Number(quoteId),
    role,
    content,
    metadata ? JSON.stringify(metadata) : null,
    actor?.sub || actor?.id || null,
    actor?.email || null,
  );

  return db.prepare(`
    SELECT id, quote_id, role, content, metadata_json, created_at, created_by, user_email
    FROM quote_agent_messages
    WHERE id = ?
  `).get(result.lastInsertRowid);
}

async function buildOverviewTool(db, quoteId, options = {}) {
  const detail = await quoteCoreService.getQuoteDetail(db, quoteId, {
    quoteSectionService,
    diagnostics: options.diagnostics,
    requestId: options.requestId,
    route: 'quote-assistant-overview',
  });
  const clientName = [detail.client_first_name, detail.client_last_name].filter(Boolean).join(' ').trim();
  const visibleItems = (detail.items || []).filter((item) => Number(item.hidden_from_quote || 0) !== 1);
  const sectionMap = new Map((detail.sections || []).map((section) => [Number(section.id), section]));
  return {
    name: 'quote_overview',
    result: {
      id: detail.id,
      name: detail.name,
      status: detail.status || 'draft',
      event_type: detail.event_type || null,
      event_date: detail.event_date || null,
      client_name: clientName || null,
      client_email: detail.client_email || null,
      venue_name: detail.venue_name || null,
      venue_address: detail.venue_address || null,
      guest_count: Number(detail.guest_count || 0),
      item_count: visibleItems.length,
      custom_item_count: (detail.customItems || []).length,
      section_count: (detail.sections || []).length,
      is_expired: !!detail.is_expired,
      has_unsigned_changes: Number(detail.has_unsigned_changes || 0) === 1,
      visible_items: visibleItems.slice(0, 10).map((item) => ({
        id: Number(item.item_id || item.id),
        title: item.label || item.title,
        quantity: Number(item.quantity || 0),
        category: item.category || null,
        section_title: sectionMap.get(Number(item.section_id))?.title || null,
      })),
    },
    detail,
  };
}

async function buildFinancialsTool(db, quote, detail, options = {}) {
  const totals = await quotePricingEngineService.computeQuoteTotals(db, quote.id, quote.tax_rate, {
    diagnostics: options.diagnostics,
    requestId: options.requestId,
    route: 'quote-assistant-financials',
  });
  const amountPaid = Number(detail.amount_paid || 0);
  return {
    name: 'quote_financials',
    result: {
      subtotal: totals.subtotal,
      delivery_total: totals.deliveryTotal,
      custom_subtotal: totals.customSubtotal,
      adjustments_total: totals.adjTotal,
      tax: totals.tax,
      total: totals.total,
      amount_paid: amountPaid,
      remaining_balance: totals.total - amountPaid,
      rate: totals.rate,
    },
  };
}

function buildInventoryPressureTool(db, detail) {
  const itemIds = [...new Set((detail.items || []).map((item) => Number(item.id)).filter(Boolean))];
  const stockByItemId = new Map();
  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => '?').join(',');
    const stockRows = db.prepare(`
      SELECT id, quantity_in_stock
      FROM items
      WHERE id IN (${placeholders})
    `).all(...itemIds);
    stockRows.forEach((row) => {
      stockByItemId.set(Number(row.id), Number(row.quantity_in_stock || 0));
    });
  }

  const pressureItems = (detail.items || []).reduce((acc, item) => {
    const requested = Number(item.quantity || 0);
    const inStock = stockByItemId.has(Number(item.id)) ? stockByItemId.get(Number(item.id)) : 0;
    if (requested > inStock && inStock >= 0) {
      acc.push({
        item_id: item.id,
        title: item.label || item.title,
        requested,
        in_stock: inStock,
        shortage: requested - inStock,
      });
    }
    return acc;
  }, []);

  return {
    name: 'inventory_pressure',
    result: {
      pressure_items: pressureItems,
      hidden_items: (detail.items || []).filter((item) => Number(item.hidden_from_quote || 0) === 1).length,
      logistics_items: (detail.items || []).filter((item) => String(item.category || '').toLowerCase().includes('logistics')).length,
    },
  };
}

function buildActivityDigestTool(db, quoteId) {
  const activity = quoteRepository.listQuoteActivityEntries(db, quoteId).slice(0, 8);
  return {
    name: 'activity_digest',
    result: {
      recent_events: activity.map((entry) => ({
        created_at: entry.created_at,
        event_type: entry.event_type,
        description: entry.description,
        user_email: entry.user_email || null,
      })),
    },
  };
}

async function buildRecommendationsTool(db, detail) {
  const sectionMap = new Map((detail.sections || []).map((section) => [Number(section.id), section]));
  const visibleItems = (detail.items || []).filter((item) => Number(item.hidden_from_quote || 0) !== 1);
  const currentItemIds = visibleItems.map((item) => Number(item.item_id || item.id));
  const suggestions = await suggestItems(db, {
    guest_count: detail.guest_count || 0,
    event_type: detail.event_type || 'event',
    current_items: currentItemIds,
    current_item_details: visibleItems.map((item) => ({
      id: Number(item.item_id || item.id),
      title: item.label || item.title,
      quantity: Number(item.quantity || 0),
      category: item.category || '',
      section_title: sectionMap.get(Number(item.section_id))?.title || '',
    })),
    quote_name: detail.name || '',
    venue_name: detail.venue_name || '',
    section_titles: (detail.sections || []).map((section) => section.title).filter(Boolean),
  });
  const patternSuggestions = quotePatternMemoryService.getPatternSuggestions(db, detail.id, 4);
  const seen = new Set();
  const merged = [];
  patternSuggestions.forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    merged.push({ id: item.id, title: item.title, reason: `${item.reason}.`, source: 'memory', supporting_quotes: item.supporting_quotes || [] });
  });
  (suggestions.suggestions || []).forEach((item) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    merged.push({ id: item.id, title: item.title, reason: item.reason, source: suggestions.source || 'llm', supporting_quotes: [] });
  });
  return {
    name: 'item_recommendations',
    result: {
      source: patternSuggestions.length ? `${suggestions.source}+memory` : suggestions.source,
      suggestions: merged.slice(0, 5),
      pattern_suggestions: patternSuggestions,
    },
  };
}

function buildLineItemsTool(detail) {
  const sectionMap = new Map((detail.sections || []).map((section) => [Number(section.id), section]));
  const items = (detail.items || [])
    .filter((item) => Number(item.hidden_from_quote || 0) !== 1)
    .map((item) => ({
      id: Number(item.item_id || item.id),
      qitem_id: Number(item.qitem_id),
      title: item.label || item.title,
      quantity: Number(item.quantity || 0),
      category: item.category || null,
      section_title: sectionMap.get(Number(item.section_id))?.title || null,
      unit_price: item.unit_price_override != null ? Number(item.unit_price_override || 0) : Number(item.unit_price || 0),
      quantity_in_stock: Number(item.quantity_in_stock || 0),
      is_subrental: Number(item.is_subrental || 0) === 1,
    }));
  const customItems = (detail.customItems || []).map((item) => ({
    id: Number(item.id),
    title: item.title,
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    section_title: sectionMap.get(Number(item.section_id))?.title || null,
    type: 'custom',
  }));

  return {
    name: 'quote_line_items',
    result: {
      items,
      custom_items: customItems,
    },
  };
}

function buildSimilarQuotesTool(db, quoteId) {
  const matches = quotePatternMemoryService.listSimilarQuotes(db, quoteId, 5);
  return {
    name: 'similar_quotes',
    result: {
      matches: matches.map((entry) => ({
        quote_id: entry.quote_id,
        quote_name: entry.quote_name,
        status: entry.status,
        event_date: entry.event_date,
        venue_name: entry.venue_name,
        client_name: entry.client_name,
        total: entry.total,
        score: entry.score,
        reasons: entry.reasons,
        tags: entry.tags,
      })),
    },
  };
}

function buildDraftFollowUpTool(quote, detail, financials) {
  const clientName = [detail.client_first_name, detail.client_last_name].filter(Boolean).join(' ').trim() || 'there';
  const eventDate = detail.event_date || 'your event date';
  return {
    name: 'client_follow_up_draft',
    result: {
      subject: `Next steps for ${quote.name || 'your event quote'}`,
      body: [
        `Hi ${clientName},`,
        '',
        `I wanted to follow up on your quote for ${quote.name || 'your event'} on ${eventDate}.`,
        `The current total is $${financials.result.total.toFixed(2)} and the remaining balance is $${financials.result.remaining_balance.toFixed(2)}.`,
        '',
        'Let me know if you want any revisions, additional items, or if you are ready for the next approval step.',
        '',
        'Thanks,',
        'BadShuffle team',
      ].join('\n'),
    },
  };
}

function chooseToolNames(prompt) {
  const text = String(prompt || '').toLowerCase();
  const names = new Set(['quote_overview', 'quote_financials', 'quote_line_items']);
  if (/item|inventory|add|recommend|suggest|chair|table|linen|decor/.test(text)) names.add('item_recommendations');
  if (/risk|issue|problem|history|recent|change|status|what happened|log|similar|pattern|usual|typically|like before|past quote/.test(text)) names.add('activity_digest');
  if (/similar|pattern|usual|typically|like before|past quote|repeat|recurring/.test(text)) names.add('similar_quotes');
  if (/balance|payment|deposit|invoice|revenue|money|price|cost|total/.test(text)) names.add('quote_financials');
  if (/item|items|quantity|quantities|how many|section|line item|what's on the quote/.test(text)) names.add('quote_line_items');
  if (/stock|inventory|oversold|shortage|pressure|available/.test(text)) names.add('inventory_pressure');
  if (/email|follow up|follow-up|message|client reply|draft/.test(text)) names.add('client_follow_up_draft');
  if (names.size < 3) {
    names.add('activity_digest');
    names.add('inventory_pressure');
    names.add('similar_quotes');
  }
  return Array.from(names);
}

async function buildToolResults(db, quoteId, prompt, options = {}) {
  const overview = await buildOverviewTool(db, quoteId, options);
  const quote = overview.detail;
  const financials = await buildFinancialsTool(db, quote, overview.detail, options);
  const lineItems = buildLineItemsTool(overview.detail);
  const inventoryPressure = buildInventoryPressureTool(db, overview.detail);
  const activityDigest = buildActivityDigestTool(db, quoteId);
  const similarQuotes = buildSimilarQuotesTool(db, quoteId);
  const recommendations = await buildRecommendationsTool(db, overview.detail);
  const followUpDraft = buildDraftFollowUpTool(quote, overview.detail, financials);

  const toolMap = new Map([
    ['quote_overview', { name: 'quote_overview', result: overview.result }],
    ['quote_financials', financials],
    ['quote_line_items', lineItems],
    ['inventory_pressure', inventoryPressure],
    ['activity_digest', activityDigest],
    ['similar_quotes', similarQuotes],
    ['item_recommendations', recommendations],
    ['client_follow_up_draft', followUpDraft],
  ]);

  const selectedNames = chooseToolNames(prompt);
  return {
    quote,
    historySeed: listMessages(db, quoteId).messages,
    toolResults: selectedNames.map((name) => toolMap.get(name)).filter(Boolean),
  };
}

async function submitMessage(db, quoteId, body, actor, options = {}) {
  requireQuoteById(db, quoteId, 'Not found', ORG_ID);
  const prompt = normalizeMessage(body?.message);
  if (!prompt) throw createError(400, 'message required');

  const savedUser = saveMessage(db, quoteId, 'user', prompt, actor, null);
  const context = await buildToolResults(db, quoteId, prompt, options);
  const history = context.historySeed.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));

  const reply = await generateAssistantReply(db, {
    prompt,
    quote: context.quote,
    toolResults: context.toolResults,
    history,
  });

  const savedAssistant = saveMessage(
    db,
    quoteId,
    'assistant',
    reply.content,
    actor,
    {
      provider: reply.provider,
      model: reply.model,
      mode: reply.mode,
      tools: context.toolResults.map((entry) => entry.name),
      tool_preview: buildToolPreview(context.toolResults),
      evidence: buildAssistantEvidence(context.toolResults),
    },
  );

  return {
    user_message: {
      ...savedUser,
      metadata: parseMetadata(savedUser.metadata_json),
    },
    assistant_message: {
      ...savedAssistant,
      metadata: parseMetadata(savedAssistant.metadata_json),
    },
    tool_results: context.toolResults,
  };
}

module.exports = {
  listMessages,
  submitMessage,
  clearHistory(db, quoteId) {
    requireQuoteById(db, quoteId, 'Not found', ORG_ID);
    const result = db.prepare('DELETE FROM quote_agent_messages WHERE quote_id = ?').run(Number(quoteId));
    return { ok: true, deleted: Number(result.changes || 0) };
  },
};

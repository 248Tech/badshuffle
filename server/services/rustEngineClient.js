const fetch = require('node-fetch');

function getRustEngineUrl() {
  return String(process.env.RUST_ENGINE_URL || 'http://127.0.0.1:3101').replace(/\/+$/, '');
}

function getRustEngineTimeoutMs() {
  const n = Number(process.env.RUST_ENGINE_TIMEOUT_MS || 2500);
  if (!Number.isFinite(n) || n <= 0) return 2500;
  return Math.max(250, n);
}

function isRustInventoryEnabled() {
  return String(process.env.USE_RUST_INVENTORY || '0') === '1';
}

function isRustInventoryShadowMode() {
  return String(process.env.RUST_INVENTORY_SHADOW_MODE || '0') === '1';
}

function isRustPricingEnabled() {
  return String(process.env.USE_RUST_PRICING || '0') === '1';
}

function isRustPricingShadowMode() {
  return String(process.env.RUST_PRICING_SHADOW_MODE || '0') === '1';
}

async function postJson(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRustEngineTimeoutMs());
  try {
    const response = await fetch(`${getRustEngineUrl()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      throw new Error(`Rust engine returned invalid JSON (${response.status})`);
    }
    if (!response.ok) {
      const message = data?.message || data?.error || `Rust engine request failed (${response.status})`;
      throw new Error(message);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkQuoteItems({ quoteId, itemIds, sectionId = null, requestId = null }) {
  return postJson('/engine/inventory/check', {
    action: 'quote_items',
    quoteId,
    itemIds,
    sectionId,
    requestId,
  });
}

async function checkQuoteSummary({ quoteId, requestId = null }) {
  return postJson('/engine/inventory/check', {
    action: 'quote_summary',
    quoteId,
    requestId,
  });
}

async function checkConflicts({ requestId = null } = {}) {
  return postJson('/engine/inventory/check', {
    action: 'conflicts',
    quoteId: 0,
    requestId,
  });
}

async function checkQuotePricing({ quoteId, explicitTaxRate = null, requestId = null }) {
  return postJson('/engine/pricing/check', {
    quoteId,
    explicitTaxRate,
    requestId,
  });
}

function normalizeCheckResult(payload) {
  return payload?.result || null;
}

module.exports = {
  getRustEngineUrl,
  getRustEngineTimeoutMs,
  isRustInventoryEnabled,
  isRustInventoryShadowMode,
  isRustPricingEnabled,
  isRustPricingShadowMode,
  checkQuoteItems,
  checkQuoteSummary,
  checkConflicts,
  checkQuotePricing,
  normalizeCheckResult,
};

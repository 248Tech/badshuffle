const rustEngineClient = require('./rustEngineClient');
const { computeQuoteTotalsLegacy } = require('./quotePricingCore');

function isRustPricingEnabled() {
  return String(process.env.USE_RUST_PRICING || '0') === '1';
}

function isRustPricingShadowMode() {
  return String(process.env.RUST_PRICING_SHADOW_MODE || '0') === '1';
}

function normalizeTotals(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    subtotal: Number(value.subtotal || 0),
    deliveryTotal: Number(value.deliveryTotal != null ? value.deliveryTotal : value.delivery_total || 0),
    customSubtotal: Number(value.customSubtotal != null ? value.customSubtotal : value.custom_subtotal || 0),
    adjTotal: Number(value.adjTotal != null ? value.adjTotal : value.adjustment_total || 0),
    taxableAmount: Number(value.taxableAmount != null ? value.taxableAmount : value.taxable_amount || 0),
    rate: Number(value.rate != null ? value.rate : value.tax_rate || 0),
    tax: Number(value.tax || 0),
    total: Number(value.total || 0),
  };
}

function diffTotals(legacy, rust) {
  if (!legacy || !rust) return { legacy, rust };
  const keys = ['subtotal', 'deliveryTotal', 'customSubtotal', 'adjTotal', 'taxableAmount', 'rate', 'tax', 'total'];
  const changed = keys
    .map((key) => {
      const leftValue = Number(legacy[key] || 0);
      const rightValue = Number(rust[key] || 0);
      const delta = Number((rightValue - leftValue).toFixed(6));
      return Math.abs(delta) > 0.000001 ? { key, legacy: leftValue, rust: rightValue, delta } : null;
    })
    .filter(Boolean);
  return changed.length ? { changed } : null;
}

function recordDiagnostic(diagnostics, kind, data) {
  try {
    diagnostics?.recordErrorTrail?.(kind, {
      rust_domain: 'pricing',
      ...data,
    });
  } catch (error) {}
}

async function computeQuoteTotals(db, quoteOrId, explicitTaxRate = null, options = {}) {
  const legacy = normalizeTotals(computeQuoteTotalsLegacy(db, quoteOrId, explicitTaxRate, {
    loadQuote: options.loadQuote,
  }));
  const quoteId = Number(typeof quoteOrId === 'object' ? quoteOrId?.id : quoteOrId);
  const rustEnabled = isRustPricingEnabled();
  const shadowMode = isRustPricingShadowMode();
  const shouldCallRust = (rustEnabled || shadowMode) && Number.isFinite(quoteId) && quoteId > 0;
  if (!shouldCallRust) return legacy;

  try {
    const rustPayload = await rustEngineClient.checkQuotePricing({
      quoteId,
      explicitTaxRate,
      requestId: options.requestId || null,
    });
    const rust = normalizeTotals(rustEngineClient.normalizeCheckResult(rustPayload));
    if (!rust) {
      throw new Error('Rust pricing engine returned an empty result');
    }
    const diff = diffTotals(legacy, rust);

    if (diff) {
      recordDiagnostic(options.diagnostics, 'rust-pricing-mismatch', {
        quoteId,
        route: options.route || null,
        requestId: options.requestId || null,
        diff,
      });
    }

    return rustEnabled ? rust : legacy;
  } catch (error) {
    recordDiagnostic(options.diagnostics, 'rust-pricing-fallback', {
      quoteId,
      route: options.route || null,
      requestId: options.requestId || null,
      error: error?.message || String(error),
      rust_enabled: rustEnabled,
      shadow_mode: shadowMode,
    });
    return legacy;
  }
}

module.exports = {
  isRustPricingEnabled,
  isRustPricingShadowMode,
  normalizeTotals,
  computeQuoteTotals,
};

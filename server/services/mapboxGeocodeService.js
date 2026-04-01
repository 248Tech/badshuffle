const { getQuoteById } = require('../db/queries/quotes');
const { getSettingValue } = require('../db/queries/settings');

const ORG_ID = 1;

function trimAddress(value) {
  const next = String(value || '').trim();
  return next || null;
}

function resolveQuoteMapAddress(quote) {
  const venueAddress = trimAddress(quote?.venue_address);
  if (venueAddress) {
    return { source: 'venue_address', text: venueAddress };
  }
  const clientAddress = trimAddress(quote?.client_address);
  if (clientAddress) {
    return { source: 'client_address', text: clientAddress };
  }
  return { source: null, text: null };
}

async function geocodeAddress(address, token) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${encodeURIComponent(token)}&limit=1&autocomplete=false`;
    const resp = await fetch(url, { signal: controller.signal });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.message || data.error || `Mapbox geocoding failed (${resp.status})`);
    }
    const feature = Array.isArray(data.features) ? data.features[0] : null;
    const center = Array.isArray(feature?.center) ? feature.center : null;
    if (!center || center.length < 2) {
      throw new Error('Address not found');
    }
    return { lng: Number(center[0]), lat: Number(center[1]) };
  } finally {
    clearTimeout(timeoutId);
  }
}

function persistMissingAddress(db, quoteId) {
  db.prepare(`
    UPDATE quotes
    SET map_address_source = NULL,
        map_address_text = NULL,
        map_lat = NULL,
        map_lng = NULL,
        map_geocoded_at = NULL,
        map_geocode_status = 'missing_address',
        updated_at = datetime('now')
    WHERE id = ? AND org_id = ?
  `).run(quoteId, ORG_ID);
}

function persistFailedGeocode(db, quoteId, resolved) {
  db.prepare(`
    UPDATE quotes
    SET map_address_source = ?,
        map_address_text = ?,
        map_lat = NULL,
        map_lng = NULL,
        map_geocoded_at = NULL,
        map_geocode_status = 'failed',
        updated_at = datetime('now')
    WHERE id = ? AND org_id = ?
  `).run(resolved.source, resolved.text, quoteId, ORG_ID);
}

function persistGeocodeSuccess(db, quoteId, resolved, coords) {
  db.prepare(`
    UPDATE quotes
    SET map_address_source = ?,
        map_address_text = ?,
        map_lat = ?,
        map_lng = ?,
        map_geocoded_at = datetime('now'),
        map_geocode_status = 'ok',
        updated_at = datetime('now')
    WHERE id = ? AND org_id = ?
  `).run(resolved.source, resolved.text, coords.lat, coords.lng, quoteId, ORG_ID);
}

async function syncQuoteMapCache(db, quoteId, options = {}) {
  const quote = getQuoteById(db, quoteId, ORG_ID);
  if (!quote) return null;

  const resolved = resolveQuoteMapAddress(quote);
  if (!resolved.text) {
    persistMissingAddress(db, quoteId);
    return getQuoteById(db, quoteId, ORG_ID);
  }

  const hasCoords = quote.map_lat != null && quote.map_lng != null;
  const alreadyCurrent = quote.map_address_source === resolved.source
    && quote.map_address_text === resolved.text
    && quote.map_geocode_status === 'ok'
    && hasCoords;

  if (alreadyCurrent && !options.force) {
    return quote;
  }

  const token = String(options.mapboxToken != null
    ? options.mapboxToken
    : getSettingValue(db, 'mapbox_access_token', '')).trim();

  if (!token) {
    persistFailedGeocode(db, quoteId, resolved);
    return getQuoteById(db, quoteId, ORG_ID);
  }

  try {
    const coords = await geocodeAddress(resolved.text, token);
    persistGeocodeSuccess(db, quoteId, resolved, coords);
  } catch (error) {
    console.error(`[maps] Failed to geocode quote ${quoteId}:`, error?.message || error);
    persistFailedGeocode(db, quoteId, resolved);
  }

  return getQuoteById(db, quoteId, ORG_ID);
}

module.exports = {
  geocodeAddress,
  resolveQuoteMapAddress,
  syncQuoteMapCache,
};

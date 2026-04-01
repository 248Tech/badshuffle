const { getSettingValue } = require('../db/queries/settings');
const { syncQuoteMapCache } = require('./mapboxGeocodeService');

const ORG_ID = 1;
const INCLUDED_STATUSES = ['draft', 'sent', 'approved', 'confirmed', 'closed'];

function classifyPinType(status) {
  if (status === 'approved' || status === 'confirmed') return 'booked';
  if (status === 'closed') return 'closed';
  if (status === 'draft' || status === 'sent' || !status) return 'quote';
  return null;
}

function buildClientName(quote) {
  return [quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ') || null;
}

function toPin(quote) {
  const pinType = classifyPinType(quote.status || 'draft');
  if (!pinType) return null;
  if (quote.map_lat == null || quote.map_lng == null) return null;
  return {
    quote_id: Number(quote.id),
    quote_name: quote.name,
    status: quote.status || 'draft',
    pin_type: pinType,
    event_date: quote.event_date || null,
    client_name: buildClientName(quote),
    venue_name: quote.venue_name || null,
    address: quote.map_address_text || null,
    lat: Number(quote.map_lat),
    lng: Number(quote.map_lng),
  };
}

async function buildQuotePins(db) {
  const token = String(getSettingValue(db, 'mapbox_access_token', '') || '').trim();
  const mapDefaultStyle = String(getSettingValue(db, 'map_default_style', 'map') || 'map').trim() || 'map';
  const placeholders = INCLUDED_STATUSES.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT
      id,
      name,
      status,
      event_date,
      venue_name,
      venue_address,
      client_first_name,
      client_last_name,
      client_address,
      map_address_source,
      map_address_text,
      map_lat,
      map_lng,
      map_geocoded_at,
      map_geocode_status
    FROM quotes
    WHERE org_id = ?
      AND COALESCE(status, 'draft') IN (${placeholders})
    ORDER BY event_date IS NULL ASC, event_date ASC, id DESC
  `).all(ORG_ID, ...INCLUDED_STATUSES);

  const hydrated = [];
  for (const row of rows) {
    const needsSync = !!(row.venue_address || row.client_address) && (
      row.map_lat == null
      || row.map_lng == null
      || row.map_geocode_status !== 'ok'
      || !row.map_address_text
    );
    if (needsSync) {
      const synced = await syncQuoteMapCache(db, row.id, { mapboxToken: token });
      hydrated.push(synced || row);
    } else {
      hydrated.push(row);
    }
  }

  return {
    mapbox_token: token,
    map_default_style: mapDefaultStyle,
    pins: hydrated
      .map(toPin)
      .filter(Boolean),
  };
}

module.exports = {
  buildQuotePins,
};

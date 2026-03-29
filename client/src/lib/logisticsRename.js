/**
 * Per-contract logistics line labels use " - " as the canonical segment delimiter.
 * Quick-append builds from the inventory title (stable base); the user can still edit freely.
 */

export const LOGISTICS_QUICK_SEGMENTS = ['Pickup', 'Dropoff', 'Service Call'];

export function splitLogisticsSegments(name) {
  if (name == null || name === '') return [];
  return String(name)
    .split(' - ')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function joinLogisticsSegments(parts) {
  return (parts || []).filter(Boolean).join(' - ');
}

/**
 * @param {string} baseName - inventory title (stable base for quick-select)
 * @param {string} segment - e.g. "Pickup"
 * @param {'middle'|'end'} mode - middle: after first segment; end: after all segments
 */
export function appendLogisticsSegment(baseName, segment, mode) {
  const s = String(segment || '').trim();
  if (!s) return String(baseName || '').trim();

  const parts = splitLogisticsSegments(baseName);
  if (parts.length === 0) return s;

  if (mode === 'middle') {
    const first = parts[0];
    const rest = parts.slice(1);
    return joinLogisticsSegments([first, s, ...rest]);
  }

  return joinLogisticsSegments([...parts, s]);
}

function extractCityFromAddress(address) {
  const parts = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) return parts[1];
  if (parts.length === 2) return parts[0];
  return '';
}

function stripTrailingCitySuffix(name, city) {
  const suffix = ` - ${city}`.toLowerCase();
  const value = String(name || '');
  return value.toLowerCase().endsWith(suffix)
    ? value.slice(0, value.length - suffix.length)
    : value;
}

export function syncQuoteNameWithCitySuffix(name, nextAddress, enabled, prevAddress = '') {
  const baseName = String(name || '').trim();
  if (!enabled || !baseName) return baseName;

  const nextCity = extractCityFromAddress(nextAddress);
  if (!nextCity) return baseName;

  const prevCity = extractCityFromAddress(prevAddress);
  const cleanedName = prevCity ? stripTrailingCitySuffix(baseName, prevCity) : baseName;
  const targetSuffix = ` - ${nextCity}`;

  if (cleanedName.toLowerCase().endsWith(targetSuffix.toLowerCase())) return cleanedName;
  return `${cleanedName}${targetSuffix}`;
}

export { extractCityFromAddress };

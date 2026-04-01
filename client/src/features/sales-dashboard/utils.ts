import type { SalesChartPoint } from './types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const raw = String(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function startOfMonth(value: string | Date): Date {
  const date = parseDateOnly(value) || new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function formatMonth(value: string | Date): string {
  const date = startOfMonth(value);
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function fillMissingMonths(series: SalesChartPoint[], startDate: string, endDate: string): SalesChartPoint[] {
  const map = new Map(series.map((point) => [point.month, point]));
  const cursor = startOfMonth(startDate);
  const end = startOfMonth(endDate);
  const filled: SalesChartPoint[] = [];

  while (cursor <= end) {
    const month = toDateOnlyString(cursor);
    filled.push(
      map.get(month) || {
        month,
        monthLabel: formatMonth(month),
        quoteSentRevenue: 0,
        quoteSentCount: 0,
        contractSignedRevenue: 0,
        contractSignedCount: 0,
        lostRevenue: 0,
        lostCount: 0,
        totalRevenue: 0,
        totalCount: 0,
      }
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return filled;
}

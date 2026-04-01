import { api } from '../../api.js';
import type {
  PipelineStatus,
  SalesAnalyticsEntry,
  SalesAnalyticsFilters,
  SalesAnalyticsResponse,
  SalesAnalyticsViewModel,
  SalesChartPoint,
  SalesKpiGroup,
  SalesMonthDetail,
} from './types';
import { fillMissingMonths, formatMonth, parseDateOnly, toDateOnlyString } from './utils';

const transformCache = new WeakMap<SalesAnalyticsResponse, Map<string, SalesAnalyticsViewModel>>();
const STATUS_LABELS: Record<PipelineStatus, string> = {
  quoteSent: 'Quote Sent',
  contractSigned: 'Contract Signed',
  lost: 'Lost',
};

function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return part / whole;
}

function buildKpiGroup(title: string, rangeLabel: string, entries: SalesAnalyticsEntry[]): SalesKpiGroup {
  const totalRevenue = entries.reduce((sum, entry) => sum + Number(entry.revenue || 0), 0);
  const totalCount = entries.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
  const breakdown = {
    quoteSent: { label: STATUS_LABELS.quoteSent, revenue: 0, count: 0, avgRevenue: 0, shareOfRevenue: 0, shareOfCount: 0 },
    contractSigned: { label: STATUS_LABELS.contractSigned, revenue: 0, count: 0, avgRevenue: 0, shareOfRevenue: 0, shareOfCount: 0 },
    lost: { label: STATUS_LABELS.lost, revenue: 0, count: 0, avgRevenue: 0, shareOfRevenue: 0, shareOfCount: 0 },
  } as SalesKpiGroup['breakdown'];

  entries.forEach((entry) => {
    const current = breakdown[entry.pipelineStatus];
    current.revenue += Number(entry.revenue || 0);
    current.count += Number(entry.count || 0);
  });

  (Object.keys(breakdown) as PipelineStatus[]).forEach((status) => {
    const current = breakdown[status];
    current.avgRevenue = current.count ? current.revenue / current.count : 0;
    current.shareOfRevenue = percent(current.revenue, totalRevenue);
    current.shareOfCount = percent(current.count, totalCount);
  });

  return {
    title,
    rangeLabel,
    totalRevenue,
    totalCount,
    breakdown,
  };
}

function buildViewModel(raw: SalesAnalyticsResponse, filters: SalesAnalyticsFilters): SalesAnalyticsViewModel {
  const cacheKey = `${filters.startDate}:${filters.endDate}:${filters.statuses.join(',')}:${filters.staffIds.join(',')}`;
  const rawCache = transformCache.get(raw);
  const cached = rawCache?.get(cacheKey);
  if (cached) return cached;

  const entries = raw.entries.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const chartMap = new Map<string, SalesChartPoint>();
  const detailMap = new Map<string, SalesMonthDetail>();

  entries.forEach((entry) => {
    const month = entry.month;
    if (!chartMap.has(month)) {
      chartMap.set(month, {
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
      });
    }
    if (!detailMap.has(month)) {
      detailMap.set(month, {
        month,
        monthLabel: formatMonth(month),
        totals: {
          quoteSent: { revenue: 0, count: 0 },
          contractSigned: { revenue: 0, count: 0 },
          lost: { revenue: 0, count: 0 },
        },
        entries: [],
      });
    }

    const point = chartMap.get(month)!;
    const detail = detailMap.get(month)!;
    const revenue = Number(entry.revenue || 0);
    const count = Number(entry.count || 0);

    if (entry.pipelineStatus === 'quoteSent') {
      point.quoteSentRevenue += revenue;
      point.quoteSentCount += count;
    } else if (entry.pipelineStatus === 'contractSigned') {
      point.contractSignedRevenue += revenue;
      point.contractSignedCount += count;
    } else {
      point.lostRevenue += revenue;
      point.lostCount += count;
    }

    point.totalRevenue += revenue;
    point.totalCount += count;

    detail.totals[entry.pipelineStatus].revenue += revenue;
    detail.totals[entry.pipelineStatus].count += count;
    detail.entries.push(entry);
  });

  const chartData = fillMissingMonths(Array.from(chartMap.values()).sort((a, b) => a.month.localeCompare(b.month)), raw.range.startDate, raw.range.endDate);
  const chartRevenueTotal = chartData.reduce((sum, point) => sum + point.totalRevenue, 0);
  const chartCountTotal = chartData.reduce((sum, point) => sum + point.totalCount, 0);

  const today = parseDateOnly(raw.range.today);
  const historicalEntries = entries.filter((entry) => {
    const date = parseDateOnly(entry.date);
    return today && date ? date.getTime() <= today.getTime() : true;
  });
  const forecastEntries = entries.filter((entry) => {
    const date = parseDateOnly(entry.date);
    return today && date ? date.getTime() > today.getTime() : false;
  });

  const historical = buildKpiGroup('Historical', `${raw.range.startDate} → ${raw.range.today}`, historicalEntries);
  const forecast = buildKpiGroup('Forecast', `${raw.range.today} → ${raw.range.endDate}`, forecastEntries);

  const viewModel: SalesAnalyticsViewModel = {
    range: raw.range,
    filters,
    availableStatuses: raw.filters.statuses,
    availableStaff: raw.filters.staffOptions,
    chartData,
    monthDetails: Object.fromEntries(Array.from(detailMap.entries())),
    historical,
    forecast,
    overallRevenue: historical.totalRevenue + forecast.totalRevenue,
    overallCount: historical.totalCount + forecast.totalCount,
    hasData: entries.length > 0,
  };

  if (Math.abs(viewModel.overallRevenue - chartRevenueTotal) > 0.01) {
    viewModel.overallRevenue = chartRevenueTotal;
  }
  if (viewModel.overallCount !== chartCountTotal) {
    viewModel.overallCount = chartCountTotal;
  }

  const nextRawCache = rawCache || new Map<string, SalesAnalyticsViewModel>();
  nextRawCache.set(cacheKey, viewModel);
  transformCache.set(raw, nextRawCache);
  return viewModel;
}

export async function fetchSalesAnalytics(filters: SalesAnalyticsFilters, signal?: AbortSignal): Promise<SalesAnalyticsResponse> {
  return api.getSalesAnalytics(
    {
      start_date: filters.startDate,
      end_date: filters.endDate,
      statuses: filters.statuses,
      staff_ids: filters.staffIds,
    },
    {
      signal,
      dedupeKey: `sales-analytics:${filters.startDate}:${filters.endDate}:${filters.statuses.join('|')}:${filters.staffIds.join('|')}`,
      cancelPrevious: true,
    }
  );
}

export function normalizeSalesAnalytics(raw: SalesAnalyticsResponse, filters: SalesAnalyticsFilters): SalesAnalyticsViewModel {
  return buildViewModel(raw, filters);
}

export function buildDefaultSalesFilters(today = new Date()): SalesAnalyticsFilters {
  const year = today.getUTCFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    statuses: ['quoteSent', 'contractSigned', 'lost'],
    staffIds: [],
  };
}

export function buildPresetRange(preset: 'last30' | 'ytd', today = new Date()): Pick<SalesAnalyticsFilters, 'startDate' | 'endDate'> {
  const safeToday = parseDateOnly(toDateOnlyString(today)) || today;
  if (preset === 'last30') {
    const start = new Date(safeToday.getTime());
    start.setUTCDate(start.getUTCDate() - 29);
    return {
      startDate: toDateOnlyString(start),
      endDate: toDateOnlyString(safeToday),
    };
  }
  return {
    startDate: `${safeToday.getUTCFullYear()}-01-01`,
    endDate: toDateOnlyString(safeToday),
  };
}

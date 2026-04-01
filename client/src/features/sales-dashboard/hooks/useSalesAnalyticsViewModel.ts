import { useMemo } from 'react';
import type { SalesAnalyticsFilters } from '../types';
import { normalizeSalesAnalytics } from '../salesAnalytics.service';
import { useSalesAnalyticsQuery } from './useSalesAnalyticsQuery';

export function useSalesAnalyticsViewModel(filters: SalesAnalyticsFilters) {
  const query = useSalesAnalyticsQuery(filters);

  const viewModel = useMemo(() => {
    if (!query.data) return null;
    return normalizeSalesAnalytics(query.data, filters);
  }, [query.data, filters]);

  return {
    ...query,
    viewModel,
  };
}

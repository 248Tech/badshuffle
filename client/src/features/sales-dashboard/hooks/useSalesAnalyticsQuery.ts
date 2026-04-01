import { useQuery } from '@tanstack/react-query';
import type { SalesAnalyticsFilters } from '../types';
import { fetchSalesAnalytics } from '../salesAnalytics.service';

export function useSalesAnalyticsQuery(filters: SalesAnalyticsFilters) {
  return useQuery({
    queryKey: ['sales-analytics', filters.startDate, filters.endDate, filters.statuses.join(','), filters.staffIds.join(',')],
    queryFn: ({ signal }) => fetchSalesAnalytics(filters, signal),
    placeholderData: (previous) => previous,
  });
}

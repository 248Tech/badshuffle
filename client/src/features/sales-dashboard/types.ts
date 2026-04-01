export type PipelineStatus = 'quoteSent' | 'contractSigned' | 'lost';

export interface SalesAnalyticsFilters {
  startDate: string;
  endDate: string;
  statuses: PipelineStatus[];
  staffIds: number[];
}

export interface SalesAnalyticsEntry {
  id: number;
  name: string;
  date: string;
  month: string;
  pipelineStatus: PipelineStatus;
  revenue: number;
  count: number;
  status: string;
  staffId: number | null;
  staffLabel: string | null;
}

export interface SalesAnalyticsStaffOption {
  id: number;
  label: string;
  role: string;
}

export interface SalesAnalyticsResponse {
  range: {
    startDate: string;
    endDate: string;
    today: string;
  };
  filters: {
    statuses: PipelineStatus[];
    selectedStatuses: PipelineStatus[];
    selectedStaffIds: number[];
    staffOptions: SalesAnalyticsStaffOption[];
  };
  entries: SalesAnalyticsEntry[];
}

export interface SalesKpiMetric {
  label: string;
  revenue: number;
  count: number;
  avgRevenue: number;
  shareOfRevenue: number;
  shareOfCount: number;
}

export interface SalesKpiGroup {
  title: string;
  rangeLabel: string;
  totalRevenue: number;
  totalCount: number;
  breakdown: Record<PipelineStatus, SalesKpiMetric>;
}

export interface SalesChartPoint {
  month: string;
  monthLabel: string;
  quoteSentRevenue: number;
  quoteSentCount: number;
  contractSignedRevenue: number;
  contractSignedCount: number;
  lostRevenue: number;
  lostCount: number;
  totalRevenue: number;
  totalCount: number;
}

export interface SalesMonthDetail {
  month: string;
  monthLabel: string;
  totals: Record<PipelineStatus, { revenue: number; count: number }>;
  entries: SalesAnalyticsEntry[];
}

export interface SalesAnalyticsViewModel {
  range: SalesAnalyticsResponse['range'];
  filters: SalesAnalyticsFilters;
  availableStatuses: PipelineStatus[];
  availableStaff: SalesAnalyticsStaffOption[];
  chartData: SalesChartPoint[];
  monthDetails: Record<string, SalesMonthDetail>;
  historical: SalesKpiGroup;
  forecast: SalesKpiGroup;
  overallRevenue: number;
  overallCount: number;
  hasData: boolean;
}

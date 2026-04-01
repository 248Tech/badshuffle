import React, { useMemo, useState } from 'react';
import { SalesFilters } from './SalesFilters';
import { SalesChart } from './SalesChart';
import { KPISection } from './KPISection';
import { buildDefaultSalesFilters, buildPresetRange } from '../salesAnalytics.service';
import { useSalesAnalyticsViewModel } from '../hooks/useSalesAnalyticsViewModel';
import type { SalesAnalyticsFilters } from '../types';
import { formatCurrency } from '../utils';

function DashboardSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-[var(--shadow-md)]">
        <div className="h-10 w-32 rounded-2xl bg-[var(--color-surface)]" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <div className="h-4 w-24 rounded bg-[var(--color-surface)]" />
              <div className="mt-3 h-11 rounded-xl bg-[var(--color-surface)]" />
              <div className="mt-2 h-11 rounded-xl bg-[var(--color-surface)]" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-5">
        <div className="rounded-[30px] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-[var(--shadow-md)]">
          <div className="h-6 w-44 rounded bg-[var(--color-surface)]" />
          <div className="mt-2 h-4 w-2/3 rounded bg-[var(--color-surface)]" />
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-[420px] rounded-[24px] bg-[var(--color-surface)]" />
            <div className="h-[420px] rounded-[24px] bg-[var(--color-surface)]" />
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 shadow-[var(--shadow-md)]">
              <div className="h-5 w-36 rounded bg-[var(--color-surface)]" />
              <div className="mt-3 h-8 w-40 rounded bg-[var(--color-surface)]" />
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((__, nestedIndex) => (
                  <div key={nestedIndex} className="h-40 rounded-[24px] bg-[var(--color-surface)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SalesDashboard() {
  const [filters, setFilters] = useState<SalesAnalyticsFilters>(() => buildDefaultSalesFilters());
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const { viewModel, isLoading, isFetching, error } = useSalesAnalyticsViewModel(filters);

  const headline = useMemo(() => {
    if (!viewModel) return null;
    return {
      revenue: formatCurrency(viewModel.overallRevenue),
      count: viewModel.overallCount,
    };
  }, [viewModel]);

  if (isLoading && !viewModel) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-[var(--color-danger-border)] bg-[var(--color-danger-subtle)] px-6 py-6 text-[var(--color-danger-strong)]">
        Failed to load sales analytics: {String((error as Error)?.message || 'Unknown error')}
      </div>
    );
  }

  if (!viewModel || !viewModel.hasData) {
    return (
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <SalesFilters
          filters={filters}
          availableStatuses={viewModel?.availableStatuses || ['quoteSent', 'contractSigned', 'lost']}
          staffOptions={viewModel?.availableStaff || []}
          collapsed={filtersCollapsed}
          onToggleCollapsed={() => setFiltersCollapsed((value) => !value)}
          onChange={setFilters}
          onPreset={(preset) => setFilters((current) => ({ ...current, ...buildPresetRange(preset) }))}
        />
        <div className="rounded-[30px] border border-[var(--color-border)] bg-[var(--color-bg)] px-8 py-12 text-center text-[var(--color-text)] shadow-[var(--shadow-md)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">No data</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">No data for selected filters</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--color-text-muted)]">
            Try expanding the date range or clearing the staff filter. The dashboard only charts sent, signed, and lost pipeline stages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <SalesFilters
        filters={filters}
        availableStatuses={viewModel.availableStatuses}
        staffOptions={viewModel.availableStaff}
        collapsed={filtersCollapsed}
        onToggleCollapsed={() => setFiltersCollapsed((value) => !value)}
        onChange={setFilters}
        onPreset={(preset) => setFilters((current) => ({ ...current, ...buildPresetRange(preset) }))}
      />

      <div className="grid min-w-0 gap-5">
        <section className="rounded-[30px] border border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-6 text-[var(--color-text)] shadow-[var(--shadow-md)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Sales Pipeline Analytics</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Revenue flow, from quote to close</h1>
              <p className="mt-3 max-w-3xl text-sm text-[var(--color-text-muted)]">
                A production-grade pipeline view with month-level trend lines, staff-aware filtering, and live KPI splits for historical and forecast revenue.
              </p>
            </div>
            <div className="grid min-w-[220px] gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Pipeline revenue</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">{headline?.revenue}</div>
              </div>
              <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Deals in range</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">{headline?.count}</div>
              </div>
            </div>
          </div>
          {isFetching ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-info-border)] bg-[var(--color-info-subtle)] px-3 py-1 text-xs font-medium text-[var(--color-info-strong)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-primary)]" />
              Updating analytics
            </div>
          ) : null}
        </section>

        <SalesChart data={viewModel.chartData} monthDetails={viewModel.monthDetails} />
        <KPISection historical={viewModel.historical} forecast={viewModel.forecast} />
      </div>
    </div>
  );
}

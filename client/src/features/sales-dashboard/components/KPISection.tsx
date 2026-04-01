import React from 'react';
import type { PipelineStatus, SalesKpiGroup } from '../types';
import { formatCurrency } from '../utils';

const STATUS_META: Record<PipelineStatus, { label: string; accent: string; panel: string }> = {
  quoteSent: { label: 'Quote', accent: 'text-[var(--color-primary)]', panel: 'from-[var(--color-primary-subtle)] to-[var(--color-bg)]' },
  contractSigned: { label: 'Signed', accent: 'text-[var(--color-success-strong)]', panel: 'from-[var(--color-success-subtle)] to-[var(--color-bg)]' },
  lost: { label: 'Lost', accent: 'text-[var(--color-text-muted)]', panel: 'from-[var(--color-surface)] to-[var(--color-bg)]' },
};

function KpiCard({
  title,
  revenue,
  count,
  avgRevenue,
  shareOfRevenue,
  shareOfCount,
  accentClass,
  panelClass,
}: {
  title: string;
  revenue: number;
  count: number;
  avgRevenue: number;
  shareOfRevenue: number;
  shareOfCount: number;
  accentClass: string;
  panelClass: string;
}) {
  return (
    <div className={`group rounded-[24px] border border-[var(--color-border)] bg-gradient-to-br ${panelClass} p-4 text-[var(--color-text)] shadow-[var(--shadow)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/30`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${accentClass}`}>{title}</div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">{formatCurrency(revenue)}</div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-right">
          <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Count</div>
          <div className="text-lg font-semibold text-[var(--color-text)]">{count}</div>
        </div>
      </div>

      <div className="mt-4 max-h-[52px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3 transition-all duration-200 group-hover:max-h-[160px] group-focus-within:max-h-[160px]">
        <div className="grid gap-2 text-sm text-[var(--color-text)]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-muted)]">Average deal</span>
            <span className="font-medium text-[var(--color-text)]">{formatCurrency(avgRevenue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-muted)]">Revenue share</span>
            <span className="font-medium text-[var(--color-text)]">{Math.round(shareOfRevenue * 100)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-muted)]">Count share</span>
            <span className="font-medium text-[var(--color-text)]">{Math.round(shareOfCount * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiGroupPanel({ group }: { group: SalesKpiGroup }) {
  return (
    <section className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-[var(--color-text)] shadow-[var(--shadow-md)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">{group.title}</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">{formatCurrency(group.totalRevenue)}</h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{group.totalCount} deals • {group.rangeLabel}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-right">
          <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Section total</div>
          <div className="text-base font-semibold text-[var(--color-text)]">{formatCurrency(group.totalRevenue)}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {(Object.keys(group.breakdown) as PipelineStatus[]).map((status) => {
          const metric = group.breakdown[status];
          return (
            <KpiCard
              key={status}
              title={STATUS_META[status].label}
              revenue={metric.revenue}
              count={metric.count}
              avgRevenue={metric.avgRevenue}
              shareOfRevenue={metric.shareOfRevenue}
              shareOfCount={metric.shareOfCount}
              accentClass={STATUS_META[status].accent}
              panelClass={STATUS_META[status].panel}
            />
          );
        })}
      </div>
    </section>
  );
}

export function KPISection({ historical, forecast }: { historical: SalesKpiGroup; forecast: SalesKpiGroup }) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <KpiGroupPanel group={historical} />
      <KpiGroupPanel group={forecast} />
    </section>
  );
}

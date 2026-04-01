import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PipelineStatus, SalesChartPoint, SalesMonthDetail } from '../types';
import { formatCurrency } from '../utils';

const SERIES_META: Record<PipelineStatus, { label: string; color: string; key: keyof SalesChartPoint; countKey: keyof SalesChartPoint }> = {
  quoteSent: { label: 'Quote Sent', color: 'var(--color-primary)', key: 'quoteSentRevenue', countKey: 'quoteSentCount' },
  contractSigned: { label: 'Contract Signed', color: 'var(--color-success)', key: 'contractSignedRevenue', countKey: 'contractSignedCount' },
  lost: { label: 'Lost', color: 'var(--color-text-muted)', key: 'lostRevenue', countKey: 'lostCount' },
};

interface SalesChartProps {
  data: SalesChartPoint[];
  monthDetails: Record<string, SalesMonthDetail>;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-3 shadow-[var(--shadow-md)]">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-2 grid gap-1.5">
        {payload.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-4 text-sm text-[var(--color-text)]">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
              {row.name}
            </span>
            <span className="font-semibold">{formatCurrency(Number(row.value || 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SalesChart({ data, monthDetails }: SalesChartProps) {
  const [activeMonth, setActiveMonth] = useState<string | null>(data[data.length - 1]?.month || null);

  useEffect(() => {
    if (!data.length) {
      setActiveMonth(null);
      return;
    }
    if (!activeMonth || !monthDetails[activeMonth]) {
      setActiveMonth(data[data.length - 1].month);
    }
  }, [activeMonth, data, monthDetails]);

  const detail = activeMonth ? monthDetails[activeMonth] : null;
  const topEntries = useMemo(() => {
    if (!detail) return [];
    return detail.entries.slice().sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0)).slice(0, 5);
  }, [detail]);

  const axisColor = 'var(--color-text-muted)';
  const gridColor = 'var(--color-border)';
  const quoteFill = 'var(--color-primary-subtle)';
  const signedFill = 'var(--color-success-subtle)';
  const lostFill = 'var(--color-surface)';

  return (
    <section className="rounded-[30px] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-[var(--color-text)] shadow-[var(--shadow-md)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Pipeline Velocity</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">Revenue by month</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">
            Hover across the chart to inspect the monthly pipeline mix. The side panel keeps a live breakdown instead of hiding the detail inside a transient tooltip.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SERIES_META) as PipelineStatus[]).map((status) => (
            <div key={status} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_META[status].color }} />
              {SERIES_META[status].label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                onMouseMove={(state) => {
                  const nextMonth = state?.activePayload?.[0]?.payload?.month;
                  if (nextMonth) setActiveMonth(String(nextMonth));
                }}
              >
                <defs>
                  <linearGradient id="quoteSentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={quoteFill} stopOpacity={0.9} />
                    <stop offset="95%" stopColor={quoteFill} stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="contractSignedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={signedFill} stopOpacity={0.9} />
                    <stop offset="95%" stopColor={signedFill} stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="lostFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lostFill} stopOpacity={0.9} />
                    <stop offset="95%" stopColor={lostFill} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(Number(value || 0))} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="quoteSentRevenue" name="Quote Sent" stackId="1" stroke={SERIES_META.quoteSent.color} fill="url(#quoteSentFill)" strokeWidth={2.5} isAnimationActive animationDuration={350} />
                <Area type="monotone" dataKey="contractSignedRevenue" name="Contract Signed" stackId="1" stroke={SERIES_META.contractSigned.color} fill="url(#contractSignedFill)" strokeWidth={2.5} isAnimationActive animationDuration={350} />
                <Area type="monotone" dataKey="lostRevenue" name="Lost" stackId="1" stroke={SERIES_META.lost.color} fill="url(#lostFill)" strokeWidth={2.5} isAnimationActive animationDuration={350} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Hover Breakdown</p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">{detail?.monthLabel || 'No data'}</h3>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-right">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Monthly total</div>
              <div className="text-base font-semibold text-[var(--color-text)]">
                {detail
                  ? formatCurrency(
                      detail.totals.quoteSent.revenue +
                        detail.totals.contractSigned.revenue +
                        detail.totals.lost.revenue
                    )
                  : '$0'}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {(Object.keys(SERIES_META) as PipelineStatus[]).map((status) => {
              const totals = detail?.totals[status] || { revenue: 0, count: 0 };
              return (
                <div key={status} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_META[status].color }} />
                      {SERIES_META[status].label}
                    </div>
                    <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{totals.count} deals</span>
                  </div>
                  <div className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--color-text)]">{formatCurrency(totals.revenue)}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">Top deals in month</h4>
              <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Hover-reveal list</span>
            </div>
            <div className="mt-3 grid gap-2">
              {topEntries.length ? topEntries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--color-text)]">{entry.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{entry.status}</div>
                    </div>
                    <div className="text-sm font-semibold text-[var(--color-text)]">{formatCurrency(entry.revenue)}</div>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
                  No deals landed in this month for the current filter set.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

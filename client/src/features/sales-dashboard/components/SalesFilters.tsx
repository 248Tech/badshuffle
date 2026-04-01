import React, { useMemo, useState } from 'react';
import type { PipelineStatus, SalesAnalyticsFilters, SalesAnalyticsStaffOption } from '../types';

const STATUS_META: Record<PipelineStatus, { label: string; chip: string }> = {
  quoteSent: { label: 'Quote Sent', chip: 'border-[var(--color-info-border)] bg-[var(--color-info-subtle)] text-[var(--color-info-strong)]' },
  contractSigned: { label: 'Contract Signed', chip: 'border-[var(--color-success-border)] bg-[var(--color-success-subtle)] text-[var(--color-success-strong)]' },
  lost: { label: 'Lost', chip: 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]' },
};

interface SalesFiltersProps {
  filters: SalesAnalyticsFilters;
  availableStatuses: PipelineStatus[];
  staffOptions: SalesAnalyticsStaffOption[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onChange: (next: SalesAnalyticsFilters) => void;
  onPreset: (preset: 'last30' | 'ytd') => void;
}

function FilterSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{title}</span>
        <span className="text-[var(--color-text-muted)]">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="border-t border-[var(--color-border)] px-4 py-4">{children}</div> : null}
    </section>
  );
}

export function SalesFilters({
  filters,
  availableStatuses,
  staffOptions,
  collapsed = false,
  onToggleCollapsed,
  onChange,
  onPreset,
}: SalesFiltersProps) {
  const [staffSearch, setStaffSearch] = useState('');
  const filteredStaff = useMemo(() => {
    const term = staffSearch.trim().toLowerCase();
    if (!term) return staffOptions;
    return staffOptions.filter((option) => option.label.toLowerCase().includes(term));
  }, [staffOptions, staffSearch]);

  const toggleStatus = (status: PipelineStatus) => {
    const exists = filters.statuses.includes(status);
    const statuses = exists
      ? filters.statuses.filter((entry) => entry !== status)
      : [...filters.statuses, status];
    onChange({ ...filters, statuses: statuses.length ? statuses : availableStatuses.slice() });
  };

  const toggleStaff = (staffId: number) => {
    const exists = filters.staffIds.includes(staffId);
    const staffIds = exists
      ? filters.staffIds.filter((entry) => entry !== staffId)
      : [...filters.staffIds, staffId];
    onChange({ ...filters, staffIds });
  };

  return (
    <aside className={`${collapsed ? 'lg:w-[84px]' : 'lg:w-[300px]'} shrink-0 rounded-[28px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] shadow-[var(--shadow-md)] transition-all duration-300`}>
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-5">
        {!collapsed ? (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Sales Filters</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--color-text)]">Pipeline Controls</h2>
          </div>
        ) : null}
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition hover:bg-[var(--color-hover)]"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand filter sidebar' : 'Collapse filter sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {!collapsed ? (
        <div className="flex flex-col gap-4 p-4">
          <FilterSection title="Presets">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-hover)]" onClick={() => onPreset('last30')}>
                Last 30 Days
              </button>
              <button type="button" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-hover)]" onClick={() => onPreset('ytd')}>
                YTD
              </button>
            </div>
          </FilterSection>

          <FilterSection title="Date Range">
            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-[var(--color-text-muted)]">Start date</span>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => onChange({ ...filters, startDate: event.target.value })}
                  className="min-h-[46px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-[var(--color-text-muted)]">End date</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => onChange({ ...filters, endDate: event.target.value })}
                  className="min-h-[46px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
                />
              </label>
            </div>
          </FilterSection>

          <FilterSection title="Pipeline Status">
            <div className="flex flex-wrap gap-2">
              {availableStatuses.map((status) => {
                const active = filters.statuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition ${active ? STATUS_META[status].chip : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]'}`}
                    onClick={() => toggleStatus(status)}
                  >
                    {STATUS_META[status].label}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection title="Staff">
            <div className="grid gap-3">
              <input
                type="search"
                value={staffSearch}
                onChange={(event) => setStaffSearch(event.target.value)}
                placeholder="Search staff"
                className="min-h-[46px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              />
              <div className="max-h-[220px] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                {filteredStaff.length ? filteredStaff.map((option) => {
                  const active = filters.staffIds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleStaff(option.id)}
                      className={`mb-1 flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-left text-sm transition ${active ? 'bg-[var(--color-primary-subtle)] text-[var(--color-text)]' : 'text-[var(--color-text)] hover:bg-[var(--color-hover)]'}`}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                      <span className="ml-3 shrink-0 text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{active ? 'On' : option.role}</span>
                    </button>
                  );
                }) : (
                  <div className="px-3 py-4 text-sm text-[var(--color-text-muted)]">No staff match that search.</div>
                )}
              </div>
            </div>
          </FilterSection>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 px-3 py-4">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">F</div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-success-subtle)] text-[var(--color-success-strong)]">{filters.statuses.length}</div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-surface)] text-[var(--color-text)]">{filters.staffIds.length}</div>
        </div>
      )}
    </aside>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import styles from './DateRangePicker.module.css';

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYMD(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevLast = new Date(prevYear, prevMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) {
    const d = prevLast - startPad + 1 + i;
    cells.push({ type: 'pad', date: new Date(prevYear, prevMonth, d), ymd: toYMD(new Date(prevYear, prevMonth, d)) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ type: 'curr', date, ymd: toYMD(date) });
  }
  const remaining = 42 - cells.length;
  for (let i = 0; i < remaining; i++) {
    const date = new Date(year, month + 1, i + 1);
    cells.push({ type: 'pad', date, ymd: toYMD(date) });
  }
  return cells;
}

const PRESETS = [
  { label: 'This month', get: () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toYMD(first), to: toYMD(last) };
  }},
  { label: 'Next month', get: () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { from: toYMD(first), to: toYMD(last) };
  }},
  { label: 'Next 3 months', get: () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    return { from: toYMD(first), to: toYMD(last) };
  }},
  { label: 'This year', get: () => {
    const y = new Date().getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }},
];

export default function DateRangePicker({ from, to, onChange, placeholder = 'Event date range', id }) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState('from');
  const [hover, setHover] = useState(null);
  const [viewDate, setViewDate] = useState(() => {
    const d = parseYMD(from) || parseYMD(to) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleDayClick = (ymd) => {
    if (selecting === 'from') {
      onChange({ from: ymd, to: '' });
      setSelecting('to');
      return;
    }
    const fromD = parseYMD(from);
    const toD = parseYMD(ymd);
    if (fromD && toD) {
      if (toD < fromD) onChange({ from: ymd, to: from });
      else onChange({ from, to: ymd });
    } else {
      onChange({ from, to: ymd });
    }
    setOpen(false);
    setSelecting('from');
    setHover(null);
  };

  const isInRange = (ymd) => {
    if (!from) return false;
    const d = parseYMD(ymd);
    const f = parseYMD(from);
    const effectiveTo = selecting === 'to' && hover ? parseYMD(hover) : parseYMD(to);
    if (!d || !f || !effectiveTo) return false;
    const [lo, hi] = f <= effectiveTo ? [f, effectiveTo] : [effectiveTo, f];
    return d > lo && d < hi;
  };

  const isFrom = (ymd) => from && ymd === from;
  const isTo = (ymd) => {
    if (selecting === 'to' && hover) return ymd === hover;
    return to && ymd === to;
  };

  const today = toYMD(new Date());

  const label = from && to
    ? `${new Date(from + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(to + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : from
      ? `From ${new Date(from + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}…`
      : placeholder;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getMonthDays(year, month);

  const yearOptions = [];
  for (let y = year - 3; y <= year + 5; y++) yearOptions.push(y);

  return (
    <div className={styles.wrap} ref={containerRef}>
      <button
        type="button"
        id={id}
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Select event date range"
      >
        <span className={styles.triggerIcon}>📅</span>
        <span className={styles.triggerLabel}>{label}</span>
        <span className={styles.triggerCaret} aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={styles.dropdown} role="dialog" aria-label="Event date range calendar">
          <div className={styles.presets}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                className={styles.presetBtn}
                onClick={() => { onChange(p.get()); setOpen(false); setSelecting('from'); setHover(null); }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className={styles.header}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className={styles.headerCenter}>
              <select
                className={styles.monthSelect}
                value={month}
                onChange={e => setViewDate(new Date(year, Number(e.target.value), 1))}
                aria-label="Month"
              >
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select
                className={styles.yearSelect}
                value={year}
                onChange={e => setViewDate(new Date(Number(e.target.value), month, 1))}
                aria-label="Year"
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className={styles.weekdays}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <span key={d} className={styles.weekday}>{d}</span>
            ))}
          </div>
          <div className={styles.grid}>
            {days.map((cell) => {
              const inRange = cell.type === 'curr' && isInRange(cell.ymd);
              const start = cell.type === 'curr' && isFrom(cell.ymd);
              const end = cell.type === 'curr' && isTo(cell.ymd);
              const isToday = cell.type === 'curr' && cell.ymd === today;
              return (
                <button
                  key={cell.ymd + cell.type}
                  type="button"
                  className={`${styles.day} ${cell.type === 'pad' ? styles.dayPad : ''} ${inRange ? styles.dayInRange : ''} ${start ? styles.dayFrom : ''} ${end ? styles.dayTo : ''} ${isToday && !start && !end ? styles.dayToday : ''}`}
                  onClick={() => cell.type === 'curr' && handleDayClick(cell.ymd)}
                  onMouseEnter={() => cell.type === 'curr' && selecting === 'to' && setHover(cell.ymd)}
                  onMouseLeave={() => setHover(null)}
                  aria-label={cell.type === 'curr' ? `Choose ${cell.ymd}` : undefined}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
          <div className={styles.footer}>
            <p className={styles.hint}>
              {selecting === 'from' ? 'Click start date' : 'Click end date'}
            </p>
            <div className={styles.footerActions}>
              <button
                type="button"
                className={styles.todayBtn}
                onClick={() => {
                  const now = new Date();
                  setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
                }}
              >
                Today
              </button>
              {(from || to) && (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => { onChange({ from: '', to: '' }); setSelecting('from'); setHover(null); setOpen(false); }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

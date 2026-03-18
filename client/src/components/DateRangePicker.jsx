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

export default function DateRangePicker({ from, to, onChange, placeholder = 'Event date range', id }) {
  const fromDate = parseYMD(from);
  const toDate = parseYMD(to);
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState('from'); // 'from' | 'to'
  const [viewDate, setViewDate] = useState(() => {
    const d = fromDate || toDate || new Date();
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
  };

  const isInRange = (ymd) => {
    if (!from || !to) return false;
    const d = parseYMD(ymd);
    const f = parseYMD(from);
    const t = parseYMD(to);
    return d && f && t && d >= f && d <= t;
  };

  const isFrom = (ymd) => from && ymd === from;
  const isTo = (ymd) => to && ymd === to;

  const label = from && to
    ? `${new Date(from + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(to + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : from
      ? `From ${new Date(from + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}…`
      : placeholder;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = getMonthDays(year, month);
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

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
          <div className={styles.header}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className={styles.monthLabel}>{monthLabel}</span>
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
              return (
                <button
                  key={cell.ymd + cell.type}
                  type="button"
                  className={`${styles.day} ${cell.type === 'pad' ? styles.dayPad : ''} ${inRange ? styles.dayInRange : ''} ${start ? styles.dayFrom : ''} ${end ? styles.dayTo : ''}`}
                  onClick={() => cell.type === 'curr' && handleDayClick(cell.ymd)}
                  aria-label={cell.type === 'curr' ? `Choose ${cell.ymd}` : undefined}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
          <p className={styles.hint}>
            {selecting === 'from' ? 'Click start date' : 'Click end date'}
          </p>
          {(from || to) && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => { onChange({ from: '', to: '' }); setSelecting('from'); setOpen(false); }}
            >
              Clear range
            </button>
          )}
        </div>
      )}
    </div>
  );
}

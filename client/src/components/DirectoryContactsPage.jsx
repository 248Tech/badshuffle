import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast.jsx';
import styles from './DirectoryContactsPage.module.css';

function formatDate(value) {
  if (!value) return 'No past orders';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function humanizeStatus(value) {
  const normalized = String(value || 'draft').replace(/_/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildInitialForm(fields, initial = {}) {
  return fields.reduce((acc, field) => {
    acc[field.name] = initial[field.name] || '';
    return acc;
  }, {});
}

export default function DirectoryContactsPage({
  title,
  subtitle,
  searchPlaceholder,
  addLabel,
  emptyMessage,
  entityLabel,
  fields,
  listMethod,
  createMethod,
  updateMethod,
  itemsKey,
  detailFormatter,
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(() => buildInitialForm(fields));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await listMethod({ q: query.trim() });
        if (!cancelled) setItems(data?.[itemsKey] || []);
      } catch (error) {
        if (!cancelled) toast.error(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [itemsKey, listMethod, query, toast]);

  const openNew = () => {
    setEditId(null);
    setForm(buildInitialForm(fields));
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm(buildInitialForm(fields, item));
    setShowForm(true);
  };

  const formTitle = editId ? `Edit ${entityLabel}` : `Add ${entityLabel}`;
  const submitDisabled = useMemo(() => {
    const requiredFields = fields.filter((field) => field.required);
    return saving || requiredFields.some((field) => !String(form[field.name] || '').trim());
  }, [fields, form, saving]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await updateMethod(editId, form);
        toast.success(`${entityLabel} updated`);
      } else {
        await createMethod(form);
        toast.success(`${entityLabel} created`);
      }
      const data = await listMethod({ q: query.trim() });
      setItems(data?.[itemsKey] || []);
      setShowForm(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-[13px] text-text-muted mt-1">{subtitle}</p>
        </div>
        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={`Search ${title.toLowerCase()}`}
          />
          <button type="button" className="btn btn-primary" onClick={openNew}>{addLabel}</button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={`Loading ${title.toLowerCase()}`}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card p-5 flex flex-col gap-3" aria-hidden="true">
              <div className="skeleton h-5 rounded" style={{ width: `${38 + index * 8}%` }} />
              <div className="skeleton h-4 rounded" style={{ width: `${55 + index * 6}%` }} />
              <div className="skeleton h-20 rounded-xl" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {items.map((item) => (
            <div key={item.id} className="card p-5">
              <div className="flex justify-between gap-4 flex-wrap items-start">
                <div className="min-w-0 flex-1">
                  <div className="text-[18px] font-semibold leading-tight">{item.display_name}</div>
                  <div className="mt-2 flex flex-col gap-1 text-[13px] text-text-muted">
                    {detailFormatter(item).map((line, index) => line ? <span key={`${item.id}-${index}`}>{line}</span> : null)}
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => openEdit(item)}>Edit</button>
              </div>

              <div className={styles.metaRow}>
                <span>{item.quote_count || 0} past orders</span>
                <span>Last order {formatDate(item.last_order_at)}</span>
              </div>

              {item.recent_quotes?.length ? (
                <div className={styles.quoteGrid}>
                  {item.recent_quotes.map((quote) => (
                    <button
                      key={quote.id}
                      type="button"
                      className={styles.quoteCard}
                      onClick={() => navigate(`/quotes/${quote.id}`)}
                    >
                      <span className={styles.quoteName}>{quote.name || `Project #${quote.id}`}</span>
                      <span className={styles.quoteMeta}>{humanizeStatus(quote.status)} · {formatDate(quote.event_date || quote.created_at)}</span>
                      {quote.guest_count ? <span className={styles.quoteMeta}>{quote.guest_count} guests</span> : null}
                      {quote.venue_name ? <span className={styles.quoteMeta}>{quote.venue_name}</span> : null}
                      {quote.client_name ? <span className={styles.quoteMeta}>{quote.client_name}</span> : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-[13px] text-text-muted">No linked projects yet.</div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className={styles.modal} onClick={() => setShowForm(false)} onKeyDown={(event) => event.key === 'Escape' && setShowForm(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="directory-contact-form-title">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 id="directory-contact-form-title" className="text-[20px] font-semibold">{formTitle}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Close</button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className={styles.formGrid}>
                {fields.map((field) => (
                  <div key={field.name} className={`form-group ${field.fullWidth ? styles.fullWidth : ''}`}>
                    <label htmlFor={`contact-field-${field.name}`}>{field.label}{field.required ? ' *' : ''}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={`contact-field-${field.name}`}
                        rows={3}
                        value={form[field.name]}
                        onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                        placeholder={field.placeholder || ''}
                      />
                    ) : (
                      <input
                        id={`contact-field-${field.name}`}
                        type={field.type || 'text'}
                        value={form[field.name]}
                        onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                        placeholder={field.placeholder || ''}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitDisabled}>{saving ? 'Saving…' : editId ? 'Save changes' : addLabel}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

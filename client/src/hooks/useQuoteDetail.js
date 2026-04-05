import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { syncQuoteNameWithCitySuffix } from '../lib/quoteTitle.js';

function buildQuoteForm(data = {}) {
  return {
    name: data.name,
    guest_count: data.guest_count || '',
    event_date: data.event_date || '',
    event_type: data.event_type || '',
    rental_start: data.rental_start || '',
    rental_end: data.rental_end || '',
    delivery_date: data.delivery_date || '',
    pickup_date: data.pickup_date || '',
    expires_at: data.expires_at || '',
    expiration_message: data.expiration_message || '',
    payment_policy_id: data.payment_policy_id != null ? String(data.payment_policy_id) : '',
    rental_terms_id: data.rental_terms_id != null ? String(data.rental_terms_id) : '',
    notes: data.notes || '',
    venue_name: data.venue_name || '',
    venue_email: data.venue_email || '',
    venue_phone: data.venue_phone || '',
    venue_address: data.venue_address || '',
    venue_contact: data.venue_contact || '',
    venue_notes: data.venue_notes || '',
    quote_notes: data.quote_notes || '',
    tax_rate: data.tax_rate != null ? data.tax_rate : '',
    client_first_name: data.client_first_name || '',
    client_last_name: data.client_last_name || '',
    client_email: data.client_email || '',
    client_phone: data.client_phone || '',
    client_address: data.client_address || '',
  };
}

export function useQuoteDetail(quoteId, { autoEdit = false } = {}) {
  const navigate = useNavigate();
  const toast = useToast();

  const [quote, setQuote] = useState(null);
  const [customItems, setCustomItems] = useState([]);
  const [sections, setSections] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [settings, setSettings] = useState({});
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(!!autoEdit);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Snapshot of `form` at the moment editing began (or after the last save).
  const savedFormRef = useRef(null);

  useEffect(() => {
    if (editing) {
      savedFormRef.current = form;
    } else {
      savedFormRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const isDirty =
    editing && savedFormRef.current !== null && JSON.stringify(form) !== JSON.stringify(savedFormRef.current);

  const load = useCallback(() => {
    const requestOptions = { dedupeKey: `quote:${quoteId}` };
    api
      .getQuote(quoteId, requestOptions)
      .then((data) => {
        setQuote(data);
        setCustomItems(data.customItems || []);
        setSections(data.sections || []);
        setAdjustments(data.adjustments || []);
        setForm(buildQuoteForm(data));
      })
      .catch(() => navigate('/quotes'))
      .finally(() => setLoading(false));
  }, [quoteId, navigate]);

  useEffect(() => {
    if (!quoteId) return;
    load();
  }, [quoteId, load]);

  useEffect(() => {
    api.getSettings().then((s) => setSettings(s)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!quoteId) return;
    const controller = new AbortController();
    api.getQuoteAvailability(quoteId, {
      signal: controller.signal,
      dedupeKey: `quote:${quoteId}:availability`,
      cancelPrevious: true,
    }).then((d) => {
      if (!controller.signal.aborted) setAvailability(d.conflicts || {});
    }).catch(() => {
      if (!controller.signal.aborted) setAvailability({});
    });
    return () => controller.abort();
  }, [quoteId, quote?.items?.length]);

  const discardEdits = useCallback(() => {
    if (quote) setForm(buildQuoteForm(quote));
    savedFormRef.current = null;
    setEditing(false);
  }, [quote]);

  const handleSaveEdit = useCallback(
    async (e) => {
      e?.preventDefault();
      setSaving(true);
      try {
        await api.updateQuote(quoteId, {
          name: syncQuoteNameWithCitySuffix(
            form.name,
            form.venue_address || form.client_address,
            settings.quote_auto_append_city_title === '1',
            quote?.venue_address || quote?.client_address || ''
          ),
          guest_count: Number(form.guest_count) || 0,
          event_date: form.event_date || null,
          event_type: form.event_type || null,
          rental_start: form.rental_start || null,
          rental_end: form.rental_end || null,
          delivery_date: form.delivery_date || null,
          pickup_date: form.pickup_date || null,
          expires_at: form.expires_at || null,
          expiration_message: form.expiration_message || null,
          payment_policy_id: form.payment_policy_id ? Number(form.payment_policy_id) : null,
          rental_terms_id: form.rental_terms_id ? Number(form.rental_terms_id) : null,
          notes: form.notes,
          venue_name: form.venue_name || null,
          venue_email: form.venue_email || null,
          venue_phone: form.venue_phone || null,
          venue_address: form.venue_address || null,
          venue_contact: form.venue_contact || null,
          venue_notes: form.venue_notes || null,
          quote_notes: form.quote_notes || null,
          tax_rate: form.tax_rate === '' ? null : parseFloat(form.tax_rate),
          client_first_name: form.client_first_name || null,
          client_last_name: form.client_last_name || null,
          client_email: form.client_email || null,
          client_phone: form.client_phone || null,
          client_address: form.client_address || null,
        });
        toast.success('Quote updated');
        discardEdits();
        load();
      } catch (err) {
        toast.error(err.message);
      } finally {
        setSaving(false);
      }
    },
    [quoteId, form, settings.quote_auto_append_city_title, quote, toast, discardEdits, load]
  );

  return {
    quote,
    setQuote,
    customItems,
    setCustomItems,
    sections,
    setSections,
    adjustments,
    setAdjustments,
    settings,
    setSettings,
    availability,
    setAvailability,
    loading,
    setLoading,

    editing,
    setEditing,
    form,
    setForm,
    saving,
    isDirty,
    discardEdits,
    load,
    handleSaveEdit,
  };
}

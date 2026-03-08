import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import QuoteBuilder from '../components/QuoteBuilder.jsx';
import QuoteExport from '../components/QuoteExport.jsx';
import QuoteHeader from '../components/QuoteHeader.jsx';
import AISuggestModal from '../components/AISuggestModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import AddressMapModal from '../components/AddressMapModal.jsx';
import { useToast } from '../components/Toast.jsx';
import styles from './QuoteDetailPage.module.css';

const isLogistics = (item) => (item.category || '').toLowerCase().includes('logistics');

function effectivePrice(it) {
  return it.unit_price_override != null ? it.unit_price_override : (it.unit_price || 0);
}

function computeAdjustmentsTotal(adjustments, preTaxBase) {
  return (adjustments || []).reduce((sum, adj) => {
    const val = adj.value_type === 'percent' ? preTaxBase * (adj.amount / 100) : adj.amount;
    return sum + (adj.type === 'discount' ? -val : val);
  }, 0);
}

function computeTotals(items, customItems, adjustments, taxRate) {
  const list = items || [];
  const equipment = list.filter(it => !isLogistics(it));
  const logistics = list.filter(it => isLogistics(it));
  const laborHours = list.reduce((sum, it) => sum + (Number(it.labor_hours) || 0) * (it.quantity || 1), 0);
  const subtotal = equipment.reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);
  const deliveryTotal = logistics.reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);
  const taxableEquipment = equipment.filter(it => it.taxable !== 0).reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);
  const taxableDelivery = logistics.filter(it => it.taxable !== 0).reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);
  const ciList = customItems || [];
  const customSubtotal = ciList.reduce((sum, ci) => sum + (ci.unit_price || 0) * (ci.quantity || 1), 0);
  const taxableCustom = ciList.filter(ci => ci.taxable !== 0).reduce((sum, ci) => sum + (ci.unit_price || 0) * (ci.quantity || 1), 0);
  const preTaxBase = subtotal + deliveryTotal + customSubtotal;
  const adjTotal = computeAdjustmentsTotal(adjustments, preTaxBase);
  const rate = parseFloat(taxRate) || 0;
  const tax = (taxableEquipment + taxableDelivery + taxableCustom) * (rate / 100);
  const grandTotal = preTaxBase + adjTotal + tax;
  return { laborHours, subtotal, deliveryTotal, customSubtotal, adjTotal, tax, total: grandTotal, rate };
}

export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [quote, setQuote] = useState(null);
  const [customItems, setCustomItems] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [venueEditing, setVenueEditing] = useState(false);
  const [clientEditing, setClientEditing] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [addressModalData, setAddressModalData] = useState(null);
  const [showLogPicker, setShowLogPicker] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logItems, setLogItems] = useState([]);
  // Custom items form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({ title: '', unit_price: '', quantity: '1', taxable: true, photo_url: '' });
  // Contract (in edit-quote settings)
  const [detailTab, setDetailTab] = useState('quote');
  const [contract, setContract] = useState(null);
  const [contractBody, setContractBody] = useState('');
  const [contractSaving, setContractSaving] = useState(false);
  const [contractLogs, setContractLogs] = useState([]);
  const [contractTemplates, setContractTemplates] = useState([]);
  // Billing tab
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'Offline - Check', reference: '', note: '', paid_at: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);
  // Files tab
  const [quoteFiles, setQuoteFiles] = useState([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  // Logs tab
  const [activity, setActivity] = useState([]);
  // Availability
  const [availability, setAvailability] = useState({});
  // Adjustments
  const [adjustments, setAdjustments] = useState([]);
  // Status transitions
  const [transitioning, setTransitioning] = useState(false);
  // Damage charges (closed quotes)
  const [damageCharges, setDamageCharges] = useState([]);
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [damageForm, setDamageForm] = useState({ title: '', amount: '', note: '' });
  const [damageSaving, setDamageSaving] = useState(false);

  const load = useCallback(() => {
    api.getQuote(id)
      .then(data => {
        setQuote(data);
        setCustomItems(data.customItems || []);
        setAdjustments(data.adjustments || []);
        setForm({
          name: data.name,
          guest_count: data.guest_count || '',
          event_date: data.event_date || '',
          rental_start: data.rental_start || '',
          rental_end: data.rental_end || '',
          delivery_date: data.delivery_date || '',
          pickup_date: data.pickup_date || '',
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
          client_address: data.client_address || ''
        });
      })
      .catch(() => navigate('/quotes'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.getSettings().then(s => setSettings(s)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!id) return;
    api.getQuoteAvailability(id).then(d => setAvailability(d.conflicts || {})).catch(() => {});
  }, [id, quote?.items?.length]);
  useEffect(() => {
    if (!id) return;
    api.getQuoteFiles(id).then(d => setQuoteFiles(d.files || [])).catch(() => setQuoteFiles([]));
  }, [id]);

  // Load contract and contract templates when editing (quote settings opened via title click)
  useEffect(() => {
    if (!editing || !id) return;
    api.getQuoteContract(id)
      .then(d => {
        setContract(d.contract);
        setContractBody(d.contract ? (d.contract.body_html || '') : '');
      })
      .catch(() => toast.error('Failed to load contract'));
    api.getQuoteContractLogs(id)
      .then(d => setContractLogs(d.logs || []))
      .catch(() => setContractLogs([]));
    api.getContractTemplates()
      .then(d => setContractTemplates(d.contractTemplates || []))
      .catch(() => setContractTemplates([]));
  }, [editing, id]);

  useEffect(() => {
    if (detailTab !== 'billing' || !id) return;
    api.getQuotePayments(id).then(d => setPayments(d.payments || [])).catch(() => setPayments([]));
  }, [detailTab, id]);

  useEffect(() => {
    if (!id || !quote || (quote.status || 'draft') !== 'closed') return;
    api.getDamageCharges(id).then(d => setDamageCharges(d.charges || [])).catch(() => {});
  }, [id, quote?.status]);

  useEffect(() => {
    if (detailTab !== 'logs' || !id) return;
    api.getQuoteActivity(id).then(d => setActivity(d.activity || [])).catch(() => setActivity([]));
  }, [detailTab, id]);

  const handleSaveContract = async (e) => {
    e?.preventDefault();
    setContractSaving(true);
    try {
      const d = await api.updateQuoteContract(id, { body_html: contractBody });
      setContract(d.contract);
      const logsRes = await api.getQuoteContractLogs(id);
      setContractLogs(logsRes.logs || []);
      toast.success('Contract saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setContractSaving(false);
    }
  };

  const contractLogSummary = (log) => {
    const oldLen = (log.old_body || '').length;
    const newLen = (log.new_body || '').length;
    if (oldLen === 0 && newLen === 0) return 'No content';
    if (oldLen === 0) return `Contract body created (${newLen} characters)`;
    if (newLen === 0) return `Contract body cleared (was ${oldLen} characters)`;
    if (oldLen === newLen) return `Contract body updated (${newLen} characters)`;
    return `Contract body updated (${oldLen} → ${newLen} characters)`;
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) return;
    setPaymentSaving(true);
    try {
      const d = await api.addQuotePayment(id, {
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method || 'Offline - Check',
        reference: paymentForm.reference || null,
        note: paymentForm.note || null,
        paid_at: paymentForm.paid_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
      });
      setPayments(d.payments || []);
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', method: 'Offline - Check', reference: '', note: '', paid_at: '' });
      const logsRes = await api.getQuoteActivity(id);
      setActivity(logsRes.activity || []);
      toast.success('Payment recorded');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleAttachFile = (fileId) => {
    api.addQuoteFile(id, { file_id: fileId })
      .then(d => { setQuoteFiles(d.files || []); setShowFilePicker(false); toast.success('File attached'); })
      .catch(e => toast.error(e.message));
  };

  const handleDetachFile = (fileId) => {
    api.removeQuoteFile(id, fileId)
      .then(() => { setQuoteFiles(f => f.filter(x => x.file_id !== fileId)); toast.info('File removed'); })
      .catch(e => toast.error(e.message));
  };

  const handleDeleteQuote = async () => {
    try {
      await api.deleteQuote(id);
      toast.info('Quote deleted');
      navigate('/quotes');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setShowConfirmDelete(false);
    }
  };

  const handleDuplicateQuote = async () => {
    if (!quote) return;
    setDuplicating(true);
    try {
      const body = {
        name: (quote.name || 'Quote') + ' (copy)',
        guest_count: quote.guest_count ?? 0,
        event_date: quote.event_date || null,
        rental_start: quote.rental_start || null,
        rental_end: quote.rental_end || null,
        delivery_date: quote.delivery_date || null,
        pickup_date: quote.pickup_date || null,
        notes: quote.notes || null,
        venue_name: quote.venue_name || null,
        venue_email: quote.venue_email || null,
        venue_phone: quote.venue_phone || null,
        venue_address: quote.venue_address || null,
        venue_contact: quote.venue_contact || null,
        venue_notes: quote.venue_notes || null,
        quote_notes: quote.quote_notes || null,
        tax_rate: quote.tax_rate != null ? quote.tax_rate : null,
        client_first_name: quote.client_first_name || null,
        client_last_name: quote.client_last_name || null,
        client_email: quote.client_email || null,
        client_phone: quote.client_phone || null,
        client_address: quote.client_address || null
      };
      const { quote: newQuote } = await api.createQuote(body);
      for (const it of quote.items || []) {
        await api.addQuoteItem(newQuote.id, {
          item_id: it.id,
          quantity: it.quantity ?? 1,
          label: it.label || null,
          sort_order: it.sort_order ?? 0,
          hidden_from_quote: it.hidden_from_quote ? 1 : 0
        });
      }
      for (const ci of customItems) {
        await api.addCustomItem(newQuote.id, {
          title: ci.title,
          unit_price: ci.unit_price ?? 0,
          quantity: ci.quantity ?? 1,
          photo_url: ci.photo_url || null,
          taxable: ci.taxable !== 0 ? 1 : 0,
          sort_order: ci.sort_order ?? 0
        });
      }
      toast.success('Quote duplicated');
      navigate(`/quotes/${newQuote.id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDuplicating(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateQuote(id, {
        name: form.name,
        guest_count: Number(form.guest_count) || 0,
        event_date: form.event_date || null,
        rental_start: form.rental_start || null,
        rental_end: form.rental_end || null,
        delivery_date: form.delivery_date || null,
        pickup_date: form.pickup_date || null,
        notes: null,
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
        client_address: form.client_address || null
      });
      toast.success('Quote updated');
      setEditing(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAIAdd = async (item) => {
    try {
      await api.addQuoteItem(id, { item_id: item.id });
      toast.success('Added ' + item.title);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleSendClick = () => setShowSendModal(true);

  const handleViewQuote = async () => {
    try {
      let token = quote.public_token;
      if (!token) {
        const d = await api.ensureQuotePublicToken(id);
        token = d.quote.public_token;
        setQuote(prev => prev ? { ...prev, public_token: token } : d.quote);
      }
      if (token) window.open(`${window.location.origin}/quote/public/${token}`, '_blank');
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    if (showLogPicker) {
      api.getItems({}).then(d => setLogItems((d.items || []).filter(isLogistics))).catch(() => {});
    }
  }, [showLogPicker]);

  const handleClientSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateQuote(id, {
        client_first_name: form.client_first_name || null,
        client_last_name: form.client_last_name || null,
        client_email: form.client_email || null,
        client_phone: form.client_phone || null,
        client_address: form.client_address || null
      });
      toast.success('Client updated');
      setClientEditing(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddLogisticsItem = async (item) => {
    try {
      await api.addQuoteItem(id, { item_id: item.id, quantity: 1 });
      toast.success('Added ' + item.title);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleRemoveLogisticsItem = async (qitemId, title) => {
    try {
      await api.removeQuoteItem(id, qitemId);
      toast.info('Removed ' + title);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleVenueSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateQuote(id, {
        venue_name: form.venue_name || null,
        venue_email: form.venue_email || null,
        venue_phone: form.venue_phone || null,
        venue_address: form.venue_address || null,
        venue_contact: form.venue_contact || null,
        venue_notes: form.venue_notes || null
      });
      toast.success('Venue updated');
      setVenueEditing(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setTransitioning(true);
    try {
      const d = await api.approveQuote(id);
      setQuote(d.quote);
      toast.success('Quote approved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTransitioning(false);
    }
  };

  const handleRevert = async () => {
    if (!window.confirm('Revert this quote to draft?')) return;
    setTransitioning(true);
    try {
      const d = await api.revertQuote(id);
      setQuote(d.quote);
      toast.success('Quote reverted to draft');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTransitioning(false);
    }
  };

  const handleConfirm = async () => {
    if (!window.confirm('Confirm this quote? This creates a hard inventory reservation.')) return;
    setTransitioning(true);
    try {
      const d = await api.confirmQuote(id);
      setQuote(d.quote);
      toast.success('Quote confirmed — inventory reserved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTransitioning(false);
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Close this quote? This marks the event as complete and releases inventory.')) return;
    setTransitioning(true);
    try {
      const d = await api.closeQuote(id);
      setQuote(d.quote);
      toast.success('Quote closed');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTransitioning(false);
    }
  };

  const handleAddDamageCharge = async (e) => {
    e.preventDefault();
    const amt = parseFloat(damageForm.amount);
    if (!damageForm.title || isNaN(amt) || amt <= 0) return;
    setDamageSaving(true);
    try {
      const d = await api.addDamageCharge(id, { title: damageForm.title, amount: amt, note: damageForm.note || null });
      setDamageCharges(d.charges || []);
      setDamageForm({ title: '', amount: '', note: '' });
      setShowDamageForm(false);
      toast.success('Damage charge added');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDamageSaving(false);
    }
  };

  const handleRemoveDamageCharge = async (cid) => {
    try {
      const d = await api.removeDamageCharge(id, cid);
      setDamageCharges(d.charges || []);
      toast.info('Damage charge removed');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleAddCustomItem = async (e) => {
    e.preventDefault();
    try {
      await api.addCustomItem(id, {
        title: customForm.title,
        unit_price: parseFloat(customForm.unit_price) || 0,
        quantity: parseInt(customForm.quantity) || 1,
        photo_url: customForm.photo_url || null,
        taxable: customForm.taxable ? 1 : 0
      });
      toast.success('Custom item added');
      setShowCustomForm(false);
      setCustomForm({ title: '', unit_price: '', quantity: '1', taxable: true, photo_url: '' });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleRemoveCustomItem = async (cid) => {
    try {
      await api.removeCustomItem(id, cid);
      toast.info('Removed custom item');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="empty-state"><div className="spinner" /></div>;
  if (!quote) return null;

  const taxRate = quote.tax_rate != null ? quote.tax_rate : settings.tax_rate;
  const visibleItems = (quote.items || []).filter(i => !i.hidden_from_quote);
  const totals = computeTotals(visibleItems, customItems, adjustments, taxRate);
  const logisticsItems = (quote.items || []).filter(it => (it.category || '').toLowerCase().includes('logistics'));

  return (
    <div className={styles.page}>
      {editing ? (
        <div className={styles.topBar}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/quotes')}>
            ← Quotes
          </button>
          <div className={styles.topActions}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Cancel Edit
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.topDiv}>
          <div className={styles.topDivLeft}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/quotes')}>
              ← Quotes
            </button>
            <div className={styles.tabs}>
              <button type="button" className={`${styles.tab} ${detailTab === 'quote' ? styles.tabActive : ''}`} onClick={() => setDetailTab('quote')}>Quote</button>
              <button type="button" className={`${styles.tab} ${detailTab === 'billing' ? styles.tabActive : ''}`} onClick={() => setDetailTab('billing')}>Billing</button>
              <button type="button" className={`${styles.tab} ${detailTab === 'files' ? styles.tabActive : ''}`} onClick={() => setDetailTab('files')}>Files {quoteFiles.length > 0 ? `(${quoteFiles.length})` : ''}</button>
              <button type="button" className={`${styles.tab} ${detailTab === 'logs' ? styles.tabActive : ''}`} onClick={() => setDetailTab('logs')}>Logs</button>
            </div>
          </div>
          <div className={styles.topDivActions}>
            {(quote.status || 'draft') === 'sent' && (
              <button type="button" className="btn btn-primary btn-sm" disabled={transitioning} onClick={handleApprove}>
                {transitioning ? '…' : 'Mark Approved'}
              </button>
            )}
            {(quote.status || 'draft') === 'approved' && (
              <button type="button" className="btn btn-primary btn-sm" disabled={transitioning} onClick={handleConfirm}>
                {transitioning ? '…' : 'Confirm Booking'}
              </button>
            )}
            {(quote.status || 'draft') === 'confirmed' && (
              <button type="button" className="btn btn-primary btn-sm" disabled={transitioning} onClick={handleClose}>
                {transitioning ? '…' : 'Close Quote'}
              </button>
            )}
            {['sent', 'approved', 'confirmed'].includes(quote.status || 'draft') && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={transitioning} onClick={handleRevert}>
                {transitioning ? '…' : 'Revert to Draft'}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSendClick} title="Email quote link to client">
              Send to Client
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleViewQuote} title="Open client-viewable quote in new tab">
              View Quote
            </button>
            {quote.public_token && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                const url = `${window.location.origin}/quote/public/${quote.public_token}`;
                navigator.clipboard.writeText(url);
                toast.success('Client link copied to clipboard');
              }}>
                Copy Client Link
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAI(true)}>
              ✨ AI Suggest
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={duplicating}
              onClick={handleDuplicateQuote}
              title="Duplicate this quote (same details and line items)"
            >
              {duplicating ? '…' : 'Duplicate'}
            </button>
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${styles.btnDanger}`}
              onClick={() => setShowConfirmDelete(true)}
              title="Delete this quote"
            >
              Delete
            </button>
          </div>
        </div>
      )}
      {!editing && (
        <QuoteHeader
          quote={quote}
          showTopRow={false}
          onEdit={() => setEditing(true)}
        />
      )}

      {editing ? (
        <div className={`card ${styles.editCard}`}>
          <form onSubmit={handleSaveEdit} className={styles.form}>
            <div className={styles.formRow}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Event name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Guest count</label>
                <input type="number" min="0" value={form.guest_count}
                  onChange={e => setForm(f => ({ ...f, guest_count: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Event date</label>
                <input type="date" value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
            </div>
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Rental period</h4>
              <div className={styles.formRow}>
                <div className="form-group">
                  <label>Delivery date</label>
                  <input type="date" value={form.delivery_date || ''} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Rental start</label>
                  <input type="date" value={form.rental_start || ''} onChange={e => setForm(f => ({ ...f, rental_start: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Rental end</label>
                  <input type="date" value={form.rental_end || ''} onChange={e => setForm(f => ({ ...f, rental_end: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Pickup date</label>
                  <input type="date" value={form.pickup_date || ''} onChange={e => setForm(f => ({ ...f, pickup_date: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Quote notes</label>
              <textarea rows={2} value={form.quote_notes || ''} onChange={e => setForm(f => ({ ...f, quote_notes: e.target.value }))} placeholder="Internal or client-facing notes for this quote" />
            </div>
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Client information</h4>
              <div className={styles.formRow}>
                <div className="form-group"><label>First name</label><input value={form.client_first_name || ''} onChange={e => setForm(f => ({ ...f, client_first_name: e.target.value }))} /></div>
                <div className="form-group"><label>Last name</label><input value={form.client_last_name || ''} onChange={e => setForm(f => ({ ...f, client_last_name: e.target.value }))} /></div>
              </div>
              <div className={styles.formRow}>
                <div className="form-group"><label>Email</label><input type="email" value={form.client_email || ''} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} /></div>
                <div className="form-group"><label>Phone</label><input value={form.client_phone || ''} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label>Address</label><input value={form.client_address || ''} onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))} /></div>
            </div>
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Venue information</h4>
              <div className={styles.formRow}>
                <div className="form-group"><label>Name</label><input value={form.venue_name || ''} onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))} /></div>
                <div className="form-group"><label>Email</label><input type="email" value={form.venue_email || ''} onChange={e => setForm(f => ({ ...f, venue_email: e.target.value }))} /></div>
                <div className="form-group"><label>Phone</label><input value={form.venue_phone || ''} onChange={e => setForm(f => ({ ...f, venue_phone: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label>Address</label><input value={form.venue_address || ''} onChange={e => setForm(f => ({ ...f, venue_address: e.target.value }))} /></div>
              <div className={styles.formRow}>
                <div className="form-group"><label>Contact</label><input value={form.venue_contact || ''} onChange={e => setForm(f => ({ ...f, venue_contact: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label>Venue notes</label><textarea rows={2} value={form.venue_notes || ''} onChange={e => setForm(f => ({ ...f, venue_notes: e.target.value }))} /></div>
            </div>
            <div className="form-group">
              <label>Tax rate (%)</label>
              <input type="number" min="0" step="0.01" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} placeholder="From settings if blank" />
            </div>
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Contract</h4>
              <p className={styles.notes}>Contract text shown to the client on the public quote page. Client can sign from the public link. Add templates on the Templates page, then choose one below or edit manually.</p>
              {contractTemplates.length > 0 && (
                <div className="form-group">
                  <label>Use template</label>
                  <select
                    value=""
                    onChange={e => {
                      const tid = e.target.value;
                      if (!tid) return;
                      const t = contractTemplates.find(ct => String(ct.id) === tid);
                      if (t) setContractBody(t.body_html || '');
                      e.target.value = '';
                    }}
                  >
                    <option value="">— Choose a contract template —</option>
                    {contractTemplates.map(ct => (
                      <option key={ct.id} value={ct.id}>{ct.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.form}>
                <div className="form-group">
                  <label>Contract body (HTML or plain text)</label>
                  <textarea
                    rows={10}
                    value={contractBody}
                    onChange={e => setContractBody(e.target.value)}
                    placeholder="Enter contract terms. Simple HTML allowed (e.g. &lt;p&gt;, &lt;strong&gt;)."
                  />
                </div>
                <div className={styles.formActions}>
                  <button type="button" className="btn btn-primary btn-sm" disabled={contractSaving} onClick={handleSaveContract}>
                    {contractSaving ? 'Saving…' : 'Save contract'}
                  </button>
                </div>
              </div>
              {contract && contract.signed_at && (
                <p className={styles.notes} style={{ marginTop: 12 }}>
                  Signed {new Date(contract.signed_at).toLocaleString()}
                  {contract.signer_name && ` by ${contract.signer_name}`}.
                </p>
              )}
              {contractLogs.length > 0 && (
                <div className={styles.contractLogs}>
                  <h4 className={styles.contractLogsTitle}>Change log</h4>
                  <ul className={styles.contractLogsList}>
                    {contractLogs.map(log => (
                      <li key={log.id} className={styles.contractLogItem}>
                        <span className={styles.contractLogWhen}>{log.changed_at ? new Date(log.changed_at).toLocaleString() : ''}</span>
                        <span className={styles.contractLogWho}>{log.user_email || 'Unknown user'}</span>
                        <span className={styles.contractLogWhat}>{contractLogSummary(log)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className={styles.formActions}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {detailTab === 'quote' && (
        <>
          {quote.quote_notes && <p className={styles.notes}><strong>Quote notes:</strong> {quote.quote_notes}</p>}
          <div className={styles.clientVenueRow}>
            <div className={styles.clientBlock}>
              {clientEditing ? (
                <form onSubmit={handleClientSave} className={styles.venueForm}>
                  <h4 className={styles.venueTitle}>Client information</h4>
                  <div className={styles.formRow}>
                    <div className="form-group"><label>First name</label><input value={form.client_first_name || ''} onChange={e => setForm(f => ({ ...f, client_first_name: e.target.value }))} /></div>
                    <div className="form-group"><label>Last name</label><input value={form.client_last_name || ''} onChange={e => setForm(f => ({ ...f, client_last_name: e.target.value }))} /></div>
                  </div>
                  <div className="form-group"><label>Email</label><input type="email" value={form.client_email || ''} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} /></div>
                  <div className="form-group"><label>Phone</label><input value={form.client_phone || ''} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} /></div>
                  <div className="form-group"><label>Address</label><input value={form.client_address || ''} onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))} /></div>
                  <div className={styles.formActions}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setClientEditing(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              ) : (
                <div role="button" tabIndex={0} className={styles.venueClickable} onClick={() => setClientEditing(true)} onKeyDown={e => e.key === 'Enter' && setClientEditing(true)}>
                  <h4 className={styles.venueTitle}>Client information</h4>
                  {(quote.client_first_name || quote.client_last_name || quote.client_email || quote.client_phone || quote.client_address) ? (
                    <div className={styles.venueGrid}>
                      {(quote.client_first_name || quote.client_last_name) && <span><strong>Name:</strong> {[quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ')}</span>}
                      {quote.client_email && <span><strong>Email:</strong> {quote.client_email}</span>}
                      {quote.client_phone && <span><strong>Phone:</strong> {quote.client_phone}</span>}
                      {quote.client_address && (
                        <span>
                          <strong>Address:</strong>{' '}
                          <button type="button" className={styles.addressLink} onClick={e => { e.stopPropagation(); api.getSettings().then(s => setAddressModalData({ address: quote.client_address, companyAddress: s.company_address || '', mapboxToken: s.mapbox_access_token || '' })).catch(() => setAddressModalData({ address: quote.client_address, companyAddress: settings.company_address || '', mapboxToken: '' })); }}>
                            {quote.client_address}
                          </button>
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className={styles.emptyHint}>Click to add client info</p>
                  )}
                </div>
              )}
            </div>
            <div className={styles.venueBlock}>
              {venueEditing ? (
                <form onSubmit={handleVenueSave} className={styles.venueForm}>
                  <h4 className={styles.venueTitle}>Venue information</h4>
                  <div className={styles.formRow}>
                    <div className="form-group"><label>Name</label><input value={form.venue_name || ''} onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))} /></div>
                    <div className="form-group"><label>Email</label><input type="email" value={form.venue_email || ''} onChange={e => setForm(f => ({ ...f, venue_email: e.target.value }))} /></div>
                  </div>
                  <div className="form-group"><label>Phone</label><input value={form.venue_phone || ''} onChange={e => setForm(f => ({ ...f, venue_phone: e.target.value }))} /></div>
                  <div className="form-group"><label>Address</label><input value={form.venue_address || ''} onChange={e => setForm(f => ({ ...f, venue_address: e.target.value }))} /></div>
                  <div className="form-group"><label>Contact</label><input value={form.venue_contact || ''} onChange={e => setForm(f => ({ ...f, venue_contact: e.target.value }))} /></div>
                  <div className="form-group"><label>Notes</label><textarea rows={2} value={form.venue_notes || ''} onChange={e => setForm(f => ({ ...f, venue_notes: e.target.value }))} /></div>
                  <div className={styles.formActions}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVenueEditing(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              ) : (
                <div role="button" tabIndex={0} className={styles.venueClickable} onClick={() => setVenueEditing(true)} onKeyDown={e => e.key === 'Enter' && setVenueEditing(true)}>
                  <h4 className={styles.venueTitle}>Venue information</h4>
                  {(quote.venue_name || quote.venue_email || quote.venue_phone || quote.venue_address || quote.venue_contact || quote.venue_notes) ? (
                    <div className={styles.venueGrid}>
                      {quote.venue_name && <span><strong>Name:</strong> {quote.venue_name}</span>}
                      {quote.venue_email && <span><strong>Email:</strong> {quote.venue_email}</span>}
                      {quote.venue_phone && <span><strong>Phone:</strong> {quote.venue_phone}</span>}
                      {quote.venue_address && (
                        <span>
                          <strong>Address:</strong>{' '}
                          <button type="button" className={styles.addressLink} onClick={e => { e.stopPropagation(); api.getSettings().then(s => setAddressModalData({ address: quote.venue_address, companyAddress: s.company_address || '', mapboxToken: s.mapbox_access_token || '' })).catch(() => setAddressModalData({ address: quote.venue_address, companyAddress: settings.company_address || '', mapboxToken: '' })); }}>
                            {quote.venue_address}
                          </button>
                        </span>
                      )}
                      {quote.venue_contact && <span><strong>Contact:</strong> {quote.venue_contact}</span>}
                      {quote.venue_notes && <span><strong>Notes:</strong> {quote.venue_notes}</span>}
                    </div>
                  ) : (
                    <p className={styles.emptyHint}>Click to add venue</p>
                  )}
                </div>
              )}
            </div>
          </div>

      <div className={styles.columns}>
        <div className={styles.builderCol}>
          <QuoteBuilder
            quoteId={id}
            items={quote.items}
            onItemsChange={load}
            onAddCustomItem={() => setShowCustomForm(true)}
            settings={settings}
            availability={availability}
            adjustments={adjustments}
            onAdjustmentsChange={setAdjustments}
          />
          {showCustomForm && (
            <form onSubmit={handleAddCustomItem} className={styles.customItemForm}>
              <div className={styles.formRow}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Item name *</label>
                  <input required placeholder="Custom item name" value={customForm.title} onChange={e => setCustomForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Price ($)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={customForm.unit_price} onChange={e => setCustomForm(f => ({ ...f, unit_price: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Qty</label>
                  <input type="number" min="1" value={customForm.quantity} onChange={e => setCustomForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className="form-group">
                  <label>Photo URL (optional)</label>
                  <input placeholder="https://... or pick from Files" value={customForm.photo_url} onChange={e => setCustomForm(f => ({ ...f, photo_url: e.target.value }))} />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end', paddingTop: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={customForm.taxable} onChange={e => setCustomForm(f => ({ ...f, taxable: e.target.checked }))} />
                    Taxable
                  </label>
                </div>
              </div>
              <ImagePicker onSelect={(url, price) => {
                setCustomForm(f => ({
                  ...f,
                  photo_url: url,
                  unit_price: (price != null && f.unit_price === '') ? String(price) : f.unit_price
                }));
              }} />
              <div className={styles.formActions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCustomForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Add item</button>
              </div>
            </form>
          )}
          {customItems.length > 0 && (
            <div className={styles.customItemsCompact}>
              <h4 className={styles.customItemsCompactTitle}>Custom items</h4>
              <ul className={styles.customItemsCompactList}>
                {customItems.map(ci => (
                  <li key={ci.id} className={styles.customItemCompact}>
                    <span>{ci.title} ×{ci.quantity || 1}</span>
                    <span>${((ci.unit_price || 0) * (ci.quantity || 1)).toFixed(2)}</span>
                    <button type="button" className={styles.logRemoveBtn} onClick={() => handleRemoveCustomItem(ci.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className={styles.exportCol}>
          <div className={`card ${styles.exportCard}`}>
            <h3 className={styles.exportTitle}>Export</h3>
            <QuoteExport quote={quote} settings={settings} totals={totals} customItems={customItems} visibleItems={visibleItems} />
          </div>
          {(totals.laborHours > 0 || totals.subtotal > 0 || totals.deliveryTotal > 0 || totals.customSubtotal > 0 || (quote?.items?.length > 0)) && (
            <div className={`card ${styles.totalsCard}`}>
              <h3 className={styles.exportTitle}>Summary</h3>
              <div className={styles.totalsList}>
                {totals.laborHours > 0 && (
                  <div className={styles.totalsRow}>
                    <span className={styles.totalsLabel}>Labor hours</span>
                    <span className={styles.totalsValue}>{totals.laborHours.toFixed(1)} hrs</span>
                  </div>
                )}
                {totals.subtotal > 0 && (
                  <div className={styles.totalsRow}>
                    <span className={styles.totalsLabel}>Subtotal</span>
                    <span className={styles.totalsValue}>${totals.subtotal.toFixed(2)}</span>
                  </div>
                )}
                {totals.customSubtotal > 0 && (
                  <div className={styles.totalsRow}>
                    <span className={styles.totalsLabel}>Custom</span>
                    <span className={styles.totalsValue}>${totals.customSubtotal.toFixed(2)}</span>
                  </div>
                )}
                {totals.deliveryTotal > 0 && (
                  <div className={styles.totalsRow}>
                    <span className={styles.totalsLabel}>Delivery</span>
                    <span className={styles.totalsValue}>${totals.deliveryTotal.toFixed(2)}</span>
                  </div>
                )}
                {adjustments.map(adj => {
                  const preTax = totals.subtotal + totals.deliveryTotal + totals.customSubtotal;
                  const val = adj.value_type === 'percent' ? preTax * (adj.amount / 100) : adj.amount;
                  const sign = adj.type === 'discount' ? '-' : '+';
                  return (
                    <div key={adj.id} className={`${styles.totalsRow} ${adj.type === 'discount' ? styles.totalsRowDiscount : styles.totalsRowSurcharge}`}>
                      <span className={styles.totalsLabel}>{adj.label} {adj.value_type === 'percent' ? `(${adj.amount}%)` : ''}</span>
                      <span className={styles.totalsValue}>{sign}${val.toFixed(2)}</span>
                    </div>
                  );
                })}
                {totals.rate > 0 && (
                  <div className={styles.totalsRow}>
                    <span className={styles.totalsLabel}>Tax ({totals.rate}%)</span>
                    <span className={styles.totalsValue}>${totals.tax.toFixed(2)}</span>
                  </div>
                )}
                <div className={`${styles.totalsRow} ${styles.totalsRowGrand}`}>
                  <span className={styles.totalsLabel}>Grand total</span>
                  <span className={styles.totalsValueGrand}>${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

          <div className={styles.logisticsBlock}>
            <div className={styles.logisticsHeader}>
              <h4 className={styles.logisticsTitle}>Logistics / Delivery</h4>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowLogPicker(v => !v); setLogSearch(''); }}>
                {showLogPicker ? 'Cancel' : '+ Add item'}
              </button>
            </div>
            {logisticsItems.length > 0 && (
              <ul className={styles.logisticsList}>
                {logisticsItems.map(it => (
                  <li key={it.qitem_id} className={styles.logisticsItem}>
                    <span className={styles.logisticsItemName}>{it.label || it.title} ×{it.quantity || 1}</span>
                    {(it.unit_price_override != null ? it.unit_price_override : it.unit_price) > 0 && <span>${((it.unit_price_override != null ? it.unit_price_override : it.unit_price) * (it.quantity || 1)).toFixed(2)}</span>}
                    <button type="button" className={styles.logRemoveBtn} onClick={() => handleRemoveLogisticsItem(it.qitem_id, it.label || it.title)}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            {logisticsItems.length === 0 && !showLogPicker && (
              <p className={styles.emptyHint}>No delivery items. Click "+ Add item" to add logistics-category items.</p>
            )}
            {showLogPicker && (
              <div className={styles.logPicker}>
                <input
                  className={styles.logPickerSearch}
                  placeholder="Search logistics items…"
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  autoFocus
                />
                {logItems.length === 0 ? (
                  <p className={styles.emptyHint}>No items with "logistics" in their category found in inventory.</p>
                ) : (
                  <div className={styles.logPickerList}>
                    {logItems
                      .filter(i => !logSearch || i.title.toLowerCase().includes(logSearch.toLowerCase()))
                      .map(item => (
                        <div key={item.id} className={styles.logPickerRow}>
                          <span className={styles.logPickerTitle}>{item.title}</span>
                          {item.unit_price > 0 && <span className={styles.logPickerPrice}>${item.unit_price.toFixed(2)}</span>}
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddLogisticsItem(item)}>+ Add</button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          </>)}
          {detailTab === 'billing' && (
            <div className={`card ${styles.editCard}`}>
              <h3 className={styles.formSectionTitle}>Billing</h3>
              {(() => {
                const applied = payments.reduce((s, p) => s + (p.amount || 0), 0);
                const balance = (totals.total || 0) - applied;
                const overpaid = balance < 0;
                return (
                  <div className={styles.billingSummary}>
                    <div className={styles.billingBlock}>
                      <h4 className={styles.venueTitle}>Contract total</h4>
                      <div className={styles.billingTotal}>${(totals.total || 0).toFixed(2)}</div>
                    </div>
                    <div className={styles.billingBlock}>
                      <h4 className={styles.venueTitle}>Applied</h4>
                      <div className={styles.billingApplied}>
                        ${applied.toFixed(2)}
                      </div>
                    </div>
                    <div className={styles.billingBlock}>
                      <h4 className={styles.venueTitle}>Balance</h4>
                      <div className={styles.billingBalance}>
                        ${(overpaid ? 0 : balance).toFixed(2)}
                      </div>
                    </div>
                    {overpaid && (
                      <div className={styles.billingBlockOverpaid}>
                        <h4 className={styles.venueTitle}>Overpaid</h4>
                        <div className={styles.billingOverpaid}>
                          ${Math.abs(balance).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className={styles.formActions} style={{ marginBottom: 16 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowPaymentModal(true)}>
                  Record offline payment
                </button>
              </div>
              {payments.length > 0 ? (
                <table className={styles.logTable}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th>Amount</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : (p.created_at ? new Date(p.created_at).toLocaleDateString() : '—')}</td>
                        <td>{p.method || '—'}</td>
                        <td>{p.reference || '—'}</td>
                        <td>${(p.amount || 0).toFixed(2)}</td>
                        <td>{p.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className={styles.emptyHint}>No payments recorded yet.</p>
              )}
              {quote.status === 'closed' && (
                <div className={styles.damageSection}>
                  <div className={styles.damageSectionHeader}>
                    <h4>Damage Charges</h4>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowDamageForm(v => !v)}>
                      {showDamageForm ? 'Cancel' : '+ Add Damage Charge'}
                    </button>
                  </div>
                  {showDamageForm && (
                    <form onSubmit={handleAddDamageCharge} className={styles.damageForm}>
                      <div className={styles.formRow}>
                        <div className="form-group" style={{ flex: 2 }}>
                          <label>Description *</label>
                          <input required value={damageForm.title}
                            onChange={e => setDamageForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="e.g. Broken chair leg" />
                        </div>
                        <div className="form-group">
                          <label>Amount ($) *</label>
                          <input type="number" min="0.01" step="0.01" required
                            value={damageForm.amount}
                            onChange={e => setDamageForm(f => ({ ...f, amount: e.target.value }))} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Note (optional)</label>
                        <input value={damageForm.note}
                          onChange={e => setDamageForm(f => ({ ...f, note: e.target.value }))}
                          placeholder="Internal note" />
                      </div>
                      <div className={styles.formActions}>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={damageSaving}>
                          {damageSaving ? 'Saving…' : 'Add Charge'}
                        </button>
                      </div>
                    </form>
                  )}
                  {damageCharges.length === 0 ? (
                    <p className={styles.emptyHint}>No damage charges recorded.</p>
                  ) : (
                    <ul className={styles.damageList}>
                      {damageCharges.map(c => (
                        <li key={c.id} className={styles.damageItem}>
                          <span className={styles.damageTitle}>{c.title}</span>
                          <span className={styles.damageAmount}>${Number(c.amount).toFixed(2)}</span>
                          {c.note && <span className={styles.damageNote}>{c.note}</span>}
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRemoveDamageCharge(c.id)}>
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {damageCharges.length > 0 && (
                    <div className={styles.damageTotalRow}>
                      <span>Total damage charges</span>
                      <span className={styles.damageAmount}>
                        ${damageCharges.reduce((s, c) => s + Number(c.amount), 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {detailTab === 'files' && (
            <div className={`card ${styles.editCard}`}>
              <h3 className={styles.formSectionTitle}>Files</h3>
              <p className={styles.notes}>Files attached to this quote. Add from your media library.</p>
              <div className={styles.formActions} style={{ marginBottom: 12 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowFilePicker(true)}>
                  Add file from library
                </button>
              </div>
              {quoteFiles.length > 0 ? (
                <ul className={styles.quoteFilesList}>
                  {quoteFiles.map(f => (
                    <li key={f.attachment_id || f.file_id} className={styles.quoteFileItem}>
                      <a href={api.fileServeUrl(f.file_id)} target="_blank" rel="noopener noreferrer" className={styles.quoteFileName}>
                        {f.original_name || 'File #' + f.file_id}
                      </a>
                      {f.size != null && <span className={styles.quoteFileSize}> ({(f.size / 1024).toFixed(1)} KB)</span>}
                      <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => handleDetachFile(f.file_id)}>Remove</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyHint}>No files attached to this quote.</p>
              )}
            </div>
          )}
          {detailTab === 'logs' && (
            <div className={`card ${styles.editCard}`}>
              <h3 className={styles.formSectionTitle}>Activity log</h3>
              <p className={styles.notes}>All changes to this quote: items, custom items, contract, payments, and files. Includes user, time, and original vs changed values.</p>
              {activity.length > 0 ? (
                <ul className={styles.activityLogList}>
                  {activity.map(entry => (
                    <li key={entry.id} className={styles.activityLogItem}>
                      <div className={styles.activityLogMeta}>
                        <span className={styles.contractLogWhen}>{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
                        <span className={styles.contractLogWho}>{entry.user_email || 'System'}</span>
                      </div>
                      <div className={styles.contractLogWhat}>{entry.description || entry.event_type}</div>
                      {(entry.old_value || entry.new_value) && (
                        <div className={styles.activityLogValues}>
                          {entry.old_value && <div className={styles.activityLogOld}><strong>Original:</strong> {entry.old_value}</div>}
                          {entry.new_value && <div className={styles.activityLogNew}><strong>Changed to:</strong> {entry.new_value}</div>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyHint}>No activity yet.</p>
              )}
            </div>
          )}
        </>

      )}

      {showAI && (
        <AISuggestModal
          quoteId={id}
          guestCount={quote.guest_count || 0}
          currentItems={quote.items || []}
          onAdd={handleAIAdd}
          onClose={() => setShowAI(false)}
        />
      )}

      {showSendModal && (
        <QuoteSendModal
          quote={quote}
          onClose={() => setShowSendModal(false)}
          onSent={() => { setShowSendModal(false); load(); toast.success('Quote sent; client link ready.'); }}
          onError={e => toast.error(e.message)}
        />
      )}

      {showPaymentModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPaymentModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Record offline payment</h3>
            <form onSubmit={handleRecordPayment} className={styles.form}>
              <div className="form-group">
                <label>Amount ($) *</label>
                <input type="number" step="0.01" min="0" required value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Method</label>
                <select value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}>
                  <option>Offline - Check</option>
                  <option>Cash</option>
                  <option>ACH</option>
                  <option>Card</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Reference (e.g. check #)</label>
                <input value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="datetime-local" value={paymentForm.paid_at} onChange={e => setPaymentForm(f => ({ ...f, paid_at: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Note</label>
                <input value={paymentForm.note} onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional" />
              </div>
              <div className={styles.formActions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={paymentSaving}>{paymentSaving ? 'Saving…' : 'Record payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFilePicker && (
        <QuoteFilePicker
          currentFileIds={quoteFiles.map(f => f.file_id)}
          onSelect={handleAttachFile}
          onClose={() => setShowFilePicker(false)}
        />
      )}

      {showConfirmDelete && (
        <ConfirmDialog
          message={`Delete quote "${quote?.name || 'this quote'}"? This cannot be undone.`}
          onConfirm={handleDeleteQuote}
          onCancel={() => setShowConfirmDelete(false)}
        />
      )}

      {addressModalData != null && (
        <AddressMapModal
          address={addressModalData.address}
          companyAddress={addressModalData.companyAddress}
          mapboxToken={addressModalData.mapboxToken}
          onClose={() => setAddressModalData(null)}
        />
      )}
    </div>
  );
}

// File picker for quote attachments — pick from media library
function QuoteFilePicker({ currentFileIds = [], onSelect, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getFiles().then(d => setFiles(d.files || [])).catch(() => setFiles([])).finally(() => setLoading(false));
  }, []);
  const attached = new Set(currentFileIds);
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className={styles.imagePickerHeader}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Add file to quote</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>
        ) : files.length === 0 ? (
          <p className={styles.emptyHint}>No files in library. Upload files on the Files page first.</p>
        ) : (
          <ul className={styles.quoteFilesList} style={{ maxHeight: 320, overflowY: 'auto' }}>
            {files.map(f => (
              <li key={f.id} className={styles.quoteFileItem}>
                <span className={styles.quoteFileName}>{f.original_name || 'File #' + f.id}</span>
                {attached.has(f.id) ? (
                  <span className={styles.quoteFileSize}> (already attached)</span>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => onSelect(f.id)}>Attach</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Image picker for custom items — loads from Files + Inventory
function ImagePicker({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [fileImages, setFileImages] = useState([]);
  const [invImages, setInvImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      api.getFiles().catch(() => ({ files: [] })),
      api.getItems({ hidden: '0' }).catch(() => ({ items: [] }))
    ]).then(([filesData, itemsData]) => {
      setFileImages((filesData.files || []).filter(f => f.mime_type && f.mime_type.startsWith('image/')));
      setInvImages((itemsData.items || []).filter(i => i.photo_url));
    }).finally(() => setLoading(false));
  }, [open]);

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Pick image from library
      </button>
    );
  }

  return (
    <div className={styles.imagePicker}>
      <div className={styles.imagePickerHeader}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Pick an image</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Close</button>
      </div>
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center' }}><div className="spinner" /></div>
      ) : (
        <div className={styles.imagePickerGrid}>
          {fileImages.map(f => (
            <button
              key={'f-' + f.id}
              type="button"
              className={styles.imagePickerThumb}
              onClick={() => { onSelect(api.fileServeUrl(f.id), null); setOpen(false); }}
              title={f.original_name}
            >
              <img src={api.fileServeUrl(f.id)} alt={f.original_name} onError={e => { e.target.style.display = 'none'; }} />
            </button>
          ))}
          {invImages.map(i => (
            <button
              key={'i-' + i.id}
              type="button"
              className={styles.imagePickerThumb}
              onClick={() => { onSelect(api.proxyImageUrl(i.photo_url), i.unit_price || null); setOpen(false); }}
              title={i.title}
            >
              <img src={api.proxyImageUrl(i.photo_url)} alt={i.title} onError={e => { e.target.style.display = 'none'; }} />
            </button>
          ))}
          {fileImages.length === 0 && invImages.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: 12 }}>No images found. Upload images to the Files page first.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Email send modal: To, template, subject, body, attachments, Send
function QuoteSendModal({ quote, onClose, onSent, onError }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [toEmail, setToEmail] = useState(quote?.client_email || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [allFiles, setAllFiles] = useState([]);
  const [attachmentIds, setAttachmentIds] = useState([]);

  useEffect(() => {
    api.getTemplates().then(d => {
      const list = d.templates || [];
      setTemplates(list);
      const defaultT = list.find(t => t.is_default);
      if (defaultT) {
        setSelectedId(String(defaultT.id));
        api.getTemplate(defaultT.id).then(t => {
          setSubject(t.subject || '');
          setBody(t.body_text || t.body_html || '');
        }).catch(() => {});
      }
    }).catch(() => {});
    api.getFiles().then(d => setAllFiles(d.files || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setToEmail(quote?.client_email || '');
  }, [quote?.client_email]);

  const loadTemplate = (id) => {
    if (!id) return;
    api.getTemplate(id).then(t => {
      setSubject(t.subject || '');
      setBody(t.body_text || t.body_html || '');
    }).catch(() => {});
  };

  function toggleAttachment(id) {
    setAttachmentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.sendQuote(quote.id, { templateId: selectedId || undefined, subject, bodyText: body, bodyHtml: body, toEmail: toEmail || undefined, attachmentIds });
      onSent();
    } catch (e) {
      onError(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Send quote to client</h3>
        <form onSubmit={handleSend} className={styles.sendForm}>
          <div className="form-group">
            <label>To</label>
            <input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="client@example.com" />
          </div>
          <div className="form-group">
            <label>Template</label>
            <select value={selectedId} onChange={e => { setSelectedId(e.target.value); loadTemplate(e.target.value); }}>
              <option value="">— None —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (default)' : ''}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Quote from..." />
          </div>
          <div className="form-group">
            <label>Body</label>
            <textarea rows={6} value={body} onChange={e => setBody(e.target.value)} placeholder="Email body..." />
          </div>
          {allFiles.length > 0 && (
            <div className="form-group">
              <label>Attachments</label>
              <div className={styles.attachmentGrid}>
                {allFiles.map(f => {
                  const isImg = f.mime_type && f.mime_type.startsWith('image/');
                  const selected = attachmentIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className={`${styles.attachThumb} ${selected ? styles.attachSelected : ''}`}
                      onClick={() => toggleAttachment(f.id)}
                      title={f.original_name}
                    >
                      {isImg
                        ? <img src={api.fileServeUrl(f.id)} alt={f.original_name} onError={e => { e.target.style.display = 'none'; }} />
                        : <span style={{ fontSize: 24 }}>📎</span>
                      }
                      <span className={styles.attachName}>{f.original_name}</span>
                      {selected && <span className={styles.attachCheck}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className={styles.formActions}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

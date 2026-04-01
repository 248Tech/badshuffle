import React, { Suspense, lazy, useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { useNavigationBlocker } from '../hooks/useNavigationBlocker.js';
import { useQuoteDetail } from '../hooks/useQuoteDetail.js';
import { api } from '../api.js';
import QuoteBuilder from '../components/QuoteBuilder.jsx';
import QuoteExport from '../components/QuoteExport.jsx';
import QuoteHeader from '../components/QuoteHeader.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { computeTotals } from '../lib/quoteTotals.js';
import ImagePicker from '../components/ImagePicker.jsx';
import MessageBody from '../components/messages/MessageBody.jsx';
import { hasPermission } from '../lib/permissions.js';
import styles from './QuoteDetailPage.module.css';

const AISuggestModal = lazy(() => import('../components/AISuggestModal.jsx'));
const AddressMapModal = lazy(() => import('../components/AddressMapModal.jsx'));
const QuoteFilePicker = lazy(() => import('../components/QuoteFilePicker.jsx'));
const QuoteSendModal = lazy(() => import('../components/QuoteSendModal.jsx'));
const RenameLogisticsModal = lazy(() => import('../components/features/logistics/RenameLogisticsModal.jsx'));
const QuoteBillingPanel = lazy(() => import('./quote-detail/QuoteBillingPanel.jsx'));
const QuoteFilesPanel = lazy(() => import('./quote-detail/QuoteFilesPanel.jsx'));
const QuoteLogsPanel = lazy(() => import('./quote-detail/QuoteLogsPanel.jsx'));
const QuoteFulfillmentPanel = lazy(() => import('./quote-detail/QuoteFulfillmentPanel.jsx'));
const ItemDetailDrawer = lazy(() => import('../components/ItemDetailDrawer.jsx'));
const ImageLightbox = lazy(() => import('../components/ImageLightbox.jsx'));

const isLogistics = (item) => (item.category || '').toLowerCase().includes('logistics');

function DeferredPanelFallback({ label = 'Loading…' }) {
  return (
    <div className="card" style={{ padding: 20, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <span className="spinner" aria-hidden="true" />
      <span className={styles.notes}>{label}</span>
    </div>
  );
}


export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const outletContext = useOutletContext() || {};
  const authUser = outletContext.authUser || null;
  const toast = useToast();

  const controller = useQuoteDetail(id, { autoEdit: !!(location.state?.autoEdit) });
  const { quote, customItems, sections, settings, loading, editing, form, saving, adjustments, availability } = controller;
  const { setQuote, setCustomItems, setAdjustments, setEditing, setForm } = controller;
  const eventTypes = String(settings.quote_event_types || '').split('\n').map((v) => v.trim()).filter(Boolean);
  const [showAI, setShowAI] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [venueEditing, setVenueEditing] = useState(false);
  const [clientEditing, setClientEditing] = useState(false);
  const [notesEditing, setNotesEditing] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [pendingTransition, setPendingTransition] = useState(null); // { message, label, confirmClass, action }
  const [pendingPaymentDelete, setPendingPaymentDelete] = useState(null);
  const [pendingContractTemplate, setPendingContractTemplate] = useState(null);
  const [duplicating, setDuplicating] = useState(false);
  const [addressModalData, setAddressModalData] = useState(null);
  const [showLogPicker, setShowLogPicker] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logItems, setLogItems] = useState([]);
  const [renameLogistics, setRenameLogistics] = useState(null);
  // Custom items form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({ title: '', unit_price: '', quantity: '1', taxable: true, photo_url: '' });
  // Contract (in edit-quote settings)
  const [detailTab, setDetailTab] = useState(() => window.innerWidth <= 640 ? 'items' : 'quote');
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const quoteExportRef = useRef(null);
  const [contract, setContract] = useState(null);
  const [contractBody, setContractBody] = useState('');
  const [contractSaving, setContractSaving] = useState(false);
  const [contractLogs, setContractLogs] = useState([]);
  const [contractTemplates, setContractTemplates] = useState([]);
  const [savedContractBody, setSavedContractBody] = useState('');
  // Billing tab
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState(() => {
    const now = new Date();
    const todayLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return { amount: '', method: 'Offline - Check', reference: '', note: '', paid_at: todayLocal };
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  // Files tab
  const [quoteFiles, setQuoteFiles] = useState([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  // Logs tab
  const [activity, setActivity] = useState([]);
  const [fulfillment, setFulfillment] = useState(null);
  // Availability
  // Adjustments
  // Quote messages (for sales team view)
  const [quoteMessages, setQuoteMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgLinks, setMsgLinks] = useState('');
  const [msgAttachments, setMsgAttachments] = useState([]);
  const [msgRich, setMsgRich] = useState(false);
  const msgFileInputRef = useRef(null);
  // Status transitions
  const [transitioning, setTransitioning] = useState(false);
  // Damage charges (closed quotes)
  const [damageCharges, setDamageCharges] = useState([]);
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [damageForm, setDamageForm] = useState({ title: '', amount: '', note: '' });
  const [damageSaving, setDamageSaving] = useState(false);
  // Item detail drawer
  const [drawerItemId, setDrawerItemId] = useState(null);
  // Image lightbox
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  // Payment policies + rental terms lists (for edit form selectors)
  const [paymentPolicies, setPaymentPolicies] = useState([]);
  const [rentalTermsList, setRentalTermsList] = useState([]);
  // Discard-changes confirm (Cancel Edit when dirty)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const isDirty = controller.isDirty;
  const contractDirty = editing && contractBody !== (savedContractBody || '');
  const hasUnsavedChanges = isDirty || contractDirty;
  const permissions = authUser?.permissions || {};
  const canModifyQuote = hasPermission(permissions, 'projects', 'modify');
  const canReadBilling = hasPermission(permissions, 'billing', 'read');
  const canReadFiles = hasPermission(permissions, 'files', 'read');
  const canReadMessages = hasPermission(permissions, 'messages', 'read');
  const canModifyFulfillment = hasPermission(permissions, 'fulfillment', 'modify');
  const canSeeFulfillment = canModifyFulfillment && ['confirmed', 'closed'].includes(String(quote?.status || 'draft'));

  // Warn on browser refresh / tab close
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Block in-app navigation when there are unsaved changes
  const blocker = useNavigationBlocker(hasUnsavedChanges);

  useEffect(() => {
    if (!canModifyQuote && editing) setEditing(false);
  }, [canModifyQuote, editing, setEditing]);

  // ─────────────────────────────────────────────────────────────────────────
  const load = controller.load;
  useEffect(() => {
    if (!id) return;
    api.getQuoteFiles(id).then(d => setQuoteFiles(d.files || [])).catch(() => setQuoteFiles([]));
    api.getQuoteContract(id).then(d => setContract(d.contract)).catch(() => {});
    api.getMessages({ quote_id: id }).then(d => setQuoteMessages((d.messages || []).slice().reverse())).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!quote) return;
    const ids = [];
    for (const it of quote.items || []) {
      const p = it.photo_url;
      if (p != null && /^\d+$/.test(String(p).trim())) ids.push(String(p).trim());
    }
    const cis = (customItems && customItems.length > 0 ? customItems : quote.customItems) || [];
    for (const ci of cis) {
      const p = ci.photo_url;
      if (p != null && /^\d+$/.test(String(p).trim())) ids.push(String(p).trim());
    }
    for (const f of quoteFiles || []) {
      if (f.file_id != null && /^\d+$/.test(String(f.file_id))) ids.push(String(f.file_id));
    }
    if (!ids.length) return;
    api.prefetchFileServeUrls(ids).catch(() => {});
  }, [quote, customItems, quoteFiles]);

  useEffect(() => {
    if (!quoteMessages.length) return;
    const ids = [];
    for (const m of quoteMessages) {
      try {
        const raw = typeof m.attachments_json === 'string' ? JSON.parse(m.attachments_json) : m.attachments_json;
        if (Array.isArray(raw)) {
          for (const a of raw) {
            if (a && a.file_id != null && /^\d+$/.test(String(a.file_id))) ids.push(String(a.file_id));
          }
        }
      } catch { /* ignore */ }
    }
    if (!ids.length) return;
    api.prefetchFileServeUrls(ids).catch(() => {});
  }, [quoteMessages]);

  // Load contract, contract templates, payment policies, rental terms when editing
  useEffect(() => {
    if (!editing || !id) return;
    api.getQuoteContract(id)
      .then(d => {
        const nextBody = d.contract ? (d.contract.body_html || '') : '';
        setContract(d.contract);
        setContractBody(nextBody);
        setSavedContractBody(nextBody);
      })
      .catch(() => toast.error('Failed to load contract'));
    api.getQuoteContractLogs(id)
      .then(d => setContractLogs(d.logs || []))
      .catch(() => setContractLogs([]));
    api.getContractTemplates()
      .then(d => setContractTemplates(d.contractTemplates || []))
      .catch(() => setContractTemplates([]));
    api.getPaymentPolicies()
      .then(d => setPaymentPolicies(d.policies || []))
      .catch(() => {});
    api.getRentalTerms()
      .then(d => setRentalTermsList(d.terms || []))
      .catch(() => {});
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

  useEffect(() => {
    if (detailTab !== 'fulfillment' || !id || !canSeeFulfillment) return;
    api.getQuoteFulfillment(id).then((data) => setFulfillment(data)).catch(() => setFulfillment(null));
  }, [detailTab, id, canSeeFulfillment]);

  const handleSaveContract = async (e) => {
    e?.preventDefault();
    setContractSaving(true);
    try {
      const d = await api.updateQuoteContract(id, { body_html: contractBody });
      setContract(d.contract);
      setSavedContractBody(d.contract ? (d.contract.body_html || '') : '');
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
      const nowLocal = new Date(); const todayLocal = new Date(nowLocal.getTime() - nowLocal.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setPaymentForm(f => ({ amount: '', method: f.method, reference: '', note: '', paid_at: todayLocal }));
      const logsRes = await api.getQuoteActivity(id);
      setActivity(logsRes.activity || []);
      toast.success('Payment recorded');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    try {
      const d = await api.removeQuotePayment(id, paymentId);
      setPayments(d.payments || []);
      const logsRes = await api.getQuoteActivity(id);
      setActivity(logsRes.activity || []);
      toast.info('Payment removed');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPendingPaymentDelete(null);
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
      toast.info('Project deleted');
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
      const { quote: newQuote } = await api.duplicateQuote(id);
      toast.success('Quote duplicated');
      navigate(`/quotes/${newQuote.id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDuplicating(false);
    }
  };
  const handleSaveEdit = controller.handleSaveEdit;

  const handleAIAdd = async (item) => {
    try {
      await api.addQuoteItem(id, { item_id: item.id });
      toast.success('Added ' + item.title);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) { setShowCancelConfirm(true); return; }
    controller.discardEdits();
    setContractBody(savedContractBody || '');
  };

  const confirmCancelEdit = () => {
    setShowCancelConfirm(false);
    controller.discardEdits();
    setContractBody(savedContractBody || '');
  };

  const discardAndProceedNavigation = () => {
    controller.discardEdits();
    setContractBody(savedContractBody || '');
    blocker.proceed();
  };

  const handleCancelClientEdit = () => {
    setForm((current) => ({
      ...current,
      client_first_name: quote?.client_first_name || '',
      client_last_name: quote?.client_last_name || '',
      client_email: quote?.client_email || '',
      client_phone: quote?.client_phone || '',
      client_address: quote?.client_address || '',
    }));
    setClientEditing(false);
  };

  const handleCancelVenueEdit = () => {
    setForm((current) => ({
      ...current,
      venue_name: quote?.venue_name || '',
      venue_email: quote?.venue_email || '',
      venue_phone: quote?.venue_phone || '',
      venue_address: quote?.venue_address || '',
      venue_contact: quote?.venue_contact || '',
      venue_notes: quote?.venue_notes || '',
    }));
    setVenueEditing(false);
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

  const applyContractTemplate = (template) => {
    if (!template) return;
    setContractBody(template.body_html || '');
    setPendingContractTemplate(null);
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

  const handleSaveLogisticsRename = async (newLabel) => {
    if (!renameLogistics) return;
    try {
      await api.updateQuoteItem(id, renameLogistics.qitem_id, { label: newLabel });
      toast.success('Logistics line updated');
      setRenameLogistics(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleQuoteMsgAttach = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    try {
      const d = await api.uploadFiles(formData);
      const list = d.files || [];
      setMsgAttachments((prev) => [...prev, ...list.map((f) => ({ file_id: f.id, name: f.original_name }))]);
      toast.success(`Uploaded ${list.length} file(s)`);
    } catch (err) {
      toast.error(err.message);
    }
    e.target.value = '';
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

  const handleNotesSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateQuote(id, {
        notes: form.notes || null,
        quote_notes: form.quote_notes || null,
      });
      toast.success('Notes saved');
      setNotesEditing(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelNotesEdit = () => {
    setForm(current => ({
      ...current,
      notes: quote?.notes || '',
      quote_notes: quote?.quote_notes || '',
    }));
    setNotesEditing(false);
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

  const handleRevert = () => {
    setPendingTransition({
      message: 'Revert this project to draft? The client link will still work but status resets.',
      label: 'Revert to Draft',
      confirmClass: 'btn-ghost',
      action: async () => {
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
      },
    });
  };

  const handleConfirm = () => {
    setPendingTransition({
      message: 'Confirm this booking? This creates a hard inventory reservation.',
      label: 'Confirm Booking',
      confirmClass: 'btn-primary',
      action: async () => {
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
      },
    });
  };

  const handleClose = () => {
    setPendingTransition({
      message: 'Close this project? This marks the event as complete and releases inventory.',
      label: 'Close Project',
      confirmClass: 'btn-primary',
      action: async () => {
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
      },
    });
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

  if (loading) return (
    <div className={styles.page} aria-busy="true" aria-label="Loading project">
      {/* Top bar skeleton */}
      <div className={styles.topDiv}>
        <div className={styles.topDivLeft}>
          <div className="skeleton" style={{ height: 30, width: 90, borderRadius: 6 }} aria-hidden="true" />
          <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 30, width: 68, borderRadius: 999 }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }} aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 30, width: 80, borderRadius: 6 }} />
          ))}
        </div>
      </div>
      {/* Quote header skeleton */}
      <div className="card" style={{ padding: 20 }} aria-hidden="true">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div className="skeleton" style={{ height: 22, width: 220, borderRadius: 5 }} />
          <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton" style={{ height: 11, width: 60, borderRadius: 3, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 15, width: 90, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
      {/* Main columns skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }} aria-hidden="true">
        <div className="card" style={{ padding: 20 }}>
          <div className="skeleton" style={{ height: 16, width: '40%', borderRadius: 5, marginBottom: 16 }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div className="skeleton" style={{ height: 44, width: 44, borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 13, width: `${50 + (i % 3) * 15}%`, borderRadius: 4, marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 11, width: '30%', borderRadius: 3 }} />
              </div>
              <div className="skeleton" style={{ height: 13, width: 50, borderRadius: 4, flexShrink: 0 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="skeleton" style={{ height: 13, width: '60%', borderRadius: 4, marginBottom: 12 }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="skeleton" style={{ height: 13, width: '45%', borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 13, width: '25%', borderRadius: 4 }} />
              </div>
            ))}
            <div className="skeleton" style={{ height: 20, width: '50%', borderRadius: 4, marginTop: 8 }} />
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div className="skeleton" style={{ height: 13, width: '50%', borderRadius: 4, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 32, borderRadius: 6 }} />
          </div>
        </div>
      </div>
    </div>
  );
  if (!quote) return null;

  const taxRate = quote.tax_rate != null ? quote.tax_rate : settings.tax_rate;
  const visibleItems = (quote.items || []).filter(i => !i.hidden_from_quote);
  const totals = computeTotals({
    items: visibleItems,
    customItems,
    adjustments,
    taxRate,
  });
  const logisticsItems = (quote.items || []).filter(it => (it.category || '').toLowerCase().includes('logistics'));

  return (
    <div className={styles.page}>
      {editing && canModifyQuote ? (
        <div className={styles.topBar}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/quotes')}>
            ← Projects
          </button>
          <div className={styles.topActions}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancelEdit}>
              Cancel Edit{hasUnsavedChanges ? ' ●' : ''}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.topDiv}>
          <div className={styles.topDivLeft}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/quotes')}>
              <span aria-hidden="true">←</span> Projects
            </button>
            <div className={styles.tabsWrap}>
              <div className={styles.tabs}>
                <button type="button" className={`${styles.tab} ${styles.mobileItemsTab} ${detailTab === 'items' ? styles.tabActive : ''}`} onClick={() => setDetailTab('items')}>Items{(quote.items || []).length > 0 ? ` (${(quote.items || []).length})` : ''}</button>
                {canSeeFulfillment && <button type="button" className={`${styles.tab} ${detailTab === 'fulfillment' ? styles.tabActive : ''}`} onClick={() => setDetailTab('fulfillment')}>Fulfillment</button>}
                {canReadBilling && <button type="button" className={`${styles.tab} ${detailTab === 'billing' ? styles.tabActive : ''}`} onClick={() => setDetailTab('billing')}>Billing</button>}
                {canReadFiles && <button type="button" className={`${styles.tab} ${detailTab === 'files' ? styles.tabActive : ''}`} onClick={() => setDetailTab('files')}>Files {quoteFiles.length > 0 ? `(${quoteFiles.length})` : ''}</button>}
                <button type="button" className={`${styles.tab} ${detailTab === 'logs' ? styles.tabActive : ''}`} onClick={() => setDetailTab('logs')}>Logs</button>
                <button type="button" className={`${styles.tab} ${detailTab === 'quote' ? styles.tabActive : ''}`} onClick={() => setDetailTab('quote')}>Details</button>
              </div>
            </div>
          </div>
          <div className={styles.topDivActions}>
            {/* Status-specific primary actions — always visible */}
            {canModifyQuote && (quote.status || 'draft') === 'sent' && (
              <button type="button" className="btn btn-primary btn-sm" disabled={transitioning} onClick={handleApprove}>
                {transitioning ? 'Approving…' : 'Mark Approved'}
              </button>
            )}
            {canModifyQuote && (quote.status || 'draft') === 'approved' && (
              <button type="button" className="btn btn-primary btn-sm" disabled={transitioning} onClick={handleConfirm}>
                {transitioning ? 'Confirming…' : 'Confirm Booking'}
              </button>
            )}
            {canModifyQuote && (quote.status || 'draft') === 'confirmed' && (
              <button type="button" className="btn btn-primary btn-sm" disabled={transitioning} onClick={handleClose}>
                {transitioning ? 'Closing…' : 'Close Quote'}
              </button>
            )}
            {/* Send — desktop always visible; on mobile it's in the Items tab */}
            <button type="button" className={`btn btn-primary btn-sm ${styles.desktopAction}`} onClick={handleSendClick}>
              Send to Client
            </button>
            {/* Secondary actions — desktop only */}
            {['sent', 'approved', 'confirmed'].includes(quote.status || 'draft') && (
              <button type="button" className={`btn btn-ghost btn-sm ${styles.desktopAction}`} disabled={transitioning} onClick={handleRevert}>
                {transitioning ? 'Reverting…' : 'Revert to Draft'}
              </button>
            )}
            <button type="button" className={`btn btn-ghost btn-sm ${styles.desktopAction}`} onClick={handleViewQuote}>View Quote</button>
            {quote.public_token && (
              <button type="button" className={`btn btn-ghost btn-sm ${styles.desktopAction}`} onClick={() => {
                const url = `${window.location.origin}/quote/public/${quote.public_token}`;
                navigator.clipboard.writeText(url);
                toast.success('Client link copied to clipboard');
              }}>Copy Client Link</button>
            )}
            <button type="button" className={`btn btn-ghost btn-sm ${styles.desktopAction}`} onClick={() => setShowAI(true)}>
              <span aria-hidden="true">✨</span> AI Suggest
            </button>
            <button type="button" className={`btn btn-ghost btn-sm ${styles.desktopAction}`} disabled={duplicating} onClick={handleDuplicateQuote}>
              {duplicating ? 'Duplicating…' : 'Duplicate'}
            </button>
            <button type="button" className={`btn btn-ghost btn-sm ${styles.btnDanger} ${styles.desktopAction}`} onClick={() => setShowConfirmDelete(true)}>
              Delete
            </button>
            {/* Mobile overflow menu — only visible on mobile */}
            <div className={styles.mobileMenuWrap}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setMobileMenuOpen(v => !v)}
                aria-label="More actions"
                aria-expanded={mobileMenuOpen}
              >
                ⋮ More
              </button>
              {mobileMenuOpen && (
                <>
                  <div className={styles.mobileMenuBackdrop} onClick={() => setMobileMenuOpen(false)} />
                  <div className={styles.mobileMenu} role="menu">
                    {['sent', 'approved', 'confirmed'].includes(quote.status || 'draft') && (
                      <button type="button" className={styles.mobileMenuItem} disabled={transitioning} onClick={() => { setMobileMenuOpen(false); handleRevert(); }}>
                        {transitioning ? 'Reverting…' : 'Revert to Draft'}
                      </button>
                    )}
                    <button type="button" className={styles.mobileMenuItem} onClick={() => { setMobileMenuOpen(false); handleViewQuote(); }}>View Quote</button>
                    {quote.public_token && (
                      <button type="button" className={styles.mobileMenuItem} onClick={() => {
                        setMobileMenuOpen(false);
                        const url = `${window.location.origin}/quote/public/${quote.public_token}`;
                        navigator.clipboard.writeText(url);
                        toast.success('Client link copied to clipboard');
                      }}>Copy Client Link</button>
                    )}
                    {canReadMessages && <button type="button" className={styles.mobileMenuItem} onClick={() => { setMobileMenuOpen(false); setShowMessagesModal(true); }}>
                      Messages {quoteMessages.length > 0 ? `(${quoteMessages.length})` : ''}
                    </button>}
                    <button type="button" className={styles.mobileMenuItem} onClick={() => { setMobileMenuOpen(false); quoteExportRef.current?.handleExport(); }}>
                      Export as PNG
                    </button>
                    <button type="button" className={styles.mobileMenuItem} onClick={() => { setMobileMenuOpen(false); quoteExportRef.current?.handlePrint(); }}>
                      Save as PDF
                    </button>
                    {canModifyQuote && <button type="button" className={styles.mobileMenuItem} onClick={() => { setMobileMenuOpen(false); setShowAI(true); }}>
                      ✨ AI Suggest
                    </button>}
                    {canModifyQuote && <button type="button" className={styles.mobileMenuItem} disabled={duplicating} onClick={() => { setMobileMenuOpen(false); handleDuplicateQuote(); }}>
                      {duplicating ? 'Duplicating…' : 'Duplicate'}
                    </button>}
                    {canModifyQuote && <button type="button" className={`${styles.mobileMenuItem} ${styles.mobileMenuItemDanger}`} onClick={() => { setMobileMenuOpen(false); setShowConfirmDelete(true); }}>
                      Delete
                    </button>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {!editing && (
        <QuoteHeader
          quote={quote}
          showTopRow={false}
          onEdit={() => canModifyQuote && setEditing(true)}
          onSend={handleSendClick}
          canModify={canModifyQuote}
          canSeeMessages={canReadMessages}
          onDismissUnsignedChanges={async () => {
            try {
              await api.dismissUnsignedChanges(quote.id);
              load();
              toast.info('Changes acknowledged');
            } catch (e) {
              toast.error(e.message);
            }
          }}
        />
      )}

      {editing && canModifyQuote ? (
        <div className={`card ${styles.editCard}`}>
          <form onSubmit={handleSaveEdit} className={styles.form}>
            <div className={styles.formRow}>
              <div className="form-group" style={{ flex: 2 }}>
                <label htmlFor="qdp-name">Event name *</label>
                <input id="qdp-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="qdp-guests">Guest count</label>
                <input id="qdp-guests" type="number" min="0" value={form.guest_count}
                  onChange={e => setForm(f => ({ ...f, guest_count: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="qdp-event-date">Event date</label>
                <input id="qdp-event-date" type="date" value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="qdp-event-type">Event type</label>
                <select id="qdp-event-type" value={form.event_type || ''} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                  <option value="">— None —</option>
                  {eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
            </div>
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Rental period</h4>
              <div className={styles.formRow}>
                <div className="form-group">
                  <label htmlFor="qdp-delivery">Delivery date</label>
                  <input id="qdp-delivery" type="date" value={form.delivery_date || ''} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label htmlFor="qdp-rental-start">Rental start</label>
                  <input id="qdp-rental-start" type="date" value={form.rental_start || ''} onChange={e => setForm(f => ({ ...f, rental_start: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label htmlFor="qdp-rental-end">Rental end</label>
                  <input id="qdp-rental-end" type="date" value={form.rental_end || ''} onChange={e => setForm(f => ({ ...f, rental_end: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label htmlFor="qdp-pickup">Pickup date</label>
                  <input id="qdp-pickup" type="date" value={form.pickup_date || ''} onChange={e => setForm(f => ({ ...f, pickup_date: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="qdp-notes-ext">External notes <span className={styles.notesTag}>client visible</span></label>
              <textarea id="qdp-notes-ext" rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Shown to the client on the public quote page…" />
            </div>
            <div className="form-group">
              <label htmlFor="qdp-notes-int">Internal notes <span className={styles.notesTag}>team only</span></label>
              <textarea id="qdp-notes-int" rows={2} value={form.quote_notes || ''} onChange={e => setForm(f => ({ ...f, quote_notes: e.target.value }))} placeholder="Not visible to the client…" />
            </div>
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Quote Expiration</h4>
              <div className={styles.formRow}>
                <div className="form-group">
                  <label htmlFor="qdp-expires">Expires at</label>
                  <input id="qdp-expires" type="date" value={form.expires_at || ''} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="qdp-exp-msg">Expiration message (shown to client)</label>
                <textarea id="qdp-exp-msg" rows={2} value={form.expiration_message || ''} onChange={e => setForm(f => ({ ...f, expiration_message: e.target.value }))} placeholder="This quote has expired. Please reach out to renew." />
              </div>
            </div>
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Client information</h4>
              <div className={styles.formRow}>
                <div className="form-group"><label htmlFor="qdp-first">First name</label><input id="qdp-first" value={form.client_first_name || ''} onChange={e => setForm(f => ({ ...f, client_first_name: e.target.value }))} /></div>
                <div className="form-group"><label htmlFor="qdp-last">Last name</label><input id="qdp-last" value={form.client_last_name || ''} onChange={e => setForm(f => ({ ...f, client_last_name: e.target.value }))} /></div>
              </div>
              <div className={styles.formRow}>
                <div className="form-group"><label htmlFor="qdp-client-email">Email</label><input id="qdp-client-email" type="email" value={form.client_email || ''} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} /></div>
                <div className="form-group"><label htmlFor="qdp-client-phone">Phone</label><input id="qdp-client-phone" value={form.client_phone || ''} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label htmlFor="qdp-client-addr">Address</label><input id="qdp-client-addr" value={form.client_address || ''} onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))} /></div>
            </div>
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Venue information</h4>
              <div className={styles.formRow}>
                <div className="form-group"><label htmlFor="qdp-venue-name">Name</label><input id="qdp-venue-name" value={form.venue_name || ''} onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))} /></div>
                <div className="form-group"><label htmlFor="qdp-venue-email">Email</label><input id="qdp-venue-email" type="email" value={form.venue_email || ''} onChange={e => setForm(f => ({ ...f, venue_email: e.target.value }))} /></div>
                <div className="form-group"><label htmlFor="qdp-venue-phone">Phone</label><input id="qdp-venue-phone" value={form.venue_phone || ''} onChange={e => setForm(f => ({ ...f, venue_phone: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label htmlFor="qdp-venue-addr">Address</label><input id="qdp-venue-addr" value={form.venue_address || ''} onChange={e => setForm(f => ({ ...f, venue_address: e.target.value }))} /></div>
              <div className={styles.formRow}>
                <div className="form-group"><label htmlFor="qdp-venue-contact">Contact</label><input id="qdp-venue-contact" value={form.venue_contact || ''} onChange={e => setForm(f => ({ ...f, venue_contact: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label htmlFor="qdp-venue-notes">Venue notes</label><textarea id="qdp-venue-notes" rows={2} value={form.venue_notes || ''} onChange={e => setForm(f => ({ ...f, venue_notes: e.target.value }))} /></div>
            </div>
            <div className="form-group">
              <label htmlFor="qdp-tax-rate">Tax rate (%)</label>
              <input id="qdp-tax-rate" type="number" min="0" step="0.01" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} placeholder="From settings if blank" />
            </div>
            {(paymentPolicies.length > 0 || rentalTermsList.length > 0) && (
              <div className={styles.formSection}>
                <h4 className={styles.formSectionTitle}>Payment &amp; terms</h4>
                {paymentPolicies.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="qdp-pay-policy">Payment policy</label>
                    <select id="qdp-pay-policy" value={form.payment_policy_id || ''} onChange={e => setForm(f => ({ ...f, payment_policy_id: e.target.value }))}>
                      <option value="">— None —</option>
                      {paymentPolicies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
                {rentalTermsList.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="qdp-rental-terms">Rental terms</label>
                    <select id="qdp-rental-terms" value={form.rental_terms_id || ''} onChange={e => setForm(f => ({ ...f, rental_terms_id: e.target.value }))}>
                      <option value="">— None —</option>
                      {rentalTermsList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className={styles.formSection}>
              <h4 className={styles.formSectionTitle}>Contract</h4>
              <p className={styles.notes}>Contract text shown to the client on the public quote page. Client can sign from the public link. Add templates on the Templates page, then choose one below or edit manually.</p>
              {contractTemplates.length > 0 && (
                <div className="form-group">
                  <label htmlFor="qdp-contract-tmpl">Use template</label>
                  <select
                    id="qdp-contract-tmpl"
                    value=""
                    onChange={e => {
                      const tid = e.target.value;
                      if (!tid) return;
                      const t = contractTemplates.find(ct => String(ct.id) === tid);
                      if (t) {
                        if (contractBody) {
                          setPendingContractTemplate(t);
                        } else {
                          applyContractTemplate(t);
                        }
                      }
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
                  <label htmlFor="qdp-contract-body">Contract body (HTML or plain text)</label>
                  <textarea
                    id="qdp-contract-body"
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
          {/* Notes card — inline editable */}
          <div className={styles.notesCard}>
            {notesEditing ? (
              <form onSubmit={handleNotesSave} className={styles.notesForm}>
                <h4 className={styles.venueTitle}>Notes</h4>
                <div className="form-group">
                  <label htmlFor="qdn-external">External notes <span className={styles.notesTag}>client visible</span></label>
                  <textarea id="qdn-external" rows={3} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Shown to the client on the public quote page…" />
                </div>
                <div className="form-group">
                  <label htmlFor="qdn-internal">Internal notes <span className={styles.notesTag}>team only</span></label>
                  <textarea id="qdn-internal" rows={3} value={form.quote_notes || ''} onChange={e => setForm(f => ({ ...f, quote_notes: e.target.value }))} placeholder="Not visible to the client…" />
                </div>
                <div className={styles.formActions}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancelNotesEdit}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </form>
            ) : (
              <div role="button" tabIndex={0} className={styles.venueClickable} onClick={() => setNotesEditing(true)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setNotesEditing(true)}>
                <h4 className={styles.venueTitle}>Notes</h4>
                {(quote.notes || quote.quote_notes) ? (
                  <div className={styles.notesView}>
                    {quote.notes && (
                      <div className={styles.notesViewItem}>
                        <span className={styles.notesTag}>Client visible</span>
                        <p className={styles.notesViewText}>{quote.notes}</p>
                      </div>
                    )}
                    {quote.quote_notes && (
                      <div className={styles.notesViewItem}>
                        <span className={`${styles.notesTag} ${styles.notesTagInternal}`}>Team only</span>
                        <p className={styles.notesViewText}>{quote.quote_notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className={styles.emptyHint}>Click to add notes</p>
                )}
              </div>
            )}
          </div>
          <div className={styles.clientVenueRow}>
            <div className={styles.clientBlock}>
              {clientEditing ? (
                <form onSubmit={handleClientSave} className={styles.venueForm}>
                  <h4 className={styles.venueTitle}>Client information</h4>
                  <div className={styles.formRow}>
                    <div className="form-group"><label htmlFor="qdc-first">First name</label><input id="qdc-first" value={form.client_first_name || ''} onChange={e => setForm(f => ({ ...f, client_first_name: e.target.value }))} /></div>
                    <div className="form-group"><label htmlFor="qdc-last">Last name</label><input id="qdc-last" value={form.client_last_name || ''} onChange={e => setForm(f => ({ ...f, client_last_name: e.target.value }))} /></div>
                  </div>
                  <div className="form-group"><label htmlFor="qdc-email">Email</label><input id="qdc-email" type="email" value={form.client_email || ''} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="qdc-phone">Phone</label><input id="qdc-phone" value={form.client_phone || ''} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="qdc-addr">Address</label><input id="qdc-addr" value={form.client_address || ''} onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))} /></div>
                  <div className={styles.formActions}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancelClientEdit}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              ) : (
                <div role="button" tabIndex={0} className={styles.venueClickable} onClick={() => setClientEditing(true)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setClientEditing(true)}>
                  <h4 className={styles.venueTitle}>Client information</h4>
                  {(quote.client_first_name || quote.client_last_name || quote.client_email || quote.client_phone || quote.client_address) ? (
                    <div className={styles.venueGrid}>
                      {(quote.client_first_name || quote.client_last_name) && <span><strong>Name:</strong> {[quote.client_first_name, quote.client_last_name].filter(Boolean).join(' ')}</span>}
                      {quote.client_email && <span><strong>Email:</strong> {quote.client_email}</span>}
                      {quote.client_phone && <span><strong>Phone:</strong> {quote.client_phone}</span>}
                      {quote.client_address && (
                        <span>
                          <strong>Address:</strong>{' '}
                          <button type="button" className={styles.addressLink} onClick={e => { e.stopPropagation(); api.getSettings().then(s => setAddressModalData({ address: quote.client_address, companyAddress: s.company_address || '', mapboxToken: s.mapbox_access_token || '', defaultMapStyle: s.map_default_style || 'map' })).catch(() => setAddressModalData({ address: quote.client_address, companyAddress: settings.company_address || '', mapboxToken: '', defaultMapStyle: settings.map_default_style || 'map' })); }}>
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
                    <div className="form-group"><label htmlFor="qdv-name">Name</label><input id="qdv-name" value={form.venue_name || ''} onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))} /></div>
                    <div className="form-group"><label htmlFor="qdv-email">Email</label><input id="qdv-email" type="email" value={form.venue_email || ''} onChange={e => setForm(f => ({ ...f, venue_email: e.target.value }))} /></div>
                  </div>
                  <div className="form-group"><label htmlFor="qdv-phone">Phone</label><input id="qdv-phone" value={form.venue_phone || ''} onChange={e => setForm(f => ({ ...f, venue_phone: e.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="qdv-addr">Address</label><input id="qdv-addr" value={form.venue_address || ''} onChange={e => setForm(f => ({ ...f, venue_address: e.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="qdv-contact">Contact</label><input id="qdv-contact" value={form.venue_contact || ''} onChange={e => setForm(f => ({ ...f, venue_contact: e.target.value }))} /></div>
                  <div className="form-group"><label htmlFor="qdv-notes">Notes</label><textarea id="qdv-notes" rows={2} value={form.venue_notes || ''} onChange={e => setForm(f => ({ ...f, venue_notes: e.target.value }))} /></div>
                  <div className={styles.formActions}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancelVenueEdit}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                  </div>
                </form>
              ) : (
                <div role="button" tabIndex={0} className={styles.venueClickable} onClick={() => setVenueEditing(true)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setVenueEditing(true)}>
                  <h4 className={styles.venueTitle}>Venue information</h4>
                  {(quote.venue_name || quote.venue_email || quote.venue_phone || quote.venue_address || quote.venue_contact || quote.venue_notes) ? (
                    <div className={styles.venueGrid}>
                      {quote.venue_name && <span><strong>Name:</strong> {quote.venue_name}</span>}
                      {quote.venue_email && <span><strong>Email:</strong> {quote.venue_email}</span>}
                      {quote.venue_phone && <span><strong>Phone:</strong> {quote.venue_phone}</span>}
                      {quote.venue_address && (
                        <span>
                          <strong>Address:</strong>{' '}
                          <button type="button" className={styles.addressLink} onClick={e => { e.stopPropagation(); api.getSettings().then(s => setAddressModalData({ address: quote.venue_address, companyAddress: s.company_address || '', mapboxToken: s.mapbox_access_token || '', defaultMapStyle: s.map_default_style || 'map' })).catch(() => setAddressModalData({ address: quote.venue_address, companyAddress: settings.company_address || '', mapboxToken: '', defaultMapStyle: settings.map_default_style || 'map' })); }}>
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

      <div className={styles.desktopOnlyBuilder}>
      <div className={styles.columns}>
        <div className={styles.builderCol}>
          <QuoteBuilder
            quoteId={id}
            items={quote.items}
            sections={sections}
            onItemsChange={load}
            onAddCustomItem={() => setShowCustomForm(true)}
            settings={settings}
            availability={availability}
            adjustments={adjustments}
            onAdjustmentsChange={setAdjustments}
            onOpenDrawer={(itemId) => setDrawerItemId(itemId)}
            onOpenLightbox={(images, index) => { setLightboxImages(images); setLightboxIndex(index); }}
          />
          {showCustomForm && (
            <form onSubmit={handleAddCustomItem} className={styles.customItemForm}>
              <div className={styles.formRow}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label htmlFor="ci-name">Item name *</label>
                  <input id="ci-name" required placeholder="Custom item name" value={customForm.title} onChange={e => setCustomForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label htmlFor="ci-price">Price ($)</label>
                  <input id="ci-price" type="number" min="0" step="0.01" placeholder="0.00" value={customForm.unit_price} onChange={e => setCustomForm(f => ({ ...f, unit_price: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label htmlFor="ci-qty">Qty</label>
                  <input id="ci-qty" type="number" min="1" value={customForm.quantity} onChange={e => setCustomForm(f => ({ ...f, quantity: e.target.value }))} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className="form-group">
                  <label htmlFor="ci-photo">Photo URL (optional)</label>
                  <input id="ci-photo" placeholder="https://... or pick from Files" value={customForm.photo_url} onChange={e => setCustomForm(f => ({ ...f, photo_url: e.target.value }))} />
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
              }} classNames={styles} />
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
                    <button type="button" className={styles.logRemoveBtn} onClick={() => handleRemoveCustomItem(ci.id)} aria-label="Remove item">✕</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={styles.logisticsBlock}>
            <div className={styles.logisticsHeader}>
              <h4 className={styles.logisticsTitle}>Logistics / Delivery</h4>
              <button type="button" className={styles.logisticsAddBtn} onClick={() => { setShowLogPicker(v => !v); setLogSearch(''); }}>
                {showLogPicker ? 'Cancel' : '+ Add item'}
              </button>
            </div>
            {logisticsItems.length > 0 && (
              <ul className={styles.logisticsList}>
                {logisticsItems.map(it => (
                  <li key={it.qitem_id} className={styles.logisticsItem}>
                    <span className={styles.logisticsItemName}>{it.label || it.title} ×{it.quantity || 1}</span>
                    {(it.unit_price_override != null ? it.unit_price_override : it.unit_price) > 0 && <span>${((it.unit_price_override != null ? it.unit_price_override : it.unit_price) * (it.quantity || 1)).toFixed(2)}</span>}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      title="Rename"
                      onClick={() =>
                        setRenameLogistics({
                          qitem_id: it.qitem_id,
                          title: it.title,
                          label: it.label || null,
                        })
                      }
                    >
                      Rename
                    </button>
                    <button type="button" className={styles.logRemoveBtn} onClick={() => handleRemoveLogisticsItem(it.qitem_id, it.label || it.title)} aria-label={`Remove ${it.label || it.title}`}>✕</button>
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
                  aria-label="Search logistics items"
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
        </div>
        <div className={styles.exportCol}>
          <div className={`card ${styles.exportCard}`}>
            <h3 className={styles.exportTitle}>Export</h3>
            <QuoteExport ref={quoteExportRef} quote={quote} settings={settings} totals={totals} customItems={customItems} visibleItems={visibleItems} />
          </div>
          <div className={`card ${styles.exportCard}`}>
            <h3 className={styles.exportTitle}>Messages</h3>
            {quoteMessages.length > 0 ? (
              <div className={styles.msgList}>
                {quoteMessages.map(m => (
                  <div key={m.id} className={`${styles.msgBubble} ${m.direction === 'inbound' ? styles.msgIn : styles.msgOut}`}>
                    <div className={styles.msgBubbleBody}>
                      <MessageBody msg={m} />
                    </div>
                    <div className={styles.msgBubbleMeta}>
                      {m.direction === 'inbound' ? (m.from_email || 'Client') : 'You'}
                      {' · '}
                      {m.sent_at ? new Date(m.sent_at.replace(' ', 'T') + 'Z').toLocaleString() : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.msgEmpty}>No messages yet.</p>
            )}
            <form onSubmit={async e => {
              e.preventDefault();
              const links = msgLinks.split(/[\s,]+/).map(s => s.trim()).filter(Boolean).filter(u => /^https?:\/\//i.test(u));
              if (!msgText.trim() && !links.length && !msgAttachments.length && !msgRich) return;
              setMsgSending(true);
              try {
                const d = await api.sendQuoteMessage(id, {
                  body_text: msgText.trim() || undefined,
                  links: links.length ? links : undefined,
                  attachments: msgAttachments.length ? msgAttachments : undefined,
                  message_type: msgRich ? 'rich' : 'text',
                  rich_payload: msgRich ? {
                    kind: 'product_card',
                    title: 'Quote highlight',
                    subtitle: quote?.name || '',
                    quoteId: Number(id),
                    ctaLabel: 'Add to Quote',
                  } : undefined,
                });
                setMsgText('');
                setMsgLinks('');
                setMsgAttachments([]);
                setMsgRich(false);
                setQuoteMessages((d.messages || []).slice().reverse());
              } catch (err) {
                toast.error('Failed to send message');
              } finally {
                setMsgSending(false);
              }
            }} className={styles.msgForm}>
              <div className={styles.msgFormRow}>
                <input type="file" ref={msgFileInputRef} className={styles.msgFileInput} multiple accept="image/*,application/pdf" onChange={handleQuoteMsgAttach} aria-hidden="true" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => msgFileInputRef.current?.click()}>Attach</button>
                <label className={styles.msgRichLabel}>
                  <input type="checkbox" checked={msgRich} onChange={ev => setMsgRich(ev.target.checked)} />
                  Rich
                </label>
              </div>
              {msgAttachments.length > 0 && (
                <div className={styles.msgPending}>
                  {msgAttachments.map((a, i) => (
                    <span key={`${a.file_id}-${i}`} className={styles.msgPendingChip}>
                      {a.name || `File ${a.file_id}`}
                      <button type="button" className={styles.msgPendingX} onClick={() => setMsgAttachments(prev => prev.filter((_, j) => j !== i))} aria-label="Remove"><span aria-hidden="true">×</span></button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className={styles.msgLinkInput}
                type="text"
                placeholder="https://…"
                aria-label="Link URLs"
                value={msgLinks}
                onChange={e => setMsgLinks(e.target.value)}
              />
              <textarea
                className={styles.msgTextarea}
                rows={2}
                placeholder="Add a message or note…"
                aria-label="Message or note"
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
              />
              <button type="submit" className={styles.msgSendBtn} disabled={msgSending}>
                {msgSending ? 'Sending…' : 'Send'}
              </button>
            </form>
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
                {payments.length > 0 && (() => {
                  const paid = payments.reduce((s, p) => s + (p.amount || 0), 0);
                  const remaining = totals.total - paid;
                  const overpaid = remaining < 0;
                  return (
                    <>
                      <div className={styles.totalsRow}>
                        <span className={styles.totalsLabel}>Paid</span>
                        <span className={`${styles.totalsValue} ${styles.totalsValuePaid}`}>${paid.toFixed(2)}</span>
                      </div>
                      <div className={`${styles.totalsRow} ${styles.totalsRowBalance}`}>
                        <span className={styles.totalsLabel}>{overpaid ? 'Overpaid' : 'Remaining'}</span>
                        <span className={overpaid ? styles.totalsValueOverpaid : styles.totalsValueRemaining}>
                          ${Math.abs(remaining).toFixed(2)}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>{/* end desktopOnlyBuilder */}

          </>)}
          {detailTab === 'items' && (
            <>
              <div className={styles.mobileItemsTotals}>
                <div>
                  <div className={styles.mobileTotalsLabel}>Grand total</div>
                  <div className={styles.mobileTotalsAmount}>${totals.total.toFixed(2)}</div>
                </div>
                {canModifyQuote && <button type="button" className="btn btn-primary btn-sm" onClick={handleSendClick}>
                  Send to Client
                </button>}
              </div>
              {canModifyQuote ? <QuoteBuilder
                quoteId={id}
                items={quote.items}
                sections={sections}
                onItemsChange={load}
                onAddCustomItem={() => setShowCustomForm(true)}
                settings={settings}
                availability={availability}
                adjustments={adjustments}
                onAdjustmentsChange={setAdjustments}
                onOpenDrawer={(itemId) => setDrawerItemId(itemId)}
                onOpenLightbox={(images, index) => { setLightboxImages(images); setLightboxIndex(index); }}
              /> : (
                <QuoteExport
                  ref={quoteExportRef}
                  quote={{ ...quote, sections }}
                  settings={settings}
                  totals={totals}
                  customItems={customItems}
                />
              )}
              {canModifyQuote && showCustomForm && (
                <form onSubmit={handleAddCustomItem} className={styles.customItemForm}>
                  <div className={styles.formRow}>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label htmlFor="mci-name">Item name *</label>
                      <input id="mci-name" required placeholder="Custom item name" value={customForm.title} onChange={e => setCustomForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="mci-price">Price ($)</label>
                      <input id="mci-price" type="number" min="0" step="0.01" placeholder="0.00" value={customForm.unit_price} onChange={e => setCustomForm(f => ({ ...f, unit_price: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="mci-qty">Qty</label>
                      <input id="mci-qty" type="number" min="1" value={customForm.quantity} onChange={e => setCustomForm(f => ({ ...f, quantity: e.target.value }))} />
                    </div>
                  </div>
                  <div className={styles.formActions}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCustomForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm">Add item</button>
                  </div>
                </form>
              )}
              {canModifyQuote && customItems.length > 0 && (
                <div className={styles.customItemsCompact}>
                  <h4 className={styles.customItemsCompactTitle}>Custom items</h4>
                  <ul className={styles.customItemsCompactList}>
                    {customItems.map(ci => (
                      <li key={ci.id} className={styles.customItemCompact}>
                        <span>{ci.title} ×{ci.quantity || 1}</span>
                        <span>${((ci.unit_price || 0) * (ci.quantity || 1)).toFixed(2)}</span>
                        <button type="button" className={styles.logRemoveBtn} onClick={() => handleRemoveCustomItem(ci.id)} aria-label="Remove item">✕</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {canModifyQuote && <div className={styles.logisticsBlock}>
                <div className={styles.logisticsHeader}>
                  <h4 className={styles.logisticsTitle}>Logistics / Delivery</h4>
                  <button type="button" className={styles.logisticsAddBtn} onClick={() => { setShowLogPicker(v => !v); setLogSearch(''); }}>
                    {showLogPicker ? 'Cancel' : '+ Add item'}
                  </button>
                </div>
                {logisticsItems.length > 0 && (
                  <ul className={styles.logisticsList}>
                    {logisticsItems.map(it => (
                      <li key={it.qitem_id} className={styles.logisticsItem}>
                        <span className={styles.logisticsItemName}>{it.label || it.title} ×{it.quantity || 1}</span>
                        {(it.unit_price_override != null ? it.unit_price_override : it.unit_price) > 0 && <span>${((it.unit_price_override != null ? it.unit_price_override : it.unit_price) * (it.quantity || 1)).toFixed(2)}</span>}
                        <button type="button" className={styles.logRemoveBtn} onClick={() => handleRemoveLogisticsItem(it.qitem_id, it.label || it.title)} aria-label={`Remove ${it.label || it.title}`}>✕</button>
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
                      aria-label="Search logistics items"
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
              </div>}
            </>
          )}
          {detailTab === 'fulfillment' && canSeeFulfillment && (
            <Suspense fallback={<DeferredPanelFallback label="Loading fulfillment…" />}>
              <QuoteFulfillmentPanel
                fulfillment={fulfillment}
                canModify={canModifyFulfillment}
                onCheckIn={async (fulfillmentItemId, body) => {
                  const data = await api.checkInFulfillmentItem(id, fulfillmentItemId, body);
                  setFulfillment(data);
                  toast.success('Items checked in');
                }}
                onAddNote={async (body) => {
                  const data = await api.addFulfillmentNote(id, body);
                  setFulfillment(data);
                  toast.success('Fulfillment note added');
                }}
              />
            </Suspense>
          )}
          {detailTab === 'billing' && canReadBilling && (
            <Suspense fallback={<DeferredPanelFallback label="Loading billing…" />}>
              <QuoteBillingPanel
                payments={payments}
                quote={quote}
                totals={totals}
                contract={contract}
                damageCharges={damageCharges}
                showDamageForm={showDamageForm}
                setShowDamageForm={setShowDamageForm}
                damageForm={damageForm}
                setDamageForm={setDamageForm}
                damageSaving={damageSaving}
                onOpenPaymentModal={() => {
                  const now = new Date();
                  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                  setPaymentForm(f => ({ ...f, paid_at: local }));
                  setShowPaymentModal(true);
                }}
                onDeletePayment={setPendingPaymentDelete}
                onAddDamageCharge={handleAddDamageCharge}
                onRemoveDamageCharge={handleRemoveDamageCharge}
              />
            </Suspense>
          )}
          {detailTab === 'files' && canReadFiles && (
            <Suspense fallback={<DeferredPanelFallback label="Loading files…" />}>
              <QuoteFilesPanel
                quoteFiles={quoteFiles}
                onDetach={handleDetachFile}
                onOpenPicker={() => setShowFilePicker(true)}
                canModify={canModifyQuote}
              />
            </Suspense>
          )}
          {detailTab === 'logs' && (
            <Suspense fallback={<DeferredPanelFallback label="Loading logs…" />}>
              <QuoteLogsPanel activity={activity} />
            </Suspense>
          )}
        </>

      )}

      {showMessagesModal && canReadMessages && (
        <div className={styles.messagesModalOverlay} onClick={() => setShowMessagesModal(false)}>
          <div className={styles.messagesModalPanel} onClick={e => e.stopPropagation()}>
            <div className={styles.messagesModalHeader}>
              <h3 className={styles.messagesModalTitle}>Messages</h3>
              <button type="button" className={styles.messagesModalClose} onClick={() => setShowMessagesModal(false)} aria-label="Close">✕</button>
            </div>
            <div className={styles.messagesModalBody}>
              {quoteMessages.length > 0 ? (
                <div className={styles.msgList}>
                  {quoteMessages.map(m => (
                    <div key={m.id} className={`${styles.msgBubble} ${m.direction === 'inbound' ? styles.msgIn : styles.msgOut}`}>
                      <div className={styles.msgBubbleBody}><MessageBody msg={m} /></div>
                      <div className={styles.msgBubbleMeta}>
                        {m.direction === 'inbound' ? (m.from_email || 'Client') : 'You'}
                        {' · '}
                        {m.sent_at ? new Date(m.sent_at.replace(' ', 'T') + 'Z').toLocaleString() : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.msgEmpty}>No messages yet.</p>
              )}
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              const links = msgLinks.split(/[\s,]+/).map(s => s.trim()).filter(Boolean).filter(u => /^https?:\/\//i.test(u));
              if (!msgText.trim() && !links.length && !msgAttachments.length) return;
              setMsgSending(true);
              try {
                const d = await api.sendQuoteMessage(id, {
                  body_text: msgText.trim() || undefined,
                  links: links.length ? links : undefined,
                  attachments: msgAttachments.length ? msgAttachments : undefined,
                });
                setMsgText(''); setMsgLinks(''); setMsgAttachments([]);
                setQuoteMessages((d.messages || []).slice().reverse());
              } catch (err) {
                toast.error('Failed to send message');
              } finally {
                setMsgSending(false);
              }
            }} className={styles.messagesModalForm}>
              <textarea
                className={styles.msgTextarea}
                rows={2}
                placeholder="Add a message or note…"
                aria-label="Message or note"
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
              />
              <button type="submit" className={`btn btn-primary btn-sm ${styles.messagesModalSend}`} disabled={msgSending}>
                {msgSending ? 'Sending…' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showAI && (
        <Suspense fallback={<DeferredPanelFallback label="Loading AI tools…" />}>
          <AISuggestModal
            quoteId={id}
            guestCount={quote.guest_count || 0}
            currentItems={quote.items || []}
            onAdd={handleAIAdd}
            onClose={() => setShowAI(false)}
          />
        </Suspense>
      )}

      {showSendModal && (
        <Suspense fallback={<DeferredPanelFallback label="Loading send dialog…" />}>
          <QuoteSendModal
            quote={quote}
            onClose={() => setShowSendModal(false)}
            onSent={() => { setShowSendModal(false); load(); toast.success('Quote sent; client link ready.'); }}
            onError={e => toast.error(e.message)}
            classNames={styles}
          />
        </Suspense>
      )}

      {renameLogistics && (
        <Suspense fallback={<DeferredPanelFallback label="Loading rename dialog…" />}>
          <RenameLogisticsModal
            open
            inventoryTitle={renameLogistics.title}
            currentLabel={renameLogistics.label}
            onClose={() => setRenameLogistics(null)}
            onSave={handleSaveLogisticsRename}
          />
        </Suspense>
      )}

      {showPaymentModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPaymentModal(false)} onKeyDown={e => e.key === 'Escape' && setShowPaymentModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pay-modal-title">
            <h3 id="pay-modal-title" className={styles.modalTitle}>Record offline payment</h3>
            <form onSubmit={handleRecordPayment} className={styles.form}>
              <div className="form-group">
                <label htmlFor="pay-amount">Amount ($) *</label>
                <input id="pay-amount" type="number" step="0.01" min="0" required value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="pay-method">Method</label>
                <select id="pay-method" value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}>
                  <option>Offline - Check</option>
                  <option>Cash</option>
                  <option>ACH</option>
                  <option>Card</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="pay-ref">Reference (e.g. check #)</label>
                <input id="pay-ref" value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label htmlFor="pay-date">Date</label>
                <input id="pay-date" type="datetime-local" value={paymentForm.paid_at} onChange={e => setPaymentForm(f => ({ ...f, paid_at: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="pay-note">Note</label>
                <input id="pay-note" value={paymentForm.note} onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))} placeholder="Optional" />
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
        <Suspense fallback={<DeferredPanelFallback label="Loading files…" />}>
          <QuoteFilePicker
            currentFileIds={quoteFiles.map(f => f.file_id)}
            onSelect={handleAttachFile}
            onClose={() => setShowFilePicker(false)}
            classNames={styles}
          />
        </Suspense>
      )}

      {showCancelConfirm && (
        <ConfirmDialog
          message="You have unsaved changes. Discard them?"
          confirmLabel="Discard"
          confirmClass="btn-danger"
          onConfirm={confirmCancelEdit}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {blocker.state === 'blocked' && (
        <ConfirmDialog
          message="You have unsaved changes that will be lost. Leave this page?"
          confirmLabel="Leave"
          confirmClass="btn-danger"
          onConfirm={discardAndProceedNavigation}
          onCancel={() => blocker.reset()}
        />
      )}

      {showConfirmDelete && (
        <ConfirmDialog
          message={`Delete quote "${quote?.name || 'this quote'}"? This cannot be undone.`}
          onConfirm={handleDeleteQuote}
          onCancel={() => setShowConfirmDelete(false)}
        />
      )}

      {pendingPaymentDelete && (
        <ConfirmDialog
          title="Remove payment"
          message={`Remove the ${Number(pendingPaymentDelete.amount || 0).toFixed(2)} payment record${pendingPaymentDelete.method ? ` (${pendingPaymentDelete.method})` : ''}? This only deletes the payment entry.`}
          confirmLabel="Remove payment"
          confirmClass="btn-danger"
          onConfirm={() => handleDeletePayment(pendingPaymentDelete.id)}
          onCancel={() => setPendingPaymentDelete(null)}
        />
      )}

      {pendingContractTemplate && (
        <ConfirmDialog
          title="Replace contract draft"
          message={`Replace the current contract draft with "${pendingContractTemplate.name}"? Unsaved contract edits will be lost.`}
          confirmLabel="Replace contract"
          confirmClass="btn-danger"
          onConfirm={() => applyContractTemplate(pendingContractTemplate)}
          onCancel={() => setPendingContractTemplate(null)}
        />
      )}

      {pendingTransition && (
        <ConfirmDialog
          message={pendingTransition.message}
          confirmLabel={pendingTransition.label}
          confirmClass={pendingTransition.confirmClass}
          onConfirm={() => { const t = pendingTransition; setPendingTransition(null); t.action(); }}
          onCancel={() => setPendingTransition(null)}
        />
      )}

      {addressModalData != null && (
        <Suspense fallback={<DeferredPanelFallback label="Loading map…" />}>
          <AddressMapModal
            address={addressModalData.address}
            companyAddress={addressModalData.companyAddress}
            mapboxToken={addressModalData.mapboxToken}
            defaultMapStyle={addressModalData.defaultMapStyle || 'map'}
            onClose={() => setAddressModalData(null)}
          />
        </Suspense>
      )}

      {drawerItemId != null && (
        <Suspense fallback={<DeferredPanelFallback label="Loading item details…" />}>
          <ItemDetailDrawer
            itemId={drawerItemId}
            onClose={() => setDrawerItemId(null)}
            onItemUpdated={() => load()}
          />
        </Suspense>
      )}

      {lightboxImages.length > 0 && (
        <Suspense fallback={<DeferredPanelFallback label="Loading gallery…" />}>
          <ImageLightbox
            images={lightboxImages}
            index={lightboxIndex}
            onClose={() => setLightboxImages([])}
            onNavigate={setLightboxIndex}
          />
        </Suspense>
      )}

    </div>
  );
}

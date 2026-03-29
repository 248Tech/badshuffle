import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import styles from './TemplatesPage.module.css';

export default function TemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', subject: '', body_text: '', is_default: false });
  const [contractTemplates, setContractTemplates] = useState([]);
  const [contractForm, setContractForm] = useState({ name: '', body_html: '' });
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState(null); // null | id
  const [contractSaving, setContractSaving] = useState(false);
  // Payment policies
  const [policies, setPolicies] = useState([]);
  const [editingPolicy, setEditingPolicy] = useState(null); // null | 'new' | id
  const [policyForm, setPolicyForm] = useState({ name: '', body_text: '', is_default: false });
  // Rental terms
  const [rentalTerms, setRentalTerms] = useState([]);
  const [editingTerms, setEditingTerms] = useState(null);
  const [termsForm, setTermsForm] = useState({ name: '', body_text: '', is_default: false });

  const load = () => {
    setLoading(true);
    api.getTemplates()
      .then(d => setTemplates(d.templates || []))
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  const loadContractTemplates = () => {
    api.getContractTemplates()
      .then(d => setContractTemplates(d.contractTemplates || []))
      .catch(e => toast.error(e.message));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadContractTemplates(); }, []);
  useEffect(() => {
    api.getPaymentPolicies().then(d => setPolicies(d.policies || [])).catch(() => {});
    api.getRentalTerms().then(d => setRentalTerms(d.terms || [])).catch(() => {});
  }, []);

  const openNew = () => {
    setEditing('new');
    setForm({ name: '', subject: '', body_text: '', is_default: false });
  };

  const openEdit = (t) => {
    setEditing(t.id);
    setForm({ name: t.name, subject: t.subject || '', body_text: t.body_text || t.body_html || '', is_default: !!t.is_default });
  };

  const closeEdit = () => { setEditing(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing === 'new') {
        await api.createTemplate({ name: form.name, subject: form.subject, body_text: form.body_text, is_default: form.is_default });
        toast.success('Template created');
      } else {
        await api.updateTemplate(editing, { name: form.name, subject: form.subject, body_text: form.body_text, is_default: form.is_default });
        toast.success('Template updated');
      }
      closeEdit();
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const setDefault = async (id) => {
    try {
      await api.updateTemplate(id, { is_default: true });
      toast.success('Default template set');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.deleteTemplate(id);
      toast.info('Template deleted');
      if (editing === id) closeEdit();
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleContractUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setContractForm(f => ({ ...f, body_html: r.result || '' }));
    r.readAsText(file);
    e.target.value = '';
  };

  const handleSaveContractTemplate = async (e) => {
    e.preventDefault();
    setContractSaving(true);
    try {
      if (editingContract) {
        await api.updateContractTemplate(editingContract, { name: contractForm.name, body_html: contractForm.body_html || null });
        toast.success('Contract template updated');
        setEditingContract(null);
      } else {
        await api.createContractTemplate({ name: contractForm.name, body_html: contractForm.body_html || null });
        toast.success('Contract template added');
      }
      setContractForm({ name: '', body_html: '' });
      setShowContractForm(false);
      loadContractTemplates();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setContractSaving(false);
    }
  };

  const handleDeleteContractTemplate = async (id) => {
    if (!confirm('Delete this contract template?')) return;
    try {
      await api.deleteContractTemplate(id);
      toast.info('Contract template deleted');
      loadContractTemplates();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    try {
      if (editingPolicy === 'new') {
        await api.createPaymentPolicy({ name: policyForm.name, body_text: policyForm.body_text, is_default: policyForm.is_default });
        toast.success('Payment policy created');
      } else {
        await api.updatePaymentPolicy(editingPolicy, { name: policyForm.name, body_text: policyForm.body_text, is_default: policyForm.is_default });
        toast.success('Payment policy updated');
      }
      setEditingPolicy(null);
      api.getPaymentPolicies().then(d => setPolicies(d.policies || [])).catch(() => {});
    } catch (e) { toast.error(e.message); }
  };

  const handleDeletePolicy = async (id) => {
    if (!confirm('Delete this payment policy?')) return;
    try {
      await api.deletePaymentPolicy(id);
      toast.info('Deleted');
      if (editingPolicy === id) setEditingPolicy(null);
      api.getPaymentPolicies().then(d => setPolicies(d.policies || [])).catch(() => {});
    } catch (e) { toast.error(e.message); }
  };

  const handleSaveTerms = async (e) => {
    e.preventDefault();
    try {
      if (editingTerms === 'new') {
        await api.createRentalTerms({ name: termsForm.name, body_text: termsForm.body_text, is_default: termsForm.is_default });
        toast.success('Rental terms created');
      } else {
        await api.updateRentalTerms(editingTerms, { name: termsForm.name, body_text: termsForm.body_text, is_default: termsForm.is_default });
        toast.success('Rental terms updated');
      }
      setEditingTerms(null);
      api.getRentalTerms().then(d => setRentalTerms(d.terms || [])).catch(() => {});
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteTerms = async (id) => {
    if (!confirm('Delete these rental terms?')) return;
    try {
      await api.deleteRentalTerms(id);
      toast.info('Deleted');
      if (editingTerms === id) setEditingTerms(null);
      api.getRentalTerms().then(d => setRentalTerms(d.terms || [])).catch(() => {});
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return (
    <div className={styles.page} aria-busy="true" aria-label="Loading templates">
      <div aria-hidden="true">
        <div className="skeleton" style={{ height: 22, width: 140, borderRadius: 5, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 13, width: 280, borderRadius: 4 }} />
      </div>
      {Array.from({ length: 2 }).map((_, s) => (
        <div key={s} className={`card ${styles.card}`} aria-hidden="true">
          <div className={styles.cardHeader}>
            <div>
              <div className="skeleton" style={{ height: 16, width: 160, borderRadius: 5, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 13, width: 220, borderRadius: 4 }} />
            </div>
            <div className="skeleton" style={{ height: 30, width: 100, borderRadius: 6, flexShrink: 0 }} />
          </div>
          <div className={styles.list}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.row}>
                <div className="skeleton" style={{ height: 14, borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 14, borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 28, width: 56, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Templates</h1>
      <p className={styles.pageSub}>Email templates for sending quotes and contract templates for quote settings.</p>

      <section className={`card ${styles.card}`}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Email templates</h2>
            <p className={styles.sub}>Templates for sending quotes to clients. Choose a default to pre-fill the send modal.</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>+ New template</button>
        </div>
        {templates.length === 0 && !editing && (
          <p className={styles.empty}>No templates yet. Create one to use when sending quotes.</p>
        )}
        <ul className={styles.list}>
          {templates.map(t => (
            <li key={t.id} className={styles.row}>
              <span className={styles.rowName}>{t.name}</span>
              <span className={styles.rowDetail}>
                <span className={styles.rowDetailText}>{t.subject || '(no subject)'}</span>
                {t.is_default && <span className={styles.badge}>Default</span>}
              </span>
              <div className={styles.rowActions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Edit</button>
                {!t.is_default && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDefault(t.id)}>Set default</button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(t.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>

        {editing && (
          <form onSubmit={handleSave} className={styles.form}>
            <h3 className={styles.formTitle}>{editing === 'new' ? 'New template' : 'Edit template'}</h3>
            <div className="form-group">
              <label htmlFor="tmpl-name">Name *</label>
              <input id="tmpl-name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Quote cover email" />
            </div>
            <div className="form-group">
              <label htmlFor="tmpl-subject">Subject</label>
              <input id="tmpl-subject" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Quote from..." />
            </div>
            <div className="form-group">
              <label htmlFor="tmpl-body">Body</label>
              <textarea id="tmpl-body" rows={6} value={form.body_text} onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))} placeholder="Email body (plain text)..." />
            </div>
            <div className={styles.checkRow}>
              <label>
                <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
                Default template (pre-fill when sending quote)
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost" onClick={closeEdit}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        )}
      </section>

      <section className={`card ${styles.card}`}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Contract templates</h2>
            <p className={styles.sub}>Upload or create contract templates. When editing a quote (click the quote title), you can apply a template to that quote&apos;s contract.</p>
          </div>
          {!showContractForm && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditingContract(null); setContractForm({ name: '', body_html: '' }); setShowContractForm(true); }}>+ Add contract template</button>
          )}
        </div>
        {contractTemplates.length === 0 && !showContractForm && (
          <p className={styles.empty}>No contract templates yet.</p>
        )}
        <ul className={styles.list}>
          {contractTemplates.map(ct => (
            <li key={ct.id} className={styles.row}>
              <span className={styles.rowName}>{ct.name}</span>
              <span className={styles.rowDetail}>
                <span className={styles.rowDetailText}>{(ct.body_html || '').slice(0, 60)}{(ct.body_html || '').length > 60 ? '…' : ''}</span>
              </span>
              <div className={styles.rowActions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingContract(ct.id); setContractForm({ name: ct.name, body_html: ct.body_html || '' }); setShowContractForm(true); }}>Edit</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteContractTemplate(ct.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        {showContractForm ? (
          <form onSubmit={handleSaveContractTemplate} className={styles.form}>
            <h3 className={styles.formTitle}>{editingContract ? 'Edit contract template' : 'Add contract template'}</h3>
            <div className="form-group">
              <label htmlFor="ct-name">Name *</label>
              <input id="ct-name" required value={contractForm.name} onChange={e => setContractForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard event contract" />
            </div>
            <div className="form-group">
              <label htmlFor="ct-body">Contract body (HTML or plain text)</label>
              <textarea id="ct-body" rows={8} value={contractForm.body_html} onChange={e => setContractForm(f => ({ ...f, body_html: e.target.value }))} placeholder="Paste or type contract text. Simple HTML allowed." />
            </div>
            <div className={styles.formRow}>
              <label className={styles.fileLabel}>
                Upload file (.html or .txt)
                <input type="file" accept=".html,.htm,.txt,text/html,text/plain" onChange={handleContractUpload} className={styles.fileInput} aria-hidden="true" />
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowContractForm(false); setEditingContract(null); setContractForm({ name: '', body_html: '' }); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={contractSaving}>{contractSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        ) : null}
      </section>
      <section className={`card ${styles.card}`}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Payment policies</h2>
            <p className={styles.sub}>Preset payment schedules shown to clients at the end of the public quote page.</p>
          </div>
          {editingPolicy === null && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditingPolicy('new'); setPolicyForm({ name: '', body_text: '', is_default: false }); }}>+ New policy</button>
          )}
        </div>
        {policies.length === 0 && editingPolicy === null && (
          <p className={styles.empty}>No payment policies yet.</p>
        )}
        <ul className={styles.list}>
          {policies.map(p => (
            <li key={p.id} className={styles.row}>
              <span className={styles.rowName}>{p.name}</span>
              <span className={styles.rowDetail}>
                {p.is_default && <span className={styles.badge}>Default</span>}
              </span>
              <div className={styles.rowActions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingPolicy(p.id); setPolicyForm({ name: p.name, body_text: p.body_text || '', is_default: !!p.is_default }); }}>Edit</button>
                {!p.is_default && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => api.updatePaymentPolicy(p.id, { is_default: true }).then(() => api.getPaymentPolicies().then(d => setPolicies(d.policies || [])))}>Set default</button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeletePolicy(p.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        {editingPolicy !== null && (
          <form onSubmit={handleSavePolicy} className={styles.form}>
            <h3 className={styles.formTitle}>{editingPolicy === 'new' ? 'New payment policy' : 'Edit payment policy'}</h3>
            <div className="form-group">
              <label htmlFor="pol-name">Name *</label>
              <input id="pol-name" required value={policyForm.name} onChange={e => setPolicyForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard payment schedule" />
            </div>
            <div className="form-group">
              <label htmlFor="pol-body">Body text (shown on public quote)</label>
              <textarea id="pol-body" rows={5} value={policyForm.body_text} onChange={e => setPolicyForm(f => ({ ...f, body_text: e.target.value }))} placeholder="e.g. 50% due at booking, 50% due 7 days before event." />
            </div>
            <div className={styles.checkRow}>
              <label>
                <input type="checkbox" checked={policyForm.is_default} onChange={e => setPolicyForm(f => ({ ...f, is_default: e.target.checked }))} />
                Default policy (pre-select on new quotes)
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingPolicy(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        )}
      </section>

      <section className={`card ${styles.card}`}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Rental terms</h2>
            <p className={styles.sub}>Terms &amp; conditions shown to clients at the end of the public quote page.</p>
          </div>
          {editingTerms === null && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditingTerms('new'); setTermsForm({ name: '', body_text: '', is_default: false }); }}>+ New terms</button>
          )}
        </div>
        {rentalTerms.length === 0 && editingTerms === null && (
          <p className={styles.empty}>No rental terms yet.</p>
        )}
        <ul className={styles.list}>
          {rentalTerms.map(t => (
            <li key={t.id} className={styles.row}>
              <span className={styles.rowName}>{t.name}</span>
              <span className={styles.rowDetail}>
                {t.is_default && <span className={styles.badge}>Default</span>}
              </span>
              <div className={styles.rowActions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingTerms(t.id); setTermsForm({ name: t.name, body_text: t.body_text || '', is_default: !!t.is_default }); }}>Edit</button>
                {!t.is_default && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => api.updateRentalTerms(t.id, { is_default: true }).then(() => api.getRentalTerms().then(d => setRentalTerms(d.terms || [])))}>Set default</button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteTerms(t.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        {editingTerms !== null && (
          <form onSubmit={handleSaveTerms} className={styles.form}>
            <h3 className={styles.formTitle}>{editingTerms === 'new' ? 'New rental terms' : 'Edit rental terms'}</h3>
            <div className="form-group">
              <label htmlFor="rt-name">Name *</label>
              <input id="rt-name" required value={termsForm.name} onChange={e => setTermsForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard rental agreement" />
            </div>
            <div className="form-group">
              <label htmlFor="rt-body">Body text (shown on public quote)</label>
              <textarea id="rt-body" rows={8} value={termsForm.body_text} onChange={e => setTermsForm(f => ({ ...f, body_text: e.target.value }))} placeholder="Enter your rental terms and conditions…" />
            </div>
            <div className={styles.checkRow}>
              <label>
                <input type="checkbox" checked={termsForm.is_default} onChange={e => setTermsForm(f => ({ ...f, is_default: e.target.checked }))} />
                Default terms (pre-select on new quotes)
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingTerms(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

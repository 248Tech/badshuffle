import React from 'react';
import styles from '../QuoteDetailPage.module.css';

export default function QuoteBillingPanel({
  payments,
  quote,
  totals,
  contract,
  damageCharges,
  showDamageForm,
  setShowDamageForm,
  damageForm,
  setDamageForm,
  damageSaving,
  onOpenPaymentModal,
  onDeletePayment,
  onAddDamageCharge,
  onRemoveDamageCharge,
}) {
  const applied = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const signedMode = quote.has_unsigned_changes && quote.signed_quote_total != null;
  const totalForBalance = signedMode ? quote.signed_quote_total : (totals.total || 0);
  const balance = totalForBalance - applied;
  const overpaid = balance < 0;
  const showBalance = quote.has_unsigned_changes || quote.status === 'approved' || quote.status === 'confirmed' || quote.status === 'closed';

  return (
    <div className={`card ${styles.editCard}`}>
      <h3 className={styles.formSectionTitle}>Billing</h3>
      <div className={styles.billingSummary}>
        <div className={styles.billingBlock}>
          <h4 className={styles.venueTitle}>{signedMode ? 'Signed total' : 'Project total'}</h4>
          <div className={styles.billingTotal}>${Number(totalForBalance || 0).toFixed(2)}</div>
        </div>
        <div className={styles.billingBlock}>
          <h4 className={styles.venueTitle}>Applied</h4>
          <div className={styles.billingApplied}>${applied.toFixed(2)}</div>
        </div>
        {showBalance && (
          <>
            <div className={styles.billingBlock}>
              <h4 className={styles.venueTitle}>Balance</h4>
              <div className={styles.billingBalance}>${(overpaid ? 0 : balance).toFixed(2)}</div>
            </div>
            {overpaid && (
              <div className={styles.billingBlockOverpaid}>
                <h4 className={styles.venueTitle}>Overpaid</h4>
                <div className={styles.billingOverpaid}>${Math.abs(balance).toFixed(2)}</div>
              </div>
            )}
          </>
        )}
      </div>
      <div className={styles.formActions} style={{ marginBottom: 16 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenPaymentModal}>
          Record offline payment
        </button>
      </div>
      {payments.length > 0 ? (
        <div className={styles.logTableWrap}><table className={styles.logTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Note</th>
              <th></th>
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
                <td><button type="button" className={styles.rowDeleteBtn} onClick={() => onDeletePayment(p)} aria-label="Remove payment">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : (
        <p className={styles.emptyHint}>No payments recorded yet.</p>
      )}
      {contract && contract.signed_at && (
        <div className={styles.contractSignedBlock}>
          <span className={styles.contractSignedLabel}><span aria-hidden="true">✓</span> Contract signed</span>
          <span className={styles.contractSignedMeta}>
            {new Date(contract.signed_at).toLocaleString()}
            {contract.signer_name && ` · ${contract.signer_name}`}
          </span>
        </div>
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
            <form onSubmit={onAddDamageCharge} className={styles.damageForm}>
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
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemoveDamageCharge(c.id)}>
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
  );
}

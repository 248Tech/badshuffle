import React, { useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../Toast.jsx';
import styles from '../QuoteBuilder.module.css';

export default function QuoteAdjustmentsPanel({ quoteId, adjustments = [], onAdjustmentsChange }) {
  const toast = useToast();
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjForm, setAdjForm] = useState({ label: '', type: 'discount', value_type: 'percent', amount: '' });
  const [adjSaving, setAdjSaving] = useState(false);

  const handleAddAdjustment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(adjForm.amount);
    if (!adjForm.label || isNaN(amt) || amt < 0) return;
    setAdjSaving(true);
    try {
      const d = await api.addAdjustment(quoteId, {
        label: adjForm.label,
        type: adjForm.type,
        value_type: adjForm.value_type,
        amount: amt,
        sort_order: adjustments.length,
      });
      if (onAdjustmentsChange) onAdjustmentsChange(d.adjustments || []);
      setAdjForm({ label: '', type: 'discount', value_type: 'percent', amount: '' });
      setShowAdjForm(false);
      toast.success('Adjustment added');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdjSaving(false);
    }
  };

  const handleRemoveAdjustment = async (adjId) => {
    try {
      const d = await api.removeAdjustment(quoteId, adjId);
      if (onAdjustmentsChange) onAdjustmentsChange(d.adjustments || []);
      toast.info('Adjustment removed');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.adjHeader}>
        <h3 className={styles.sectionTitle}>Discounts &amp; Surcharges</h3>
        <button type="button" className={styles.adjAddBtn} onClick={() => setShowAdjForm((v) => !v)}>
          {showAdjForm ? 'Cancel' : '+ Add'}
        </button>
      </div>
      {showAdjForm && (
        <form onSubmit={handleAddAdjustment} className={styles.adjForm}>
          <input
            required
            placeholder="Label (e.g. Loyalty discount)"
            value={adjForm.label}
            onChange={(e) => setAdjForm((f) => ({ ...f, label: e.target.value }))}
            className={styles.adjLabelInput}
          />
          <select
            value={adjForm.type}
            onChange={(e) => setAdjForm((f) => ({ ...f, type: e.target.value }))}
            className={styles.adjSelect}
          >
            <option value="discount">Discount</option>
            <option value="surcharge">Surcharge</option>
          </select>
          <select
            value={adjForm.value_type}
            onChange={(e) => setAdjForm((f) => ({ ...f, value_type: e.target.value }))}
            className={styles.adjSelect}
          >
            <option value="percent">%</option>
            <option value="fixed">$</option>
          </select>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            max={adjForm.value_type === 'percent' ? 100 : undefined}
            placeholder={adjForm.value_type === 'percent' ? '10' : '50.00'}
            value={adjForm.amount}
            onChange={(e) => setAdjForm((f) => ({ ...f, amount: e.target.value }))}
            className={styles.adjAmountInput}
          />
          <button type="submit" className={styles.adjSaveBtn} disabled={adjSaving}>
            {adjSaving ? '…' : 'Add'}
          </button>
        </form>
      )}
      {adjustments.length > 0 ? (
        <ul className={styles.adjList}>
          {adjustments.map((adj) => {
            const typeBadge = adj.type === 'discount' ? styles.adjBadgeDiscount : styles.adjBadgeSurcharge;
            return (
              <li key={adj.id} className={styles.adjItem}>
                <span className={`${styles.adjBadge} ${typeBadge}`}>{adj.type}</span>
                <span className={styles.adjLabel}>{adj.label}</span>
                <span className={styles.adjValue}>
                  {adj.value_type === 'percent' ? `${adj.amount}%` : `$${Number(adj.amount).toFixed(2)}`}
                </span>
                <button
                  type="button"
                  className={styles.adjRemoveBtn}
                  onClick={() => handleRemoveAdjustment(adj.id)}
                  title="Remove"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        !showAdjForm && <p className={styles.empty}>No adjustments.</p>
      )}
    </div>
  );
}

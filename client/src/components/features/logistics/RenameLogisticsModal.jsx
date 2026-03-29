import React, { useEffect, useRef, useState } from 'react';
import {
  LOGISTICS_QUICK_SEGMENTS,
  appendLogisticsSegment,
} from '../../../lib/logisticsRename.js';
import dialogStyles from '../../ConfirmDialog.module.css';
import styles from './RenameLogisticsModal.module.css';

export default function RenameLogisticsModal({
  open,
  onClose,
  onSave,
  inventoryTitle,
  currentLabel,
}) {
  const baseTitle = (inventoryTitle || '').trim() || '';
  const initialName = (currentLabel || inventoryTitle || '').trim();

  const [name, setName] = useState(initialName);
  const [appendMode, setAppendMode] = useState('middle');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName((currentLabel || inventoryTitle || '').trim());
    setAppendMode('middle');
  }, [open, currentLabel, inventoryTitle]);

  if (!open) return null;

  const applyQuick = (segment) => {
    if (segment === 'Custom') {
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    setName(appendLogisticsSegment(baseTitle, segment, appendMode));
  };

  const handleSave = () => {
    const next = name.trim();
    if (!next) return;
    onSave(next);
  };

  return (
    <div
      className={dialogStyles.overlay}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className={dialogStyles.dialog}
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-logistics-title"
      >
        <h3 id="rename-logistics-title" className={dialogStyles.title}>
          Rename logistics line
        </h3>
        <p className={styles.baseHint}>
          Base (inventory): <span className={styles.baseMono}>{baseTitle || '—'}</span>
        </p>

        <label className={styles.fieldLabel} htmlFor="rename-logistics-input">
          Display name
        </label>
        <input
          ref={inputRef}
          id="rename-logistics-input"
          className={styles.textInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />

        <div className={styles.sectionLabel}>Quick select</div>
        <div className={styles.quickRow}>
          {LOGISTICS_QUICK_SEGMENTS.map((seg) => (
            <button
              key={seg}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => applyQuick(seg)}
            >
              {seg}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => applyQuick('Custom')}
          >
            Custom
          </button>
        </div>

        <fieldset className={styles.toggleFieldset}>
          <legend className={styles.toggleLegend}>Append position (quick select)</legend>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="appendMode"
              checked={appendMode === 'middle'}
              onChange={() => setAppendMode('middle')}
            />
            After first segment (middle)
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="appendMode"
              checked={appendMode === 'end'}
              onChange={() => setAppendMode('end')}
            />
            At end
          </label>
        </fieldset>

        <div className={dialogStyles.actions}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

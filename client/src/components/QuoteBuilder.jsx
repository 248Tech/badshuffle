import React from 'react';
import QuoteLineItemsPanel from './quote-builder/QuoteLineItemsPanel.jsx';
import QuoteAdjustmentsPanel from './quote-builder/QuoteAdjustmentsPanel.jsx';
import InventoryPickerPanel from './quote-builder/InventoryPickerPanel.jsx';
import DateRangePicker from './DateRangePicker.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { api } from '../api.js';
import styles from './QuoteBuilder.module.css';

export default function QuoteBuilder({
  quoteId,
  items,
  sections = [],
  onItemsChange,
  onAddCustomItem,
  settings = {},
  availability = {},
  adjustments = [],
  onAdjustmentsChange,
  onOpenDrawer,
  onOpenLightbox,
}) {
  const normalizedSections = sections.length > 0 ? sections : [{ id: 'default', title: 'Quote Items' }];
  const defaultSectionId = normalizedSections[0]?.id;
  const [pickerSectionId, setPickerSectionId] = React.useState(defaultSectionId);
  const [sectionTitles, setSectionTitles] = React.useState({});
  const [pendingDeleteSection, setPendingDeleteSection] = React.useState(null);

  React.useEffect(() => {
    setPickerSectionId((prev) => {
      if (normalizedSections.some((section) => String(section.id) === String(prev))) return prev;
      return normalizedSections[0]?.id;
    });
  }, [sections]);

  React.useEffect(() => {
    setSectionTitles(
      normalizedSections.reduce((acc, section) => {
        acc[section.id] = section.title || '';
        return acc;
      }, {})
    );
  }, [sections]);

  const updateSection = async (sectionId, body) => {
    await api.updateQuoteSection(quoteId, sectionId, body);
    onItemsChange();
  };

  const addSection = async () => {
    await api.addQuoteSection(quoteId, {});
    onItemsChange();
  };

  const duplicateSection = async (sectionId) => {
    await api.duplicateQuoteSection(quoteId, sectionId);
    onItemsChange();
  };

  const removeSection = async (sectionId) => {
    await api.removeQuoteSection(quoteId, sectionId);
    onItemsChange();
    setPendingDeleteSection(null);
  };

  return (
    <div className={styles.builder}>
      {pendingDeleteSection && (
        <ConfirmDialog
          title="Delete quote items area"
          message={`Delete "${pendingDeleteSection.title || 'Quote Items'}" and remove all items in that area? This cannot be undone.`}
          confirmLabel="Delete area"
          confirmClass="btn-danger"
          onConfirm={() => removeSection(pendingDeleteSection.id)}
          onCancel={() => setPendingDeleteSection(null)}
        />
      )}
      {normalizedSections.map((section, index) => {
        const sectionItems = (items || []).filter((item) => String(item.section_id || defaultSectionId) === String(section.id));
        return (
          <div key={section.id} className={styles.sectionCard}>
            <div className={styles.sectionHeaderRow}>
              <input
                className={styles.sectionNameInput}
                value={sectionTitles[section.id] ?? section.title ?? ''}
                onChange={(e) => setSectionTitles((prev) => ({ ...prev, [section.id]: e.target.value }))}
                onBlur={() => updateSection(section.id, { title: sectionTitles[section.id] })}
                placeholder={`Quote Items ${index + 1}`}
                aria-label={`Section name: ${sectionTitles[section.id] || section.title || `Quote Items ${index + 1}`}`}
              />
              <div className={styles.sectionHeaderActions}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => duplicateSection(section.id)}>Duplicate</button>
                {normalizedSections.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingDeleteSection(section)}>Delete</button>
                )}
              </div>
            </div>
            <div className={styles.sectionDatesRow}>
              <div className="form-group">
                <label>Rental period</label>
                <DateRangePicker
                  from={section.rental_start || ''}
                  to={section.rental_end || ''}
                  onChange={({ from, to }) => updateSection(section.id, { rental_start: from || null, rental_end: to || null })}
                  placeholder="Select rental period"
                />
              </div>
            </div>
            <QuoteLineItemsPanel
              quoteId={quoteId}
              items={sectionItems}
              availability={availability}
              onItemsChange={onItemsChange}
              onOpenDrawer={onOpenDrawer}
              onOpenLightbox={onOpenLightbox}
              title={section.title || `Quote Items ${index + 1}`}
            />
          </div>
        );
      })}

      <div className={styles.sectionHeaderActions}>
        <button type="button" className="btn btn-primary btn-sm" onClick={addSection}>+ Add Quote Items Area</button>
      </div>

      {normalizedSections.length > 1 && (
        <div className="form-group">
          <label htmlFor="qb-picker-section">Add inventory to</label>
          <select id="qb-picker-section" value={pickerSectionId || ''} onChange={(e) => setPickerSectionId(e.target.value)}>
            {normalizedSections.map((section) => (
              <option key={section.id} value={section.id}>{section.title || 'Quote Items'}</option>
            ))}
          </select>
        </div>
      )}

      <InventoryPickerPanel
        quoteId={quoteId}
        items={items}
        sectionId={pickerSectionId}
        onItemsChange={onItemsChange}
        onAddCustomItem={onAddCustomItem}
        settings={settings}
      />

      <QuoteAdjustmentsPanel
        quoteId={quoteId}
        adjustments={adjustments}
        onAdjustmentsChange={onAdjustmentsChange}
      />
    </div>
  );
}

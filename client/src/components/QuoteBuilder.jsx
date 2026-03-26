import React from 'react';
import QuoteLineItemsPanel from './quote-builder/QuoteLineItemsPanel.jsx';
import QuoteAdjustmentsPanel from './quote-builder/QuoteAdjustmentsPanel.jsx';
import InventoryPickerPanel from './quote-builder/InventoryPickerPanel.jsx';
import styles from './QuoteBuilder.module.css';

export default function QuoteBuilder({ quoteId, items, onItemsChange, onAddCustomItem, settings = {}, availability = {}, adjustments = [], onAdjustmentsChange }) {
  return (
    <div className={styles.builder}>
      <QuoteLineItemsPanel
        quoteId={quoteId}
        items={items}
        availability={availability}
        onItemsChange={onItemsChange}
      />

      <QuoteAdjustmentsPanel
        quoteId={quoteId}
        adjustments={adjustments}
        onAdjustmentsChange={onAdjustmentsChange}
      />

      <InventoryPickerPanel
        quoteId={quoteId}
        items={items}
        onItemsChange={onItemsChange}
        onAddCustomItem={onAddCustomItem}
        settings={settings}
      />
    </div>
  );
}

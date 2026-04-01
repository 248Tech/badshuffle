import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../Toast.jsx';
import styles from '../QuoteBuilder.module.css';

const DEBOUNCE_MS = 400;

function EyeIcon({ hidden, className }) {
  if (hidden) {
    return (
      <svg
        className={className}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ConflictStopSignIcon({ className, title }) {
  return (
    <span className={className} role="img" title={title} aria-label="Inventory conflict">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="#c00"
        stroke="#8b0000"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
        <line x1="12" y1="8" x2="12" y2="13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <circle cx="12" cy="16.5" r="1.1" fill="#fff" stroke="none" />
      </svg>
    </span>
  );
}

function AvailableCheckIcon({ className, title }) {
  return (
    <span className={className} role="img" title={title} aria-label="Available">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0a7b0a"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

const QuoteLineItemRow = React.memo(function QuoteLineItemRow({
  item,
  qty,
  basePrice,
  hasOverride,
  overridePrice,
  hasDiscount,
  unitPrice,
  lineTotal,
  lineLabor,
  itemId,
  avail,
  isEditingPrice,
  isEditingDiscount,
  isOversold,
  isSubrental,
  isNew,
  isDragOver,
  displayQtyValue,
  priceInput,
  discountForm,
  styles,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onOpenQuoteItemEdit,
  onOpenDrawer,
  onOpenLightbox,
  onToggleHidden,
  onStartPriceEdit,
  onPriceInputChange,
  onCommitPriceEdit,
  onCancelPriceEdit,
  onStartDiscountEdit,
  onDiscountFormChange,
  onCommitDiscountEdit,
  onCancelDiscountEdit,
  onClearDiscount,
  onClearPriceOverride,
  onUpdateQty,
  onHandleQtyChange,
  onRemoveItem,
}) {
  return (
    <div
      className={`${styles.quoteItem} ${isNew ? 'quoteItemAdded' : ''} ${
        item.hidden_from_quote ? styles.quoteItemHidden : ''
      } ${isOversold ? styles.quoteItemOversold : ''} ${
        isDragOver ? styles.quoteItemDragOver : ''
      }`}
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDragOver={(e) => onDragOver(e, item)}
      onDrop={(e) => onDrop(e, item)}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        className={`${styles.itemActionBtn} ${styles.itemEditBtn}`}
        onClick={(e) => { e.stopPropagation(); onOpenQuoteItemEdit(item); }}
        title="Edit quote item"
        aria-label={`Edit quote item: ${item.label || item.title}`}
      >
        <PencilIcon />
      </button>
      <span className={styles.dragHandle} title="Drag to reorder" aria-hidden="true">
        ⠿
      </span>
      <div className={`${styles.thumbWrap} ${styles.itemThumbCell}`}>
        {item.photo_url ? (
          <img
            src={api.proxyImageUrl(item.photo_url, { variant: 'thumb' })}
            alt={item.title}
            className={`${styles.thumb} ${styles.thumbClickable}`}
            onClick={(e) => { e.stopPropagation(); onOpenLightbox?.([api.proxyImageUrl(item.photo_url, { variant: 'large' })], 0); }}
            onError={(e) => { e.target.src = '/placeholder.png'; }}
          />
        ) : (
          <img src="/placeholder.png" alt="" className={styles.thumb} aria-hidden />
        )}
        <button
          type="button"
          className={styles.eyeBtn}
          onClick={(e) => { e.stopPropagation(); onToggleHidden(item); }}
          title={item.hidden_from_quote ? 'Show on customer quote' : 'Hide from customer quote'}
          aria-label={item.hidden_from_quote ? 'Show on customer quote' : 'Hide from customer quote'}
        >
          <EyeIcon hidden={!!item.hidden_from_quote} className={styles.eyeIcon} />
        </button>
      </div>
      <span
        className={`${styles.itemTitleLink} ${styles.itemTitleBlock}`}
        onClick={(e) => { e.stopPropagation(); onOpenDrawer?.(itemId); }}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenDrawer?.(itemId)}
        title="View item details"
        role="button"
        tabIndex={0}
      >
        {avail && (avail.status === 'reserved' || avail.status === 'potential') && (
          <ConflictStopSignIcon
            className={styles.conflictIcon}
            title={
              avail.status === 'reserved'
                ? `Confirmed oversold (${avail.my_qty} needed / ${avail.stock} in stock)`
                : `Potential oversold (${avail.my_qty} needed / ${avail.stock} in stock)`
            }
          />
        )}
        {avail && avail.status === 'ok' && (
          <AvailableCheckIcon className={styles.availableIcon} title="Item available" />
        )}
        {isSubrental && (
          <span className={styles.subrentalBadge} title="Subrental item">
            S
          </span>
        )}
        {item.label || item.title}
        {avail && avail.stock != null && (avail.reserved_qty > 0 || avail.status !== 'ok') && (
          <span
            className={styles.stockBadge}
            title={`${avail.stock} in stock, ${avail.reserved_qty} already booked on this date`}
          >
            Only {avail.stock} available, {avail.reserved_qty} already booked
          </span>
        )}
      </span>
      {isEditingPrice ? (
        <span className={`${styles.priceEditWrap} ${styles.itemPriceBlock}`} onClick={(e) => e.stopPropagation()}>
          <input
            type="number"
            min="0"
            step="0.01"
            className={styles.priceInput}
            value={priceInput}
            onChange={(e) => onPriceInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitPriceEdit(item);
              if (e.key === 'Escape') onCancelPriceEdit();
            }}
            autoFocus
          />
          <button type="button" className={styles.priceEditSave} onClick={() => onCommitPriceEdit(item)} aria-label="Save price" title="Save">✓</button>
          <button type="button" className={styles.priceEditCancel} onClick={onCancelPriceEdit} aria-label="Cancel price edit" title="Cancel">✕</button>
        </span>
      ) : isEditingDiscount ? (
        <span className={`${styles.priceEditWrap} ${styles.itemPriceBlock}`} onClick={(e) => e.stopPropagation()}>
          <select
            className={styles.adjSelect}
            value={discountForm.type}
            onChange={(e) => onDiscountFormChange((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="percent">%</option>
            <option value="fixed">$</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            className={styles.priceInput}
            value={discountForm.amount}
            onChange={(e) => onDiscountFormChange((f) => ({ ...f, amount: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitDiscountEdit(item);
              if (e.key === 'Escape') onCancelDiscountEdit();
            }}
            placeholder={discountForm.type === 'percent' ? '10' : '5.00'}
            autoFocus
          />
          <button type="button" className={styles.priceEditSave} onClick={() => onCommitDiscountEdit(item)} aria-label="Apply discount" title="Apply discount">✓</button>
          <button type="button" className={styles.priceEditCancel} onClick={onCancelDiscountEdit} aria-label="Cancel discount edit" title="Cancel">✕</button>
        </span>
      ) : (
        <span className={`${styles.priceCol} ${styles.itemPriceBlock}`} onClick={(e) => e.stopPropagation()}>
          <span
            className={`${styles.unitPrice} ${hasOverride ? styles.unitPriceOverride : ''} ${
              hasDiscount ? styles.unitPriceDiscounted : ''
            }`}
            onClick={() => onStartPriceEdit(item)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onStartPriceEdit(item)}
            title={
              hasOverride
                ? `Override: $${overridePrice.toFixed(2)} (base: $${basePrice.toFixed(2)}). Click to edit.`
                : `$${basePrice.toFixed(2)} — click to override for this quote`
            }
            role="button"
            tabIndex={0}
          >
            ${unitPrice.toFixed(2)}
            {hasOverride && (
              <button
                type="button"
                className={styles.clearOverrideBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearPriceOverride(item);
                }}
                aria-label="Reset to base price"
                title="Reset to base price"
              >
                ✕
              </button>
            )}
          </span>
          {hasDiscount ? (
            <span
              className={styles.discountBadge}
              onClick={() => onStartDiscountEdit(item)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onStartDiscountEdit(item)}
              role="button"
              tabIndex={0}
              title="Click to edit discount"
            >
              -{item.discount_type === 'percent' ? `${item.discount_amount}%` : `$${Number(item.discount_amount).toFixed(2)}`}
              <button
                type="button"
                className={styles.clearOverrideBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onClearDiscount(item);
                }}
                aria-label="Remove discount"
                title="Remove discount"
              >
                ✕
              </button>
            </span>
          ) : (
            <button type="button" className={styles.discountBtn} onClick={() => onStartDiscountEdit(item)} title="Add item discount" aria-label="Add item discount">
              %
            </button>
          )}
        </span>
      )}
      <span className={`${styles.laborHours} ${styles.itemLabor}`} title="Labor hours (this line)">
        {lineLabor > 0 ? `${lineLabor.toFixed(1)} hrs` : '—'}
      </span>
      <div className={`${styles.qtyControl} ${styles.itemQtyBlock}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => onUpdateQty(item.qitem_id, qty - 1)} aria-label="Decrease">−</button>
        <input
          type="number"
          min={0}
          step={1}
          value={displayQtyValue}
          onChange={(e) => onHandleQtyChange(item.qitem_id, e.target.value)}
          className={styles.qtyInput}
          aria-label="Quantity"
        />
        <button type="button" onClick={() => onUpdateQty(item.qitem_id, qty + 1)} aria-label="Increase">+</button>
      </div>
      <span className={`${styles.lineTotal} ${styles.itemTotalBlock}`}>${lineTotal.toFixed(2)}</span>
      {item.hidden_from_quote && <span className={`${styles.hiddenBadge} ${styles.itemStatusBadge}`}>Hidden from quote</span>}
      {itemId != null && (
        <button
          type="button"
          className={`${styles.itemActionBtn} ${styles.itemInfoBtn}`}
          onClick={(e) => { e.stopPropagation(); onOpenDrawer?.(itemId); }}
          title="View item details"
          aria-label={`View details: ${item.label || item.title}`}
        >
          <InfoIcon />
        </button>
      )}
      <button
        type="button"
        className={`${styles.removeBtn} ${styles.itemRemoveBtn}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemoveItem(item.qitem_id, item.title);
        }}
        title="Remove"
        aria-label={`Remove ${item.title} from quote`}
      >
        ✕
      </button>
    </div>
  );
}, (prev, next) => (
  prev.item === next.item &&
  prev.avail === next.avail &&
  prev.isEditingPrice === next.isEditingPrice &&
  prev.isEditingDiscount === next.isEditingDiscount &&
  prev.isOversold === next.isOversold &&
  prev.isSubrental === next.isSubrental &&
  prev.isNew === next.isNew &&
  prev.isDragOver === next.isDragOver &&
  prev.displayQtyValue === next.displayQtyValue &&
  prev.priceInput === next.priceInput &&
  prev.discountForm.type === next.discountForm.type &&
  prev.discountForm.amount === next.discountForm.amount
));

export default function QuoteLineItemsPanel({ quoteId, items = [], availability = {}, onItemsChange, onOpenDrawer, onOpenLightbox, title = 'Quote Items' }) {
  const toast = useToast();
  const [localQty, setLocalQty] = useState({});
  const debounceRef = useRef(null);
  const [orderedItems, setOrderedItems] = useState(items || []);

  const [editingPriceId, setEditingPriceId] = useState(null);
  const [priceInput, setPriceInput] = useState('');

  const dragItemRef = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);

  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [discountForm, setDiscountForm] = useState({ type: 'percent', amount: '' });

  const [newlyAddedItemId, setNewlyAddedItemId] = useState(null);

  const [editingQuoteItem, setEditingQuoteItem] = useState(null);
  const [quoteItemForm, setQuoteItemForm] = useState({});
  const [quoteItemSaving, setQuoteItemSaving] = useState(false);

  useEffect(() => {
    setOrderedItems(items || []);
  }, [items]);

  useEffect(() => {
    const ids = (items || [])
      .map((it) => it.photo_url)
      .filter((p) => p != null && /^\d+$/.test(String(p).trim()))
      .map((p) => String(p).trim());
    if (!ids.length) return;
    api.prefetchFileServeUrls(ids).catch(() => {});
  }, [items]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const removeItem = async (qitemId, title) => {
    try {
      await api.removeQuoteItem(quoteId, qitemId);
      onItemsChange();
      toast.info(`Removed ${title}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const cancelPriceEdit = useCallback(() => setEditingPriceId(null), []);
  const cancelDiscountEdit = useCallback(() => setEditingDiscountId(null), []);

  const updateQty = useCallback(
    async (qitemId, quantity) => {
      const n = Math.max(0, Math.floor(Number(quantity)));
      try {
        await api.updateQuoteItem(quoteId, qitemId, { quantity: n });
        onItemsChange();
        setLocalQty((prev) => {
          const next = { ...prev };
          delete next[qitemId];
          return next;
        });
      } catch (err) {
        toast.error(err.message);
      }
    },
    [quoteId, onItemsChange, toast]
  );

  const handleQtyChange = (qitemId, value) => {
    const str = String(value).replace(/[^0-9]/g, '') || '0';
    setLocalQty((prev) => ({ ...prev, [qitemId]: str }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const n = Math.max(0, parseInt(str, 10) || 0);
      updateQty(qitemId, n);
      debounceRef.current = null;
    }, DEBOUNCE_MS);
  };

  const toggleHidden = async (item) => {
    const next = item.hidden_from_quote ? 0 : 1;
    try {
      await api.updateQuoteItem(quoteId, item.qitem_id, { hidden_from_quote: next });
      onItemsChange();
      toast.info(next ? 'Hidden from customer quote' : 'Visible on customer quote');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const displayQty = (item) => {
    if (localQty[item.qitem_id] !== undefined) return localQty[item.qitem_id];
    return String(item.quantity ?? 1);
  };

  const startPriceEdit = (item) => {
    if (editingPriceId === item.qitem_id) return;
    const current = item.unit_price_override != null ? item.unit_price_override : (item.unit_price ?? 0);
    setEditingPriceId(item.qitem_id);
    setPriceInput(String(current));
  };

  const commitPriceEdit = async (item) => {
    const raw = priceInput.trim();
    const val = raw === '' ? null : parseFloat(raw);
    if (raw !== '' && (isNaN(val) || val < 0)) {
      toast.error('Invalid price');
      return;
    }
    setEditingPriceId(null);
    const isSameAsBase = val !== null && Math.abs(val - (item.unit_price ?? 0)) < 0.001;
    const override = val === null || isSameAsBase ? null : val;
    try {
      await api.updateQuoteItem(quoteId, item.qitem_id, { unit_price_override: override });
      onItemsChange();
    } catch (err) {
      toast.error(err.message);
    }
  };

  function itemEffectivePrice(item) {
    const base = item.unit_price_override != null ? item.unit_price_override : (item.unit_price ?? 0);
    if (item.discount_type === 'percent' && item.discount_amount > 0) return base * (1 - item.discount_amount / 100);
    if (item.discount_type === 'fixed' && item.discount_amount > 0) return Math.max(0, base - item.discount_amount);
    return base;
  }

  const startDiscountEdit = (item) => {
    if (editingDiscountId === item.qitem_id) return;
    setEditingDiscountId(item.qitem_id);
    setDiscountForm({
      type: item.discount_type && item.discount_type !== 'none' ? item.discount_type : 'percent',
      amount: item.discount_amount > 0 ? String(item.discount_amount) : '',
    });
  };

  const commitDiscountEdit = async (item) => {
    const amt = parseFloat(discountForm.amount);
    const hasDiscount = !isNaN(amt) && amt > 0;
    setEditingDiscountId(null);
    try {
      await api.updateQuoteItem(quoteId, item.qitem_id, {
        discount_type: hasDiscount ? discountForm.type : 'none',
        discount_amount: hasDiscount ? amt : 0,
      });
      onItemsChange();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const clearDiscount = async (item) => {
    try {
      await api.updateQuoteItem(quoteId, item.qitem_id, { discount_type: 'none', discount_amount: 0 });
      onItemsChange();
      toast.info('Discount cleared');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openQuoteItemEdit = (item) => {
    setEditingQuoteItem(item);
    setQuoteItemForm({
      label: item.label || '',
      unit_price_override: item.unit_price_override != null ? String(item.unit_price_override) : '',
      quantity: String(item.quantity ?? 1),
      description: item.qi_description || '',
      notes: item.qi_notes || '',
    });
  };

  const saveQuoteItem = async () => {
    if (!editingQuoteItem) return;
    setQuoteItemSaving(true);
    try {
      const qty = Math.max(1, parseInt(quoteItemForm.quantity, 10) || 1);
      const priceRaw = quoteItemForm.unit_price_override.trim();
      const override = priceRaw === '' ? null : parseFloat(priceRaw);
      const isSameAsBase = override !== null && Math.abs(override - (editingQuoteItem.unit_price ?? 0)) < 0.001;
      await api.updateQuoteItem(quoteId, editingQuoteItem.qitem_id, {
        label: quoteItemForm.label.trim() || null,
        unit_price_override: override === null || isSameAsBase ? null : override,
        quantity: qty,
        description: quoteItemForm.description.trim() || null,
        notes: quoteItemForm.notes.trim() || null,
      });
      onItemsChange();
      setEditingQuoteItem(null);
      toast.success('Item updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setQuoteItemSaving(false);
    }
  };

  const handleDragStart = (e, item) => {
    dragItemRef.current = item.qitem_id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, item) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(item.qitem_id);
  };

  const handleDrop = async (e, targetItem) => {
    e.preventDefault();
    setDragOverId(null);
    const srcId = dragItemRef.current;
    if (!srcId || srcId === targetItem.qitem_id) return;
    const list = [...orderedItems];
    const srcIdx = list.findIndex((i) => i.qitem_id === srcId);
    const tgtIdx = list.findIndex((i) => i.qitem_id === targetItem.qitem_id);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const reordered = [...list];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, moved);
    setOrderedItems(reordered);
    try {
      await api.reorderQuoteItems(quoteId, reordered.map((i) => i.qitem_id));
      onItemsChange();
    } catch (_err) {
      setOrderedItems(items || []);
      toast.error('Could not save new order');
    }
  };

  const handleDragEnd = () => {
    dragItemRef.current = null;
    setDragOverId(null);
  };

  const clearPriceOverride = async (item) => {
    try {
      await api.updateQuoteItem(quoteId, item.qitem_id, { unit_price_override: null });
      onItemsChange();
      toast.info('Price override cleared');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}{orderedItems?.length > 0 ? ` (${orderedItems.length})` : ''}</h3>
      {(!orderedItems || orderedItems.length === 0) && <p className={styles.empty}>No items yet. Add from inventory below.</p>}
      <div className={styles.quoteList}>
        {(orderedItems || []).map((item) => {
          const qty = item.quantity ?? 1;
          const basePrice = item.unit_price ?? 0;
          const hasOverride = item.unit_price_override != null;
          const overridePrice = hasOverride ? item.unit_price_override : basePrice;
          const hasDiscount = item.discount_type && item.discount_type !== 'none' && item.discount_amount > 0;
          const unitPrice = itemEffectivePrice(item);
          const lineTotal = unitPrice * qty;
          const lineLabor = (Number(item.labor_hours) || 0) * qty;
          const itemId = item.id ?? item.item_id;
          const avail = itemId != null ? availability[itemId] : null;
          const isEditingPrice = editingPriceId === item.qitem_id;
          const isEditingDiscount = editingDiscountId === item.qitem_id;
          const isOversold = avail && (avail.status === 'reserved' || avail.status === 'potential');
          const isSubrental = !!(item.is_subrental || item.is_subrental === 1);
          return (
            <QuoteLineItemRow
              key={item.qitem_id}
              item={item}
              qty={qty}
              basePrice={basePrice}
              hasOverride={hasOverride}
              overridePrice={overridePrice}
              hasDiscount={hasDiscount}
              unitPrice={unitPrice}
              lineTotal={lineTotal}
              lineLabor={lineLabor}
              itemId={itemId}
              avail={avail}
              isEditingPrice={isEditingPrice}
              isEditingDiscount={isEditingDiscount}
              isOversold={isOversold}
              isSubrental={isSubrental}
              isNew={itemId === newlyAddedItemId}
              isDragOver={dragOverId === item.qitem_id}
              displayQtyValue={displayQty(item)}
              priceInput={priceInput}
              discountForm={discountForm}
              styles={styles}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onOpenQuoteItemEdit={openQuoteItemEdit}
              onOpenDrawer={onOpenDrawer}
              onOpenLightbox={onOpenLightbox}
              onToggleHidden={toggleHidden}
              onStartPriceEdit={startPriceEdit}
              onPriceInputChange={setPriceInput}
              onCommitPriceEdit={commitPriceEdit}
              onCancelPriceEdit={cancelPriceEdit}
              onStartDiscountEdit={startDiscountEdit}
              onDiscountFormChange={setDiscountForm}
              onCommitDiscountEdit={commitDiscountEdit}
              onCancelDiscountEdit={cancelDiscountEdit}
              onClearDiscount={clearDiscount}
              onClearPriceOverride={clearPriceOverride}
              onUpdateQty={updateQty}
              onHandleQtyChange={handleQtyChange}
              onRemoveItem={removeItem}
            />
          );
        })}
      </div>

      {editingQuoteItem && (
        <div
          className={styles.qiModalOverlay}
          onClick={() => setEditingQuoteItem(null)}
          onKeyDown={(e) => e.key === 'Escape' && setEditingQuoteItem(null)}
        >
          <div className={styles.qiModal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="qi-modal-title">
            <div className={styles.qiModalHeader}>
              <h3 id="qi-modal-title" className={styles.qiModalTitle}>Edit Quote Item</h3>
              <button
                type="button"
                className={styles.qiModalClose}
                onClick={() => setEditingQuoteItem(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className={styles.qiModalBody}>
              <label htmlFor="qi-alias" className={styles.qiLabel}>
                Alias title <span className={styles.qiLabelHint}>(overrides display name on quote)</span>
              </label>
              <input
                id="qi-alias"
                type="text"
                className={styles.qiInput}
                placeholder={editingQuoteItem.title}
                value={quoteItemForm.label}
                onChange={(e) => setQuoteItemForm((f) => ({ ...f, label: e.target.value }))}
              />
              <div className={styles.qiRow}>
                <div className={styles.qiField}>
                  <label htmlFor="qi-price" className={styles.qiLabel}>Contract price</label>
                  <input
                    id="qi-price"
                    type="number"
                    min="0"
                    step="0.01"
                    className={styles.qiInput}
                    placeholder={`Base: $${(editingQuoteItem.unit_price ?? 0).toFixed(2)}`}
                    value={quoteItemForm.unit_price_override}
                    onChange={(e) => setQuoteItemForm((f) => ({ ...f, unit_price_override: e.target.value }))}
                  />
                </div>
                <div className={styles.qiField}>
                  <label htmlFor="qi-qty" className={styles.qiLabel}>Quantity</label>
                  <input
                    id="qi-qty"
                    type="number"
                    min="1"
                    step="1"
                    className={styles.qiInput}
                    value={quoteItemForm.quantity}
                    onChange={(e) => setQuoteItemForm((f) => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
              </div>
              <label htmlFor="qi-desc" className={styles.qiLabel}>
                Contract description <span className={styles.qiLabelHint}>(shown on quote)</span>
              </label>
              <textarea
                id="qi-desc"
                className={styles.qiTextarea}
                rows={3}
                placeholder="Contract-specific description…"
                value={quoteItemForm.description}
                onChange={(e) => setQuoteItemForm((f) => ({ ...f, description: e.target.value }))}
              />
              <label htmlFor="qi-notes" className={styles.qiLabel}>
                Internal notes <span className={styles.qiLabelHint}>(not shown to client)</span>
              </label>
              <textarea
                id="qi-notes"
                className={styles.qiTextarea}
                rows={2}
                placeholder="Notes for your team…"
                value={quoteItemForm.notes}
                onChange={(e) => setQuoteItemForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className={styles.qiModalFooter}>
              <button type="button" className={styles.qiCancelBtn} onClick={() => setEditingQuoteItem(null)}>
                Cancel
              </button>
              <button type="button" className={styles.qiSaveBtn} onClick={saveQuoteItem} disabled={quoteItemSaving}>
                {quoteItemSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

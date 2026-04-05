import React, { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const PuzzleIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
    <path d="M20.5 11H19V7a2 2 0 00-2-2h-4V3.5a2.5 2.5 0 00-5 0V5H4a2 2 0 00-2 2v3.8h1.5a2.5 2.5 0 010 5H2V20a2 2 0 002 2h3.8v-1.5a2.5 2.5 0 015 0V22H17a2 2 0 002-2v-4h1.5a2.5 2.5 0 000-5z"/>
  </svg>
);

function ItemCard({
  item,
  onEdit,
  onDelete,
  onAddToQuote,
  showSource = true,
  selectable = false,
  selected = false,
  onToggleSelect,
}) {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const isExtension = (item.source || 'manual') === 'extension';
  const hasPrice = item.unit_price > 0;
  const itemType = item.item_type || 'product';
  const showSelectionCheckbox = selectable && itemType === 'product';
  const stockInfo = item.quantity_in_stock != null && item.quantity_in_stock > 0
    ? `${item.quantity_in_stock} in stock${item.quantity_going_out > 0 ? ` / ${item.quantity_going_out} out` : ''}${item.quantity_set_aside > 0 ? ` / ${item.quantity_set_aside} set aside` : ''}`
    : null;

  const goToItem = () => {
    if (onEdit) {
      onEdit(item);
      return;
    }
    navigate(`/inventory/${item.id}`, { state: { autoEdit: true } });
  };

  return (
    <div className={`group bg-bg border rounded overflow-hidden transition-shadow duration-200 hover:shadow-md ${
      selected ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'border-border'
    } ${item.hidden ? 'opacity-50' : ''}`}>
      {/* Image + action overlay */}
      <div
        className="relative aspect-[4/3] bg-surface overflow-hidden cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`Edit ${item.title}`}
        onClick={goToItem}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && goToItem()}
      >
        <img
          src={item.photo_url && !imgError ? api.proxyImageUrl(item.photo_url, { variant: 'thumb' }) : '/placeholder.png'}
          alt={item.photo_url && !imgError ? item.title : ''}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          aria-hidden={!item.photo_url || imgError}
        />

        {/* Badges */}
        {showSelectionCheckbox && (
          <label
            className={`absolute top-1.5 right-1.5 z-[1] flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors cursor-pointer ${
              selected
                ? 'border-primary bg-primary text-white'
                : 'border-white/70 bg-black/50 text-white hover:bg-black/65'
            }`}
            title={selected ? `Remove ${item.title} from selection` : `Select ${item.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              aria-label={selected ? `Deselect ${item.title}` : `Select ${item.title}`}
              onChange={(e) => onToggleSelect?.(item, { shiftKey: e.shiftKey || e.nativeEvent?.shiftKey })}
            />
          </label>
        )}
        {isExtension && showSource && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-[#fff4e0] text-[#8a5a00] rounded-full text-[10px] font-semibold px-1.5 py-0.5" title="Imported via Chrome Extension">
            <PuzzleIcon />
          </span>
        )}
        {item.category && (
          <span
            className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)] bg-black/55 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm overflow-hidden text-ellipsis whitespace-nowrap"
            title={item.category}
          >
            {item.category}
          </span>
        )}
        {itemType !== 'product' && (
          <span className={`absolute bottom-1.5 right-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            itemType === 'group' ? 'bg-primary-subtle text-primary' : 'bg-success-subtle text-success-strong'
          }`}>
            {itemType === 'group' ? '⬡ Group' : '⊕ Accessory'}
          </span>
        )}

        {/* Action overlay */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex items-end justify-between p-1.5 bg-gradient-to-t from-black/50 via-transparent to-transparent"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            {onAddToQuote && (
              <button
                type="button"
                className="flex items-center justify-center w-7 h-7 rounded bg-primary text-white hover:opacity-90 transition-opacity border-none cursor-pointer text-base font-bold"
                title="Add to project"
                aria-label={`Add ${item.title} to project`}
                onClick={() => onAddToQuote(item)}
              >
                <PlusIcon />
              </button>
            )}
          </div>
          {onDelete && (
            <button
              type="button"
              className="flex items-center justify-center w-7 h-7 rounded bg-danger text-white hover:opacity-90 transition-opacity border-none cursor-pointer"
              title="Delete item"
              aria-label={`Delete ${item.title}`}
              onClick={() => onDelete(item)}
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-3">
        <h3
          className="text-[13.5px] font-semibold text-text-base leading-snug mb-1 cursor-pointer hover:text-primary transition-colors line-clamp-2"
          title={item.title}
          tabIndex={0}
          role="button"
          onClick={goToItem}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && goToItem()}
        >
          {item.title}
        </h3>

        {item.description && (
          <p className="text-[12px] text-text-muted leading-snug mb-2 line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mt-auto">
          {hasPrice && (
            <span className="text-[13px] font-semibold text-text-base">${item.unit_price.toFixed(2)}</span>
          )}
          {stockInfo && (
            <span className="text-[11px] text-text-muted ml-auto">{stockInfo}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ItemCard);

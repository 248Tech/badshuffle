import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api, isAbortError } from '../api.js';
import ItemGrid from '../components/ItemGrid.jsx';
import AssociationList from '../components/AssociationList.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../components/Toast.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import styles from './InventoryPage.module.css';

const EMPTY_FORM = {
  title: '', photo_url: '', hidden: false,
  unit_price: '', quantity_in_stock: '', category: '', description: '', internal_notes: '', serial_number: '', taxable: true,
  item_type: 'product', is_subrental: false
};

const EMPTY_AI_BATCH_PROGRESS = {
  total: 0,
  completed: 0,
  currentIndex: 0,
  currentItemTitle: '',
  currentStage: '',
  controls: null,
  successes: [],
  failures: [],
};

const DESCRIPTION_STYLE_OPTIONS = [
  { value: 'catalog', label: 'Catalog' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'playful', label: 'Playful' },
  { value: 'technical', label: 'Technical' },
  { value: 'minimal', label: 'Minimal' },
];

const DESCRIPTION_PERSONA_OPTIONS = [
  { value: 'planner', label: 'Event Planner' },
  { value: 'designer', label: 'Designer' },
  { value: 'sales', label: 'Sales' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'stylist', label: 'Stylist' },
];

const DESCRIPTION_VARIATION_OPTIONS = [
  { value: 'low', label: 'Low variation' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'high', label: 'High variation' },
];

function normalizeInventorySearchToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[’”″]/g, '')
    .replace(/\b(ft|feet|foot)\b/g, '')
    .replace(/\b(in|inch|inches)\b/g, '')
    .replace(/\s*x\s*/g, 'x')
    .replace(/[^a-z0-9]+/g, '');
}

function tokenizeInventoryText(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsOrderedTokens(text, tokens) {
  if (!tokens.length) return false;
  let cursor = 0;
  for (const token of tokens) {
    const nextIndex = text.indexOf(token, cursor);
    if (nextIndex === -1) return false;
    cursor = nextIndex + token.length;
  }
  return true;
}

function buildInventorySearchMatchers(search) {
  const raw = String(search || '').trim();
  if (!raw) {
    return {
      raw: '',
      compact: '',
      variants: [],
      wordTokens: [],
      normalizedFull: '',
      normalizedTokens: [],
    };
  }
  const compact = raw.replace(/\s+/g, ' ').trim();
  const dequoted = compact.replace(/["']/g, '').replace(/[’”″]/g, '').trim();
  const collapsedX = dequoted.replace(/\s*x\s*/gi, 'x');
  const spacedX = dequoted.replace(/\s*x\s*/gi, ' x ');
  const normalizedFull = normalizeInventorySearchToken(raw);
  const titleBoundaryPatterns = Array.from(new Set([raw, compact, dequoted, collapsedX, spacedX]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .map((value) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(value)}([^a-z0-9]|$)`, 'i'))));
  const wordTokens = Array.from(new Set(
    compact
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
  ));
  const normalizedTokens = Array.from(new Set(
    normalizedFull
      .split(/x|(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/g)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2)
  ));
  return {
    raw,
    compact,
    variants: Array.from(new Set([raw, compact, dequoted, collapsedX, spacedX]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean))),
    titleBoundaryPatterns,
    wordTokens,
    normalizedFull,
    normalizedTokens,
  };
}

function itemMatchesInventorySearch(item, search, searchMode) {
  const matcher = buildInventorySearchMatchers(search);
  if (!matcher.raw) return true;

  const title = String(item?.title || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();
  const description = String(item?.description || '').toLowerCase();
  const titleNormalized = normalizeInventorySearchToken(item?.title || '');
  const categoryNormalized = normalizeInventorySearchToken(item?.category || '');
  const descriptionNormalized = normalizeInventorySearchToken(item?.description || '');
  const titleTokens = tokenizeInventoryText(item?.title || '');
  const categoryTokens = tokenizeInventoryText(item?.category || '');
  const descriptionTokens = tokenizeInventoryText(item?.description || '');
  const exactMode = String(searchMode || 'loose').trim().toLowerCase() === 'exact';
  const combinedText = [title, category, description].join(' ');
  const combinedNormalized = [titleNormalized, categoryNormalized, descriptionNormalized].join(' ');
  const combinedTokens = new Set([...titleTokens, ...categoryTokens, ...descriptionTokens]);

  const titleBoundaryMatch = matcher.titleBoundaryPatterns.some((pattern) => pattern.test(title));
  const exactTitleMatch = matcher.compact && title.trim() === matcher.compact.toLowerCase();
  const titleWordMatch = matcher.wordTokens.length > 0
    && matcher.wordTokens.every((token) => titleTokens.includes(token));
  const normalizedTitleMatches = !!matcher.normalizedFull && titleNormalized.includes(matcher.normalizedFull);
  const normalizedTitleTokenMatch = matcher.normalizedTokens.length > 0
    && matcher.normalizedTokens.every((token) => titleNormalized.includes(token));
  const orderedTitleTokenMatch = matcher.wordTokens.length > 1
    && containsOrderedTokens(title, matcher.wordTokens);
  if (exactMode) {
    return exactTitleMatch
      || titleBoundaryMatch
      || normalizedTitleMatches
      || orderedTitleTokenMatch
      || titleWordMatch
      || normalizedTitleTokenMatch;
  }

  const phraseMatch = matcher.variants.some((variant) => combinedText.includes(variant));
  const orderedTitleMatch = matcher.wordTokens.length > 1
    && containsOrderedTokens(title, matcher.wordTokens);
  const wordTokenMatch = matcher.wordTokens.length > 0
    && matcher.wordTokens.every((token) => combinedTokens.has(token));
  const normalizedFullMatch = !!matcher.normalizedFull && combinedNormalized.includes(matcher.normalizedFull);
  const normalizedTokenMatch = matcher.normalizedTokens.length > 0
    && matcher.normalizedTokens.every((token) => combinedNormalized.includes(token));

  if (titleBoundaryMatch || phraseMatch || normalizedFullMatch || orderedTitleMatch) return true;
  if (wordTokenMatch) return true;
  return normalizedTokenMatch;
}

function scoreInventorySearchMatch(item, search, searchMode) {
  const matcher = buildInventorySearchMatchers(search);
  if (!matcher.raw) return 0;

  const title = String(item?.title || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();
  const description = String(item?.description || '').toLowerCase();
  const titleNormalized = normalizeInventorySearchToken(item?.title || '');
  const categoryNormalized = normalizeInventorySearchToken(item?.category || '');
  const descriptionNormalized = normalizeInventorySearchToken(item?.description || '');
  const titleTokens = tokenizeInventoryText(item?.title || '');
  const categoryTokens = tokenizeInventoryText(item?.category || '');
  const descriptionTokens = tokenizeInventoryText(item?.description || '');
  const exactMode = String(searchMode || 'loose').trim().toLowerCase() === 'exact';
  const combinedText = [title, category, description].join(' ');
  const combinedNormalized = [titleNormalized, categoryNormalized, descriptionNormalized].join(' ');
  const combinedTokens = new Set([...titleTokens, ...categoryTokens, ...descriptionTokens]);

  const exactTitleMatch = matcher.compact && title.trim() === matcher.compact.toLowerCase();
  const titleBoundaryMatch = matcher.titleBoundaryPatterns.some((pattern) => pattern.test(title));
  const phraseMatchesTitle = matcher.variants.some((variant) => title.includes(variant));
  const normalizedTitleMatch = !!matcher.normalizedFull && titleNormalized.includes(matcher.normalizedFull);
  const orderedTitleTokenMatch = matcher.wordTokens.length > 1 && containsOrderedTokens(title, matcher.wordTokens);
  const titleTokenMatch = matcher.wordTokens.length > 0
    && matcher.wordTokens.every((token) => titleTokens.includes(token));
  const normalizedTitleTokenMatch = matcher.normalizedTokens.length > 0
    && matcher.normalizedTokens.every((token) => titleNormalized.includes(token));
  const phraseMatch = matcher.variants.some((variant) => combinedText.includes(variant));
  const normalizedFullMatch = !!matcher.normalizedFull && combinedNormalized.includes(matcher.normalizedFull);
  const wordTokenMatch = matcher.wordTokens.length > 0
    && matcher.wordTokens.every((token) => combinedTokens.has(token));
  const normalizedTokenMatch = matcher.normalizedTokens.length > 0
    && matcher.normalizedTokens.every((token) => combinedNormalized.includes(token));
  const categoryTokenMatch = matcher.wordTokens.length > 0
    && matcher.wordTokens.every((token) => categoryTokens.includes(token));
  const descriptionTokenMatch = matcher.wordTokens.length > 0
    && matcher.wordTokens.every((token) => descriptionTokens.includes(token));

  if (exactMode) {
    if (exactTitleMatch) return 1000;
    if (titleBoundaryMatch) return 900;
    if (normalizedTitleMatch) return 850;
    if (orderedTitleTokenMatch) return 800;
    if (titleTokenMatch) return 750;
    if (normalizedTitleTokenMatch) return 700;
    return 0;
  }

  if (exactTitleMatch) return 1000;
  if (titleBoundaryMatch) return 920;
  if (phraseMatchesTitle) return 900;
  if (normalizedTitleMatch) return 860;
  if (orderedTitleTokenMatch) return 820;
  if (titleTokenMatch) return 780;
  if (normalizedTitleTokenMatch) return 740;
  if (phraseMatch) return 640;
  if (normalizedFullMatch) return 600;
  if (categoryTokenMatch) return 520;
  if (descriptionTokenMatch) return 460;
  if (wordTokenMatch) return 420;
  if (normalizedTokenMatch) return 380;
  return 0;
}

export default function InventoryPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState('loose');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [catsExpanded, setCatsExpanded] = useState(false);
  const [accessories, setAccessories] = useState([]);
  const [accessorySearch, setAccessorySearch] = useState('');
  const [accessoryResults, setAccessoryResults] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [batchEditingDescriptions, setBatchEditingDescriptions] = useState(false);
  const [aiBatchProgress, setAiBatchProgress] = useState(EMPTY_AI_BATCH_PROGRESS);
  const [revertingBatchIds, setRevertingBatchIds] = useState([]);
  const [showAiBatchConfigurator, setShowAiBatchConfigurator] = useState(false);
  const [aiStylePreset, setAiStylePreset] = useState(() => (typeof window !== 'undefined' && window.localStorage.getItem('inventory-ai:style')) || 'catalog');
  const [aiPersonaPreset, setAiPersonaPreset] = useState(() => (typeof window !== 'undefined' && window.localStorage.getItem('inventory-ai:persona')) || 'planner');
  const [aiVariationLevel, setAiVariationLevel] = useState(() => (typeof window !== 'undefined' && window.localStorage.getItem('inventory-ai:variation')) || 'balanced');
  const [aiCustomInstructions, setAiCustomInstructions] = useState(() => (typeof window !== 'undefined' && window.localStorage.getItem('inventory-ai:instructions')) || '');
  const [showSource, setShowSource] = useState(false);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [itemsPerPageDefault, setItemsPerPageDefault] = useState(48);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editQrUrl, setEditQrUrl] = useState('');
  const [editStats, setEditStats] = useState(null);
  const [, setPhotoServeEpoch] = useState(0);
  const formRef = useRef(null);
  const photoInputRef = useRef(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const lastSelectedIdRef = useRef(null);

  const load = useCallback((signal) => {
    setLoading(true);
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (debouncedSearch) params.search_mode = searchMode;
    if (selectedCategory) params.category = selectedCategory;
    if (selectedType) params.item_type = selectedType;
    api.getItems(params, { signal, dedupeKey: 'inventory:list', cancelPrevious: true })
      .then((d) => {
        setItems(Array.isArray(d?.items) ? d.items : []);
      })
      .catch((err) => {
        if (!isAbortError(err)) console.error('[InventoryPage] Failed to load items:', err?.message || err);
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [debouncedSearch, searchMode, selectedCategory, selectedType]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    api.getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    api.getSettings().then(s => {
      setShowSource((s.inventory_show_source || '0') === '1');
      setMultiSelectEnabled((s.inventory_multi_select_enabled || '0') === '1');
      setItemsPerPageDefault(Math.max(24, parseInt(s.inventory_items_per_page || '48', 10) || 48));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  useEffect(() => {
    if (multiSelectEnabled) return;
    lastSelectedIdRef.current = null;
    setSelectedIds([]);
  }, [multiSelectEnabled]);

  const filteredItems = useMemo(() => {
    const nextItems = items.filter((item) => itemMatchesInventorySearch(item, debouncedSearch, searchMode));
    if (!debouncedSearch) return nextItems;
    return [...nextItems].sort((a, b) => {
      const scoreDiff = scoreInventorySearchMatch(b, debouncedSearch, searchMode) - scoreInventorySearchMatch(a, debouncedSearch, searchMode);
      if (scoreDiff !== 0) return scoreDiff;
      const titleLengthDiff = String(a?.title || '').length - String(b?.title || '').length;
      if (titleLengthDiff !== 0) return titleLengthDiff;
      return String(a?.title || '').localeCompare(String(b?.title || ''));
    });
  }, [items, debouncedSearch, searchMode]);

  useEffect(() => {
    if (!items.length) return;
    const ids = items
      .map((i) => i.photo_url)
      .filter((p) => p != null && /^\d+$/.test(String(p).trim()))
      .map((p) => String(p).trim());
    api.prefetchFileServeUrls(ids).catch(() => {});
  }, [items]);

  useEffect(() => {
    const pid = form.photo_url?.trim();
    if (!pid || !/^\d+$/.test(pid)) return;
    api.prefetchFileServeUrls([pid]).then(() => setPhotoServeEpoch((e) => e + 1)).catch(() => {});
  }, [form.photo_url]);

  useEffect(() => {
    if (!editingItem) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setEditingItem(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingItem]);

  useEffect(() => {
    if (!editingItem?.scan_code) {
      setEditQrUrl('');
      return undefined;
    }
    let cancelled = false;
    const itemScanHref = `${window.location.origin}/scan/${encodeURIComponent(editingItem.scan_code)}`;
    api.getBarcodeSvgData({
      format: 'qrcode',
      value: itemScanHref,
      label: editingItem.scan_code,
    }).then((data) => {
      if (cancelled) return;
      const svg = String(data?.svg || '');
      setEditQrUrl(svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '');
    }).catch(() => {
      if (!cancelled) setEditQrUrl('');
    });
    return () => {
      cancelled = true;
    };
  }, [editingItem?.scan_code]);

  useEffect(() => {
    if (batchEditingDescriptions) return undefined;
    if (!showAiBatchConfigurator && aiBatchProgress.total === 0) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setAiBatchProgress(EMPTY_AI_BATCH_PROGRESS);
        setShowAiBatchConfigurator(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [aiBatchProgress.total, batchEditingDescriptions, showAiBatchConfigurator]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('inventory-ai:style', aiStylePreset);
  }, [aiStylePreset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('inventory-ai:persona', aiPersonaPreset);
  }, [aiPersonaPreset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('inventory-ai:variation', aiVariationLevel);
  }, [aiVariationLevel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('inventory-ai:instructions', aiCustomInstructions);
  }, [aiCustomInstructions]);

  const loadAccessories = useCallback((itemId) => {
    if (!itemId) return;
    api.getItemAccessories(itemId).then(d => setAccessories(d.items || [])).catch(() => {});
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const result = await api.uploadFiles(formData);
      const uploaded = result.files?.[0];
      if (uploaded?.id) {
        setForm(f => ({ ...f, photo_url: String(uploaded.id) }));
        api.prefetchFileServeUrls([String(uploaded.id)]).catch(() => {});
        toast.success('Photo uploaded');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const searchAccessories = useCallback(async (q) => {
    if (!q.trim()) { setAccessoryResults([]); return; }
    try {
      const d = await api.getItems({ search: q }, { dedupeKey: 'inventory:accessory-search', cancelPrevious: true });
      setAccessoryResults((d.items || []).filter(i => !i.hidden));
    } catch (err) {
      if (!isAbortError(err)) setAccessoryResults([]);
    }
  }, []);

  const applyItemToForm = useCallback((item) => {
    setForm({
      title: item.title,
      photo_url: item.photo_url || '',
      hidden: !!item.hidden,
      unit_price: item.unit_price != null ? String(item.unit_price) : '',
      quantity_in_stock: item.quantity_in_stock != null ? String(item.quantity_in_stock) : '',
      category: item.category || '',
      description: item.description || '',
      internal_notes: item.internal_notes || '',
      serial_number: item.serial_number || '',
      taxable: item.taxable !== 0,
      item_type: item.item_type || 'product',
      is_subrental: !!item.is_subrental
    });
  }, []);

  const handleEdit = (item) => {
    setEditingItem(item);
    setEditStats(item.stats || null);
    setAccessories([]);
    setAccessorySearch('');
    setAccessoryResults([]);
    loadAccessories(item.id);
    applyItemToForm(item);
    setShowAdd(false);
    api.getItem(item.id).then((detail) => {
      setEditingItem((current) => (current && current.id === item.id ? detail : current));
      setEditStats(detail?.stats || null);
      applyItemToForm(detail);
    }).catch(() => {});
  };

  const handleCloseEdit = () => {
    setEditingItem(null);
    setEditStats(null);
    setAccessories([]);
    setAccessorySearch('');
    setAccessoryResults([]);
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        photo_url: form.photo_url || null,
        hidden: (form.hidden || form.item_type === 'accessory') ? 1 : 0,
        unit_price: form.unit_price !== '' ? parseFloat(form.unit_price) : 0,
        quantity_in_stock: form.quantity_in_stock !== '' ? parseInt(form.quantity_in_stock, 10) : 0,
        category: form.category || null,
        description: form.description || null,
        internal_notes: form.internal_notes || null,
        serial_number: form.serial_number || null,
        taxable: form.taxable ? 1 : 0,
        item_type: form.item_type || 'product',
        is_subrental: form.is_subrental ? 1 : 0
      };
      if (editingItem) {
        await api.updateItem(editingItem.id, payload);
        toast.success('Item updated');
        setEditingItem(null);
      } else {
        await api.createItem({ ...payload, source: 'manual' });
        toast.success('Item created');
        setShowAdd(false);
      }
      setForm(EMPTY_FORM);
      load();
      api.getCategories().then(d => setCategories(d.categories || [])).catch(() => {});
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!form.title.trim()) {
      toast.error('Add an item title before generating a description');
      return;
    }
    setGeneratingDescription(true);
    try {
      const result = await api.generateItemDescriptionPreview({
        item_id: editingItem ? editingItem.id : null,
        title: form.title,
        photo_url: form.photo_url || null,
        source: editingItem?.source || 'manual',
        hidden: form.hidden ? 1 : 0,
        unit_price: form.unit_price !== '' ? parseFloat(form.unit_price) : 0,
        quantity_in_stock: form.quantity_in_stock !== '' ? parseInt(form.quantity_in_stock, 10) : 0,
        category: form.category || null,
        description: form.description || null,
        internal_notes: form.internal_notes || null,
        taxable: form.taxable ? 1 : 0,
        item_type: form.item_type || 'product',
        is_subrental: form.is_subrental ? 1 : 0,
        style_preset: aiStylePreset,
        persona_preset: aiPersonaPreset,
        variation_level: aiVariationLevel,
        custom_instructions: aiCustomInstructions,
      });
      setForm((current) => ({ ...current, description: result.description || '' }));
      toast.success(`Description drafted with ${result.provider} (${result.model})`);
      if (Array.isArray(result.warnings) && result.warnings.length > 0) {
        toast.info(result.warnings[0]);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteItem(confirmDelete.id);
      toast.info(`Deleted ${confirmDelete.title}`);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleToggleSelect = useCallback((item, options = {}) => {
    if (!item?.id || !multiSelectEnabled) return;
    const scopeItems = Array.isArray(options.visibleItems)
      ? options.visibleItems.filter((entry) => (entry.item_type || 'product') === 'product')
      : [];
    const anchorId = lastSelectedIdRef.current;
    const shouldSelectRange = Boolean(options.shiftKey) && anchorId;

    setSelectedIds((current) => {
      if (shouldSelectRange) {
        const anchorIndex = scopeItems.findIndex((entry) => entry.id === anchorId);
        const targetIndex = scopeItems.findIndex((entry) => entry.id === item.id);
        if (anchorIndex !== -1 && targetIndex !== -1 && anchorIndex !== targetIndex) {
          const [start, end] = anchorIndex < targetIndex
            ? [anchorIndex, targetIndex]
            : [targetIndex, anchorIndex];
          const next = new Set(current);
          scopeItems.slice(start, end + 1).forEach((entry) => next.add(entry.id));
          return Array.from(next);
        }
      }

      return current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id];
    });

    lastSelectedIdRef.current = item.id;
  }, [multiSelectEnabled]);

  const getSelectedBatchItems = useCallback(() => {
    if (!multiSelectEnabled) {
      toast.error('Enable inventory multi-select in Inventory Settings first');
      return [];
    }
    const selectedItems = items.filter((item) => selectedIds.includes(item.id) && (showHidden || !item.hidden));
    if (!selectedItems.length) {
      toast.error('Select at least one inventory item first');
      return [];
    }
    return selectedItems;
  }, [items, multiSelectEnabled, selectedIds, showHidden, toast]);

  const runBatchAiEdit = useCallback(async (selectedItems, controlOverrides = null) => {
    const activeControls = {
      stylePreset: controlOverrides?.stylePreset || aiStylePreset,
      personaPreset: controlOverrides?.personaPreset || aiPersonaPreset,
      variationLevel: controlOverrides?.variationLevel || aiVariationLevel,
      customInstructions: controlOverrides?.customInstructions || aiCustomInstructions,
    };
    setBatchEditingDescriptions(true);
    setShowAiBatchConfigurator(false);
    setAiBatchProgress({
      total: selectedItems.length,
      completed: 0,
      currentIndex: 0,
      currentItemTitle: '',
      currentStage: 'Preparing selected products…',
      controls: activeControls,
      successes: [],
      failures: [],
    });
    let successCount = 0;
    const failures = [];

    try {
      for (let index = 0; index < selectedItems.length; index += 1) {
        const item = selectedItems[index];
        try {
          const originalPayload = {
            title: item.title,
            photo_url: item.photo_url || null,
            hidden: item.hidden ? 1 : 0,
            unit_price: item.unit_price != null ? Number(item.unit_price) : 0,
            quantity_in_stock: item.quantity_in_stock != null ? Number(item.quantity_in_stock) : 0,
            category: item.category || null,
            description: item.description || null,
            internal_notes: item.internal_notes || null,
            taxable: item.taxable ? 1 : 0,
            item_type: item.item_type || 'product',
            is_subrental: item.is_subrental ? 1 : 0,
          };

          setAiBatchProgress((current) => ({
            ...current,
            currentIndex: index + 1,
            currentItemTitle: item.title,
            currentStage: 'Generating draft description…',
          }));

          const result = await api.generateItemDescriptionPreview({
            item_id: item.id,
            title: item.title,
            photo_url: item.photo_url || null,
            source: item.source || 'manual',
            hidden: item.hidden ? 1 : 0,
            unit_price: item.unit_price != null ? Number(item.unit_price) : 0,
            quantity_in_stock: item.quantity_in_stock != null ? Number(item.quantity_in_stock) : 0,
            category: item.category || null,
            description: item.description || null,
            internal_notes: item.internal_notes || null,
            taxable: item.taxable ? 1 : 0,
            item_type: item.item_type || 'product',
            is_subrental: item.is_subrental ? 1 : 0,
            style_preset: activeControls.stylePreset,
            persona_preset: activeControls.personaPreset,
            variation_level: activeControls.variationLevel,
            custom_instructions: activeControls.customInstructions,
          });

          setAiBatchProgress((current) => ({
            ...current,
            currentIndex: index + 1,
            currentItemTitle: item.title,
            currentStage: 'Saving AI edits to inventory…',
          }));

          await api.updateItem(item.id, {
            ...originalPayload,
            description: result.description || item.description || null,
          });
          successCount += 1;
          setAiBatchProgress((current) => ({
            ...current,
            completed: index + 1,
            successes: [...current.successes, {
              id: item.id,
              title: item.title,
              provider: result.provider || 'AI',
              model: result.model || '',
              controls: result.controls || {
                stylePreset: activeControls.stylePreset,
                personaPreset: activeControls.personaPreset,
                variationLevel: activeControls.variationLevel,
                customInstructions: activeControls.customInstructions,
              },
              originalPayload,
              beforeDescription: item.description || '',
              afterDescription: result.description || item.description || '',
              reverted: false,
            }],
            currentStage: index + 1 === selectedItems.length ? 'Wrapping up batch…' : 'Moving to next product…',
          }));
        } catch (error) {
          failures.push(`${item.title}: ${error.message}`);
          setAiBatchProgress((current) => ({
            ...current,
            completed: index + 1,
            failures: [...current.failures, {
              id: item.id,
              title: item.title,
              message: error.message,
            }],
            currentStage: index + 1 === selectedItems.length ? 'Wrapping up batch…' : 'Continuing after an error…',
          }));
        }
      }

      if (successCount > 0) {
        toast.success(`AI updated ${successCount} item${successCount === 1 ? '' : 's'}`);
      }
      if (failures.length > 0) {
        toast.error(failures[0]);
      }
      setSelectedIds([]);
      load();
    } finally {
      setAiBatchProgress((current) => ({
        ...current,
        completed: current.total,
        currentIndex: current.total,
        currentItemTitle: '',
        currentStage: failures.length > 0 ? 'Finished with some errors.' : 'Finished.',
      }));
      setBatchEditingDescriptions(false);
    }
  }, [aiCustomInstructions, aiPersonaPreset, aiStylePreset, aiVariationLevel, load, toast]);

  const handleBatchAiEdit = useCallback(async () => {
    const selectedItems = getSelectedBatchItems();
    if (!selectedItems.length) return;
    await runBatchAiEdit(selectedItems);
  }, [getSelectedBatchItems, runBatchAiEdit]);

  const handleOpenAiBatchConfigurator = useCallback(() => {
    const selectedItems = getSelectedBatchItems();
    if (!selectedItems.length) return;
    setShowAiBatchConfigurator(true);
  }, [getSelectedBatchItems]);

  const handleRedoBatchPrompt = useCallback(() => {
    const selectedItems = getSelectedBatchItems();
    if (!selectedItems.length) return;
    const lastControls = aiBatchProgress.controls || {};
    setAiStylePreset(lastControls.stylePreset || aiStylePreset);
    setAiPersonaPreset(lastControls.personaPreset || aiPersonaPreset);
    setAiVariationLevel(lastControls.variationLevel || aiVariationLevel);
    setAiCustomInstructions(lastControls.customInstructions || '');
    setShowAiBatchConfigurator(true);
  }, [
    aiBatchProgress.controls,
    aiCustomInstructions,
    aiPersonaPreset,
    aiStylePreset,
    aiVariationLevel,
    getSelectedBatchItems,
  ]);

  const handleRerunBatchAiEdit = useCallback(async () => {
    const selectedItems = getSelectedBatchItems();
    if (!selectedItems.length) return;
    const lastControls = aiBatchProgress.controls || {};
    setAiStylePreset(lastControls.stylePreset || aiStylePreset);
    setAiPersonaPreset(lastControls.personaPreset || aiPersonaPreset);
    setAiVariationLevel(lastControls.variationLevel || aiVariationLevel);
    setAiCustomInstructions(lastControls.customInstructions || '');
    await runBatchAiEdit(selectedItems, lastControls);
  }, [
    aiBatchProgress.controls,
    aiCustomInstructions,
    aiPersonaPreset,
    aiStylePreset,
    aiVariationLevel,
    getSelectedBatchItems,
    runBatchAiEdit,
  ]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!(e.ctrlKey && e.altKey && String(e.key || '').toLowerCase() === 'a')) return;
      if (batchEditingDescriptions || generatingDescription) return;

      const hasOpenEditor = Boolean(editingItem || showAdd);
      const hasSelection = selectedIds.length > 0;
      if (!hasOpenEditor && !hasSelection) return;

      e.preventDefault();
      if (hasOpenEditor) {
        handleGenerateDescription();
        return;
      }
      handleOpenAiBatchConfigurator();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    batchEditingDescriptions,
    editingItem,
    generatingDescription,
    selectedIds.length,
    showAdd,
    handleGenerateDescription,
    handleOpenAiBatchConfigurator,
  ]);

  const handleRevertBatchChange = useCallback(async (entry) => {
    if (!entry?.id || !entry.originalPayload) return;
    setRevertingBatchIds((current) => [...current, entry.id]);
    try {
      await api.updateItem(entry.id, entry.originalPayload);
      setItems((current) => current.map((item) => (
        item.id === entry.id
          ? {
              ...item,
              ...entry.originalPayload,
              hidden: !!entry.originalPayload.hidden,
              taxable: !!entry.originalPayload.taxable,
              is_subrental: !!entry.originalPayload.is_subrental,
            }
          : item
      )));
      setAiBatchProgress((current) => ({
        ...current,
        successes: current.successes.map((success) => (
          success.id === entry.id
            ? { ...success, reverted: true }
            : success
        )),
      }));
      toast.success(`Reverted AI changes for ${entry.title}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRevertingBatchIds((current) => current.filter((id) => id !== entry.id));
    }
  }, [toast]);

  const navBtnBase = 'px-3.5 py-1 text-[13px] border border-border rounded-full bg-bg text-text-muted cursor-pointer hover:bg-surface hover:text-text hover:border-primary transition-colors whitespace-nowrap';
  const navBtnActive = 'px-3.5 py-1 text-[13px] border rounded-full cursor-pointer whitespace-nowrap bg-primary border-primary text-white';
  const aiBatchPercent = aiBatchProgress.total > 0
    ? Math.max(6, Math.round((aiBatchProgress.completed / aiBatchProgress.total) * 100))
    : 0;
  const canDismissAiBatchModal = !batchEditingDescriptions;
  const showAiBatchModal = showAiBatchConfigurator || batchEditingDescriptions || aiBatchProgress.total > 0;

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-[13px] text-text-muted mt-0.5">{items.length} items</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[13px] text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={e => setShowHidden(e.target.checked)}
            />
            Show hidden
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={batchEditingDescriptions || selectedIds.length === 0}
            onClick={handleBatchAiEdit}
            title={multiSelectEnabled ? 'Run AI description updates for selected items' : 'Enable inventory multi-select in settings first'}
          >
            {batchEditingDescriptions
              ? 'AI Editing…'
              : selectedIds.length > 0
                ? `AI Edit (${selectedIds.length})`
                : 'AI Edit'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={batchEditingDescriptions || selectedIds.length === 0}
            onClick={handleOpenAiBatchConfigurator}
            title="Adjust writing controls before starting the AI edit batch"
          >
            Edit
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { setShowAdd(true); setEditingItem(null); setForm(EMPTY_FORM); }}>
            + Add Item
          </button>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5 py-1">
        {[null, 'product', 'group', 'accessory'].map(t => (
          <button
            key={t ?? 'all'}
            type="button"
            className={selectedType === t ? navBtnActive : navBtnBase}
            onClick={() => setSelectedType(t)}
          >
            {t === null ? 'All types' : t === 'product' ? 'Products' : t === 'group' ? 'Groups' : 'Accessories'}
          </button>
        ))}
      </div>

      {/* Category navbar */}
      {categories.length > 0 && (() => {
        const MAX_CAT = 6;
        const visible = catsExpanded ? categories : categories.slice(0, MAX_CAT);
        const hasMore = categories.length > MAX_CAT;
        return (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={!selectedCategory ? navBtnActive : navBtnBase}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </button>
            {visible.map(cat => (
              <button
                key={cat}
                type="button"
                className={selectedCategory === cat ? navBtnActive : navBtnBase}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              >
                {cat}
              </button>
            ))}
            {hasMore && !catsExpanded && (
              <button type="button" className={navBtnBase} onClick={() => setCatsExpanded(true)}>
                +{categories.length - MAX_CAT} more…
              </button>
            )}
            {hasMore && catsExpanded && (
              <button type="button" className={navBtnBase} onClick={() => setCatsExpanded(false)}>
                Show less
              </button>
            )}
          </div>
        );
      })()}

      {/* Search */}
      <div className="flex gap-2.5 items-center flex-wrap">
        <div className="relative flex flex-1 min-w-[180px] items-center">
          <svg className="absolute left-2.5 text-text-muted pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="flex-1 min-w-[180px] pl-9 pr-3 py-2 border border-border rounded-lg text-[14px] bg-bg text-text focus:outline-none focus:border-primary shadow-sm transition-colors"
            placeholder="Search items…"
            aria-label="Search items"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="min-w-[112px] px-3 py-2 border border-border rounded-lg text-[14px] bg-bg text-text focus:outline-none focus:border-primary shadow-sm transition-colors"
          aria-label="Search mode"
          value={searchMode}
          onChange={e => setSearchMode(e.target.value)}
        >
          <option value="loose">Loose</option>
          <option value="exact">Exact</option>
        </select>
      </div>

      {/* Add / Edit Form */}
      {showAdd && (
        <div ref={formRef} className="card p-5">
          <h3 className="text-[15px] font-bold mb-3.5">Add Item</h3>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex gap-3 flex-wrap [&>*]:flex-1 [&>*]:min-w-[140px]">
              <div className="form-group">
                <label htmlFor="inv-title">Title *</label>
                <input
                  id="inv-title"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Chiavari Chair — Gold"
                />
              </div>
              <div className="form-group">
                <label htmlFor="inv-category">Category</label>
                <input
                  id="inv-category"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Chairs"
                  list="category-list"
                />
                <datalist id="category-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="inv-type">Item type</label>
              <select
                id="inv-type"
                value={form.item_type}
                onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))}
              >
                <option value="product">Product — standard rentable item</option>
                <option value="group">Group — package of multiple items</option>
                <option value="accessory">Accessory — hidden sub-item / add-on</option>
              </select>
            </div>
            <div className="flex gap-3 flex-wrap [&>*]:flex-1 [&>*]:min-w-[140px]">
              <div className="form-group">
                <label htmlFor="inv-price">Unit Price ($)</label>
                <input
                  id="inv-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unit_price}
                  onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label htmlFor="inv-qty">Qty in Stock</label>
                <input
                  id="inv-qty"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity_in_stock}
                  onChange={e => setForm(f => ({ ...f, quantity_in_stock: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="inv-photo">Photo</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id="inv-photo"
                  className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-border rounded-md text-[13px] bg-bg text-text"
                  value={form.photo_url}
                  onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))}
                  placeholder="https://… or upload below"
                />
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoUpload}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={uploadingPhoto}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {uploadingPhoto ? 'Uploading…' : 'Upload Photo'}
                </button>
                {form.photo_url && /^\d+$/.test(form.photo_url.trim()) && (
                  <img
                    src={api.fileServeUrl(form.photo_url.trim(), { variant: 'ui' })}
                    alt="preview"
                    className="w-12 h-12 object-cover rounded-md border border-border shrink-0"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="inv-notes">Internal Notes</label>
              <textarea
                id="inv-notes"
                rows={2}
                value={form.internal_notes}
                onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                placeholder="Private merchandising notes for AI and staff only…"
              />
            </div>
            <div className="form-group">
              <label htmlFor="inv-desc">Description</label>
              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                <span className="text-[12px] text-text-muted">Client-facing product copy</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={generatingDescription || !form.title.trim()}
                  onClick={handleGenerateDescription}
                >
                  {generatingDescription ? 'Writing…' : 'AI Write Description'}
                </button>
              </div>
              <div className={styles.aiInlineControls}>
                <label className={styles.aiInlineControl}>
                  <span>Style</span>
                  <select value={aiStylePreset} onChange={(e) => setAiStylePreset(e.target.value)}>
                    {DESCRIPTION_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.aiInlineControl}>
                  <span>Persona</span>
                  <select value={aiPersonaPreset} onChange={(e) => setAiPersonaPreset(e.target.value)}>
                    {DESCRIPTION_PERSONA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.aiInlineControl}>
                  <span>Variation</span>
                  <select value={aiVariationLevel} onChange={(e) => setAiVariationLevel(e.target.value)}>
                    {DESCRIPTION_VARIATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <textarea
                id="inv-desc"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description…"
              />
            </div>
            <div className="flex gap-5 flex-wrap">
              <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hidden}
                  onChange={e => setForm(f => ({ ...f, hidden: e.target.checked }))}
                />
                Hidden (sub-item / accessory)
              </label>
              <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.taxable}
                  onChange={e => setForm(f => ({ ...f, taxable: e.target.checked }))}
                />
                Taxable
              </label>
              <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_subrental}
                  onChange={e => setForm(f => ({ ...f, is_subrental: e.target.checked }))}
                />
                Subrental
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAdd(false); setEditingItem(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ItemGrid
        items={filteredItems}
        loading={loading}
        showHidden={showHidden}
        showSource={showSource}
        onEdit={handleEdit}
        onDelete={setConfirmDelete}
        searchQuery={search}
        onClearSearch={() => setSearch('')}
        multiSelectEnabled={multiSelectEnabled}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onClearSelection={() => {
          lastSelectedIdRef.current = null;
          setSelectedIds([]);
        }}
        enableVirtualization={false}
        defaultPageSize={itemsPerPageDefault}
        preferenceKey="inventory-grid"
      />

      {showAiBatchModal && (
        <>
          <div
            className={styles.aiBatchBackdrop}
            onClick={() => {
              if (canDismissAiBatchModal) {
                setAiBatchProgress(EMPTY_AI_BATCH_PROGRESS);
                setShowAiBatchConfigurator(false);
              }
            }}
            aria-hidden="true"
          />
          <section
            className={styles.aiBatchModal}
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            aria-busy={batchEditingDescriptions}
            aria-label={showAiBatchConfigurator && !batchEditingDescriptions && aiBatchProgress.total === 0 ? 'Configure inventory AI batch' : (batchEditingDescriptions ? 'AI editing product descriptions' : 'Last AI batch')}
          >
            <div className={styles.aiBatchHeader}>
              <div className={styles.aiBatchHeaderCopy}>
                <div className={styles.aiBatchEyebrow}>Inventory AI</div>
                <h3 className={styles.aiBatchTitle}>
                  {showAiBatchConfigurator && !batchEditingDescriptions && aiBatchProgress.total === 0
                    ? 'Prepare AI edit'
                    : batchEditingDescriptions
                      ? 'AI editing product descriptions'
                      : 'Last AI batch'}
                </h3>
                <p className={styles.aiBatchSubtitle}>
                  {showAiBatchConfigurator && !batchEditingDescriptions && aiBatchProgress.total === 0
                    ? 'Choose the writing voice before starting this batch. Use AI Edit directly anytime to run with your saved defaults.'
                    : batchEditingDescriptions
                      ? 'BadShuffle is drafting and saving product copy right now.'
                      : 'Review the completed changes, compare the copy, or revert individual edits.'}
                </p>
              </div>
              <div className={styles.aiBatchHeaderActions}>
                <span className={`${styles.aiBatchStatusPill} ${batchEditingDescriptions ? styles.aiBatchStatusActive : styles.aiBatchStatusIdle}`}>
                  {showAiBatchConfigurator && !batchEditingDescriptions && aiBatchProgress.total === 0
                    ? 'Setup'
                    : batchEditingDescriptions
                      ? 'In progress'
                      : 'Complete'}
                </span>
                {canDismissAiBatchModal && (
                  <>
                    {!showAiBatchConfigurator && aiBatchProgress.total > 0 && (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={handleRedoBatchPrompt}
                        >
                          Redo Prompt
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleRerunBatchAiEdit}
                        >
                          Run Again
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setAiBatchProgress(EMPTY_AI_BATCH_PROGRESS);
                        setShowAiBatchConfigurator(false);
                      }}
                    >
                      {showAiBatchConfigurator && aiBatchProgress.total === 0 ? 'Cancel' : 'Close'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className={styles.aiBatchBody}>
              <div className={styles.aiBatchControlsCard}>
                <div className={styles.aiBatchControlsHeader}>
                  <div>
                    <div className={styles.aiBatchColumnTitle}>Writing controls</div>
                    <p className={styles.aiBatchControlsHint}>Tune tone and variation before starting a batch. These settings also apply to single-product AI writes.</p>
                  </div>
                </div>
                <div className={styles.aiBatchControlsGrid}>
                  <label className={styles.aiBatchControl}>
                    <span>Style</span>
                    <select value={aiStylePreset} onChange={(e) => setAiStylePreset(e.target.value)} disabled={batchEditingDescriptions}>
                      {DESCRIPTION_STYLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.aiBatchControl}>
                    <span>Persona</span>
                    <select value={aiPersonaPreset} onChange={(e) => setAiPersonaPreset(e.target.value)} disabled={batchEditingDescriptions}>
                      {DESCRIPTION_PERSONA_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.aiBatchControl}>
                    <span>Variation</span>
                    <select value={aiVariationLevel} onChange={(e) => setAiVariationLevel(e.target.value)} disabled={batchEditingDescriptions}>
                      {DESCRIPTION_VARIATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={styles.aiBatchTextareaControl}>
                  <span>Extra guidance</span>
                  <textarea
                    rows={2}
                    value={aiCustomInstructions}
                    onChange={(e) => setAiCustomInstructions(e.target.value)}
                    placeholder="Optional direction like: emphasize elegance, avoid mentioning price, keep it airy and visual."
                    disabled={batchEditingDescriptions}
                  />
                </label>
                {showAiBatchConfigurator && !batchEditingDescriptions && aiBatchProgress.total === 0 && (
                  <div className={styles.aiBatchConfiguratorActions}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowAiBatchConfigurator(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        const selectedItems = getSelectedBatchItems();
                        if (!selectedItems.length) return;
                        runBatchAiEdit(selectedItems);
                      }}
                    >
                      Start AI Edit
                    </button>
                  </div>
                )}
              </div>

              {(!showAiBatchConfigurator || batchEditingDescriptions || aiBatchProgress.total > 0) && (
                <>
                  <div className={styles.aiBatchSummary}>
                    <div className={styles.aiBatchMetric}>
                      <span className={styles.aiBatchMetricLabel}>Progress</span>
                      <strong>{aiBatchProgress.completed} / {aiBatchProgress.total}</strong>
                    </div>
                    <div className={styles.aiBatchMetric}>
                      <span className={styles.aiBatchMetricLabel}>Succeeded</span>
                      <strong>{aiBatchProgress.successes.length}</strong>
                    </div>
                    <div className={styles.aiBatchMetric}>
                      <span className={styles.aiBatchMetricLabel}>Failed</span>
                      <strong>{aiBatchProgress.failures.length}</strong>
                    </div>
                  </div>
                  <div className={styles.aiBatchProgressCard}>
                    <div className={styles.aiBatchProgressTop}>
                      <div className={styles.aiBatchNow}>
                        <div className={styles.aiBatchStage}>{aiBatchProgress.currentStage || 'Waiting to begin…'}</div>
                        <div className={styles.aiBatchCurrentItem}>
                          {aiBatchProgress.currentItemTitle
                            ? `Current product: ${aiBatchProgress.currentItemTitle}`
                            : batchEditingDescriptions
                              ? 'Starting AI workflow…'
                              : 'Batch complete.'}
                        </div>
                      </div>
                      <span className={styles.aiBatchPercent}>{aiBatchPercent}%</span>
                    </div>

                    <div className={styles.aiBatchBarWrap} aria-hidden="true">
                      <div className={styles.aiBatchBar} style={{ width: `${aiBatchPercent}%` }} />
                    </div>

                    <div className={styles.aiBatchSteps}>
                      <div className={`${styles.aiBatchStep} ${aiBatchProgress.currentIndex > 0 ? styles.aiBatchStepDone : ''}`}>
                        1. Read product details and current description
                      </div>
                      <div className={`${styles.aiBatchStep} ${aiBatchProgress.currentStage.includes('Saving') || aiBatchProgress.completed > 0 ? styles.aiBatchStepDone : ''}`}>
                        2. Generate a new AI draft
                      </div>
                      <div className={`${styles.aiBatchStep} ${aiBatchProgress.completed > 0 ? styles.aiBatchStepDone : ''}`}>
                        3. Save the updated description back to inventory
                      </div>
                    </div>
                  </div>

                  <div className={styles.aiBatchColumn}>
                    <div className={styles.aiBatchColumnTitle}>Updated Products</div>
                    {aiBatchProgress.successes.length > 0 ? (
                      <div className={styles.aiBatchResultsList}>
                        {aiBatchProgress.successes.map((entry) => (
                          <div key={`success-${entry.id}`} className={styles.aiBatchListItem}>
                            <div className={styles.aiBatchItemHeader}>
                              <div className={styles.aiBatchItemTitleWrap}>
                                <strong>{entry.title}</strong>
                                <span>{entry.provider}{entry.model ? ` (${entry.model})` : ''}</span>
                              </div>
                              <div className={styles.aiBatchItemMeta}>
                                <span className={styles.aiBatchMetaPill}>{entry.controls?.stylePreset || aiStylePreset}</span>
                                <span className={styles.aiBatchMetaPill}>{entry.controls?.personaPreset || aiPersonaPreset}</span>
                                <span className={styles.aiBatchMetaPill}>{entry.controls?.variationLevel || aiVariationLevel}</span>
                                {entry.reverted && (
                                  <span className={styles.aiBatchRevertedPill}>Reverted</span>
                                )}
                              </div>
                            </div>
                            <div className={styles.aiBatchDiff}>
                              <div className={styles.aiBatchDiffBlock}>
                                <span className={styles.aiBatchDiffLabel}>Before</span>
                                <p>{entry.beforeDescription || 'No previous description.'}</p>
                              </div>
                              <div className={styles.aiBatchDiffBlock}>
                                <span className={styles.aiBatchDiffLabel}>After</span>
                                <p>{entry.afterDescription || 'No AI description returned.'}</p>
                              </div>
                            </div>
                            <div className={styles.aiBatchActions}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={batchEditingDescriptions || entry.reverted || revertingBatchIds.includes(entry.id)}
                                onClick={() => handleRevertBatchChange(entry)}
                              >
                                {entry.reverted
                                  ? 'Reverted'
                                  : revertingBatchIds.includes(entry.id)
                                    ? 'Reverting…'
                                    : 'Revert change'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.aiBatchEmpty}>No products updated yet.</div>
                    )}
                  </div>

                  <div className={styles.aiBatchIssuesFooter}>
                    <div className={styles.aiBatchColumnTitle}>Issues</div>
                    {aiBatchProgress.failures.length > 0 ? (
                      <div className={styles.aiBatchIssuesList}>
                        {aiBatchProgress.failures.map((entry) => (
                          <div key={`failure-${entry.id}`} className={styles.aiBatchIssueItem}>
                            <strong>{entry.title}</strong>
                            <span>{entry.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.aiBatchEmpty}>
                        {batchEditingDescriptions ? 'No issues so far.' : 'No issues in the last run.'}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      )}

      {editingItem && (
        <>
          <div className={styles.drawerBackdrop} onClick={handleCloseEdit} aria-hidden="true" />
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Edit ${editingItem.title}`}>
            <div className={styles.drawerHeader}>
              <div>
                <div className={styles.drawerEyebrow}>Inventory</div>
                <h3 className={styles.drawerTitle}>Edit Item</h3>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleCloseEdit}>
                Close
              </button>
            </div>

            <div className={styles.drawerBody}>
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div className="flex gap-3 flex-wrap [&>*]:flex-1 [&>*]:min-w-[140px]">
                  <div className="form-group">
                    <label htmlFor="inv-edit-title">Title *</label>
                    <input
                      id="inv-edit-title"
                      required
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Chiavari Chair — Gold"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="inv-edit-category">Category</label>
                    <input
                      id="inv-edit-category"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Chairs"
                      list="category-list"
                    />
                    <datalist id="category-list">
                      {categories.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>
                </div>

                <div className={styles.identityCard}>
                  <div className={styles.identityHeader}>
                    <div>
                      <div className={styles.identityEyebrow}>Identity</div>
                      <div className={styles.identityTitle}>Internal Product Code</div>
                    </div>
                    {editingItem?.scan_code ? <span className="badge">{editingItem.scan_code}</span> : null}
                  </div>
                  <div className={styles.identityGrid}>
                    <div className={styles.identityFields}>
                      <div className="form-group">
                        <label htmlFor="inv-edit-serial">Serial Number</label>
                        <input
                          id="inv-edit-serial"
                          value={form.serial_number}
                          onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                          placeholder="e.g. TENT-12X12-001"
                        />
                      </div>
                      <div className="form-group">
                        <label>Scan Code</label>
                        <input value={editingItem?.scan_code || 'Generating…'} readOnly />
                      </div>
                      <div className={styles.identityStats}>
                        <div className={styles.identityStat}>
                          <span>Sales</span>
                          <strong>${Number(editStats?.sales_total || 0).toFixed(2)}</strong>
                        </div>
                        <div className={styles.identityStat}>
                          <span>Quoted</span>
                          <strong>{Number(editStats?.times_quoted || 0)}</strong>
                        </div>
                        <div className={styles.identityStat}>
                          <span>Last used</span>
                          <strong>{editStats?.last_used_at ? String(editStats.last_used_at).slice(0, 10) : 'Never'}</strong>
                        </div>
                      </div>
                      <div className={styles.identityActions}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={!editingItem?.scan_code}
                          onClick={async () => {
                            if (!editingItem?.scan_code) return;
                            try {
                              await navigator.clipboard.writeText(`${window.location.origin}/scan/${encodeURIComponent(editingItem.scan_code)}`);
                              toast.success('Product scan link copied');
                            } catch {
                              toast.error('Unable to copy scan link');
                            }
                          }}
                        >
                          Copy Link
                        </button>
                        <a
                          className="btn btn-ghost btn-sm"
                          href={editQrUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          aria-disabled={!editQrUrl}
                          onClick={(e) => {
                            if (!editQrUrl) e.preventDefault();
                          }}
                        >
                          Open QR
                        </a>
                      </div>
                    </div>
                    <div className={styles.identityPreview}>
                      {editQrUrl ? (
                        <img src={editQrUrl} alt={`QR code for ${editingItem?.title || 'product'}`} />
                      ) : (
                        <div className={styles.identityPreviewFallback}>QR unavailable</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="inv-edit-type">Item type</label>
                  <select
                    id="inv-edit-type"
                    value={form.item_type}
                    onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))}
                  >
                    <option value="product">Product — standard rentable item</option>
                    <option value="group">Group — package of multiple items</option>
                    <option value="accessory">Accessory — hidden sub-item / add-on</option>
                  </select>
                </div>

                <div className="flex gap-3 flex-wrap [&>*]:flex-1 [&>*]:min-w-[140px]">
                  <div className="form-group">
                    <label htmlFor="inv-edit-price">Unit Price ($)</label>
                    <input
                      id="inv-edit-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unit_price}
                      onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="inv-edit-qty">Qty in Stock</label>
                    <input
                      id="inv-edit-qty"
                      type="number"
                      min="0"
                      step="1"
                      value={form.quantity_in_stock}
                      onChange={e => setForm(f => ({ ...f, quantity_in_stock: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="inv-edit-photo">Photo</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      id="inv-edit-photo"
                      className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-border rounded-md text-[13px] bg-bg text-text"
                      value={form.photo_url}
                      onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))}
                      placeholder="https://… or upload below"
                    />
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handlePhotoUpload}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={uploadingPhoto}
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {uploadingPhoto ? 'Uploading…' : 'Upload Photo'}
                    </button>
                    {form.photo_url && /^\d+$/.test(form.photo_url.trim()) && (
                      <img
                        src={api.fileServeUrl(form.photo_url.trim(), { variant: 'ui' })}
                        alt="preview"
                        className="w-12 h-12 object-cover rounded-md border border-border shrink-0"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="inv-edit-notes">Internal Notes</label>
                  <textarea
                    id="inv-edit-notes"
                    rows={2}
                    value={form.internal_notes}
                    onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                    placeholder="Private merchandising notes for AI and staff only…"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="inv-edit-desc">Description</label>
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <span className="text-[12px] text-text-muted">Client-facing product copy</span>
                  <button
                    type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={generatingDescription || !form.title.trim()}
                      onClick={handleGenerateDescription}
                  >
                    {generatingDescription ? 'Writing…' : 'AI Write Description'}
                  </button>
                </div>
                <div className={styles.aiInlineControls}>
                  <label className={styles.aiInlineControl}>
                    <span>Style</span>
                    <select value={aiStylePreset} onChange={(e) => setAiStylePreset(e.target.value)}>
                      {DESCRIPTION_STYLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.aiInlineControl}>
                    <span>Persona</span>
                    <select value={aiPersonaPreset} onChange={(e) => setAiPersonaPreset(e.target.value)}>
                      {DESCRIPTION_PERSONA_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.aiInlineControl}>
                    <span>Variation</span>
                    <select value={aiVariationLevel} onChange={(e) => setAiVariationLevel(e.target.value)}>
                      {DESCRIPTION_VARIATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <textarea
                  id="inv-edit-desc"
                  rows={3}
                  value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description…"
                  />
                </div>

                <div className="flex gap-5 flex-wrap">
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.hidden}
                      onChange={e => setForm(f => ({ ...f, hidden: e.target.checked }))}
                    />
                    Hidden (sub-item / accessory)
                  </label>
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.taxable}
                      onChange={e => setForm(f => ({ ...f, taxable: e.target.checked }))}
                    />
                    Taxable
                  </label>
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_subrental}
                      onChange={e => setForm(f => ({ ...f, is_subrental: e.target.checked }))}
                    />
                    Subrental
                  </label>
                </div>

                <div className={styles.drawerSection}>
                  <AssociationList itemId={editingItem.id} />
                </div>

                <div className={styles.drawerSection}>
                  <h4 className="text-[13px] font-semibold mb-1">Permanent accessories</h4>
                  <p className="text-[12px] text-text-muted mb-3">These links are saved with the item now. Quote auto-add is planned, but not wired yet.</p>
                  {accessories.length > 0 && (
                    <ul className="list-none p-0 m-0 mb-2.5 flex flex-col gap-1">
                      {accessories.map(acc => (
                        <li key={acc.id} className="flex items-center justify-between px-2.5 py-1.5 bg-surface rounded text-[13px]">
                          <span>{acc.title}</span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              await api.removeItemAccessory(editingItem.id, acc.id);
                              loadAccessories(editingItem.id);
                            }}
                          >Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="relative">
                    <input
                      className="w-full pl-3 pr-3 py-2 border border-border rounded-lg text-[13px] bg-bg text-text focus:outline-none focus:border-primary"
                      placeholder="Search items to add as accessory…"
                      aria-label="Search items to add as accessory"
                      value={accessorySearch}
                      onChange={e => { setAccessorySearch(e.target.value); searchAccessories(e.target.value); }}
                    />
                    {accessoryResults.length > 0 && (
                      <ul className="absolute top-full left-0 right-0 z-[100] bg-bg border border-border rounded shadow-lg mt-0.5 max-h-[200px] overflow-y-auto list-none p-1">
                        {accessoryResults.filter(r => r.id !== editingItem.id && !accessories.find(a => a.id === r.id)).map(r => (
                          <li key={r.id}>
                            <button
                              type="button"
                              className="block w-full text-left px-3.5 py-2 text-[13px] text-text hover:bg-surface cursor-pointer rounded"
                              onClick={async () => {
                                await api.addItemAccessory(editingItem.id, { accessory_id: r.id });
                                setAccessorySearch('');
                                setAccessoryResults([]);
                                loadAccessories(editingItem.id);
                              }}
                            >{r.title}</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className={styles.drawerFooter}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleCloseEdit}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </aside>
        </>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`Delete "${confirmDelete.title}"? This cannot be undone.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

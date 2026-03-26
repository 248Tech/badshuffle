# Badshuffle Refactor Plan

Generated: Phase 5 (Architecture Planning)
Based on: `AI/reports/code-audit.md` — Backend/Scalability and Frontend/Architecture findings

---

## 1. Service Layer Extraction — `server/routes/quotes.js`

### Problem summary

`server/routes/quotes.js` (~960 lines) contains two categories of code that do not belong in a route file:
- **Business orchestration**: multi-step workflows that touch multiple tables, call external services (SMTP), and produce side effects (activity log, message thread, lead events, item stats)
- **Reusable data helpers**: `logActivity` and `markUnsignedChangesIfApproved` are already scoped as inner functions but accessed by many handlers

Route files should contain only: input extraction, auth/validation guards, one service call, and one response.

---

### Target file structure

```
server/
  routes/
    quotes.js          ← keep: route definitions only, no orchestration
  services/
    quoteService.js    ← new: send, duplicate, status transitions
    itemStatsService.js  ← new: upsertStats, updateUsageBrackets
  lib/
    quoteActivity.js   ← new: logActivity (extracted from quotes.js inner fn)
```

---

### 1a. `server/lib/quoteActivity.js`

Extract the existing `logActivity` inner function. It is called in ~15 places across `quotes.js` and will be needed by the new service modules.

```js
// server/lib/quoteActivity.js
module.exports = function logActivity(db, quoteId, eventType, description, oldValue, newValue, req) {
  const userId = req && req.user && req.user.sub;
  const userEmail =
    (req && req.user && req.user.email) ||
    (userId ? db.prepare('SELECT email FROM users WHERE id = ?').get(userId)?.email : null) ||
    null;
  try {
    db.prepare(
      'INSERT INTO quote_activity_log (quote_id, event_type, description, old_value, new_value, user_id, user_email) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(quoteId, eventType, description || null, oldValue || null, newValue || null, userId || null, userEmail);
  } catch (_) {}
};
```

**Usage in routes.js after extraction:**
```js
const logActivity = require('../lib/quoteActivity');
// was: logActivity(quoteId, ...)
// becomes: logActivity(db, quoteId, ...)
```

---

### 1b. `server/services/itemStatsService.js`

The item-add handler (lines 852–885) contains stats/bracket upsert logic that has nothing to do with HTTP. Extract it as a pure DB function.

```js
// server/services/itemStatsService.js
module.exports = function upsertItemStats(db, itemId, guestCount) {
  const existing = db.prepare(
    'SELECT id, times_quoted, total_guests FROM item_stats WHERE item_id = ?'
  ).get(itemId);

  if (existing) {
    db.prepare(`
      UPDATE item_stats
      SET times_quoted = times_quoted + 1,
          total_guests = total_guests + ?,
          last_used_at = datetime('now')
      WHERE item_id = ?
    `).run(guestCount, itemId);
  } else {
    db.prepare(
      "INSERT INTO item_stats (item_id, times_quoted, total_guests, last_used_at) VALUES (?, 1, ?, datetime('now'))"
    ).run(itemId, guestCount);
  }

  if (guestCount > 0) {
    const bMin = Math.floor(guestCount / 25) * 25;
    const bMax = bMin + 24;
    const bracket = db.prepare(
      'SELECT id FROM usage_brackets WHERE item_id = ? AND bracket_min = ?'
    ).get(itemId, bMin);

    if (bracket) {
      db.prepare('UPDATE usage_brackets SET times_used = times_used + 1 WHERE id = ?').run(bracket.id);
    } else {
      db.prepare(
        'INSERT INTO usage_brackets (item_id, bracket_min, bracket_max, times_used) VALUES (?, ?, ?, 1)'
      ).run(itemId, bMin, bMax);
    }
  }
};
```

**Usage in POST /api/quotes/:id/items after extraction:**
```js
const upsertItemStats = require('../services/itemStatsService');
// replace the stats/bracket block with:
upsertItemStats(db, item_id, quote.guest_count || 0);
```

---

### 1c. `server/services/quoteService.js`

Extract the three largest orchestration blocks. Each becomes a named exported function.

#### Function signatures

```js
// server/services/quoteService.js
module.exports = { sendQuote, duplicateQuote, transitionQuoteStatus };
```

---

#### `sendQuote({ db, uploadsDir, quoteId, actor, input })`

Covers: lines 517–601 in `quotes.js`

Steps inside: token generation → status update → SMTP config lookup → transporter setup → attachment hydration → sendMail → lead event → message persistence

```js
/**
 * @param {object} opts
 * @param {object} opts.db         — sql.js db instance
 * @param {string} opts.uploadsDir — absolute path to uploads directory
 * @param {string|number} opts.quoteId
 * @param {object} opts.actor      — req.user (for activity log)
 * @param {object} opts.input      — req.body: { templateId, subject, bodyHtml, bodyText, toEmail, attachmentIds }
 * @returns {{ quote: object, emailPreview: object|null }}
 */
async function sendQuote({ db, uploadsDir, quoteId, actor, input }) { ... }
```

**Route handler after extraction:**
```js
router.post('/:id/send', async (req, res) => {
  try {
    const result = await quoteService.sendQuote({
      db, uploadsDir,
      quoteId: req.params.id,
      actor: req.user,
      input: req.body || {},
    });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});
```

---

#### `duplicateQuote({ db, sourceQuoteId })`

Covers: lines 794–833 in `quotes.js`

Steps inside: SELECT source quote → INSERT copy → copy quote_items → copy quote_custom_items → clear public_token

```js
/**
 * @param {object} opts
 * @param {object} opts.db            — sql.js db instance
 * @param {string|number} opts.sourceQuoteId
 * @returns {{ quote: object }}       — the newly created quote row
 * @throws {Error} with .statusCode = 404 if source not found
 */
function duplicateQuote({ db, sourceQuoteId }) { ... }
```

**Route handler after extraction:**
```js
router.post('/:id/duplicate', (req, res) => {
  try {
    const result = quoteService.duplicateQuote({ db, sourceQuoteId: req.params.id });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});
```

---

#### `transitionQuoteStatus({ db, quoteId, toStatus, actor })`

Covers: the confirm (lines 619–631), close (lines 633–645), and reopen patterns

Valid transitions: `approved → confirmed`, `confirmed → closed`

```js
/**
 * @param {object} opts
 * @param {object} opts.db
 * @param {string|number} opts.quoteId
 * @param {'confirmed'|'closed'} opts.toStatus
 * @param {object} opts.actor   — req.user (for activity log)
 * @returns {{ quote: object }}
 * @throws {Error} with .statusCode = 400 if transition is invalid
 */
function transitionQuoteStatus({ db, quoteId, toStatus, actor }) { ... }
```

**Route handlers after extraction:**
```js
router.post('/:id/confirm', (req, res) => {
  try {
    const result = quoteService.transitionQuoteStatus({ db, quoteId: req.params.id, toStatus: 'confirmed', actor: req.user });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:id/close', (req, res) => {
  try {
    const result = quoteService.transitionQuoteStatus({ db, quoteId: req.params.id, toStatus: 'closed', actor: req.user });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});
```

---

### Migration order

1. Extract `quoteActivity.js` first — it is a dependency of both the routes file and the new services
2. Extract `itemStatsService.js` — standalone, no dependencies on other new modules
3. Extract `quoteService.js` — depends on `quoteActivity.js`
4. Update `quotes.js` to import and call the services
5. Delete the dead code from `quotes.js` after each step (do not leave the old code commented out)

---

---

## 2. Component Decomposition — `QuoteDetailPage.jsx`

### Problem summary

`QuoteDetailPage.jsx` is 1,837 lines with ~30 state variables, all owned at the page root. The page renders five tabs (Quote, Billing, Files, Activity, and an implicit Contract sub-section) plus a toolbar and modal layer, but none of these are separate components. Every state change — including payment modal open/close, message send, and file picker toggle — rerenders the full page tree.

---

### Target file structure

```
client/src/
  pages/
    QuoteDetailPage.jsx         ← reduced to ~180 lines: controller + layout
  components/
    QuoteFilePicker.jsx         ← extracted from QuoteDetailPage (line ~1616)
    ImagePicker.jsx             ← extracted from QuoteDetailPage (line ~1680)
    QuoteSendModal.jsx          ← extracted from QuoteDetailPage (line ~1730)
  hooks/
    useQuoteDetail.js           ← new: page-level shared state + data loading
  pages/quote-detail/
    QuoteOverviewTab.jsx        ← new
    QuoteBillingTab.jsx         ← new
    QuoteFilesTab.jsx           ← new
    QuoteActivityTab.jsx        ← new
    QuoteToolbar.jsx            ← new
```

---

### 2a. `hooks/useQuoteDetail.js`

Owns all shared state (quote, customItems, adjustments, settings, availability) and the `load` callback. Everything that only one tab needs moves into that tab instead.

```js
/**
 * @param {string} quoteId
 * @returns {{
 *   quote: object|null,
 *   customItems: array,
 *   adjustments: array,
 *   settings: object,
 *   availability: object,
 *   loading: boolean,
 *   editing: boolean,
 *   setEditing: fn,
 *   form: object,
 *   setForm: fn,
 *   isDirty: boolean,
 *   load: fn,
 *   handleSaveEdit: fn,
 *   pendingTransition: object|null,
 *   setPendingTransition: fn,
 *   transitioning: boolean,
 * }}
 */
export function useQuoteDetail(quoteId) { ... }
```

**Shared state that stays here** (needed by ≥2 tabs or the toolbar):
- `quote`, `customItems`, `adjustments`, `settings`, `availability`
- `editing`, `form`, `isDirty`
- `pendingTransition`, `transitioning`
- `load` callback

**State that moves to subcomponents** (used by exactly one tab):
- Billing tab: `payments`, `showPaymentModal`, `paymentForm`, `paymentSaving`, `damageCharges`, `showDamageForm`, `damageForm`, `damageSaving`
- Files tab: `quoteFiles`, `showFilePicker`
- Activity tab: `activity`
- Messages (in Overview): `quoteMessages`, `msgText`, `msgSending`
- Contract (in Overview edit): `contract`, `contractBody`, `contractSaving`, `contractLogs`, `contractTemplates`
- Log picker: `showLogPicker`, `logSearch`, `logItems`
- Custom items form: `showCustomForm`, `customForm`

---

### 2b. `QuoteDetailPage.jsx` (after decomposition)

```jsx
export default function QuoteDetailPage() {
  const { id } = useParams();
  const controller = useQuoteDetail(id);
  const [detailTab, setDetailTab] = useState('quote');

  if (controller.loading) return <div className={styles.loading}>Loading…</div>;
  if (!controller.quote) return <div className={styles.notFound}>Quote not found</div>;

  return (
    <div className={styles.page}>
      <QuoteToolbar
        quote={controller.quote}
        editing={controller.editing}
        isDirty={controller.isDirty}
        onEdit={() => controller.setEditing(true)}
        onSave={controller.handleSaveEdit}
        onCancel={...}
        onTransition={controller.setPendingTransition}
      />

      <div className={styles.tabs}>
        {['quote','billing','files','activity'].map(tab => (
          <button key={tab} className={detailTab === tab ? styles.activeTab : styles.tab}
            onClick={() => setDetailTab(tab)}>{tab}</button>
        ))}
      </div>

      {detailTab === 'quote'    && <QuoteOverviewTab controller={controller} />}
      {detailTab === 'billing'  && <QuoteBillingTab quoteId={id} quote={controller.quote} onLoad={controller.load} />}
      {detailTab === 'files'    && <QuoteFilesTab quoteId={id} />}
      {detailTab === 'activity' && <QuoteActivityTab quoteId={id} />}

      {controller.pendingTransition && (
        <ConfirmDialog
          message={controller.pendingTransition.message}
          confirmLabel={controller.pendingTransition.label}
          onConfirm={controller.pendingTransition.action}
          onCancel={() => controller.setPendingTransition(null)}
        />
      )}

      {controller.showSendModal && <QuoteSendModal quoteId={id} onClose={...} />}
    </div>
  );
}
```

---

### 2c. `QuoteOverviewTab.jsx`

Renders: quote header/edit form, client card, venue card, QuoteBuilder (line items), logistics, export col, messages card, summary card.

```js
/**
 * @param {{ controller: ReturnType<useQuoteDetail> }} props
 */
export default function QuoteOverviewTab({ controller }) { ... }
```

Owns: `showCustomForm`, `customForm`, `showLogPicker`, `logSearch`, `logItems`, `contract`, `contractBody`, `contractSaving`, inline message form state, inline address modal state.

---

### 2d. `QuoteBillingTab.jsx`

Renders: payments list, add-payment modal, damage charges (if closed).

```js
/**
 * @param {{ quoteId: string, quote: object, onLoad: fn }} props
 */
export default function QuoteBillingTab({ quoteId, quote, onLoad }) {
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [damageCharges, setDamageCharges] = useState([]);
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [damageForm, setDamageForm] = useState(initialDamageForm);
  const [damageSaving, setDamageSaving] = useState(false);
  ...
}
```

`onLoad` is called after a successful payment/damage mutation so the parent can refresh totals if needed.

---

### 2e. `QuoteFilesTab.jsx`

Renders: attached files grid, upload button, QuoteFilePicker (imported from components/).

```js
/**
 * @param {{ quoteId: string }} props
 */
export default function QuoteFilesTab({ quoteId }) {
  const [quoteFiles, setQuoteFiles] = useState([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  ...
}
```

---

### 2f. `QuoteActivityTab.jsx`

Renders: activity log list.

```js
/**
 * @param {{ quoteId: string }} props
 */
export default function QuoteActivityTab({ quoteId }) {
  const [activity, setActivity] = useState([]);
  ...
}
```

---

### 2g. `QuoteToolbar.jsx`

Renders: status badge, Edit/Save/Cancel buttons, Send button, status-transition buttons (Confirm, Close, Reopen), Duplicate, Delete.

```js
/**
 * @param {{
 *   quote: object,
 *   editing: boolean,
 *   isDirty: boolean,
 *   saving: boolean,
 *   duplicating: boolean,
 *   onEdit: fn,
 *   onSave: fn,
 *   onCancel: fn,
 *   onSend: fn,
 *   onTransition: fn(transition: { message, label, confirmClass, action }),
 *   onDuplicate: fn,
 *   onDelete: fn,
 *   onViewPublic: fn,
 * }} props
 */
export default function QuoteToolbar(props) { ... }
```

---

### Extraction order

1. Extract the three inline components first (no state dependencies): `QuoteFilePicker`, `ImagePicker`, `QuoteSendModal` → move to `client/src/components/`
2. Create `useQuoteDetail.js` — port shared state and `load`/`handleSaveEdit` from the page
3. Create `QuoteActivityTab.jsx` — purely a fetch + list render, no shared state needed
4. Create `QuoteFilesTab.jsx` — depends on `QuoteFilePicker` being extracted (step 1)
5. Create `QuoteBillingTab.jsx` — owns payment/damage state
6. Create `QuoteToolbar.jsx` — accepts callbacks as props, no local state
7. Create `QuoteOverviewTab.jsx` — the largest piece; can be done last after the simpler tabs reduce the file
8. Reduce `QuoteDetailPage.jsx` to the orchestration shell

At each step the page file should compile and pass a smoke test before proceeding.

---

---

## 3. Component Decomposition — `QuoteBuilder.jsx`

### Problem summary

`QuoteBuilder.jsx` is 1,062 lines with four distinct concerns sharing a single render scope. The inventory picker re-renders whenever a quote line quantity changes, and the quote line list re-renders whenever picker pagination changes, because all state lives in the same component.

---

### Target file structure

```
client/src/
  components/
    QuoteBuilder.jsx              ← reduced to ~60 lines: coordinator shell
    quote-builder/
      QuoteLineItemsPanel.jsx     ← new: sorted line items, inline price/qty editing
      QuoteAdjustmentsPanel.jsx   ← new: adjustments list + add form
      InventoryPickerPanel.jsx    ← new: search, pagination, tile/list view, add-to-quote
    QuoteItemEditModal.jsx        ← already exists as inline; move to components/
```

---

### 3a. `QuoteBuilder.jsx` (after decomposition)

```jsx
/**
 * Props contract (unchanged from current external interface):
 * @param {{
 *   quoteId: string,
 *   items: array,            — quote line items (from parent, refreshed on mutation)
 *   customItems: array,
 *   adjustments: array,
 *   settings: object,
 *   availability: object,
 *   onItemsChange: fn,       — called after any line-item mutation
 *   onAdjustmentsChange: fn,
 *   editingEnabled: boolean,
 * }} props
 */
export default function QuoteBuilder({ quoteId, items, customItems, adjustments, settings, availability, onItemsChange, onAdjustmentsChange, editingEnabled }) {
  return (
    <div className={styles.builder}>
      <QuoteLineItemsPanel
        quoteId={quoteId}
        items={items}
        customItems={customItems}
        availability={availability}
        editingEnabled={editingEnabled}
        onItemsChange={onItemsChange}
      />
      <QuoteAdjustmentsPanel
        quoteId={quoteId}
        adjustments={adjustments}
        onAdjustmentsChange={onAdjustmentsChange}
        editingEnabled={editingEnabled}
      />
      {editingEnabled && (
        <InventoryPickerPanel
          quoteId={quoteId}
          selectedItemIds={items.map(i => i.item_id)}
          settings={settings}
          onAddItem={onItemsChange}
        />
      )}
    </div>
  );
}
```

---

### 3b. `QuoteLineItemsPanel.jsx`

Owns: drag state, `localQty` map (debounced quantity inputs), `editingPriceId`/`priceInput`, `editingDiscountId`/`discountForm`, `editingQuoteItem`/`quoteItemForm`/`quoteItemSaving`.

```js
/**
 * @param {{
 *   quoteId: string,
 *   items: array,
 *   customItems: array,
 *   availability: object,
 *   editingEnabled: boolean,
 *   onItemsChange: fn,
 * }} props
 */
export default function QuoteLineItemsPanel({ quoteId, items, customItems, availability, editingEnabled, onItemsChange }) {
  const [localQty, setLocalQty] = useState({});        // itemId → draft quantity
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [discountForm, setDiscountForm] = useState({ type: 'percent', amount: '' });
  const [editingQuoteItem, setEditingQuoteItem] = useState(null);
  const [quoteItemForm, setQuoteItemForm] = useState({});
  const [quoteItemSaving, setQuoteItemSaving] = useState(false);
  // drag state (if DnD is implemented)
  ...
}
```

Renders: sorted line item rows, inline quantity/price/discount editors, QuoteItemEditModal.

---

### 3c. `QuoteAdjustmentsPanel.jsx`

Owns: `showAdjForm`, `adjForm`, `adjSaving`.

```js
/**
 * @param {{
 *   quoteId: string,
 *   adjustments: array,
 *   onAdjustmentsChange: fn,
 *   editingEnabled: boolean,
 * }} props
 */
export default function QuoteAdjustmentsPanel({ quoteId, adjustments, onAdjustmentsChange, editingEnabled }) {
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjForm, setAdjForm] = useState({ label: '', type: 'discount', value_type: 'percent', amount: '' });
  const [adjSaving, setAdjSaving] = useState(false);
  ...
}
```

---

### 3d. `InventoryPickerPanel.jsx`

Owns: all search/pagination/filter/availability state. Completely isolated — changes to picker state cause zero rerenders in `QuoteLineItemsPanel`.

```js
/**
 * @param {{
 *   quoteId: string,
 *   selectedItemIds: number[],  — used to show "in quote" badge
 *   settings: object,           — for availability window config
 *   onAddItem: fn(itemId, qty), — called after successful add; parent refreshes items
 * }} props
 */
export default function InventoryPickerPanel({ quoteId, selectedItemIds, settings, onAddItem }) {
  const [inventory, setInventory] = useState([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [pickerView, setPickerView] = useState('tile');
  const [pickerPage, setPickerPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryList, setCategoryList] = useState([]);
  const [pickerAvailability, setPickerAvailability] = useState({});
  const [pickerQty, setPickerQty] = useState({});
  ...
}
```

---

### 3e. Performance notes

After extraction:
- `QuoteLineItemsPanel` should wrap its row mutation handlers in `useCallback` with `[quoteId, onItemsChange]` deps to prevent recreation on every parent render
- `InventoryPickerPanel` should wrap `onAddItem` at its call site (`QuoteBuilder.jsx`) in `useCallback` to avoid triggering picker re-renders when the parent's items array reference changes
- The `localQty` debounce timer in `QuoteLineItemsPanel` should be cleaned up in a `useEffect` return — it currently runs in the outer component's closure which makes cleanup impossible after extraction

---

### Extraction order

1. Move the inline `QuoteItemEditModal` to `client/src/components/QuoteItemEditModal.jsx` (it's already a discrete block at the bottom of `QuoteBuilder.jsx`)
2. Extract `QuoteAdjustmentsPanel` — smallest and most self-contained
3. Extract `InventoryPickerPanel` — isolated state, depends only on `onAddItem` callback
4. Extract `QuoteLineItemsPanel` — the largest piece; import `QuoteItemEditModal` from step 1
5. Reduce `QuoteBuilder.jsx` to the coordinator shell

---

---

## 4. Shared Pricing Utility — `client/src/lib/quoteTotals.js`

### Problem summary

`effectivePrice`, `computeAdjustmentsTotal`, and `computeTotals` are duplicated between `QuoteDetailPage.jsx` (lines 16–52) and `PublicQuotePage.jsx` (lines 6–45). The two implementations are nearly identical but will diverge over time.

### Target module

```js
// client/src/lib/quoteTotals.js

const isLogistics = (item) => (item.category || '').toLowerCase().includes('logistics');

export function effectivePrice(item) {
  const base = item.unit_price_override != null ? item.unit_price_override : (item.unit_price || 0);
  if (item.discount_type === 'percent' && item.discount_amount > 0) {
    return base * (1 - item.discount_amount / 100);
  }
  if (item.discount_type === 'fixed' && item.discount_amount > 0) {
    return Math.max(0, base - item.discount_amount);
  }
  return base;
}

export function computeAdjustmentsTotal(adjustments, preTaxBase) {
  return (adjustments || []).reduce((sum, adj) => {
    const val = adj.value_type === 'percent' ? preTaxBase * (adj.amount / 100) : adj.amount;
    return sum + (adj.type === 'discount' ? -val : val);
  }, 0);
}

/**
 * @param {{
 *   items: array,
 *   customItems: array,
 *   adjustments: array,
 *   taxRate: number|string,
 * }} opts
 * @returns {{ laborHours, subtotal, deliveryTotal, customSubtotal, adjTotal, tax, total, rate }}
 */
export function computeTotals({ items, customItems, adjustments, taxRate }) {
  const list = items || [];
  const equipment = list.filter(it => !isLogistics(it));
  const logistics = list.filter(it => isLogistics(it));
  const laborHours = list.reduce((sum, it) => sum + (Number(it.labor_hours) || 0) * (it.quantity || 1), 0);
  const subtotal = equipment.reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);
  const deliveryTotal = logistics.reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);
  const taxableEquipment = equipment.filter(it => it.taxable !== 0).reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);
  const taxableDelivery = logistics.filter(it => it.taxable !== 0).reduce((sum, it) => sum + effectivePrice(it) * (it.quantity || 1), 0);
  const ciList = customItems || [];
  const customSubtotal = ciList.reduce((sum, ci) => sum + (ci.unit_price || 0) * (ci.quantity || 1), 0);
  const taxableCustom = ciList.filter(ci => ci.taxable !== 0).reduce((sum, ci) => sum + (ci.unit_price || 0) * (ci.quantity || 1), 0);
  const preTaxBase = subtotal + deliveryTotal + customSubtotal;
  const adjTotal = computeAdjustmentsTotal(adjustments, preTaxBase);
  const rate = parseFloat(taxRate) || 0;
  const tax = (taxableEquipment + taxableDelivery + taxableCustom) * (rate / 100);
  const grandTotal = preTaxBase + adjTotal + tax;
  return { laborHours, subtotal, deliveryTotal, customSubtotal, adjTotal, tax, total: grandTotal, rate };
}
```

**After creating this file:**
- Delete the three functions from `QuoteDetailPage.jsx` and import from `../lib/quoteTotals`
- Delete the three functions from `PublicQuotePage.jsx` and import from `../lib/quoteTotals`
- `PublicQuotePage.jsx` omits `laborHours` in its display — that's fine, it's still in the return value, the page just doesn't render it

---

## 5. Recommended execution order

The plans above are designed to be executed independently. A safe overall sequence:

| Step | Work | Files touched |
|------|------|---------------|
| 1 | Extract `quoteTotals.js` | QuoteDetailPage, PublicQuotePage (2 files, low risk) |
| 2 | Extract `quoteActivity.js` + `itemStatsService.js` | quotes.js, 2 new files |
| 3 | Extract `quoteService.js` (sendQuote, duplicateQuote, transitions) | quotes.js, 1 new file |
| 4 | Extract QuoteDetailPage inline components | QuoteDetailPage, 3 new component files |
| 5 | Extract QuoteBuilder subcomponents | QuoteBuilder, 3-4 new component files |
| 6 | Build `useQuoteDetail` hook + reduce QuoteDetailPage | QuoteDetailPage, 1 new hook |
| 7 | Build tab components + reduce QuoteDetailPage further | 4 new tab files |

Steps 1–3 are backend-only. Steps 4–7 are frontend-only. They can be parallelized across agents.

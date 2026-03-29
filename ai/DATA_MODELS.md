# BadShuffle — Data Models

All tables are defined and migrated in `server/db.js`. SQLite (sql.js); foreign keys ON.

---

## Quote

- **Table:** `quotes`
- **Key columns:** id, name, guest_count, event_date, event_type, notes, status (draft/sent/approved/confirmed/closed), lead_id, public_token. Venue: venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes. Client: client_first_name, client_last_name, client_email, client_phone, client_address. quote_notes, tax_rate. Rental scheduling: rental_start, rental_end, delivery_date, pickup_date (TEXT). created_at, updated_at.
- **Relationships:** lead_id → leads(id) SET NULL. One-to-many: quote_items, quote_custom_items, contracts, quote_attachments, quote_payments, quote_activity_log, contract_logs, messages (optional quote_id).

## QuoteItemSection

- **Table:** `quote_item_sections`
- **Columns:** id, quote_id, title, delivery_date, rental_start, rental_end, pickup_date, sort_order, created_at.
- **Relationships:** quote_id → quotes(id) CASCADE.
- **Notes:** Sections are first-class containers for quote items/custom items. Existing quotes are backfilled with a default section. Public quote reads also normalize missing section rows for older quotes. Availability and export/print/PDF presentation now use section-level grouping/date windows; section reordering is still not implemented.

## QuoteItem

- **Table:** `quote_items`
- **Columns:** id, quote_id, item_id, quantity, label, sort_order, section_id, hidden_from_quote, unit_price_override (REAL, nullable — NULL means use items.unit_price), discount_type, discount_amount, description, notes.
- **Relationships:** quote_id → quotes(id) CASCADE; item_id → items(id) RESTRICT; section_id → quote_item_sections(id) SET NULL. Used for equipment and (when category contains "logistics") delivery/pickup lines.

## ContractSignatureItem

- **Table:** `contract_signature_items`
- **Columns:** id, signature_event_id, quote_id, qitem_id, item_id, section_id, quantity, range_start, range_end, created_at.
- **Relationships:** signature_event_id → contract_signature_events(id) CASCADE; quote_id → quotes(id) CASCADE; item_id → items(id) RESTRICT; section_id → quote_item_sections(id) SET NULL.
- **Notes:** Captures the signed state of quote items at each signature/re-signature so availability can compare the last signed quantities against current unsigned edits.

## QuoteAdjustment

- **Table:** `quote_adjustments`
- **Columns:** id, quote_id, label TEXT, type TEXT (discount|surcharge), value_type TEXT (percent|fixed), amount REAL, sort_order INTEGER, created_at TEXT.
- **Relationships:** quote_id → quotes(id) CASCADE.
- **Notes:** Percent adjustments apply to pre-tax base (subtotal + delivery + custom subtotal). Fixed adjustments are flat amounts. Discounts are negative; surcharges positive. Tax is NOT recalculated (remains on raw taxable line items).

## QuoteDamageCharge

- **Table:** `quote_damage_charges`
- **Columns:** id, quote_id, title TEXT, amount REAL, note TEXT, created_at TEXT, created_by TEXT.
- **Relationships:** quote_id → quotes(id) CASCADE.
- **Notes:** Post-event billing for damage; only applicable to closed quotes.

## Product / Item (Inventory)

- **Table:** `items`
- **Columns:** id, title (UNIQUE COLLATE NOCASE), photo_url, source (manual/sheet/…), hidden, quantity_in_stock, unit_price, category, description, contract_description, taxable, labor_hours, is_subrental (INTEGER DEFAULT 0), vendor_id (INTEGER REFERENCES vendors(id)), created_at, updated_at.
- **Relationships:** Referenced by quote_items; parent/child via item_associations (bundles). item_stats (1:1), usage_brackets (1:many).

## InventoryItem

- Same as **Item** above. There is no separate “inventory item” table; `items` is the inventory catalog. quantity_in_stock is informational (no reservation or pull logic).

## Bundle / Components

- **Table:** `item_associations`
- **Columns:** id, parent_id, child_id. UNIQUE(parent_id, child_id).
- **Relationships:** parent_id, child_id → items(id) CASCADE. Represents “parent item includes child item” (e.g. bundle). Used for display/selection; no automatic expansion of bundles into quote line items in the current implementation.

## PullSheet

- **Not present.** No table or entity. Pull sheet logic is not implemented.

## Order

- **No separate order table.** An approved quote is the order. GET /api/quotes returns status; “order” in the product sense is “quote with status = approved”.

## Client

- **No standalone client table.** Client info is stored on the quote: client_first_name, client_last_name, client_email, client_phone, client_address. Lead records (leads table) can hold name, email, phone, event_date, event_type, source_url, notes and can be linked to a quote via lead_id / quote_id.

## Venue

- **No standalone venue table.** Venue is stored on the quote: venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes.

## Vendor

- **Table:** `vendors`
- **Columns:** id, name, email, phone, address, notes, created_at. Referenced by items.vendor_id for subrental sourcing.
- **Note:** The DB schema uses `email`, `phone`, `address` (not `contact_name`/`contact_email`/`contact_phone`).

## Other Tables

| Table | Purpose |
|-------|---------|
| **users** | id, email, password_hash, role (admin/operator/user), approved, created_at |
| **login_attempts** | ip, attempted_at, success |
| **reset_tokens** | user_id, token, expires_at, used |
| **extension_tokens** | token (for extension API) |
| **settings** | key-value (tax_rate, currency, company_*, SMTP/IMAP, system flags, count_oos_oversold, ui_theme, google_places_api_key, map_default_style, quote_event_types, quote_auto_append_city_title, ai_claude_key_enc, ai_openai_key_enc, ai_gemini_key_enc, ai_suggest_enabled/model, ai_pdf_import_enabled/model, ai_email_draft_enabled/model, ai_description_enabled/model) |
| **leads** | name, email, phone, event_date, event_type, source_url, notes, quote_id, created_at |
| **lead_events** | lead_id, event_type, note, created_at |
| **email_templates** | name, subject, body_html, body_text, is_default |
| **contract_templates** | name, body_html |
| **contracts** | quote_id (UNIQUE), body_html, signed_at, signature_data, signer_name, signer_ip, signed_quote_total |
| **contract_logs** | quote_id, changed_at, user_id, user_email, old_body, new_body |
| **contract_signature_events** | quote_id, contract_id, signer_name, signer_ip, signer_user_agent, signed_at, signed_quote_total, quote_snapshot_hash, file_id |
| **contract_signature_items** | signature_event_id, quote_id, qitem_id, item_id, section_id, quantity, range_start, range_end |
| **quote_custom_items** | quote_id, title, unit_price, quantity, photo_url, taxable, sort_order, section_id |
| **quote_attachments** | quote_id, file_id (UNIQUE per quote_id+file_id) |
| **quote_payments** | quote_id, amount, method, status, reference, paid_at, note, created_by |
| **billing_history** | quote_id, event_type, amount, note, user_email, created_at |
| **quote_activity_log** | quote_id, event_type, description, old_value, new_value, user_id, user_email |
| **messages** | quote_id (nullable), direction, from_email, to_email, subject, body_*, message_id, in_reply_to, status, sent_at |
| **files** | original_name, stored_name, mime_type, size, uploaded_by |
| **item_stats** | item_id (UNIQUE), times_quoted, total_guests, last_used_at |
| **usage_brackets** | item_id, bracket_min, bracket_max, times_used |

---

## Key Relationships Summary

- **Quote** → many QuoteItemSections → many QuoteItems + many QuoteCustomItems; many QuoteAdjustments + many QuoteDamageCharges; one Contract; many ContractSignatureEvents; many ContractSignatureItems (via signature events); many QuoteAttachments, QuotePayments, activity log entries; optional Lead.
- **Item** → many QuoteItems; optional parent/child Associations (bundles); one ItemStats; many UsageBrackets. Optional FK to Vendor via vendor_id.
- **Lead** → optional Quote (quote_id); many LeadEvents.
- **File** → many QuoteAttachments; item/custom item photo_url can store file id.

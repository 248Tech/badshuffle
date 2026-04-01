# BadShuffle — Data Models

All tables are defined and migrated in `server/db.js`. SQLite (sql.js); foreign keys ON.

---

## Quote

- **Table:** `quotes`
- **Key columns:** id, name, guest_count, event_date, event_type, notes, status (draft/sent/approved/confirmed/closed), lead_id, public_token, created_by. Venue: venue_name, venue_email, venue_phone, venue_address, venue_contact, venue_notes. Client: client_first_name, client_last_name, client_email, client_phone, client_address. quote_notes, tax_rate. Rental scheduling: rental_start, rental_end, delivery_date, pickup_date (TEXT). Map cache: map_address_source, map_address_text, map_lat, map_lng, map_geocoded_at, map_geocode_status. created_at, updated_at.
- **Relationships:** lead_id → leads(id) SET NULL. One-to-many: quote_items, quote_custom_items, contracts, quote_attachments, quote_payments, quote_activity_log, contract_logs, messages (optional quote_id).
- **Notes:** `created_by` references `users(id)` and is now used for staff-aware sales analytics filtering. Map cache fields are derived from `venue_address` first, then `client_address`, and are used by the authenticated `/maps` page. Fulfillment state is now tracked separately through `quote_fulfillment_items`, `quote_fulfillment_notes`, and `quote_fulfillment_events`.

## QuoteFulfillmentItem

- **Table:** `quote_fulfillment_items`
- **Columns:** id, quote_id, qitem_id, item_id, section_id, item_title, section_title, range_start, range_end, quantity, checked_in_qty, created_at, updated_at.
- **Relationships:** quote_id → quotes(id) CASCADE; qitem_id → quote_items(id) SET NULL; item_id → items(id) RESTRICT; section_id → quote_item_sections(id) SET NULL.
- **Notes:** This is the operational inventory-hold state after confirmation. Items remain unavailable until `checked_in_qty` reaches `quantity`, even if the project is later closed.

## QuoteFulfillmentNote

- **Table:** `quote_fulfillment_notes`
- **Columns:** id, quote_id, body, created_by, user_email, created_at.
- **Relationships:** quote_id → quotes(id) CASCADE; created_by → users(id) SET NULL.
- **Notes:** Internal-only warehouse/worker/staff notes. Not exposed to the client/public quote views.

## QuoteFulfillmentEvent

- **Table:** `quote_fulfillment_events`
- **Columns:** id, quote_id, fulfillment_item_id, event_type, quantity, note, created_by, user_email, created_at.
- **Relationships:** quote_id → quotes(id) CASCADE; fulfillment_item_id → quote_fulfillment_items(id) SET NULL; created_by → users(id) SET NULL.
- **Notes:** Current v1 use is check-in audit history. This is the groundwork for broader fulfillment event tracking later.

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
| **users** | id, email, password_hash, first_name, last_name, username, display_name, phone, photo_url, bio, role (role key), approved, created_at |
| **user_presence** | user_id (PK), current_path, current_label, last_seen_at, updated_at |
| **roles** | key, name, description, is_system, created_at, updated_at |
| **role_permissions** | role_key, module_key, access_level (`none` / `read` / `modify`), created_at, updated_at |
| **login_attempts** | ip, attempted_at, success |
| **reset_tokens** | user_id, token, expires_at, used |
| **extension_tokens** | token (for extension API) |
| **settings** | key-value (tax_rate, currency, company_*, SMTP/IMAP, system flags, count_oos_oversold, ui_theme, google_places_api_key, map_default_style, quote_event_types, quote_auto_append_city_title, allowed_file_types, image_webp_quality, image_avif_enabled, ai_claude_key_enc, ai_openai_key_enc, ai_gemini_key_enc, ai_suggest_enabled/model, ai_pdf_import_enabled/model, ai_email_draft_enabled/model, ai_description_enabled/model, verbose_errors, diagnostics_enabled, diagnostics_log_path, diagnostics_health_interval_sec) |
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
| **quote_fulfillment_items** | quote_id, qitem_id, item_id, section_id, item_title, section_title, range_start, range_end, quantity, checked_in_qty |
| **quote_fulfillment_notes** | quote_id, body, created_by, user_email, created_at |
| **quote_fulfillment_events** | quote_id, fulfillment_item_id, event_type, quantity, note, created_by, user_email, created_at |
| **messages** | quote_id (nullable), direction, from_email, to_email, subject, body_*, message_id, in_reply_to, status, sent_at |
| **files** | original_name, stored_name, mime_type, size, uploaded_by, is_image, storage_mode, source_format, width, height |
| **file_variants** | file_id, variant_key (`thumb`/`ui`/`large`), format (`webp`/`avif`), stored_name, mime_type, size, width, height |
| **item_stats** | item_id (UNIQUE), times_quoted, total_guests, last_used_at |
| **usage_brackets** | item_id, bracket_min, bracket_max, times_used |

---

## Key Relationships Summary

- **Quote** → many QuoteItemSections → many QuoteItems + many QuoteCustomItems; many QuoteAdjustments + many QuoteDamageCharges; one Contract; many ContractSignatureEvents; many ContractSignatureItems (via signature events); many QuoteAttachments, QuotePayments, activity log entries; optional Lead.
- **Quote** → many QuoteFulfillmentItems + many QuoteFulfillmentNotes + many QuoteFulfillmentEvents.
- **Item** → many QuoteItems; optional parent/child Associations (bundles); one ItemStats; many UsageBrackets. Optional FK to Vendor via vendor_id.
- **Lead** → optional Quote (quote_id); many LeadEvents.
- **File** → many QuoteAttachments; item/custom item photo_url can store file id.
- **Image file behavior** → legacy image uploads still exist as single stored files, but new image uploads now persist optimized variants only and `/api/files/:id/serve` resolves an optimized variant for UI use.
- **User presence behavior** → online status is derived from `user_presence.last_seen_at` within a 2-minute window; `current_label` is a human-readable page/work label derived from the current route path.
- **User profile behavior** → `photo_url` stores the current user avatar reference (typically a `files.id` value from the standard upload pipeline). Current users manage profile data through `GET/PUT /api/auth/me`, and the protected `/profile` page is the main self-service editor. `first_name` + `last_name` are now the primary identity fields, while `display_name` and `username` are generated server-side from name data (with email fallback and unique username suffixing).
- **Permissions behavior** → `users.role` is now a role key resolved through `roles` + `role_permissions`. Built-in and custom roles use the same `none/read/modify` module permission model.

---

## Sales Analytics

- **API endpoint:** `GET /api/sales/analytics`
- **Filter inputs:** `start_date`, `end_date`, `statuses` (`quoteSent,contractSigned,lost`), `staff_ids`
- **Source data:** quotes + contracts + computed quote totals
- **Classification rules:**
  - `contractSigned` = signed contract present or signed/confirmed quote state
  - `quoteSent` = quote status `sent` without a signed contract
  - `lost` = closed quote without a signed contract
- **Date bucketing:** event date when present, otherwise quote `created_at`; client layer fills missing month buckets and splits historical vs forecast around `today`

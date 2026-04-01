# Data Models

Full schema reference for all BadShuffle database tables. Database engine: SQLite.

All timestamps are stored as ISO strings: `YYYY-MM-DD HH:MM:SS` (UTC).

---

## Items (Inventory)

### items

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `title` | TEXT NOT NULL | Unique, case-insensitive (COLLATE NOCASE) |
| `photo_url` | TEXT | File ID as string (e.g. `"42"`) or external URL |
| `source` | TEXT | `manual` \| `import` \| `extension` |
| `hidden` | INTEGER | `1` = excluded from public catalog |
| `quantity_in_stock` | INTEGER | Total units |
| `unit_price` | REAL | Rental price per unit per event |
| `category` | TEXT | User-defined grouping label |
| `description` | TEXT | Long description (markdown-ready) |
| `taxable` | INTEGER | `1` = apply tax_rate |
| `labor_hours` | REAL | Setup/teardown hours estimate |
| `item_type` | TEXT | `product` \| `labor` \| `service` \| `subrental` |
| `is_subrental` | INTEGER | `1` = vendor-sourced, not in-house |
| `vendor_id` | INTEGER | FK → vendors.id (nullable) |
| `contract_description` | TEXT | Legal terms shown in contract |
| `org_id` | INTEGER | Organization ID (default 1) |
| `created_at` | TEXT | ISO datetime |
| `updated_at` | TEXT | ISO datetime |

### item_accessories

Links an item to optional add-on items.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `item_id` | INTEGER | FK → items.id |
| `accessory_id` | INTEGER | FK → items.id |

Unique constraint: `(item_id, accessory_id)`

### item_associations

Parent-child relationships for inventory grouping.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `parent_id` | INTEGER | FK → items.id |
| `child_id` | INTEGER | FK → items.id |

### item_stats

Per-item usage analytics.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `item_id` | INTEGER UNIQUE | FK → items.id |
| `times_quoted` | INTEGER | |
| `total_guests` | INTEGER | |
| `last_used_at` | TEXT | ISO datetime |

### usage_brackets

Frequency by guest-count range.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `item_id` | INTEGER | FK → items.id |
| `bracket_min` | INTEGER | Lower bound (inclusive) |
| `bracket_max` | INTEGER | Upper bound |
| `times_used` | INTEGER | |

### vendors

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `org_id` | INTEGER | |
| `name` | TEXT NOT NULL | |
| `email` | TEXT | |
| `phone` | TEXT | |
| `address` | TEXT | |
| `notes` | TEXT | |
| `created_at` | TEXT | |

---

## Quotes

### quotes

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | Quote reference name (e.g. "Smith Wedding") |
| `status` | TEXT | `draft` \| `sent` \| `approved` \| `confirmed` \| `closed` |
| `lead_id` | INTEGER | FK → leads.id (nullable) |
| **Event** | | |
| `event_date` | TEXT | YYYY-MM-DD |
| `event_type` | TEXT | Wedding, Corporate, etc. |
| `guest_count` | INTEGER | |
| `rental_start` | TEXT | Date items become available |
| `rental_end` | TEXT | Date items are returned |
| `delivery_date` | TEXT | Date items delivered to venue |
| `pickup_date` | TEXT | Date items picked up from venue |
| **Client** | | |
| `client_first_name` | TEXT | |
| `client_last_name` | TEXT | |
| `client_email` | TEXT | Used to send quote email |
| `client_phone` | TEXT | |
| `client_address` | TEXT | |
| **Venue** | | |
| `venue_name` | TEXT | |
| `venue_email` | TEXT | |
| `venue_phone` | TEXT | |
| `venue_address` | TEXT | |
| `venue_contact` | TEXT | Primary venue contact name |
| `venue_notes` | TEXT | |
| **Financial** | | |
| `tax_rate` | REAL | Overrides system `tax_rate` setting |
| `has_unsigned_changes` | INTEGER | `1` = contract has been modified since signing |
| **Sharing** | | |
| `public_token` | TEXT UNIQUE | UUID used in share URLs |
| `expires_at` | TEXT | Quote expiry date (optional) |
| `expiration_message` | TEXT | Shown to client if quote is expired |
| `payment_policy_id` | INTEGER | FK → payment_policies.id |
| `rental_terms_id` | INTEGER | FK → rental_terms.id |
| **Notes** | | |
| `notes` | TEXT | External notes (client-visible) |
| `quote_notes` | TEXT | Internal notes (team only) |
| **Geocoding** | | |
| `map_address_source` | TEXT | `venue` \| `client` \| `manual` |
| `map_address_text` | TEXT | Address that was geocoded |
| `map_lat` | REAL | Latitude |
| `map_lng` | REAL | Longitude |
| `map_geocoded_at` | TEXT | When geocoding ran |
| `map_geocode_status` | TEXT | `success` \| `failed` \| `manual` |
| **Meta** | | |
| `created_by` | INTEGER | FK → users.id |
| `org_id` | INTEGER | |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### quote_item_sections

Sections group line items by event phase, each with independent dates.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id CASCADE |
| `title` | TEXT NOT NULL | e.g. "Ceremony", "Reception" |
| `delivery_date` | TEXT | Overrides quote-level date if set |
| `rental_start` | TEXT | |
| `rental_end` | TEXT | |
| `pickup_date` | TEXT | |
| `sort_order` | INTEGER | |
| `created_at` | TEXT | |

### quote_items

Catalog items added to a quote.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id CASCADE |
| `item_id` | INTEGER | FK → items.id (RESTRICT delete) |
| `section_id` | INTEGER | FK → quote_item_sections.id |
| `quantity` | INTEGER | |
| `label` | TEXT | Display name override |
| `unit_price_override` | REAL | NULL = use item.unit_price |
| `discount_type` | TEXT | `none` \| `percent` \| `fixed` |
| `discount_amount` | REAL | |
| `description` | TEXT | Description override for client |
| `notes` | TEXT | Internal delivery/setup notes |
| `hidden_from_quote` | INTEGER | `1` = hidden from client view |
| `sort_order` | INTEGER | |

### quote_custom_items

Non-catalog line items (arbitrary title, no inventory link).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id CASCADE |
| `section_id` | INTEGER | FK → sections |
| `title` | TEXT NOT NULL | |
| `unit_price` | REAL | |
| `quantity` | INTEGER | |
| `photo_url` | TEXT | File ID or external URL |
| `taxable` | INTEGER | |
| `sort_order` | INTEGER | |
| `created_at` | TEXT | |

### quote_adjustments

Discounts and fees applied to the quote total.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id CASCADE |
| `label` | TEXT NOT NULL | e.g. "Early bird discount" |
| `type` | TEXT NOT NULL | `discount` \| `fee` |
| `value_type` | TEXT NOT NULL | `percent` \| `fixed` |
| `amount` | REAL NOT NULL | |
| `sort_order` | INTEGER | |
| `created_at` | TEXT | |

### quote_payments

Payment records against a quote.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id CASCADE |
| `amount` | REAL NOT NULL | Negative = refund |
| `method` | TEXT | "Credit Card", "Check", etc. |
| `status` | TEXT | `charged`, `pending` |
| `reference` | TEXT | Transaction ID, check number |
| `paid_at` | TEXT | Date received |
| `note` | TEXT | |
| `created_at` | TEXT | |
| `created_by` | INTEGER | FK → users.id |

### quote_damage_charges

Post-event damage charges (only on closed quotes).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id CASCADE |
| `title` | TEXT NOT NULL | Description of damage |
| `amount` | REAL NOT NULL | |
| `note` | TEXT | |
| `created_at` | TEXT | |
| `created_by` | INTEGER | FK → users.id |

### quote_attachments

Files attached to a quote.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id CASCADE |
| `file_id` | INTEGER | FK → files.id CASCADE |
| `created_at` | TEXT | |

Unique constraint: `(quote_id, file_id)`

### quote_activity_log

Immutable audit trail for all quote events.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id CASCADE |
| `event_type` | TEXT NOT NULL | See list below |
| `description` | TEXT | Human-readable summary |
| `old_value` | TEXT | Previous value (JSON or plain) |
| `new_value` | TEXT | New value |
| `user_id` | INTEGER | FK → users.id (nullable for client actions) |
| `user_email` | TEXT | Stored at time of event |
| `created_at` | TEXT | |

**Common event_type values:** `status_change`, `item_added`, `item_removed`, `item_updated`, `custom_item_added`, `custom_item_removed`, `adjustment_added`, `adjustment_removed`, `payment_added`, `payment_deleted`, `damage_charge_added`, `contract_signed`, `file_attached`, `file_removed`

### billing_history

Financial event ledger.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id CASCADE |
| `event_type` | TEXT NOT NULL | `payment`, `refund`, `damage_charge` |
| `amount` | REAL NOT NULL | |
| `note` | TEXT | |
| `created_at` | TEXT | |
| `user_email` | TEXT | |

---

## Contracts

### contracts

One contract per quote (1:1 relationship).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER UNIQUE | FK → quotes.id CASCADE |
| `body_html` | TEXT | HTML contract content |
| `signed_at` | TEXT | ISO datetime of signing (null if unsigned) |
| `signature_data` | TEXT | Base64 canvas or SVG data |
| `signer_name` | TEXT | Client-provided name |
| `signer_ip` | TEXT | IP at time of signing |
| `signer_user_agent` | TEXT | Browser info at signing |
| `signed_quote_total` | REAL | Total when signed (audit) |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### contract_logs

Tracks every edit to the contract body.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id CASCADE |
| `changed_at` | TEXT | |
| `user_id` | INTEGER | FK → users.id |
| `user_email` | TEXT | |
| `old_body` | TEXT | Previous HTML |
| `new_body` | TEXT | New HTML |

### contract_signature_events

Immutable signature event records (audit trail).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | |
| `contract_id` | INTEGER | |
| `signer_name` | TEXT | |
| `signer_ip` | TEXT | |
| `signer_user_agent` | TEXT | |
| `signed_at` | TEXT | |
| `signed_quote_total` | REAL | |
| `quote_snapshot_hash` | TEXT | Hash of quote state at signing |
| `file_id` | INTEGER | PDF snapshot of signed contract |

### contract_templates

Reusable contract boilerplate.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | |
| `body_html` | TEXT | |
| `created_at` | TEXT | |

---

## Messages

### messages

All communications on quote threads.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `quote_id` | INTEGER | FK → quotes.id (nullable) |
| `direction` | TEXT NOT NULL | `inbound` \| `outbound` |
| `from_email` | TEXT | |
| `to_email` | TEXT | |
| `subject` | TEXT | |
| `body_text` | TEXT | Plain text body |
| `body_html` | TEXT | HTML body (optional) |
| `message_id` | TEXT UNIQUE | Email Message-ID for threading |
| `in_reply_to` | TEXT | For email reply chains |
| `reply_to_id` | INTEGER | FK to parent message |
| `status` | TEXT | `sent` \| `unread` \| `read` |
| `message_type` | TEXT | `text` \| `rich` |
| `attachments_json` | TEXT | JSON: `[{ file_id, name }]` |
| `links_json` | TEXT | JSON: `["https://..."]` |
| `rich_payload_json` | TEXT | Custom rich content (max 200KB) |
| `sent_at` | TEXT | |
| `quote_name` | TEXT | Denormalized for display |
| `org_id` | INTEGER | |

---

## Files

### files

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `original_name` | TEXT NOT NULL | Original filename |
| `stored_name` | TEXT NOT NULL UNIQUE | Hashed storage name |
| `mime_type` | TEXT | MIME type |
| `size` | INTEGER | Bytes |
| `is_image` | INTEGER | `1` = image file |
| `storage_mode` | TEXT | `legacy_single` \| multi-variant |
| `source_format` | TEXT | Original format (jpg, png, etc.) |
| `width` | INTEGER | Image dimensions |
| `height` | INTEGER | |
| `uploaded_by` | INTEGER | FK → users.id |
| `org_id` | INTEGER | |
| `created_at` | TEXT | |

### file_variants

Auto-generated image format variants (WebP, AVIF).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `file_id` | INTEGER | FK → files.id CASCADE |
| `variant_key` | TEXT | e.g. `thumbnail`, `preview`, `webp` |
| `format` | TEXT | `webp`, `avif` |
| `stored_name` | TEXT NOT NULL UNIQUE | |
| `mime_type` | TEXT | |
| `size` | INTEGER | Bytes |
| `width` | INTEGER | |
| `height` | INTEGER | |
| `created_at` | TEXT | |

Unique: `(file_id, variant_key, format)`

---

## Users & Auth

### users

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `email` | TEXT NOT NULL UNIQUE | |
| `password_hash` | TEXT NOT NULL | bcrypt |
| `role` | TEXT | `admin` \| `operator` \| `user` |
| `approved` | INTEGER | `0` = pending, `1` = approved |
| `org_id` | INTEGER | |
| `created_at` | TEXT | |

### login_attempts

Brute-force protection log.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `ip` | TEXT NOT NULL | |
| `attempted_at` | TEXT | |
| `success` | INTEGER | |

### reset_tokens

Password reset tokens.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER | FK → users.id CASCADE |
| `token` | TEXT UNIQUE | |
| `expires_at` | TEXT | |
| `used` | INTEGER | `0` \| `1` |

### extension_tokens

Browser extension sync tokens.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `token` | TEXT UNIQUE | |

### user_presence

Real-time team presence tracking.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | INTEGER PK | FK → users.id CASCADE |
| `current_path` | TEXT | Current page route |
| `current_label` | TEXT | Human-readable page name |
| `last_seen_at` | TEXT | |
| `updated_at` | TEXT | |

---

## Leads

### leads

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT | |
| `email` | TEXT | |
| `phone` | TEXT | |
| `event_date` | TEXT | YYYY-MM-DD |
| `event_type` | TEXT | |
| `source_url` | TEXT | Where the lead came from |
| `notes` | TEXT | |
| `org_id` | INTEGER | |
| `created_at` | TEXT | |

---

## Templates

### contract_templates

See Contracts section above.

### payment_policies

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | |
| `body_text` | TEXT | Rendered into quote/contract |
| `is_default` | INTEGER | |
| `created_at` | TEXT | |

### rental_terms

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | |
| `body_text` | TEXT | |
| `is_default` | INTEGER | |
| `created_at` | TEXT | |

---

## Settings

### settings

Key-value store for all system configuration.

| Column | Type |
|--------|------|
| `key` | TEXT PK |
| `value` | TEXT |

**Key categories:**

| Key prefix | Purpose |
|------------|---------|
| `tax_rate`, `currency` | Financial defaults |
| `company_name`, `company_email`, `company_logo`, `company_phone`, `company_address` | Branding |
| `smtp_*` | Outbound email (SMTP) |
| `imap_*` | Inbound email (IMAP polling) |
| `recaptcha_*` | Google reCAPTCHA v2 |
| `ai_claude_key_enc`, `ai_openai_key_enc`, `ai_gemini_key_enc` | AI API keys (AES encrypted) |
| `ai_suggest_enabled`, `ai_pdf_import_enabled`, `ai_email_draft_enabled` | AI feature flags |
| `ui_theme` | Light/dark theme |
| `image_webp_quality`, `image_avif_enabled` | Image processing config |
| `quote_inventory_filter_mode` | Item picker behavior |

---

## Organizations

### orgs

Foundation for future multi-tenancy. Currently always `id = 1`.

| Column | Type |
|--------|------|
| `id` | INTEGER PK |
| `name` | TEXT NOT NULL |
| `created_at` | TEXT |

All core tables have an `org_id INTEGER DEFAULT 1` column.

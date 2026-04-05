use anyhow::{anyhow, Result};
use db::EngineDb;
use rusqlite::{params, params_from_iter, Connection};
use shared_types::{
    AvailabilityEntry, ConflictListItem, ConflictListQuote, ConflictsResult, InventoryAction, InventoryCheckRequest,
    InventoryCheckResponse, InventoryCheckResult, QuoteConflictEntry, QuoteSummaryResult,
};
use std::collections::{BTreeMap, HashMap};

#[derive(Debug, Clone)]
struct RangeWindow {
    start: String,
    end: String,
}

#[derive(Debug, Clone)]
struct QuoteRow {
    id: i64,
    name: Option<String>,
    event_date: Option<String>,
    rental_start: Option<String>,
    rental_end: Option<String>,
    delivery_date: Option<String>,
    pickup_date: Option<String>,
    has_unsigned_changes: i64,
    status: Option<String>,
    signed_at: Option<String>,
}

#[derive(Debug, Clone)]
struct ReservationEntry {
    item_id: i64,
    section_id: Option<i64>,
    quantity: i64,
    range: Option<RangeWindow>,
}

#[derive(Debug, Clone, Default)]
struct QuoteReservationEntries {
    reserved: Vec<ReservationEntry>,
    potential: Vec<ReservationEntry>,
}

#[derive(Debug, Clone)]
struct QuoteItemRow {
    item_id: i64,
    quantity: i64,
    quantity_in_stock: i64,
    section_delivery_date: Option<String>,
    section_rental_start: Option<String>,
    section_rental_end: Option<String>,
    section_pickup_date: Option<String>,
}

#[derive(Debug, Clone)]
struct ConflictQuoteItemRow {
    quote_id: i64,
    item_id: i64,
    quantity: i64,
    title: String,
    quantity_in_stock: i64,
    range: Option<RangeWindow>,
}

pub fn handle_request(engine_db: &EngineDb, request: InventoryCheckRequest) -> Result<InventoryCheckResponse> {
    let conn = engine_db.open()?;
    match request.action {
        InventoryAction::QuoteItems => {
            let result = check_quote_items(&conn, request.quote_id, &request.item_ids, request.section_id)?;
            Ok(InventoryCheckResponse {
                action: InventoryAction::QuoteItems,
                result: InventoryCheckResult::QuoteItems { result },
            })
        }
        InventoryAction::QuoteSummary => {
            let result = check_quote_summary(&conn, request.quote_id)?;
            Ok(InventoryCheckResponse {
                action: InventoryAction::QuoteSummary,
                result: InventoryCheckResult::QuoteSummary { result },
            })
        }
        InventoryAction::Conflicts => {
            let result = check_conflicts(&conn)?;
            Ok(InventoryCheckResponse {
                action: InventoryAction::Conflicts,
                result: InventoryCheckResult::Conflicts { result },
            })
        }
    }
}

fn placeholder_csv(len: usize) -> String {
    std::iter::repeat("?").take(len).collect::<Vec<_>>().join(",")
}

fn get_range_from_source(
    delivery_date: Option<String>,
    rental_start: Option<String>,
    rental_end: Option<String>,
    pickup_date: Option<String>,
    event_date: Option<String>,
) -> Option<RangeWindow> {
    let mut dates = Vec::new();
    if let Some(v) = delivery_date { if !v.is_empty() { dates.push(v); } }
    if let Some(v) = rental_start { if !v.is_empty() { dates.push(v); } }
    if let Some(v) = rental_end { if !v.is_empty() { dates.push(v); } }
    if let Some(v) = pickup_date { if !v.is_empty() { dates.push(v); } }
    if dates.is_empty() {
        if let Some(v) = event_date {
            if !v.is_empty() {
                dates.push(v);
            }
        }
    }
    if dates.is_empty() {
        return None;
    }
    dates.sort();
    Some(RangeWindow {
        start: dates.first().cloned().unwrap_or_default(),
        end: dates.last().cloned().unwrap_or_default(),
    })
}

fn ranges_overlap(a: &Option<RangeWindow>, b: &Option<RangeWindow>) -> bool {
    let Some(a) = a else { return false; };
    let Some(b) = b else { return false; };
    a.start <= b.end && a.end >= b.start
}

fn is_quote_reserved(quote: &QuoteRow) -> bool {
    let status = quote.status.clone().unwrap_or_else(|| "draft".to_string());
    if status == "confirmed" {
        return true;
    }
    if status == "closed" {
        return false;
    }
    quote.signed_at.as_ref().map(|v| !v.is_empty()).unwrap_or(false)
}

fn get_oos_setting(conn: &Connection) -> Result<bool> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = 'count_oos_oversold' LIMIT 1")?;
    let value: Option<String> = stmt.query_row([], |row| row.get(0)).ok();
    Ok(value.unwrap_or_else(|| "0".to_string()) == "1")
}

fn load_quote(conn: &Connection, quote_id: i64) -> Result<Option<QuoteRow>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT q.id, q.name, q.event_date, q.rental_start, q.rental_end,
               q.delivery_date, q.pickup_date, q.has_unsigned_changes, q.status, c.signed_at
        FROM quotes q
        LEFT JOIN contracts c ON c.quote_id = q.id
        WHERE q.id = ?
        "#,
    )?;
    let row = stmt
        .query_row(params![quote_id], |row| {
            Ok(QuoteRow {
                id: row.get(0)?,
                name: row.get(1)?,
                event_date: row.get(2)?,
                rental_start: row.get(3)?,
                rental_end: row.get(4)?,
                delivery_date: row.get(5)?,
                pickup_date: row.get(6)?,
                has_unsigned_changes: row.get::<_, Option<i64>>(7)?.unwrap_or(0),
                status: row.get(8)?,
                signed_at: row.get(9)?,
            })
        })
        .ok();
    Ok(row)
}

fn get_target_range_for_quote(conn: &Connection, quote_id: i64, section_id: Option<i64>) -> Result<(Option<QuoteRow>, Option<RangeWindow>)> {
    let quote = load_quote(conn, quote_id)?;
    let Some(quote_row) = quote.clone() else {
        return Ok((None, None));
    };
    if let Some(section_id) = section_id {
        let mut stmt = conn.prepare(
            "SELECT delivery_date, rental_start, rental_end, pickup_date FROM quote_item_sections WHERE id = ? AND quote_id = ?",
        )?;
        let section_row: Option<(Option<String>, Option<String>, Option<String>, Option<String>)> = stmt
            .query_row(params![section_id, quote_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .ok();
        if let Some((delivery_date, rental_start, rental_end, pickup_date)) = section_row {
            let range = get_range_from_source(
                delivery_date,
                rental_start,
                rental_end,
                pickup_date,
                None,
            )
            .or_else(|| {
                get_range_from_source(
                    quote_row.delivery_date.clone(),
                    quote_row.rental_start.clone(),
                    quote_row.rental_end.clone(),
                    quote_row.pickup_date.clone(),
                    quote_row.event_date.clone(),
                )
            });
            return Ok((Some(quote_row), range));
        }
    }
    let range = get_range_from_source(
        quote_row.delivery_date.clone(),
        quote_row.rental_start.clone(),
        quote_row.rental_end.clone(),
        quote_row.pickup_date.clone(),
        quote_row.event_date.clone(),
    );
    Ok((Some(quote_row), range))
}

fn get_active_set_aside_quantities(conn: &Connection, item_ids: &[i64]) -> Result<HashMap<i64, i64>> {
    if item_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let sql = format!(
        "SELECT item_id, COALESCE(SUM(quantity), 0) AS quantity FROM item_set_asides WHERE resolved_at IS NULL AND item_id IN ({}) GROUP BY item_id",
        placeholder_csv(item_ids.len())
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(item_ids.iter()), |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))?;
    let mut map = HashMap::new();
    for row in rows {
        let (item_id, quantity) = row?;
        map.insert(item_id, quantity);
    }
    Ok(map)
}

fn load_item_stock_rows(conn: &Connection, item_ids: &[i64]) -> Result<Vec<(i64, i64)>> {
    let sql = format!(
        "SELECT id, quantity_in_stock FROM items WHERE id IN ({})",
        placeholder_csv(item_ids.len())
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(item_ids.iter()), |row| Ok((row.get::<_, i64>(0)?, row.get::<_, Option<i64>>(1)?.unwrap_or(0))))?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn load_other_quotes(conn: &Connection, quote_id: i64, item_ids: &[i64]) -> Result<Vec<QuoteRow>> {
    let sql = format!(
        r#"
        SELECT DISTINCT q.id, q.name, q.event_date, q.rental_start, q.rental_end,
               q.delivery_date, q.pickup_date, q.has_unsigned_changes, q.status, c.signed_at
        FROM quotes q
        JOIN quote_items qi ON qi.quote_id = q.id
        LEFT JOIN contracts c ON c.quote_id = q.id
        WHERE q.id != ? AND qi.item_id IN ({})
          AND COALESCE(q.status, 'draft') != 'closed'
        "#,
        placeholder_csv(item_ids.len())
    );
    let params = std::iter::once(quote_id).chain(item_ids.iter().copied()).collect::<Vec<_>>();
    let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params_from_iter(params.iter()), |row| {
            Ok(QuoteRow {
                id: row.get(0)?,
                name: row.get(1)?,
                event_date: row.get(2)?,
                rental_start: row.get(3)?,
                rental_end: row.get(4)?,
            delivery_date: row.get(5)?,
            pickup_date: row.get(6)?,
            has_unsigned_changes: row.get::<_, Option<i64>>(7)?.unwrap_or(0),
            status: row.get(8)?,
            signed_at: row.get(9)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn load_current_item_entries(conn: &Connection, quote_ids: &[i64], item_ids: &[i64]) -> Result<HashMap<i64, Vec<ReservationEntry>>> {
    if quote_ids.is_empty() || item_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let sql = format!(
        r#"
        SELECT
          qi.quote_id,
          qi.item_id,
          qi.section_id,
          qi.quantity,
          q.event_date,
          q.delivery_date AS quote_delivery_date,
          q.rental_start AS quote_rental_start,
          q.rental_end AS quote_rental_end,
          q.pickup_date AS quote_pickup_date,
          s.delivery_date AS section_delivery_date,
          s.rental_start AS section_rental_start,
          s.rental_end AS section_rental_end,
          s.pickup_date AS section_pickup_date
        FROM quote_items qi
        JOIN quotes q ON q.id = qi.quote_id
        LEFT JOIN quote_item_sections s ON s.id = qi.section_id
        WHERE qi.quote_id IN ({}) AND qi.item_id IN ({})
        "#,
        placeholder_csv(quote_ids.len()),
        placeholder_csv(item_ids.len())
    );
    let params = quote_ids.iter().copied().chain(item_ids.iter().copied()).collect::<Vec<_>>();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(params.iter()), |row| {
        let range = if row.get::<_, Option<i64>>(2)?.is_some() {
            get_range_from_source(
                row.get(9)?,
                row.get(10)?,
                row.get(11)?,
                row.get(12)?,
                None,
            )
        } else {
            get_range_from_source(
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
                row.get(4)?,
            )
        };
        Ok((
            row.get::<_, i64>(0)?,
            ReservationEntry {
                item_id: row.get(1)?,
                section_id: row.get(2)?,
                quantity: row.get::<_, Option<i64>>(3)?.unwrap_or(1),
                range,
            },
        ))
    })?;
    let mut grouped = HashMap::new();
    for row in rows {
        let (quote_id, entry) = row?;
        grouped.entry(quote_id).or_insert_with(Vec::new).push(entry);
    }
    Ok(grouped)
}

fn load_latest_signed_snapshot_entries(conn: &Connection, quote_ids: &[i64], item_ids: &[i64]) -> Result<HashMap<i64, Vec<ReservationEntry>>> {
    if quote_ids.is_empty() || item_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let sql = format!(
        r#"
        SELECT csi.quote_id, csi.item_id, csi.quantity, csi.range_start, csi.range_end
        FROM contract_signature_items csi
        JOIN (
          SELECT quote_id, MAX(signature_event_id) AS signature_event_id
          FROM contract_signature_items
          WHERE quote_id IN ({})
          GROUP BY quote_id
        ) latest
          ON latest.quote_id = csi.quote_id
         AND latest.signature_event_id = csi.signature_event_id
        WHERE csi.item_id IN ({})
        "#,
        placeholder_csv(quote_ids.len()),
        placeholder_csv(item_ids.len())
    );
    let params = quote_ids.iter().copied().chain(item_ids.iter().copied()).collect::<Vec<_>>();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(params.iter()), |row| {
        Ok((
            row.get::<_, i64>(0)?,
            ReservationEntry {
                item_id: row.get(1)?,
                section_id: None,
                quantity: row.get::<_, Option<i64>>(2)?.unwrap_or(1),
                range: match (row.get::<_, Option<String>>(3)?, row.get::<_, Option<String>>(4)?) {
                    (Some(start), Some(end)) => Some(RangeWindow { start, end }),
                    _ => None,
                },
            },
        ))
    })?;
    let mut grouped = HashMap::new();
    for row in rows {
        let (quote_id, entry) = row?;
        grouped.entry(quote_id).or_insert_with(Vec::new).push(entry);
    }
    Ok(grouped)
}

fn load_outstanding_fulfillment_rows(conn: &Connection, quote_ids: &[i64], item_ids: &[i64]) -> Result<HashMap<i64, Vec<ReservationEntry>>> {
    if quote_ids.is_empty() || item_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let sql = format!(
        r#"
        SELECT quote_id, item_id, range_start, range_end, quantity, checked_in_qty
        FROM quote_fulfillment_items
        WHERE quote_id IN ({})
          AND item_id IN ({})
          AND quantity > checked_in_qty
        "#,
        placeholder_csv(quote_ids.len()),
        placeholder_csv(item_ids.len())
    );
    let params = quote_ids.iter().copied().chain(item_ids.iter().copied()).collect::<Vec<_>>();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(params.iter()), |row| {
        let quantity = row.get::<_, Option<i64>>(4)?.unwrap_or(0) - row.get::<_, Option<i64>>(5)?.unwrap_or(0);
        Ok((
            row.get::<_, i64>(0)?,
            ReservationEntry {
                item_id: row.get(1)?,
                section_id: None,
                quantity: quantity.max(0),
                range: match (row.get::<_, Option<String>>(2)?, row.get::<_, Option<String>>(3)?) {
                    (Some(start), Some(end)) => Some(RangeWindow { start, end }),
                    _ => None,
                },
            },
        ))
    })?;
    let mut grouped = HashMap::new();
    for row in rows {
        let (quote_id, entry) = row?;
        grouped.entry(quote_id).or_insert_with(Vec::new).push(entry);
    }
    Ok(grouped)
}

fn build_quote_reservation_entries(conn: &Connection, quotes: &[QuoteRow], item_ids: &[i64]) -> Result<HashMap<i64, QuoteReservationEntries>> {
    let quote_ids = quotes.iter().map(|quote| quote.id).collect::<Vec<_>>();
    let current_entries = load_current_item_entries(conn, &quote_ids, item_ids)?;
    let signed_entries = load_latest_signed_snapshot_entries(conn, &quote_ids, item_ids)?;
    let fulfillment_entries = load_outstanding_fulfillment_rows(conn, &quote_ids, item_ids)?;
    let mut result = HashMap::new();

    for quote in quotes {
        let current = current_entries.get(&quote.id).cloned().unwrap_or_default();
        let signed = signed_entries.get(&quote.id).cloned().unwrap_or_default();
        let fulfillment = fulfillment_entries.get(&quote.id).cloned().unwrap_or_default();
        let mut entry = QuoteReservationEntries::default();

        if quote.has_unsigned_changes == 1 {
            let signed_map = aggregate_entries_by_item_and_section(&signed);
            let current_map = aggregate_entries_by_item_and_section(&current);
            entry.reserved = if !fulfillment.is_empty() {
                fulfillment
            } else if !signed_map.is_empty() {
                signed_map.values().cloned().collect::<Vec<_>>()
            } else {
                current.clone()
            };
            for (key, current_entry) in current_map {
                let signed_qty = signed_map.get(&key).map(|entry| entry.quantity).unwrap_or(0);
                let delta = (current_entry.quantity - signed_qty).max(0);
                if delta > 0 {
                    entry.potential.push(ReservationEntry {
                        item_id: current_entry.item_id,
                        section_id: current_entry.section_id,
                        quantity: delta,
                        range: current_entry.range,
                    });
                }
            }
            result.insert(quote.id, entry);
            continue;
        }

        if !fulfillment.is_empty() {
            entry.reserved = fulfillment;
        } else if is_quote_reserved(quote) {
            entry.reserved = current;
        } else {
            entry.potential = current;
        }

        result.insert(quote.id, entry);
    }

    Ok(result)
}

fn aggregate_entries_by_item_and_section(entries: &[ReservationEntry]) -> HashMap<String, ReservationEntry> {
    let mut map: HashMap<String, ReservationEntry> = HashMap::new();
    for entry in entries {
        let key = format!("{}::{}", entry.item_id, entry.section_id.map(|v| v.to_string()).unwrap_or_else(|| "null".to_string()));
        if let Some(existing) = map.get_mut(&key) {
            existing.quantity += entry.quantity;
        } else {
            map.insert(key, entry.clone());
        }
    }
    map
}

fn sum_overlapping_quantity(entries: &[ReservationEntry], item_id: i64, target_range: &Option<RangeWindow>) -> i64 {
    entries
        .iter()
        .filter(|entry| entry.item_id == item_id && ranges_overlap(target_range, &entry.range))
        .map(|entry| entry.quantity)
        .sum()
}

fn check_quote_items(conn: &Connection, quote_id: i64, item_ids: &[i64], section_id: Option<i64>) -> Result<BTreeMap<String, AvailabilityEntry>> {
    if item_ids.is_empty() {
        return Ok(BTreeMap::new());
    }
    let (quote, target_range) = get_target_range_for_quote(conn, quote_id, section_id)?;
    if quote.is_none() {
        return Err(anyhow!("quote not found"));
    }
    let item_rows = load_item_stock_rows(conn, item_ids)?;
    let set_asides = get_active_set_aside_quantities(conn, item_ids)?;

    if target_range.is_none() {
        return Ok(item_rows
            .into_iter()
            .map(|(item_id, quantity_in_stock)| {
                let set_aside_qty = *set_asides.get(&item_id).unwrap_or(&0);
                (
                    item_id.to_string(),
                    AvailabilityEntry {
                        stock: (quantity_in_stock - set_aside_qty).max(0),
                        reserved_qty: 0,
                        potential_qty: 0,
                        set_aside_qty,
                    },
                )
            })
            .collect());
    }

    let other_quotes = load_other_quotes(conn, quote_id, item_ids)?;
    let reservation_entries = build_quote_reservation_entries(conn, &other_quotes, item_ids)?;
    let mut result = BTreeMap::new();

    for (item_id, quantity_in_stock) in item_rows {
        let mut reserved_qty = 0;
        let mut potential_qty = 0;
        for other_quote in &other_quotes {
            let entries = reservation_entries.get(&other_quote.id).cloned().unwrap_or_default();
            reserved_qty += sum_overlapping_quantity(&entries.reserved, item_id, &target_range);
            potential_qty += sum_overlapping_quantity(&entries.potential, item_id, &target_range);
        }
        let set_aside_qty = *set_asides.get(&item_id).unwrap_or(&0);
        result.insert(
            item_id.to_string(),
            AvailabilityEntry {
                stock: (quantity_in_stock - set_aside_qty).max(0),
                reserved_qty,
                potential_qty,
                set_aside_qty,
            },
        );
    }

    Ok(result)
}

fn load_target_items(conn: &Connection, quote_id: i64) -> Result<Vec<QuoteItemRow>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT
          qi.item_id,
          qi.quantity,
          qi.section_id,
          i.quantity_in_stock,
          i.title,
          s.delivery_date AS section_delivery_date,
          s.rental_start AS section_rental_start,
          s.rental_end AS section_rental_end,
          s.pickup_date AS section_pickup_date
        FROM quote_items qi
        JOIN items i ON i.id = qi.item_id
        LEFT JOIN quote_item_sections s ON s.id = qi.section_id
        WHERE qi.quote_id = ?
        "#,
    )?;
    let rows = stmt.query_map(params![quote_id], |row| {
        Ok(QuoteItemRow {
            item_id: row.get(0)?,
            quantity: row.get::<_, Option<i64>>(1)?.unwrap_or(1),
            quantity_in_stock: row.get::<_, Option<i64>>(3)?.unwrap_or(0),
            section_delivery_date: row.get(5)?,
            section_rental_start: row.get(6)?,
            section_rental_end: row.get(7)?,
            section_pickup_date: row.get(8)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn load_all_quotes(conn: &Connection) -> Result<Vec<QuoteRow>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT q.id, q.name, q.event_date, q.rental_start, q.rental_end, q.delivery_date,
               q.pickup_date, q.has_unsigned_changes, q.status, c.signed_at
        FROM quotes q
        LEFT JOIN contracts c ON c.quote_id = q.id
        WHERE COALESCE(q.status, 'draft') != 'closed'
        "#,
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(QuoteRow {
            id: row.get(0)?,
            name: row.get(1)?,
            event_date: row.get(2)?,
            rental_start: row.get(3)?,
            rental_end: row.get(4)?,
            delivery_date: row.get(5)?,
            pickup_date: row.get(6)?,
            has_unsigned_changes: row.get::<_, Option<i64>>(7)?.unwrap_or(0),
            status: row.get(8)?,
            signed_at: row.get(9)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn get_quote_sections_map(conn: &Connection, quote_ids: &[i64]) -> Result<HashMap<i64, RangeWindow>> {
    if quote_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let sql = format!(
        "SELECT id, delivery_date, rental_start, rental_end, pickup_date FROM quote_item_sections WHERE quote_id IN ({})",
        placeholder_csv(quote_ids.len())
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(quote_ids.iter()), |row| {
        Ok((
            row.get::<_, i64>(0)?,
            get_range_from_source(row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, None),
        ))
    })?;
    let mut map = HashMap::new();
    for row in rows {
        let (section_id, range) = row?;
        if let Some(range) = range {
            map.insert(section_id, range);
        }
    }
    Ok(map)
}

fn load_conflict_items(conn: &Connection, quote_ids: &[i64], quotes: &HashMap<i64, QuoteRow>) -> Result<Vec<ConflictQuoteItemRow>> {
    let sql = format!(
        r#"
        SELECT qi.quote_id, qi.item_id, qi.quantity, qi.section_id, i.title, i.quantity_in_stock
        FROM quote_items qi
        JOIN items i ON i.id = qi.item_id
        WHERE qi.quote_id IN ({})
        "#,
        placeholder_csv(quote_ids.len())
    );
    let section_map = get_quote_sections_map(conn, quote_ids)?;
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(quote_ids.iter()), |row| {
        let quote_id = row.get::<_, i64>(0)?;
        let section_id = row.get::<_, Option<i64>>(3)?;
        let quote = quotes.get(&quote_id);
        let range = section_id
            .and_then(|value| section_map.get(&value).cloned())
            .or_else(|| {
                quote.and_then(|quote| {
                    get_range_from_source(
                        quote.delivery_date.clone(),
                        quote.rental_start.clone(),
                        quote.rental_end.clone(),
                        quote.pickup_date.clone(),
                        quote.event_date.clone(),
                    )
                })
            });
        Ok(ConflictQuoteItemRow {
            quote_id,
            item_id: row.get(1)?,
            quantity: row.get::<_, Option<i64>>(2)?.unwrap_or(1),
            title: row.get::<_, Option<String>>(4)?.unwrap_or_else(|| "Item".to_string()),
            quantity_in_stock: row.get::<_, Option<i64>>(5)?.unwrap_or(0),
            range,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn check_quote_summary(conn: &Connection, quote_id: i64) -> Result<QuoteSummaryResult> {
    let target_quote = load_quote(conn, quote_id)?.ok_or_else(|| anyhow!("quote not found"))?;
    let target_range = get_range_from_source(
        target_quote.delivery_date.clone(),
        target_quote.rental_start.clone(),
        target_quote.rental_end.clone(),
        target_quote.pickup_date.clone(),
        target_quote.event_date.clone(),
    );
    if target_range.is_none() {
        return Ok(QuoteSummaryResult {
            has_range: false,
            conflicts: BTreeMap::new(),
        });
    }

    let target_items = load_target_items(conn, quote_id)?;
    if target_items.is_empty() {
        return Ok(QuoteSummaryResult {
            has_range: true,
            conflicts: BTreeMap::new(),
        });
    }

    let count_oos = get_oos_setting(conn)?;
    let item_ids = {
        let mut ids = target_items.iter().map(|item| item.item_id).collect::<Vec<_>>();
        ids.sort();
        ids.dedup();
        ids
    };
    let set_asides = get_active_set_aside_quantities(conn, &item_ids)?;
    let other_quotes = load_other_quotes(conn, quote_id, &item_ids)?;
    let reservation_entries = build_quote_reservation_entries(conn, &other_quotes, &item_ids)?;
    let mut conflicts = BTreeMap::new();

    for item_id in item_ids {
        let rows = target_items.iter().filter(|item| item.item_id == item_id).collect::<Vec<_>>();
        let set_aside_qty = *set_asides.get(&item_id).unwrap_or(&0);
        let stock = (rows.first().map(|row| row.quantity_in_stock).unwrap_or(0) - set_aside_qty).max(0);
        let my_qty: i64 = rows.iter().map(|row| row.quantity).sum();

        if count_oos && stock == 0 {
            conflicts.insert(
                item_id.to_string(),
                QuoteConflictEntry {
                    status: "reserved".to_string(),
                    reason: Some("oos".to_string()),
                    reserved_qty: 0,
                    potential_qty: 0,
                    stock: 0,
                    my_qty,
                    set_aside_qty,
                },
            );
            continue;
        }

        let mut reserved_qty = 0;
        let mut potential_qty = 0;
        for row in &rows {
            let item_range = get_range_from_source(
                row.section_delivery_date.clone(),
                row.section_rental_start.clone(),
                row.section_rental_end.clone(),
                row.section_pickup_date.clone(),
                None,
            )
            .or_else(|| target_range.clone());
            for other_quote in &other_quotes {
                let entries = reservation_entries.get(&other_quote.id).cloned().unwrap_or_default();
                reserved_qty += sum_overlapping_quantity(&entries.reserved, item_id, &item_range);
                potential_qty += sum_overlapping_quantity(&entries.potential, item_id, &item_range);
            }
        }

        let status = if reserved_qty + my_qty > stock {
            "reserved"
        } else if reserved_qty + potential_qty + my_qty > stock {
            "potential"
        } else {
            "ok"
        };

        conflicts.insert(
            item_id.to_string(),
            QuoteConflictEntry {
                status: status.to_string(),
                reason: None,
                reserved_qty,
                potential_qty,
                stock,
                my_qty,
                set_aside_qty,
            },
        );
    }

    Ok(QuoteSummaryResult {
        has_range: true,
        conflicts,
    })
}

fn check_conflicts(conn: &Connection) -> Result<ConflictsResult> {
    let count_oos = get_oos_setting(conn)?;
    let all_quotes = load_all_quotes(conn)?;
    let quote_ids = all_quotes.iter().map(|quote| quote.id).collect::<Vec<_>>();
    if quote_ids.is_empty() {
        return Ok(ConflictsResult { conflicts: Vec::new() });
    }
    let quote_map = all_quotes.iter().map(|quote| (quote.id, quote.clone())).collect::<HashMap<_, _>>();
    let all_items = load_conflict_items(conn, &quote_ids, &quote_map)?;
    let mut item_ids = all_items.iter().map(|row| row.item_id).collect::<Vec<_>>();
    item_ids.sort();
    item_ids.dedup();
    let set_asides = get_active_set_aside_quantities(conn, &item_ids)?;
    let reservation_entries = build_quote_reservation_entries(conn, &all_quotes, &item_ids)?;
    let mut by_quote = HashMap::<i64, Vec<ConflictQuoteItemRow>>::new();
    for item in all_items {
        by_quote.entry(item.quote_id).or_default().push(item);
    }

    let mut results = Vec::new();
    for quote in &all_quotes {
        let items = by_quote.get(&quote.id).cloned().unwrap_or_default();
        if items.is_empty() {
            continue;
        }
        let mut quote_conflicts = Vec::new();
        for item in items {
            let set_aside_qty = *set_asides.get(&item.item_id).unwrap_or(&0);
            let stock = (item.quantity_in_stock - set_aside_qty).max(0);
            let my_qty = item.quantity.max(1);
            if count_oos && stock == 0 {
                quote_conflicts.push(ConflictListItem {
                    item_id: item.item_id,
                    title: item.title.clone(),
                    status: "reserved".to_string(),
                    quantity_needed: my_qty,
                    stock: 0,
                    reserved_qty: 0,
                    potential_qty: 0,
                    set_aside_qty,
                    shortage: my_qty,
                });
                continue;
            }
            let mut reserved_qty = 0;
            let mut potential_qty = 0;
            for other_quote in &all_quotes {
                if other_quote.id == quote.id {
                    continue;
                }
                let entries = reservation_entries.get(&other_quote.id).cloned().unwrap_or_default();
                reserved_qty += sum_overlapping_quantity(&entries.reserved, item.item_id, &item.range);
                potential_qty += sum_overlapping_quantity(&entries.potential, item.item_id, &item.range);
            }
            let status = if reserved_qty + my_qty > stock {
                "reserved"
            } else if reserved_qty + potential_qty + my_qty > stock {
                "potential"
            } else {
                "ok"
            };
            if status != "ok" {
                quote_conflicts.push(ConflictListItem {
                    item_id: item.item_id,
                    title: item.title.clone(),
                    status: status.to_string(),
                    quantity_needed: my_qty,
                    stock,
                    reserved_qty,
                    potential_qty,
                    set_aside_qty,
                    shortage: (reserved_qty + my_qty - stock).max(0),
                });
            }
        }
        if !quote_conflicts.is_empty() {
            results.push(ConflictListQuote {
                quote_id: quote.id,
                quote_name: quote.name.clone(),
                event_date: quote.event_date.clone(),
                rental_start: quote.rental_start.clone(),
                rental_end: quote.rental_end.clone(),
                delivery_date: quote.delivery_date.clone(),
                pickup_date: quote.pickup_date.clone(),
                is_reserved: is_quote_reserved(quote),
                status: quote.status.clone(),
                items: quote_conflicts,
            });
        }
    }
    results.sort_by(|a, b| {
        let a_red = if a.items.iter().any(|item| item.status == "reserved") { 0 } else { 1 };
        let b_red = if b.items.iter().any(|item| item.status == "reserved") { 0 } else { 1 };
        a_red
            .cmp(&b_red)
            .then_with(|| a.event_date.clone().unwrap_or_else(|| "9999".to_string()).cmp(&b.event_date.clone().unwrap_or_else(|| "9999".to_string())))
    });
    Ok(ConflictsResult { conflicts: results })
}

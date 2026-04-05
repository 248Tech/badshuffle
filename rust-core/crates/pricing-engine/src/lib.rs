use anyhow::{anyhow, Result};
use db::EngineDb;
use rusqlite::{params, Connection};
use shared_types::{PricingCheckRequest, PricingCheckResponse, QuotePricingResult};

#[derive(Debug, Clone)]
struct QuoteRow {
    id: i64,
    tax_rate: Option<f64>,
}

#[derive(Debug, Clone)]
struct QuoteItemRow {
    quantity: i64,
    hidden_from_quote: bool,
    unit_price_override: Option<f64>,
    discount_type: Option<String>,
    discount_amount: Option<f64>,
    unit_price: Option<f64>,
    taxable: bool,
    category: Option<String>,
}

#[derive(Debug, Clone)]
struct QuoteCustomItemRow {
    quantity: i64,
    unit_price: Option<f64>,
    taxable: bool,
}

#[derive(Debug, Clone)]
struct QuoteAdjustmentRow {
    adjustment_type: String,
    value_type: String,
    amount: f64,
}

pub fn handle_request(engine_db: &EngineDb, request: PricingCheckRequest) -> Result<PricingCheckResponse> {
    let conn = engine_db.open()?;
    let result = check_quote_pricing(&conn, request.quote_id, request.explicit_tax_rate)?;
    Ok(PricingCheckResponse {
        quote_id: request.quote_id,
        result,
    })
}

fn check_quote_pricing(conn: &Connection, quote_id: i64, explicit_tax_rate: Option<f64>) -> Result<QuotePricingResult> {
    let quote = load_quote(conn, quote_id)?.ok_or_else(|| anyhow!("quote not found"))?;
    let items = load_quote_items(conn, quote.id)?;
    let custom_items = load_quote_custom_items(conn, quote.id)?;
    let adjustments = load_quote_adjustments(conn, quote.id)?;

    let mut subtotal = 0.0_f64;
    let mut delivery_total = 0.0_f64;
    let mut custom_subtotal = 0.0_f64;
    let mut taxable_amount = 0.0_f64;

    for row in items {
        if row.hidden_from_quote {
            continue;
        }
        let mut unit_price = row.unit_price_override.unwrap_or(row.unit_price.unwrap_or(0.0));
        if row.discount_type.as_deref() == Some("percent") && row.discount_amount.unwrap_or(0.0) > 0.0 {
            unit_price *= 1.0 - row.discount_amount.unwrap_or(0.0) / 100.0;
        }
        if row.discount_type.as_deref() == Some("fixed") && row.discount_amount.unwrap_or(0.0) > 0.0 {
            unit_price = f64::max(0.0, unit_price - row.discount_amount.unwrap_or(0.0));
        }
        let line_total = unit_price * row.quantity as f64;
        if row
            .category
            .as_deref()
            .unwrap_or("")
            .to_ascii_lowercase()
            .contains("logistics")
        {
            delivery_total += line_total;
        } else {
            subtotal += line_total;
        }
        if row.taxable {
            taxable_amount += line_total;
        }
    }

    for row in custom_items {
        let line_total = row.quantity as f64 * row.unit_price.unwrap_or(0.0);
        custom_subtotal += line_total;
        if row.taxable {
            taxable_amount += line_total;
        }
    }

    let pre_tax = subtotal + delivery_total + custom_subtotal;
    let mut adjustment_total = 0.0_f64;
    for adj in adjustments {
        let value = if adj.value_type == "percent" {
            pre_tax * (adj.amount / 100.0)
        } else {
            adj.amount
        };
        if adj.adjustment_type == "discount" {
            adjustment_total -= value;
        } else {
            adjustment_total += value;
        }
    }

    let tax_rate = explicit_tax_rate.unwrap_or(quote.tax_rate.unwrap_or(0.0));
    let tax = if tax_rate > 0.0 {
        taxable_amount * (tax_rate / 100.0)
    } else {
        0.0
    };

    Ok(QuotePricingResult {
        subtotal,
        delivery_total,
        custom_subtotal,
        adjustment_total,
        taxable_amount,
        tax_rate,
        tax,
        total: pre_tax + adjustment_total + tax,
    })
}

fn load_quote(conn: &Connection, quote_id: i64) -> Result<Option<QuoteRow>> {
    let mut stmt = conn.prepare("SELECT id, tax_rate FROM quotes WHERE id = ?")?;
    let row = stmt
        .query_row(params![quote_id], |row| {
            Ok(QuoteRow {
                id: row.get(0)?,
                tax_rate: row.get(1)?,
            })
        })
        .ok();
    Ok(row)
}

fn load_quote_items(conn: &Connection, quote_id: i64) -> Result<Vec<QuoteItemRow>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT qi.quantity, qi.hidden_from_quote, qi.unit_price_override, qi.discount_type, qi.discount_amount,
               i.unit_price, i.taxable, i.category
        FROM quote_items qi
        JOIN items i ON i.id = qi.item_id
        WHERE qi.quote_id = ?
        "#,
    )?;
    let rows = stmt.query_map(params![quote_id], |row| {
        Ok(QuoteItemRow {
            quantity: row.get::<_, Option<i64>>(0)?.unwrap_or(1),
            hidden_from_quote: row.get::<_, Option<i64>>(1)?.unwrap_or(0) != 0,
            unit_price_override: row.get(2)?,
            discount_type: row.get(3)?,
            discount_amount: row.get(4)?,
            unit_price: row.get(5)?,
            taxable: row.get::<_, Option<i64>>(6)?.unwrap_or(0) != 0,
            category: row.get(7)?,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn load_quote_custom_items(conn: &Connection, quote_id: i64) -> Result<Vec<QuoteCustomItemRow>> {
    let mut stmt = conn.prepare("SELECT quantity, unit_price, taxable FROM quote_custom_items WHERE quote_id = ?")?;
    let rows = stmt.query_map(params![quote_id], |row| {
        Ok(QuoteCustomItemRow {
            quantity: row.get::<_, Option<i64>>(0)?.unwrap_or(1),
            unit_price: row.get(1)?,
            taxable: row.get::<_, Option<i64>>(2)?.unwrap_or(0) != 0,
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

fn load_quote_adjustments(conn: &Connection, quote_id: i64) -> Result<Vec<QuoteAdjustmentRow>> {
    let mut stmt = conn.prepare("SELECT type, value_type, amount FROM quote_adjustments WHERE quote_id = ?")?;
    let rows = stmt.query_map(params![quote_id], |row| {
        Ok(QuoteAdjustmentRow {
            adjustment_type: row.get::<_, Option<String>>(0)?.unwrap_or_else(|| "surcharge".to_string()),
            value_type: row.get::<_, Option<String>>(1)?.unwrap_or_else(|| "fixed".to_string()),
            amount: row.get::<_, Option<f64>>(2)?.unwrap_or(0.0),
        })
    })?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use config::AppConfig;
use db::EngineDb;
use inventory_engine::handle_request;
use pricing_engine::handle_request as handle_pricing_request;
use shared_types::{InventoryCheckRequest, PricingCheckRequest};
use std::{net::SocketAddr, sync::Arc, time::Instant};
use telemetry::{record_inventory, record_request, render_metrics};
use tracing::{error, info};

#[derive(Clone)]
struct AppState {
    db: EngineDb,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = AppConfig::from_env()?;
    telemetry::init(&config.log_level);

    let state = Arc::new(AppState {
        db: EngineDb::new(config.db_path.clone()),
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
        .route("/metrics", get(metrics))
        .route("/engine/inventory/check", post(check_inventory))
        .route("/engine/pricing/check", post(check_pricing))
        .with_state(state);

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    info!("badshuffle rust engine listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> impl IntoResponse {
    let start = Instant::now();
    let response = Json(serde_json::json!({ "ok": true }));
    record_request("/health", "ok", start.elapsed().as_secs_f64());
    response
}

async fn ready(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let start = Instant::now();
    let status = if state.db.open().is_ok() { "ok" } else { "error" };
    let response = if status == "ok" {
        (StatusCode::OK, Json(serde_json::json!({ "ok": true }))).into_response()
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({ "ok": false }))).into_response()
    };
    record_request("/ready", status, start.elapsed().as_secs_f64());
    response
}

async fn metrics() -> impl IntoResponse {
    let start = Instant::now();
    let body = render_metrics();
    record_request("/metrics", "ok", start.elapsed().as_secs_f64());
    (StatusCode::OK, body)
}

async fn check_inventory(
    State(state): State<Arc<AppState>>,
    Json(request): Json<InventoryCheckRequest>,
) -> Response {
    let route_start = Instant::now();
    let action_label = match request.action {
        shared_types::InventoryAction::QuoteItems => "quote_items",
        shared_types::InventoryAction::QuoteSummary => "quote_summary",
        shared_types::InventoryAction::Conflicts => "conflicts",
    };
    let engine_start = Instant::now();
    let response = match handle_request(&state.db, request) {
        Ok(payload) => {
            record_inventory(action_label, engine_start.elapsed().as_secs_f64());
            record_request("/engine/inventory/check", "ok", route_start.elapsed().as_secs_f64());
            (StatusCode::OK, Json(payload)).into_response()
        }
        Err(error_value) => {
            error!(error = %error_value, "inventory engine request failed");
            record_request("/engine/inventory/check", "error", route_start.elapsed().as_secs_f64());
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "inventory_engine_failed",
                    "message": error_value.to_string(),
                })),
            )
                .into_response()
        }
    };
    response
}

async fn check_pricing(
    State(state): State<Arc<AppState>>,
    Json(request): Json<PricingCheckRequest>,
) -> Response {
    let route_start = Instant::now();
    let response = match handle_pricing_request(&state.db, request) {
        Ok(payload) => {
            record_request("/engine/pricing/check", "ok", route_start.elapsed().as_secs_f64());
            (StatusCode::OK, Json(payload)).into_response()
        }
        Err(error_value) => {
            error!(error = %error_value, "pricing engine request failed");
            record_request("/engine/pricing/check", "error", route_start.elapsed().as_secs_f64());
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "pricing_engine_failed",
                    "message": error_value.to_string(),
                })),
            )
                .into_response()
        }
    };
    response
}

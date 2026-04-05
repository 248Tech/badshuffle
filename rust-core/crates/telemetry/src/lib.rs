use once_cell::sync::Lazy;
use prometheus::{
    register_histogram_vec, register_int_counter_vec, Encoder, HistogramVec, IntCounterVec, TextEncoder,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

static REQUEST_COUNT: Lazy<IntCounterVec> = Lazy::new(|| {
    register_int_counter_vec!("badshuffle_rust_requests_total", "Request count", &["route", "status"])
        .expect("request counter")
});

static REQUEST_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "badshuffle_rust_request_duration_seconds",
        "Request duration",
        &["route"]
    )
    .expect("request histogram")
});

static ENGINE_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "badshuffle_rust_inventory_duration_seconds",
        "Inventory engine duration",
        &["action"]
    )
    .expect("engine histogram")
});

pub fn init(log_level: &str) {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(log_level));
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .init();
}

pub fn record_request(route: &str, status: &str, seconds: f64) {
    REQUEST_COUNT.with_label_values(&[route, status]).inc();
    REQUEST_DURATION.with_label_values(&[route]).observe(seconds);
}

pub fn record_inventory(action: &str, seconds: f64) {
    ENGINE_DURATION.with_label_values(&[action]).observe(seconds);
}

pub fn render_metrics() -> String {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder
        .encode(&metric_families, &mut buffer)
        .expect("encode metrics");
    String::from_utf8(buffer).expect("metrics utf8")
}

use anyhow::{Context, Result};
use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub db_path: PathBuf,
    pub log_level: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        let host = env::var("RUST_ENGINE_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let port = env::var("RUST_ENGINE_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(3101);
        let db_path = env::var("RUST_ENGINE_DB_PATH")
            .or_else(|_| env::var("DB_PATH"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("server/badshuffle.db"));
        let log_level = env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
        let db_path = if db_path.is_absolute() {
            db_path
        } else {
            std::env::current_dir()
                .context("failed to read current dir")?
                .join(db_path)
        };
        Ok(Self {
            host,
            port,
            db_path,
            log_level,
        })
    }
}

// PTY Server Main Program
mod server;
mod pty_session;
mod shell;

use server::{Server, ServerConfig};
use std::env;

/// Logging macro
macro_rules! log_info {
    ($($arg:tt)*) => {
        eprintln!("[INFO] {}", format!($($arg)*));
    };
}

macro_rules! log_debug {
    ($($arg:tt)*) => {
        if cfg!(debug_assertions) {
            eprintln!("[DEBUG] {}", format!($($arg)*));
        }
    };
}

/// Parse command line arguments
fn parse_args() -> u16 {
    let args: Vec<String> = env::args().collect();
    let mut port: u16 = 0;
    
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "-p" | "--port" => {
                if i + 1 < args.len() {
                    port = args[i + 1].parse().unwrap_or(0);
                    i += 1;
                }
            }
            arg if arg.starts_with("--port=") => {
                port = arg.trim_start_matches("--port=").parse().unwrap_or(0);
            }
            "-h" | "--help" => {
                eprintln!("Usage: pty-server [OPTIONS]");
                eprintln!("Options:");
                eprintln!("  -p, --port <PORT>  Listen port (0 for random port) [default: 0]");
                eprintln!("  -h, --help         Show help information");
                std::process::exit(0);
            }
            _ => {}
        }
        i += 1;
    }
    
    port
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse command line arguments
    let port = parse_args();

    log_debug!("Startup args: port={}", port);

    // Create server config
    let config = ServerConfig { port };

    // Create and start server
    let server = Server::new(config);
    let port = server.start().await?;

    // Keep main thread running
    log_info!("PTY server started, listening on port: {}", port);
    
    // Wait for Ctrl+C signal
    tokio::signal::ctrl_c().await?;
    log_info!("Received exit signal, shutting down server...");

    Ok(())
}

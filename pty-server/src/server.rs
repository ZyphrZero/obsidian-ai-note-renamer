// WebSocket Server Implementation
use tokio::net::TcpListener;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use futures_util::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use crate::pty_session::PtySession;
use tokio::sync::Mutex as TokioMutex;
use std::sync::{Arc, Mutex};

/// Logging macros
macro_rules! log_info {
    ($($arg:tt)*) => {
        eprintln!("[INFO] {}", format!($($arg)*));
    };
}

macro_rules! log_error {
    ($($arg:tt)*) => {
        eprintln!("[ERROR] {}", format!($($arg)*));
    };
}

macro_rules! log_debug {
    ($($arg:tt)*) => {
        if cfg!(debug_assertions) {
            eprintln!("[DEBUG] {}", format!($($arg)*));
        }
    };
}

/// WebSocket command message
#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "type")]
pub enum Command {
    #[serde(rename = "resize")]
    Resize { cols: u16, rows: u16 },
    
    #[serde(rename = "env")]
    Env {
        #[serde(skip_serializing_if = "Option::is_none")]
        cwd: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        env: Option<std::collections::HashMap<String, String>>,
    },
    
    #[serde(rename = "init")]
    Init {
        #[serde(skip_serializing_if = "Option::is_none")]
        shell_type: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        shell_args: Option<Vec<String>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        cwd: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        env: Option<std::collections::HashMap<String, String>>,
    },
}

/// WebSocket server configuration
pub struct ServerConfig {
    pub port: u16,
}

/// WebSocket server
pub struct Server {
    config: ServerConfig,
}

impl Server {
    pub fn new(config: ServerConfig) -> Self {
        Self { config }
    }

    /// Start the server
    pub async fn start(&self) -> Result<u16, Box<dyn std::error::Error>> {
        let addr = format!("127.0.0.1:{}", self.config.port);
        let listener = TcpListener::bind(&addr).await?;
        let local_addr = listener.local_addr()?;
        let port = local_addr.port();

        log_info!("Server bound to {}", local_addr);

        // Output port info to stdout (JSON format)
        println!(
            r#"{{"port": {}, "pid": {}}}"#,
            port,
            std::process::id()
        );

        // Main loop: accept WebSocket connections
        tokio::spawn(async move {
            log_info!("Listening for WebSocket connections...");
            while let Ok((stream, addr)) = listener.accept().await {
                log_debug!("Accepted connection from {}", addr);
                tokio::spawn(async move {
                    if let Err(e) = handle_connection(stream).await {
                        log_error!("Connection handling error: {}", e);
                    }
                });
            }
        });

        Ok(port)
    }
}

/// Handle a single WebSocket connection
async fn handle_connection(
    stream: tokio::net::TcpStream,
) -> Result<(), Box<dyn std::error::Error>> {
    // Upgrade to WebSocket
    let ws_stream = accept_async(stream).await?;
    
    log_info!("WebSocket connection established");
    
    // Split read/write streams
    let (ws_sender, mut ws_receiver) = ws_stream.split();
    let ws_sender = Arc::new(TokioMutex::new(ws_sender));
    
    // Wait for first message (should be init command)
    let mut shell_type: Option<String> = None;
    let mut shell_args: Option<Vec<String>> = None;
    let mut cwd: Option<String> = None;
    let mut env: Option<std::collections::HashMap<String, String>> = None;
    let mut first_msg_processed = false;
    
    if let Some(Ok(Message::Text(text))) = ws_receiver.next().await {
        if let Ok(Command::Init { shell_type: st, shell_args: sa, cwd: c, env: e }) = serde_json::from_str::<Command>(&text) {
            log_info!("Received init command, shell_type: {:?}, shell_args: {:?}, cwd: {:?}", st, sa, c);
            shell_type = st;
            shell_args = sa;
            cwd = c;
            env = e;
            first_msg_processed = true;
        }
    }
    
    if !first_msg_processed {
        log_info!("No init command received, using default config");
    }
    
    // Create PTY session (reader and writer are independent, no lock needed)
    let (pty_session, pty_reader, pty_writer) = PtySession::new(
        80, 
        24, 
        shell_type.as_deref(), 
        shell_args.as_ref().map(|v| v.as_slice()),
        cwd.as_deref(),
        env.as_ref()
    )?;
    let pty_session = Arc::new(TokioMutex::new(pty_session));
    
    // Wrap reader and writer in Arc<Mutex<>> for sharing between tasks
    let pty_reader = Arc::new(Mutex::new(pty_reader));
    let pty_writer = Arc::new(Mutex::new(pty_writer));
    
    log_info!("PTY session created, shell_type: {:?}", shell_type);
    
    // Clone for read task
    let ws_sender_for_read = Arc::clone(&ws_sender);
    let pty_reader_for_read = Arc::clone(&pty_reader);
    
    // Clone for shell integration injection
    let pty_writer_for_init = Arc::clone(&pty_writer);
    let shell_type_for_init = shell_type.clone();
    
    // Start PTY output read task
    let read_task = tokio::spawn(async move {
        let mut first_output = true;
        
        loop {
            // Read PTY output in blocking task
            let reader = Arc::clone(&pty_reader_for_read);
            let result = tokio::task::spawn_blocking(move || -> Result<(Vec<u8>, usize), String> {
                let mut reader = reader.lock().unwrap();
                let mut local_buf = vec![0u8; 8192];
                match reader.read(&mut local_buf) {
                    Ok(n) => Ok((local_buf, n)),
                    Err(e) => Err(e.to_string()),
                }
            }).await;
            
            match result {
                Ok(Ok((data, n))) if n > 0 => {
                    log_debug!("Read PTY output: {} bytes", n);
                    // Send to WebSocket
                    let mut sender = ws_sender_for_read.lock().await;
                    if let Err(e) = sender.send(Message::Binary(data[..n].to_vec())).await {
                        log_error!("Failed to send PTY output: {}", e);
                        break;
                    }
                    drop(sender);
                    
                    // After first output, inject Shell Integration script
                    if first_output {
                        first_output = false;
                        if let Some(ref st) = shell_type_for_init {
                            if let Some(script) = crate::shell::get_shell_integration_script(st) {
                                let mut writer = pty_writer_for_init.lock().unwrap();
                                if let Err(e) = writer.write(script.as_bytes()) {
                                    log_error!("Failed to send Shell Integration script: {}", e);
                                } else {
                                    log_debug!("Shell Integration script sent");
                                }
                            }
                        }
                    }
                }
                Ok(Ok(_)) => {
                    // EOF
                    log_info!("PTY output ended");
                    break;
                }
                Ok(Err(e)) => {
                    log_error!("PTY output read error: {}", e);
                    break;
                }
                Err(e) => {
                    log_error!("PTY read task error: {}", e);
                    break;
                }
            }
        }
    });
    
    // Clone for write
    let pty_writer_for_write = Arc::clone(&pty_writer);
    
    // Message handling loop
    while let Some(msg_result) = ws_receiver.next().await {
        match msg_result {
            Ok(msg) => {
                log_debug!("Received message type: {:?}", std::mem::discriminant(&msg));
                
                match msg {
                    Message::Text(text) => {
                        // Try to parse as JSON command
                        if let Ok(cmd) = serde_json::from_str::<Command>(&text) {
                            log_debug!("Parsed command: {:?}", cmd);
                            handle_command(cmd, &pty_session).await?;
                        } else {
                            // Plain text input, write to PTY
                            log_debug!("Received text input: {} bytes", text.len());
                            let mut writer = pty_writer_for_write.lock().unwrap();
                            if let Err(e) = writer.write(text.as_bytes()) {
                                log_error!("Failed to write to PTY: {}", e);
                            }
                        }
                    }
                    Message::Binary(data) => {
                        // Binary input, write to PTY
                        log_debug!("Received binary input: {} bytes", data.len());
                        let mut writer = pty_writer_for_write.lock().unwrap();
                        if let Err(e) = writer.write(&data) {
                            log_error!("Failed to write to PTY: {}", e);
                        }
                    }
                    Message::Close(_) => {
                        log_info!("Client closed connection");
                        break;
                    }
                    Message::Ping(data) => {
                        // Respond to Ping
                        let mut sender = ws_sender.lock().await;
                        sender.send(Message::Pong(data)).await?;
                    }
                    Message::Pong(_) => {
                        // Ignore Pong
                    }
                    _ => {
                        log_debug!("Ignored message type");
                    }
                }
            }
            Err(e) => {
                log_error!("Message receive error: {}", e);
                break;
            }
        }
    }
    
    log_info!("WebSocket connection closed");
    
    // Terminate PTY process
    let mut pty = pty_session.lock().await;
    let _ = pty.kill();
    drop(pty); // Release lock
    
    // Wait for read task to finish
    let _ = read_task.await;
    
    Ok(())
}

/// Handle command message
async fn handle_command(
    cmd: Command,
    pty_session: &Arc<TokioMutex<PtySession>>,
) -> Result<(), Box<dyn std::error::Error>> {
    match cmd {
        Command::Resize { cols, rows } => {
            log_info!("Received resize command: {}x{}", cols, rows);
            let mut pty = pty_session.lock().await;
            pty.resize(cols, rows)?;
        }
        Command::Env { cwd, env } => {
            log_info!("Received env command: cwd={:?}, env={:?}", cwd, env);
            // Note: Environment variables and working directory should be set at PTY creation
            // This is just logged here, actual implementation needs to handle at creation time
        }
        Command::Init { .. } => {
            log_info!("Received init command (already handled at connection establishment)");
            // Init command already handled at connection establishment, ignore here
        }
    }
    Ok(())
}

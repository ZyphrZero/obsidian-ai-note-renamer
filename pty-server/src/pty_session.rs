// PTY Session Management
use portable_pty::{native_pty_system, Child, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

/// PTY Session
pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

/// PTY Reader (independent, no lock needed)
pub struct PtyReader {
    reader: Box<dyn Read + Send>,
}

/// PTY Writer (independent, no lock needed)
pub struct PtyWriter {
    writer: Box<dyn Write + Send>,
}

impl PtySession {
    /// Create a new PTY session, returns (session, reader, writer)
    /// shell_type: Optional shell type (cmd, powershell, wsl, bash, zsh, custom:/path)
    /// shell_args: Optional shell startup arguments
    /// cwd: Optional working directory
    /// env: Optional environment variables
    pub fn new(
        cols: u16, 
        rows: u16, 
        shell_type: Option<&str>,
        shell_args: Option<&[String]>,
        cwd: Option<&str>,
        env: Option<&std::collections::HashMap<String, String>>
    ) -> Result<(Self, PtyReader, PtyWriter), Box<dyn std::error::Error>> {
        // Get PTY system
        let pty_system = native_pty_system();
        
        // Create PTY pair
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        
        // Get command based on shell type
        let mut cmd = crate::shell::get_shell_by_type(shell_type);
        
        // Add startup arguments
        if let Some(args) = shell_args {
            for arg in args {
                cmd.arg(arg);
            }
        }
        
        // Set working directory
        if let Some(cwd_path) = cwd {
            cmd.cwd(cwd_path);
        }
        
        // Set environment variables
        // Ensure TERM environment variable exists, otherwise clear/vim etc. won't work properly
        let term_value = env
            .and_then(|e| e.get("TERM").cloned())
            .or_else(|| std::env::var("TERM").ok())
            .unwrap_or_else(|| "xterm-256color".to_string());
        cmd.env("TERM", term_value);
        
        // Set UTF-8 locale environment variables to ensure non-ASCII characters display correctly
        // Priority: user-provided value > system environment variable > UTF-8 default
        let locale_vars = ["LANG", "LC_ALL", "LC_CTYPE"];
        for var in &locale_vars {
            let value = env
                .and_then(|e| e.get(*var).cloned())
                .or_else(|| std::env::var(*var).ok())
                .unwrap_or_else(|| {
                    // macOS/Linux default to en_US.UTF-8 for UTF-8 encoding
                    "en_US.UTF-8".to_string()
                });
            cmd.env(*var, value);
        }
        
        // Set other custom environment variables
        if let Some(env_vars) = env {
            for (key, value) in env_vars {
                // Skip already processed environment variables
                if key != "TERM" && !locale_vars.contains(&key.as_str()) {
                    cmd.env(key, value);
                }
            }
        }
        
        // Mark this as Smart Workflow terminal
        cmd.env("TERM_PROGRAM", "smart-workflow");
        
        // Start shell process
        let child = pair.slave.spawn_command(cmd)?;
        
        // Get reader and writer (independent, no lock needed)
        let reader = PtyReader {
            reader: pair.master.try_clone_reader()?,
        };
        let writer = PtyWriter {
            writer: pair.master.take_writer()?,
        };
        
        let session = Self {
            master: pair.master,
            child: Arc::new(Mutex::new(child)),
        };
        
        Ok((session, reader, writer))
    }

    /// Resize PTY
    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<(), Box<dyn std::error::Error>> {
        self.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }
    
    /// Terminate child process
    pub fn kill(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if let Ok(mut child) = self.child.lock() {
            child.kill()?;
        }
        Ok(())
    }
}

impl PtyReader {
    /// Read data from PTY
    pub fn read(&mut self, buf: &mut [u8]) -> Result<usize, Box<dyn std::error::Error>> {
        let n = self.reader.read(buf)?;
        Ok(n)
    }
}

impl PtyWriter {
    /// Write data to PTY
    pub fn write(&mut self, data: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
        self.writer.write_all(data)?;
        self.writer.flush()?;
        Ok(())
    }
}

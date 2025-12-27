# PTY Server

A cross-platform WebSocket PTY server based on Rust and portable-pty, providing terminal functionality for the Smart Workflow Obsidian plugin.

## Overview

PTY Server is a lightweight WebSocket server that manages pseudo-terminal (PTY) sessions. It supports multiple concurrent terminal sessions, automatic shell detection, and provides a cross-platform terminal experience.

## Project Structure

```
pty-server/
├── Cargo.toml           # Project configuration and dependencies
├── src/
│   ├── main.rs          # Main entry point, CLI argument parsing
│   ├── server.rs        # WebSocket server implementation
│   ├── pty_session.rs   # PTY session management
│   └── shell.rs         # Shell detection and configuration
└── target/              # Build output directory
```

## Core Dependencies

- `portable-pty` 0.8 - Cross-platform PTY library for Windows/macOS/Linux
- `tokio` 1.x - Async runtime for high-performance concurrency
- `tokio-tungstenite` 0.21 - WebSocket server implementation
- `serde` + `serde_json` - JSON message serialization/deserialization
- `clap` 4.5 - Command line argument parsing

## Building

### Local Development Build

```bash
# Development build (with debug info)
cargo build

# Release build (optimized for size and performance)
cargo build --release

# Run tests
cargo test
```

### Cross-Platform Build

Use the project's build script:

```bash
# Build for current platform
pnpm build:rust
```

Build artifacts are output to the `binaries/` directory:
- `pty-server-win32-x64.exe` - Windows x64
- `pty-server-darwin-x64` - macOS Intel
- `pty-server-darwin-arm64` - macOS Apple Silicon
- `pty-server-linux-x64` - Linux x64

## Usage

### Command Line Arguments

```bash
# Start server (random port)
./pty-server

# Specify port
./pty-server --port 8080

# Disable colored logs
./pty-server --no-color

# Show help
./pty-server --help
```

### Startup Flow

1. Server starts and binds to specified port (random by default)
2. Outputs actual listening port to stdout
3. Waits for WebSocket connections
4. Creates independent PTY session for each connection

## Communication Protocol

### WebSocket Message Format

All messages use JSON format with a `type` field to identify message type.

#### Client → Server

**Input Data**
```json
{
  "type": "input",
  "data": "ls -la\n"
}
```

**Resize Terminal**
```json
{
  "type": "resize",
  "cols": 80,
  "rows": 24
}
```

#### Server → Client

**Output Data**
```json
{
  "type": "output",
  "data": "total 48\ndrwxr-xr-x  12 user  staff   384 Dec 25 10:30 .\n..."
}
```

**Session Exit**
```json
{
  "type": "exit",
  "code": 0
}
```

## Architecture

### Async Concurrency Model

The server uses Tokio async runtime for efficient concurrent processing:

```
┌─────────────────────────────────────┐
│      WebSocket Server (Tokio)      │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   ┌────▼────┐         ┌────▼────┐
   │ Session │         │ Session │
   │    1    │   ...   │    N    │
   └────┬────┘         └────┬────┘
        │                   │
   ┌────▼────┐         ┌────▼────┐
   │  PTY 1  │         │  PTY N  │
   └─────────┘         └─────────┘
```

### Session Lifecycle

1. **Connection Established**: Accept WebSocket connection, create PTY session
2. **Shell Startup**: Auto-detect and start system default shell
3. **Data Forwarding**: 
   - WebSocket → PTY: User input
   - PTY → WebSocket: Terminal output
4. **Size Sync**: Handle terminal window resize
5. **Session Cleanup**: Clean up PTY process and resources on disconnect

### Shell Detection Logic

The server auto-detects available shells by priority:

**Windows**:
1. PowerShell 7+ (`pwsh.exe`)
2. PowerShell 5.x (`powershell.exe`)
3. CMD (`cmd.exe`)

**Unix/Linux/macOS**:
1. User default shell (`$SHELL` environment variable)
2. Bash (`/bin/bash`)
3. Zsh (`/bin/zsh`)
4. Sh (`/bin/sh`)

## Error Handling

The server implements comprehensive error handling:

- **Connection Errors**: Auto-close abnormal connections without affecting other sessions
- **PTY Creation Failure**: Return error message and close connection
- **Shell Startup Failure**: Try fallback shell, log detailed info
- **Message Parse Errors**: Ignore invalid messages, maintain connection stability

## Performance Optimization

- **Zero-Copy**: Use `Bytes` type to reduce memory copying
- **Async I/O**: All I/O operations are non-blocking
- **Resource Cleanup**: Immediately release resources on disconnect
- **Build Optimization**: Release builds enable LTO and symbol stripping

## Security Considerations

- **Local Binding**: Default listens only on `127.0.0.1`, not exposed externally
- **No Authentication**: Assumes client is on same host, managed by Obsidian plugin
- **Process Isolation**: Each session runs in independent process
- **Resource Limits**: Relies on OS process and file descriptor limits

## Log Output

The server uses colored logs (disable with `--no-color`):

- **Green**: Successful operations (server start, session creation)
- **Yellow**: Warnings (shell detection failure)
- **Red**: Errors (connection failure, PTY errors)
- **Blue**: Debug info (message received, data forwarding)

## Troubleshooting

### Server Won't Start

- Check if port is already in use
- Confirm sufficient system permissions
- Check error log output

### No Terminal Output

- Confirm WebSocket connection is established
- Check message format is correct
- Verify shell started successfully

### Character Encoding Issues

- Ensure terminal encoding is set to UTF-8
- On Windows, set `chcp 65001`
- Check shell locale configuration

## Development Testing

Use the project's test script:

```bash
# Run integration tests
node tests/test-pty-server.js
```

Test coverage includes:
- Server startup and port listening
- WebSocket connection establishment
- Command execution and output reception
- Terminal resize
- Session cleanup

## Plugin Integration

PTY Server is managed by the Obsidian plugin's `TerminalService`:

1. **Auto Download**: `BinaryManager` handles binary download and verification
2. **Lifecycle**: Server starts with plugin, stops on unload
3. **Crash Recovery**: Auto-restart on server crash detection
4. **Multi-Instance**: Multiple terminal tabs share the same server

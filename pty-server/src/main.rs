// PTY 服务器主程序
mod server;
mod pty_session;
mod shell;

use clap::Parser;
use server::{Server, ServerConfig};

/// PTY 服务器命令行参数
#[derive(Parser, Debug)]
#[command(name = "pty-server")]
#[command(about = "基于 portable-pty 的 WebSocket PTY 服务器", long_about = None)]
struct Args {
    /// 监听端口（0 表示随机端口）
    #[arg(short, long, default_value_t = 0)]
    port: u16,

    /// 禁用彩色日志
    #[arg(long, default_value_t = false)]
    no_color: bool,
}

/// 简单的日志宏
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

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 解析命令行参数
    let args = Args::parse();

    log_debug!("启动参数: {:?}", args);

    // 创建服务器配置
    let config = ServerConfig {
        port: args.port,
    };

    // 创建并启动服务器
    let server = Server::new(config);
    let port = server.start().await?;

    // 保持主线程运行
    log_info!("PTY 服务器已启动，监听端口: {}", port);
    
    // 等待 Ctrl+C 信号
    tokio::signal::ctrl_c().await?;
    log_info!("收到退出信号，正在关闭服务器...");

    Ok(())
}

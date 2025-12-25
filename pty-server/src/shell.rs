// Shell 检测和配置
use portable_pty::CommandBuilder;

/// 根据 shell 类型获取 Shell 命令
pub fn get_shell_by_type(shell_type: Option<&str>) -> CommandBuilder {
    match shell_type {
        Some("cmd") => CommandBuilder::new("cmd.exe"),
        Some("powershell") => {
            #[cfg(windows)]
            {
                // 优先使用 PowerShell Core (pwsh)，回退到 Windows PowerShell
                if let Ok(pwsh_path) = which_powershell() {
                    CommandBuilder::new(pwsh_path)
                } else {
                    CommandBuilder::new("powershell.exe")
                }
            }
            #[cfg(not(windows))]
            {
                // 非 Windows 平台，使用默认 shell
                get_default_shell()
            }
        }
        Some("wsl") => CommandBuilder::new("wsl.exe"),
        Some("bash") => CommandBuilder::new("bash"),
        Some("zsh") => CommandBuilder::new("zsh"),
        Some(custom) if custom.starts_with("custom:") => {
            // 自定义 shell 路径，格式: "custom:/path/to/shell"
            let path = &custom[7..]; // 去掉 "custom:" 前缀
            CommandBuilder::new(path)
        }
        _ => get_default_shell(), // None 或未知类型，使用默认
    }
}

/// 获取默认 Shell 命令
pub fn get_default_shell() -> CommandBuilder {
    #[cfg(windows)]
    {
        // Windows: 优先使用 PowerShell，回退到 CMD
        if let Ok(powershell_path) = which_powershell() {
            CommandBuilder::new(powershell_path)
        } else {
            CommandBuilder::new("cmd.exe")
        }
    }

    #[cfg(not(windows))]
    {
        // Unix: 从环境变量获取 SHELL，回退到 /bin/bash
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        CommandBuilder::new(shell)
    }
}

#[cfg(windows)]
fn which_powershell() -> Result<String, ()> {
    // 尝试查找 PowerShell
    let powershell_paths = vec![
        "pwsh.exe",           // PowerShell Core
        "powershell.exe",     // Windows PowerShell
    ];

    for path in powershell_paths {
        if std::process::Command::new(path)
            .arg("-Command")
            .arg("exit")
            .output()
            .is_ok()
        {
            return Ok(path.to_string());
        }
    }

    Err(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_default_shell() {
        // 只测试函数能够成功返回，不检查具体内容
        // 因为 CommandBuilder 不提供获取程序路径的公共 API
        let _shell = get_default_shell();
        // 如果能执行到这里，说明函数正常工作
    }
}

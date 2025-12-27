// Shell Detection and Configuration
use portable_pty::CommandBuilder;

/// Shell Integration scripts (injected via PTY)
/// Use space prefix to prevent command from entering history, use redirect to hide output
/// Note: bash/zsh default config doesn't record commands starting with space
/// Only used on Unix platforms, Windows relies on frontend prompt parsing

// Bash: Define function and set PROMPT_COMMAND, execute silently
#[cfg(not(windows))]
const SHELL_INTEGRATION_BASH: &str = " eval '__sw_cwd(){ printf \"\\e]7;file://%s%s\\e\\\\\" \"${HOSTNAME:-localhost}\" \"$PWD\";};PROMPT_COMMAND=\"__sw_cwd${PROMPT_COMMAND:+;$PROMPT_COMMAND}\"' 2>/dev/null;__sw_cwd;printf '\\ec'\n";

// Zsh: Use precmd hook, execute silently
#[cfg(not(windows))]
const SHELL_INTEGRATION_ZSH: &str = " eval '__sw_cwd(){ printf \"\\e]7;file://%s%s\\e\\\\\" \"${HOST:-localhost}\" \"$PWD\";};autoload -Uz add-zsh-hook;add-zsh-hook precmd __sw_cwd;add-zsh-hook chpwd __sw_cwd' 2>/dev/null;__sw_cwd;printf '\\ec'\n";

// Fish: Use event listener
#[cfg(not(windows))]
const SHELL_INTEGRATION_FISH: &str = " eval 'function __sw_cwd --on-variable PWD; printf \"\\e]7;file://%s%s\\e\\\\\" (hostname) $PWD; end' 2>/dev/null;__sw_cwd;printf '\\ec'\n";

/// Get shell integration script
/// Note: Windows platform shells don't use Shell Integration, rely on frontend prompt parsing
pub fn get_shell_integration_script(shell_type: &str) -> Option<&'static str> {
    // Windows platform doesn't inject scripts
    #[cfg(windows)]
    {
        let _ = shell_type; // Avoid unused warning
        None
    }
    
    // Unix platform uses Shell Integration
    #[cfg(not(windows))]
    {
        match shell_type {
            "bash" => Some(SHELL_INTEGRATION_BASH),
            "zsh" => Some(SHELL_INTEGRATION_ZSH),
            "fish" => Some(SHELL_INTEGRATION_FISH),
            _ => None,
        }
    }
}

/// Get Shell command based on shell type
pub fn get_shell_by_type(shell_type: Option<&str>) -> CommandBuilder {
    match shell_type {
        Some("cmd") => CommandBuilder::new("cmd.exe"),
        Some("powershell") => {
            #[cfg(windows)]
            {
                // Prefer PowerShell Core (pwsh), fallback to Windows PowerShell
                if let Ok(pwsh_path) = which_powershell() {
                    CommandBuilder::new(pwsh_path)
                } else {
                    CommandBuilder::new("powershell.exe")
                }
            }
            #[cfg(not(windows))]
            {
                // Non-Windows platform, use default shell
                get_default_shell()
            }
        }
        Some("wsl") => CommandBuilder::new("wsl.exe"),
        Some("gitbash") => {
            #[cfg(windows)]
            {
                // Git Bash: Try to find common installation paths
                if let Ok(bash_path) = which_gitbash() {
                    let mut cmd = CommandBuilder::new(bash_path);
                    // Add --login argument to load user config
                    cmd.arg("--login");
                    cmd
                } else {
                    // Fallback to default shell
                    get_default_shell()
                }
            }
            #[cfg(not(windows))]
            {
                // Non-Windows platform, use bash
                CommandBuilder::new("bash")
            }
        }
        Some("bash") => CommandBuilder::new("bash"),
        Some("zsh") => CommandBuilder::new("zsh"),
        Some(custom) if custom.starts_with("custom:") => {
            // Custom shell path, format: "custom:/path/to/shell"
            let path = &custom[7..]; // Remove "custom:" prefix
            CommandBuilder::new(path)
        }
        _ => get_default_shell(), // None or unknown type, use default
    }
}

/// Get default Shell command
pub fn get_default_shell() -> CommandBuilder {
    #[cfg(windows)]
    {
        // Windows: Default to CMD
        CommandBuilder::new("cmd.exe")
    }

    #[cfg(not(windows))]
    {
        // Unix: Get SHELL from environment variable, fallback to /bin/bash
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        CommandBuilder::new(shell)
    }
}

#[cfg(windows)]
fn which_powershell() -> Result<String, ()> {
    // Try to find PowerShell
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

#[cfg(windows)]
fn which_gitbash() -> Result<String, ()> {
    // Git Bash common installation paths
    let userprofile = std::env::var("USERPROFILE").unwrap_or_default();
    let gitbash_paths = vec![
        "C:\\Program Files\\Git\\bin\\bash.exe".to_string(),
        "C:\\Program Files (x86)\\Git\\bin\\bash.exe".to_string(),
        format!("{}\\AppData\\Local\\Programs\\Git\\bin\\bash.exe", userprofile),
    ];

    // Check if path exists
    for path in gitbash_paths {
        if std::path::Path::new(&path).exists() {
            return Ok(path);
        }
    }

    // Try to find from PATH environment variable
    if let Ok(output) = std::process::Command::new("where")
        .arg("bash.exe")
        .output()
    {
        if output.status.success() {
            if let Ok(stdout) = String::from_utf8(output.stdout) {
                // Get first line path
                if let Some(first_line) = stdout.lines().next() {
                    let path = first_line.trim();
                    // Ensure it's Git-installed bash
                    if path.contains("Git") {
                        return Ok(path.to_string());
                    }
                }
            }
        }
    }

    Err(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_default_shell() {
        // Only test that function returns successfully, don't check specific content
        // Because CommandBuilder doesn't provide public API to get program path
        let _shell = get_default_shell();
        // If we reach here, function works correctly
    }
}

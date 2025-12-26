/**
 * API 配置接口
 */
export interface APIConfig {
  id: string;                    // 配置 ID
  name: string;                  // 配置名称
  endpoint: string;              // API 端点
  apiKey: string;                // API 密钥
  model: string;                 // 模型名称
  temperature: number;           // 温度参数 (0-2)
  maxTokens: number;             // 最大 token 数
  topP: number;                  // Top P 参数 (0-1)
  promptTemplate: string;        // Prompt 模板
}

/** Windows 平台支持的 Shell 类型 */
export type WindowsShellType = 'cmd' | 'powershell' | 'wsl' | 'gitbash' | 'custom';

/** Unix 平台（macOS/Linux）支持的 Shell 类型 */
export type UnixShellType = 'bash' | 'zsh' | 'custom';

/** 所有 Shell 类型的联合 */
export type ShellType = WindowsShellType | UnixShellType;

/**
 * 平台特定的 Shell 配置
 */
export interface PlatformShellConfig {
  windows: WindowsShellType;
  darwin: UnixShellType;  // macOS
  linux: UnixShellType;
}

/**
 * 平台特定的自定义 Shell 路径
 */
export interface PlatformCustomShellPaths {
  windows: string;
  darwin: string;
  linux: string;
}

/**
 * 终端设置接口
 */
export interface TerminalSettings {
  // 各平台的默认 Shell 程序类型（独立存储）
  platformShells: PlatformShellConfig;

  // 各平台的自定义 Shell 路径（独立存储）
  platformCustomShellPaths: PlatformCustomShellPaths;

  // 默认启动参数
  shellArgs: string[];

  // 启动目录设置
  autoEnterVaultDirectory: boolean; // 打开终端时自动进入项目目录

  // 新实例行为：替换标签页、新标签页、新窗口、水平/垂直分屏、左侧/右侧标签页或分屏
  newInstanceBehavior: 'replaceTab' | 'newTab' | 'newLeftTab' | 'newLeftSplit' |
    'newRightTab' | 'newRightSplit' | 'newHorizontalSplit' | 'newVerticalSplit' | 'newWindow';

  // 在现有终端附近创建新实例
  createInstanceNearExistingOnes: boolean;

  // 聚焦新实例：创建新终端时是否自动切换到该标签页
  focusNewInstance: boolean;

  // 锁定新实例：新建终端标签页是否默认锁定
  lockNewInstance: boolean;

  // 终端外观设置
  fontSize: number;
  fontFamily: string;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;

  // 主题设置
  useObsidianTheme: boolean;      // 是否使用 Obsidian 主题颜色
  backgroundColor?: string;        // 自定义背景色
  foregroundColor?: string;        // 自定义前景色

  // 背景图片设置
  backgroundImage?: string;        // 背景图片 URL
  backgroundImageOpacity?: number; // 背景图片透明度 (0-1.0)
  backgroundImageSize?: 'cover' | 'contain' | 'auto'; // 背景图片大小
  backgroundImagePosition?: string; // 背景图片位置
  
  // 毛玻璃效果
  enableBlur?: boolean;            // 是否启用毛玻璃效果
  blurAmount?: number;             // 毛玻璃模糊程度 (0-20px)

  // 文本透明度
  textOpacity?: number;            // 文本透明度 (0-1.0)

  // 渲染器类型：Canvas（推荐）、WebGL（高性能）
  // 注意：DOM 渲染器已过时，存在光标定位等问题，不再提供
  preferredRenderer: 'canvas' | 'webgl';

  // 滚动缓冲区大小（行数）
  scrollback: number;

  // 终端面板默认高度（像素）
  defaultHeight: number;
}

/**
 * 功能显示设置接口
 */
export interface FeatureVisibilitySettings {
  // AI 文件名生成功能
  aiNaming: {
    showInCommandPalette: boolean;    // 命令面板
    showInEditorMenu: boolean;        // 编辑器右键菜单
    showInFileMenu: boolean;          // 文件浏览器右键菜单
    showInRibbon: boolean;            // 侧边栏图标
  };
  // 终端功能
  terminal: {
    showInCommandPalette: boolean;    // 命令面板
    showInRibbon: boolean;            // 侧边栏图标
    showInNewTab: boolean;            // 新标签页
  };
}

/**
 * 插件设置接口
 */
export interface SmartWorkflowSettings {
  configs: APIConfig[];          // 多配置列表
  activeConfigId: string;        // 当前活动配置 ID
  defaultPromptTemplate: string; // 默认 Prompt 模板
  useCurrentFileNameContext: boolean;  // 是否使用当前文件名作为上下文
  analyzeDirectoryNamingStyle: boolean; // 是否分析目录下其他文件命名风格
  debugMode: boolean;            // 调试模式（在控制台显示详细日志）
  timeout: number;               // 请求超时时间（毫秒）
  terminal: TerminalSettings;    // 终端设置
  featureVisibility: FeatureVisibilitySettings; // 功能显示设置
}

/**
 * 基础 Prompt 模板（不使用文件名上下文）
 * 仅根据笔记内容生成文件名
 */
export const BASE_PROMPT_TEMPLATE = `Generate a concise and accurate filename for the following note content.

Note content:
{{content}}

Requirements:
1. The filename should be concise and clear, no more than 10 characters
2. Accurately summarize the core content of the note
3. The language of the filename should match the primary language of the note content
4. Use Chinese or English, avoid special characters
5. Return only the filename itself, do not include the .md extension
6. Do not wrap the filename with quotes, angle brackets, or other symbols`;

/**
 * 高级 Prompt 模板
 * 支持文件名上下文和目录命名风格分析
 * 根据设置动态包含：
 * - 当前文件名（作为改进参考）
 * - 同目录文件的命名风格
 */
export const ADVANCED_PROMPT_TEMPLATE = `Generate a concise and accurate filename for the following note content.
{{#if currentFileName}}
Current filename: {{currentFileName}}
Please improve upon this filename to create a more accurate one.
{{/if}}
{{#if directoryNamingStyle}}
Reference naming style from other files in the directory:
{{directoryNamingStyle}}
{{/if}}

Note content:
{{content}}

Requirements:
1. The filename should be concise and clear, no more than 10 characters
2. Accurately summarize the core content of the note
3. The language of the filename should match the primary language of the note content
4. Use Chinese or English, avoid special characters
5. Return only the filename itself, do not include the .md extension
6. Do not wrap the filename with quotes, angle brackets, or other symbols`;

/**
 * 默认平台 Shell 配置
 */
export const DEFAULT_PLATFORM_SHELLS: PlatformShellConfig = {
  windows: 'powershell',
  darwin: 'zsh',
  linux: 'bash'
};

/**
 * 默认平台自定义 Shell 路径
 */
export const DEFAULT_PLATFORM_CUSTOM_SHELL_PATHS: PlatformCustomShellPaths = {
  windows: '',
  darwin: '',
  linux: ''
};

/**
 * 获取当前平台的 Shell 类型
 */
export function getCurrentPlatformShell(settings: TerminalSettings): ShellType {
  const platform = process.platform;
  if (platform === 'win32') {
    return settings.platformShells.windows;
  } else if (platform === 'darwin') {
    return settings.platformShells.darwin;
  } else {
    return settings.platformShells.linux;
  }
}

/**
 * 设置当前平台的 Shell 类型
 */
export function setCurrentPlatformShell(
  settings: TerminalSettings,
  shell: ShellType
): void {
  const platform = process.platform;
  if (platform === 'win32') {
    settings.platformShells.windows = shell as WindowsShellType;
  } else if (platform === 'darwin') {
    settings.platformShells.darwin = shell as UnixShellType;
  } else {
    settings.platformShells.linux = shell as UnixShellType;
  }
}

/**
 * 获取当前平台的自定义 Shell 路径
 */
export function getCurrentPlatformCustomShellPath(settings: TerminalSettings): string {
  const platform = process.platform;
  if (platform === 'win32') {
    return settings.platformCustomShellPaths.windows;
  } else if (platform === 'darwin') {
    return settings.platformCustomShellPaths.darwin;
  } else {
    return settings.platformCustomShellPaths.linux;
  }
}

/**
 * 设置当前平台的自定义 Shell 路径
 */
export function setCurrentPlatformCustomShellPath(
  settings: TerminalSettings,
  path: string
): void {
  const platform = process.platform;
  if (platform === 'win32') {
    settings.platformCustomShellPaths.windows = path;
  } else if (platform === 'darwin') {
    settings.platformCustomShellPaths.darwin = path;
  } else {
    settings.platformCustomShellPaths.linux = path;
  }
}

/**
 * 默认终端设置
 */
export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  platformShells: { ...DEFAULT_PLATFORM_SHELLS },
  platformCustomShellPaths: { ...DEFAULT_PLATFORM_CUSTOM_SHELL_PATHS },
  shellArgs: [],
  autoEnterVaultDirectory: true,
  newInstanceBehavior: 'newHorizontalSplit',
  createInstanceNearExistingOnes: true,
  focusNewInstance: true,
  lockNewInstance: false,
  fontSize: 14,
  fontFamily: 'Consolas, "Courier New", monospace',
  cursorStyle: 'block',
  cursorBlink: true,
  useObsidianTheme: true,
  preferredRenderer: 'canvas',
  scrollback: 1000,
  defaultHeight: 300,
  backgroundImageOpacity: 0.5,
  backgroundImageSize: 'cover',
  backgroundImagePosition: 'center',
  enableBlur: false,
  blurAmount: 10,
  textOpacity: 1.0
};

/**
 * 默认功能显示设置
 */
export const DEFAULT_FEATURE_VISIBILITY: FeatureVisibilitySettings = {
  aiNaming: {
    showInCommandPalette: true,
    showInEditorMenu: true,
    showInFileMenu: true,
    showInRibbon: true
  },
  terminal: {
    showInCommandPalette: true,
    showInRibbon: true,
    showInNewTab: true
  }
};

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: SmartWorkflowSettings = {
  configs: [
    {
      id: 'default',
      name: 'Default',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 300,
      topP: 1.0,
      promptTemplate: ADVANCED_PROMPT_TEMPLATE
    }
  ],
  activeConfigId: 'default',
  defaultPromptTemplate: ADVANCED_PROMPT_TEMPLATE,
  useCurrentFileNameContext: true,  // 默认使用当前文件名上下文
  analyzeDirectoryNamingStyle: false, // 默认不分析目录命名风格（性能考虑）
  debugMode: false, // 默认关闭调试模式
  timeout: 15000, // 默认超时时间 15 秒
  terminal: DEFAULT_TERMINAL_SETTINGS, // 终端默认设置
  featureVisibility: DEFAULT_FEATURE_VISIBILITY // 功能显示默认设置
};

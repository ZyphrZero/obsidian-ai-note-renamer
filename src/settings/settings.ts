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

/**
 * 插件设置接口
 */
export interface AIFileNamerSettings {
  configs: APIConfig[];          // 多配置列表
  activeConfigId: string;        // 当前活动配置 ID
  defaultPromptTemplate: string; // 默认 Prompt 模板
  useCurrentFileNameContext: boolean;  // 是否使用当前文件名作为上下文
  analyzeDirectoryNamingStyle: boolean; // 是否分析目录下其他文件命名风格
  debugMode: boolean;            // 调试模式（在控制台显示详细日志）
  timeout: number;               // 请求超时时间（毫秒）
}

/**
 * 简洁的基础 Prompt 模板（不使用当前文件名上下文时）
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
 * 默认 Prompt 模板（使用当前文件名上下文时）
 */
export const DEFAULT_PROMPT_TEMPLATE = `Generate a concise and accurate filename for the following note content.
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
 * 默认设置
 */
export const DEFAULT_SETTINGS: AIFileNamerSettings = {
  configs: [
    {
      id: 'default',
      name: '默认配置',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 100,
      topP: 1.0,
      promptTemplate: DEFAULT_PROMPT_TEMPLATE
    }
  ],
  activeConfigId: 'default',
  defaultPromptTemplate: DEFAULT_PROMPT_TEMPLATE,
  useCurrentFileNameContext: true,  // 默认使用当前文件名上下文
  analyzeDirectoryNamingStyle: false, // 默认不分析目录命名风格（性能考虑）
  debugMode: false, // 默认关闭调试模式
  timeout: 15000 // 默认超时时间 15 秒
};

import { App, requestUrl } from 'obsidian';
import { AIFileNamerSettings, APIConfig, BASE_PROMPT_TEMPLATE } from '../settings/settings';

/**
 * AI 服务类
 * 负责与 AI API 交互，生成文件名
 */
export class AIService {
  constructor(
    private app: App,
    private settings: AIFileNamerSettings
  ) { }

  /**
   * 生成文件名
   * @param content 笔记内容
   * @param currentFileName 当前文件名（可选）
   * @param directoryNamingStyle 目录命名风格分析结果（可选）
   * @param configId 配置 ID（可选）
   * @returns 生成的文件名
   */
  async generateFileName(
    content: string,
    currentFileName?: string,
    directoryNamingStyle?: string,
    configId?: string
  ): Promise<string> {
    const config = this.getConfig(configId);

    // 验证配置
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('API Key 未配置，请在设置中配置 API Key');
    }

    if (!config.endpoint || config.endpoint.trim() === '') {
      throw new Error('API 端点未配置');
    }

    // 准备 prompt（智能处理内容长度，避免超出 token 限制）
    const truncatedContent = this.smartTruncateContent(content);

    // 根据配置选择模板
    let template = config.promptTemplate;
    if (!this.settings.useCurrentFileNameContext) {
      // 使用简洁的基础模板
      template = BASE_PROMPT_TEMPLATE;
    }

    // 构建变量对象
    const variables: Record<string, string> = {
      content: truncatedContent,
      currentFileName: (this.settings.useCurrentFileNameContext && currentFileName) ? currentFileName : '',
      directoryNamingStyle: directoryNamingStyle || ''
    };

    const prompt = this.renderPrompt(template, variables);

    if (this.settings.debugMode) {
      console.log('[AIService] 发送给 AI 的 Prompt:');
      console.log('='.repeat(50));
      console.log(prompt);
      console.log('='.repeat(50));
    }

    // 构建请求体
    const requestBody = {
      model: config.model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP
    };

    try {
      // 使用 Promise.race 实现超时控制
      const timeoutMs = this.settings.timeout || 15000;

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`请求超时 (超过 ${timeoutMs / 1000} 秒)`));
        }, timeoutMs);
      });

      // 补全 API 端点（运行时处理）
      const fullEndpoint = this.normalizeEndpoint(config.endpoint);

      // 使用 Obsidian 的 requestUrl API 发送请求
      const requestPromise = requestUrl({
        url: fullEndpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody),
        throw: false // 不自动抛出错误，手动处理
      });

      const response = await Promise.race([requestPromise, timeoutPromise]) as any;

      // 检查响应状态
      if (response.status !== 200) {
        let errorMessage = `API 请求失败 (${response.status})`;

        // 添加请求的 URL 信息
        errorMessage += `\n请求地址: ${fullEndpoint}`;

        // 404 错误的特殊提示
        if (response.status === 404) {
          errorMessage += `\n提示: 端点地址可能不正确，请检查 API 端点配置`;
        }

        // 401 错误的特殊提示
        if (response.status === 401) {
          errorMessage += `\n提示: API Key 可能无效或已过期，请检查 API Key 配置`;
        }

        try {
          const errorData = response.json;
          if (errorData && errorData.error && errorData.error.message) {
            errorMessage += `\n错误详情: ${errorData.error.message}`;
          }
        } catch (e) {
          // 无法解析错误信息，使用默认消息
        }
        throw new Error(errorMessage);
      }

      // 解析响应
      return this.parseResponse(response.json);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`网络请求失败: ${String(error)}`);
    }
  }

  /**
   * 解析 API 响应
   * @param response API 响应数据
   * @returns 提取的文件名
   */
  private parseResponse(response: any): string {
    try {
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('API 响应格式错误：缺少 choices 字段');
      }

      const choice = response.choices[0];
      if (!choice.message || !choice.message.content) {
        throw new Error('API 响应格式错误：缺少 message.content 字段');
      }

      let content = choice.message.content.trim();

      // 处理带思考过程的模型（如 DeepSeek、o1 系列等）
      // 这些模型可能在 reasoning_content 字段中包含思考过程
      // 或者在 content 中用特殊标记包裹思考过程

      // 移除 <think>...</think> 或 <thinking>...</thinking> 标记的思考内容
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

      // 移除 【思考】...【/思考】 或 [思考]...[/思考] 标记的思考内容
      content = content.replace(/【思考】[\s\S]*?【\/思考】/g, '').trim();
      content = content.replace(/\[思考\][\s\S]*?\[\/思考\]/g, '').trim();

      // 如果返回多行内容，尝试提取最后一个非空行（通常是最终答案）
      const lines = content.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
      if (lines.length > 1) {
        // 优先查找"文件名："或"Title:"后面的内容
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if (line.includes('文件名：') || line.includes('文件名:')) {
            content = line.split(/文件名[：:]/)[1]?.trim() || line;
            break;
          } else if (line.toLowerCase().includes('title:')) {
            content = line.split(/title:/i)[1]?.trim() || line;
            break;
          }
        }
        // 如果没有找到标记，使用最后一行
        if (content === choice.message.content.trim()) {
          content = lines[lines.length - 1];
        }
      }

      // 移除可能的引号包裹
      let fileName = content;
      if ((fileName.startsWith('"') && fileName.endsWith('"')) ||
        (fileName.startsWith("'") && fileName.endsWith("'")) ||
        (fileName.startsWith('《') && fileName.endsWith('》')) ||
        (fileName.startsWith('`') && fileName.endsWith('`'))) {
        fileName = fileName.substring(1, fileName.length - 1);
      }

      // 移除 .md 扩展名（如果 AI 添加了）
      if (fileName.toLowerCase().endsWith('.md')) {
        fileName = fileName.substring(0, fileName.length - 3);
      }

      // 移除可能的前缀（如 "文件名："、"Title:" 等）
      fileName = fileName.replace(/^(文件名[：:]|Title:\s*)/i, '').trim();

      // 限制文件名长度（防止 AI 返回过长内容）
      if (fileName.length > 100) {
        fileName = fileName.substring(0, 100);
      }

      fileName = fileName.trim();

      if (!fileName) {
        throw new Error('AI 返回的文件名为空');
      }

      return fileName;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('无法解析 API 响应');
    }
  }

  /**
   * 智能截取内容
   * 优先保留开头和结尾，因为它们通常包含最重要的信息
   * @param content 原始内容
   * @param maxChars 最大字符数（默认 3000）
   * @returns 截取后的内容
   */
  private smartTruncateContent(content: string, maxChars: number = 3000): string {
    // 如果内容不超过限制，直接返回
    if (content.length <= maxChars) {
      return content;
    }

    // 计算开头和结尾各保留多少字符
    const headChars = Math.floor(maxChars * 0.6); // 开头保留 60%
    const tailChars = Math.floor(maxChars * 0.3); // 结尾保留 30%
    // 剩余 10% 用于省略标记

    const head = content.substring(0, headChars);
    const tail = content.substring(content.length - tailChars);

    // 添加省略标记，说明内容被截断
    return `${head}\n\n[... Content truncated due to length. Total ${content.length} characters, showing first ${headChars} and last ${tailChars} characters ...]\n\n${tail}`;
  }

  /**
   * 获取配置
   * @param configId 配置 ID
   * @returns 配置对象
   */
  private getConfig(configId?: string): APIConfig {
    const id = configId || this.settings.activeConfigId;
    const config = this.settings.configs.find(c => c.id === id);

    if (!config) {
      throw new Error(`配置 "${id}" 不存在`);
    }

    return config;
  }

  /**
   * 渲染 Prompt 模板
   * @param template 模板字符串
   * @param variables 变量对象
   * @returns 渲染后的字符串
   */
  private renderPrompt(template: string, variables: Record<string, string>): string {
    let result = template;

    // 处理条件块 {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, content) => {
      return variables[varName] ? content : '';
    });

    // 处理变量替换 {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      return variables[varName] || '';
    });

    return result;
  }

  /**
   * 标准化 API 端点 URL（运行时自动补全）
   * @param url 原始 URL
   * @returns 补全后的完整 URL
   */
  private normalizeEndpoint(url: string): string {
    let normalized = url.trim();

    if (!normalized) {
      throw new Error('API 端点不能为空');
    }

    // 检查并添加协议
    if (!normalized.match(/^https?:\/\//i)) {
      if (normalized.startsWith('//')) {
        normalized = 'https:' + normalized;
      } else if (!normalized.includes('://')) {
        normalized = 'https://' + normalized;
      }
    }

    // 移除末尾多余的斜杠
    normalized = normalized.replace(/\/+$/, '');

    // 检查是否包含完整路径
    const commonPaths = [
      '/v1/chat/completions',
      '/chat/completions',
      '/v1/completions',
      '/completions'
    ];

    const hasPath = commonPaths.some(path => normalized.includes(path));

    if (!hasPath) {
      // 尝试解析 URL 并自动补全路径
      try {
        const urlObj = new URL(normalized);
        const pathname = urlObj.pathname;

        // 如果路径以 /v1 结尾，自动补全为 /v1/chat/completions
        if (pathname === '/v1' || pathname === '/v1/') {
          normalized = normalized.replace(/\/v1\/?$/, '') + '/v1/chat/completions';
        }
        // 如果只有根路径或空路径，补全为 /v1/chat/completions
        else if (!pathname || pathname === '/') {
          normalized = normalized + '/v1/chat/completions';
        }
        // 如果路径以 /chat 结尾，补全为 /chat/completions
        else if (pathname === '/chat' || pathname === '/chat/') {
          normalized = normalized.replace(/\/chat\/?$/, '') + '/chat/completions';
        }
      } catch (e) {
        // URL 解析失败，保持原样
      }
    }

    // 修正双斜杠
    normalized = normalized.replace(/([^:])\/\//g, '$1/');

    return normalized;
  }

  /**
   * 测试连接
   * @param configId 配置 ID（可选）
   * @returns 是否连接成功
   */
  async testConnection(configId?: string): Promise<boolean> {
    const config = this.getConfig(configId);

    // 验证配置
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('API Key 未配置，请在设置中配置 API Key');
    }

    if (!config.endpoint || config.endpoint.trim() === '') {
      throw new Error('API 端点未配置');
    }

    // 构造极简请求
    const requestBody = {
      model: config.model,
      messages: [
        { role: 'user', content: 'Hi' }
      ],
      max_tokens: 5
    };

    try {
      const timeoutMs = this.settings.timeout || 15000;

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`请求超时 (超过 ${timeoutMs / 1000} 秒)`));
        }, timeoutMs);
      });

      // 补全 API 端点（运行时处理）
      const fullEndpoint = this.normalizeEndpoint(config.endpoint);

      const requestPromise = requestUrl({
        url: fullEndpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody),
        throw: false
      });

      const response = await Promise.race([requestPromise, timeoutPromise]) as any;

      if (response.status !== 200) {
        let errorMessage = `API 请求失败 (${response.status})`;
        if (response.status === 401) errorMessage += ': API Key 无效';
        else if (response.status === 404) errorMessage += ': 端点地址不可用';

        try {
          const errorData = response.json;
          if (errorData?.error?.message) {
            errorMessage += ` - ${errorData.error.message}`;
          }
        } catch { }

        throw new Error(errorMessage);
      }

      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`网络请求失败: ${String(error)}`);
    }
  }
}

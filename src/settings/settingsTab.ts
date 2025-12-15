import { App, PluginSettingTab, Setting, Modal, Notice } from 'obsidian';
import type AIFileNamerPlugin from '../main';
import { BASE_PROMPT_TEMPLATE } from './settings';

/**
 * 配置重命名弹窗
 */
class RenameConfigModal extends Modal {
  private currentName: string;
  private onSubmit: (newName: string) => void;

  constructor(app: App, currentName: string, onSubmit: (newName: string) => void) {
    super(app);
    this.currentName = currentName;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '重命名配置' });

    // 创建输入框
    const inputContainer = contentEl.createDiv({ cls: 'setting-item' });
    const input = inputContainer.createEl('input', {
      type: 'text',
      value: this.currentName
    });
    input.style.width = '100%';
    input.style.padding = '8px';
    input.style.marginBottom = '16px';

    // 选中当前文本
    input.select();

    // 创建按钮容器
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '8px';

    // 取消按钮
    const cancelButton = buttonContainer.createEl('button', { text: '取消' });
    cancelButton.addEventListener('click', () => {
      this.close();
    });

    // 确认按钮
    const confirmButton = buttonContainer.createEl('button', {
      text: '确认',
      cls: 'mod-cta'
    });
    confirmButton.addEventListener('click', () => {
      const newName = input.value.trim();
      if (newName) {
        this.onSubmit(newName);
        this.close();
      }
    });

    // 回车键提交
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newName = input.value.trim();
        if (newName) {
          this.onSubmit(newName);
          this.close();
        }
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    // 聚焦输入框
    input.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * 设置标签页类
 * 提供插件配置界面
 */
export class AIFileNamerSettingTab extends PluginSettingTab {
  plugin: AIFileNamerPlugin;

  constructor(app: App, plugin: AIFileNamerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'AI Note Renamer' });

    // GitHub Feedback Link
    const feedbackContainer = containerEl.createDiv({ cls: 'setting-item-description' });
    feedbackContainer.style.marginTop = '-10px';
    feedbackContainer.style.marginBottom = '20px';
    feedbackContainer.appendText('谢谢你的使用~欢迎反馈！戳这里：');
    feedbackContainer.createEl('a', {
      text: 'GitHub',
      href: 'https://github.com/ZyphrZero/obsidian-ai-note-renamer'
    });


    // 配置选择
    this.renderConfigSelector(containerEl);

    // 当前配置的详细设置
    this.renderConfigSettings(containerEl);

    // 高级设置
    this.renderAdvancedSettings(containerEl);
  }

  /**
   * 渲染配置选择器
   */
  private renderConfigSelector(containerEl: HTMLElement): void {
    const currentConfig = this.plugin.settings.configs.find(
      c => c.id === this.plugin.settings.activeConfigId
    );

    new Setting(containerEl)
      .setName('当前配置')
      .setDesc('选择要使用的 API 配置')
      .addDropdown(dropdown => {
        // 添加所有配置选项
        this.plugin.settings.configs.forEach(config => {
          dropdown.addOption(config.id, config.name);
        });

        // 设置当前值
        dropdown.setValue(this.plugin.settings.activeConfigId);

        // 监听变化
        dropdown.onChange(async (value) => {
          this.plugin.settings.activeConfigId = value;
          await this.plugin.saveSettings();
          this.display(); // 重新渲染界面
        });
      });

    // 添加新配置按钮
    new Setting(containerEl)
      .setName('配置管理')
      .setDesc('添加、重命名或删除 API 配置')
      .addButton(button => button
        .setButtonText('添加新配置')
        .onClick(async () => {
          // 生成新的配置 ID
          const newId = `config-${Date.now()}`;

          // 创建新配置
          const newConfig = {
            id: newId,
            name: `配置 ${this.plugin.settings.configs.length + 1}`,
            endpoint: 'https://api.openai.com/v1/chat/completions',
            apiKey: '',
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            maxTokens: 100,
            topP: 1.0,
            promptTemplate: this.plugin.settings.defaultPromptTemplate
          };

          // 添加到配置列表
          this.plugin.settings.configs.push(newConfig);

          // 设置为当前活动配置
          this.plugin.settings.activeConfigId = newId;

          // 保存设置
          await this.plugin.saveSettings();

          // 重新渲染界面
          this.display();
        }))
      .addButton(button => button
        .setButtonText('配置重命名')
        .onClick(async () => {
          const config = this.plugin.settings.configs.find(
            c => c.id === this.plugin.settings.activeConfigId
          );

          if (!config) {
            return;
          }

          // 创建重命名弹窗
          const modal = new RenameConfigModal(this.app, config.name, async (newName) => {
            if (newName && newName.trim()) {
              config.name = newName.trim();
              await this.plugin.saveSettings();
              this.display();
            }
          });
          modal.open();
        }))
      .addButton(button => button
        .setButtonText('删除当前配置')
        .setWarning()
        .onClick(async () => {
          // 不允许删除最后一个配置
          if (this.plugin.settings.configs.length <= 1) {
            return;
          }

          // 删除当前配置
          this.plugin.settings.configs = this.plugin.settings.configs.filter(
            c => c.id !== this.plugin.settings.activeConfigId
          );

          // 切换到第一个配置
          this.plugin.settings.activeConfigId = this.plugin.settings.configs[0].id;

          // 保存设置
          await this.plugin.saveSettings();

          // 重新渲染界面
          this.display();
        }));

    containerEl.createEl('h3', { text: `配置: ${currentConfig?.name || '默认配置'}` });
  }

  /**
   * 渲染当前配置的设置
   */
  private renderConfigSettings(containerEl: HTMLElement): void {
    const config = this.plugin.settings.configs.find(
      c => c.id === this.plugin.settings.activeConfigId
    );

    if (!config) {
      return;
    }

    // API 端点
    new Setting(containerEl)
      .setName('API 端点')
      .setDesc('OpenAI API 兼容的端点地址（可以是基础 URL，完整路径将在运行时自动补全）')
      .addText(text => {
        text
          .setPlaceholder('https://api.openai.com/v1/chat/completions')
          .setValue(config.endpoint)
          .onChange(async (value) => {
            // 直接保存用户输入的原始值，不进行补全
            config.endpoint = value.trim();
            await this.plugin.saveSettings();
            updatePreview(value);
          });

        // 初始预览
        setTimeout(() => updatePreview(config.endpoint), 0);
      })
      .addButton(button => button
        .setButtonText('测试连接')
        .onClick(async () => {
          button.setButtonText('测试中...');
          button.setDisabled(true);

          try {
            await this.plugin.aiService.testConnection(config.id);
            new Notice('✅ 连接成功！');
          } catch (error) {
            new Notice(`❌ 连接失败: ${error instanceof Error ? error.message : String(error)}`);
          } finally {
            button.setButtonText('测试连接');
            button.setDisabled(false);
          }
        }));

    // 创建预览容器（在 API 端点设置项之后）
    const previewContainer = containerEl.createDiv({
      cls: 'setting-item-description'
    });

    const updatePreview = (value: string) => {
      const normalized = this.normalizeEndpoint(value);
      previewContainer.empty();

      if (value.trim()) {
        const previewText = previewContainer.createDiv();
        previewText.setText(`实际请求地址: ${normalized.url}`);
        previewText.style.color = 'var(--text-muted)';
        previewText.style.fontSize = '0.9em';
        previewText.style.marginTop = '4px';
      }
    };

    // 初始化预览
    updatePreview(config.endpoint);

    // API Key
    new Setting(containerEl)
      .setName('API Key')
      .setDesc('您的 API 密钥')
      .addText(text => {
        text
          .setPlaceholder('sk-...')
          .setValue(config.apiKey)
          .onChange(async (value) => {
            config.apiKey = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      });

    // 模型名称
    new Setting(containerEl)
      .setName('模型名称')
      .setDesc('使用的 AI 模型')
      .addText(text => text
        .setPlaceholder('gpt-3.5-turbo')
        .setValue(config.model)
        .onChange(async (value) => {
          config.model = value;
          await this.plugin.saveSettings();
        }));

    // Temperature
    new Setting(containerEl)
      .setName('Temperature')
      .setDesc('控制文件名生成的创造性。值越低（接近 0）生成的文件名越保守、准确；值越高生成的文件名越有创意但可能偏离内容。建议设置为 0.3-0.7')
      .addSlider(slider => slider
        .setLimits(0, 2, 0.1)
        .setValue(config.temperature)
        .setDynamicTooltip()
        .onChange(async (value) => {
          config.temperature = value;
          await this.plugin.saveSettings();
        }));

    // Max Tokens
    new Setting(containerEl)
      .setName('Max Tokens')
      .setDesc('生成的最大 token 数量')
      .addText(text => text
        .setPlaceholder('100')
        .setValue(String(config.maxTokens))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            config.maxTokens = numValue;
            await this.plugin.saveSettings();
          }
        }));

    // Top P
    new Setting(containerEl)
      .setName('Top P')
      .setDesc('控制文件名用词的多样性。值越小生成的文件名用词越常见、简洁；值越大用词范围越广、越丰富。建议保持默认值 1.0')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.05)
        .setValue(config.topP)
        .setDynamicTooltip()
        .onChange(async (value) => {
          config.topP = value;
          await this.plugin.saveSettings();
        }));

    // Prompt 模板
    containerEl.createEl('h4', { text: 'Prompt 模板' });

    const promptDesc = containerEl.createEl('div', { cls: 'setting-item-description' });
    promptDesc.innerHTML = `
      自定义发送给 AI 的提示词模板。支持的变量：<br>
      • <code>{{content}}</code> - 笔记内容<br>
      • <code>{{currentFileName}}</code> - 当前文件名<br>
      • <code>{{#if currentFileName}}...{{/if}}</code> - 条件块
    `;

    new Setting(containerEl)
      .addTextArea(text => {
        text
          .setValue(config.promptTemplate)
          .onChange(async (value) => {
            config.promptTemplate = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 10;
        text.inputEl.cols = 50;
      });

    // 重置为默认模板按钮
    new Setting(containerEl)
      .setName('重置 Prompt 模板')
      .setDesc('根据"使用当前文件名作为上下文"设置，恢复为对应的默认模板')
      .addButton(button => button
        .setButtonText('重置')
        .onClick(async () => {
          // 根据设置选择对应的模板
          if (this.plugin.settings.useCurrentFileNameContext) {
            // 使用带文件名上下文的模板
            config.promptTemplate = this.plugin.settings.defaultPromptTemplate;
          } else {
            // 使用基础模板
            config.promptTemplate = BASE_PROMPT_TEMPLATE;
          }
          await this.plugin.saveSettings();
          this.display();
        }));
  }

  /**
   * 渲染高级设置
   */
  private renderAdvancedSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '高级设置' });

    // 使用当前文件名上下文
    new Setting(containerEl)
      .setName('使用当前文件名作为上下文')
      .setDesc('开启后，AI 会参考当前文件名进行改进；关闭后，仅根据笔记内容生成标题')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useCurrentFileNameContext)
        .onChange(async (value) => {
          this.plugin.settings.useCurrentFileNameContext = value;
          await this.plugin.saveSettings();
        }));

    // 分析目录命名风格
    new Setting(containerEl)
      .setName('分析目录下其他文件命名风格')
      .setDesc('开启后，AI 会分析同目录下其他文件的命名模式，生成风格一致的文件名（可能影响性能）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.analyzeDirectoryNamingStyle)
        .onChange(async (value) => {
          this.plugin.settings.analyzeDirectoryNamingStyle = value;
          await this.plugin.saveSettings();
        }));

    // 调试模式
    new Setting(containerEl)
      .setName('调试模式')
      .setDesc('开启后在浏览器控制台显示详细的调试日志（包括 Prompt 内容、目录分析结果等）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.debugMode)
        .onChange(async (value) => {
          await this.plugin.saveSettings();
        }));

    // 请求超时
    new Setting(containerEl)
      .setName('请求超时时间 (秒)')
      .setDesc('设置 API 请求的最大等待时间，防止请求由于网络原因卡死')
      .addText(text => text
        .setPlaceholder('15')
        .setValue(String((this.plugin.settings.timeout || 15000) / 1000))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            this.plugin.settings.timeout = numValue * 1000;
            await this.plugin.saveSettings();
          }
        }));
  }

  /**
   * 标准化 API 端点 URL
   * @param url 原始 URL
   * @returns 标准化结果
   */
  private normalizeEndpoint(url: string): {
    url: string;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let normalized = url.trim();

    if (!normalized) {
      return { url: '', warnings, suggestions };
    }

    // 检查协议
    if (!normalized.match(/^https?:\/\//i)) {
      if (normalized.startsWith('//')) {
        normalized = 'https:' + normalized;
        suggestions.push('已自动添加 https 协议');
      } else if (normalized.includes('://')) {
        warnings.push('不支持的协议，建议使用 http 或 https');
      } else {
        normalized = 'https://' + normalized;
        suggestions.push('已自动添加 https:// 前缀');
      }
    }

    // 移除末尾多余的斜杠
    const originalLength = normalized.length;
    normalized = normalized.replace(/\/+$/, '');
    if (normalized.length < originalLength) {
      suggestions.push('已移除末尾多余的斜杠');
    }

    // 检查是否包含完整路径
    const commonPaths = [
      '/v1/chat/completions',
      '/chat/completions',
      '/v1/completions',
      '/completions'
    ];

    const hasPath = commonPaths.some(path => normalized.includes(path));

    if (!hasPath) {
      // 尝试检测基础 URL 并自动补全
      const urlObj = this.tryParseUrl(normalized);
      if (urlObj) {
        const pathname = urlObj.pathname;

        // 如果路径以 /v1 结尾，自动补全为 /v1/chat/completions
        if (pathname === '/v1' || pathname === '/v1/') {
          normalized = normalized + '/chat/completions';
          suggestions.push('已自动补全为 /v1/chat/completions');
        }
        // 如果只有根路径或空路径，补全为 /v1/chat/completions
        else if (!pathname || pathname === '/') {
          normalized = normalized + '/v1/chat/completions';
          suggestions.push('已自动补全为 /v1/chat/completions');
        }
        // 如果路径以 /chat 结尾，补全为 /chat/completions
        else if (pathname === '/chat' || pathname === '/chat/') {
          normalized = normalized + '/completions';
          suggestions.push('已自动补全为 /chat/completions');
        }
        // 其他情况，只提示建议
        else {
          suggestions.push('建议使用完整路径，如：/v1/chat/completions');
        }
      }
    }

    // 检查常见错误
    if (normalized.includes('//v1')) {
      normalized = normalized.replace('//v1', '/v1');
      suggestions.push('已修正双斜杠');
    }

    // 验证 URL 格式
    const urlObj = this.tryParseUrl(normalized);
    if (!urlObj) {
      warnings.push('URL 格式可能不正确');
    } else {
      // 检查常见的域名拼写错误
      const hostname = urlObj.hostname.toLowerCase();
      if (hostname.includes('openai') && !hostname.includes('api.openai.com')) {
        suggestions.push('OpenAI 官方端点通常为 api.openai.com');
      }
    }

    return { url: normalized, warnings, suggestions };
  }

  /**
   * 尝试解析 URL
   * @param urlString URL 字符串
   * @returns URL 对象或 null
   */
  private tryParseUrl(urlString: string): URL | null {
    try {
      return new URL(urlString);
    } catch {
      return null;
    }
  }

  /**
   * 转义 HTML 特殊字符
   * @param text 原始文本
   * @returns 转义后的文本
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

import { App, PluginSettingTab, Setting, Modal, Notice, setIcon } from 'obsidian';
import type AIFileNamerPlugin from '../main';
import { BASE_PROMPT_TEMPLATE, ADVANCED_PROMPT_TEMPLATE } from './settings';
import { validateShellPath } from '../services/terminal/platformUtils';

/**
 * 设置标签页接口
 */
interface SettingTab {
  id: string;
  name: string;
  icon: string;
}

/**
 * 设置标签页定义
 */
const SETTING_TABS: SettingTab[] = [
  { id: 'general', name: '常规设置', icon: 'settings' },
  { id: 'naming', name: '命名设置', icon: 'tag' },
  { id: 'terminal', name: '本地终端', icon: 'terminal' },
  { id: 'advanced', name: '高级选项', icon: 'sliders-horizontal' }
];

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

    // 设置弹窗宽度
    this.modalEl.setCssProps({
      width: '450px',
      'max-width': '90vw'
    });

    new Setting(contentEl)
      .setName('重命名配置')
      .setHeading();

    // 创建输入框
    const inputContainer = contentEl.createDiv({ cls: 'setting-item' });
    const input = inputContainer.createEl('input', {
      type: 'text',
      value: this.currentName
    });
    input.setCssProps({
      width: '100%',
      padding: '8px',
      'margin-bottom': '16px'
    });

    // 选中当前文本
    input.select();

    // 创建按钮容器
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.setCssProps({
      display: 'flex',
      'justify-content': 'flex-end',
      gap: '8px'
    });

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
 * 配置删除确认弹窗
 */
class DeleteConfigModal extends Modal {
  private configName: string;
  private onConfirm: () => void;

  constructor(app: App, configName: string, onConfirm: () => void) {
    super(app);
    this.configName = configName;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // 设置弹窗宽度
    this.modalEl.setCssProps({
      width: '500px',
      'max-width': '90vw'
    });

    new Setting(contentEl)
      .setName('⚠️ 确认删除配置')
      .setHeading();

    // 警告信息
    const warningContainer = contentEl.createDiv({ cls: 'setting-item' });
    warningContainer.setCssProps({
      padding: '12px',
      'margin-bottom': '16px',
      'background-color': 'var(--background-modifier-error)',
      'border-radius': '6px',
      'border': '1px solid var(--background-modifier-error-hover)'
    });

    const warningText = warningContainer.createDiv();
    warningText.setText(`确定要删除配置"${this.configName}"吗？此操作无法撤销。`);
    warningText.setCssProps({
      color: 'var(--text-error)',
      'font-weight': '500'
    });

    // 创建按钮容器
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.setCssProps({
      display: 'flex',
      'justify-content': 'flex-end',
      gap: '8px'
    });

    // 取消按钮
    const cancelButton = buttonContainer.createEl('button', { text: '取消' });
    cancelButton.addEventListener('click', () => {
      this.close();
    });

    // 确认删除按钮
    const confirmButton = buttonContainer.createEl('button', {
      text: '确认删除',
      cls: 'mod-warning'
    });
    confirmButton.addEventListener('click', () => {
      this.onConfirm();
      this.close();
    });

    // ESC 键关闭
    contentEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
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
  private activeTab = 'general';
  private expandedSections: Set<string> = new Set(); // 记录展开的功能区块

  constructor(app: App, plugin: AIFileNamerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // 头部
    const headerEl = containerEl.createDiv({ cls: 'ai-file-namer-settings-header' });
    new Setting(headerEl)
      .setName('Smart Workflow')
      .setHeading();

    // GitHub Feedback Link
    const feedbackContainer = headerEl.createDiv({ cls: 'setting-item-description' });
    feedbackContainer.setCssProps({
      'margin-bottom': '10px'
    });
    feedbackContainer.appendText('谢谢你的使用~欢迎反馈！戳这里：');
    feedbackContainer.createEl('a', {
      text: 'GitHub',
      href: 'https://github.com/ZyphrZero/obsidian-smart-workflow'
    });

    // 标签页导航
    const tabsEl = containerEl.createDiv({ cls: 'ai-file-namer-tabs' });

    SETTING_TABS.forEach(tab => {
      const tabEl = tabsEl.createEl('div', {
        cls: 'ai-file-namer-tab'
      });

      if (tab.id === this.activeTab) {
        tabEl.addClass('active');
      }

      // 使用 Obsidian 原生图标
      setIcon(tabEl, tab.icon);

      // 文本
      tabEl.createSpan({
        text: tab.name
      });

      // 点击事件
      tabEl.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.display();
      });
    });

    // 内容区域
    const contentEl = containerEl.createDiv({ cls: 'ai-file-namer-content' });

    // 根据当前标签页显示不同内容
    switch (this.activeTab) {
      case 'general':
        this.renderGeneralSettings(contentEl);
        break;
      case 'naming':
        this.renderNamingSettings(contentEl);
        break;
      case 'terminal':
        this.renderTerminalSettings(contentEl);
        break;
      case 'advanced':
        this.renderAdvancedSettings(contentEl);
        break;
    }
  }

  /**
   * 创建卡片式设置容器
   */
  private createSettingCard(containerEl: HTMLElement): HTMLElement {
    const card = containerEl.createDiv();
    card.style.padding = '16px';
    card.style.borderRadius = '8px';
    card.style.backgroundColor = 'var(--background-secondary)';
    card.style.marginBottom = '10px';
    return card;
  }

  /**
   * 渲染常规设置（配置选择 + API 配置）
   */
  private renderGeneralSettings(containerEl: HTMLElement): void {
    const currentConfig = this.plugin.settings.configs.find(
      c => c.id === this.plugin.settings.activeConfigId
    );

    // 配置选择卡片
    const configCard = this.createSettingCard(containerEl);

    // 配置选择部分
    new Setting(configCard)
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
    new Setting(configCard)
      .setName('配置管理')
      .setDesc('添加、重命名或删除 API 配置')
      .addButton(button => button
        .setButtonText('添加配置')
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
            maxTokens: 300,
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
        .setButtonText('重命名配置')
        .onClick(() => {
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
        .setButtonText('删除配置')
        .setWarning()
        .onClick(async () => {
          // 获取当前配置
          const currentConfig = this.plugin.settings.configs.find(
            c => c.id === this.plugin.settings.activeConfigId
          );

          if (!currentConfig) {
            return;
          }

          // 不允许删除默认配置
          if (currentConfig.id === 'default') {
            new Notice('❌ 无法删除默认配置');
            return;
          }

          // 不允许删除最后一个配置
          if (this.plugin.settings.configs.length <= 1) {
            new Notice('❌ 无法删除最后一个配置');
            return;
          }

          // 显示删除确认弹窗
          const modal = new DeleteConfigModal(
            this.app,
            currentConfig.name,
            async () => {
              // 删除当前配置
              this.plugin.settings.configs = this.plugin.settings.configs.filter(
                c => c.id !== this.plugin.settings.activeConfigId
              );

              // 切换到第一个配置
              this.plugin.settings.activeConfigId = this.plugin.settings.configs[0].id;

              // 保存设置
              await this.plugin.saveSettings();

              // 显示成功提示
              new Notice('✅ 配置已删除');

              // 重新渲染界面
              this.display();
            }
          );
          modal.open();
        }));

    // API 配置部分
    if (!currentConfig) {
      return;
    }

    // API 配置卡片
    const apiCard = this.createSettingCard(containerEl);

    new Setting(apiCard)
      .setName(`API 配置`)
      .setHeading();

    // API 端点
    new Setting(apiCard)
      .setName('API 端点')
      .setDesc('OpenAI API 兼容的端点地址（可以是基础 URL，完整路径将在运行时自动补全）')
      .addText(text => {
        text
          .setPlaceholder('https://api.openai.com/v1/chat/completions')
          .setValue(currentConfig.endpoint)
          .onChange(async (value) => {
            // 直接保存用户输入的原始值，不进行补全
            currentConfig.endpoint = value.trim();
            await this.plugin.saveSettings();
            updatePreview(value);
          });

        // 初始预览
        setTimeout(() => updatePreview(currentConfig.endpoint), 0);
      })
      .addButton(button => button
        .setButtonText('测试连接')
        .onClick(async () => {
          button.setButtonText('测试中...');
          button.setDisabled(true);

          try {
            await this.plugin.aiService.testConnection(currentConfig.id);
            new Notice('✅ 连接成功！');
          } catch (error) {
            new Notice(`❌ 连接失败: ${error instanceof Error ? error.message : String(error)}`);
          } finally {
            button.setButtonText('测试连接');
            button.setDisabled(false);
          }
        }));

    // 创建预览容器（在 API 端点设置项之后）
    const previewContainer = apiCard.createDiv({
      cls: 'setting-item-description'
    });

    const updatePreview = (value: string) => {
      const normalized = this.normalizeEndpoint(value);
      previewContainer.empty();

      if (value.trim()) {
        const previewText = previewContainer.createDiv();
        previewText.setText(`实际请求地址: ${normalized.url}`);
        previewText.setCssProps({
          color: 'var(--text-muted)',
          'font-size': '0.9em',
          'margin-top': '4px'
        });
      }
    };

    // 初始化预览
    updatePreview(currentConfig.endpoint);

    // API Key
    new Setting(apiCard)
      .setName('API key')
      .setDesc('您的 API 密钥')
      .addText(text => {
        text
          .setPlaceholder('sk-...')
          .setValue(currentConfig.apiKey)
          .onChange(async (value) => {
            currentConfig.apiKey = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      });

    // 模型名称
    new Setting(apiCard)
      .setName('模型名称')
      .setDesc('使用的 AI 模型')
      .addText(text => text
        .setPlaceholder('gpt-3.5-turbo')
        .setValue(currentConfig.model)
        .onChange(async (value) => {
          currentConfig.model = value;
          await this.plugin.saveSettings();
        }));

    // Temperature
    new Setting(apiCard)
      .setName('Temperature')
      .setDesc('控制文件名生成的创造性。值越低（接近 0）生成的文件名越保守、准确；值越高生成的文件名越有创意但可能偏离内容。建议设置为 0.3-0.7')
      .addSlider(slider => slider
        .setLimits(0, 2, 0.1)
        .setValue(currentConfig.temperature)
        .setDynamicTooltip()
        .onChange(async (value) => {
          currentConfig.temperature = value;
          await this.plugin.saveSettings();
        }));

    // Max Tokens
    new Setting(apiCard)
      .setName('Max tokens')
      .setDesc('生成的最大 token 数量')
      .addText(text => text
        .setPlaceholder('100')
        .setValue(String(currentConfig.maxTokens))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            currentConfig.maxTokens = numValue;
            await this.plugin.saveSettings();
          }
        }));

    // Top P
    new Setting(apiCard)
      .setName('Top p')
      .setDesc('控制文件名用词的多样性。值越小生成的文件名用词越常见、简洁；值越大用词范围越广、越丰富。建议保持默认值 1.0')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.05)
        .setValue(currentConfig.topP)
        .setDynamicTooltip()
        .onChange(async (value) => {
          currentConfig.topP = value;
          await this.plugin.saveSettings();
        }));
  }

  /**
   * 渲染命名设置
   */
  private renderNamingSettings(containerEl: HTMLElement): void {
    const config = this.plugin.settings.configs.find(
      c => c.id === this.plugin.settings.activeConfigId
    );

    if (!config) {
      return;
    }

    // 命名行为设置卡片
    const namingCard = this.createSettingCard(containerEl);

    new Setting(namingCard)
      .setName('命名行为设置')
      .setHeading();

    // 使用当前文件名上下文
    new Setting(namingCard)
      .setName('使用当前文件名作为上下文')
      .setDesc('开启后，AI 会参考当前文件名进行改进；关闭后，仅根据笔记内容生成标题')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useCurrentFileNameContext)
        .onChange(async (value) => {
          this.plugin.settings.useCurrentFileNameContext = value;
          await this.plugin.saveSettings();
        }));

    // 分析目录命名风格
    new Setting(namingCard)
      .setName('分析目录下其他文件命名风格')
      .setDesc('开启后，AI 会分析同目录下其他文件的命名模式，生成风格一致的文件名（可能影响性能）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.analyzeDirectoryNamingStyle)
        .onChange(async (value) => {
          this.plugin.settings.analyzeDirectoryNamingStyle = value;
          await this.plugin.saveSettings();
        }));

    // Prompt 模板设置卡片
    const promptCard = this.createSettingCard(containerEl);

    new Setting(promptCard)
      .setName(`Prompt 模板`)
      .setHeading();

    const promptDesc = promptCard.createEl('div', { cls: 'setting-item-description' });
    promptDesc.appendText('自定义发送给 AI 的提示词模板。支持的变量：');
    promptDesc.createEl('br');
    promptDesc.appendText('• ');
    promptDesc.createEl('code', { text: '{{content}}' });
    promptDesc.appendText(' - 笔记内容');
    promptDesc.createEl('br');
    promptDesc.appendText('• ');
    promptDesc.createEl('code', { text: '{{currentFileName}}' });
    promptDesc.appendText(' - 当前文件名');
    promptDesc.createEl('br');
    promptDesc.appendText('• ');
    promptDesc.createEl('code', { text: '{{#if currentFileName}}...{{/if}}' });
    promptDesc.appendText(' - 条件块');

    // 当前使用的模板编辑器
    const currentTemplateCard = this.createSettingCard(containerEl);

    new Setting(currentTemplateCard)
      .setName('✏️ 当前 Prompt 模板')
      .setDesc('在下方编辑当前配置使用的模板')
      .setHeading();

    new Setting(currentTemplateCard)
      .addTextArea(text => {
        text
          .setValue(config.promptTemplate)
          .onChange(async (value) => {
            config.promptTemplate = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 10;
        text.inputEl.cols = 50;
        text.inputEl.style.width = '100%';
      });

    // 重置按钮
    new Setting(currentTemplateCard)
      .setName('快速重置')
      .setDesc('根据"使用当前文件名作为上下文"设置，自动选择合适的模板')
      .addButton(button => button
        .setButtonText('重置为推荐模板')
        .onClick(async () => {
          // 根据设置选择对应的模板
          if (this.plugin.settings.useCurrentFileNameContext) {
            // 使用高级模板
            config.promptTemplate = ADVANCED_PROMPT_TEMPLATE;
          } else {
            // 使用基础模板
            config.promptTemplate = BASE_PROMPT_TEMPLATE;
          }
          await this.plugin.saveSettings();
          this.display();
        }));
  }

  /**
   * 渲染终端设置
   */
  private renderTerminalSettings(containerEl: HTMLElement): void {
    // 架构选择卡片
    // Shell 程序设置卡片
    const shellCard = this.createSettingCard(containerEl);

    new Setting(shellCard)
      .setName('Shell 程序设置')
      .setHeading();

    // 默认 Shell 程序选择
    new Setting(shellCard)
      .setName('默认 Shell 程序')
      .setDesc('选择终端启动时使用的默认 Shell 程序')
      .addDropdown(dropdown => {
        // 根据平台显示不同的选项
        if (process.platform === 'win32') {
          dropdown.addOption('cmd', 'CMD (命令提示符)');
          dropdown.addOption('powershell', 'PowerShell');
          dropdown.addOption('wsl', 'WSL (Windows Subsystem for Linux)');
        } else if (process.platform === 'darwin' || process.platform === 'linux') {
          dropdown.addOption('bash', 'Bash');
          dropdown.addOption('zsh', 'Zsh');
        }
        dropdown.addOption('custom', '自定义程序');

        dropdown.setValue(this.plugin.settings.terminal.defaultShell);
        dropdown.onChange(async (value) => {
          this.plugin.settings.terminal.defaultShell = value as any;
          await this.plugin.saveSettings();
          this.display(); // 重新渲染以显示/隐藏自定义路径输入框
        });
      });

    // 自定义程序路径（仅在选择 custom 时显示）
    if (this.plugin.settings.terminal.defaultShell === 'custom') {
      new Setting(shellCard)
        .setName('自定义程序路径')
        .setDesc('输入自定义 Shell 程序的完整路径')
        .addText(text => {
          text
            .setPlaceholder('例如: C:\\Program Files\\Git\\bin\\bash.exe')
            .setValue(this.plugin.settings.terminal.customShellPath)
            .onChange(async (value) => {
              this.plugin.settings.terminal.customShellPath = value;
              await this.plugin.saveSettings();
              
              // 验证路径
              this.validateCustomShellPath(shellCard, value);
            });
          
          // 初始验证
          setTimeout(() => {
            this.validateCustomShellPath(shellCard, this.plugin.settings.terminal.customShellPath);
          }, 0);
          
          return text;
        });
    }

    // 默认启动参数
    new Setting(shellCard)
      .setName('默认启动参数')
      .setDesc('Shell 程序的启动参数，多个参数用空格分隔（例如: --login -i）')
      .addText(text => text
        .setPlaceholder('例如: --login')
        .setValue(this.plugin.settings.terminal.shellArgs.join(' '))
        .onChange(async (value) => {
          // 将字符串分割为数组，过滤空字符串
          this.plugin.settings.terminal.shellArgs = value
            .split(' ')
            .filter(arg => arg.trim().length > 0);
          await this.plugin.saveSettings();
        }));

    // 自动进入项目目录
    new Setting(shellCard)
      .setName('自动进入项目目录')
      .setDesc('打开终端时自动切换到 Obsidian 项目（Vault）所在目录')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.terminal.autoEnterVaultDirectory)
        .onChange(async (value) => {
          this.plugin.settings.terminal.autoEnterVaultDirectory = value;
          await this.plugin.saveSettings();
        }));

    // 实例行为设置卡片
    const instanceCard = this.createSettingCard(containerEl);

    new Setting(instanceCard)
      .setName('实例行为设置')
      .setHeading();

    // 新实例行为
    new Setting(instanceCard)
      .setName('新实例布局')
      .setDesc('执行"打开终端"命令时的布局方式')
      .addDropdown(dropdown => {
        dropdown.addOption('replaceTab', '替换当前标签页');
        dropdown.addOption('newTab', '新标签页');
        dropdown.addOption('newLeftTab', '左侧新标签页');
        dropdown.addOption('newLeftSplit', '左侧新分屏');
        dropdown.addOption('newRightTab', '右侧新标签页');
        dropdown.addOption('newRightSplit', '右侧新分屏');
        dropdown.addOption('newHorizontalSplit', '水平分屏');
        dropdown.addOption('newVerticalSplit', '垂直分屏');
        dropdown.addOption('newWindow', '新窗口');

        dropdown.setValue(this.plugin.settings.terminal.newInstanceBehavior);
        dropdown.onChange(async (value) => {
          this.plugin.settings.terminal.newInstanceBehavior = value as any;
          await this.plugin.saveSettings();
        });
      });

    // 在现有终端附近创建
    new Setting(instanceCard)
      .setName('在现有终端附近创建')
      .setDesc('新终端将在现有终端附近创建，而不是根据上面的布局设置')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.terminal.createInstanceNearExistingOnes)
        .onChange(async (value) => {
          this.plugin.settings.terminal.createInstanceNearExistingOnes = value;
          await this.plugin.saveSettings();
        }));

    // 聚焦新实例
    new Setting(instanceCard)
      .setName('聚焦新实例')
      .setDesc('创建新终端时是否自动切换到该标签页')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.terminal.focusNewInstance)
        .onChange(async (value) => {
          this.plugin.settings.terminal.focusNewInstance = value;
          await this.plugin.saveSettings();
        }));

    // 锁定新实例
    new Setting(instanceCard)
      .setName('锁定新实例')
      .setDesc('新建终端标签页是否默认锁定（防止意外关闭）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.terminal.lockNewInstance)
        .onChange(async (value) => {
          this.plugin.settings.terminal.lockNewInstance = value;
          await this.plugin.saveSettings();
        }));

    // 主题设置卡片
    const themeCard = this.createSettingCard(containerEl);

    new Setting(themeCard)
      .setName('主题设置')
      .setHeading();

    // 使用 Obsidian 主题
    new Setting(themeCard)
      .setName('使用 Obsidian 主题')
      .setDesc('启用后，终端将自动适配 Obsidian 的明暗主题颜色')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.terminal.useObsidianTheme)
        .onChange(async (value) => {
          this.plugin.settings.terminal.useObsidianTheme = value;
          await this.plugin.saveSettings();
          this.display(); // 重新渲染以显示/隐藏自定义颜色设置
        }));

    // 自定义颜色设置（仅在不使用 Obsidian 主题时显示）
    if (!this.plugin.settings.terminal.useObsidianTheme) {
      // 背景色
      new Setting(themeCard)
        .setName('背景色')
        .setDesc('终端的背景颜色')
        .addColorPicker(color => color
          .setValue(this.plugin.settings.terminal.backgroundColor || '#000000')
          .onChange(async (value) => {
            this.plugin.settings.terminal.backgroundColor = value;
            await this.plugin.saveSettings();
          }))
        .addExtraButton(button => button
          .setIcon('reset')
          .setTooltip('重置为默认值')
          .onClick(async () => {
            this.plugin.settings.terminal.backgroundColor = undefined;
            await this.plugin.saveSettings();
            this.display(); // 刷新设置面板
            new Notice('背景色已重置为默认值');
          }));

      // 前景色
      new Setting(themeCard)
        .setName('前景色')
        .setDesc('终端的文本颜色')
        .addColorPicker(color => color
          .setValue(this.plugin.settings.terminal.foregroundColor || '#FFFFFF')
          .onChange(async (value) => {
            this.plugin.settings.terminal.foregroundColor = value;
            await this.plugin.saveSettings();
          }))
        .addExtraButton(button => button
          .setIcon('reset')
          .setTooltip('重置为默认值')
          .onClick(async () => {
            this.plugin.settings.terminal.foregroundColor = undefined;
            await this.plugin.saveSettings();
            this.display(); // 刷新设置面板
            new Notice('前景色已重置为默认值');
          }));

      // 背景图片
      const bgImageSetting = new Setting(themeCard)
        .setName('背景图片')
        .setDesc('终端背景图片的 URL（支持本地路径或网络地址）');
      
      bgImageSetting.addText(text => {
        const inputEl = text
          .setPlaceholder('https://example.com/image.jpg')
          .setValue(this.plugin.settings.terminal.backgroundImage || '')
          .onChange(async (value) => {
            // 只保存，不刷新
            this.plugin.settings.terminal.backgroundImage = value || undefined;
            await this.plugin.saveSettings();
          });
        
        // 失去焦点时刷新界面
        text.inputEl.addEventListener('blur', () => {
          this.display();
        });
        
        return inputEl;
      });
      
      bgImageSetting.addExtraButton(button => button
        .setIcon('reset')
        .setTooltip('清除背景图片')
        .onClick(async () => {
          this.plugin.settings.terminal.backgroundImage = undefined;
          await this.plugin.saveSettings();
          this.display();
          new Notice('背景图片已清除');
        }));

      // 背景图片透明度
      if (this.plugin.settings.terminal.backgroundImage) {
        new Setting(themeCard)
          .setName('背景图片透明度')
          .setDesc('调整背景图片的透明度（0.00-0.80，过高会遮挡文字）')
          .addSlider(slider => slider
            .setLimits(0, 0.8, 0.05)
            .setValue(this.plugin.settings.terminal.backgroundImageOpacity ?? 0.3)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.terminal.backgroundImageOpacity = value;
              await this.plugin.saveSettings();
            }));

        // 背景图片大小
        new Setting(themeCard)
          .setName('背景图片大小')
          .setDesc('设置背景图片的显示方式')
          .addDropdown(dropdown => dropdown
            .addOption('cover', '覆盖（Cover）')
            .addOption('contain', '包含（Contain）')
            .addOption('auto', '原始大小（Auto）')
            .setValue(this.plugin.settings.terminal.backgroundImageSize || 'cover')
            .onChange(async (value: 'cover' | 'contain' | 'auto') => {
              this.plugin.settings.terminal.backgroundImageSize = value;
              await this.plugin.saveSettings();
            }));

        // 背景图片位置
        new Setting(themeCard)
          .setName('背景图片位置')
          .setDesc('设置背景图片的对齐位置')
          .addDropdown(dropdown => dropdown
            .addOption('center', '居中')
            .addOption('top', '顶部')
            .addOption('bottom', '底部')
            .addOption('left', '左侧')
            .addOption('right', '右侧')
            .addOption('top left', '左上')
            .addOption('top right', '右上')
            .addOption('bottom left', '左下')
            .addOption('bottom right', '右下')
            .setValue(this.plugin.settings.terminal.backgroundImagePosition || 'center')
            .onChange(async (value) => {
              this.plugin.settings.terminal.backgroundImagePosition = value;
              await this.plugin.saveSettings();
            }));

        // 毛玻璃效果
        new Setting(themeCard)
          .setName('毛玻璃效果')
          .setDesc('为终端背景添加模糊效果')
          .addToggle(toggle => toggle
            .setValue(this.plugin.settings.terminal.enableBlur ?? false)
            .onChange(async (value) => {
              this.plugin.settings.terminal.enableBlur = value;
              await this.plugin.saveSettings();
              this.display(); // 刷新以显示/隐藏模糊程度滑块
            }));

        // 毛玻璃模糊程度
        if (this.plugin.settings.terminal.enableBlur) {
          new Setting(themeCard)
            .setName('模糊程度')
            .setDesc('调整毛玻璃的模糊强度（0-20px）')
            .addSlider(slider => slider
              .setLimits(0, 20, 1)
              .setValue(this.plugin.settings.terminal.blurAmount ?? 10)
              .setDynamicTooltip()
              .onChange(async (value) => {
                this.plugin.settings.terminal.blurAmount = value;
                await this.plugin.saveSettings();
              }));
        }
      }
    }

    // 外观设置卡片
    const appearanceCard = this.createSettingCard(containerEl);

    new Setting(appearanceCard)
      .setName('外观设置')
      .setHeading();

    // 字体大小
    new Setting(appearanceCard)
      .setName('字体大小')
      .setDesc('终端文本的字体大小（像素）')
      .addSlider(slider => slider
        .setLimits(8, 24, 1)
        .setValue(this.plugin.settings.terminal.fontSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.terminal.fontSize = value;
          await this.plugin.saveSettings();
        }));

    // 字体族
    new Setting(appearanceCard)
      .setName('字体族')
      .setDesc('终端使用的字体，建议使用等宽字体')
      .addText(text => text
        .setPlaceholder('Consolas, "Courier New", monospace')
        .setValue(this.plugin.settings.terminal.fontFamily)
        .onChange(async (value) => {
          this.plugin.settings.terminal.fontFamily = value;
          await this.plugin.saveSettings();
        }));

    // 光标样式
    new Setting(appearanceCard)
      .setName('光标样式')
      .setDesc('终端光标的显示样式')
      .addDropdown(dropdown => {
        dropdown.addOption('block', '方块');
        dropdown.addOption('underline', '下划线');
        dropdown.addOption('bar', '竖线');

        dropdown.setValue(this.plugin.settings.terminal.cursorStyle);
        dropdown.onChange(async (value) => {
          this.plugin.settings.terminal.cursorStyle = value as any;
          await this.plugin.saveSettings();
        });
      });

    // 光标闪烁
    new Setting(appearanceCard)
      .setName('光标闪烁')
      .setDesc('是否启用光标闪烁效果')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.terminal.cursorBlink)
        .onChange(async (value) => {
          this.plugin.settings.terminal.cursorBlink = value;
          await this.plugin.saveSettings();
        }));

    // 渲染器类型
    new Setting(appearanceCard)
      .setName('渲染器类型')
      .setDesc('选择终端渲染方式。Canvas 性能好且稳定（推荐），WebGL 性能最佳但可能不兼容')
      .addDropdown(dropdown => dropdown
        .addOption('canvas', 'Canvas（推荐）')
        .addOption('webgl', 'WebGL（高性能）')
        .setValue(this.plugin.settings.terminal.preferredRenderer)
        .onChange(async (value: 'canvas' | 'webgl') => {
          this.plugin.settings.terminal.preferredRenderer = value;
          await this.plugin.saveSettings();
          new Notice('渲染器设置已更新，将在下次打开终端时生效');
        }));

    // 行为设置卡片
    const behaviorCard = this.createSettingCard(containerEl);

    new Setting(behaviorCard)
      .setName('行为设置')
      .setHeading();

    // 滚动缓冲区大小
    const scrollbackSetting = new Setting(behaviorCard)
      .setName('滚动缓冲区大小')
      .setDesc('终端可以保存的历史输出行数（最小 100，最大 10000）');
    
    scrollbackSetting.addText(text => {
      const inputEl = text
        .setPlaceholder('1000')
        .setValue(String(this.plugin.settings.terminal.scrollback))
        .onChange(async (value) => {
          // 只在输入时保存，不验证
          const numValue = parseInt(value);
          if (!isNaN(numValue)) {
            this.plugin.settings.terminal.scrollback = numValue;
            await this.plugin.saveSettings();
          }
        });
      
      // 失去焦点时验证
      text.inputEl.addEventListener('blur', async () => {
        const value = text.inputEl.value;
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 100 || numValue > 10000) {
          new Notice('⚠️ 滚动缓冲区大小必须在 100 到 10000 之间，已恢复默认值');
          this.plugin.settings.terminal.scrollback = 1000;
          await this.plugin.saveSettings();
          text.setValue('1000');
        }
      });
      
      return inputEl;
    });

    // 终端面板默认高度
    const defaultHeightSetting = new Setting(behaviorCard)
      .setName('终端面板默认高度')
      .setDesc('终端面板的默认高度（像素，最小 100，最大 1000）');
    
    defaultHeightSetting.addText(text => {
      const inputEl = text
        .setPlaceholder('300')
        .setValue(String(this.plugin.settings.terminal.defaultHeight))
        .onChange(async (value) => {
          // 只在输入时保存，不验证
          const numValue = parseInt(value);
          if (!isNaN(numValue)) {
            this.plugin.settings.terminal.defaultHeight = numValue;
            await this.plugin.saveSettings();
          }
        });
      
      // 失去焦点时验证
      text.inputEl.addEventListener('blur', async () => {
        const value = text.inputEl.value;
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 100 || numValue > 1000) {
          new Notice('⚠️ 终端面板高度必须在 100 到 1000 像素之间，已恢复默认值');
          this.plugin.settings.terminal.defaultHeight = 300;
          await this.plugin.saveSettings();
          text.setValue('300');
        }
      });
      
      return inputEl;
    });

    // 恢复终端选项
    new Setting(behaviorCard)
      .setName('启动时恢复终端')
      .setDesc('插件加载时自动恢复上次打开的终端实例')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.terminal.restoreTerminalsOnLoad)
        .onChange(async (value) => {
          this.plugin.settings.terminal.restoreTerminalsOnLoad = value;
          await this.plugin.saveSettings();
        }));
  }

  /**
   * 渲染高级设置
   */
  private renderAdvancedSettings(containerEl: HTMLElement): void {
    // 性能与调试设置
    const performanceCard = this.createSettingCard(containerEl);

    new Setting(performanceCard)
      .setName('性能与调试')
      .setHeading();

    // 请求超时
    new Setting(performanceCard)
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

    // 调试模式
    new Setting(performanceCard)
      .setName('调试模式')
      .setDesc('开启后在浏览器控制台显示详细的调试日志（包括 Prompt 内容、目录分析结果等）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.debugMode)
        .onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        }));

    // 功能显示管理
    const visibilityCard = this.createSettingCard(containerEl);

    new Setting(visibilityCard)
      .setName('功能显示管理')
      .setDesc('控制插件功能在不同位置的显示，自定义你的工作流。修改后需要重新加载插件才能生效。')
      .setHeading();

    // AI 文件名生成功能 - 可折叠区块
    this.createCollapsibleSection(
      visibilityCard,
      'aiNaming',
      'AI 文件名生成',
      '点击展开，配置 AI 文件名生成功能的显示位置',
      (contentEl) => {
        new Setting(contentEl)
          .setName('命令面板')
          .setDesc('在命令面板（Ctrl/Cmd+P）中显示"生成 AI 文件名"命令')
          .addToggle(toggle => toggle
            .setValue(this.plugin.settings.featureVisibility.aiNaming.showInCommandPalette)
            .onChange(async (value) => {
              this.plugin.settings.featureVisibility.aiNaming.showInCommandPalette = value;
              await this.plugin.saveSettings();
            }));

        new Setting(contentEl)
          .setName('编辑器右键菜单')
          .setDesc('在编辑器右键菜单中显示"生成 AI 文件名"选项')
          .addToggle(toggle => toggle
            .setValue(this.plugin.settings.featureVisibility.aiNaming.showInEditorMenu)
            .onChange(async (value) => {
              this.plugin.settings.featureVisibility.aiNaming.showInEditorMenu = value;
              await this.plugin.saveSettings();
            }));

        new Setting(contentEl)
          .setName('文件浏览器右键菜单')
          .setDesc('在文件浏览器右键菜单中显示"生成 AI 文件名"选项')
          .addToggle(toggle => toggle
            .setValue(this.plugin.settings.featureVisibility.aiNaming.showInFileMenu)
            .onChange(async (value) => {
              this.plugin.settings.featureVisibility.aiNaming.showInFileMenu = value;
              await this.plugin.saveSettings();
            }));

        new Setting(contentEl)
          .setName('侧边栏图标')
          .setDesc('在左侧边栏显示 AI 文件名生成的快捷图标按钮')
          .addToggle(toggle => toggle
            .setValue(this.plugin.settings.featureVisibility.aiNaming.showInRibbon)
            .onChange(async (value) => {
              this.plugin.settings.featureVisibility.aiNaming.showInRibbon = value;
              await this.plugin.saveSettings();
            }));
      }
    );

    // 终端功能 - 可折叠区块
    this.createCollapsibleSection(
      visibilityCard,
      'terminal',
      '终端',
      '点击展开，配置终端功能的显示位置',
      (contentEl) => {
        new Setting(contentEl)
          .setName('命令面板')
          .setDesc('在命令面板（Ctrl/Cmd+P）中显示"打开终端"命令')
          .addToggle(toggle => toggle
            .setValue(this.plugin.settings.featureVisibility.terminal.showInCommandPalette)
            .onChange(async (value) => {
              this.plugin.settings.featureVisibility.terminal.showInCommandPalette = value;
              await this.plugin.saveSettings();
            }));

        new Setting(contentEl)
          .setName('侧边栏图标')
          .setDesc('在左侧边栏显示打开终端的快捷图标按钮')
          .addToggle(toggle => toggle
            .setValue(this.plugin.settings.featureVisibility.terminal.showInRibbon)
            .onChange(async (value) => {
              this.plugin.settings.featureVisibility.terminal.showInRibbon = value;
              await this.plugin.saveSettings();
            }));
      }
    );
  }

  /**
   * 创建可折叠的设置区块
   * @param containerEl 容器元素
   * @param sectionId 区块 ID
   * @param title 标题
   * @param description 描述
   * @param renderContent 渲染内容的回调函数
   */
  private createCollapsibleSection(
    containerEl: HTMLElement,
    sectionId: string,
    title: string,
    description: string,
    renderContent: (contentEl: HTMLElement) => void
  ): void {
    const isExpanded = this.expandedSections.has(sectionId);

    // 创建包装容器
    const wrapperEl = containerEl.createDiv({ cls: 'collapsible-section-wrapper' });

    // 创建标题区域（可点击）
    const headerEl = wrapperEl.createDiv({ 
      cls: 'collapsible-section-header' 
    });

    const headerInfo = headerEl.createDiv({ cls: 'setting-item-info' });
    
    const headerName = headerInfo.createDiv({ cls: 'setting-item-name' });
    
    // 添加展开/收起图标
    const iconEl = headerName.createSpan({ cls: 'collapsible-icon' });
    setIcon(iconEl, isExpanded ? 'chevron-down' : 'chevron-right');
    
    headerName.appendText(title);
    
    const headerDesc = headerInfo.createDiv({ cls: 'setting-item-description' });
    headerDesc.setText(description);

    // 创建内容区域
    const contentEl = wrapperEl.createDiv({ cls: 'collapsible-content' });
    contentEl.style.display = isExpanded ? 'block' : 'none';

    // 点击标题切换展开/收起
    headerEl.addEventListener('click', () => {
      const willExpand = !this.expandedSections.has(sectionId);
      
      if (willExpand) {
        this.expandedSections.add(sectionId);
        contentEl.style.display = 'block';
        headerEl.addClass('is-expanded');
        setIcon(iconEl, 'chevron-down');
        
        // 如果内容还未渲染，现在渲染
        if (contentEl.children.length === 0) {
          renderContent(contentEl);
        }
      } else {
        this.expandedSections.delete(sectionId);
        contentEl.style.display = 'none';
        headerEl.removeClass('is-expanded');
        setIcon(iconEl, 'chevron-right');
      }
    });

    // 设置初始状态
    if (isExpanded) {
      headerEl.addClass('is-expanded');
      renderContent(contentEl);
    }
  }

  /**
   * 验证自定义 Shell 路径
   * @param containerEl 容器元素
   * @param path Shell 路径
   */
  private validateCustomShellPath(containerEl: HTMLElement, path: string): void {
    // 移除之前的验证消息
    const existingValidation = containerEl.querySelector('.shell-path-validation');
    if (existingValidation) {
      existingValidation.remove();
    }
    
    // 如果路径为空，不显示验证消息
    if (!path || path.trim() === '') {
      return;
    }
    
    // 创建验证消息容器
    const validationEl = containerEl.createDiv({ cls: 'shell-path-validation setting-item-description' });
    validationEl.style.marginTop = '8px';
    
    // 验证路径
    const isValid = validateShellPath(path);
    
    if (isValid) {
      validationEl.setText('✅ 路径有效');
      validationEl.style.color = 'var(--text-success)';
    } else {
      validationEl.setText('⚠️ 警告: 路径不存在或无法访问，终端可能无法启动');
      validationEl.style.color = 'var(--text-error)';
    }
  }

  /**
   * 标准化 API 端点 URL
   * @param url 原始 URL
   * @returns 标准化后的 URL
   */
  private normalizeEndpoint(url: string): { url: string } {
    let normalized = url.trim();

    if (!normalized) {
      return { url: '' };
    }

    // 检查协议
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
      // 尝试检测基础 URL 并自动补全
      const urlObj = this.tryParseUrl(normalized);
      if (urlObj) {
        const pathname = urlObj.pathname;

        // 如果路径以 /v1 结尾，自动补全为 /v1/chat/completions
        if (pathname === '/v1' || pathname === '/v1/') {
          normalized = normalized + '/chat/completions';
        }
        // 如果只有根路径或空路径，补全为 /v1/chat/completions
        else if (!pathname || pathname === '/') {
          normalized = normalized + '/v1/chat/completions';
        }
        // 如果路径以 /chat 结尾，补全为 /chat/completions
        else if (pathname === '/chat' || pathname === '/chat/') {
          normalized = normalized + '/completions';
        }
      }
    }

    // 修正双斜杠
    if (normalized.includes('//v1')) {
      normalized = normalized.replace('//v1', '/v1');
    }

    return { url: normalized };
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
}

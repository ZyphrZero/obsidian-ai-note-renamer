import { Plugin, TFile, Menu, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { AIFileNamerSettings, DEFAULT_SETTINGS } from './settings/settings';
import { AIFileNamerSettingTab } from './settings/settingsTab';
import { AIService } from './services/naming/aiService';
import { FileNameService, RenameResult } from './services/naming/fileNameService';
import { NoticeHelper } from './ui/noticeHelper';
import { TerminalService } from './services/terminal/terminalService';
import { TerminalView, TERMINAL_VIEW_TYPE } from './ui/terminal/terminalView';

/**
 * AI 文件名生成器插件主类
 */
export default class AIFileNamerPlugin extends Plugin {
  settings: AIFileNamerSettings;
  aiService: AIService;
  fileNameService: FileNameService;
  terminalService: TerminalService;
  generatingFiles: Set<string> = new Set();


  /**
   * 插件加载时调用
   */
  async onload() {
    console.debug('加载 AI File Namer 插件');

    // 加载设置
    await this.loadSettings();

    // 初始化服务
    this.aiService = new AIService(this.app, this.settings);
    this.fileNameService = new FileNameService(
      this.app,
      this.aiService,
      this.settings
    );
    
    // 初始化终端服务（使用 Rust PTY 服务器架构）
    console.log('[Plugin] 使用 Rust PTY 服务器架构');
    const pluginDir = this.getPluginDir();
    this.terminalService = new TerminalService(this.app, this.settings.terminal, pluginDir);

    // 注册终端视图
    this.registerView(
      TERMINAL_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new TerminalView(leaf, this.terminalService)
    );

    // 添加侧边栏图标按钮 - AI 文件名生成
    if (this.settings.featureVisibility.aiNaming.showInRibbon) {
      this.addRibbonIcon('sparkles', 'AI 文件名生成', async () => {
        await this.handleGenerateCommand();
      });
    }

    // 添加侧边栏图标按钮 - 打开终端
    if (this.settings.featureVisibility.terminal.showInRibbon) {
      this.addRibbonIcon('terminal-square', '打开终端', async () => {
        await this.activateTerminalView();
      });
    }

    // 添加命令面板命令 - AI 文件名生成
    if (this.settings.featureVisibility.aiNaming.showInCommandPalette) {
      this.addCommand({
        id: 'generate-ai-filename',
        name: '生成 AI 文件名',
        callback: async () => {
          await this.handleGenerateCommand();
        }
      });
    }

    // 添加打开终端命令
    if (this.settings.featureVisibility.terminal.showInCommandPalette) {
      this.addCommand({
        id: 'open-terminal',
        name: '打开终端',
        callback: async () => {
          await this.activateTerminalView();
        }
      });
    }

    // 添加编辑器右键菜单
    if (this.settings.featureVisibility.aiNaming.showInEditorMenu) {
      this.registerEvent(
        this.app.workspace.on('editor-menu', (menu: Menu, _editor, _view) => {
          menu.addItem((item) => {
            item
              .setTitle('生成 AI 文件名')
              .setIcon('sparkles')
              .onClick(async () => {
                await this.handleGenerateCommand();
              });
          });
        })
      );
    }

    // 添加文件浏览器右键菜单
    if (this.settings.featureVisibility.aiNaming.showInFileMenu) {
      this.registerEvent(
        this.app.workspace.on('file-menu', (menu: Menu, file) => {
          if (file instanceof TFile) {
            menu.addItem((item) => {
              item
                .setTitle('生成 AI 文件名')
                .setIcon('sparkles')
                .onClick(async () => {
                  await this.handleGenerateForFile(file);
                });
            });
          }
        })
      );
    }

    // 添加设置标签页
    this.addSettingTab(new AIFileNamerSettingTab(this.app, this));

    // 监听文件切换，清理不属于当前文件的动画效果
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.cleanupTitleAnimations();
      })
    );

    // 恢复终端状态（如果启用）
    if (this.settings.terminal.restoreTerminalsOnLoad && 
        this.settings.terminal.savedTerminals.length > 0) {
      try {
        await this.terminalService.restoreTerminalStates(
          this.settings.terminal.savedTerminals
        );
        
        // 如果恢复了终端，自动打开终端面板
        await this.activateTerminalView();
      } catch (error) {
        console.error('恢复终端状态失败:', error);
        NoticeHelper.error('恢复终端状态失败，请手动创建新终端');
      }
    }

    // 启动 PTY 服务器
    try {
      await this.terminalService.ensurePtyServer();
      console.log('[Plugin] PTY 服务器已启动');
    } catch (error) {
      console.error('[Plugin] 启动 PTY 服务器失败:', error);
      NoticeHelper.error(
        '❌ PTY 服务器启动失败\n' +
        '请查看控制台获取详细错误信息'
      );
    }
  }

  /**
   * 清理不属于当前文件的标题动画效果
   */
  cleanupTitleAnimations() {
    const activeFile = this.app.workspace.getActiveFile();
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!activeView) return;

    const viewContent = activeView.containerEl.querySelector('.view-content');
    const inlineTitle = viewContent?.querySelector('.inline-title') as HTMLElement;

    if (!inlineTitle) return;

    // 如果当前文件不在生成列表中，移除动画效果
    if (!activeFile || !this.generatingFiles.has(activeFile.path)) {
      inlineTitle.removeClass('ai-generating-title');
    } else {
      // 如果当前文件正在生成，确保有动画效果
      inlineTitle.addClass('ai-generating-title');
    }
  }

  /**
   * 处理生成命令（从当前活动文件）
   */
  async handleGenerateCommand() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      NoticeHelper.error('没有打开的文件');
      return;
    }
    await this.handleGenerateForFile(file);
  }

  /**
   * 获取指定文件的标题元素
   * @param filePath 文件路径
   */
  getInlineTitleForFile(filePath: string): HTMLElement | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.path !== filePath) {
      return null;
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return null;

    const viewContent = activeView.containerEl.querySelector('.view-content');
    return viewContent?.querySelector('.inline-title') as HTMLElement;
  }

  /**
   * 处理指定文件的生成
   * @param file 目标文件
   */
  async handleGenerateForFile(file: TFile) {
    // 添加到生成中的文件集合
    this.generatingFiles.add(file.path);

    // 添加标题动画效果
    let inlineTitle = this.getInlineTitleForFile(file.path);
    if (inlineTitle) {
      inlineTitle.addClass('ai-generating-title');
    }

    try {
      NoticeHelper.info('正在生成文件名...');

      const result: RenameResult = await this.fileNameService.generateAndRename(file);

      // 根据结果显示不同的提示
      if (result.renamed) {
        NoticeHelper.success(result.message);
      } else {
        NoticeHelper.info(result.message);
      }
    } catch (error) {
      if (error instanceof Error) {
        NoticeHelper.error(`操作失败: ${error.message}`);
        console.error('AI 文件名生成错误:', error);
      } else {
        NoticeHelper.error('操作失败: 未知错误');
        console.error('AI 文件名生成错误:', error);
      }
    } finally {
      // 移除生成状态
      this.generatingFiles.delete(file.path);

      // 移除标题动画效果 - 重新获取元素以确保移除正确的元素
      inlineTitle = this.getInlineTitleForFile(file.path);
      if (inlineTitle) {
        inlineTitle.removeClass('ai-generating-title');
      }
    }
  }

  /**
   * 加载设置
   */
  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

    // 确保终端设置完整（深度合并）
    if (!this.settings.terminal) {
      this.settings.terminal = { ...DEFAULT_SETTINGS.terminal };
    } else {
      // 合并终端设置，确保所有字段都存在
      this.settings.terminal = {
        ...DEFAULT_SETTINGS.terminal,
        ...this.settings.terminal
      };
    }

    // 确保功能显示设置完整（深度合并）
    if (!this.settings.featureVisibility) {
      this.settings.featureVisibility = { ...DEFAULT_SETTINGS.featureVisibility };
    } else {
      // 合并功能显示设置，确保所有字段都存在
      this.settings.featureVisibility = {
        aiNaming: {
          ...DEFAULT_SETTINGS.featureVisibility.aiNaming,
          ...(this.settings.featureVisibility.aiNaming || {})
        },
        terminal: {
          ...DEFAULT_SETTINGS.featureVisibility.terminal,
          ...(this.settings.featureVisibility.terminal || {})
        }
      };
    }

    // 如果 defaultPromptTemplate 为空，使用代码中的默认值
    if (!this.settings.defaultPromptTemplate || this.settings.defaultPromptTemplate.trim() === '') {
      this.settings.defaultPromptTemplate = DEFAULT_SETTINGS.defaultPromptTemplate;
    }

    // 如果配置的 promptTemplate 为空，使用默认值
    this.settings.configs.forEach(config => {
      if (!config.promptTemplate || config.promptTemplate.trim() === '') {
        config.promptTemplate = this.settings.defaultPromptTemplate;
      }
    });

    // 保存修复后的配置
    if (loadedData) {
      await this.saveSettings();
    }
  }

  /**
   * 保存设置
   */
  async saveSettings() {
    await this.saveData(this.settings);
    // 更新终端服务的设置（如果已初始化）
    if (this.terminalService) {
      this.terminalService.updateSettings(this.settings.terminal);
    }
  }

  /**
   * 插件卸载时调用
   */
  async onunload() {
    console.debug('卸载 AI File Namer 插件');

    // 保存终端状态（如果启用）
    if (this.settings.terminal.restoreTerminalsOnLoad) {
      try {
        this.settings.terminal.savedTerminals = 
          this.terminalService.saveTerminalStates();
        await this.saveSettings();
      } catch (error) {
        console.error('保存终端状态失败:', error);
      }
    }

    // 清理所有终端
    try {
      await this.terminalService.destroyAllTerminals();
    } catch (error) {
      console.error('清理终端失败:', error);
    }

    // 停止 PTY 服务器
    try {
      await this.terminalService.stopPtyServer();
      console.log('[Plugin] PTY 服务器已停止');
    } catch (error) {
      console.error('[Plugin] 停止 PTY 服务器失败:', error);
    }
  }

  /**
   * 获取插件目录的绝对路径
   * 
   * @returns 插件目录的绝对路径
   */
  private getPluginDir(): string {
    const adapter = this.app.vault.adapter as any;
    const vaultPath = adapter.getBasePath();
    
    // @ts-ignore - manifest.dir 在运行时存在
    const manifestDir = this.manifest.dir || `.obsidian/plugins/${this.manifest.id}`;
    
    // 转换为绝对路径
    return require('path').join(vaultPath, manifestDir);
  }

  /**
   * 激活终端视图
   * 参考 obsidian-terminal 的实现逻辑
   */
  async activateTerminalView(): Promise<void> {
    const { workspace } = this.app;
    const leaf = this.getLeafForNewTerminal();

    // 如果启用锁定新实例，设置标签页为锁定状态
    if (this.settings.terminal.lockNewInstance) {
      leaf.setPinned(true);
    }

    await leaf.setViewState({
      type: TERMINAL_VIEW_TYPE,
      active: this.settings.terminal.focusNewInstance,
    });

    // 如果启用聚焦新实例，切换到新标签页
    if (this.settings.terminal.focusNewInstance) {
      workspace.setActiveLeaf(leaf, { focus: true });
    }
  }

  /**
   * 根据配置获取新终端的 WorkspaceLeaf
   * 完全参考 obsidian-terminal 的 TerminalView.getLeaf() 实现
   */
  private getLeafForNewTerminal(): WorkspaceLeaf {
    const { workspace } = this.app;
    const { leftSplit, rightSplit } = workspace;
    const { terminal: settings } = this.settings;

    // 如果启用"在现有终端附近创建"
    if (settings.createInstanceNearExistingOnes) {
      const existingLeaves = workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);
      const existingLeaf = existingLeaves[existingLeaves.length - 1];

      if (existingLeaf) {
        const root = existingLeaf.getRoot();

        // 如果在左侧栏，继续在左侧栏创建
        if (root === leftSplit) {
          const leftLeaf = workspace.getLeftLeaf(false);
          if (leftLeaf) return leftLeaf;
        }

        // 如果在右侧栏，继续在右侧栏创建
        if (root === rightSplit) {
          const rightLeaf = workspace.getRightLeaf(false);
          if (rightLeaf) return rightLeaf;
        }

        // 如果在主区域，设置为活动 leaf 并创建新标签页
        workspace.setActiveLeaf(existingLeaf);
        return workspace.getLeaf('tab');
      }
    }

    // 根据 newInstanceBehavior 创建新的 leaf
    switch (settings.newInstanceBehavior) {
      case 'replaceTab':
        // 替换当前标签页
        return workspace.getLeaf();

      case 'newTab':
        // 新标签页：在当前标签组中创建新标签页
        return workspace.getLeaf('tab');

      case 'newLeftTab': {
        // 左侧新标签页
        const leftLeaf = workspace.getLeftLeaf(false);
        return leftLeaf ?? workspace.getLeaf('split');
      }

      case 'newLeftSplit': {
        // 左侧新分屏
        const leftLeaf = workspace.getLeftLeaf(true);
        return leftLeaf ?? workspace.getLeaf('split');
      }

      case 'newRightTab': {
        // 右侧新标签页
        const rightLeaf = workspace.getRightLeaf(false);
        return rightLeaf ?? workspace.getLeaf('split');
      }

      case 'newRightSplit': {
        // 右侧新分屏
        const rightLeaf = workspace.getRightLeaf(true);
        return rightLeaf ?? workspace.getLeaf('split');
      }

      case 'newHorizontalSplit':
        // 水平分屏：在右侧创建分屏
        return workspace.getLeaf('split', 'horizontal');

      case 'newVerticalSplit':
        // 垂直分屏：在下方创建分屏
        return workspace.getLeaf('split', 'vertical');

      case 'newWindow':
        // 新窗口：在新窗口中打开
        return workspace.getLeaf('window');

      default:
        // 默认：水平分屏
        return workspace.getLeaf('split', 'vertical');
    }
  }
}

import { Plugin, TFile, Menu, setIcon, MarkdownView } from 'obsidian';
import { AIFileNamerSettings, DEFAULT_SETTINGS } from './settings/settings';
import { AIFileNamerSettingTab } from './settings/settingsTab';
import { AIService } from './services/aiService';
import { FileNameService } from './services/fileNameService';
import { NoticeHelper } from './ui/noticeHelper';

/**
 * AI 文件名生成器插件主类
 */
export default class AIFileNamerPlugin extends Plugin {
  settings: AIFileNamerSettings;
  aiService: AIService;
  fileNameService: FileNameService;
  titleObserver: MutationObserver;
  generatingFiles: Set<string> = new Set();


  /**
   * 插件加载时调用
   */
  async onload() {
    console.log('加载 AI File Namer 插件');

    // 加载设置
    await this.loadSettings();

    // 初始化服务
    this.aiService = new AIService(this.app, this.settings);
    this.fileNameService = new FileNameService(
      this.app,
      this.aiService,
      this.settings
    );

    // 添加侧边栏图标按钮
    this.addRibbonIcon('sparkles', 'AI 文件名生成', async () => {
      await this.handleGenerateCommand();
    });

    // 添加命令面板命令
    this.addCommand({
      id: 'generate-ai-filename',
      name: '生成 AI 文件名',
      callback: async () => {
        await this.handleGenerateCommand();
      }
    });

    // 添加编辑器右键菜单
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, editor, view) => {
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

    // 添加文件浏览器右键菜单
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

    // 添加设置标签页
    this.addSettingTab(new AIFileNamerSettingTab(this.app, this));

    // 初始化标题按钮观察器
    this.app.workspace.onLayoutReady(() => {
      this.setupTitleButtonObserver();
      this.injectTitleButton();
    });

    // 监听当前叶片变化
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.injectTitleButton();
      })
    );
  }

  /**
   * 设置观察器以监测内联标题的变化
   */
  setupTitleButtonObserver() {
    // 创建一个观察器实例
    this.titleObserver = new MutationObserver((mutations) => {
      // 检查变动中是否包含我们的按钮被移除，或者仅仅是内容变化
      let shouldReinject = false;

      // 检查当前活动的 inline-title
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) return;

      const inlineTitle = activeView.containerEl.querySelector('.inline-title');
      if (!inlineTitle) return;

      // 如果按钮不存在了，就需要注入
      if (!inlineTitle.querySelector('.ai-title-button')) {
        shouldReinject = true;
      }

      if (shouldReinject) {
        // 避免在观察回调中无限循环，先停止观察
        this.titleObserver.disconnect();
        this.injectTitleButton();
      }
    });
  }

  /**
   * 注入悬浮按钮到内联标题旁
   */
  injectTitleButton() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    // 查找内联标题元素
    const viewContent = activeView.containerEl.querySelector('.view-content');
    if (!viewContent) return;

    // 尝试更精确的查找
    const inlineTitle = viewContent.querySelector('.inline-title');
    if (!inlineTitle) return;

    // 修复：切换文件时清理残留的动画效果
    // 如果当前文件不在生成列表中，确保移除动画类
    const file = this.app.workspace.getActiveFile();
    if (file && !this.generatingFiles.has(file.path)) {
      inlineTitle.removeClass('ai-generating-title');
      const existingButton = inlineTitle.querySelector('.ai-title-button');
      if (existingButton) {
        existingButton.removeClass('generating');
      }
    }

    // 检查是否已经存在按钮 (检查 inlineTitle 内部)
    if (inlineTitle.querySelector('.ai-title-button')) {
      // 如果按钮已存在，只需确保观察器已连接
      this.ensureObserver(inlineTitle);
      return;
    }

    // 创建按钮
    const button = document.createElement('div');
    button.addClass('ai-title-button');
    setIcon(button, 'sparkles');
    button.title = '生成 AI 文件名';
    button.setAttribute('contenteditable', 'false'); // 防止按钮被包含在编辑内容中

    // 绑定点击事件
    this.registerDomEvent(button, 'click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const file = this.app.workspace.getActiveFile();
      if (!file) return;

      // 添加动画效果
      inlineTitle.addClass('ai-generating-title');
      button.addClass('generating');
      this.generatingFiles.add(file.path);

      try {
        await this.handleGenerateForFile(file);
      } finally {
        // 移除动画效果
        inlineTitle.removeClass('ai-generating-title');
        button.removeClass('generating');
        this.generatingFiles.delete(file.path);
      }
    });

    // 插入按钮 - 作为内联标题的第一个子元素 (显示在前面)
    // 即使标题为空（只有 <br>），prepend 也能正常工作
    inlineTitle.prepend(button);

    // 确保连接观察器
    this.ensureObserver(inlineTitle);
  }

  /**
   * 确保观察器已连接到指定的内联标题
   */
  ensureObserver(targetNode: Element) {
    if (this.titleObserver) {
      // 重新连接观察器
      this.titleObserver.disconnect();

      // 观察 childList (增加/删除节点) 和 characterData (文本变动，虽然通常文本变动不会删掉按钮，但全选删除会)
      // 同时也观察 subtree，因为 CodeMirror 可能会重建内部结构
      this.titleObserver.observe(targetNode, {
        childList: true,
        subtree: true,
        characterData: true
      });

      // 也观察父级，以防整个 inline-title 被替换
      if (targetNode.parentElement) {
        this.titleObserver.observe(targetNode.parentElement, { childList: true });
      }
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
   * 处理指定文件的生成
   * @param file 目标文件
   */
  async handleGenerateForFile(file: TFile) {
    try {
      NoticeHelper.info('正在生成文件名...');

      await this.fileNameService.generateAndRename(file);

      NoticeHelper.success(`文件已重命名为: ${file.basename}`);
    } catch (error) {
      if (error instanceof Error) {
        NoticeHelper.error(`操作失败: ${error.message}`);
        console.error('AI 文件名生成错误:', error);
      } else {
        NoticeHelper.error('操作失败: 未知错误');
        console.error('AI 文件名生成错误:', error);
      }
    }
  }

  /**
   * 加载设置
   */
  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

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
  }

  /**
   * 插件卸载时调用
   */
  onunload() {
    console.log('卸载 AI File Namer 插件');
    if (this.titleObserver) {
      this.titleObserver.disconnect();
    }
  }
}

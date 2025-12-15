# AI Note Renamer

**AI Note Renamer** 是一款强大的 Obsidian 插件，利用 AI 智能分析笔记内容，一键生成准确、简洁且符合您习惯的文件名。告别起名困难症，让您的知识库井井有条。

## ✨ 功能特性

*   **🧠 智能重命名**：基于 OpenAI 兼容 API（支持 GPT, Claude, DeepSeek 等），深度理解笔记内容并生成最佳文件名。
*   **🖱️ 便捷触发**：
    *   **悬浮魔法按钮**：直接在笔记标题旁显示悬浮按钮，点击即刻生成。
    *   **多处入口**：支持侧边栏图标、命令面板、编辑器右键及文件列表右键菜单。
*   **⚙️ 多配置管理**：支持保存多套 API 配置，并可快速切换。
*   **🎨 高度可定制**：
    *   自定义 Prompt 模板，支持变量注入。
    *   精细控制 AI 参数（Temperature, Top P, Max Tokens）。
    *   **上下文感知**：可选择是否参考当前文件名进行优化。
*   **🛡️ 健壮性设计**：
    *   支持 "思考链" 模型（如 DeepSeek R1），自动过滤 `<think>` 标签。
    *   智能 API 端点补全与修正。
    *   自定义请求超时时间。

## 🚀 安装

### 手动安装（推荐）
1.  从 [Releases](https://github.com/yourusername/obsidian-ai-note-renamer/releases) 下载 `main.js`, `manifest.json`, `styles.css`。
2.  将文件放入您的插件目录：`.obsidian/plugins/ai-note-renamer/`。
3.  重启 Obsidian 并在设置中启用插件。

### 源码编译
```bash
git clone https://github.com/yourusername/obsidian-ai-note-renamer.git
cd obsidian-ai-note-renamer
npm install
npm run build
```

## 📖 使用指南

### 1. 配置 API
进入 **设置 > AI File Namer**：
*   **API 端点**：输入您的 API 地址（插件会自动补全路径，如 `/v1/chat/completions`）。
*   **API Key**：输入您的密钥。
*   **模型**：输入模型名称（如 `gpt-4o`, `deepseek-chat`）。
*   点击 **"测试连接"** 确保配置正确。

### 2. 生成文件名
您可以通过以下任意方式触发：
*   **✨ 标题悬浮按钮**：鼠标悬停在笔记标题（Inline Title）区域，点击出现的星星图标。
*   **命令面板**：`Ctrl/Cmd + P` 输入 "Generate AI File Name"。
*   **右键菜单**：在文件列表或编辑器区域右键点击。

### 3. Prompt 模板变量
在设置中自定义 Prompt 时，可以使用以下变量：
*   `{{content}}`：笔记内容片段（智能截断）。
*   `{{currentFileName}}`：当前文件名。
*   `{{#if currentFileName}}...{{/if}}`：条件块，仅当有文件名时显示。

**Example Template:**
```text
请阅读以下笔记内容，为其生成一个不仅简洁而且极具概括性的文件名。
不要包含扩展名，不要使用特殊字符。

笔记内容：
{{content}}
```

## ⚙️ 高级设置

*   **使用当前文件名作为上下文**：开启后，AI 会知道当前文件名叫什么，您可以让它"优化"现有名称而不是重新生成。
*   **分析目录命名风格**：(实验性) 尝试分析同目录下其他文件的命名习惯。
*   **调试模式**：在开发者控制台 (Ctrl+Shift+I) 输出完整的 Prompt 和 API 响应，便于排查问题。
*   **超时设置**：网络较慢时可适当增加超时时间。

## 🧩 常见问题

**Q: 支持 DeepSeek 或 Claude 吗？**
A: 支持。本插件兼容 OpenAI 格式接口。对于 DeepSeek 等输出 "思考过程" 的模型，插件会自动过滤 `<think>` 标签，只保留最终结果。

**Q: 为什么生成的标题没变化？**
A: 请检查 Prompt 模板是否合理，或者开启调试模式并按下 `Ctrl+Shift+I` 打开控制台，查看 AI 实际返回的内容。

---
<div align="center">

**用 ❤️ 构建 | Made with Love**

⭐ 如果这个项目对你有帮助，请给我们一个 Star！❤️

</div>

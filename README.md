# AI Note Renamer

**AI Note Renamer** is a powerful Obsidian plugin that uses AI to intelligently analyze note content and generate accurate, concise, and habit-compliant filenames with one click. Say goodbye to naming difficulties and keep your knowledge base organized.

[中文文档](./README_CN.md)

## ✨ Features

*   **🧠 Intelligent Renaming**: Based on OpenAI-compatible APIs (supports GPT, Claude, DeepSeek, etc.), it deeply understands note content and generates the best filenames.
*   **🖱️ Convenient Triggers**:
    *   **Hover Magic Button**: Displays a floating button directly next to the note title, generating with a single click.
    *   **Multiple Entry Points**: Supports sidebar icon, command palette, editor right-click, and file list right-click menus.
*   **⚙️ Multi-Config Management**: Supports saving multiple sets of API configurations and quick switching.
*   **🎨 Highly Customizable**:
    *   Custom Prompt templates, supporting variable injection.
    *   Fine-grained control of AI parameters (Temperature, Top P, Max Tokens).
    *   **Context Awareness**: Option to reference the current filename for optimization.
*   **🛡️ Robust Design**:
    *   Supports "Chain of Thought" models (like DeepSeek R1), automatically filtering out `<think>` tags.
    *   Intelligent API endpoint completion and correction.
    *   Customizable request timeout settings.

## 🚀 Installation

### Manual Installation (Recommended)
1.  Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/ZyphrZero/obsidian-ai-note-renamer/releases).
2.  Place the files in your library directory: `.obsidian/plugins/ai-note-renamer/`.
3.  Restart Obsidian and enable the plugin in the settings.

### Source Code Compilation
```bash
git clone https://github.com/ZyphrZero/obsidian-ai-note-renamer.git
cd obsidian-ai-note-renamer
npm install
npm run build
```

## 📖 User Guide

### 1. Configure API
Enter **Settings > AI File Namer**:
*   **API Endpoint**: Enter your API address (the plugin will automatically complete the path, like `/v1/chat/completions`).
*   **API Key**: Enter your key.
*   **Model**: Enter the model name (e.g., `gpt-4o`, `deepseek-chat`).
*   Click **"Test Connection"** to ensure the configuration is correct.

### 2. Generate File Name
You can trigger it in any of the following ways:
*   **✨ Title Hover Button**: Hover over the title of the note (Inline Title) area, click the star icon that appears.
*   **Command Palette**: `Ctrl/Cmd + P` input "Generate AI File Name".
*   **Right-click Menu**: Right-click in the file list or editor area.

### 3. Prompt Template Variables
In the settings, you can use the following variables when customizing the prompt:
*   `{{content}}`: Note content snippet (smartly truncated).
*   `{{currentFileName}}`: Current file name.
*   `{{#if currentFileName}}...{{/if}}`: Conditional block that only displays when there is a file name.

**Example Template:**
```text
Please read the following note content and generate a filename that is concise and highly summary.
Do not include the extension, do not use special characters.

Note content:
{{content}}
```

## ⚙️ Advanced Settings

*   **Use Current Filename as Context**: When enabled, the AI will know the current filename, allowing you to ask it to "optimize" the existing name instead of regenerating it.
*   **Analyze Directory Naming Style**: (Experimental) Attempts to analyze the naming habits of other files in the same directory.
*   **Debug Mode**: Output the full Prompt and API response in the developer console (Ctrl+Shift+I) for troubleshooting.
*   **Timeout Settings**: You can appropriately increase the timeout period when the network is slow.

## 🧩 FAQ

**Q: Does it support DeepSeek or Claude?**
A: Yes. This plugin is compatible with OpenAI format interfaces. For models like DeepSeek that output a "thinking process," the plugin automatically filters out `<think>` tags, keeping only the final result.

**Q: Why hasn't the generated title changed?**
A: Please check if the Prompt template is reasonable, or enable Debug Mode and press `Ctrl+Shift+I` to open the console and view the content actually returned by the AI.

---
<div align="center">

**Made with Love**

⭐ If this project helps you, please give us a Star! ❤️

</div>

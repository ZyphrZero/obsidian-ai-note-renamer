# GitHub Actions 工作流说明

本目录包含两个 GitHub Actions 工作流配置文件，用于自动化构建和发布流程。

## 工作流文件

### 1. build-rust.yml - Rust 构建 CI

**触发条件:**
- 推送到 `main` 或 `develop` 分支
- Pull Request 到 `main` 或 `develop` 分支
- 手动触发 (workflow_dispatch)

**功能:**
- 并行构建 5 个平台的 Rust PTY 服务器二进制文件
- 验证二进制文件大小和功能
- 上传构建产物（保留 7 天）

**支持的平台:**
- Windows x64 (x86_64-pc-windows-msvc)
- macOS ARM64 (aarch64-apple-darwin)
- macOS x64 (x86_64-apple-darwin)
- Linux x64 (x86_64-unknown-linux-gnu)
- Linux ARM64 (aarch64-unknown-linux-gnu)

**构建步骤:**
1. 检出代码
2. 安装 Rust 工具链和目标平台
3. 安装交叉编译工具（Linux ARM64）
4. 缓存 Cargo 依赖
5. 构建 release 版本
6. 验证二进制文件
7. 上传构建产物

**测试步骤:**
- 在对应平台上测试二进制文件能否正常启动
- 验证端口信息输出格式

### 2. release.yml - 发布流程

**触发条件:**
- 推送版本标签 (格式: `*.*.*`，例如 `1.0.0`)

**功能:**
- 构建所有平台的 Rust 二进制文件
- 生成 SHA256 校验和文件
- 构建 TypeScript 插件
- 打包插件（包含 3 个内置平台的二进制）
- 创建 GitHub Release
- 上传所有文件到 Release

**工作流程:**

#### Job 1: build-rust
- 并行构建 5 个平台的二进制文件
- 为每个二进制生成 SHA256 校验和
- 上传所有二进制和校验和文件作为 artifacts

#### Job 2: build-plugin
- 等待 build-rust 完成
- 下载所有二进制文件
- 设置可执行权限（Unix 系统）
- 构建 TypeScript 插件
- 运行 package 脚本（包含 3 个内置平台）
- 验证包体积
- 创建 GitHub Release 并上传文件

**Release 包含的文件:**
- `obsidian-smart-workflow.zip` - 完整插件包（推荐）
- `main.js`, `manifest.json`, `styles.css` - 核心文件
- 5 个平台的二进制文件及其 SHA256 校验和

## 使用说明

### 触发 CI 构建

推送代码到 main 或 develop 分支：
```bash
git push origin main
```

或创建 Pull Request。

### 创建发布版本

1. 更新版本号（在 `manifest.json` 和 `package.json` 中）
2. 提交更改
3. 创建并推送版本标签：

```bash
git tag 1.0.0
git push origin 1.0.0
```

4. GitHub Actions 将自动：
   - 构建所有平台的二进制文件
   - 打包插件
   - 创建 Release
   - 上传所有文件

### 手动触发构建

在 GitHub 仓库页面：
1. 进入 "Actions" 标签
2. 选择 "Build Rust PTY Server" 工作流
3. 点击 "Run workflow"
4. 选择分支并运行

## 配置要求

### Secrets
- `GITHUB_TOKEN` - 自动提供，用于创建 Release

### 权限
- `contents: write` - 用于创建 Release 和上传文件

## 构建优化

### Rust 构建优化
- 使用 `--release` 模式
- 启用 LTO (Link Time Optimization)
- Strip 符号表
- 目标体积: < 2MB per binary

### 缓存策略
- 缓存 Cargo 依赖和构建产物
- 使用 `Cargo.lock` 作为缓存键
- 分平台缓存以提高命中率

### 并行构建
- 使用 matrix 策略并行构建 5 个平台
- `fail-fast: false` 确保一个平台失败不影响其他平台

## 故障排除

### 构建失败

**问题**: Rust 构建失败
- 检查 `pty-server/Cargo.toml` 依赖版本
- 查看构建日志中的错误信息
- 确保 Rust 工具链版本兼容

**问题**: 交叉编译失败（Linux ARM64）
- 确保安装了 `gcc-aarch64-linux-gnu`
- 检查目标平台配置

**问题**: 二进制文件体积过大
- 检查 `Cargo.toml` 中的优化配置
- 确保启用了 `strip = true`

### 打包失败

**问题**: 缺少二进制文件
- 确保 build-rust job 成功完成
- 检查 artifacts 是否正确上传和下载

**问题**: 包体积超过 10MB
- 检查是否包含了不必要的文件
- 只包含 3 个内置平台的二进制
- 考虑进一步优化二进制体积

### Release 失败

**问题**: 无法创建 Release
- 检查 `GITHUB_TOKEN` 权限
- 确保标签格式正确 (`*.*.*`)
- 检查是否有同名 Release 已存在

## 维护建议

### 定期更新
- 定期更新 GitHub Actions 版本
- 更新 Rust 工具链版本
- 更新 Node.js 版本

### 监控
- 关注构建时间和成功率
- 监控二进制文件体积变化
- 检查缓存命中率

### 测试
- 在本地测试构建脚本
- 验证所有平台的二进制文件
- 测试完整的发布流程

## 相关文件

- `scripts/build-rust.js` - 本地 Rust 构建脚本
- `scripts/package-plugin.js` - 插件打包脚本
- `pty-server/Cargo.toml` - Rust 项目配置
- `package.json` - npm 脚本配置

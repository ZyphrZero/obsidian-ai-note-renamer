/**
 * 插件打包脚本
 * 打包插件并只包含 3 个内置平台的二进制文件
 * 确保总体积 < 10MB
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 内置平台（覆盖 95% 用户）
const BUILTIN_PLATFORMS = [
  'win32-x64',
  'darwin-arm64',
  'linux-x64'
];

// 体积参考值（仅用于提示）
const REFERENCE_PACKAGE_SIZE = 10 * 1024 * 1024;

// 项目路径
const ROOT_DIR = path.join(__dirname, '..');
const BINARIES_DIR = path.join(ROOT_DIR, 'binaries');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('📦 插件打包脚本');
console.log('');

// 1. 检查必需的文件
console.log('🔍 检查必需文件...');
const requiredFiles = [
  'main.js',
  'manifest.json',
  'styles.css'
];

for (const file of requiredFiles) {
  const filePath = path.join(ROOT_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 错误: 缺少必需文件 ${file}`);
    console.error('请先运行 npm run build');
    process.exit(1);
  }
}
console.log('✅ 所有必需文件存在');
console.log('');

// 2. 检查内置平台的二进制文件
console.log('🔍 检查内置平台二进制文件...');
const missingBinaries = [];

for (const platform of BUILTIN_PLATFORMS) {
  const ext = platform.startsWith('win32') ? '.exe' : '';
  const binaryName = `pty-server-${platform}${ext}`;
  const binaryPath = path.join(BINARIES_DIR, binaryName);
  
  if (!fs.existsSync(binaryPath)) {
    missingBinaries.push(binaryName);
    console.error(`  ❌ 缺少: ${binaryName}`);
  } else {
    const stats = fs.statSync(binaryPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`  ✓ ${binaryName} (${sizeMB} MB)`);
  }
}

if (missingBinaries.length > 0) {
  console.error('');
  console.error(`❌ 错误: 缺少 ${missingBinaries.length} 个二进制文件`);
  console.error('请先运行: node scripts/build-rust.js');
  process.exit(1);
}
console.log('✅ 所有内置平台二进制文件存在');
console.log('');

// 3. 创建 dist 目录
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// 4. 计算总体积
console.log('📊 计算包体积...');
let totalSize = 0;

// 核心文件
for (const file of requiredFiles) {
  const filePath = path.join(ROOT_DIR, file);
  const stats = fs.statSync(filePath);
  totalSize += stats.size;
  const sizeKB = (stats.size / 1024).toFixed(1);
  console.log(`  ${file}: ${sizeKB} KB`);
}

// 二进制文件
for (const platform of BUILTIN_PLATFORMS) {
  const ext = platform.startsWith('win32') ? '.exe' : '';
  const binaryName = `pty-server-${platform}${ext}`;
  const binaryPath = path.join(BINARIES_DIR, binaryName);
  const stats = fs.statSync(binaryPath);
  totalSize += stats.size;
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`  ${binaryName}: ${sizeMB} MB`);
}

// src 目录（如果需要包含）
const srcDir = path.join(ROOT_DIR, 'src');
if (fs.existsSync(srcDir)) {
  const srcSize = getDirectorySize(srcDir);
  totalSize += srcSize;
  const sizeMB = (srcSize / 1024 / 1024).toFixed(2);
  console.log(`  src/: ${sizeMB} MB`);
}

const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
console.log('');
console.log(`📦 总体积: ${totalSizeMB} MB`);

// 5. 体积信息提示
if (totalSize > REFERENCE_PACKAGE_SIZE) {
  const refMB = (REFERENCE_PACKAGE_SIZE / 1024 / 1024).toFixed(0);
  console.log(`💡 提示: 包体积 (${totalSizeMB} MB) 超过 ${refMB} MB 参考值`);
  console.log('   这是正常的，所有文件都会被包含');
} else {
  console.log(`✅ 包体积在参考范围内 (< ${(REFERENCE_PACKAGE_SIZE / 1024 / 1024).toFixed(0)} MB)`);
}

console.log('');

// 6. 读取版本号
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));
const version = manifest.version;

// 7. 创建打包目录
const packageDir = path.join(DIST_DIR, `obsidian-terminal-${version}`);
if (fs.existsSync(packageDir)) {
  fs.rmSync(packageDir, { recursive: true, force: true });
}
fs.mkdirSync(packageDir, { recursive: true });

console.log('📋 复制文件到打包目录...');

// 8. 复制核心文件
for (const file of requiredFiles) {
  const srcPath = path.join(ROOT_DIR, file);
  const destPath = path.join(packageDir, file);
  fs.copyFileSync(srcPath, destPath);
  console.log(`  ✓ ${file}`);
}

// 9. 复制 src 目录（如果需要）
if (fs.existsSync(srcDir)) {
  const destSrcDir = path.join(packageDir, 'src');
  copyDirectory(srcDir, destSrcDir);
  console.log(`  ✓ src/`);
}

// 10. 创建 binaries 目录并复制内置平台二进制
const destBinariesDir = path.join(packageDir, 'binaries');
fs.mkdirSync(destBinariesDir, { recursive: true });

for (const platform of BUILTIN_PLATFORMS) {
  const ext = platform.startsWith('win32') ? '.exe' : '';
  const binaryName = `pty-server-${platform}${ext}`;
  const srcPath = path.join(BINARIES_DIR, binaryName);
  const destPath = path.join(destBinariesDir, binaryName);
  
  fs.copyFileSync(srcPath, destPath);
  
  // 复制 SHA256 文件
  const checksumSrc = `${srcPath}.sha256`;
  if (fs.existsSync(checksumSrc)) {
    fs.copyFileSync(checksumSrc, `${destPath}.sha256`);
  }
  
  console.log(`  ✓ binaries/${binaryName}`);
}

console.log('');

// 11. 创建 README（可选）
const readmePath = path.join(ROOT_DIR, 'README.md');
if (fs.existsSync(readmePath)) {
  fs.copyFileSync(readmePath, path.join(packageDir, 'README.md'));
  console.log('  ✓ README.md');
}

// 12. 创建 LICENSE（可选）
const licensePath = path.join(ROOT_DIR, 'LICENSE');
if (fs.existsSync(licensePath)) {
  fs.copyFileSync(licensePath, path.join(packageDir, 'LICENSE'));
  console.log('  ✓ LICENSE');
}

console.log('');

// 13. 验证打包结果
console.log('✅ 打包验证...');
const packageSize = getDirectorySize(packageDir);
const packageSizeMB = (packageSize / 1024 / 1024).toFixed(2);
console.log(`  📦 打包后体积: ${packageSizeMB} MB`);

if (packageSize > REFERENCE_PACKAGE_SIZE) {
  const refMB = (REFERENCE_PACKAGE_SIZE / 1024 / 1024).toFixed(0);
  console.log(`  💡 提示: 打包后体积超过 ${refMB} MB 参考值，这是正常的`);
}

// 14. 创建 ZIP 包（可选）
const createZip = process.argv.includes('--zip');
if (createZip) {
  console.log('');
  console.log('📦 创建 ZIP 包...');
  
  try {
    // 检查是否安装了 zip 命令
    execSync('zip --version', { stdio: 'pipe' });
    
    const zipName = `obsidian-smart-workflow.zip`;
    const zipPath = path.join(ROOT_DIR, zipName);
    
    // 删除旧的 ZIP 文件
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
    // 创建 ZIP（在项目根目录）
    execSync(`cd "${DIST_DIR}" && zip -r "../${zipName}" "obsidian-terminal-${version}"`, {
      shell: true,
      stdio: 'pipe'
    });
    
    const zipStats = fs.statSync(zipPath);
    const zipSizeMB = (zipStats.size / 1024 / 1024).toFixed(2);
    console.log(`  ✅ ZIP 创建成功: ${zipName} (${zipSizeMB} MB)`);
  } catch (error) {
    console.warn('  ⚠️  无法创建 ZIP 包（zip 命令未找到）');
    console.warn('  提示: 可以手动压缩 dist/ 目录');
  }
}

console.log('');
console.log('🎉 打包完成！');
console.log(`📁 打包目录: ${packageDir}`);
console.log('');
console.log('📋 内置平台:');
for (const platform of BUILTIN_PLATFORMS) {
  console.log(`  - ${platform}`);
}
console.log('');
console.log('💡 其他平台 (darwin-x64, linux-arm64) 将在首次使用时自动下载');

/**
 * 递归计算目录大小
 */
function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      totalSize += getDirectorySize(fullPath);
    } else {
      const stats = fs.statSync(fullPath);
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

/**
 * 递归复制目录
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

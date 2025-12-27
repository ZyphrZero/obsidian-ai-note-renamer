/**
 * Rust PTY Server Build Script
 * Auto-detect current platform and build the corresponding binary
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Supported platform configurations
const PLATFORMS = {
  'win32-x64': { 
    target: 'x86_64-pc-windows-msvc',
    ext: '.exe',
    displayName: 'Windows x64'
  },
  'darwin-x64': { 
    target: 'x86_64-apple-darwin',
    ext: '',
    displayName: 'macOS Intel'
  },
  'darwin-arm64': { 
    target: 'aarch64-apple-darwin',
    ext: '',
    displayName: 'macOS Apple Silicon'
  },
  'linux-x64': { 
    target: 'x86_64-unknown-linux-gnu',
    ext: '',
    displayName: 'Linux x64'
  },
  'linux-arm64': { 
    target: 'aarch64-unknown-linux-gnu',
    ext: '',
    displayName: 'Linux ARM64'
  },
};

// Reference binary size (for hints only)
const REFERENCE_BINARY_SIZE = 2 * 1024 * 1024;

// Project paths
const PTY_SERVER_DIR = path.join(__dirname, '..', 'pty-server');
const BINARIES_DIR = path.join(__dirname, '..', 'binaries');

/**
 * Get current platform identifier
 */
function getCurrentPlatform() {
  return `${process.platform}-${process.arch}`;
}

console.log('🦀 Rust PTY Server Build Script');
console.log('');

// Detect current platform
const currentPlatform = getCurrentPlatform();
const platformConfig = PLATFORMS[currentPlatform];

if (!platformConfig) {
  console.error(`❌ Error: Current platform "${currentPlatform}" is not supported`);
  console.error(`Supported platforms: ${Object.keys(PLATFORMS).join(', ')}`);
  process.exit(1);
}

console.log(`🔍 Current platform: ${platformConfig.displayName} (${currentPlatform})`);
console.log('');

// Check if Rust is installed
try {
  const rustVersion = execSync('cargo --version', { encoding: 'utf8' });
  console.log(`✅ Rust installed: ${rustVersion.trim()}`);
} catch (error) {
  console.error('❌ Error: Cargo not found');
  console.error('Please install Rust first: https://rustup.rs/');
  process.exit(1);
}

// Check pty-server directory
if (!fs.existsSync(PTY_SERVER_DIR)) {
  console.error(`❌ Error: pty-server directory not found: ${PTY_SERVER_DIR}`);
  process.exit(1);
}

// Create binaries directory
if (!fs.existsSync(BINARIES_DIR)) {
  fs.mkdirSync(BINARIES_DIR, { recursive: true });
  console.log(`📁 Created binaries directory: ${BINARIES_DIR}`);
}

console.log('');

// Parse command line arguments
const args = process.argv.slice(2);
const skipInstall = args.includes('--skip-install');

// Install build target
if (!skipInstall) {
  console.log('📦 Installing Rust build target...');
  try {
    console.log(`  - ${platformConfig.target}`);
    execSync(`rustup target add ${platformConfig.target}`, { 
      stdio: 'pipe',
      cwd: PTY_SERVER_DIR 
    });
  } catch (error) {
    console.warn(`  ⚠️  Cannot install ${platformConfig.target}, may already be installed`);
  }
  console.log('');
}

// Build
console.log(`🔨 Building ${platformConfig.displayName}...`);

try {
  buildPlatform(currentPlatform, platformConfig);
  console.log(`✅ Build successful`);
  console.log('');
  console.log('🎉 Build complete!');
  console.log(`📁 Binary location: ${BINARIES_DIR}`);
} catch (error) {
  console.error(`❌ Build failed: ${error.message}`);
  process.exit(1);
}

/**
 * Build binary for current platform
 */
function buildPlatform(platformName, config) {
  const binaryName = `pty-server-${platformName}${config.ext}`;
  const outputPath = path.join(BINARIES_DIR, binaryName);
  
  // 1. Clean cache
  console.log('  🧹 Cleaning cache...');
  try {
    execSync(
      `cargo clean --release --target ${config.target}`,
      {
        cwd: PTY_SERVER_DIR,
        stdio: 'pipe',
        encoding: 'utf8'
      }
    );
  } catch (error) {
    console.log('  ⚠️  Cache clean skipped (may be first build)');
  }
  
  // 2. Compile
  console.log('  📦 Compiling...');
  const startTime = Date.now();
  
  try {
    execSync(
      `cargo build --release --target ${config.target}`,
      {
        cwd: PTY_SERVER_DIR,
        stdio: 'pipe',
        encoding: 'utf8'
      }
    );
  } catch (error) {
    throw new Error(`Compilation failed: ${error.stderr || error.message}`);
  }
  
  const buildTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  ⏱️  Build time: ${buildTime}s`);
  
  // 3. Find build artifact
  const targetDir = path.join(PTY_SERVER_DIR, 'target', config.target, 'release');
  const sourceBinary = path.join(targetDir, `pty-server${config.ext}`);
  
  if (!fs.existsSync(sourceBinary)) {
    throw new Error(`Build artifact not found: ${sourceBinary}`);
  }
  
  // 4. Copy to binaries directory
  console.log('  📋 Copying binary...');
  fs.copyFileSync(sourceBinary, outputPath);
  
  // 5. Verify file size
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  const sizeKB = (stats.size / 1024).toFixed(0);
  
  console.log(`  📊 File size: ${sizeMB} MB (${sizeKB} KB)`);
  
  if (stats.size > REFERENCE_BINARY_SIZE) {
    console.log(`  💡 Note: File size exceeds 2MB reference, this is normal`);
  }
  
  // 6. Generate SHA256 checksum
  console.log('  🔐 Generating SHA256 checksum...');
  const checksum = generateChecksum(outputPath);
  const checksumPath = `${outputPath}.sha256`;
  fs.writeFileSync(checksumPath, `${checksum}  ${binaryName}\n`);
  console.log(`  ✓ SHA256: ${checksum}`);
}

/**
 * Generate SHA256 checksum for a file
 */
function generateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');
}

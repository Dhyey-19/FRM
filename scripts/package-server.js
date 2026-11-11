const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageDir = path.join(distDir, 'FRM-Server-Package');
const zipPath = path.join(distDir, 'FRM-Server-Package.zip');

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
}

function main() {
  console.log('=====================================================================');
  console.log('      BUILDING FRM SERVER DEPLOYMENT PACKAGE (NO GIT REQUIRED)       ');
  console.log('=====================================================================\n');

  // 1. Build frontend production bundle
  console.log('[1/5] Building production frontend assets...');
  execSync('npm run build:frontend', { cwd: rootDir, stdio: 'inherit', shell: true });

  // 2. Clean staging directory
  console.log('\n[2/5] Preparing clean package directory...');
  if (fs.existsSync(packageDir)) {
    fs.rmSync(packageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(packageDir, { recursive: true });

  // 3. Copy compiled frontend -> public/ (zero frontend/src source files)
  console.log('[3/5] Copying compiled frontend into public/...');
  copyIfExists(path.join(rootDir, 'frontend', 'dist'), path.join(packageDir, 'public'));

  // 4. Copy lean backend runtime, database init/migrations, scripts & batch launchers
  console.log('[4/5] Copying backend runtime, setup wizard & launchers...');
  const backendDest = path.join(packageDir, 'backend');
  fs.mkdirSync(backendDest, { recursive: true });
  fs.copyFileSync(path.join(rootDir, 'backend', 'server.js'), path.join(backendDest, 'server.js'));

  for (const dir of ['config', 'controllers', 'routes', 'middlewares', 'services']) {
    copyIfExists(path.join(rootDir, 'backend', dir), path.join(backendDest, dir));
  }

  const dbDest = path.join(backendDest, 'database');
  fs.mkdirSync(dbDest, { recursive: true });
  for (const file of ['migrator.js', 'backup.js', 'db.js', 'mssql_init_FRM_DB.sql']) {
    const srcFile = path.join(rootDir, 'backend', 'database', file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(dbDest, file));
    }
  }
  copyIfExists(path.join(rootDir, 'backend', 'database', 'migrations'), path.join(dbDest, 'migrations'));

  const scriptsDest = path.join(packageDir, 'scripts');
  fs.mkdirSync(scriptsDest, { recursive: true });
  for (const scriptFile of ['setup-server.js', 'generate-cert.js', 'create-desktop-shortcut.js', 'enable-autostart.js']) {
    fs.copyFileSync(path.join(rootDir, 'scripts', scriptFile), path.join(scriptsDest, scriptFile));
  }

  const rootFiles = [
    'Setup-Server.bat',
    'Start-FRM.bat',
    'Create-Desktop-Icon.bat',
    'Enable-AutoStart-On-Boot.bat',
    'backup-database.bat',
    'SERVER_SETUP.md',
    '.env.example'
  ];
  for (const file of rootFiles) {
    const srcFile = path.join(rootDir, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(packageDir, file));
    }
  }

  // Generate lean production package.json from existing dependency versions
  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const backendPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'backend', 'package.json'), 'utf8'));
  const mergedDeps = {
    ...(rootPkg.dependencies || {}),
    ...(backendPkg.dependencies || {}),
    ...(backendPkg.devDependencies || {})
  };

  const runtimeDepNames = [
    'cors',
    'dotenv',
    'exceljs',
    'express',
    'mssql',
    'multer',
    'nodemailer',
    'pdf-parse',
    'selfsigned'
  ];

  const runtimeDeps = {};
  for (const dep of runtimeDepNames) {
    if (mergedDeps[dep]) {
      runtimeDeps[dep] = mergedDeps[dep];
    }
  }

  const serverPkg = {
    name: 'frm-server',
    version: rootPkg.version || '1.0.0',
    description: 'FRM - Factory Resource Manager (Server Production Package)',
    main: 'backend/server.js',
    scripts: {
      start: 'node backend/server.js',
      cert: 'node scripts/generate-cert.js'
    },
    dependencies: runtimeDeps
  };
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(serverPkg, null, 2) + '\n', 'utf8');

  // 5. Compress into dist/FRM-Server-Package.zip
  console.log('[5/5] Creating ZIP archive dist/FRM-Server-Package.zip...');
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${packageDir}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );

  const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log('\n=====================================================================');
  console.log(`✓ Package Ready: ${zipPath} (${sizeMb} MB)`);
  console.log('  - Excluded: .git/, frontend/src/, node_modules/, factoryflow.db');
  console.log('  - Copy this single ZIP to your Server PC, extract it, and run');
  console.log('    Setup-Server.bat as Administrator!');
  console.log('=====================================================================\n');
}

main();


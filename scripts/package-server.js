const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageDir = path.join(distDir, 'FRM-BBP');
const zipPath = path.join(distDir, 'FRM-BBP.zip');

const RUNTIME_DEPENDENCIES = [
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

const EXTERNAL_SET = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
  ...RUNTIME_DEPENDENCIES,
  'sql.js'
]);

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
}

function isExternalModule(id) {
  if (!id || id.startsWith('.') || path.isAbsolute(id)) return false;
  const parts = id.split('/');
  const pkgName = id.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  return EXTERNAL_SET.has(id) || EXTERNAL_SET.has(pkgName);
}

async function bundleNodeEntry(entryFile, outFile) {
  const { rolldown } = await import('rolldown');
  const bundle = await rolldown({
    input: entryFile,
    platform: 'node',
    external: isExternalModule
  });
  try {
    await bundle.write({
      file: outFile,
      format: 'cjs',
      minify: true
    });
  } finally {
    await bundle.close();
  }
}

async function main() {
  console.log('=====================================================================');
  console.log('   BUILDING FRM-BBP SERVER DEPLOYMENT PACKAGE (COMPILED - NO SOURCE) ');
  console.log('=====================================================================\n');

  // 1. Build minified frontend production bundle
  console.log('[1/5] Compiling & minifying frontend web assets...');
  execSync('npm run build:frontend', { cwd: rootDir, stdio: 'inherit', shell: true });

  // 2. Clean staging directory
  console.log('\n[2/5] Preparing clean package directory...');
  if (fs.existsSync(packageDir)) {
    fs.rmSync(packageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(packageDir, { recursive: true });

  // 3. Copy compiled frontend -> public/ (zero frontend/src files)
  console.log('[3/5] Copying compiled frontend into public/...');
  copyIfExists(path.join(rootDir, 'frontend', 'dist'), path.join(packageDir, 'public'));

  // 4. Bundle & minify backend into compiled server.js & database/backup.js (zero source folders)
  console.log('[4/5] Compiling & minifying backend into single-file bundles...');
  const backendDest = path.join(packageDir, 'backend');
  const dbDest = path.join(backendDest, 'database');
  fs.mkdirSync(dbDest, { recursive: true });

  await bundleNodeEntry(
    path.join(rootDir, 'backend', 'server.js'),
    path.join(backendDest, 'server.js')
  );
  await bundleNodeEntry(
    path.join(rootDir, 'backend', 'database', 'backup.js'),
    path.join(dbDest, 'backup.js')
  );

  // Copy SQL initialization & migration files required by MS SQL Server runtime
  const initSqlSrc = path.join(rootDir, 'backend', 'database', 'mssql_init_FRM_DB.sql');
  if (fs.existsSync(initSqlSrc)) {
    fs.copyFileSync(initSqlSrc, path.join(dbDest, 'mssql_init_FRM_DB.sql'));
  }
  copyIfExists(path.join(rootDir, 'backend', 'database', 'migrations'), path.join(dbDest, 'migrations'));

  const scriptsDest = path.join(packageDir, 'scripts');
  fs.mkdirSync(scriptsDest, { recursive: true });
  for (const scriptFile of ['setup-server.js', 'generate-cert.js', 'create-desktop-shortcut.js', 'enable-autostart.js', 'configure-sqlserver.ps1']) {
    const srcPath = path.join(rootDir, 'scripts', scriptFile);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(scriptsDest, scriptFile));
    }
  }

  const rootFiles = [
    'Setup-Server.bat',
    'Start-FRM.bat',
    'RUN_SERVER.bat',
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

  // Generate lean production package.json from workspace versions
  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const backendPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'backend', 'package.json'), 'utf8'));
  const mergedDeps = {
    ...(rootPkg.dependencies || {}),
    ...(backendPkg.dependencies || {}),
    ...(backendPkg.devDependencies || {})
  };

  const runtimeDeps = {};
  for (const dep of RUNTIME_DEPENDENCIES) {
    if (mergedDeps[dep]) {
      runtimeDeps[dep] = mergedDeps[dep];
    }
  }

  const serverPkg = {
    name: 'frm-bbp-server',
    version: rootPkg.version || '1.0.0',
    description: 'FRM-BBP - Factory Resource Manager (Compiled Server Package)',
    main: 'backend/server.js',
    scripts: {
      start: 'node backend/server.js',
      cert: 'node scripts/generate-cert.js'
    },
    dependencies: runtimeDeps
  };
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify(serverPkg, null, 2) + '\n', 'utf8');

  // Record clean build version metadata (no Git history required)
  const buildDate = new Date().toISOString().slice(0, 10);
  const versionMeta = {
    version: rootPkg.version || '1.0.0',
    buildDate,
    builtAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(packageDir, 'version.json'), JSON.stringify(versionMeta, null, 2) + '\n', 'utf8');

  // 5. Compress into dist/FRM-BBP.zip
  console.log('[5/5] Creating ZIP archive dist/FRM-BBP.zip...');
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${packageDir}\\*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`zip -r -q "${zipPath}" .`, { cwd: packageDir, stdio: 'inherit' });
  }

  const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  console.log('\n=====================================================================');
  console.log(`✓ Compiled Package Ready: ${zipPath} (${sizeMb} MB)`);
  console.log(`  - Version : v${versionMeta.version} (${versionMeta.buildDate})`);
  console.log('  - Excluded: .git/, frontend/src/, backend controllers/routes source, node_modules/');
  console.log('=====================================================================\n');
}

main().catch((err) => {
  console.error('[Package Error]:', err);
  process.exit(1);
});

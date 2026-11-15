const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { sql, connectDB, config } = require('../config/db');
const { runMssqlMigrations, runSQLiteMigrations } = require('../database/migrator');
const { resolveAppRoots } = require('../utils/appPaths');

const { backendRoot: BACKEND_ROOT, projectRoot: PROJECT_ROOT } = resolveAppRoots(__dirname);
const BACKUP_DIR = path.join(BACKEND_ROOT, 'database', 'backups');
const VERSION_FILE_NAME = 'version.json';

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function execAsync(cmd, cwd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: cwd || PROJECT_ROOT }, (err, stdout, stderr) => {
      if (err) {
        return resolve({ success: false, error: err.message, stderr, stdout });
      }
      resolve({ success: true, stdout, stderr });
    });
  });
}

function readJsonSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.warn(`Could not parse JSON at ${filePath}:`, err.message);
  }
  return null;
}

function getVersionInfo() {
  const pkgJson = readJsonSafe(path.join(PROJECT_ROOT, 'package.json')) || {};
  const versionJson = readJsonSafe(path.join(PROJECT_ROOT, VERSION_FILE_NAME)) || {};

  const rawVersion = versionJson.version || pkgJson.version || '20261115';
  const match = String(rawVersion).match(/^(\d{8})/);
  const appVersion = match ? match[1] : rawVersion;
  const buildDate = versionJson.buildDate || (versionJson.builtAt ? versionJson.builtAt.slice(0, 10) : 'Production Build');

  return {
    appVersion,
    rawVersion,
    buildDate,
    builtAt: versionJson.builtAt || null,
    isBundledServer: !fs.existsSync(path.join(BACKEND_ROOT, 'controllers'))
  };
}

function copyServerPackageContents(stagedDir) {
  // 1. Replace compiled frontend public/ cleanly so old hashed assets don't accumulate
  const stagedPublic = path.join(stagedDir, 'public');
  const targetPublic = path.join(PROJECT_ROOT, 'public');
  if (fs.existsSync(stagedPublic)) {
    if (fs.existsSync(targetPublic)) {
      fs.rmSync(targetPublic, { recursive: true, force: true });
    }
    fs.cpSync(stagedPublic, targetPublic, { recursive: true });
  }

  // 2. Copy compiled backend/ safely while preserving certs/, database/backups/, and node_modules/
  const stagedBackend = path.join(stagedDir, 'backend');
  if (fs.existsSync(stagedBackend)) {
    const serverEntry = path.join(stagedBackend, 'server.js');
    if (fs.existsSync(serverEntry)) {
      fs.copyFileSync(serverEntry, path.join(BACKEND_ROOT, 'server.js'));
    }

    // If package uses single compiled backend bundle (no plain controllers/), clean legacy source folders
    const hasPlainControllers = fs.existsSync(path.join(stagedBackend, 'controllers'));
    if (!hasPlainControllers && !fs.existsSync(path.join(PROJECT_ROOT, '.git'))) {
      for (const legacyDir of ['config', 'controllers', 'routes', 'middlewares', 'services', 'utils']) {
        const legacyPath = path.join(BACKEND_ROOT, legacyDir);
        if (fs.existsSync(legacyPath)) {
          fs.rmSync(legacyPath, { recursive: true, force: true });
        }
      }
      const legacyMigrator = path.join(BACKEND_ROOT, 'database', 'migrator.js');
      if (fs.existsSync(legacyMigrator)) fs.unlinkSync(legacyMigrator);
    } else {
      for (const dir of ['config', 'controllers', 'routes', 'middlewares', 'services', 'utils']) {
        const srcDir = path.join(stagedBackend, dir);
        if (fs.existsSync(srcDir)) {
          fs.cpSync(srcDir, path.join(BACKEND_ROOT, dir), { recursive: true });
        }
      }
    }

    const stagedDb = path.join(stagedBackend, 'database');
    const targetDb = path.join(BACKEND_ROOT, 'database');
    if (fs.existsSync(stagedDb)) {
      fs.mkdirSync(targetDb, { recursive: true });
      for (const dbFile of ['backup.js', 'migrator.js', 'db.js', 'mssql_init_FRM_DB.sql']) {
        const srcFile = path.join(stagedDb, dbFile);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, path.join(targetDb, dbFile));
        }
      }
      const stagedMigrations = path.join(stagedDb, 'migrations');
      if (fs.existsSync(stagedMigrations)) {
        fs.cpSync(stagedMigrations, path.join(targetDb, 'migrations'), { recursive: true });
      }
    }
  }

  // 3. Copy scripts/ and root launchers (never touching .env!)
  const stagedScripts = path.join(stagedDir, 'scripts');
  if (fs.existsSync(stagedScripts)) {
    fs.cpSync(stagedScripts, path.join(PROJECT_ROOT, 'scripts'), { recursive: true });
  }

  const rootCopyFiles = [
    'Setup-Server.bat',
    'Start-FRM.bat',
    'RUN_SERVER.bat',
    'Create-Desktop-Icon.bat',
    'Enable-AutoStart-On-Boot.bat',
    'backup-database.bat',
    'SERVER_SETUP.md',
    '.env.example',
    'package.json',
    VERSION_FILE_NAME
  ];
  for (const file of rootCopyFiles) {
    const srcFile = path.join(stagedDir, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(PROJECT_ROOT, file));
    }
  }
}

// GET /api/system/status
exports.getSystemStatus = async (req, res) => {
  try {
    ensureBackupDir();
    const isMSSQL = config.type === 'mssql';

    let migrationsCount = 0;
    let latestMigration = 'None';

    try {
      const pool = await connectDB();
      const migRes = await pool.request().query('SELECT name, executed_at FROM _Migrations ORDER BY id DESC');
      if (migRes.recordset && migRes.recordset.length > 0) {
        migrationsCount = migRes.recordset.length;
        latestMigration = migRes.recordset[0].name;
      }
    } catch (e) {
      console.warn('Could not query _Migrations:', e.message);
    }

    const versionInfo = getVersionInfo();

    const backupFiles = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.bak') || f.endsWith('.db'));
    let latestBackupTime = null;
    if (backupFiles.length > 0) {
      const stats = backupFiles.map((f) => fs.statSync(path.join(BACKUP_DIR, f)));
      stats.sort((a, b) => b.mtime - a.mtime);
      latestBackupTime = stats[0].mtime;
    }

    res.status(200).json({
      dbType: isMSSQL ? 'Microsoft SQL Server 2022' : 'SQLite Local',
      dbName: config.database || 'FRM_DB',
      dbServer: config.server || 'localhost:1433',
      ...versionInfo,
      migrationsCount,
      latestMigration,
      backupCount: backupFiles.length,
      latestBackupTime
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({ message: 'Error fetching system status' });
  }
};

// GET /api/system/backups
exports.getBackups = async (req, res) => {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.bak') || f.endsWith('.db'))
      .map((filename) => {
        const filePath = path.join(BACKUP_DIR, filename);
        const stat = fs.statSync(filePath);
        return {
          filename,
          size: formatBytes(stat.size),
          sizeBytes: stat.size,
          createdAt: stat.mtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json(files);
  } catch (error) {
    console.error('Error fetching backups:', error);
    res.status(500).json({ message: 'Error fetching backups' });
  }
};

// POST /api/system/backup
exports.createBackup = async (req, res) => {
  try {
    ensureBackupDir();
    const isMSSQL = config.type === 'mssql';
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');

    if (isMSSQL) {
      const fileName = `FRM_DB_backup_${dateStr}_${timeStr}.bak`;
      const backupPath = path.join(BACKUP_DIR, fileName);

      const pool = await connectDB();
      await pool.request().query(`
        BACKUP DATABASE [FRM_DB] 
        TO DISK = '${backupPath.replace(/'/g, "''")}' 
        WITH FORMAT, MEDIANAME = 'FRM_Backup', NAME = 'Full Backup of FRM_DB';
      `);

      const stat = fs.statSync(backupPath);
      res.status(201).json({
        message: 'Database backup created successfully',
        filename: fileName,
        size: formatBytes(stat.size),
        createdAt: stat.mtime
      });
    } else {
      const primarySqlite = path.join(BACKEND_ROOT, 'database', 'FRM-BBP.db');
      const legacySqlite = path.join(BACKEND_ROOT, 'database', 'factoryflow.db');
      const sqlitePath = fs.existsSync(primarySqlite) ? primarySqlite : (fs.existsSync(legacySqlite) ? legacySqlite : primarySqlite);
      const fileName = `frm_bbp_backup_${dateStr}_${timeStr}.db`;
      const backupPath = path.join(BACKUP_DIR, fileName);

      if (fs.existsSync(sqlitePath)) {
        fs.copyFileSync(sqlitePath, backupPath);
        const stat = fs.statSync(backupPath);
        res.status(201).json({
          message: 'SQLite database backup created successfully',
          filename: fileName,
          size: formatBytes(stat.size),
          createdAt: stat.mtime
        });
      } else {
        res.status(404).json({ message: 'SQLite database file not found' });
      }
    }
  } catch (error) {
    console.error('Error creating database backup:', error);
    res.status(500).json({ message: 'Error creating database backup: ' + error.message });
  }
};

// GET /api/system/backups/download/:filename
exports.downloadBackup = async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Backup file not found' });
    }

    res.download(filePath, filename);
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({ message: 'Error downloading backup' });
  }
};

// DELETE /api/system/backups/:filename
exports.deleteBackup = async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Backup file not found' });
    }

    fs.unlinkSync(filePath);
    res.status(200).json({ message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ message: 'Error deleting backup' });
  }
};

// POST /api/system/upload-update
exports.uploadAndApplyUpdate = async (req, res) => {
  const uploadedFile = req.file;
  const logs = [];

  if (!uploadedFile || !uploadedFile.path) {
    return res.status(400).json({ message: 'Please upload a valid FRM Server Package (.zip) file.' });
  }

  const stageDir = path.join(os.tmpdir(), `frm-update-stage-${Date.now()}`);

  try {
    logs.push(`[1/4] Received update package: ${uploadedFile.originalname} (${formatBytes(uploadedFile.size)})`);

    logs.push('[2/4] Extracting and verifying package files...');
    fs.mkdirSync(stageDir, { recursive: true });
    if (process.platform === 'win32') {
      const escapedZip = uploadedFile.path.replace(/'/g, "''");
      const escapedStage = stageDir.replace(/'/g, "''");
      const unzipRes = await execAsync(
        `powershell -NoProfile -Command "Expand-Archive -Path '${escapedZip}' -DestinationPath '${escapedStage}' -Force"`,
        PROJECT_ROOT
      );
      if (!unzipRes.success) {
        throw new Error('Failed to extract ZIP package: ' + (unzipRes.stderr || unzipRes.error));
      }
    } else {
      const unzipRes = await execAsync(`unzip -oq "${uploadedFile.path}" -d "${stageDir}"`, PROJECT_ROOT);
      if (!unzipRes.success) {
        throw new Error('Failed to extract ZIP package: ' + (unzipRes.stderr || unzipRes.error));
      }
    }

    if (!fs.existsSync(path.join(stageDir, 'public', 'index.html')) || !fs.existsSync(path.join(stageDir, 'backend', 'server.js'))) {
      throw new Error('Invalid update archive: expected public/index.html and backend/server.js inside ZIP.');
    }

    const currentPkg = readJsonSafe(path.join(PROJECT_ROOT, 'package.json')) || {};
    const nextPkg = readJsonSafe(path.join(stageDir, 'package.json')) || {};
    const depsChanged = JSON.stringify(currentPkg.dependencies || {}) !== JSON.stringify(nextPkg.dependencies || {});

    logs.push('[3/4] Installing compiled frontend & backend files (keeping .env, certs & backups safe)...');
    copyServerPackageContents(stageDir);

    if (depsChanged) {
      logs.push('      Package dependencies updated; installing runtime packages...');
      const npmRes = await execAsync('npm install --omit=dev', PROJECT_ROOT);
      if (!npmRes.success) {
        logs.push('      Notice: npm install returned a warning; verify internet if new dependencies are required.');
      }
    }

    logs.push('[4/4] Checking and applying pending database migrations...');
    const pool = await connectDB();
    if (config.type === 'mssql') {
      await runMssqlMigrations(pool, sql);
    } else {
      await runSQLiteMigrations(pool);
    }

    const updatedVersion = getVersionInfo();
    logs.push(`✓ Updated to v${updatedVersion.appVersion} (${updatedVersion.buildDate}).`);
    logs.push('↻ Restarting FRM server process to activate updated modules...');

    res.status(200).json({
      success: true,
      restartRequired: true,
      version: updatedVersion,
      message: 'Update installed cleanly! Restarting server...',
      logs: logs.join('\n')
    });

    setTimeout(() => {
      process.exit(42);
    }, 800);
  } catch (error) {
    console.error('Error applying uploaded update:', error);
    logs.push('✗ Error: ' + error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      logs: logs.join('\n')
    });
  } finally {
    try {
      if (fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
      if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup warnings
    }
  }
};

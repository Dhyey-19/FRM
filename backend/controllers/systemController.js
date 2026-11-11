const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const dotenv = require('dotenv');
const { sql, connectDB, config } = require('../config/db');
const { runMssqlMigrations, runSQLiteMigrations } = require('../database/migrator');

const BACKUP_DIR = path.resolve(__dirname, '../database/backups');
const DEFAULT_GITHUB_REPO = 'Dhyey-19/FRM';
const RELEASE_TAG = 'server-latest';
const PACKAGE_ZIP_NAME = 'FRM-Server-Package.zip';
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
    exec(cmd, { cwd: cwd || path.resolve(__dirname, '../../') }, (err, stdout, stderr) => {
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

function getProjectRoot() {
  return path.resolve(__dirname, '../../');
}

function getGithubUpdateConfig() {
  const envPath = path.join(getProjectRoot(), '.env');
  let diskEnv = {};
  if (fs.existsSync(envPath)) {
    try {
      diskEnv = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
    } catch {
      diskEnv = {};
    }
  }

  return {
    githubRepo: (diskEnv.GITHUB_REPO || process.env.GITHUB_REPO || DEFAULT_GITHUB_REPO).trim(),
    githubToken: (diskEnv.GITHUB_TOKEN || process.env.GITHUB_TOKEN || '').trim()
  };
}

function upsertEnvKeys(updates) {
  const envPath = path.join(getProjectRoot(), '.env');
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const lines = content ? content.split(/\r?\n/) : [];

  for (const [key, rawVal] of Object.entries(updates)) {
    const strVal = String(rawVal ?? '').trim();
    const formattedVal = /[\s#"\\]/.test(strVal)
      ? `"${strVal.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      : strVal;

    const lineText = `${key}=${formattedVal}`;
    const idx = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    if (idx !== -1) {
      lines[idx] = lineText;
    } else {
      lines.push(lineText);
    }
    process.env[key] = strVal;
  }

  fs.writeFileSync(envPath, lines.filter((l, i, arr) => i < arr.length - 1 || l !== '').join('\n') + '\n', 'utf8');
}

async function getVersionInfo() {
  const projectRoot = getProjectRoot();
  const isGitRepo = fs.existsSync(path.join(projectRoot, '.git'));
  const pkgJson = readJsonSafe(path.join(projectRoot, 'package.json')) || {};
  const versionJson = readJsonSafe(path.join(projectRoot, VERSION_FILE_NAME)) || {};

  let currentCommit = versionJson.commit || '';
  let commitDate = versionJson.commitDate || '';
  let commitMessage = versionJson.commitMessage || '';
  const appVersion = versionJson.version || pkgJson.version || '1.0.0';

  if (isGitRepo) {
    const gitCommitRes = await execAsync('git rev-parse --short HEAD', projectRoot);
    if (gitCommitRes.success && gitCommitRes.stdout.trim()) {
      currentCommit = gitCommitRes.stdout.trim();
    }
    const gitDateRes = await execAsync('git log -1 --format=%cd --date=short', projectRoot);
    if (gitDateRes.success && gitDateRes.stdout.trim()) {
      commitDate = gitDateRes.stdout.trim();
    }
    const gitMsgRes = await execAsync('git log -1 --format=%s', projectRoot);
    if (gitMsgRes.success && gitMsgRes.stdout.trim()) {
      commitMessage = gitMsgRes.stdout.trim();
    }
  }

  return {
    isGitRepo,
    deployMode: isGitRepo ? 'git' : 'package',
    appVersion,
    currentCommit: currentCommit || `v${appVersion}`,
    commitDate: commitDate || 'Production Build',
    commitMessage,
    builtAt: versionJson.builtAt || null
  };
}

/**
 * Fetches GitHub Release asset with redirect handling so cross-origin S3 URLs never receive GitHub Bearer headers.
 */
async function fetchGithubAssetResponse(assetUrl, githubToken, accept = 'application/octet-stream') {
  const headers = {
    Accept: accept,
    'User-Agent': 'FRM-Server-Updater'
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const firstRes = await fetch(assetUrl, { headers, redirect: 'manual' });
  if (firstRes.status >= 300 && firstRes.status < 400) {
    const redirectUrl = firstRes.headers.get('location');
    if (redirectUrl) {
      return fetch(redirectUrl, { headers: { 'User-Agent': 'FRM-Server-Updater' } });
    }
  }
  return firstRes;
}

async function fetchGithubServerRelease(githubRepo, githubToken) {
  const releaseApiUrl = `https://api.github.com/repos/${githubRepo}/releases/tags/${RELEASE_TAG}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FRM-Server-Updater'
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const res = await fetch(releaseApiUrl, { headers });
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      needsToken: !githubToken,
      tokenInvalid: Boolean(githubToken),
      message: githubToken
        ? 'GitHub token was rejected (401/403). Ensure it has Contents: Read permission on the repository.'
        : 'GitHub repository is private. Add a Read-Only GitHub Token below to check and install updates automatically.'
    };
  }

  if (res.status === 404) {
    return {
      ok: false,
      needsToken: !githubToken,
      releaseMissing: Boolean(githubToken),
      message: !githubToken
        ? 'GitHub repository is private or release is not reachable without authentication. Add a Read-Only GitHub Token below.'
        : `Release "${RELEASE_TAG}" not found yet in ${githubRepo}. Push to main to trigger the server package release build.`
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      message: `GitHub API returned HTTP ${res.status}.`
    };
  }

  const release = await res.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const zipAsset = assets.find((a) => a.name === PACKAGE_ZIP_NAME);
  const versionAsset = assets.find((a) => a.name === VERSION_FILE_NAME);

  let remoteVersion = null;
  if (versionAsset && versionAsset.url) {
    try {
      const verRes = await fetchGithubAssetResponse(versionAsset.url, githubToken, 'application/octet-stream');
      if (verRes.ok) {
        remoteVersion = await verRes.json();
      }
    } catch (err) {
      console.warn('[Updater] Notice reading remote version.json:', err.message);
    }
  }

  return {
    ok: true,
    release,
    zipAsset,
    versionAsset,
    remoteVersion
  };
}

async function getPendingMigrationsList() {
  const migrationsDir = path.resolve(__dirname, '../database/migrations');
  if (!fs.existsSync(migrationsDir)) return [];

  const allFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const pool = await connectDB();
  const migRes = await pool.request().query('SELECT name FROM _Migrations');
  const executed = new Set((migRes.recordset || []).map((r) => r.name));
  return allFiles.filter((f) => !executed.has(f));
}

function copyServerPackageContents(stagedDir, projectRoot) {
  // 1. Replace public/ cleanly so stale hashed Vite bundles don't accumulate
  const stagedPublic = path.join(stagedDir, 'public');
  const targetPublic = path.join(projectRoot, 'public');
  if (fs.existsSync(stagedPublic)) {
    if (fs.existsSync(targetPublic)) {
      fs.rmSync(targetPublic, { recursive: true, force: true });
    }
    fs.cpSync(stagedPublic, targetPublic, { recursive: true });
  }

  // 2. Copy backend/ safely while preserving live certs/, backups/, and node_modules/
  const stagedBackend = path.join(stagedDir, 'backend');
  const targetBackend = path.join(projectRoot, 'backend');
  if (fs.existsSync(stagedBackend)) {
    const serverEntry = path.join(stagedBackend, 'server.js');
    if (fs.existsSync(serverEntry)) {
      fs.copyFileSync(serverEntry, path.join(targetBackend, 'server.js'));
    }

    for (const dir of ['config', 'controllers', 'routes', 'middlewares', 'services']) {
      const srcDir = path.join(stagedBackend, dir);
      if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, path.join(targetBackend, dir), { recursive: true });
      }
    }

    const stagedDb = path.join(stagedBackend, 'database');
    const targetDb = path.join(targetBackend, 'database');
    if (fs.existsSync(stagedDb)) {
      fs.mkdirSync(targetDb, { recursive: true });
      for (const dbFile of ['migrator.js', 'backup.js', 'db.js', 'mssql_init_FRM_DB.sql']) {
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

  // 3. Copy scripts/ and root launchers (excluding .env!)
  const stagedScripts = path.join(stagedDir, 'scripts');
  if (fs.existsSync(stagedScripts)) {
    fs.cpSync(stagedScripts, path.join(projectRoot, 'scripts'), { recursive: true });
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
      fs.copyFileSync(srcFile, path.join(projectRoot, file));
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

    const versionInfo = await getVersionInfo();
    const { githubRepo, githubToken } = getGithubUpdateConfig();

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
      githubRepo,
      hasGithubToken: Boolean(githubToken),
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

// POST /api/system/update-config
exports.saveUpdateConfig = async (req, res) => {
  const { githubRepo, githubToken } = req.body || {};
  const cleanRepo = String(githubRepo || DEFAULT_GITHUB_REPO).trim();

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleanRepo)) {
    return res.status(400).json({ message: 'Repository must be in "owner/repo" format (e.g. Dhyey-19/FRM).' });
  }

  try {
    const updates = { GITHUB_REPO: cleanRepo };
    if (typeof githubToken === 'string' && githubToken.trim()) {
      updates.GITHUB_TOKEN = githubToken.trim();
    }
    upsertEnvKeys(updates);
    const updatedCfg = getGithubUpdateConfig();
    res.status(200).json({
      success: true,
      message: 'Update source settings saved to server .env.',
      githubRepo: updatedCfg.githubRepo,
      hasGithubToken: Boolean(updatedCfg.githubToken)
    });
  } catch (error) {
    console.error('Error saving update config:', error);
    res.status(500).json({ message: 'Failed to save update settings: ' + error.message });
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
      const sqlitePath = path.resolve(__dirname, '../database/factoryflow.db');
      const fileName = `factoryflow_backup_${dateStr}_${timeStr}.db`;
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

// GET /api/system/check-updates
exports.checkUpdates = async (req, res) => {
  try {
    const projectRoot = getProjectRoot();
    const versionInfo = await getVersionInfo();
    const pendingMigrations = await getPendingMigrationsList();

    if (versionInfo.isGitRepo) {
      await execAsync('git fetch origin main', projectRoot);

      const countRes = await execAsync('git rev-list HEAD..origin/main --count', projectRoot);
      const commitsBehind = countRes.success ? parseInt(countRes.stdout.trim(), 10) || 0 : 0;

      let latestCommitMessage = '';
      let remoteCommit = '';
      if (commitsBehind > 0) {
        const logRes = await execAsync('git log -1 origin/main --format=%s', projectRoot);
        if (logRes.success) latestCommitMessage = logRes.stdout.trim();
        const shaRes = await execAsync('git rev-parse --short origin/main', projectRoot);
        if (shaRes.success) remoteCommit = shaRes.stdout.trim();
      }

      return res.status(200).json({
        deployMode: 'git',
        hasUpdate: commitsBehind > 0 || pendingMigrations.length > 0,
        commitsBehind,
        remoteCommit,
        latestCommitMessage,
        currentCommit: versionInfo.currentCommit,
        appVersion: versionInfo.appVersion,
        pendingMigrations,
        checkedAt: new Date().toISOString()
      });
    }

    // Server Package mode (no .git on server PC): check GitHub Release over HTTPS
    const { githubRepo, githubToken } = getGithubUpdateConfig();
    const releaseCheck = await fetchGithubServerRelease(githubRepo, githubToken);

    if (!releaseCheck.ok) {
      return res.status(200).json({
        deployMode: 'package',
        hasUpdate: pendingMigrations.length > 0,
        needsToken: Boolean(releaseCheck.needsToken),
        tokenInvalid: Boolean(releaseCheck.tokenInvalid),
        releaseMissing: Boolean(releaseCheck.releaseMissing),
        configNotice: releaseCheck.message,
        githubRepo,
        hasGithubToken: Boolean(githubToken),
        currentCommit: versionInfo.currentCommit,
        appVersion: versionInfo.appVersion,
        pendingMigrations,
        checkedAt: new Date().toISOString()
      });
    }

    const remoteVersion = releaseCheck.remoteVersion || {};
    const remoteCommit = remoteVersion.commit || '';
    const hasPackageUpdate = Boolean(
      releaseCheck.zipAsset &&
      (
        !versionInfo.builtAt ||
        (remoteCommit && remoteCommit !== versionInfo.currentCommit) ||
        (remoteVersion.builtAt && remoteVersion.builtAt !== versionInfo.builtAt)
      )
    );

    return res.status(200).json({
      deployMode: 'package',
      hasUpdate: hasPackageUpdate || pendingMigrations.length > 0,
      hasPackageUpdate,
      githubRepo,
      hasGithubToken: Boolean(githubToken),
      currentCommit: versionInfo.currentCommit,
      appVersion: versionInfo.appVersion,
      remoteCommit: remoteCommit || 'Latest Release',
      remoteVersion: remoteVersion.version || versionInfo.appVersion,
      latestCommitMessage: remoteVersion.commitMessage || releaseCheck.release?.name || 'New server build available',
      pendingMigrations,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking updates:', error);
    res.status(500).json({ message: 'Error checking updates: ' + error.message });
  }
};

// POST /api/system/apply-update
exports.applyUpdate = async (req, res) => {
  const projectRoot = getProjectRoot();
  const logs = [];

  try {
    const versionInfo = await getVersionInfo();

    if (versionInfo.isGitRepo) {
      logs.push('[1/3] Pulling latest updates from GitHub...');
      const pullRes = await execAsync('git pull origin main', projectRoot);
      if (!pullRes.success) {
        throw new Error('Git pull failed: ' + (pullRes.stderr || pullRes.error));
      }
      logs.push(pullRes.stdout.trim() || 'Git pull completed.');

      logs.push('[2/3] Checking and applying database migrations...');
      const pool = await connectDB();
      if (config.type === 'mssql') {
        await runMssqlMigrations(pool, sql);
      } else {
        await runSQLiteMigrations(pool);
      }
      logs.push('✓ Database migrations checked and up to date.');

      logs.push('[3/3] Rebuilding frontend application...');
      const buildRes = await execAsync('npm --prefix frontend run build', projectRoot);
      if (buildRes.success) {
        logs.push('✓ Frontend build completed successfully.');
      } else {
        logs.push('Notice: Frontend build warning (check logs).');
      }

      return res.status(200).json({
        success: true,
        restartRequired: false,
        message: 'Application and database successfully updated!',
        logs: logs.join('\n')
      });
    }

    // Server Package mode: download latest release zip over HTTPS, update files, run migrations, restart cleanly
    const { githubRepo, githubToken } = getGithubUpdateConfig();
    logs.push(`[1/5] Fetching latest server release from GitHub (${githubRepo})...`);

    const releaseCheck = await fetchGithubServerRelease(githubRepo, githubToken);
    if (!releaseCheck.ok) {
      throw new Error(releaseCheck.message || 'Could not fetch server release from GitHub.');
    }
    if (!releaseCheck.zipAsset || !releaseCheck.zipAsset.url) {
      throw new Error(`Release "${RELEASE_TAG}" does not contain ${PACKAGE_ZIP_NAME}.`);
    }

    const tempStamp = Date.now();
    const tempZipPath = path.join(os.tmpdir(), `frm-update-${tempStamp}.zip`);
    const stageDir = path.join(os.tmpdir(), `frm-stage-${tempStamp}`);

    try {
      logs.push(`[2/5] Downloading ${PACKAGE_ZIP_NAME} (${(releaseCheck.zipAsset.size / (1024 * 1024)).toFixed(2)} MB)...`);
      const zipRes = await fetchGithubAssetResponse(releaseCheck.zipAsset.url, githubToken, 'application/octet-stream');
      if (!zipRes.ok) {
        throw new Error(`Failed to download update package (HTTP ${zipRes.status}).`);
      }
      const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
      fs.writeFileSync(tempZipPath, zipBuffer);

      logs.push('[3/5] Extracting and verifying server package...');
      fs.mkdirSync(stageDir, { recursive: true });
      if (process.platform === 'win32') {
        const escapedZip = tempZipPath.replace(/'/g, "''");
        const escapedStage = stageDir.replace(/'/g, "''");
        const unzipRes = await execAsync(
          `powershell -NoProfile -Command "Expand-Archive -Path '${escapedZip}' -DestinationPath '${escapedStage}' -Force"`,
          projectRoot
        );
        if (!unzipRes.success) {
          throw new Error('Failed to extract update zip: ' + (unzipRes.stderr || unzipRes.error));
        }
      } else {
        const unzipRes = await execAsync(`unzip -oq "${tempZipPath}" -d "${stageDir}"`, projectRoot);
        if (!unzipRes.success) {
          throw new Error('Failed to extract update zip: ' + (unzipRes.stderr || unzipRes.error));
        }
      }

      if (!fs.existsSync(path.join(stageDir, 'public', 'index.html')) || !fs.existsSync(path.join(stageDir, 'backend', 'server.js'))) {
        throw new Error('Downloaded archive is missing expected public/ or backend/ files.');
      }

      const currentPkg = readJsonSafe(path.join(projectRoot, 'package.json')) || {};
      const nextPkg = readJsonSafe(path.join(stageDir, 'package.json')) || {};
      const depsChanged = JSON.stringify(currentPkg.dependencies || {}) !== JSON.stringify(nextPkg.dependencies || {});

      logs.push('[4/5] Applying application & backend updates (keeping .env, certs & backups safe)...');
      copyServerPackageContents(stageDir, projectRoot);

      if (depsChanged) {
        logs.push('      Package dependencies changed; running npm install --omit=dev...');
        const npmRes = await execAsync('npm install --omit=dev', projectRoot);
        if (!npmRes.success) {
          logs.push('      Warning: npm install reported an error; check server console if modules are missing.');
        }
      }

      logs.push('[5/5] Applying any pending SQL Server database migrations...');
      const pool = await connectDB();
      if (config.type === 'mssql') {
        await runMssqlMigrations(pool, sql);
      } else {
        await runSQLiteMigrations(pool);
      }
      logs.push('✓ Database migrations and files updated successfully!');
      logs.push('↻ Restarting FRM server process to activate new backend code...');

      res.status(200).json({
        success: true,
        restartRequired: true,
        message: 'Server updated successfully! Restarting server...',
        logs: logs.join('\n')
      });

      // Exit with code 42 so Start-FRM.bat / RUN_SERVER.bat automatically restarts Node cleanly
      setTimeout(() => {
        process.exit(42);
      }, 800);
    } finally {
      try {
        if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
        if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
      } catch {
        // Ignore temp cleanup warnings
      }
    }
  } catch (error) {
    console.error('Error applying update:', error);
    logs.push('✗ Error: ' + error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      logs: logs.join('\n')
    });
  }
};

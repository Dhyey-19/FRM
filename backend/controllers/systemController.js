const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { sql, connectDB, config } = require('../config/db');
const { runMssqlMigrations, runSQLiteMigrations } = require('../database/migrator');

const BACKUP_DIR = path.resolve(__dirname, '../database/backups');

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
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: cwd || path.resolve(__dirname, '../../') }, (err, stdout, stderr) => {
      if (err) {
        return resolve({ success: false, error: err.message, stderr, stdout });
      }
      resolve({ success: true, stdout, stderr });
    });
  });
}

// GET /api/system/status
exports.getSystemStatus = async (req, res) => {
  try {
    ensureBackupDir();
    const isMSSQL = config.type === 'mssql';

    // 1. Get database details
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

    // 2. Get current Git commit
    const gitCommitRes = await execAsync('git rev-parse --short HEAD');
    const currentCommit = gitCommitRes.success ? gitCommitRes.stdout.trim() : 'Unknown';

    const gitDateRes = await execAsync('git log -1 --format=%cd --date=short');
    const commitDate = gitDateRes.success ? gitDateRes.stdout.trim() : 'Unknown';

    // 3. Count backups
    const backupFiles = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.bak') || f.endsWith('.db'));
    let latestBackupTime = null;
    if (backupFiles.length > 0) {
      const stats = backupFiles.map(f => fs.statSync(path.join(BACKUP_DIR, f)));
      stats.sort((a, b) => b.mtime - a.mtime);
      latestBackupTime = stats[0].mtime;
    }

    res.status(200).json({
      dbType: isMSSQL ? 'Microsoft SQL Server 2022' : 'SQLite Local',
      dbName: config.database || 'FRM_DB',
      dbServer: config.server || 'localhost:1433',
      currentCommit,
      commitDate,
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
      .filter(f => f.endsWith('.bak') || f.endsWith('.db'))
      .map(filename => {
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
      // SQLite fallback copy
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
    const projectRoot = path.resolve(__dirname, '../../');

    // 1. Fetch remote git info silently
    await execAsync('git fetch origin main', projectRoot);

    // 2. Count commits behind
    const countRes = await execAsync('git rev-list HEAD..origin/main --count', projectRoot);
    const commitsBehind = countRes.success ? parseInt(countRes.stdout.trim(), 10) || 0 : 0;

    // 3. Get latest remote commit message if available
    let latestCommitMessage = '';
    if (commitsBehind > 0) {
      const logRes = await execAsync('git log -1 origin/main --format=%s', projectRoot);
      if (logRes.success) latestCommitMessage = logRes.stdout.trim();
    }

    // 4. Check pending database migrations
    const migrationsDir = path.resolve(__dirname, '../database/migrations');
    let pendingMigrations = [];
    if (fs.existsSync(migrationsDir)) {
      const allFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

      const pool = await connectDB();
      const migRes = await pool.request().query('SELECT name FROM _Migrations');
      const executed = new Set((migRes.recordset || []).map(r => r.name));

      pendingMigrations = allFiles.filter(f => !executed.has(f));
    }

    res.status(200).json({
      hasUpdate: commitsBehind > 0 || pendingMigrations.length > 0,
      commitsBehind,
      latestCommitMessage,
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
  const projectRoot = path.resolve(__dirname, '../../');
  const logs = [];

  try {
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

    res.status(200).json({
      success: true,
      message: 'Application and database successfully updated!',
      logs: logs.join('\n')
    });
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

const path = require('path');
const fs = require('fs');
const { connectDB } = require('../config/db');
const { resolveAppRoots } = require('../utils/appPaths');

const { backendRoot: BACKEND_ROOT } = resolveAppRoots(__dirname);

async function backup() {
  const backupDir = path.join(BACKEND_ROOT, 'database', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const fileName = `FRM_DB_backup_${dateStr}_${timeStr}.bak`;
  const backupPath = path.join(backupDir, fileName);

  console.log(`Starting backup of FRM_DB to: ${backupPath}...`);
  try {
    const pool = await connectDB();
    await pool.request().query(`
      BACKUP DATABASE [FRM_DB] 
      TO DISK = '${backupPath.replace(/'/g, "''")}' 
      WITH FORMAT, MEDIANAME = 'FRM_Backup', NAME = 'Full Backup of FRM_DB';
    `);
    console.log(`✓ Backup completed successfully! File saved: ${backupPath}`);
    process.exit(0);
  } catch (err) {
    console.error('✗ Backup failed:', err.message);
    process.exit(1);
  }
}

backup();

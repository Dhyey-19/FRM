const fs = require('fs');
const path = require('path');

/**
 * Automatically applies any pending SQL migrations to the SQLite database
 * without touching or corrupting existing live production records.
 *
 * @param {object} db - The raw sql.js Database instance
 * @param {Function} saveToDisk - Callback to write updated DB bytes to file
 */
async function runMigrations(db, saveToDisk) {
  if (!db) return;

  try {
    // 1. Ensure migrations tracking table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS "_Migrations" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT UNIQUE NOT NULL,
        "executed_at" DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Locate migrations directory
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
      return;
    }

    // 3. Find all .sql migration files in alphabetical order
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) return;

    // 4. Query already executed migrations
    const res = db.exec('SELECT "name" FROM "_Migrations"');
    const executedNames = new Set(
      res.length > 0 && res[0].values ? res[0].values.map(row => row[0]) : []
    );

    let appliedCount = 0;
    for (const file of files) {
      if (!executedNames.has(file)) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8').trim();

        if (sql) {
          console.log(`[Migrator] Applying database migration: ${file}...`);
          try {
            db.exec('BEGIN TRANSACTION;');
            db.exec(sql);
            db.exec(`INSERT INTO "_Migrations" ("name") VALUES ('${file.replace(/'/g, "''")}');`);
            db.exec('COMMIT;');
            appliedCount++;
            console.log(`[Migrator] ✓ Migration applied successfully: ${file}`);
          } catch (err) {
            db.exec('ROLLBACK;');
            console.error(`[Migrator] ✗ Failed to apply migration ${file}:`, err.message);
            throw err;
          }
        }
      }
    }

    if (appliedCount > 0 && typeof saveToDisk === 'function') {
      saveToDisk();
      console.log(`[Migrator] Applied ${appliedCount} migration(s). Database persisted to disk.`);
    }
  } catch (err) {
    console.warn('[Migrator] Notice during migration check:', err.message);
  }
}

module.exports = { runMigrations };


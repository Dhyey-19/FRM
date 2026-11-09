const fs = require('fs');
const path = require('path');

/**
 * Automatically applies any pending SQL migrations to the SQLite database
 * without touching or corrupting existing live production records.
 */
async function runSQLiteMigrations(db, saveToDisk) {
  if (!db) return;

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "_Migrations" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT UNIQUE NOT NULL,
        "executed_at" DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) return;

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) return;

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
          console.log(`[SQLite Migrator] Applying database migration: ${file}...`);
          try {
            db.exec('BEGIN TRANSACTION;');
            db.exec(sql);
            db.exec(`INSERT INTO "_Migrations" ("name") VALUES ('${file.replace(/'/g, "''")}');`);
            db.exec('COMMIT;');
            appliedCount++;
            console.log(`[SQLite Migrator] ✓ Migration applied successfully: ${file}`);
          } catch (err) {
            db.exec('ROLLBACK;');
            console.error(`[SQLite Migrator] ✗ Failed to apply migration ${file}:`, err.message);
            throw err;
          }
        }
      }
    }

    if (appliedCount > 0 && typeof saveToDisk === 'function') {
      saveToDisk();
      console.log(`[SQLite Migrator] Applied ${appliedCount} migration(s). Database persisted to disk.`);
    }
  } catch (err) {
    console.warn('[SQLite Migrator] Notice during migration check:', err.message);
  }
}

/**
 * Automatically applies any pending SQL migrations to Microsoft SQL Server
 * safely in transactions without touching existing live production records.
 */
async function runMssqlMigrations(pool, sqlLib) {
  if (!pool) return;

  try {
    // 1. Ensure migrations tracking table exists in SQL Server
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '_Migrations')
      BEGIN
        CREATE TABLE [dbo].[_Migrations] (
          [id] INT IDENTITY(1,1) PRIMARY KEY,
          [name] NVARCHAR(255) NOT NULL CONSTRAINT [UQ_Migrations_name] UNIQUE,
          [executed_at] DATETIME DEFAULT GETDATE()
        );
      END
    `);

    // 2. Locate migrations directory
    const migrationsDir = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) return;

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) return;

    // 3. Query already executed migrations
    const res = await pool.request().query('SELECT [name] FROM [dbo].[_Migrations]');
    const executedNames = new Set((res.recordset || []).map(r => r.name));

    let appliedCount = 0;
    for (const file of files) {
      if (!executedNames.has(file)) {
        const filePath = path.join(migrationsDir, file);
        const rawSql = fs.readFileSync(filePath, 'utf8').trim();

        if (rawSql) {
          console.log(`[MSSQL Migrator] Applying pending migration: ${file}...`);
          const tx = new (sqlLib ? sqlLib.Transaction : pool.transaction.bind(pool))(pool);
          await tx.begin();
          try {
            const req = new (sqlLib ? sqlLib.Request : pool.request.bind(pool))(tx);

            // Split on 'GO' if present, or execute statement batches
            const batches = rawSql
              .split(/^\s*GO\s*$/mi)
              .map(b => b.trim())
              .filter(b => b.length > 0);

            for (const batch of batches) {
              await req.query(batch);
            }

            await req
              .input('MigName', (sqlLib && sqlLib.NVarChar) ? sqlLib.NVarChar(255) : file, file)
              .query('INSERT INTO [dbo].[_Migrations] ([name]) VALUES (@MigName)');

            await tx.commit();
            appliedCount++;
            console.log(`[MSSQL Migrator] ✓ Migration applied successfully: ${file}`);
          } catch (err) {
            await tx.rollback();
            console.error(`[MSSQL Migrator] ✗ Failed to apply migration ${file}:`, err.message);
            throw err;
          }
        }
      }
    }

    if (appliedCount > 0) {
      console.log(`[MSSQL Migrator] Applied ${appliedCount} new database migration(s) to FRM_DB.`);
    }
  } catch (err) {
    console.warn('[MSSQL Migrator] Notice during migration check:', err.message);
  }
}

module.exports = {
  runMigrations: runSQLiteMigrations,
  runSQLiteMigrations,
  runMssqlMigrations
};

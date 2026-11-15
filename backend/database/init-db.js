const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

/**
 * Initializes the local SQLite database from schema.sql using sql.js.
 * Creates backend/database/FRM-BBP.db with all tables,
 * primary keys, unique constraints, and foreign key references.
 */
async function initDatabase(targetFile = 'FRM-BBP.db', force = false) {
  const dbDir = __dirname;
  const dbPath = path.join(dbDir, targetFile);
  const schemaPath = path.join(dbDir, 'schema.sql');

  if (fs.existsSync(dbPath) && !force) {
    console.log(`[InitDB] Database already exists at ${dbPath}. Skipping auto-initialization.`);
    return;
  }

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  console.log(`[InitDB] Initializing local database at: ${dbPath}`);
  
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const wasmBinary = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
  const SQL = await initSqlJs({ wasmBinary });

  const db = new SQL.Database();

  try {
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(schemaSql);
    console.log('[InitDB] Schema executed successfully.');

    // Save to disk
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));

    return db;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  const isForce = process.argv.includes('--force');
  initDatabase('FRM-BBP.db', isForce)
    .then(() => {
      console.log('[InitDB] Database check/initialization complete!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[InitDB] Initialization failed:', err);
      process.exit(1);
    });
}

module.exports = { initDatabase };

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { resolveAppRoots } = require('../utils/appPaths');

const { backendRoot: BACKEND_ROOT, projectRoot: PROJECT_ROOT } = resolveAppRoots(__dirname);

// Robustly load environment variables
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });
dotenv.config();

const isMSSQL = (process.env.DB_TYPE || '').toLowerCase() === 'mssql';

// =========================================================================
// 1. NATIVE MICROSOFT SQL SERVER 2022 ADAPTER
// =========================================================================
let nativeMssql = null;
let mssqlPool = null;

if (isMSSQL) {
  try {
    nativeMssql = require('mssql');
  } catch (err) {
    console.error('[Database] Failed to require mssql module:', err.message);
  }
}

const mssqlConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'FRM_DB',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true
  },
  pool: {
    max: 20,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function connectMSSQL() {
  if (!mssqlPool || !mssqlPool.connected) {
    try {
      mssqlPool = await nativeMssql.connect(mssqlConfig);
      mssqlPool.on('error', err => {
        console.error('[MSSQL Pool Error]:', err.message);
        mssqlPool = null;
      });
      console.log(`[Database] Connected to Microsoft SQL Server (${mssqlConfig.server}:${mssqlConfig.port}/${mssqlConfig.database})`);

      // Automatically execute any pending database migrations safely without affecting live data
      try {
        const { runMssqlMigrations } = require('../database/migrator');
        await runMssqlMigrations(mssqlPool, nativeMssql);
      } catch (migErr) {
        console.warn('[Database] MSSQL migration check warning:', migErr.message);
      }
    } catch (err) {
      console.error('[MSSQL Connection Error]:', err.message);
      throw err;
    }
  }
  return mssqlPool;
}

// =========================================================================
// 2. SQLITE (SQL.JS) EMULATION ADAPTER (FALLBACK)
// =========================================================================
let initSqlJs = null;
let dbInstance = null;
let sqlitePoolInstance = null;
let currentDbPath = null;
let inTransaction = false;

function resolveDatabasePath() {
  const primaryDbPath = path.join(BACKEND_ROOT, 'database', 'FRM-BBP.db');
  const legacyDbPath = path.join(BACKEND_ROOT, 'database', 'factoryflow.db');
  const defaultDbPath = fs.existsSync(primaryDbPath) ? primaryDbPath : (fs.existsSync(legacyDbPath) ? legacyDbPath : primaryDbPath);
  
  if (process.env.SQLITE_DB_PATH) {
    if (path.isAbsolute(process.env.SQLITE_DB_PATH)) {
      return process.env.SQLITE_DB_PATH;
    }
    const fromRoot = path.resolve(PROJECT_ROOT, process.env.SQLITE_DB_PATH);
    if (fs.existsSync(fromRoot)) return fromRoot;

    const fromBackend = path.resolve(BACKEND_ROOT, process.env.SQLITE_DB_PATH);
    if (fs.existsSync(fromBackend)) return fromBackend;

    const fromCwd = path.resolve(process.cwd(), process.env.SQLITE_DB_PATH);
    if (fs.existsSync(fromCwd)) return fromCwd;
  }

  return defaultDbPath;
}

function saveToDisk() {
  if (dbInstance && currentDbPath && !inTransaction) {
    try {
      const data = dbInstance.export();
      fs.writeFileSync(currentDbPath, Buffer.from(data));
    } catch (err) {
      console.error('[LocalDB] Error saving to disk:', err.message);
    }
  }
}

async function getDatabase() {
  if (isMSSQL) return null;

  if (!dbInstance) {
    if (!initSqlJs) {
      initSqlJs = require('sql.js');
    }
    currentDbPath = resolveDatabasePath();
    let wasmBinary = null;
    const candidates = [
      () => require.resolve('sql.js/dist/sql-wasm.wasm'),
      () => path.join(PROJECT_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm'),
      () => path.join(BACKEND_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm')
    ];
    for (const getCand of candidates) {
      try {
        const cand = getCand();
        if (cand && fs.existsSync(cand)) {
          wasmBinary = fs.readFileSync(cand);
          if (wasmBinary && wasmBinary.length > 0) break;
        }
      } catch (e) {}
    }
    const SQL = await initSqlJs(wasmBinary ? { wasmBinary } : undefined);

    if (fs.existsSync(currentDbPath)) {
      const filebuffer = fs.readFileSync(currentDbPath);
      dbInstance = new SQL.Database(filebuffer);
    } else {
      const dir = path.dirname(currentDbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      dbInstance = new SQL.Database();
      const schemaPath = path.join(BACKEND_ROOT, 'database', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        dbInstance.exec(fs.readFileSync(schemaPath, 'utf8'));
      }
      saveToDisk();
    }

    // 1. Register GETDATE()
    dbInstance.create_function('GETDATE', () => {
      const now = new Date();
      return now.toISOString().slice(0, 19).replace('T', ' ');
    });

    // 2. Register TRY_INT(val)
    dbInstance.create_function('TRY_INT', (val) => {
      if (val === null || val === undefined) return null;
      const str = String(val).trim();
      if (/^-?\d+$/.test(str)) {
        return parseInt(str, 10);
      }
      return null;
    });

    // 3. Register DATEADD(part, num, dateStr)
    dbInstance.create_function('DATEADD', (part, num, dateStr) => {
      const d = dateStr ? new Date(dateStr) : new Date();
      const n = parseInt(num, 10);
      const p = String(part || '').toLowerCase();
      if (p === 'month' || p === 'm' || p === 'mm') {
        d.setMonth(d.getMonth() + n);
      } else if (p === 'day' || p === 'd' || p === 'dd') {
        d.setDate(d.getDate() + n);
      } else if (p === 'year' || p === 'y' || p === 'yy' || p === 'yyyy') {
        d.setFullYear(d.getFullYear() + n);
      }
      return d.toISOString().slice(0, 10);
    });

    // 4. Register FORMAT(val, format)
    dbInstance.create_function('FORMAT', (val, fmt) => {
      if (!val) return null;
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      if (fmt === 'yyyy-MM') {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      }
      if (fmt === 'yyyy-MM-dd') {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return String(val);
    });

    // 5. Automatically execute any pending database migrations
    try {
      const { runMigrations } = require('../database/migrator');
      await runMigrations(dbInstance, saveToDisk);
    } catch (migErr) {
      console.warn('[LocalDB] Migration execution warning:', migErr.message);
    }
  }

  return dbInstance;
}

function replaceTopInSubqueries(sqlText) {
  let result = '';
  let i = 0;
  while (i < sqlText.length) {
    const slice = sqlText.slice(i);
    const topMatch = slice.match(/^\(\s*SELECT\s+TOP\s+(\d+)\s+/i);
    if (topMatch) {
      const topN = topMatch[1];
      const startContent = i + topMatch[0].length;
      let depth = 1;
      let j = startContent;
      while (j < sqlText.length && depth > 0) {
        if (sqlText[j] === '(') depth++;
        else if (sqlText[j] === ')') depth--;
        j++;
      }
      let inner = sqlText.slice(startContent, j - 1);
      inner = replaceTopInSubqueries(inner);
      if (!/\bLIMIT\b/i.test(inner)) {
        inner = inner.trim() + ` LIMIT ${topN}`;
      }
      result += `(SELECT ${inner})`;
      i = j;
    } else {
      result += sqlText[i];
      i++;
    }
  }
  return result;
}

function transformQuery(sqlText) {
  let q = sqlText;

  q = q.replace(/\bISNULL\s*\(/gi, 'IFNULL(');
  q = q.replace(/\bTRY_CAST\s*\(\s*(.+?)\s+AS\s+(?:INT|BIGINT|INTEGER)\s*\)/gi, 'TRY_INT($1)');
  q = q.replace(/\bCAST\s*\(\s*(.+?)\s+AS\s+DATE\s*\)/gi, 'DATE($1)');
  q = q.replace(/\bCONVERT\s*\(\s*VARCHAR\s*\(\s*\d+\s*\)\s*,\s*([^,]+?)\s*,\s*120\s*\)/gi, 'SUBSTR($1, 1, 10)');
  q = q.replace(/\bDATEADD\s*\(\s*([a-zA-Z]+)\s*,/gi, "DATEADD('$1',");

  const outputMatch = q.match(/INSERT\s+INTO\s+([^\s(]+)\s*(\([^)]+\))\s*OUTPUT\s+INSERTED\.([^\s(]+(?:\s*,\s*INSERTED\.[^\s(]+)*)\s*VALUES\s*(\([^)]+\))/i);
  if (outputMatch) {
    const fullMatch = outputMatch[0];
    const table = outputMatch[1];
    const cols = outputMatch[2];
    const outCols = outputMatch[3].replace(/INSERTED\./gi, '');
    const vals = outputMatch[4];
    const returningQuery = `INSERT INTO ${table} ${cols} VALUES ${vals} RETURNING ${outCols}`;
    q = q.replace(fullMatch, returningQuery);
  }
  q = q.replace(/\s*OUTPUT\s+INSERTED\.([a-zA-Z0-9_]+)\s*VALUES/gi, ' VALUES');

  q = replaceTopInSubqueries(q);

  if (/^\s*SELECT\s+TOP\s+(\d+)\s+/i.test(q)) {
    const topMatch = q.match(/^\s*SELECT\s+TOP\s+(\d+)\s+/i);
    const topN = topMatch[1];
    q = q.replace(/^\s*SELECT\s+TOP\s+\d+\s+/i, 'SELECT ');
    if (!/\bLIMIT\b/i.test(q)) {
      q = q.trim() + ` LIMIT ${topN}`;
    }
  }

  q = q.replace(/('(?:\\[\s\S]|[^'\\])*')\s*\+\s*(IFNULL|COALESCE|[a-zA-Z0-9_.]+)/gi, '$1 || $2');
  q = q.replace(/(IFNULL\([^)]+\)|COALESCE\([^)]+\)|[a-zA-Z0-9_.]+)\s*\+\s*('(?:\\[\s\S]|[^'\\])*')/gi, '$1 || $2');

  return q;
}

function splitSqlStatements(sqlText) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    if (char === "'" && !inDoubleQuote) {
      if (inSingleQuote && sqlText[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
    } else {
      current += char;
    }
  }

  const last = current.trim();
  if (last) statements.push(last);
  return statements;
}

class SQLiteRequest {
  constructor(parent) {
    this.parent = parent;
    this.parameters = {};
  }

  input(name, typeOrVal, val) {
    let value;
    if (val !== undefined) {
      value = val;
    } else if (typeof typeOrVal !== 'function') {
      value = typeOrVal;
    } else {
      value = null;
    }
    this.parameters[name] = value;
    return this;
  }

  async query(sqlText) {
    const db = await getDatabase();
    const rawStatements = splitSqlStatements(sqlText);

    const params = {};
    for (const [k, v] of Object.entries(this.parameters)) {
      const cleanKey = k.startsWith('@') ? k.slice(1) : k;
      params['@' + cleanKey] = v;
      params[':' + cleanKey] = v;
      params['$' + cleanKey] = v;
    }

    let lastRecordset = [];
    const allRecordsets = [];
    let totalRowsAffected = 0;
    let didModify = false;

    for (const rawStmt of rawStatements) {
      const transformed = transformQuery(rawStmt);
      const isReturning = /\bRETURNING\b/i.test(transformed);
      const isSelect = /^\s*(SELECT|WITH|PRAGMA)\b/i.test(transformed);

      try {
        const stmt = db.prepare(transformed);
        stmt.bind(params);

        if (isSelect || isReturning) {
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();

          if (isReturning) {
            didModify = true;
          }

          lastRecordset = rows;
          allRecordsets.push(rows);
          totalRowsAffected += rows.length;
        } else {
          stmt.step();
          stmt.free();
          const changes = db.getRowsModified();
          totalRowsAffected += changes;
          didModify = true;
        }
      } catch (err) {
        console.error('[SQLite Adapter Error] Query Failed:', err.message);
        console.error('Original SQL Statement:', rawStmt);
        console.error('Transformed SQL:', transformed);
        console.error('Parameters:', params);
        throw err;
      }
    }

    if (didModify) {
      saveToDisk();
    }

    return {
      recordset: lastRecordset,
      recordsets: allRecordsets,
      rowsAffected: [totalRowsAffected]
    };
  }
}

class SQLiteTransaction {
  constructor(pool) {
    this.pool = pool;
  }

  async begin() {
    const db = await getDatabase();
    inTransaction = true;
    db.exec('BEGIN TRANSACTION;');
  }

  async commit() {
    const db = await getDatabase();
    db.exec('COMMIT;');
    inTransaction = false;
    saveToDisk();
  }

  async rollback() {
    const db = await getDatabase();
    try {
      db.exec('ROLLBACK;');
    } catch (e) {}
    inTransaction = false;
  }
}

const sqlitePool = {
  request: () => new SQLiteRequest(sqlitePool),
  close: async () => {
    if (dbInstance) {
      saveToDisk();
      dbInstance.close();
      dbInstance = null;
      sqlitePoolInstance = null;
    }
  }
};

const sqliteSql = {
  VarChar: () => sqliteSql.VarChar,
  NVarChar: () => sqliteSql.NVarChar,
  Text: 'Text',
  Int: 'Int',
  BigInt: 'BigInt',
  SmallInt: 'SmallInt',
  TinyInt: 'TinyInt',
  Numeric: () => sqliteSql.Numeric,
  Decimal: () => sqliteSql.Decimal,
  Float: 'Float',
  Bit: 'Bit',
  Date: 'Date',
  DateTime: 'DateTime',
  Time: 'Time',
  MAX: -1,
  Request: SQLiteRequest,
  Transaction: SQLiteTransaction,
  connect: async () => sqlitePool
};

const connectSQLite = async () => {
  if (!sqlitePoolInstance) {
    const dbPath = resolveDatabasePath();
    await getDatabase();
    console.log(`[Database] Connected to local SQLite database via sql.js (${dbPath})`);
    sqlitePoolInstance = sqlitePool;
  }
  return sqlitePoolInstance;
};

// =========================================================================
// 3. EXPORTS (SELECTS MSSQL OR SQLITE TRANSPARENTLY)
// =========================================================================
if (isMSSQL && nativeMssql) {
  module.exports = {
    sql: nativeMssql,
    connectDB: connectMSSQL,
    config: {
      database: mssqlConfig.database,
      server: mssqlConfig.server,
      type: 'mssql'
    },
    getDatabase: () => null
  };
} else {
  module.exports = {
    sql: sqliteSql,
    connectDB: connectSQLite,
    config: {
      database: 'FRM-BBP.db',
      type: 'sqlite',
      getPath: resolveDatabasePath
    },
    getDatabase
  };
}

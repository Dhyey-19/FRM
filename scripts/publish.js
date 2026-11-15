const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=====================================================================');
console.log('       CREATING GODADDY PRODUCTION PUBLISH PACKAGE');
console.log('=====================================================================');

const rootDir = path.resolve(__dirname, '..');
const publishDir = path.join(rootDir, 'publish');
const distDir = path.join(rootDir, 'dist');

// 1. Build frontend
console.log('[1/6] Building production web frontend (PWA)...');
execSync('npm run build:frontend', { stdio: 'inherit', cwd: rootDir });

// 2. Clean/create publish directory
console.log('[2/6] Preparing publish/ folder structure...');
if (fs.existsSync(publishDir)) {
  fs.rmSync(publishDir, { recursive: true, force: true });
}
fs.mkdirSync(publishDir, { recursive: true });
fs.mkdirSync(path.join(publishDir, 'public'), { recursive: true });
fs.mkdirSync(path.join(publishDir, 'backend'), { recursive: true });

// 3. Copy frontend/dist into publish/public
console.log('[3/6] Copying compiled web assets into publish/public/...');
const frontendDist = path.join(rootDir, 'frontend', 'dist');
fs.cpSync(frontendDist, path.join(publishDir, 'public'), { recursive: true });

// 4. Copy backend into publish/backend
console.log('[4/6] Copying backend & local SQLite database into publish/backend/...');
const backendDirs = ['config', 'controllers', 'routes', 'middlewares', 'database'];
for (const dir of backendDirs) {
  const src = path.join(rootDir, 'backend', dir);
  const dest = path.join(publishDir, 'backend', dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
}
fs.copyFileSync(path.join(rootDir, 'backend', 'server.js'), path.join(publishDir, 'backend', 'server.js'));

// Verify database exists
const primaryDbFile = path.join(publishDir, 'backend', 'database', 'FRM-BBP.db');
const legacyDbFile = path.join(publishDir, 'backend', 'database', 'factoryflow.db');
const dbFile = fs.existsSync(primaryDbFile) ? primaryDbFile : (fs.existsSync(legacyDbFile) ? legacyDbFile : primaryDbFile);
if (fs.existsSync(dbFile)) {
  const size = fs.statSync(dbFile).size;
  console.log(`      ✓ ${path.basename(dbFile)} verified (${(size / 1024).toFixed(1)} KB) with dummy data.`);
} else {
  console.warn('      ⚠ Warning: Database file not found in backend/database!');
}

// 5. Create app.js, package.json, .env, and .htaccess in publish/
console.log('[5/6] Creating entry points & configuration files...');

// app.js (GoDaddy cPanel Entry Point)
const appJsContent = `// FRM Production Entry Point (GoDaddy cPanel / VPS)
const { startServer } = require('./backend/server.js');
startServer();
`;
fs.writeFileSync(path.join(publishDir, 'app.js'), appJsContent);

// package.json (Production Dependencies only)
const pkgJsonContent = {
  name: "frm-godaddy",
  version: "1.0.0",
  description: "FRM-BBP (GoDaddy Edition)",
  main: "app.js",
  scripts: {
    "start": "node app.js"
  },
  dependencies: {
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "exceljs": "^4.4.0",
    "express": "^5.2.1",
    "nodemailer": "^8.0.11",
    "sql.js": "^1.15.2"
  }
};
fs.writeFileSync(path.join(publishDir, 'package.json'), JSON.stringify(pkgJsonContent, null, 2) + '\n');

// .env
const envContent = `PORT=5000
NODE_ENV=production
DB_TYPE=sqlite
SQLITE_DB_PATH=backend/database/FRM-BBP.db
`;
fs.writeFileSync(path.join(publishDir, '.env'), envContent);

// .htaccess (for GoDaddy cPanel Apache & Phusion Passenger)
const htaccessContent = `# =====================================================================
# FRM GoDaddy cPanel Configuration
# =====================================================================

<IfModule mod_passenger.c>
    PassengerAppRoot /home/username/public_html
    PassengerAppType node
    PassengerStartupFile app.js
    PassengerNodejs /home/username/nodevenv/public_html/20/bin/node
</IfModule>

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # If the requested file or directory exists in /public, serve it directly
    RewriteCond %{DOCUMENT_ROOT}/public%{REQUEST_URI} -f [OR]
    RewriteCond %{DOCUMENT_ROOT}/public%{REQUEST_URI} -d
    RewriteRule ^(.*)$ /public/$1 [L]

    # Route all other non-file requests to the Node.js application
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ /app.js [QSA,L]
</IfModule>
`;
fs.writeFileSync(path.join(publishDir, '.htaccess'), htaccessContent);

// README_GODADDY.txt
const readmeContent = `=====================================================================
            FRM-BBP (GODADDY DEPLOYMENT GUIDE)
=====================================================================

TWO PACKAGES ARE GENERATED IN dist/:
------------------------------------
1. FRM-GoDaddy-FullInstall.zip
   -> USE THIS ONLY FOR THE INITIAL / FIRST-TIME DEPLOYMENT.
   -> Includes initial FRM-BBP.db with starter dummy data.

2. FRM-GoDaddy-UpdateOnly.zip (SAFE FOR LIVE SITES)
   -> USE THIS TO UPDATE AN ALREADY-RUNNING SYSTEM WITH LIVE CLIENT DATA!
   -> DOES NOT contain FRM-BBP.db, so extracting it on GoDaddy can
      NEVER overwrite, wipe, or corrupt your client's live data!
   -> Automatically applies any new database migrations (new tables, new columns)
      from backend/database/migrations/ when the server restarts.

METHOD 1: GODADDY CPANEL (SETUP NODE.JS APP) - RECOMMENDED
------------------------------------------------------------
1. Log in to your GoDaddy cPanel hosting account.
2. Under "Software" section, click "Setup Node.js App".
3. Click "Create Application":
     - Node.js version: Select Node 18, 20, or 22
     - Application mode: Production
     - Application root: frm (or your domain folder)
     - Application URL: select your domain (e.g. yourdomain.com)
     - Application startup file: app.js
4. Click "Create".
5. In cPanel File Manager:
   - For First Time Install: Upload FRM-GoDaddy-FullInstall.zip and click "Extract".
   - For Subsequent Updates: Upload FRM-GoDaddy-UpdateOnly.zip and click "Extract".
6. In cPanel Node.js App page, click "Run NPM Install".
7. Click "Restart" application.
8. Open your domain (e.g., https://yourdomain.com).
   The software is now live on your domain with the local database!

HOW TO MANAGE DATABASE SCHEMA CHANGES ON LIVE GO-DADDY:
------------------------------------------------------
1. On your local machine, if you need a new table or column, create a new SQL file
   inside backend/database/migrations/ (e.g. 001_add_column.sql).
2. Run 'npm run publish' on your local computer.
3. Upload and extract 'FRM-GoDaddy-UpdateOnly.zip' into your GoDaddy folder.
4. Click "Restart" in cPanel Node.js App.
5. The built-in migrator automatically runs the new SQL on the live FRM-BBP.db
   without losing a single live invoice, ledger, or user record!

HOW TO BACK UP OR VIEW LIVE CLIENT DATA LOCALLY:
------------------------------------------------
1. In cPanel File Manager, navigate to backend/database/.
2. Right-click 'FRM-BBP.db' and click "Download".
3. You now have a complete, exact offline copy of your client's live data!
=====================================================================
`;
fs.writeFileSync(path.join(publishDir, 'README_GODADDY.txt'), readmeContent);

// 6. Create ZIP archives in dist/
console.log('[6/6] Creating deployment archives in dist/...');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 6A. Full Install ZIP (includes FRM-BBP.db)
const fullZipPath = path.join(distDir, 'FRM-GoDaddy-FullInstall.zip');
if (fs.existsSync(fullZipPath)) fs.unlinkSync(fullZipPath);

// 6B. Update Only ZIP (excludes FRM-BBP.db to protect live client data)
const updateZipPath = path.join(distDir, 'FRM-GoDaddy-UpdateOnly.zip');
if (fs.existsSync(updateZipPath)) fs.unlinkSync(updateZipPath);

try {
  // Compress Full Install
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${publishDir}\\*' -DestinationPath '${fullZipPath}' -Force"`, { stdio: 'inherit' });
  const fullSize = (fs.statSync(fullZipPath).size / (1024 * 1024)).toFixed(2);

  // Compress Update Only (temporarily move all database files out of publish to protect live data)
  const dbDir = path.join(publishDir, 'backend', 'database');
  const tempDbStaging = path.join(rootDir, 'temp_db_staging');
  if (fs.existsSync(tempDbStaging)) fs.rmSync(tempDbStaging, { recursive: true, force: true });
  fs.mkdirSync(tempDbStaging, { recursive: true });

  const dbFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.db'));
  for (const f of dbFiles) {
    fs.renameSync(path.join(dbDir, f), path.join(tempDbStaging, f));
  }

  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${publishDir}\\*' -DestinationPath '${updateZipPath}' -Force"`, { stdio: 'inherit' });
  const updateSize = (fs.statSync(updateZipPath).size / (1024 * 1024)).toFixed(2);

  // Restore database files in publish/
  for (const f of dbFiles) {
    fs.renameSync(path.join(tempDbStaging, f), path.join(dbDir, f));
  }
  fs.rmSync(tempDbStaging, { recursive: true, force: true });

  console.log(`\n=====================================================================`);
  console.log(`✓ SUCCESS! Deployment packages ready in dist/:`);
  console.log(`  1. Fresh Deployment : ${fullZipPath} (${fullSize} MB)`);
  console.log(`     (Use for initial setup - includes initial database)`);
  console.log(`  2. Safe Live Update : ${updateZipPath} (${updateSize} MB)`);
  console.log(`     (Use for live updates - CANNOT OVERWRITE LIVE CLIENT DATA)`);
  console.log(`=====================================================================\n`);
} catch (e) {
  console.warn('Could not create ZIP automatically, but publish/ directory is ready:', e.message);
}


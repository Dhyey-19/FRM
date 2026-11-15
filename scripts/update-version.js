const fs = require('fs');
const path = require('path');

/**
 * Returns today's date formatted as YYYYMMDD (e.g. 20261115).
 */
function getTodayVersion() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Updates software version to current date (YYYYMMDD).
 * If already updated on the same date, leaves it unchanged (unless force=true).
 */
function updateVersion(force = false) {
  const todayVersion = getTodayVersion();
  const rootPkgPath = path.join(__dirname, '..', 'package.json');
  let currentVersion = '';

  if (fs.existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      const match = String(rootPkg.version || '').match(/^(\d{8})/);
      currentVersion = match ? match[1] : (rootPkg.version || '');
    } catch (e) {}
  }

  // If already updated on the same date, no need to change
  if (currentVersion === todayVersion && !force) {
    console.log(`[Version Updater] Version is already up-to-date for today: ${todayVersion} (no change needed)`);
    return todayVersion;
  }

  const semver = `${todayVersion}.0.0`;
  const dateIso = `${todayVersion.slice(0, 4)}-${todayVersion.slice(4, 6)}-${todayVersion.slice(6, 8)}`;
  console.log(`[Version Updater] Updating software version from ${currentVersion || 'none'} -> ${todayVersion} (${dateIso})...`);

  // 1. Root package.json
  if (fs.existsSync(rootPkgPath)) {
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    rootPkg.version = semver;
    fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n', 'utf8');
    console.log(`[Version Updater] ✓ Updated root package.json (${semver})`);
  }

  // 2. Frontend package.json
  const frontendPkgPath = path.join(__dirname, '..', 'frontend', 'package.json');
  if (fs.existsSync(frontendPkgPath)) {
    const frontendPkg = JSON.parse(fs.readFileSync(frontendPkgPath, 'utf8'));
    frontendPkg.version = semver;
    fs.writeFileSync(frontendPkgPath, JSON.stringify(frontendPkg, null, 2) + '\n', 'utf8');
    console.log(`[Version Updater] ✓ Updated frontend package.json (${semver})`);
  }

  // 3. Frontend src/config/version.js
  const versionConfigDir = path.join(__dirname, '..', 'frontend', 'src', 'config');
  if (!fs.existsSync(versionConfigDir)) {
    fs.mkdirSync(versionConfigDir, { recursive: true });
  }
  const versionFilePath = path.join(versionConfigDir, 'version.js');
  const versionContent = `// Auto-generated during build. Do not edit manually.
export const APP_VERSION = '${todayVersion}';
export const BUILD_DATE = '${dateIso}';
export default APP_VERSION;
`;
  fs.writeFileSync(versionFilePath, versionContent, 'utf8');
  console.log(`[Version Updater] ✓ Created ${versionFilePath} (APP_VERSION = '${todayVersion}')`);

  // 4. Root version.json (used by backend systemController)
  const rootVersionJson = path.join(__dirname, '..', 'version.json');
  const versionMeta = {
    version: todayVersion,
    semver: semver,
    buildDate: dateIso,
    builtAt: new Date().toISOString()
  };
  fs.writeFileSync(rootVersionJson, JSON.stringify(versionMeta, null, 2) + '\n', 'utf8');
  console.log(`[Version Updater] ✓ Updated version.json (${todayVersion})`);

  return todayVersion;
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  updateVersion(force);
}

module.exports = { updateVersion, getTodayVersion };

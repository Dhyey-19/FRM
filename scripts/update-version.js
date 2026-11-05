const fs = require('fs');
const path = require('path');

// Format today's date as YYYYMMDD (e.g. 20261104)
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const versionStr = `${year}${month}${day}`;
const semver = `${versionStr}.0.0`;

console.log(`[Version Updater] Today's date: ${year}-${month}-${day}`);
console.log(`[Version Updater] Setting version to ${versionStr} (semver: ${semver})...`);

// 1. Update root package.json
const rootPkgPath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(rootPkgPath)) {
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  rootPkg.version = semver;
  fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n');
  console.log(`[Version Updater] Updated root package.json (version: ${semver})`);
}

// 2. Update frontend package.json
const frontendPkgPath = path.join(__dirname, '..', 'frontend', 'package.json');
if (fs.existsSync(frontendPkgPath)) {
  const frontendPkg = JSON.parse(fs.readFileSync(frontendPkgPath, 'utf8'));
  frontendPkg.version = semver;
  fs.writeFileSync(frontendPkgPath, JSON.stringify(frontendPkg, null, 2) + '\n');
  console.log(`[Version Updater] Updated frontend package.json (version: ${semver})`);
}

// 3. Write frontend/src/config/version.js
const versionConfigDir = path.join(__dirname, '..', 'frontend', 'src', 'config');
if (!fs.existsSync(versionConfigDir)) {
  fs.mkdirSync(versionConfigDir, { recursive: true });
}

const versionFilePath = path.join(versionConfigDir, 'version.js');
const dateIso = `${year}-${month}-${day}`;
const versionContent = `// Auto-generated during build. Do not edit manually.
export const APP_VERSION = '${versionStr}';
export const BUILD_DATE = '${dateIso}';
export default APP_VERSION;
`;

fs.writeFileSync(versionFilePath, versionContent);
console.log(`[Version Updater] Created ${versionFilePath} (APP_VERSION = '${versionStr}')`);
console.log(`[Version Updater] Versioning complete!`);

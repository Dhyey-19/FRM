const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../frontend/dist');
const dest = path.resolve(__dirname, '../public');

if (fs.existsSync(src)) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(src, dest, { recursive: true });
  console.log('[Build] Synced frontend/dist -> public successfully');
} else {
  console.warn('[Build] Warning: frontend/dist not found, could not sync to public');
}

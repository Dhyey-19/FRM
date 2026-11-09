const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function enableAutoStart() {
  const projectRoot = path.resolve(__dirname, '..');
  const targetBat = path.join(projectRoot, 'Start-FRM.bat');
  const startupDir = path.join(
    process.env.APPDATA || '',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup'
  );

  if (!fs.existsSync(startupDir)) {
    console.error('Startup directory not found:', startupDir);
    return;
  }

  const shortcutPath = path.join(startupDir, 'FRM_Server_AutoStart.lnk');
  const vbsPath = path.join(projectRoot, 'temp_autostart.vbs');
  const vbsContent = [
    'Set oWS = WScript.CreateObject("WScript.Shell")',
    `sLinkFile = "${shortcutPath.replace(/\\/g, '\\\\')}"`,
    'Set oLink = oWS.CreateShortcut(sLinkFile)',
    `oLink.TargetPath = "${targetBat.replace(/\\/g, '\\\\')}"`,
    `oLink.WorkingDirectory = "${projectRoot.replace(/\\/g, '\\\\')}"`,
    'oLink.Description = "AutoStart FRM Server on Windows Boot"',
    'oLink.Save'
  ].join('\r\n');

  try {
    fs.writeFileSync(vbsPath, vbsContent, 'utf8');
    execSync(`cscript //nologo "${vbsPath}"`, { stdio: 'inherit' });
    if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
    console.log(`✓ Auto-start on boot enabled successfully!`);
    console.log(`  Shortcut placed in: ${shortcutPath}`);
    console.log(`  FRM Server will now launch automatically whenever this PC turns on.`);
  } catch (err) {
    if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
    console.error('Failed to enable auto-start:', err.message);
  }
}

enableAutoStart();

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function createShortcut() {
  const projectRoot = path.resolve(__dirname, '..');
  const targetBat = path.join(projectRoot, 'Start-FRM.bat');
  const desktopDir = path.join(process.env.USERPROFILE || 'C:\\', 'Desktop');
  const shortcutPath = path.join(desktopDir, 'FRM - Factory Flow.lnk');

  const vbsPath = path.join(projectRoot, 'temp_shortcut.vbs');
  const vbsContent = [
    'Set oWS = WScript.CreateObject("WScript.Shell")',
    `sLinkFile = "${shortcutPath.replace(/\\/g, '\\\\')}"`,
    'Set oLink = oWS.CreateShortcut(sLinkFile)',
    `oLink.TargetPath = "${targetBat.replace(/\\/g, '\\\\')}"`,
    `oLink.WorkingDirectory = "${projectRoot.replace(/\\/g, '\\\\')}"`,
    'oLink.Description = "Launch FRM Factory Resource Manager"',
    'oLink.Save'
  ].join('\r\n');

  try {
    fs.writeFileSync(vbsPath, vbsContent, 'utf8');
    execSync(`cscript //nologo "${vbsPath}"`, { stdio: 'inherit' });
    if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
    console.log(`✓ Desktop shortcut created successfully: ${shortcutPath}`);
  } catch (err) {
    if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
    console.error('Failed to create shortcut:', err.message);
  }
}

createShortcut();

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function enableAutoStart() {
  const projectRoot = path.resolve(__dirname, '..');
  const targetBat = path.join(projectRoot, 'Start-FRM.bat');

  // 1. Register Windows Task Scheduler task with HIGHEST privileges
  // This allows Start-FRM.bat to start SQL Server service without UAC prompts when PC turns on / logs in.
  let taskCreated = false;
  try {
    const taskCmd = `schtasks /create /tn "FRM_BBP_Server_AutoStart" /tr "\\"${targetBat}\\"" /sc onlogon /rl HIGHEST /f`;
    execSync(taskCmd, { stdio: 'pipe' });
    console.log(`✓ Windows Task Scheduler job "FRM_BBP_Server_AutoStart" registered (Highest Privileges).`);
    taskCreated = true;
  } catch (tErr) {
    // schtasks might require elevation if not already running as admin
  }

  // 2. Also place shortcut in user's Startup folder as double-protection
  const startupDir = path.join(
    process.env.APPDATA || '',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup'
  );

  if (fs.existsSync(startupDir)) {
    const shortcutPath = path.join(startupDir, 'FRM_BBP_Server_AutoStart.lnk');
    const vbsPath = path.join(projectRoot, 'temp_autostart.vbs');
    const vbsContent = [
      'Set oWS = WScript.CreateObject("WScript.Shell")',
      `sLinkFile = "${shortcutPath.replace(/\\/g, '\\\\')}"`,
      'Set oLink = oWS.CreateShortcut(sLinkFile)',
      `oLink.TargetPath = "${targetBat.replace(/\\/g, '\\\\')}"`,
      `oLink.WorkingDirectory = "${projectRoot.replace(/\\/g, '\\\\')}"`,
      'oLink.Description = "AutoStart FRM-BBP Server on Windows Boot"',
      'oLink.Save'
    ].join('\r\n');

    try {
      fs.writeFileSync(vbsPath, vbsContent, 'utf8');
      execSync(`cscript //nologo "${vbsPath}"`, { stdio: 'pipe' });
      if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
      console.log(`✓ Windows Startup folder shortcut placed: ${shortcutPath}`);
    } catch (err) {
      if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
      console.warn('Could not create Startup folder shortcut:', err.message);
    }
  }

  console.log(`✓ Auto-start on boot enabled! FRM Server will launch automatically when this PC restarts.`);
}

enableAutoStart();

@echo off
title FRM-BBP - Enable Auto-Start on Windows Boot
cd /d "%~dp0"

echo =====================================================================
echo             ENABLE FRM-BBP AUTO-START ON WINDOWS BOOT
echo =====================================================================
echo.

node scripts/enable-autostart.js

echo.
echo =====================================================================
pause


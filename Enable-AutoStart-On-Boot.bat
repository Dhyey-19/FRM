@echo off
title FRM - Enable Auto-Start on Windows Boot
cd /d "%~dp0"

echo =====================================================================
echo             ENABLE FRM AUTO-START ON WINDOWS BOOT
echo =====================================================================
echo.

node scripts/enable-autostart.js

echo.
echo =====================================================================
pause


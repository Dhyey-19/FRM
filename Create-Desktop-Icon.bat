@echo off
title FRM - Create Desktop Shortcut
cd /d "%~dp0"

echo =====================================================================
echo                CREATE FRM DESKTOP SHORTCUT
echo =====================================================================
echo.

node scripts/create-desktop-shortcut.js

echo.
echo =====================================================================
pause

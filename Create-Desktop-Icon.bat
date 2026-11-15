@echo off
title FRM-BBP - Create Desktop Shortcut
cd /d "%~dp0"

echo =====================================================================
echo                CREATE FRM-BBP DESKTOP SHORTCUT
echo =====================================================================
echo.

node scripts/create-desktop-shortcut.js

echo.
echo =====================================================================
pause


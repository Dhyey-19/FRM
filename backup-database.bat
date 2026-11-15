@echo off
title FRM-BBP - Database Backup
echo ============================================================
echo           FRM-BBP Database Backup Utility (MS SQL Server)
echo ============================================================
echo.

cd /d "%~dp0"
node backend/database/backup.js

echo.
echo ============================================================
pause

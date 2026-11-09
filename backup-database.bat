@echo off
title FRM - Database Backup
echo ============================================================
echo           FRM Database Backup Utility (MS SQL Server)
echo ============================================================
echo.

cd /d "%~dp0"
node backend/database/backup.js

echo.
echo ============================================================
pause

@echo off
title FRM - Factory Flow Server
cd /d "%~dp0"

echo =====================================================================
echo           FRM (FACTORY RESOURCE MANAGER) SERVER LAUNCHER
echo =====================================================================
echo.

:: 1. Verify MS SQL Server service is running
echo [*] Checking Microsoft SQL Server 2022 service...
sc query "MSSQL$SQLEXPRESS" | find "RUNNING" >nul
if %ERRORLEVEL% neq 0 (
    echo [*] Starting SQL Server (SQLEXPRESS)...
    net start MSSQL$SQLEXPRESS >nul 2>&1
)

:: 2. Ensure frontend distribution is built
if not exist "frontend\dist\index.html" (
    echo [*] Building web frontend for first-time run...
    call npm --prefix frontend run build
)

:: 3. Automatically launch browser after 2 seconds in background
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

:: 4. Start the Node.js Server
echo [*] Starting FRM server on port 5000...
echo.
node backend\server.js
pause

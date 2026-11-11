@echo off
title FRM - Factory Flow Server
cd /d "%~dp0"

echo =====================================================================
echo           FRM (FACTORY RESOURCE MANAGER) SERVER LAUNCHER
echo =====================================================================
echo.

:: 1. Verify MS SQL Server service is running (SQLEXPRESS or default MSSQLSERVER)
echo [*] Checking Microsoft SQL Server service...
sc query "MSSQL$SQLEXPRESS" | find "RUNNING" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    sc query "MSSQLSERVER" | find "RUNNING" >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [*] Attempting to start SQL Server service...
        net start "MSSQL$SQLEXPRESS" >nul 2>&1
        if %ERRORLEVEL% neq 0 net start MSSQLSERVER >nul 2>&1
    )
)

:: 2. Ensure dependencies and frontend distribution are ready
if not exist "node_modules" (
    echo [*] Installing dependencies for first-time run...
    call npm install
)
if not exist "public\index.html" if not exist "frontend\dist\index.html" (
    if exist "frontend\package.json" (
        echo [*] Building web frontend for first-time run...
        call npm --prefix frontend run build
    ) else (
        echo [ERROR] Frontend build files not found in public\ or frontend\dist\.
        pause
        exit /b 1
    )
)

:: 3. Automatically launch browser after 2 seconds in background
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

:: 4. Start the Node.js Server
echo [*] Starting FRM server on port 5000...
echo.
node backend\server.js
pause


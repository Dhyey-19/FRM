@echo off
title FRM - Factory Resource Manager Local Server
cd /d "%~dp0"

echo =====================================================================
echo                FRM - FACTORY RESOURCE MANAGER LOCAL SERVER
echo =====================================================================
echo.

:: 1. Ensure local database exists with clean schema
if not exist "backend\database\factoryflow.db" (
    echo [*] Initializing local database schema...
    node backend\database\init-db.js
    echo.
)

:: 2. Ensure SSL certificates exist for PWA installation
if not exist "backend\certs\cert.pem" (
    echo [*] Generating local SSL certificates for PWA support...
    node scripts\generate-cert.js
    echo.
)

:: 3. Ensure frontend distribution exists
if not exist "frontend\dist\index.html" (
    echo [*] Building production web frontend...
    call npm run build:frontend
    echo.
)

:: 4. Launch Server
echo [*] Starting FRM Server...
echo.
echo   - Local Web Access:    http://localhost:5000
echo   - Network Access (LAN): Check your PC IP (e.g. http://192.168.x.x:5000)
echo   - Mobile PWA Install:  https://[Server-IP]:5443
echo.
echo Press Ctrl+C at any time to stop the server.
echo =====================================================================
echo.

node backend\server.js
pause


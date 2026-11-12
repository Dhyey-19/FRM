@echo off
title FRM - First-Time Server Setup
cd /d "%~dp0"

echo =====================================================================
echo         FRM (FACTORY RESOURCE MANAGER) - SERVER SETUP WIZARD
echo =====================================================================
echo.

:: 1. Verify Node.js is installed
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in system PATH.
    echo Please install Node.js LTS from https://nodejs.org/ and run this again.
    pause
    exit /b 1
)

:: 2. Check Administrator privileges (needed for Firewall & SQL Service control)
net session >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] Running with Administrator privileges.

    echo [*] Configuring SQL Server service to start automatically on Windows boot...
    sc config "MSSQL$SQLEXPRESS" start= auto >nul 2>&1
    sc config "MSSQLSERVER" start= auto >nul 2>&1
    sc config "SQLBrowser" start= auto >nul 2>&1

    if exist "scripts\configure-sqlserver.ps1" (
        powershell -ExecutionPolicy Bypass -File "scripts\configure-sqlserver.ps1"
    ) else (
        echo [*] Starting SQL Server service...
        net start "MSSQL$SQLEXPRESS" >nul 2>&1
        if %ERRORLEVEL% neq 0 net start MSSQLSERVER >nul 2>&1
        net start "SQLBrowser" >nul 2>&1
    )

    echo [*] Opening Windows Firewall ports 5000 ^(HTTP^) and 5443 ^(HTTPS^) for LAN access...
    netsh advfirewall firewall delete rule name="FRM Server HTTP (5000)" >nul 2>&1
    netsh advfirewall firewall add rule name="FRM Server HTTP (5000)" dir=in action=allow protocol=TCP localport=5000 >nul
    netsh advfirewall firewall delete rule name="FRM Server HTTPS (5443)" >nul 2>&1
    netsh advfirewall firewall add rule name="FRM Server HTTPS (5443)" dir=in action=allow protocol=TCP localport=5443 >nul
    echo [OK] Windows Firewall configured for multi-device LAN access.
) else (
    echo [WARNING] Not running as Administrator.
    echo           Windows Firewall ports ^(5000, 5443^) will NOT be opened automatically.
    echo           TIP: Close this window, right-click Setup-Server.bat, and select
    echo                "Run as administrator" for automatic firewall setup.
    echo.
    pause
)

echo.
echo [*] Installing Node.js dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    if exist "node_modules" (
        echo [WARNING] npm install returned an error ^(offline?^). Continuing with existing node_modules...
    ) else (
        echo [ERROR] npm install failed and no node_modules folder was found.
        echo         Check your internet connection and try again.
        pause
        exit /b %ERRORLEVEL%
    )
)

echo.
echo [*] Launching interactive configuration wizard...
echo.
node scripts/setup-server.js

echo.
pause


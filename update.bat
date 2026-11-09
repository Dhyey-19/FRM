@echo off
title FRM - Updating Application and Database...
echo ============================================================
echo           FRM (Factory Resource Manager) Updater
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/3] Fetching latest code and migrations from GitHub...
git pull origin main
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git pull failed. Please check internet connection.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Building frontend assets...
call npm --prefix frontend run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Application and database migrations are ready!
echo.
echo NOTE: Whenever the backend server restarts, it will automatically
echo apply any new database migrations to FRM_DB safely in transactions
echo without touching your live customer, ledger, or transaction data!
echo.
echo ============================================================
echo              UPDATE COMPLETED SUCCESSFULLY!
echo ============================================================
pause

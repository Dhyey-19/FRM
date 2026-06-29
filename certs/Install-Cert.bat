@echo off
echo Installing FactoryFlow Certificate to Trusted Root Authorities...
echo.
echo A Windows Security prompt may appear asking you to confirm the installation. 
echo Please click "Yes" to trust the certificate.
echo.
certutil -addstore -user Root "%~dp0DTech.cer"
echo.
echo Certificate installation complete. You may now run FactoryFlow without SmartScreen warnings.
pause

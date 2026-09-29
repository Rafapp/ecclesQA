@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\electron\package.json" (
  echo Installing Magic development dependencies...
  call npm.cmd ci
  if errorlevel 1 goto :error
)

call npm.cmd start
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo Magic could not start. Review the message above, then press any key to close.
pause >nul
exit /b 1

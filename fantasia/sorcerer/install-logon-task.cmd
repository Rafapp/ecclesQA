@echo off
setlocal
set "TASK_NAME=Sorcerer Server"
set "RUNNER=%~dp0run-server.cmd"
set "DATA_DIR=C:\SorcererData"

schtasks /Create /TN "%TASK_NAME%" /SC ONLOGON /RL LIMITED /F /TR "\"%RUNNER%\" --data-dir %DATA_DIR%"
if errorlevel 1 (
  echo.
  echo Could not create the logon task. Run this command from the server PC's
  echo interactive user session, then review any Windows Task Scheduler message.
  exit /b 1
)
echo Created "%TASK_NAME%". Sorcerer will start when this user signs in.

@echo off
setlocal
cd /d "%~dp0"
set "MAGIC_PY=%~dp0..\magic\python\python.exe"
if exist "%MAGIC_PY%" (
  "%MAGIC_PY%" server.py %*
) else (
  python server.py %*
)

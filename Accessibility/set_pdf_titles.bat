@echo off
setlocal enabledelayedexpansion

REM Path to exiftool (edit if needed)
set EXIFTOOL=exiftool

for %%F in (*.pdf) do (
    set "filename=%%~nF"
    echo Processing: %%F
    %EXIFTOOL% -overwrite_original -Title="!filename!" "%%F"
)

echo Done.
pause
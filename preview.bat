@echo off
setlocal enabledelayedexpansion

echo Starting preview

for /f "usebackq delims=" %%A in (`wix preview --source local 2^>^&1`) do (
    set "line=%%A"
    echo !line!
    echo !line! | findstr /c:"https://" >nul
    if !errorlevel! equ 0 (
        set "url=!line:*https://=https://!"
        for /f "delims= " %%U in ("!url!") do set "url=%%U"
        start "" "!url!"
        REM TODO only pause if error or warning
        REM pause
        goto :eof
    )
)

echo Error: No URL to open: %line%
pause
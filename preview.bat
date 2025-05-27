@echo off
setlocal enabledelayedexpansion

REM Wix Preview ausführen und Ausgabe parsen
for /f "usebackq delims=" %%A in (`wix preview --source local 2^>^&1`) do (
    set "line=%%A"
    REM Nur Zeilen mit https:// weiterverarbeiten
    echo !line! | findstr /c:"https://" >nul
    if !errorlevel! equ 0 (
        REM Aus der Zeile alles bis zum ersten https:// abschneiden
        set "url=!line:*https://=https://!"
        REM Entferne evtl. nachfolgende Zeichen (falls Leerzeichen o.ä.)
        for /f "delims= " %%U in ("!url!") do set "url=%%U"
        echo Öffne: !url!
        start "" "!url!"
        goto :eof
    )
)

echo Fehler: Keine URL gefunden.
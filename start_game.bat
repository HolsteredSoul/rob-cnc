@echo off
cd /d "%~dp0"
title Command and Conquer RTS - Operation Vanguard
echo ===================================================
echo   LAUNCHING COMMAND AND CONQUER RTS: OPERATION VANGUARD
echo ===================================================
echo.
echo Starting concurrent local web server (port 8000)...
echo Opening game in your default web browser...
echo.
echo Keep this window open while playing. Press Ctrl+C to stop.
echo.
where python >nul 2>nul
if %ERRORLEVEL%==0 (
  python server.py
) else (
  py -3 server.py
)
pause


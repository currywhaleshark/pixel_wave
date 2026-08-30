@echo off
setlocal
cd /d "%~dp0"

set "SEQUENCER_URL=http://localhost:8321/tools/stage-sequencer.html"
set "CODEX_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

where py >nul 2>&1
if not errorlevel 1 (
  py -3 -c "import sys" >nul 2>&1
  if not errorlevel 1 goto run_with_py
)

where python >nul 2>&1
if not errorlevel 1 (
  python -c "import sys" >nul 2>&1
  if not errorlevel 1 goto run_with_python
)

if exist "%CODEX_PYTHON%" goto run_with_codex_python

echo Python 3 was not found.
echo Install Python 3 or run this project through Codex once, then try again.
pause
exit /b 1

:open_browser
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process '%SEQUENCER_URL%'"
exit /b 0

:run_with_py
call :open_browser
echo Stage Sequencer: %SEQUENCER_URL%
echo Close this window or press Ctrl+C to stop the server.
py -3 server.py
goto server_stopped

:run_with_python
call :open_browser
echo Stage Sequencer: %SEQUENCER_URL%
echo Close this window or press Ctrl+C to stop the server.
python server.py
goto server_stopped

:run_with_codex_python
call :open_browser
echo Stage Sequencer: %SEQUENCER_URL%
echo Close this window or press Ctrl+C to stop the server.
"%CODEX_PYTHON%" server.py

:server_stopped
echo.
echo Server stopped. If it did not start, check the message above.
pause
endlocal

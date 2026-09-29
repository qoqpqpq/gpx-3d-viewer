@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules\vite\bin\vite.js (
  echo Installing project dependencies...
  call npm.cmd ci --registry=https://registry.npmjs.org
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:5173 in your browser.
echo Keep this window open. Press Ctrl+C to stop.
call npm.cmd run dev
pause

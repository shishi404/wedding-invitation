@echo off
setlocal
cd /d "%~dp0"
set "NODE_BIN="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined NODE_BIN set "NODE_BIN=%%N"
if not defined NODE_BIN if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_BIN=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_BIN (
  echo Node.js was not found. Please install Node.js LTS and run this file again.
  pause
  exit /b 1
)
"%NODE_BIN%" build-browser.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
echo Starting the study preview. Keep this window open while playing.
"%NODE_BIN%" preview.mjs --open
if errorlevel 1 pause

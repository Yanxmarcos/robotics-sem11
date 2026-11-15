@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Se necesita Node.js para abrir el simulador.
  pause
  exit /b 1
)
node servir.mjs
pause

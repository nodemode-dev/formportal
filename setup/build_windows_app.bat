@echo off
cd /d "%~dp0\.."

where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust is required: https://rustup.rs
  exit /b 1
)
cd frontend
call npm ci || exit /b 1
call npm run build || exit /b 1
cd ..\src-tauri
if not defined FORMPORTAL_BUNDLES set "FORMPORTAL_BUNDLES=nsis"
call npx --yes @tauri-apps/cli@2 build --bundles %FORMPORTAL_BUNDLES% %* || exit /b 1
echo Built into %~dp0..\target\release\bundle

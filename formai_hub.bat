@echo off
cd /d "%~dp0"

where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust is required: https://rustup.rs. Then run formai_hub_oc_install.bat
  exit /b 1
)
if not exist frontend\node_modules (
  echo Run formai_hub_oc_install.bat first.
  exit /b 1
)

start "formai interface" /min cmd /c "cd /d "%~dp0frontend" && boot_frontend.bat"
timeout /t 3 /nobreak >nul
cargo run -p formai
taskkill /fi "WINDOWTITLE eq formai interface*" /t /f >nul 2>nul

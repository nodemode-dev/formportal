@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node 20.19 or newer is required: https://nodejs.org
  exit /b 1
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust is required: https://rustup.rs
  exit /b 1
)

cd frontend
call oc_install.bat || exit /b 1
cd ..
cargo fetch --locked || exit /b 1

echo.
echo formai is ready to run from source. Start it with: formai_hub.bat

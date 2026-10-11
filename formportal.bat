@echo off
cd /d "%~dp0"

where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust is required: https://rustup.rs. Then run formportal_oc_install.bat
  exit /b 1
)
if /i "%~1"=="mcp" (
  cargo build -q --release --locked -p formportal-cli 1>&2 || exit /b 1
  "%~dp0target\release\formportal-cli.exe" mcp
  exit /b %errorlevel%
)
if /i "%~1"=="cli" (
  cargo build -q --release --locked -p formportal-cli 1>&2 || exit /b 1
  "%~dp0target\release\formportal-cli.exe" %2 %3 %4 %5 %6 %7 %8 %9
  exit /b %errorlevel%
)
if /i "%~1"=="agents" (
  python "%~dp0setup\agents.py" %2 %3 %4
  exit /b %errorlevel%
)
if not exist frontend\node_modules (
  echo Run formportal_oc_install.bat first.
  exit /b 1
)

start "FormPortal interface" /min cmd /c "cd /d "%~dp0frontend" && boot_frontend.bat"
timeout /t 3 /nobreak >nul
cargo run -p formportal
taskkill /fi "WINDOWTITLE eq FormPortal interface*" /t /f >nul 2>nul

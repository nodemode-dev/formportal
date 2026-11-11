@echo off
cd /d "%~dp0"

where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust is required: https://rustup.rs. Then run formportal_oc_install.bat
  exit /b 1
)
if /i "%~1"=="mcp" goto mcp
if /i "%~1"=="cli" goto cli
if /i "%~1"=="agents" goto agents
if not exist frontend\node_modules (
  echo Run formportal_oc_install.bat first.
  exit /b 1
)

start "FormPortal interface" /min cmd /c "cd /d "%~dp0frontend" && boot_frontend.bat"
timeout /t 3 /nobreak >nul
cargo run -p formportal
set "status=%errorlevel%"
taskkill /fi "WINDOWTITLE eq FormPortal interface*" /t /f >nul 2>nul
exit /b %status%

:mcp
cargo build -q --release --locked -p formportal-cli 1>&2 || exit /b 1
"%~dp0target\release\formportal-cli.exe" mcp
exit /b %errorlevel%

:cli
cargo build -q --release --locked -p formportal-cli 1>&2 || exit /b 1
set "FP_ARGS=%*"
call set "FP_ARGS=%%FP_ARGS:*%1=%%"
"%~dp0target\release\formportal-cli.exe" %FP_ARGS%
exit /b %errorlevel%

:agents
set "FP_ARGS=%*"
call set "FP_ARGS=%%FP_ARGS:*%1=%%"
python "%~dp0setup\agents.py" %FP_ARGS%
exit /b %errorlevel%

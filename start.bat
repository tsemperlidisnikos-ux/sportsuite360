@echo off
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js den vrethike. Egkatastase to apo https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Egkatastasi dependencies...
  call npm install
  if errorlevel 1 (
    echo To npm install apektixe.
    pause
    exit /b 1
  )
)

echo Ekkinisi AcademyHub...
call npm run dev

pause

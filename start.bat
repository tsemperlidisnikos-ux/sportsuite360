@echo off
cd /d "%~dp0"
set "APP_URL=http://localhost:5173"

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

echo Ekkinisi SportSuite360...
start "SportSuite360 Dev Server" cmd /k "cd /d "%~dp0" && npm run dev -- --host localhost"

echo Anoigma efarmogis sto %APP_URL%...
timeout /t 3 /nobreak >nul
start "" "%APP_URL%"

exit /b 0

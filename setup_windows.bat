@echo off
SETLOCAL EnableDelayedExpansion

echo ======================================================
echo   Morphogenetic Particle System - Automated Setup
echo ======================================================
echo.

:: 1. Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRORE] Node.js non e' installato!
    echo Per favore, installalo da https://nodejs.org/ prima di continuare.
    pause
    exit /b 1
)

echo [OK] Node.js rilevato: 
node -v
echo.

:: 2. Install dependencies
echo [INFO] Installazione delle dipendenze in corso (npm install)...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRORE] L'installazione delle dipendenze e' fallita.
    pause
    exit /b 1
)

echo.
echo [OK] Dipendenze installate con successo!
echo.
echo ======================================================
echo   INSTALLAZIONE COMPLETATA
echo ======================================================
echo.
echo Per avviare la simulazione:
echo 1. Digita: npm run dev
echo 2. Apri il browser su: http://localhost:5173
echo.
set /p START_NOW="Vuoi avviare la simulazione adesso? (S/N): "
if /I "%START_NOW%" EQU "S" (
    npm run dev
) else (
    echo.
    echo Puoi chiudere questa finestra.
    pause
)

ENDLOCAL

@echo off
title Lastro CRM & Agente Hunter
echo ======================================================
echo    INICIALIZANDO O LASTRO CRM & AGENTE HUNTER AI
echo ======================================================
echo.
cd /d "%~dp0backend"
echo Iniciando servidor Node.js...
start http://localhost:3001
node src/server.js
pause

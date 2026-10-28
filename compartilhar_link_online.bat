@echo off
title Gerador de Link Online - Lastro CRM
echo ======================================================
echo    GERANDO LINK PUBLICO PARA O LASTRO CRM (INTERNET)
echo ======================================================
echo.
echo Certifique-se de que o start.bat (servidor) esta rodando!
echo Criando conexao segura HTTPS...
echo.
npx --yes localtunnel --port 3001
pause

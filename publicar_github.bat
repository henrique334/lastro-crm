@echo off
title Publicar Lastro CRM no GitHub
echo ======================================================
echo       PUBLICAR LASTRO CRM NO SEU GITHUB
echo ======================================================
echo.
echo 1. Crie um repositorio vazio no seu GitHub (ex: lastro-crm):
echo    Acesse: https://github.com/new
echo.
set /p REPO_URL="Cole aqui a URL do seu repositorio (ex: https://github.com/henrique334/lastro-crm.git): "

if "%REPO_URL%"=="" (
    echo Nenhuma URL informada. Operacao cancelada.
    pause
    exit /b
)

git branch -M main
git remote remove origin 2>nul
git remote add origin %REPO_URL%
echo.
echo Enviando arquivos para o GitHub...
git push -u origin main

echo.
echo ======================================================
echo Concluido! Seu codigo esta no GitHub.
echo ======================================================
pause

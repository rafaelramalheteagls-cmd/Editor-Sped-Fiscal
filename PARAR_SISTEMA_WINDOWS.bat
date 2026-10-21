@echo off
chcp 65001 >nul
title SPED Fiscal Editor Pro - Parar Sistema
cls

echo =======================================================
echo          ENCERRANDO SPED FISCAL EDITOR PRO
echo =======================================================
echo.

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo Processo na porta 3000 finalizado com sucesso.
)

echo.
echo O sistema foi encerrado.
echo Pressione qualquer tecla para sair...
pause >nul

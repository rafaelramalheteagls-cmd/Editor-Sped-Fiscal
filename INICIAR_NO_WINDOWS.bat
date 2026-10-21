@echo off
chcp 65001 >nul
title SPED Fiscal Editor Pro - Inicializador Automático
cls

echo =======================================================
echo          SPED FISCAL EDITOR PRO - INICIALIZADOR
echo =======================================================
echo.
echo Verificando ambiente no seu computador...
echo.

:: 1. Verifica se o Node.js esta instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [AVISO IMPORTANTE]
    echo O Node.js não foi encontrado no seu computador!
    echo.
    echo Para rodar o sistema localmente, você só precisa instalar
    echo o Node.js uma única vez (versão LTS recomendada).
    echo.
    echo Pressione qualquer tecla para abrir a página oficial de download:
    pause >nul
    start https://nodejs.org/pt-br/download
    exit /b
)

:: 2. Verifica se a pasta node_modules existe
if not exist "node_modules" (
    echo [PRIMEIRA EXECUÇÃO DETECTADA]
    echo Instalando as dependências necessárias automaticamente...
    echo Isso ocorre apenas na primeira vez que você abre o sistema.
    echo Por favor, aguarde alguns segundos...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo Ocorreu uma falha ao instalar as dependências.
        echo Verifique sua conexão com a internet e tente novamente.
        pause
        exit /b
    )
    echo.
    echo Dependências instaladas com sucesso!
    echo.
)

:: 3. Aguarda 2 segundos e abre o navegador automaticamente
start "" "http://localhost:3000"

:: 4. Inicia o servidor local
echo =======================================================
echo  O SPED Fiscal Editor Pro está iniciando!
echo  Seu navegador padrão será aberto em:
echo  http://localhost:3000
echo.
echo  Para fechar o sistema, basta fechar esta janela.
echo =======================================================
echo.

call npm run dev
pause

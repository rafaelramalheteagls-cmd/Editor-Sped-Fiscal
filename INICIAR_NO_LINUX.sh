#!/bin/bash
cd "$(dirname "$0")"

echo "======================================================="
echo "      SPED FISCAL EDITOR PRO - INICIALIZADOR LINUX"
echo "======================================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "Node.js não foi encontrado no seu Linux."
    echo "Instale através de https://nodejs.org/ ou com seu gerenciador de pacotes."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Instalando dependências na primeira execução..."
    npm install
fi

echo "Abrindo o navegador em http://localhost:3000..."
(sleep 2 && (xdg-open "http://localhost:3000" || sensible-browser "http://localhost:3000")) &

npm run dev

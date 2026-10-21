#!/bin/bash
cd "$(dirname "$0")"

echo "======================================================="
echo "       SPED FISCAL EDITOR PRO - INICIALIZADOR MAC"
echo "======================================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "Node.js não foi encontrado no seu Mac."
    echo "Instale através de https://nodejs.org/"
    open https://nodejs.org/
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Instalando dependências na primeira execução..."
    npm install
fi

echo "Abrindo o navegador em http://localhost:3000..."
sleep 2 && open "http://localhost:3000" &

npm run dev

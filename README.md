# SPED Fiscal Editor Pro (web)

Editor e analisador de arquivos **SPED EFD ICMS/IPI** no navegador, com importação de **CT-e XML**, análise por CFOP, dashboard fiscal, validação de regras e exportação.

Tudo roda no cliente: o arquivo que você abre **não é enviado para nenhum servidor** e não fica salvo em lugar nenhum além da memória da aba.

## Como rodar

Pré-requisito: Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`.

No Windows, `INICIAR_NO_WINDOWS.bat` faz o mesmo (verifica o Node, instala as dependências na primeira execução e abre o navegador). Há equivalentes para Linux (`INICIAR_NO_LINUX.sh`) e macOS (`INICIAR_NO_MAC.command`).

## Build

```bash
npm run build     # tsc --noEmit + vite build -> dist/
npm run preview   # serve o dist/ em http://localhost:3000
npm run lint      # só o typecheck
```

## Docker

```bash
docker compose up -d --build
```

Serve o `dist/` via nginx em `http://localhost:3000`.

## Funcionalidades

- **Leitura de SPED** — parse do arquivo TXT, detecção do bloco 0000 (empresa, CNPJ, período, perfil) e contagem de registros por bloco.
- **Editor de registros** — navegação por tipo de registro (C100, C170, C190, 0200, H010…), edição campo a campo, inclusão e exclusão de linhas, com undo/redo (`Ctrl+Z` / `Ctrl+Y`).
- **Totalizadores automáticos** — ao editar qualquer linha, os encerramentos de bloco (0990, C990, D990, E990, H990) e os registros 9900/9990/9999 são recalculados.
- **Análise por CFOP** — entradas e saídas agregadas com valor de operação, base de ICMS e ICMS.
- **Validação** — inconsistências classificadas em erro / advertência / info, com atalho para a linha problemática; correções rápidas (espaços no 0200, produtos 0200 sem movimentação, ordem de C170/C190 em relação a C195/C197).
- **Importação de CT-e** — leitura do XML e integração como registro D100/D190.
- **Ajuste de inventário** — recálculo de H010 a partir de saldo e custo.
- **Ajuste de CST/ICMS por nota**.
- **Busca global** em todos os registros.
- **Exportação** — TXT SPED editado, CSV, Excel (por registro ou completo, uma aba por registro) e relatório PDF (CFOP consolidado ou geral).

## Estrutura

```
src/
  App.tsx              estado central (linhas, undo/redo, metadata) e navegação
  types.ts             tipos do domínio
  lib/
    spedParser.ts      parse do TXT, resumo por CFOP, formatação
    spedValidator.ts   motor de validação
    spedValidationRules.ts
    pvaRulesCatalog.ts catálogo de regras do PVA
    cstDatabase.ts     tabela de CST/ICMS
    cestCatalog.ts     catálogo de CEST
    inscricaoEstadual.ts
    spedLayout.ts      layout dos registros e descrições
    spedFiscalSync.ts  recálculo de totalizadores e correções estruturais
    cteParser.ts       parse de CT-e XML e integração no SPED
    spedExporter.ts    TXT, CSV e Excel
  components/          telas e modais (dashboard, editor, CFOP, validação, busca, PDF)
  context/             tema claro/escuro
public/
  samples/             arquivos de exemplo (SPED e CT-e) usados no botão "carregar exemplo"
```

## Exemplos

`public/samples/sample_sped.txt` é um arquivo fictício (137 registros, abril/2026, empresa de exemplo) e `sample_cte.xml` um CT-e também fictício. Nenhum dado real está no repositório.

## Limitações

- O validador cobre um subconjunto das regras do PVA; **não substitui** o PVA oficial nem garante aceitação do arquivo pela SEFAZ.
- Não há persistência: recarregar a página perde as edições. Exporte o TXT antes.
- Escopo atual: EFD ICMS/IPI (blocos 0, C, D, E, H, 9). EFD-Contribuições, ECD e outros não são tratados.

## Histórico

As versões anteriores deste projeto eram um aplicativo desktop em PyQt6. Elas foram descontinuadas e continuam acessíveis apenas no histórico do Git (commits anteriores a `4f3fb86`).

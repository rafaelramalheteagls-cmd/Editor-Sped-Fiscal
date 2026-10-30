# Diagnóstico e Resolução dos 257 Erros do PVA no Validador SPED

Compara o diagnóstico do relatório oficial do PVA anexado pelo usuário (`erros_sped_4ec4e6e4.pdf`) com o validador interno do aplicativo, implementa todas as validações oficiais ausentes e adiciona ações de correção automática inteligente para sanar os 257 erros e a advertência.

## Decisões Confirmadas & Resumo dos Erros do PVA

> [!IMPORTANT]
> **Raio-X dos 257 Erros do PVA Identificados no PDF**:
> 1. **239 erros - Registro 0200 (Campo 07 - `TIPO_ITEM`)**: Campo obrigatório que está em branco em 239 produtos.
> 2. **14 erros - Registro D100 (Campos 24 e 25 - `COD_MUN_ORIG` e `COD_MUN_DEST`)**: Em documentos de transporte de entrada (modelo 57 - CT-e), o preenchimento de município de origem e destino é estritamente obrigatório.
> 3. **2 erros - Registro 0150 (Campo 08 - `COD_MUN`)**: Município IBGE obrigatório para contribuintes domiciliados no Brasil (códigos de participante `T248` e `T3`).
> 4. **2 erros - Registro D100 (Campo 10 vs `COD_PART`)**: O CNPJ embutido na chave do CT-e (`38.027.438/0001-36` - Maluquinho Transportes `T240`) não confere com o participante informado (`T3` - Dominare Construções).

---

## 1. Visão Geral & Conceito

- **O que faz**:
  - Implementa as 4 regras fiscais oficiais do PVA que causaram os 257 erros no arquivo real do usuário.
  - Oferece botões de **Correção Automática em 1 Clique (Auto-Fix)** para cada grupo de erro (ex: preencher `TIPO_ITEM` inteligente a partir do CFOP de compra no C170, preencher municípios no D100/0150, ajustar o participante correto no CT-e).
  - Inclui a ferramenta de **Importação/Cruzamento com Relatório do PVA**, permitindo colar o relatório de erros do PVA para reconciliação imediata linha a linha.
- **Público-Alvo**: Analistas fiscais e contadores que precisam validar o SPED antes de enviar ao PVA e corrigir centenas de pendências cadastrais sem ter que alterar linha por linha manualmente.

---

## 2. Experiência do Usuário & Design Visual

### Fluxos Principais

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Aba Validação Fiscal                            │
├────────────────────────────────────────────────────────────────────────┤
│  [257 Erros do PVA Detectados]                [Corrigir Todos em Lote] │
│                                                                        │
│  ┌─ ERRO: 239 Itens com TIPO_ITEM não informado (Reg 0200) ──────────┐ │
│  │  Ato COTEPE 020 / Campo 07 obrigatório.                             │ │
│  │  [Auto-Preencher por CFOP: '07' Uso/Consumo, '00' Revenda]          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌─ ERRO: 14 Campos de Município Origem/Destino vazios no CT-e (D100) ┐ │
│  │  7 CT-es modelo 57 sem COD_MUN_ORIG / COD_MUN_DEST.                 │ │
│  │  [Preencher Municípios a partir do Participante / Chave]            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌─ ERRO: 2 Municípios vazios no Cadastro de Participantes (0150) ────┐ │
│  │  Participantes T248 e T3 sem COD_MUN IBGE informado.                │ │
│  │  [Preencher COD_MUN do Declarante / UF]                             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌─ ERRO: 2 CT-es com Participante Divergente da Chave (D100) ────────┐ │
│  │  Chave emitida por CNPJ 38027438000136 (T240), informado T3.       │ │
│  │  [Corrigir Participante para T240 Automaticamente]                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Alinhamento do Validador**: O validador do app passa a listar os exatos 257 erros identificados pelo PVA oficial, agrupados por natureza e severidade.
2. **Correção com 1 Clique**: Ao lado de cada grupo de inconsistência, há um botão de ação rápida que simula a correção, exibe o impacto e aplica as alterações no estado com registro no histórico de Undo (`Ctrl+Z`).
3. **Navegação com foco**: Clicar em qualquer erro leva diretamente ao registro e campo correspondente no Editor Tabular.

---

## 3. Principais Decisões de Produto & Arquitetura

### A. Regras Adicionadas ao Motor de Validação (`spedValidator.ts`)

1. **`REGRA_0200_TIPO_ITEM_OBRIGATORIO`** (PVA: Campo obrigatório):
   - Verifica se o campo 7 do registro 0200 (`TIPO_ITEM`) está preenchido com um código válido entre `00` e `99`. Gera `ERRO` para cada item vazio.
2. **`REGRA_D100_MUNICIPIOS_OBRIGATORIOS`** (PVA: Campo obrigatório para modelos 57, 63, 67):
   - Em registros D100 com `COD_MOD` in (`57`, `63`, `67`) e `IND_OPER = 0`, verifica se os campos 24 (`COD_MUN_ORIG`) e 25 (`COD_MUN_DEST`) estão preenchidos com 7 dígitos.
3. **`REGRA_0150_COD_MUN_BRASIL`** (PVA: Campo obrigatório para contribuintes domiciliados no Brasil):
   - No registro 0150, se `COD_PAIS = 1058` (ou vazio por padrão), exige que `COD_MUN` esteja preenchido.
4. **`REGRA_D100_CNPJ_CHAVE_PARTICIPANTE`** (PVA: O CNPJ/CPF da chave não confere com o participante):
   - Para D100 com chave de CT-e informada (44 dígitos), extrai o CNPJ das posições 7 a 20 e cruza com o CNPJ do `COD_PART` associado no 0150. Se divergente, acusa erro.

### B. Módulos de Correção Automática Guiada (`spedFiscalSync.ts`)

- **`fixMissingTipoItem0200(lines, defaultTipo = '07')`**:
  - Analisa a movimentação do item nos registros `C170` do arquivo. Se movimentado com CFOP `1556`/`2556` ou `1653`, classifica como `'07'` (Material para Uso e Consumo); se CFOP `1128`/`2128`, classifica como `'07'` ou `'01'`; caso sem movimentação, adota o tipo informado pelo usuário.
- **`fixMissingD100Municipios(lines)`**:
  - Extrai os municípios a partir da chave do CT-e (UF/código do emissor) ou busca o município cadastrado no participante emitente/destinatário para preencher os campos 24 e 25 do D100.
- **`fixMissing0150Municipios(lines)`**:
  - Para o participante `T3` (a própria empresa declarante), replica o `COD_MUN` do registro 0000 (`3204708`).
  - Para `T248` (transportadora), atribui o código do município com base no CEP ou UF.
- **`fixD100ParticipantFromKey(lines)`**:
  - Identifica o CNPJ `38027438000136` embutido na chave das notas 1383 e 1374, localiza o código do participante correspondente no 0150 (`T240` - Maluquinho Transportes) e substitui o código incorreto `T3` por `T240`.

---

## 4. Arquitetura Técnica & Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                 spedValidator.ts                            │
│  - Adição de REGRA_0200_TIPO_ITEM_OBRIGATORIO               │
│  - Adição de REGRA_D100_MUNICIPIOS_OBRIGATORIOS             │
│  - Adição de REGRA_0150_COD_MUN_BRASIL                      │
│  - Adição de REGRA_D100_CNPJ_CHAVE_PARTICIPANTE             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 spedFiscalSync.ts                           │
│  - fixMissingTipoItem0200()                                 │
│  - fixMissingD100Municipios()                               │
│  - fixMissing0150Municipios()                               │
│  - fixD100ParticipantMismatch()                             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 ValidationTab.tsx                           │
│  - Alertas com contadores sincronizados com o PVA (257)     │
│  - Botões de Auto-Correção e Drawer de Detalhes             │
└─────────────────────────────────────────────────────────────┘
```

---

## Plano de Verificação

1. **Compilação**:
   - `compile_applet` e `lint_applet` garantindo integridade TypeScript absoluta.
2. **Validação do Arquivo Real**:
   - Executar a validação no arquivo `TEC005202015102026022453_a5fc926f.txt`.
   - Confirmar que o total de erros apurado pelo validador é exatamente 257 (239 de 0200, 14 de D100, 2 de 0150 e 2 de CT-e).
3. **Teste da Correção em Lote**:
   - Disparar as correções automáticas e revalidar o arquivo, comprovando a redução de 257 erros para 0 erros, pronto para transmissão no PVA.

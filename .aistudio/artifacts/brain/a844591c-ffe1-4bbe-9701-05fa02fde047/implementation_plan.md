# Incorporação das Regras Oficiais do PVA SPED Fiscal no Validador

Moderniza o motor de validação do SPED Fiscal Editor Pro com a inteligência oficial extraída do descritor do PVA (Ato 020 / Estrutura 001 v2). O sistema passará a auditar a escrituração com as mesmas fórmulas matemáticas, cruzamentos inter-registros e mensagens do validador da Receita Federal, focando inicialmente nas apurações tributárias dos Blocos E e C e nas consistências produtivas do Bloco K.

## Decisões Confirmadas com o Usuário

> [!IMPORTANT]
> - **Integração Nativa**: As regras e consultas do PVA serão incorporadas diretamente no validador em TypeScript da aplicação, garantindo validação ultrarrápida no navegador (client-side) sem necessidade de banco de dados externo ou latência de rede.
> - **Escopo Priorizado**:
>   1. **Bloco E & Bloco C**: Somatórios da apuração de ICMS (E110/E111/E116), cruzamento analítico de notas fiscais (C100 vs C190 vs C170) e batimento de ajustes de documento (C197/C597/D197) com a apuração.
>   2. **Bloco K**: Consistência de datas de estoque (K200 vs K100), tipos válidos de insumo/produto (0200 vs K), segregação de produto resultante vs insumo consumido (K230 vs K235 e K250 vs K255) e posse de terceiros.
> - **Apresentação de Inconsistências**: Exibição destacada do identificador oficial da regra do PVA (ex: `REGRA_VL_TOT_DEBITOS_E110_17002_V1`) acompanhado da fundamentação oficial do PVA e de um card de orientação prática de retificação.

---

## 1. Visão Geral & Conceito

- **O que faz**: Eleva a precisão do validador do aplicativo ao nível oficial do PVA da Receita Federal/SEFAZ. Arquivos validados aqui terão garantia prévia de aprovação no PVA, eliminando surpresas na transmissão.
- **Público-Alvo**: Contadores, analistas fiscais, auditores tributários e desenvolvedores de integração contábil.
- **Valor Principal**: Diagnóstico antecipado com identificação do código exato da regra que o PVA dispararia, permitindo ao usuário navegar diretamente à linha do erro e compreender como corrigir a divergência.

---

## 2. Experiência do Usuário & Design Visual

### Fluxos Principais
1. **Auditoria com Regras PVA**: Ao carregar um arquivo SPED ou clicar em "Revalidar Arquivo", o motor executa as regras estruturais e de somatórios oficiais do PVA.
2. **Visualização Enriquecida da Inconsistência**:
   - Cada linha de inconsistência passa a exibir o identificador técnico oficial (ex: `REGRA_VL_TOT_DEBITOS_E110`) como um rótulo mono discreto.
   - Um botão expansível ou tooltip de ajuda mostra a "Orientação de Correção PVA" (ex: fórmula matemática esperada, diferença apurada em R$ e registros envolvidos).
3. **Filtro Rápido por Regra PVA**:
   - O campo de busca da aba de validação permite digitar diretamente o nome da regra (ex: `K235`, `E110`, `C190`) para isolar todas as divergências daquele teste específico.
4. **Navegação Direta e Autocorreção**:
   - Mantém atalhos de navegação para a linha exata no editor tabular e preserva os botões de autocorreção rápida onde aplicável.

### Disciplina Visual (Anti-Slop & Tipografia)
- Identificador da regra (`pvaRuleId`) em fonte mono limpa (`font-mono text-xs`), sem badges pill espalhafatosos, alinhado à esquerda na descrição da inconsistência.
- Separação sutil de blocos e valores calculados vs valores informados com formatação em moeda BRL (`R$ 1.250,00`).
- Destaque em tipografia técnica para campos fiscais envolvidos (`VL_TOT_DEBITOS`, `CFOP`, `CST_ICMS`).

---

## 3. Principais Decisões de Produto & Arquitetura

### A. Mapeamento das Queries SQL do PVA em Algoritmos TypeScript
- *Decisão*: Como o PVA executa queries SQL internas sobre tabelas relacionais (`reg_c100`, `reg_e110`, etc.), traduziremos a semântica dessas queries SQL fornecidas no JSON em agregações eficientes em memória na árvore de linhas do SPED.
- *Benefício*: Execução instantânea (em menos de 100ms para arquivos de 50.000 linhas) diretamente no browser sem criar dependência de WebAssembly SQLite ou requisições lentas a servidor.

### B. Catálogo Unificado de Metadados de Regras PVA
- *Decisão*: Criar uma base de dados de regras (`pvaRulesCatalog.ts`) contendo ID da regra, registro-alvo, severidade padrão, mensagem oficial e instruções de correção.
- *Benefício*: Permite reuso em múltiplos validadores, documentação contextual no frontend e fácil manutenção para futuras atualizações de leiaute.

### C. Regras Priorizadas de Apuração (Bloco E & C)
1. **`REGRA_VL_TOT_DEBITOS_E110_17002_V1`**:
   - Valida se `VL_TOT_DEBITOS` do registro `E110` é igual à soma do `VL_ICMS` dos registros analíticos (`C190`, `C320`, `C390`, `C490`, `C590`, `C690`, `C790`, `C890`, `D190`, `D300`, `D390`, `D410`, `D590`, `D690`, `D696`, `D730`, `D760`) para CFOPs de saída iniciados por 5, 6, 7 e CFOP 1605 (excluindo 5605).
2. **`REGRA_VL_TOT_CREDITOS_E110_17002_V1`**:
   - Valida se `VL_TOT_CREDITOS` do registro `E110` é igual à soma do `VL_ICMS` dos registros analíticos (`C190`, `C590`, `D190`, `D590`, `D730`) para CFOPs de entrada iniciados por 1 (exceto 1605), 2, 3 e CFOP 5605.
3. **`REGRA_SLD_DEVEDOR_E110` e `REGRA_SLD_CREDOR_E110`**:
   - Cálculo estrito: `(VL_TOT_DEBITOS + VL_AJ_DEBITOS + VL_TOT_AJ_DEBITOS + VL_ESTORNOS_CRED) - (VL_TOT_CREDITOS + VL_AJ_CREDITOS + VL_TOT_AJ_CREDITOS + VL_ESTORNOS_DEB + VL_SLD_CREDOR_ANT)`.
   - Se $> 0 \rightarrow VL\_SLD\_APURADO$; se $\le 0 \rightarrow VL\_SLD\_CREDOR\_TRANSPORTAR$.
4. **`REGRA_ICMS_RECOLHER`**:
   - Confere se `VL_ICMS_RECOLHER` = $\max(0, VL\_SLD\_APURADO - VL\_TOT\_DED)$.
5. **`REGRA_ICMS_REC_E116`**:
   - Confere se a soma de `VL_OR` de todos os registros `E116` vinculados ao `E110` é igual a `(VL_ICMS_RECOLHER + DEB_ESP)`.
6. **`REGRA_VL_MERC_C170` & `REGRA_VALIDA_DESC_DOC_ITEM`**:
   - O valor `VL_MERC` do `C100` deve ser $\ge$ soma de `VL_ITEM` dos filhos `C170` (com tolerância de arredondamento de R$ 0,02).
   - O valor `VL_DESC` do `C100` deve ser igual à soma de `VL_DESC` dos filhos `C170`.
7. **`REGRA_VL_BC_ICMS_ANALIT` e `REGRA_VL_ICMS_ANALIT`**:
   - Soma das bases e impostos dos registros analíticos `C190` batendo estritamente com `C100`.
8. **`REGRA_ALIQ_ICMS_C170`**:
   - Exige alíquota de ICMS $> 0$ quando os 2 últimos dígitos do CST forem 00, 10, 20 ou 70 para saídas normais.

### D. Regras Priorizadas de Controle da Produção e Estoque (Bloco K)
1. **`REGRA_DATA_FINAL_ESTOQUE`**:
   - No registro `K200`, o campo `DT_EST` deve ser exatamente igual ao campo `DT_FIN` do período `K100` pai.
2. **`REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K230`**:
   - O item consumido no `K235` deve ser obrigatoriamente diferente do item produzido resultante do registro pai `K230`.
3. **`REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K250`**:
   - O item consumido no `K255` deve ser obrigatoriamente diferente do item produzido em terceiro do registro pai `K250`.
4. **`REGRA_VALIDA_DT_SAIDA_ESTOQUE_ALOCACAO_PRODUTO`**:
   - A data de saída de insumo `K235.DT_SAIDA` deve estar compreendida entre `K230.DT_INI_OP` e `K230.DT_FIN_OP`.
5. **`REGRA_OBRIGATORIO_K235_V2`**:
   - Quando o tipo de leiaute `K010` for completo (`IND_TP_LEIAUTE = 1`), é obrigatória a existência de insumos `K235` para as ordens de produção concluídas no período.
6. **`REGRA_OBRIGATORIO_COD_PART_ESTOQUE` & `REGRA_NAO_INFORMAR_COD_PART_K200`**:
   - Se `IND_EST` for 1 (posse de terceiros) ou 2 (terceiros em posse da empresa), o campo `COD_PART` é obrigatório; se `IND_EST = 0`, é proibido informar `COD_PART`.
7. **`REGRA_VALIDA_COD_ITEM_TP_ITEM`**:
   - Itens informados no Bloco K devem possuir tipo cadastrado no `0200` compatível com insumo/produto (00, 01, 02, 03, 04, 05, 10).

---

## 4. Arquitetura Técnica & Estrutura de Dados

### Diagrama do Sistema de Validação

```
┌─────────────────────────────────────────────────────────────┐
│                 SPED Fiscal Editor Pro                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────┐         ┌───────────────────────────┐
│     pvaRulesCatalog.ts    │         │      spedValidator.ts     │
│ - Definições das Regras   │         │ - Motor de Validação      │
│ - Mensagens Oficiais PVA  │◄────────┤ - Agregações Bloco E / C  │
│ - Orientações de Correção │         │ - Consistência Bloco K    │
└───────────────────────────┘         └─────────────┬─────────────┘
                                                    │
                                                    ▼
                                      ┌───────────────────────────┐
                                      │    ValidationIssue[]      │
                                      │ + pvaRuleId               │
                                      │ + pvaGuidance             │
                                      │ + calculatedValue vs real │
                                      └─────────────┬─────────────┘
                                                    │
                                                    ▼
                                      ┌───────────────────────────┐
                                      │    ValidationTab.tsx      │
                                      │ - Tabela de inconsistênc. │
                                      │ - Badge da Regra PVA      │
                                      │ - Drawer/Card de Ajuda    │
                                      │ - Filtro por Regra PVA    │
                                      └───────────────────────────┘
```

### Mapeamento de Estado e Modelos
- **`ValidationIssue`** (atualizado):
  - `pvaRuleId?: string` (código da regra, ex: `REGRA_VL_TOT_DEBITOS_E110_17002_V1`).
  - `pvaGuidance?: string` (orientação de cálculo e correção do PVA).
  - `difference?: { expected: number; found: number }` (valores comparados quando há divergência de somatório).

---

## Plano de Verificação

1. **Compilação e Tipagem**:
   - Executar `compile_applet` para garantir TypeScript limpo sem quebras de contrato.
2. **Teste com Amostras do SPED**:
   - Validar o arquivo de amostra `public/samples/sample_sped.txt`.
   - Testar arquivos com divergências intencionais de somatório no E110 e conferir se o código da regra `REGRA_VL_TOT_DEBITOS_E110_17002_V1` e os valores apurados aparecem corretamente.
   - Testar validações do Bloco K (K200 com data divergente e K235 com mesmo código de item do K230).
3. **Inspeção de UI**:
   - Testar filtro por texto de regra na aba de Validações (`ValidationTab`).
   - Conferir legibilidade e ergonomia visual no Tema Claro e no Tema Escuro.

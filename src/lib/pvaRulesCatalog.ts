/**
 * Catálogo Oficial de Regras de Validação do PVA SPED Fiscal (EFD ICMS/IPI)
 * Baseado no descritor oficial Ato COTEPE 020 / Estrutura 001 v2
 */

export interface PvaRuleDefinition {
  id: string;
  record: string;
  field?: string;
  name: string;
  officialMessage: string;
  guidance: string;
  solution: string;
  formula?: string;
  category: 'APURACAO_ICMS' | 'DOCUMENTO_FISCAL' | 'BLOCO_K' | 'CADASTRO' | 'OUTROS';
}

export const PVA_RULES_CATALOG: Record<string, PvaRuleDefinition> = {
  // ==========================================================================
  // BLOCO E: APURAÇÃO DO ICMS OPERAÇÕES PRÓPRIAS (E100 / E110 / E111 / E116)
  // ==========================================================================
  REGRA_VL_TOT_DEBITOS_E110_17002_V1: {
    id: 'REGRA_VL_TOT_DEBITOS_E110_17002_V1',
    record: 'E110',
    field: 'VL_TOT_DEBITOS',
    name: 'Total dos Débitos de ICMS por Saídas/Prestações',
    officialMessage:
      'O valor deve ser igual à soma do campo VL_ICMS dos registros (C190, C320, C390, C490, C590, C690, C790, C890, D190, D300, D390, D410, D590, D690, D696, D730, D760) para CFOP iniciado por 5, 6, 7 e CFOP 1605.',
    guidance:
      'O campo 02 (VL_TOT_DEBITOS) do registro E110 deve bater rigorosamente com a soma do ICMS destacado nas saídas (CFOP 5.xxx, 6.xxx, 7.xxx e 1.605, exceto 5.605).',
    solution:
      'Atualize o campo VL_TOT_DEBITOS do registro E110 com a soma exata do ICMS das notas e documentos de saída do período.',
    formula: 'VL_TOT_DEBITOS = Σ(VL_ICMS analíticos de saídas)',
    category: 'APURACAO_ICMS'
  },

  REGRA_VL_TOT_CREDITOS_E110_17002_V1: {
    id: 'REGRA_VL_TOT_CREDITOS_E110_17002_V1',
    record: 'E110',
    field: 'VL_TOT_CREDITOS',
    name: 'Total dos Créditos de ICMS por Entradas/Aquisições',
    officialMessage:
      'O valor deve ser igual à soma do campo VL_ICMS dos registros (C190, C590, D190, D590, D730) para CFOP iniciado por 1 (exceto 1605), 2, 3 e CFOP 5605.',
    guidance:
      'O campo 06 (VL_TOT_CREDITOS) do registro E110 deve coincidir com a soma do ICMS creditado nas entradas (CFOP 1.xxx exceto 1.605, 2.xxx, 3.xxx e 5.605).',
    solution:
      'Verifique se todas as notas de entrada foram escrituradas no analítico (C190/D190) e ajuste o valor total de créditos no E110.',
    formula: 'VL_TOT_CREDITOS = Σ(VL_ICMS analíticos de entradas)',
    category: 'APURACAO_ICMS'
  },

  REGRA_SLD_DEVEDOR_E110: {
    id: 'REGRA_SLD_DEVEDOR_E110',
    record: 'E110',
    field: 'VL_SLD_APURADO',
    name: 'Cálculo do Saldo Devedor Apurado no Período',
    officialMessage: 'Saldo devedor de ICMS apurado incorretamente.',
    guidance:
      'O valor de saldo devedor apurado antes das deduções (VL_SLD_APURADO) deve obedecer à fórmula oficial: (Débitos + Ajustes a Débito + Estornos de Crédito) - (Créditos + Ajustes a Crédito + Estornos de Débito + Saldo Credor Anterior). Se o saldo for negativo ou nulo, o campo deve ser 0,00.',
    solution:
      'Recalcule a equação da apuração e informe zero caso os créditos superem os débitos.',
    formula:
      'VL_SLD_APURADO = max(0, (VL_TOT_DEBITOS + VL_AJ_DEBITOS + VL_TOT_AJ_DEBITOS + VL_ESTORNOS_CRED) - (VL_TOT_CREDITOS + VL_AJ_CREDITOS + VL_TOT_AJ_CREDITOS + VL_ESTORNOS_DEB + VL_SLD_CREDOR_ANT))',
    category: 'APURACAO_ICMS'
  },

  REGRA_SLD_CREDOR_E110: {
    id: 'REGRA_SLD_CREDOR_E110',
    record: 'E110',
    field: 'VL_SLD_CREDOR_TRANSPORTAR',
    name: 'Cálculo do Saldo Credor a Transportar',
    officialMessage: 'Saldo credor de ICMS apurado incorretamente.',
    guidance:
      'O valor do saldo credor a transportar para o período seguinte (VL_SLD_CREDOR_TRANSPORTAR) deve ser apurado quando a soma de créditos supera a soma de débitos.',
    solution:
      'Informe zero se a apuração resultou em saldo devedor, ou o valor da diferença positiva entre créditos e débitos.',
    formula:
      'VL_SLD_CREDOR_TRANSPORTAR = max(0, (VL_TOT_CREDITOS + VL_AJ_CREDITOS + VL_TOT_AJ_CREDITOS + VL_ESTORNOS_DEB + VL_SLD_CREDOR_ANT) - (VL_TOT_DEBITOS + VL_AJ_DEBITOS + VL_TOT_AJ_DEBITOS + VL_ESTORNOS_CRED))',
    category: 'APURACAO_ICMS'
  },

  REGRA_ICMS_RECOLHER: {
    id: 'REGRA_ICMS_RECOLHER',
    record: 'E110',
    field: 'VL_ICMS_RECOLHER',
    name: 'Cálculo do ICMS a Recolher',
    officialMessage:
      'O campo "Valor total de ICMS a recolher" deve ser igual ao campo "Valor total de saldo devedor antes das deduções" menos o campo "Valor total de deduções", caso o resultado seja maior que zero; ou ZERO, caso contrário.',
    guidance:
      'O campo 13 (VL_ICMS_RECOLHER) é o saldo devedor menos as deduções (E111 com finalidade dedução). Não pode ser negativo.',
    solution:
      'Ajuste o campo VL_ICMS_RECOLHER para VL_SLD_APURADO - VL_TOT_DED, ou 0,00 se o resultado for menor ou igual a zero.',
    formula: 'VL_ICMS_RECOLHER = max(0, VL_SLD_APURADO - VL_TOT_DED)',
    category: 'APURACAO_ICMS'
  },

  REGRA_VALIDA_VL_TOT_DED_E110: {
    id: 'REGRA_VALIDA_VL_TOT_DED_E110',
    record: 'E110',
    field: 'VL_TOT_DED',
    name: 'Limite do Valor Total de Deduções',
    officialMessage:
      'O valor informado neste campo é maior que o valor do saldo devedor apurado (VL_SLD_APURADO) do Registro E110.',
    guidance:
      'O total de deduções da apuração (campo 12 VL_TOT_DED) não pode ultrapassar o valor do saldo devedor apurado (campo 11 VL_SLD_APURADO).',
    solution:
      'Limite o valor de deduções do E110 ao valor do saldo devedor apurado ou transfira o excesso conforme a legislação do seu estado.',
    category: 'APURACAO_ICMS'
  },

  REGRA_ICMS_REC_E116: {
    id: 'REGRA_ICMS_REC_E116',
    record: 'E116',
    field: 'VL_OR',
    name: 'Batimento das Obrigações a Recolher (E116 vs E110)',
    officialMessage:
      'O somatório dos campos "Valor da obrigação a recolher" dos registros E116 não é igual à soma dos campos "Valor total de ICMS a recolher" e "Valores recolhidos ou a recolher, extra-apuração" do registro E110.',
    guidance:
      'A soma de VL_OR de todos os registros filhos E116 deve corresponder exatamente à soma de VL_ICMS_RECOLHER + DEB_ESP do registro pai E110.',
    solution:
      'Cadastre ou ajuste os registros E116 para que o total das guias de recolhimento feche com o saldo a recolher do E110.',
    formula: 'Σ(E116.VL_OR) = E110.VL_ICMS_RECOLHER + E110.DEB_ESP',
    category: 'APURACAO_ICMS'
  },

  REGRA_VL_ESTORNOS_CRED_E110: {
    id: 'REGRA_VL_ESTORNOS_CRED_E110',
    record: 'E110',
    field: 'VL_ESTORNOS_CRED',
    name: 'Estornos de Créditos da Apuração',
    officialMessage:
      'O valor deve corresponder à soma dos valores de ajustes do registro E111, quando o ajuste for referente a estorno de créditos.',
    guidance:
      'O campo VL_ESTORNOS_CRED do E110 deve ser igual à soma de VL_AJ_APUR dos registros E111 cujo código de ajuste COD_AJ_APUR possua o 3º dígito = "0" e o 4º dígito = "1".',
    solution:
      'Ajuste o campo 05 do E110 para coincidir com a soma dos registros E111 de estorno de crédito.',
    category: 'APURACAO_ICMS'
  },

  REGRA_VL_ESTORNOS_DEB_E110: {
    id: 'REGRA_VL_ESTORNOS_DEB_E110',
    record: 'E110',
    field: 'VL_ESTORNOS_DEB',
    name: 'Estornos de Débitos da Apuração',
    officialMessage:
      'O valor deve corresponder à soma dos valores de ajustes do registro E111, quando o ajuste for referente a estorno de débitos.',
    guidance:
      'O campo VL_ESTORNOS_DEB do E110 deve ser igual à soma de VL_AJ_APUR dos registros E111 cujo código de ajuste COD_AJ_APUR possua o 3º dígito = "0" e o 4º dígito = "3".',
    solution:
      'Ajuste o campo 09 do E110 para coincidir com a soma dos registros E111 de estorno de débito.',
    category: 'APURACAO_ICMS'
  },

  REGRA_VL_TOT_AJ_DEBITOS_E110: {
    id: 'REGRA_VL_TOT_AJ_DEBITOS_E110',
    record: 'E110',
    field: 'VL_TOT_AJ_DEBITOS',
    name: 'Total dos Ajustes a Débito na Apuração',
    officialMessage:
      'O valor deve corresponder à soma dos valores de ajustes do registro E111, quando o ajuste for referente a outros débitos.',
    guidance:
      'O campo VL_TOT_AJ_DEBITOS deve ser igual à soma dos registros E111 onde o código possui 3º dígito = "0" e 4º dígito = "0".',
    solution:
      'Conferir a soma de outros débitos nos registros E111 e atualizar o campo 04 do E110.',
    category: 'APURACAO_ICMS'
  },

  REGRA_VL_TOT_AJ_CREDITOS_E110: {
    id: 'REGRA_VL_TOT_AJ_CREDITOS_E110',
    record: 'E110',
    field: 'VL_TOT_AJ_CREDITOS',
    name: 'Total dos Ajustes a Crédito na Apuração',
    officialMessage:
      'O valor deve corresponder à soma dos valores de ajustes do registro E111, quando o ajuste for referente a outros créditos.',
    guidance:
      'O campo VL_TOT_AJ_CREDITOS deve ser igual à soma dos registros E111 onde o código possui 3º dígito = "0" e 4º dígito = "2".',
    solution:
      'Conferir a soma de outros créditos nos registros E111 e atualizar o campo 08 do E110.',
    category: 'APURACAO_ICMS'
  },

  REGRA_TOT_VL_AJ_ITEM_E113: {
    id: 'REGRA_TOT_VL_AJ_ITEM_E113',
    record: 'E111',
    field: 'VL_AJ_APUR',
    name: 'Batimento de Ajuste da Apuração com Itens de Documentos (E111 vs E113)',
    officialMessage:
      'O valor do ajuste da operação (VL_AJ_APUR) deve ser igual à soma dos valores do ajuste para a operação/item (VL_AJ_ITEM) do registro E113.',
    guidance:
      'Quando o registro E111 possuir registros filhos E113 de detalhamento, a soma de VL_AJ_ITEM em E113 deve bater exatamente com VL_AJ_APUR do E111 pai.',
    solution:
      'Ajuste o valor do E111 ou revise os valores informados nos registros filhos E113.',
    formula: 'E111.VL_AJ_APUR = Σ(E113.VL_AJ_ITEM)',
    category: 'APURACAO_ICMS'
  },

  // ==========================================================================
  // BLOCO C: DOCUMENTOS FISCAIS DE MERCADORIAS (C100 / C170 / C190)
  // ==========================================================================
  REGRA_VL_MERC_C170: {
    id: 'REGRA_VL_MERC_C170',
    record: 'C100',
    field: 'VL_MERC',
    name: 'Valor das Mercadorias versus Soma dos Itens',
    officialMessage:
      'O valor das mercadorias (VL_MERC do Registro C100) deve ser maior ou igual à soma dos valores dos itens dos Registros C170.',
    guidance:
      'No documento fiscal C100, o campo 16 (VL_MERC) deve ser maior ou igual à soma do campo 07 (VL_ITEM) de todos os itens C170 pertencentes a essa nota.',
    solution:
      'Corrija o somatório de itens C170 ou atualize o campo VL_MERC do cabeçalho C100.',
    formula: 'C100.VL_MERC >= Σ(C170.VL_ITEM)',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_VALIDA_DESC_DOC_ITEM: {
    id: 'REGRA_VALIDA_DESC_DOC_ITEM',
    record: 'C100',
    field: 'VL_DESC',
    name: 'Valor do Desconto do Documento versus Soma dos Itens',
    officialMessage:
      'O valor total do desconto deve ser igual à soma dos valores de desconto comercial de cada item (VL_DESC do Registro C170).',
    guidance:
      'O campo 14 (VL_DESC) do registro C100 deve ser igual à soma dos descontos dos itens C170 vinculados à nota fiscal.',
    solution:
      'Atualize o campo VL_DESC do cabeçalho C100 para coincidir com a soma de VL_DESC dos itens C170.',
    formula: 'C100.VL_DESC = Σ(C170.VL_DESC)',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_VL_BC_ICMS_ANALIT: {
    id: 'REGRA_VL_BC_ICMS_ANALIT',
    record: 'C100',
    field: 'VL_BC_ICMS',
    name: 'Base de Cálculo de ICMS no Cabeçalho vs Analítico',
    officialMessage:
      'Valor inválido. A soma do campo VL_BC_ICMS dos registros analíticos (C190) deve ser igual ao campo VL_BC_ICMS do documento mestre (C100).',
    guidance:
      'A base de cálculo de ICMS destacada no cabeçalho C100 deve ser exatamente igual à soma das bases de cálculo distribuídas nos registros analíticos C190.',
    solution:
      'Verifique os valores de VL_BC_ICMS dos registros C190 e garanta que o somatório confere com o C100.',
    formula: 'C100.VL_BC_ICMS = Σ(C190.VL_BC_ICMS)',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_VL_ICMS_ANALIT: {
    id: 'REGRA_VL_ICMS_ANALIT',
    record: 'C100',
    field: 'VL_ICMS',
    name: 'Valor do ICMS no Cabeçalho vs Analítico',
    officialMessage:
      'Valor inválido. A soma do campo VL_ICMS dos registros analíticos (C190) deve ser igual ao campo VL_ICMS do documento mestre (C100).',
    guidance:
      'O imposto ICMS destacado no cabeçalho C100 deve ser idêntico à soma de VL_ICMS dos registros analíticos C190 vinculados à nota.',
    solution:
      'Ajuste o valor do ICMS no C100 ou confira a distribuição tributária nos registros C190.',
    formula: 'C100.VL_ICMS = Σ(C190.VL_ICMS)',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_VL_BC_ICMS_ST_ANALIT: {
    id: 'REGRA_VL_BC_ICMS_ST_ANALIT',
    record: 'C100',
    field: 'VL_BC_ICMS_ST',
    name: 'Base de Cálculo ICMS-ST no Cabeçalho vs Analítico',
    officialMessage:
      'Valor inválido. A soma do campo VL_BC_ICMS_ST dos registros analíticos (C190) deve ser igual ao campo VL_BC_ICMS_ST do documento mestre (C100).',
    guidance:
      'A soma de VL_BC_ICMS_ST dos registros analíticos C190 deve ser igual ao campo VL_BC_ICMS_ST do documento C100 pai.',
    solution: 'Acerte a base de substituição tributária no registro C100 ou nos registros C190.',
    formula: 'C100.VL_BC_ICMS_ST = Σ(C190.VL_BC_ICMS_ST)',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_VL_ICMS_ST_ANALIT: {
    id: 'REGRA_VL_ICMS_ST_ANALIT',
    record: 'C100',
    field: 'VL_ICMS_ST',
    name: 'Valor do ICMS-ST no Cabeçalho vs Analítico',
    officialMessage:
      'Valor inválido. A soma do campo VL_ICMS_ST dos registros analíticos (C190) deve ser igual ao campo VL_ICMS_ST do documento mestre (C100).',
    guidance:
      'O valor de ICMS retido por ST informado no cabeçalho da nota (C100) deve corresponder à soma do ICMS ST nos registros analíticos C190.',
    solution: 'Equalize os campos de ICMS ST entre o C100 e seus analíticos C190.',
    formula: 'C100.VL_ICMS_ST = Σ(C190.VL_ICMS_ST)',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_VL_IPI_C190: {
    id: 'REGRA_VL_IPI_C190',
    record: 'C100',
    field: 'VL_IPI',
    name: 'Valor do IPI no Cabeçalho vs Analítico',
    officialMessage:
      'A soma dos valores de IPI do registro C190 deverá ser igual ao valor informado no campo valor total do IPI (VL_IPI) dos registros C100.',
    guidance:
      'O IPI destacado no documento fiscal C100 deve ser igual à soma de VL_IPI de todos os registros analíticos C190.',
    solution: 'Ajuste o valor do IPI no C100 ou no somatório dos C190.',
    formula: 'C100.VL_IPI = Σ(C190.VL_IPI)',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_ALIQ_ICMS_C170: {
    id: 'REGRA_ALIQ_ICMS_C170',
    record: 'C170',
    field: 'ALIQ_ICMS',
    name: 'Alíquota de ICMS Obrigatória conforme CST',
    officialMessage:
      'Se os dois últimos dígitos do CST_ICMS = 00, 10, 20 ou 70, preencher com valor maior que Zero o campo: ALIQ_ICMS.',
    guidance:
      'Para operações de saída regulares e tributadas com CST terminado em 00, 10, 20 ou 70, a alíquota de ICMS deve ser estritamente maior que 0%.',
    solution:
      'Informe a alíquota aplicável da operação ou corrija o CST para uma tributação isenta/não tributada se for o caso.',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_CFOP_C100: {
    id: 'REGRA_CFOP_C100',
    record: 'C170',
    field: 'CFOP',
    name: 'Coerência de CFOP com Indicador de Operação',
    officialMessage:
      'CFOP inválido. Utilizar CFOP com primeiro caracter = 1, 2 ou 3, quando for operação de entrada, e CFOP com primeiro caracter = 5, 6 ou 7, quando for operação de saída.',
    guidance:
      'O 1º dígito do CFOP deve ser compatível com IND_OPER do cabeçalho C100 (0 para entrada -> 1/2/3; 1 para saída -> 5/6/7).',
    solution:
      'Corrija o CFOP do item ou altere o indicador de operação (IND_OPER) no registro C100.',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_CFOP_NFCE: {
    id: 'REGRA_CFOP_NFCE',
    record: 'C190',
    field: 'CFOP',
    name: 'CFOP Exclusivo de Operação Interna em NFC-e',
    officialMessage: 'CFOP inválido. O primeiro caractere do CFOP deve ser igual a "5".',
    guidance:
      'Em NFC-e (modelo 65), a operação é restrita ao consumidor final interno no estado, logo o CFOP deve iniciar obrigatoriamente por 5.',
    solution: 'Altere o CFOP no analítico C190 para um código do grupo 5.xxx.',
    category: 'DOCUMENTO_FISCAL'
  },

  // ==========================================================================
  // BLOCO K: CONTROLE DA PRODUÇÃO E DO ESTOQUE (K100 / K200 / K230 / K235...)
  // ==========================================================================
  REGRA_DATA_FINAL_ESTOQUE: {
    id: 'REGRA_DATA_FINAL_ESTOQUE',
    record: 'K200',
    field: 'DT_EST',
    name: 'Data do Estoque Final Escriturado',
    officialMessage:
      'O campo data do estoque final deve ser igual à data final do período de apuração - campo DT_FIN do Registro K100.',
    guidance:
      'No registro K200, a data do estoque (campo 02 DT_EST) deve ser exatamente igual à data final informada no registro pai K100 (DT_FIN).',
    solution:
      'Alinhe a data DT_EST de todas as linhas K200 com a data final do período de apuração em K100.',
    formula: 'K200.DT_EST = K100.DT_FIN',
    category: 'BLOCO_K'
  },

  REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K230: {
    id: 'REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K230',
    record: 'K235',
    field: 'COD_ITEM',
    name: 'Insumo Consumido Divergente do Produto Resultante',
    officialMessage:
      'O valor informado nesse campo deve ser diferente do valor informado no campo COD_ITEM do Registro Pai.',
    guidance:
      'O insumo consumido em K235 não pode ter o mesmo código do produto acabado resultante apontado no registro pai K230 da ordem de produção.',
    solution:
      'Verifique a estrutura do produto (BOM/Ficha Técnica) e corrija o código do insumo consumido ou do item fabricado.',
    formula: 'K235.COD_ITEM != K230.COD_ITEM',
    category: 'BLOCO_K'
  },

  REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K250: {
    id: 'REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K250',
    record: 'K255',
    field: 'COD_ITEM',
    name: 'Insumo Consumido em Terceiro Divergente do Produzido',
    officialMessage:
      'O valor informado nesse campo deve ser diferente do valor informado no campo COD_ITEM do Registro Pai.',
    guidance:
      'Na industrialização em terceiros, o insumo consumido (K255) não pode ter o mesmo código do produto fabricado resultante (K250).',
    solution: 'Corrija o código do insumo consumido no K255 ou o item resultante no K250.',
    formula: 'K255.COD_ITEM != K250.COD_ITEM',
    category: 'BLOCO_K'
  },

  REGRA_VALIDA_DT_SAIDA_ESTOQUE_ALOCACAO_PRODUTO: {
    id: 'REGRA_VALIDA_DT_SAIDA_ESTOQUE_ALOCACAO_PRODUTO',
    record: 'K235',
    field: 'DT_SAIDA',
    name: 'Data de Saída do Insumo dentro do Período da Ordem de Produção',
    officialMessage:
      'O campo DT_SAIDA deve estar compreendido no período da ordem de produção. Caso não tenha sido informada a data final da produção, esse campo deve ser maior ou igual a DT_INI_OP.',
    guidance:
      'A data em que o insumo saiu do estoque (K235.DT_SAIDA) deve estar entre a data de início (DT_INI_OP) e a data de conclusão (DT_FIN_OP) da ordem de produção do registro pai K230.',
    solution:
      'Ajuste a data de requisição do insumo no K235 para coincidir com o intervalo da OP informada.',
    category: 'BLOCO_K'
  },

  REGRA_OBRIGATORIO_K235_V2: {
    id: 'REGRA_OBRIGATORIO_K235_V2',
    record: 'K230',
    field: 'REG',
    name: 'Obrigatoriedade de Insumos Consumidos em Leiaute Completo',
    officialMessage:
      'O Registro K235 é de preenchimento obrigatório quando o campo IND_TP_LEIAUTE do Registro K010 for igual a "1" (Completo) e a ordem de produção estiver finalizada.',
    guidance:
      'Se o informante adota o leiaute completo do Bloco K (K010 = 1), não é permitido registrar ordem de produção (K230) concluída sem detalhar os insumos consumidos (K235).',
    solution:
      'Adicione os insumos consumidos no registro K235 ou altere o tipo de leiaute se sua empresa estiver dispensada do Bloco K completo.',
    category: 'BLOCO_K'
  },

  REGRA_OBRIGATORIO_COD_PART_ESTOQUE: {
    id: 'REGRA_OBRIGATORIO_COD_PART_ESTOQUE',
    record: 'K200',
    field: 'COD_PART',
    name: 'Obrigatoriedade do Participante para Estoque em Poder de Terceiros',
    officialMessage: 'O campo é obrigatório quando o IND_EST for "1" ou "2".',
    guidance:
      'Quando o indicador de posse do estoque for 1 (mercadoria própria em posse de terceiros) ou 2 (mercadoria de terceiros em nossa posse), o código do terceiro (COD_PART) é mandatório.',
    solution:
      'Informe o código do participante correspondente no campo 06 do registro K200.',
    category: 'BLOCO_K'
  },

  REGRA_NAO_INFORMAR_COD_PART_K200: {
    id: 'REGRA_NAO_INFORMAR_COD_PART_K200',
    record: 'K200',
    field: 'COD_PART',
    name: 'Proibição de Participante para Estoque Próprio em Poder Próprio',
    officialMessage:
      'O campo COD_PART não pode ser informado para "Estoque de propriedade do informante e em seu poder" (IND_EST igual a 0).',
    guidance:
      'Se a mercadoria é própria e está nas dependências da própria empresa (IND_EST = 0), o campo COD_PART deve permanecer vazio.',
    solution: 'Deixe o campo 06 do K200 vazio quando IND_EST for igual a 0.',
    category: 'BLOCO_K'
  },

  REGRA_VALIDA_COD_ITEM_TP_ITEM: {
    id: 'REGRA_VALIDA_COD_ITEM_TP_ITEM',
    record: 'K200',
    field: 'COD_ITEM',
    name: 'Tipo de Item Válido para Produção e Estoque',
    officialMessage:
      'O campo somente pode ser informado com COD_ITEM cujo campo TIPO_ITEM possua valores iguais a 00, 01, 02, 03, 04, 05 ou 10.',
    guidance:
      'Os registros de estoque e produção do Bloco K só aceitam itens de mercadoria/insumo/produto (tipos 00, 01, 02, 03, 04, 05 e 10). Não são permitidos itens do tipo 07 (Uso/Consumo), 08 (Ativo Imobilizado) ou 09 (Serviços).',
    solution:
      'Verifique o cadastro do item no registro 0200 e corrija o tipo do item (TIPO_ITEM).',
    category: 'BLOCO_K'
  },

  REGRA_COD_ITEM_K291_K292: {
    id: 'REGRA_COD_ITEM_K291_K292',
    record: 'K292',
    field: 'COD_ITEM',
    name: 'Item Produzido vs Insumo na Produção Conjunta',
    officialMessage:
      'O valor informado no campo COD_ITEM do Registro K292 deve ser diferente dos campos COD_ITEM informados no Registro K291.',
    guidance:
      'Na produção conjunta (K290), um mesmo código de item não pode figurar simultaneamente como produto resultante (K291) e como insumo consumido (K292).',
    solution: 'Revise os códigos apontados nos registros K291 e K292 da produção conjunta.',
    category: 'BLOCO_K'
  },

  REGRA_0200_TIPO_ITEM_OBRIGATORIO: {
    id: 'REGRA_0200_TIPO_ITEM_OBRIGATORIO',
    record: '0200',
    field: 'TIPO_ITEM',
    name: 'Tipo do Item Obrigatório no Registro 0200',
    officialMessage: 'Campo obrigatório.',
    guidance:
      'O campo 07 (TIPO_ITEM) do registro 0200 é de preenchimento obrigatório pelo Guia Prático da EFD e pelo PVA. Deve conter um dos valores válidos da tabela oficial: 00 (Mercadoria para Revenda), 01 (Matéria-Prima), 02 (Embalagem), 03 (Produto em Processo), 04 (Produto Acabado), 05 (Subproduto), 06 (Produto Intermediário), 07 (Material de Uso e Consumo), 08 (Ativo Imobilizado), 09 (Serviços), 10 (Outros Insumos) ou 99 (Outras).',
    solution:
      'Preencha o campo TIPO_ITEM no registro 0200 com a classificação correspondente ao item.',
    category: 'CADASTRO'
  },

  REGRA_D100_MUNICIPIOS_OBRIGATORIOS: {
    id: 'REGRA_D100_MUNICIPIOS_OBRIGATORIOS',
    record: 'D100',
    field: 'COD_MUN_ORIG / COD_MUN_DEST',
    name: 'Município de Origem e Destino do Transporte no D100',
    officialMessage:
      'Para documentos de entrada (IND_OPER=0), o preenchimento do campo é obrigatório se "COD_MOD" for igual a "57", "63" ou "67".',
    guidance:
      'No registro D100 referente a Conhecimento de Transporte Eletrônico (CT-e, modelo 57) de entrada (aquisição de serviço de frete), os campos 24 (COD_MUN_ORIG) e 25 (COD_MUN_DEST) devem ser obrigatoriamente preenchidos com os códigos IBGE de 7 dígitos dos municípios de início e término da prestação do serviço.',
    solution:
      'Informe os códigos IBGE dos municípios de origem e destino da prestação de transporte nos campos 24 e 25 do registro D100.',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_0150_COD_MUN_BRASIL: {
    id: 'REGRA_0150_COD_MUN_BRASIL',
    record: '0150',
    field: 'COD_MUN',
    name: 'Código do Município IBGE para Participante no Brasil',
    officialMessage: 'Campo obrigatório para contribuintes domiciliados no Brasil.',
    guidance:
      'No registro 0150, para qualquer participante domiciliado no Brasil (COD_PAIS igual a 1058 ou omitido), o preenchimento do código do município IBGE (campo 08 - COD_MUN) é estritamente obrigatório e deve possuir 7 dígitos.',
    solution:
      'Informe o código do município do IBGE (7 dígitos) correspondente à cidade do participante no registro 0150.',
    category: 'CADASTRO'
  },

  REGRA_D100_CNPJ_CHAVE_PARTICIPANTE: {
    id: 'REGRA_D100_CNPJ_CHAVE_PARTICIPANTE',
    record: 'D100',
    field: 'CHV_CTE',
    name: 'Conferência do CNPJ do Emitente da Chave com o Participante',
    officialMessage:
      'O CNPJ/CPF da chave do documento eletrônico não confere com o CNPJ/CPF do participante informado.',
    guidance:
      'Os dígitos da posição 7 a 20 da chave do CT-e de 44 dígitos representam o CNPJ da transportadora emitente do documento fiscal. Esse CNPJ deve ser idêntico ao CNPJ cadastrado no registro 0150 para o código de participante (COD_PART) informado no registro D100.',
    solution:
      'Corrija o código do participante (COD_PART) no registro D100 para apontar para a transportadora emissora do CT-e, ou corrija o CNPJ cadastrado no registro 0150.',
    category: 'DOCUMENTO_FISCAL'
  },

  REGRA_0150_SEM_MOVIMENTO: {
    id: 'REGRA_0150_SEM_MOVIMENTO',
    record: '0150',
    field: 'COD_PART',
    name: 'Participante não Referenciado na Escrituração',
    officialMessage: 'Não informar participante, se não referenciado em pelo menos um dos demais blocos.',
    guidance:
      'Pelo Guia Prático da EFD e validador do PVA, o registro 0150 só deve conter participantes que foram efetivamente referenciados em registros de documentos fiscais (Blocos C, D) ou de estoque/produção (Blocos H, K). Participantes cadastrados sem qualquer movimentação no período geram erro impeditivo de validação.',
    solution:
      'Remova o participante não movimentado do registro 0150 ou vincule-o ao documento fiscal correspondente.',
    category: 'CADASTRO'
  },

  REGRA_ALIQ_ICMS_C170_SIMPLES: {
    id: 'REGRA_ALIQ_ICMS_C170_SIMPLES',
    record: 'C170',
    field: 'ALIQ_ICMS',
    name: 'Alíquota de ICMS em Documento de Entrada (Simples Nacional / CST 102)',
    officialMessage:
      'Contribuintes optantes pelo Simples Nacional devem desconsiderar essa advertência. Se o campo IND_OPER do registro C100 for igual a 0(zero) e se os dois últimos caracteres do CST_ICMS forem 02 ou 15, o campo ALIQ_ICMS deve ser maior que 0 (zero).',
    guidance:
      'No PVA, códigos de CST terminados em 02 ou 15 ativam a regra de validação de alíquota ad rem dos combustíveis. Quando um item é escriturado com CSOSN 102 (Simples Nacional sem crédito) e alíquota 0,00, o PVA emite esta advertência ressaltando que optantes pelo Simples Nacional podem desconsiderá-la. Para eliminar completamente o aviso no PVA, pode-se padronizar o CST para 090 ou 900.',
    solution:
      'Trata-se de uma advertência que não impede a transmissão. Se desejar zerar os avisos, padronize o CST do item para 900 ou 090.',
    category: 'DOCUMENTO_FISCAL'
  }
};

/**
 * Retorna a definição da regra oficial do PVA por ID
 */
export function getPvaRule(ruleId: string): PvaRuleDefinition | undefined {
  return PVA_RULES_CATALOG[ruleId];
}

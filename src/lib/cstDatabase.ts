/**
 * Catálogo e banco de dados de Códigos de Situação Tributária (CST) do ICMS,
 * incluindo Regime Normal, CSOSN (Simples Nacional) e ICMS Monofásico de Combustíveis (LC 192/2022).
 */

export interface CstDefinition {
  code: string;
  shortDesc: string;
  fullDesc: string;
  category: 'ICMS_NORMAL' | 'ICMS_MONOFASICO' | 'CSOSN';
  legalBase: string;
  permiteCredito?: boolean;
  exigeStZero?: boolean;
  observacao?: string;
}

export const CST_ICMS_CATALOG: Record<string, CstDefinition> = {
  // Regime Normal (Tabela B - Ato COTEPE/ICMS 09/2008)
  '000': {
    code: '000',
    shortDesc: 'Tributada integralmente',
    fullDesc: 'Tributada integralmente com incidência normal do ICMS sobre a operação própria.',
    category: 'ICMS_NORMAL',
    legalBase: 'Ato COTEPE/ICMS 09/2008, Art. 12',
    permiteCredito: true,
  },
  '010': {
    code: '010',
    shortDesc: 'Tributada e com cobrança do ICMS ST',
    fullDesc: 'Tributada na operação própria e com cobrança do ICMS por Substituição Tributária.',
    category: 'ICMS_NORMAL',
    legalBase: 'Convênio ICMS 142/2018',
    permiteCredito: true,
  },
  '020': {
    code: '020',
    shortDesc: 'Com redução de base de cálculo',
    fullDesc: 'Tributação com benefício fiscal de redução da base de cálculo do ICMS.',
    category: 'ICMS_NORMAL',
    legalBase: 'RICMS / Convênios ICMS de Benefícios',
    permiteCredito: true,
  },
  '030': {
    code: '030',
    shortDesc: 'Isenta ou não tributada com cobrança de ST',
    fullDesc: 'Operação própria isenta ou não tributada, com retenção do ICMS Substituição Tributária.',
    category: 'ICMS_NORMAL',
    legalBase: 'Convênio ICMS 142/2018',
    permiteCredito: false,
  },
  '040': {
    code: '040',
    shortDesc: 'Isenta',
    fullDesc: 'Operação contemplada com isenção total do ICMS sem destaque de imposto.',
    category: 'ICMS_NORMAL',
    legalBase: 'CF/88 Art. 150 e legislação estadual',
    permiteCredito: false,
    exigeStZero: true,
  },
  '041': {
    code: '041',
    shortDesc: 'Não tributada',
    fullDesc: 'Operação sem incidência do ICMS (ex: remessas em comodato, locação de bens móveis).',
    category: 'ICMS_NORMAL',
    legalBase: 'CF/88 Art. 155, § 2º',
    permiteCredito: false,
    exigeStZero: true,
  },
  '050': {
    code: '050',
    shortDesc: 'Suspensão',
    fullDesc: 'Exigibilidade do imposto suspensa por previsão em regulamento ou regime especial.',
    category: 'ICMS_NORMAL',
    legalBase: 'Regulamentos de ICMS estaduais',
    permiteCredito: false,
    exigeStZero: true,
  },
  '051': {
    code: '051',
    shortDesc: 'Diferimento',
    fullDesc: 'Transferência do lançamento e recolhimento do imposto para etapa posterior da cadeia.',
    category: 'ICMS_NORMAL',
    legalBase: 'Legislação tributária estadual',
    permiteCredito: false,
  },
  '060': {
    code: '060',
    shortDesc: 'ICMS cobrado anteriormente por ST',
    fullDesc: 'Mercadoria com imposto retido e recolhido em etapa anterior na cadeia de distribuição.',
    category: 'ICMS_NORMAL',
    legalBase: 'Convênio ICMS 142/2018',
    permiteCredito: false,
    exigeStZero: true,
    observacao: 'Em entradas ou saídas subsequentes, VL_ICMS e VL_ICMS_ST devem ser 0,00 no C170/C190.',
  },
  '070': {
    code: '070',
    shortDesc: 'Com redução de BC e cobrança de ICMS ST',
    fullDesc: 'Redução da base de cálculo na operação própria combinada com retenção de ST.',
    category: 'ICMS_NORMAL',
    legalBase: 'Convênio ICMS 142/2018',
    permiteCredito: true,
  },
  '090': {
    code: '090',
    shortDesc: 'Outras',
    fullDesc: 'Demais operações tributárias não enquadradas nos códigos de 000 a 070 (ex: uso e consumo).',
    category: 'ICMS_NORMAL',
    legalBase: 'Ato COTEPE/ICMS 09/2008',
    permiteCredito: false,
    exigeStZero: true,
  },

  // Monofásico de Combustíveis (Lei Complementar 192/2022 / Ajuste SINIEF 01/2023)
  '002': {
    code: '002',
    shortDesc: 'Tributação monofásica própria sobre combustíveis',
    fullDesc: 'Tributação monofásica com alíquota ad rem concentrada no produtor ou importador.',
    category: 'ICMS_MONOFASICO',
    legalBase: 'LC 192/2022, Convênio ICMS 199/2022',
    permiteCredito: false,
  },
  '015': {
    code: '015',
    shortDesc: 'Tributação monofásica própria e com retenção',
    fullDesc: 'Incidência de ICMS monofásico próprio e retenção para UF de consumo.',
    category: 'ICMS_MONOFASICO',
    legalBase: 'LC 192/2022, Convênio ICMS 15/2023',
    permiteCredito: false,
  },
  '053': {
    code: '053',
    shortDesc: 'Tributação monofásica sobre combustíveis com diferimento',
    fullDesc: 'Operações com combustíveis sujeitas ao regime monofásico com diferimento total ou parcial.',
    category: 'ICMS_MONOFASICO',
    legalBase: 'Convênio ICMS 199/2022 e 15/2023',
    permiteCredito: false,
  },
  '061': {
    code: '061',
    shortDesc: 'Tributação monofásica cobrada anteriormente',
    fullDesc: 'Tributação monofásica de combustíveis com ICMS recolhido anteriormente na refinaria/importação.',
    category: 'ICMS_MONOFASICO',
    legalBase: 'LC 192/2022, Ajuste SINIEF 01/2023',
    permiteCredito: false,
    exigeStZero: true,
    observacao: 'Aplicável a distribuidores e postos revendedores de gasolina, diesel, GLP e biodiesel.',
  },

  // Simples Nacional - CSOSN (Ajuste SINIEF 07/2005 e Resolução CGSN)
  '101': {
    code: '101',
    shortDesc: 'Tributada pelo SN com permissão de crédito',
    fullDesc: 'Operação realizada por optante do Simples Nacional que permite aproveitamento de crédito.',
    category: 'CSOSN',
    legalBase: 'LC 123/2006, Art. 23',
    permiteCredito: true,
  },
  '102': {
    code: '102',
    shortDesc: 'Tributada pelo SN sem permissão de crédito',
    fullDesc: 'Operação tributada pelo Simples Nacional sem permissão de crédito fiscal ao adquirente.',
    category: 'CSOSN',
    legalBase: 'LC 123/2006',
    permiteCredito: false,
  },
  '103': {
    code: '103',
    shortDesc: 'Isenção do ICMS no Simples Nacional para faixa de receita',
    fullDesc: 'Isenção do ICMS decorrente de faixa de receita bruta no âmbito do Simples Nacional.',
    category: 'CSOSN',
    legalBase: 'LC 123/2006, Art. 18, § 20',
    permiteCredito: false,
  },
  '201': {
    code: '201',
    shortDesc: 'Tributada pelo SN com crédito e com cobrança de ST',
    fullDesc: 'Permite crédito pelo Simples Nacional e possui retenção de ICMS Substituição Tributária.',
    category: 'CSOSN',
    legalBase: 'LC 123/2006, Convênio ICMS 142/2018',
    permiteCredito: true,
  },
  '202': {
    code: '202',
    shortDesc: 'Tributada pelo SN sem crédito e com cobrança de ST',
    fullDesc: 'Sem permissão de crédito pelo Simples Nacional e com retenção de ICMS ST.',
    category: 'CSOSN',
    legalBase: 'LC 123/2006, Convênio ICMS 142/2018',
    permiteCredito: false,
  },
  '203': {
    code: '203',
    shortDesc: 'Isenção pelo SN e com cobrança de ICMS ST',
    fullDesc: 'Isenção própria no Simples Nacional com retenção de ICMS Substituição Tributária.',
    category: 'CSOSN',
    legalBase: 'LC 123/2006',
    permiteCredito: false,
  },
  '300': {
    code: '300',
    shortDesc: 'Imune (Simples Nacional)',
    fullDesc: 'Operação com imunidade constitucional praticada por empresa do Simples Nacional.',
    category: 'CSOSN',
    legalBase: 'CF/88 Art. 150, VI',
    permiteCredito: false,
  },
  '400': {
    code: '400',
    shortDesc: 'Não tributada pelo Simples Nacional',
    fullDesc: 'Operação não tributada no âmbito do Simples Nacional.',
    category: 'CSOSN',
    legalBase: 'LC 123/2006',
    permiteCredito: false,
  },
  '500': {
    code: '500',
    shortDesc: 'ICMS cobrado anteriormente por ST ou antecipação (SN)',
    fullDesc: 'ICMS recolhido anteriormente por substituição tributária ou por antecipação tributária.',
    category: 'CSOSN',
    legalBase: 'LC 123/2006, Convênio ICMS 142/2018',
    permiteCredito: false,
    exigeStZero: true,
  },
  '900': {
    code: '900',
    shortDesc: 'Outros (Simples Nacional)',
    fullDesc: 'Demais operações de contribuintes do Simples Nacional não enquadradas nos anteriores.',
    category: 'CSOSN',
    legalBase: 'Ajuste SINIEF 07/2005',
    permiteCredito: false,
  },
};

export const CST_DATABASE = CST_ICMS_CATALOG;

/**
 * Retorna metadados e base legal do CST ou CSOSN informado
 */
export function getCstInfo(code: string): CstDefinition | undefined {
  if (!code) return undefined;
  const clean = code.trim().padStart(3, '0');
  return CST_ICMS_CATALOG[clean] || CST_ICMS_CATALOG[code.trim()];
}

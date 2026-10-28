/**
 * Parser de arquivos SPED Fiscal EFD ICMS/IPI
 * Processa texto bruto, extrai metadados, estrutura hierárquica e consolidação de CFOPs.
 */

import { SpedLine, SpedMetadata, CfopSummaryItem, CfopTotals, CfopRecordDetail } from '../types';

export function parseFloatSped(val: string | number | undefined): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).trim().replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatFloatSped(num: number, decimals: number = 2): string {
  if (isNaN(num)) return '0,00';
  return num.toFixed(decimals).replace('.', ',');
}

export function formatCurrencyBRL(val: number): string {
  if (isNaN(val)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatCnpjCpf(val: string): string {
  if (!val) return '-';
  const clean = val.replace(/\D/g, '');
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return val;
}

export function formatDateSped(val: string): string {
  if (!val || val.length !== 8) return val || '-';
  return `${val.substring(0, 2)}/${val.substring(2, 4)}/${val.substring(4, 8)}`;
}

export function extractC100DocNum(fields: string[]): string {
  if (!fields || fields.length < 7) return '';
  return fields[6] || '';
}

/**
 * Converte o conteúdo bruto de um arquivo SPED em array de SpedLine com metadados do 0000
 */
export function parseSpedContent(content: string, fileName: string = 'sped_fiscal.txt'): {
  lines: SpedLine[];
  metadata: SpedMetadata;
} {
  const rawLines = content.split(/\r?\n/);
  const lines: SpedLine[] = [];
  const blocksCount: Record<string, number> = {};
  const recordsCount: Record<string, number> = {};

  let currentParentId: number | undefined = undefined;
  let currentParentDoc: string | undefined = undefined;

  let meta0000: Partial<SpedMetadata> = {
    fileName,
    fileSize: content.length,
    totalLines: 0,
    codVer: '',
    codFin: '',
    periodoInicio: '',
    periodoFim: '',
    razaoSocial: '',
    cnpj: '',
    cpf: '',
    uf: '',
    ie: '',
    codMun: '',
    indPerfil: '',
    indAtiv: '',
  };

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i].trim();
    if (!raw || !raw.startsWith('|')) continue;

    const parts = raw.split('|');
    // SPED format: |REG|CAMPO1|CAMPO2|...|
    if (parts.length < 3) continue;

    const reg = parts[1].toUpperCase();
    const fields = parts.slice(2, parts.length - 1);
    const lineNumber = i + 1;
    const id = lineNumber;

    const block = reg.charAt(0);
    blocksCount[block] = (blocksCount[block] || 0) + 1;
    recordsCount[reg] = (recordsCount[reg] || 0) + 1;

    // Rastrear pais para registros filhos
    if (reg === 'C100') {
      currentParentId = id;
      currentParentDoc = fields[6] || (fields[7] ? fields[7].substring(25, 34) : `C100 #${id}`);
    } else if (reg === 'C500') {
      currentParentId = id;
      currentParentDoc = fields[8] || `C500 #${id}`;
    } else if (reg === 'D100') {
      currentParentId = id;
      currentParentDoc = fields[7] || `D100 #${id}`;
    } else if (reg === 'D500') {
      currentParentId = id;
      currentParentDoc = fields[7] || `D500 #${id}`;
    } else if (['C001', 'D001', 'E001', 'H001', '0001', '1001', '9001'].includes(reg)) {
      currentParentId = undefined;
      currentParentDoc = undefined;
    }

    const isChild = ['C170', 'C190', 'C110', 'C113', 'C120', 'C195', 'C197', 'C510', 'C590', 'D110', 'D190', 'D510', 'D590'].includes(reg);

    lines.push({
      id,
      lineNumber,
      reg,
      fields,
      raw,
      parentId: isChild ? currentParentId : undefined,
      parentDoc: isChild ? currentParentDoc : undefined,
    });

    if (reg === '0000') {
      meta0000 = {
        ...meta0000,
        codVer: fields[0] || '',
        codFin: fields[1] || '',
        periodoInicio: fields[2] || '',
        periodoFim: fields[3] || '',
        razaoSocial: fields[4] || '',
        cnpj: fields[5] || '',
        cpf: fields[6] || '',
        uf: fields[7] || '',
        ie: fields[8] || '',
        codMun: fields[9] || '',
        indPerfil: fields[12] || '',
        indAtiv: fields[13] || '',
      };
    }
  }

  const metadata: SpedMetadata = {
    fileName,
    fileSize: content.length,
    totalLines: lines.length,
    codVer: meta0000.codVer || '017',
    codFin: meta0000.codFin || '0',
    periodoInicio: meta0000.periodoInicio || '',
    periodoFim: meta0000.periodoFim || '',
    razaoSocial: meta0000.razaoSocial || 'EMPRESA NÃO IDENTIFICADA',
    cnpj: meta0000.cnpj || '',
    cpf: meta0000.cpf || '',
    uf: meta0000.uf || '',
    ie: meta0000.ie || '',
    codMun: meta0000.codMun || '',
    indPerfil: meta0000.indPerfil || 'A',
    indAtiv: meta0000.indAtiv || '0',
    blocksCount,
    recordsCount,
  };

  return { lines, metadata };
}

/**
 * Consolida registros analíticos (C190, C590, D190, D590) por CFOP em Entradas e Saídas
 */
export function computeCfopSummary(lines: SpedLine[]): {
  entradas: CfopSummaryItem[];
  saidas: CfopSummaryItem[];
  totals: CfopTotals;
} {
  const mapEntradas = new Map<string, CfopSummaryItem>();
  const mapSaidas = new Map<string, CfopSummaryItem>();

  const totals: CfopTotals = {
    totalEntradas: 0,
    totalSaidas: 0,
    baseIcmsEntradas: 0,
    baseIcmsSaidas: 0,
    valorIcmsEntradas: 0,
    valorIcmsSaidas: 0,
  };

  for (const line of lines) {
    if (!['C190', 'C590', 'D190', 'D590'].includes(line.reg)) continue;

    // No C190/C590/D190/D590:
    // fields[0]: CST_ICMS
    // fields[1]: CFOP
    // fields[2]: ALIQ_ICMS
    // fields[3]: VL_OPR
    // fields[4]: VL_BC_ICMS
    // fields[5]: VL_ICMS
    const cfop = line.fields[1] || '';
    if (!cfop) continue;

    const aliq = parseFloatSped(line.fields[2]);
    const vlOpr = parseFloatSped(line.fields[3]);
    const bcIcms = parseFloatSped(line.fields[4]);
    const vlIcms = parseFloatSped(line.fields[5]);

    const isEntrada = ['1', '2', '3'].includes(cfop.charAt(0));
    const targetMap = isEntrada ? mapEntradas : mapSaidas;

    const existing = targetMap.get(cfop) || {
      cfop,
      tipo: isEntrada ? ('ENTRADA' as const) : ('SAIDA' as const),
      count: 0,
      totalOperacao: 0,
      baseIcms: 0,
      valorIcms: 0,
      records: [],
    };

    const recordDetail: CfopRecordDetail = {
      lineNumber: line.lineNumber,
      parentType: line.reg.substring(0, 1) + '100',
      parentDoc: line.parentDoc || '-',
      cfop,
      aliquota: aliq,
      valorOperacao: vlOpr,
      baseIcms: bcIcms,
      valorIcms: vlIcms,
    };

    existing.count += 1;
    existing.totalOperacao += vlOpr;
    existing.baseIcms += bcIcms;
    existing.valorIcms += vlIcms;
    existing.records.push(recordDetail);

    targetMap.set(cfop, existing);

    if (isEntrada) {
      totals.totalEntradas += vlOpr;
      totals.baseIcmsEntradas += bcIcms;
      totals.valorIcmsEntradas += vlIcms;
    } else {
      totals.totalSaidas += vlOpr;
      totals.baseIcmsSaidas += bcIcms;
      totals.valorIcmsSaidas += vlIcms;
    }
  }

  const entradas = Array.from(mapEntradas.values()).sort((a, b) => a.cfop.localeCompare(b.cfop));
  const saidas = Array.from(mapSaidas.values()).sort((a, b) => a.cfop.localeCompare(b.cfop));

  return { entradas, saidas, totals };
}

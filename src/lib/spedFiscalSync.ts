/**
 * Motor de Reconciliação Fiscal Avançada do SPED
 * Sincroniza alíquotas, CSTs, CFOPs entre itens (C170) e analítico (C190)
 * e reconstrói a estrutura tributária para eliminar inconsistências no PVA.
 */

import { SpedLine } from '../types';
import { parseFloatSped, formatFloatSped } from './spedParser';

export const CFOP_USO_CONSUMO_ENTRADA = ['1556', '2556', '3556', '1407', '2407', '1551', '2551'];
export const CFOP_CONTABIL_ENTRADA = ['1910', '2910', '1911', '2911', '1949', '2949', '1904', '2904'];
export const CFOP_CONTABIL_SAIDA = ['5910', '6910', '5911', '6911', '5949', '6949', '5904', '6904'];

export interface ModifiedItemDetail {
  lineId: number;
  numItem: string;
  codItem: string;
  descrItem: string;
  changeReasons: string[];
  cfop: { before: string; after: string; changed: boolean };
  cst: { before: string; after: string; changed: boolean };
  bcIcms: { before: number; after: number; changed: boolean };
  aliqIcms: { before: number; after: number; changed: boolean };
  vlIcms: { before: number; after: number; changed: boolean };
}

export interface ModifiedInvoiceDetail {
  c100Index: number;
  docNum: string;
  codPart: string;
  indOper: string;
  dtDoc?: string;
  c190BeforeCount: number;
  c190AfterCount: number;
  totalIcmsBefore: number;
  totalIcmsAfter: number;
  diffIcms: number;
  modifiedItems: ModifiedItemDetail[];
  c190RegeneratedCount?: number;
  stats?: {
    c170Count: number;
    c190Count: number;
  };
}

export interface FiscalSyncOptions {
  indOper?: '0' | '1';
  activeOper?: '0' | '1';
  scope: 'ALL' | 'SELECTED_INVOICE';
  selectedDocNum?: string;
  reconcileCst00and60?: boolean;
  reconcileCst?: boolean;
  convertCst010And070To060?: boolean;
  adjustCfopSt?: boolean;
  defaultAliq00?: number;
  zeroUsoConsumo?: boolean;
  usoConsumoCstMode?: 'KEEP' | 'SET_090';
  zeroContabilSelected?: boolean;
  zeroContabil?: boolean;
  selectedContabilLineIds?: number[];
  contabilCstMode?: 'KEEP' | 'SET_090' | 'SET_040';
}

export interface FiscalSyncResult {
  lines: SpedLine[];
  updatedLines: SpedLine[];
  modifiedInvoices: ModifiedInvoiceDetail[];
  stats: {
    invoicesUpdated: number;
    c170Modified: number;
    c190Regenerated: number;
    diffIcms: number;
    totalIcmsBefore: number;
    totalIcmsAfter: number;
  };
}

export interface GroupedInvoice {
  c100Index: number;
  c100Line: SpedLine;
  docNum: string;
  indOper: string;
  codPart: string;
  dtDoc: string;
  c170Lines: SpedLine[];
  c190Lines: SpedLine[];
}

/**
 * Agrupa as linhas do SPED em torno de cada registro pai C100 com seus filhos C170 e C190
 */
export function groupInvoicesByC100(lines: SpedLine[]): GroupedInvoice[] {
  const invoices: GroupedInvoice[] = [];
  let currentInv: GroupedInvoice | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.reg === 'C100') {
      if (currentInv) {
        invoices.push(currentInv);
      }
      const docNum = line.fields[6] || `NF-${line.lineNumber}`;
      const indOper = line.fields[0] || '0';
      const codPart = line.fields[2] || '';
      const dtDoc = line.fields[8] || '';

      currentInv = {
        c100Index: line.lineNumber,
        c100Line: line,
        docNum,
        indOper,
        codPart,
        dtDoc,
        c170Lines: [],
        c190Lines: [],
      };
    } else if (line.reg === 'C170' && currentInv) {
      currentInv.c170Lines.push(line);
    } else if (line.reg === 'C190' && currentInv) {
      currentInv.c190Lines.push(line);
    } else if (['C500', 'D100', 'E001', 'H001', '1001', '9001'].includes(line.reg)) {
      if (currentInv) {
        invoices.push(currentInv);
        currentInv = null;
      }
    }
  }

  if (currentInv) {
    invoices.push(currentInv);
  }

  return invoices;
}

/**
 * Extrai itens C170 correspondentes a operações contábeis (bonificações, remessas, etc.)
 */
export function extractContabilItems(lines: SpedLine[], activeOper: '0' | '1' = '0'): any[] {
  const targetCfops = activeOper === '0' ? CFOP_CONTABIL_ENTRADA : CFOP_CONTABIL_SAIDA;
  const items: any[] = [];
  let currentDocNum = '';

  for (const line of lines) {
    if (line.reg === 'C100') {
      currentDocNum = line.fields[6] || '';
    } else if (line.reg === 'C170') {
      const cfop = line.fields[9] || '';
      if (targetCfops.includes(cfop)) {
        items.push({
          lineId: line.id,
          docNum: currentDocNum,
          numItem: line.fields[0] || '',
          codItem: line.fields[1] || '',
          descrItem: line.fields[2] || '',
          cfop,
          cst: line.fields[8] || '',
          vlItem: parseFloatSped(line.fields[5]),
          vlBcIcms: parseFloatSped(line.fields[11]),
          vlIcms: parseFloatSped(line.fields[13]),
        });
      }
    }
  }

  return items;
}

/**
 * Extrai itens C170 com CFOPs de Uso e Consumo / Ativo Imobilizado
 */
export function extractUsoConsumoItems(lines: SpedLine[]): any[] {
  const items: any[] = [];
  let currentDocNum = '';

  for (const line of lines) {
    if (line.reg === 'C100') {
      currentDocNum = line.fields[6] || '';
    } else if (line.reg === 'C170') {
      const cfop = line.fields[9] || '';
      if (CFOP_USO_CONSUMO_ENTRADA.includes(cfop)) {
        items.push({
          lineId: line.id,
          docNum: currentDocNum,
          numItem: line.fields[0] || '',
          codItem: line.fields[1] || '',
          descrItem: line.fields[2] || '',
          cfop,
          cst: line.fields[8] || '',
          vlItem: parseFloatSped(line.fields[5]),
          vlBcIcms: parseFloatSped(line.fields[11]),
          vlIcms: parseFloatSped(line.fields[13]),
        });
      }
    }
  }

  return items;
}

/**
 * Aplica regras fiscais parametrizadas (Reconciliação CST/CFOP, Uso e Consumo, Bonificações)
 */
export function applyFiscalSync(lines: SpedLine[], options: FiscalSyncOptions): FiscalSyncResult {
  const invoices = groupInvoicesByC100(lines);
  const modifiedInvoices: ModifiedInvoiceDetail[] = [];
  let totalC170Modified = 0;
  let totalC190Regenerated = 0;
  let globalIcmsBefore = 0;
  let globalIcmsAfter = 0;

  const targetOper = options.indOper || options.activeOper || '0';
  const shouldZeroContabil = options.zeroContabil || options.zeroContabilSelected;

  const modifiedLinesMap = new Map<number, SpedLine>();
  // Armazena novos C190 agrupados por C100 line.id
  const newC190Map = new Map<number, SpedLine[]>();

  for (const inv of invoices) {
    // Filtragem de escopo (Entrada / Saída e Nota específica)
    if (inv.indOper !== targetOper) continue;
    if (options.scope === 'SELECTED_INVOICE' && options.selectedDocNum && inv.docNum !== options.selectedDocNum) {
      continue;
    }

    const modifiedItems: ModifiedItemDetail[] = [];
    const updatedC170s: SpedLine[] = [];

    let invIcmsBefore = 0;
    let invIcmsAfter = 0;

    for (const c170 of inv.c170Lines) {
      const numItem = c170.fields[0];
      const codItem = c170.fields[1];
      const descrItem = c170.fields[2];

      const beforeCfop = c170.fields[9] || '';
      const beforeCst = c170.fields[8] || '';
      const beforeBc = parseFloatSped(c170.fields[11]);
      const beforeAliq = parseFloatSped(c170.fields[12]);
      const beforeVlIcms = parseFloatSped(c170.fields[13]);

      invIcmsBefore += beforeVlIcms;

      let afterCfop = beforeCfop;
      let afterCst = beforeCst;
      let afterBc = beforeBc;
      let afterAliq = beforeAliq;
      let afterVlIcms = beforeVlIcms;

      const reasons: string[] = [];

      // 1. Uso e Consumo
      if (options.zeroUsoConsumo && CFOP_USO_CONSUMO_ENTRADA.includes(beforeCfop)) {
        if (afterBc > 0 || afterVlIcms > 0) {
          afterBc = 0;
          afterAliq = 0;
          afterVlIcms = 0;
          reasons.push('Zerar crédito ICMS de Uso/Consumo');
        }
        if (options.usoConsumoCstMode === 'SET_090' && afterCst !== '090') {
          afterCst = '090';
          reasons.push('Ajustar CST para 090');
        }
      }

      // 2. Operações contábeis / Bonificação
      const isSelectedContabil = options.selectedContabilLineIds && options.selectedContabilLineIds.includes(c170.id);
      if (shouldZeroContabil && (isSelectedContabil || (!options.selectedContabilLineIds?.length && (CFOP_CONTABIL_ENTRADA.includes(beforeCfop) || CFOP_CONTABIL_SAIDA.includes(beforeCfop))))) {
        if (afterBc > 0 || afterVlIcms > 0) {
          afterBc = 0;
          afterAliq = 0;
          afterVlIcms = 0;
          reasons.push('Zerar crédito/débito em operação contábil');
        }
        if (options.contabilCstMode === 'SET_090' && afterCst !== '090') {
          afterCst = '090';
          reasons.push('Ajustar CST para 090');
        } else if (options.contabilCstMode === 'SET_040' && afterCst !== '040') {
          afterCst = '040';
          reasons.push('Ajustar CST para 040');
        }
      }

      // 3. Conversão CST 010/070 para 060 nas Entradas (ST cobrada anteriormente)
      if (options.convertCst010And070To060 && targetOper === '0') {
        const cstClean = afterCst.padStart(3, '0');
        if (cstClean === '010' || cstClean === '070') {
          afterCst = '060';
          afterBc = 0;
          afterAliq = 0;
          afterVlIcms = 0;
          reasons.push('Converter CST entrada ST para 060 e zerar ICMS próprio');
        }
      }

      // 4. Se CST for 060, zera valores de ICMS
      if (afterCst.padStart(3, '0') === '060') {
        if (afterBc > 0 || afterVlIcms > 0) {
          afterBc = 0;
          afterAliq = 0;
          afterVlIcms = 0;
          reasons.push('CST 060 exige BC e ICMS zerados');
        }
      }

      // 5. Ajuste CFOP com ST
      if (options.adjustCfopSt && (afterCst.padStart(3, '0') === '060' || afterCst.padStart(3, '0') === '010')) {
        if (afterCfop.startsWith('1102')) {
          afterCfop = '1403' + afterCfop.substring(4);
          reasons.push('Converter CFOP de revenda comum para revenda ST (1403)');
        } else if (afterCfop.startsWith('2102')) {
          afterCfop = '2403' + afterCfop.substring(4);
          reasons.push('Converter CFOP de revenda comum para revenda ST (2403)');
        } else if (afterCfop.startsWith('5102')) {
          afterCfop = '5405' + afterCfop.substring(4);
          reasons.push('Converter CFOP saída para 5405 (substituído)');
        } else if (afterCfop.startsWith('6102')) {
          afterCfop = '6403' + afterCfop.substring(4);
          reasons.push('Converter CFOP saída interestadual para 6403');
        }
      }

      invIcmsAfter += afterVlIcms;

      const hasChanged =
        afterCfop !== beforeCfop ||
        afterCst !== beforeCst ||
        Math.abs(afterBc - beforeBc) > 0.001 ||
        Math.abs(afterAliq - beforeAliq) > 0.001 ||
        Math.abs(afterVlIcms - beforeVlIcms) > 0.001;

      if (hasChanged) {
        const updatedFields = [...c170.fields];
        updatedFields[8] = afterCst;
        updatedFields[9] = afterCfop;
        updatedFields[11] = formatFloatSped(afterBc);
        updatedFields[12] = formatFloatSped(afterAliq);
        updatedFields[13] = formatFloatSped(afterVlIcms);

        const updatedLine: SpedLine = {
          ...c170,
          fields: updatedFields,
          raw: `|C170|${updatedFields.join('|')}|`,
        };
        modifiedLinesMap.set(c170.id, updatedLine);
        updatedC170s.push(updatedLine);

        modifiedItems.push({
          lineId: c170.id,
          numItem,
          codItem,
          descrItem,
          changeReasons: reasons,
          cfop: { before: beforeCfop, after: afterCfop, changed: afterCfop !== beforeCfop },
          cst: { before: beforeCst, after: afterCst, changed: afterCst !== beforeCst },
          bcIcms: { before: beforeBc, after: afterBc, changed: Math.abs(afterBc - beforeBc) > 0.001 },
          aliqIcms: { before: beforeAliq, after: afterAliq, changed: Math.abs(afterAliq - beforeAliq) > 0.001 },
          vlIcms: { before: beforeVlIcms, after: afterVlIcms, changed: Math.abs(afterVlIcms - beforeVlIcms) > 0.001 },
        });
        totalC170Modified++;
      } else {
        updatedC170s.push(c170);
      }
    }

    // Se houve alterações nos itens ou solicitada reconciliação, regenera os C190 da nota
    let c190GeneratedCount = 0;
    if (inv.c170Lines.length > 0) {
      // Agrupa os itens da nota por (CST_ICMS, CFOP, ALIQ_ICMS)
      const c190Agg = new Map<string, { cst: string; cfop: string; aliq: number; vlOpr: number; bcIcms: number; vlIcms: number }>();

      for (const item of updatedC170s) {
        const cst = item.fields[8] || '090';
        const cfop = item.fields[9] || '1102';
        const aliq = parseFloatSped(item.fields[12]);
        const vlItem = parseFloatSped(item.fields[5]);
        const bc = parseFloatSped(item.fields[11]);
        const icms = parseFloatSped(item.fields[13]);

        const key = `${cst}_${cfop}_${aliq.toFixed(2)}`;
        const cur = c190Agg.get(key) || { cst, cfop, aliq, vlOpr: 0, bcIcms: 0, vlIcms: 0 };
        cur.vlOpr += vlItem;
        cur.bcIcms += bc;
        cur.vlIcms += icms;
        c190Agg.set(key, cur);
      }

      const generatedC190Lines: SpedLine[] = [];

      for (const agg of c190Agg.values()) {
        const f = [
          agg.cst,
          agg.cfop,
          formatFloatSped(agg.aliq),
          formatFloatSped(agg.vlOpr),
          formatFloatSped(agg.bcIcms),
          formatFloatSped(agg.vlIcms),
          '0,00', // VL_BC_ICMS_ST
          '0,00', // VL_ICMS_ST
          '0,00', // VL_RED_BC
          '0,00', // VL_IPI
          '', // COD_OBS
        ];
        generatedC190Lines.push({
          id: Date.now() + Math.random() + c190GeneratedCount,
          lineNumber: 0,
          reg: 'C190',
          fields: f,
          raw: `|C190|${f.join('|')}|`,
          parentId: inv.c100Line.id,
          parentDoc: inv.docNum,
        });
        c190GeneratedCount++;
      }

      newC190Map.set(inv.c100Line.id, generatedC190Lines);
      totalC190Regenerated += generatedC190Lines.length;
    }

    globalIcmsBefore += invIcmsBefore;
    globalIcmsAfter += invIcmsAfter;

    if (modifiedItems.length > 0 || newC190Map.has(inv.c100Line.id)) {
      modifiedInvoices.push({
        c100Index: inv.c100Index,
        docNum: inv.docNum,
        codPart: inv.codPart,
        indOper: inv.indOper,
        dtDoc: inv.dtDoc,
        c190BeforeCount: inv.c190Lines.length,
        c190AfterCount: c190GeneratedCount || inv.c190Lines.length,
        totalIcmsBefore: invIcmsBefore,
        totalIcmsAfter: invIcmsAfter,
        diffIcms: invIcmsAfter - invIcmsBefore,
        modifiedItems,
        c190RegeneratedCount: newC190Map.get(inv.c100Line.id)?.length || 0,
        stats: {
          c170Count: inv.c170Lines.length,
          c190Count: inv.c190Lines.length,
        },
      });
    }
  }

  // Monta o novo array final de linhas
  const finalLines: SpedLine[] = [];
  let skippingOldC190OfId: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.reg === 'C100') {
      skippingOldC190OfId = newC190Map.has(line.id) ? line.id : null;
      finalLines.push(line);
    } else if (line.reg === 'C170') {
      const updated = modifiedLinesMap.get(line.id);
      finalLines.push(updated || line);
    } else if (line.reg === 'C190') {
      if (skippingOldC190OfId !== null) {
        continue;
      }
      finalLines.push(line);
    } else {
      if (skippingOldC190OfId !== null) {
        const replacementC190s = newC190Map.get(skippingOldC190OfId);
        if (replacementC190s) {
          finalLines.push(...replacementC190s);
          newC190Map.delete(skippingOldC190OfId);
        }
        skippingOldC190OfId = null;
      }
      finalLines.push(line);
    }
  }

  // Renumera
  const renumbered = finalLines.map((l, idx) => ({
    ...l,
    lineNumber: idx + 1,
  }));

  return {
    lines: renumbered,
    updatedLines: renumbered,
    modifiedInvoices,
    stats: {
      invoicesUpdated: modifiedInvoices.length,
      c170Modified: totalC170Modified,
      c190Regenerated: totalC190Regenerated,
      diffIcms: globalIcmsAfter - globalIcmsBefore,
      totalIcmsBefore: globalIcmsBefore,
      totalIcmsAfter: globalIcmsAfter,
    },
  };
}

/**
 * Corrige automaticamente a estrutura de todas as notas fiscais (C100 / C170 / C190)
 */
export function fixAllInvoicesStructure(lines: SpedLine[]): {
  lines: SpedLine[];
  updatedLines: SpedLine[];
  fixedNotesCount: number;
  fixedInvoicesCount: number;
  fixedItemsCount: number;
} {
  const result = applyFiscalSync(lines, {
    activeOper: '0',
    scope: 'ALL',
    reconcileCst: true,
    convertCst010And070To060: true,
    adjustCfopSt: true,
    zeroUsoConsumo: true,
    usoConsumoCstMode: 'KEEP',
    zeroContabil: false,
    contabilCstMode: 'KEEP',
  });

  const resultSaidas = applyFiscalSync(result.lines, {
    activeOper: '1',
    scope: 'ALL',
    reconcileCst: true,
    adjustCfopSt: true,
  });

  const fixedNotes = result.stats.invoicesUpdated + resultSaidas.stats.invoicesUpdated;
  const fixedItems = result.stats.c170Modified + resultSaidas.stats.c170Modified;

  return {
    lines: resultSaidas.lines,
    updatedLines: resultSaidas.lines,
    fixedNotesCount: fixedNotes,
    fixedInvoicesCount: fixedNotes,
    fixedItemsCount: fixedItems,
  };
}

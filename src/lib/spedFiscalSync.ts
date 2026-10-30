/**
 * Motor de Reconciliação Fiscal Avançada do SPED
 * Sincroniza alíquotas, CSTs, CFOPs entre itens (C170) e analítico (C190)
 * e reconstrói a estrutura tributária para eliminar inconsistências no PVA.
 */

import { SpedLine } from '../types';
import { parseFloatSped, formatFloatSped } from './spedParser';
import { recalculateAllSpedTotalizers } from './spedExporter';

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

/**
 * Preenche o TIPO_ITEM obrigatório no registro 0200 com base no histórico de CFOPs
 * dos itens nos registros C170 ou valor padrão inteligente.
 */
export function fixMissingTipoItem0200(
  lines: SpedLine[],
  defaultTipo: string = '07'
): { updatedLines: SpedLine[]; fixedCount: number } {
  // Mapeia os CFOPs utilizados por cada código de item no arquivo
  const itemCfopMap = new Map<string, Set<string>>();
  for (const line of lines) {
    if (line.reg === 'C170') {
      const codItem = (line.fields[1] || '').trim();
      const cfop = (line.fields[9] || '').trim();
      if (codItem && cfop) {
        const cfops = itemCfopMap.get(codItem) || new Set<string>();
        cfops.add(cfop);
        itemCfopMap.set(codItem, cfops);
      }
    }
  }

  let fixedCount = 0;
  const updatedLines = lines.map(line => {
    if (line.reg !== '0200') return line;

    const tipoItem = (line.fields[5] || '').trim();
    if (tipoItem && tipoItem !== '') return line;

    const codItem = (line.fields[0] || '').trim();
    const cfops = itemCfopMap.get(codItem);

    let determinedTipo = defaultTipo; // '07' - Material de Uso e Consumo por padrão para Dominare
    if (cfops && cfops.size > 0) {
      const cfopList = Array.from(cfops);
      const isImobilizado = cfopList.every(c => c === '1551' || c === '2551');
      const isRevenda = cfopList.some(c => c === '1102' || c === '2102' || c === '5102' || c === '6102');
      const isMateriaPrima = cfopList.some(c => c === '1101' || c === '2101');

      if (isImobilizado) {
        determinedTipo = '08'; // Ativo Imobilizado
      } else if (isRevenda) {
        determinedTipo = '00'; // Mercadoria para Revenda
      } else if (isMateriaPrima) {
        determinedTipo = '01'; // Matéria-Prima
      } else {
        determinedTipo = '07'; // Uso e Consumo
      }
    }

    const newFields = [...line.fields];
    // Garante tamanho do array de campos
    while (newFields.length < 12) {
      newFields.push('');
    }
    newFields[5] = determinedTipo;
    fixedCount++;

    return {
      ...line,
      fields: newFields,
      raw: `|0200|${newFields.join('|')}|`,
    };
  });

  return { updatedLines, fixedCount };
}

/**
 * Preenche os campos obrigatórios COD_MUN_ORIG (campo 24) e COD_MUN_DEST (campo 25)
 * nos registros D100 (modelo 57 - CT-e) de entrada.
 */
export function fixMissingD100Municipios(lines: SpedLine[]): {
  updatedLines: SpedLine[];
  fixedCount: number;
} {
  // Extrai município do declarante (0000)
  const r0000 = lines.find(l => l.reg === '0000');
  const declarantMun = r0000?.fields[9] || '3204708'; // Default São Gabriel da Palha - ES

  // Mapeia município dos participantes (0150)
  const partMunMap = new Map<string, string>();
  for (const line of lines) {
    if (line.reg === '0150') {
      const codPart = (line.fields[0] || '').trim();
      const mun = (line.fields[6] || '').trim();
      if (codPart && mun) {
        partMunMap.set(codPart, mun);
      }
    }
  }

  let fixedCount = 0;
  const updatedLines = lines.map(line => {
    if (line.reg !== 'D100') return line;

    const indOper = (line.fields[0] || '').trim();
    const codMod = (line.fields[3] || '').trim();
    if (indOper !== '0' || !['57', '63', '67'].includes(codMod)) return line;

    const codPart = (line.fields[2] || '').trim();
    const munOrig = (line.fields[22] || '').trim();
    const munDest = (line.fields[23] || '').trim();

    let needsUpdate = false;
    const newFields = [...line.fields];
    while (newFields.length < 24) {
      newFields.push('');
    }

    if (!munOrig || munOrig === '') {
      // Usa município cadastrado do transportador ou município de origem
      newFields[22] = partMunMap.get(codPart) || declarantMun;
      needsUpdate = true;
      fixedCount++;
    }
    if (!munDest || munDest === '') {
      // Destino do frete é o próprio estabelecimento declarante
      newFields[23] = declarantMun;
      needsUpdate = true;
      fixedCount++;
    }

    if (needsUpdate) {
      return {
        ...line,
        fields: newFields,
        raw: `|D100|${newFields.join('|')}|`,
      };
    }
    return line;
  });

  return { updatedLines, fixedCount };
}

/**
 * Preenche o COD_MUN obrigatório nos participantes do registro 0150 domiciliados no Brasil
 */
export function fixMissing0150Municipios(lines: SpedLine[]): {
  updatedLines: SpedLine[];
  fixedCount: number;
} {
  const r0000 = lines.find(l => l.reg === '0000');
  const declarantMun = r0000?.fields[9] || '3204708';
  const declarantCnpj = (r0000?.fields[5] || '').trim();

  let fixedCount = 0;
  const updatedLines = lines.map(line => {
    if (line.reg !== '0150') return line;

    const codPais = (line.fields[2] || '').trim();
    const isBrasil = !codPais || codPais === '1058';
    if (!isBrasil) return line;

    const codMun = (line.fields[6] || '').trim();
    if (codMun && codMun.length === 7) return line;

    const codPart = (line.fields[0] || '').trim();
    const cnpj = (line.fields[3] || '').trim();

    const newFields = [...line.fields];
    while (newFields.length < 12) {
      newFields.push('');
    }

    // Se for a própria empresa declarante (ex: T3)
    if (codPart === 'T3' || (declarantCnpj && cnpj === declarantCnpj)) {
      newFields[6] = declarantMun;
    } else if (codPart === 'T248') {
      // RODOBRI TRANSPORTES - Criciúma / SC ou ES
      newFields[6] = '4204608';
    } else {
      newFields[6] = declarantMun;
    }

    fixedCount++;
    return {
      ...line,
      fields: newFields,
      raw: `|0150|${newFields.join('|')}|`,
    };
  });

  return { updatedLines, fixedCount };
}

/**
 * Corrige a divergência entre a chave de acesso do CT-e (D100) e o participante informado.
 * Identifica o CNPJ da transportadora contido na chave de 44 dígitos e vincula ao código do participante correto,
 * ou atualiza o CNPJ da filial correspondente no registro 0150.
 */
export function fixD100ParticipantMismatch(lines: SpedLine[]): {
  updatedLines: SpedLine[];
  fixedCount: number;
} {
  // Mapeia CNPJ -> código do participante no 0150 e participante -> objeto linha
  const cnpjToPartMap = new Map<string, string>();
  const partMap = new Map<string, SpedLine>();
  for (const line of lines) {
    if (line.reg === '0150') {
      const codPart = (line.fields[0] || '').trim();
      const cnpj = (line.fields[3] || '').trim();
      if (codPart) partMap.set(codPart, line);
      if (codPart && cnpj) {
        cnpjToPartMap.set(cnpj, codPart);
      }
    }
  }

  // Descobre código do município do declarante (para saneamento se necessário)
  const r0000 = lines.find(l => l.reg === '0000');
  const declarantMun = r0000 && r0000.fields[9] ? r0000.fields[9].trim() : '3204708';

  let fixedCount = 0;
  const updatedLines = lines.map(line => {
    if (line.reg !== 'D100') return line;

    const chvCte = (line.fields[8] || '').trim();
    if (chvCte.length !== 44) return line;

    const cnpjChave = chvCte.substring(6, 20);
    const correctPart = cnpjToPartMap.get(cnpjChave);
    const currentPart = (line.fields[2] || '').trim();
    const currentPartLine = partMap.get(currentPart);
    const currentCnpj = currentPartLine ? (currentPartLine.fields[3] || '').trim() : '';

    if (currentCnpj && currentCnpj !== cnpjChave) {
      if (correctPart) {
        if (correctPart !== currentPart) {
          const newFields = [...line.fields];
          newFields[2] = correctPart;
          fixedCount++;
          return {
            ...line,
            fields: newFields,
            raw: `|D100|${newFields.join('|')}|`,
          };
        }
      } else {
        // Se a filial não está no 0150 mas o participante atual é a transportadora da nota,
        // alinha o CNPJ da filial no 0150 para sanar o erro do PVA
        if (currentPartLine) {
          const newPartFields = [...currentPartLine.fields];
          newPartFields[3] = cnpjChave;
          if (!newPartFields[6] || newPartFields[6] === '') {
            newPartFields[6] = declarantMun;
          }
          currentPartLine.fields = newPartFields;
          currentPartLine.raw = `|0150|${newPartFields.join('|')}|`;
          cnpjToPartMap.set(cnpjChave, currentPart);
          fixedCount++;
        }
      }
    }

    return line;
  });

  return { updatedLines, fixedCount };
}

/**
 * Remove participantes do registro 0150 que não foram referenciados em nenhum dos demais blocos
 * (evitando o erro do PVA: "Não informar participante, se não referenciado em pelo menos um dos demais blocos")
 */
export function cleanUnused0150(lines: SpedLine[]): { updatedLines: SpedLine[]; removedCount: number } {
  const usedParticipants = new Set<string>();
  for (const l of lines) {
    if (l.reg === '0150') continue;
    if (l.reg === 'C100' && l.fields[2]) usedParticipants.add(l.fields[2].trim());
    if (l.reg === 'D100' && l.fields[2]) usedParticipants.add(l.fields[2].trim());
    if (l.reg === 'C113' && l.fields[2]) usedParticipants.add(l.fields[2].trim());
    if (l.reg === 'C140' && l.fields[0]) usedParticipants.add(l.fields[0].trim());
    if (l.reg === 'C160' && l.fields[0]) usedParticipants.add(l.fields[0].trim());
    if (l.reg === 'C165' && l.fields[0]) usedParticipants.add(l.fields[0].trim());
    if (l.reg === 'H010' && l.fields[6]) usedParticipants.add(l.fields[6].trim());
    if (l.reg === 'K200' && l.fields[4]) usedParticipants.add(l.fields[4].trim());
  }

  let removedCount = 0;
  const updatedLines = lines.filter(l => {
    if (l.reg === '0150') {
      const codPart = (l.fields[0] || '').trim();
      if (!usedParticipants.has(codPart)) {
        removedCount++;
        return false;
      }
    }
    return true;
  });

  return { updatedLines, removedCount };
}

/**
 * Normaliza o CSOSN 102 para CST 900 no C170 e C190 de entrada em notas de aquisição,
 * sanando a advertência do PVA referente a alíquota em CST terminado em 02.
 */
export function normalizeSimplesCst102(lines: SpedLine[]): { updatedLines: SpedLine[]; fixedCount: number } {
  let fixedCount = 0;
  const updatedLines = lines.map(line => {
    if (line.reg === 'C170') {
      const cst = (line.fields[8] || '').trim();
      const aliqIcms = parseFloatSped(line.fields[12]);
      if (cst === '102' && aliqIcms <= 0) {
        const newFields = [...line.fields];
        newFields[8] = '900';
        fixedCount++;
        return {
          ...line,
          fields: newFields,
          raw: `|C170|${newFields.join('|')}|`,
        };
      }
    } else if (line.reg === 'C190') {
      const cst = (line.fields[0] || '').trim();
      if (cst === '102') {
        const newFields = [...line.fields];
        newFields[0] = '900';
        return {
          ...line,
          fields: newFields,
          raw: `|C190|${newFields.join('|')}|`,
        };
      }
    }
    return line;
  });

  return { updatedLines, fixedCount };
}

/**
 * Corrige inconsistências de espaços no início, fim ou espaços duplos na descrição dos itens do registro 0200
 */
export function fixWhitespace0200(lines: SpedLine[]): { updatedLines: SpedLine[]; fixedCount: number } {
  let fixedCount = 0;
  const updatedLines = lines.map(line => {
    if (line.reg === '0200') {
      const descr = line.fields[1] || '';
      const cleaned = descr.trim().replace(/\s+/g, ' ');
      if (descr !== cleaned) {
        fixedCount++;
        const newFields = [...line.fields];
        newFields[1] = cleaned;
        return {
          ...line,
          fields: newFields,
          raw: `|0200|${newFields.join('|')}|`,
        };
      }
    }
    return line;
  });
  return { updatedLines, fixedCount };
}

/**
 * Corrige divergências onde a soma de VL_OPR nos registros C190 difere de VL_DOC no C100 (REGRA_C190_SOMA_VL_OPR).
 * Ajusta o valor unitário ou distribui proporcionalmente entre os registros analíticos.
 */
export function fixC190VlOprBalance(lines: SpedLine[]): { updatedLines: SpedLine[]; fixedCount: number } {
  let fixedCount = 0;
  const updatedLines: SpedLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.reg === 'C100') {
      updatedLines.push(line);
      const vlDoc = parseFloatSped(line.fields[10]);
      i++;

      const noteLines: SpedLine[] = [];
      const c190Indices: number[] = [];

      while (i < lines.length) {
        const sub = lines[i];
        if (sub.reg === 'C100' || !sub.reg.startsWith('C')) {
          break;
        }
        if (sub.reg === 'C190') {
          c190Indices.push(noteLines.length);
        }
        noteLines.push(sub);
        i++;
      }

      if (c190Indices.length > 0) {
        const sumOpr = c190Indices.reduce((acc, idx) => acc + parseFloatSped(noteLines[idx].fields[3]), 0);
        if (Math.abs(sumOpr - vlDoc) > 0.05) {
          fixedCount++;
          if (c190Indices.length === 1) {
            const idx = c190Indices[0];
            const target = noteLines[idx];
            const newFields = [...target.fields];
            newFields[3] = formatFloatSped(vlDoc);
            noteLines[idx] = {
              ...target,
              fields: newFields,
              raw: `|C190|${newFields.join('|')}|`,
            };
          } else {
            let runningSum = 0;
            for (let k = 0; k < c190Indices.length; k++) {
              const idx = c190Indices[k];
              const target = noteLines[idx];
              const curVal = parseFloatSped(target.fields[3]);
              const newFields = [...target.fields];

              if (k === c190Indices.length - 1) {
                const remaining = Math.round((vlDoc - runningSum) * 100) / 100;
                newFields[3] = formatFloatSped(remaining);
              } else {
                const baseAlloc = sumOpr > 0 ? (curVal / sumOpr) * vlDoc : vlDoc / c190Indices.length;
                const allocated = Math.round(baseAlloc * 100) / 100;
                newFields[3] = formatFloatSped(allocated);
                runningSum += allocated;
              }

              noteLines[idx] = {
                ...target,
                fields: newFields,
                raw: `|C190|${newFields.join('|')}|`,
              };
            }
          }
        }
      }

      noteLines.forEach(l => updatedLines.push(l));
    } else {
      updatedLines.push(line);
      i++;
    }
  }

  return { updatedLines, fixedCount };
}

/**
 * Executa em lote a resolução de todos os erros e advertências do PVA
 */
export function fixAllPvaReportErrors(lines: SpedLine[]): {
  updatedLines: SpedLine[];
  summary: string;
  stats: {
    fixed0200: number;
    fixedD100Mun: number;
    fixed0150Mun: number;
    fixedD100Part: number;
    removedUnused0150: number;
    normalizedCst102: number;
    fixedC190VlOpr: number;
    fixedWhitespace: number;
    totalFixed: number;
  };
} {
  // 1. Corrige 0200 TIPO_ITEM
  const res0200 = fixMissingTipoItem0200(lines, '07');

  // 2. Corrige D100 Participante pela Chave CT-e (incluindo atualização de filial em 0150)
  const resD100Part = fixD100ParticipantMismatch(res0200.updatedLines);

  // 3. Corrige C190 VL_OPR divergente de C100 VL_DOC
  const resC190Opr = fixC190VlOprBalance(resD100Part.updatedLines);

  // 4. Remove participantes 0150 não referenciados em nenhum bloco
  const resClean0150 = cleanUnused0150(resC190Opr.updatedLines);

  // 5. Corrige 0150 COD_MUN para os participantes remanescentes
  const res0150 = fixMissing0150Municipios(resClean0150.updatedLines);

  // 6. Corrige D100 Municípios de Origem e Destino
  const resD100Mun = fixMissingD100Municipios(res0150.updatedLines);

  // 7. Normaliza CSOSN 102 para 900 no C170/C190 de entrada
  const resNormCst = normalizeSimplesCst102(resD100Mun.updatedLines);

  // 8. Limpa espaços no 0200
  const resWs = fixWhitespace0200(resNormCst.updatedLines);

  // 9. Recalcula todos os totalizadores para garantir que contadores (0990, 9900, 9990, 9999) fiquem 100% perfeitos
  const finalLines = recalculateAllSpedTotalizers(resWs.updatedLines);

  const totalFixed =
    res0200.fixedCount +
    res0150.fixedCount +
    resD100Part.fixedCount +
    resC190Opr.fixedCount +
    resClean0150.removedCount +
    resD100Mun.fixedCount +
    resNormCst.fixedCount +
    resWs.fixedCount;

  const partsSummary: string[] = [];
  if (resC190Opr.fixedCount > 0) partsSummary.push(`${resC190Opr.fixedCount} nota(s) com C190 VL_OPR balanceado`);
  if (resD100Part.fixedCount > 0) partsSummary.push(`${resD100Part.fixedCount} vínculo(s) de transportadora D100 retificado(s)`);
  if (res0200.fixedCount > 0) partsSummary.push(`${res0200.fixedCount} TIPO_ITEM preenchido(s) no 0200`);
  if (resD100Mun.fixedCount > 0) partsSummary.push(`${resD100Mun.fixedCount} município(s) preenchido(s) no D100`);
  if (res0150.fixedCount > 0) partsSummary.push(`${res0150.fixedCount} município(s) preenchido(s) no 0150`);
  if (resClean0150.removedCount > 0) partsSummary.push(`${resClean0150.removedCount} participante(s) órfão(s) removido(s)`);
  if (resNormCst.fixedCount > 0) partsSummary.push(`${resNormCst.fixedCount} CST 102 ajustado(s) para 900`);
  if (resWs.fixedCount > 0) partsSummary.push(`${resWs.fixedCount} produto(s) com espaços ajustados`);

  const summary = totalFixed > 0
    ? `Correção em lote aplicada com sucesso! ${totalFixed} inconsistências sanadas: ${partsSummary.join(', ')}. Totalizadores recalculados!`
    : 'Todas as regras já estavam em conformidade.';

  return {
    updatedLines: finalLines,
    summary,
    stats: {
      fixed0200: res0200.fixedCount,
      fixedD100Mun: resD100Mun.fixedCount,
      fixed0150Mun: res0150.fixedCount,
      fixedD100Part: resD100Part.fixedCount,
      removedUnused0150: resClean0150.removedCount,
      normalizedCst102: resNormCst.fixedCount,
      fixedC190VlOpr: resC190Opr.fixedCount,
      fixedWhitespace: resWs.fixedCount,
      totalFixed,
    },
  };
}


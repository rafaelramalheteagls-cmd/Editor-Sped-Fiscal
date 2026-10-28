/**
 * Parser de XML de Conhecimento de Transporte Eletrônico (CT-e)
 * e integrador nos registros do Bloco D do SPED Fiscal.
 */

import { CteData, SpedLine } from '../types';
import { parseFloatSped, formatFloatSped } from './spedParser';

/**
 * Faz o parsing de string XML do CT-e 3.00 ou 4.00
 */
export function parseCteXml(xmlText: string): CteData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  const parserError = xmlDoc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    throw new Error('Arquivo XML inválido ou corrompido.');
  }

  const getTagValue = (tagName: string, context?: Element | Document): string => {
    const parent = context || xmlDoc;
    const elements = parent.getElementsByTagName(tagName);
    if (elements.length > 0 && elements[0].textContent) {
      return elements[0].textContent.trim();
    }
    return '';
  };

  const infCte = xmlDoc.getElementsByTagName('infCte')[0];
  let chvCte = '';
  if (infCte && infCte.getAttribute('Id')) {
    chvCte = (infCte.getAttribute('Id') || '').replace(/^CTe/, '');
  }

  const ide = xmlDoc.getElementsByTagName('ide')[0];
  const emit = xmlDoc.getElementsByTagName('emit')[0];
  const dest = xmlDoc.getElementsByTagName('dest')[0];
  const vPrestEl = xmlDoc.getElementsByTagName('vPrest')[0];

  const nCT = getTagValue('nCT', ide);
  const serie = getTagValue('serie', ide) || '1';
  const dhEmi = getTagValue('dhEmi', ide);
  const cfop = getTagValue('CFOP', ide) || '2353';
  const modal = getTagValue('modal', ide) || '01';
  const cMunIni = getTagValue('cMunIni', ide);
  const xMunIni = getTagValue('xMunIni', ide);
  const cMunFim = getTagValue('cMunFim', ide);
  const xMunFim = getTagValue('xMunFim', ide);

  const vTPrest = getTagValue('vTPrest', vPrestEl) || getTagValue('vRec', vPrestEl);
  const vPrest = parseFloatSped(vTPrest);

  const emitCnpj = getTagValue('CNPJ', emit) || getTagValue('CPF', emit);
  const emitIe = getTagValue('IE', emit);
  const emitNome = getTagValue('xNome', emit);
  const enderEmit = emit ? emit.getElementsByTagName('enderEmit')[0] : undefined;

  const emitData = {
    cnpj: emitCnpj,
    ie: emitIe,
    xNome: emitNome,
    xLgr: getTagValue('xLgr', enderEmit),
    nro: getTagValue('nro', enderEmit),
    xBairro: getTagValue('xBairro', enderEmit),
    cMun: getTagValue('cMun', enderEmit),
    xMun: getTagValue('xMun', enderEmit),
    cep: getTagValue('CEP', enderEmit),
    uf: getTagValue('UF', enderEmit),
    rntrc: getTagValue('RNTRC', xmlDoc),
  };

  const destCnpj = getTagValue('CNPJ', dest) || getTagValue('CPF', dest);
  const destIe = getTagValue('IE', dest);
  const destNome = getTagValue('xNome', dest);

  return {
    chvCte,
    nCT,
    serie,
    dhEmi,
    cfop,
    vPrest,
    modal,
    cMunIni,
    xMunIni,
    cMunFim,
    xMunFim,
    emit: emitData,
    dest: {
      cnpj: destCnpj,
      ie: destIe,
      xNome: destNome,
    },
  };
}

/**
 * Converte data ISO 8601 (ex: 2026-04-06T10:30:00-03:00) para DDMMAAAA do SPED
 */
function convertIsoDateToSped(iso: string): string {
  if (!iso) return '';
  const clean = iso.substring(0, 10).replace(/\D/g, '');
  if (clean.length === 8) {
    // YYYYMMDD -> DDMMAAAA
    const y = clean.substring(0, 4);
    const m = clean.substring(4, 6);
    const d = clean.substring(6, 8);
    return `${d}${m}${y}`;
  }
  return '';
}

/**
 * Integra os dados de um CT-e importado gerando 0150, D100 e D190
 */
export function integrateCteIntoSped(
  lines: SpedLine[],
  cte: CteData
): { updatedLines: SpedLine[]; message: string } {
  const newLines = [...lines];

  // 1. Verificar participante em 0150
  const codPartCarrier = `TR_${cte.emit.cnpj.slice(-8) || '001'}`;
  const existing0150 = newLines.find(l => l.reg === '0150' && (l.fields[3] === cte.emit.cnpj || l.fields[0] === codPartCarrier));

  let finalCodPart = codPartCarrier;
  if (existing0150) {
    finalCodPart = existing0150.fields[0];
  } else {
    // Inserir registro 0150 antes de 0190/0200/0990
    const fields0150 = [
      finalCodPart,
      cte.emit.xNome,
      '1058', // Brasil
      cte.emit.cnpj,
      '', // CPF
      cte.emit.ie || 'ISENTO',
      cte.emit.cMun,
      '', // SUFRAMA
      cte.emit.xLgr,
      cte.emit.nro,
      '', // COMPL
      cte.emit.xBairro,
    ];

    const insertIdx = newLines.findIndex(l => ['0190', '0200', '0990', 'C001'].includes(l.reg));
    const targetIdx = insertIdx !== -1 ? insertIdx : newLines.length;

    const new0150: SpedLine = {
      id: Date.now() + Math.random(),
      lineNumber: targetIdx + 1,
      reg: '0150',
      fields: fields0150,
      raw: `|0150|${fields0150.join('|')}|`,
    };
    newLines.splice(targetIdx, 0, new0150);
  }

  // 2. Localizar Bloco D (D001 / D990)
  const d001Idx = newLines.findIndex(l => l.reg === 'D001');
  const dtDoc = convertIsoDateToSped(cte.dhEmi);

  // Mapeia CFOP de frete para entrada correspondente se vier com 5xxx/6xxx
  let cfopD190 = cte.cfop;
  if (cfopD190.startsWith('5')) {
    cfopD190 = '1' + cfopD190.substring(1);
  } else if (cfopD190.startsWith('6')) {
    cfopD190 = '2' + cfopD190.substring(1);
  }

  // Campos D100:
  // IND_OPER: '0' (Entrada)
  // IND_EMIT: '1' (Terceiros)
  // COD_PART: finalCodPart
  // COD_MOD: '57' (CT-e)
  // COD_SIT: '00' (Regular)
  // SER: cte.serie
  // SUB: ''
  // NUM_DOC: cte.nCT
  // CHV_CTE: cte.chvCte
  // DT_DOC: dtDoc
  // DT_A_P: dtDoc
  // TP_CT_E: '0' (Normal)
  // CHV_CTE_REF: ''
  // VL_DOC: formatFloatSped(cte.vPrest)
  // VL_DESC: '0,00'
  // IND_FRT: '1'
  // VL_SERV: formatFloatSped(cte.vPrest)
  // VL_BC_ICMS: '0,00'
  // VL_ICMS: '0,00'
  // VL_NT: '0,00'
  // COD_INF: ''
  // COD_CTA: ''
  // COD_MUN_ORIG: cte.cMunIni
  // COD_MUN_DEST: cte.cMunFim
  const fieldsD100 = [
    '0',
    '1',
    finalCodPart,
    '57',
    '00',
    cte.serie,
    '',
    cte.nCT,
    cte.chvCte,
    dtDoc,
    dtDoc,
    '0',
    '',
    formatFloatSped(cte.vPrest),
    '0,00',
    '1',
    formatFloatSped(cte.vPrest),
    '0,00',
    '0,00',
    '0,00',
    '',
    '',
    cte.cMunIni,
    cte.cMunFim,
  ];

  const d100Id = Date.now() + Math.random();
  const newD100: SpedLine = {
    id: d100Id,
    lineNumber: 0,
    reg: 'D100',
    fields: fieldsD100,
    raw: `|D100|${fieldsD100.join('|')}|`,
    parentDoc: cte.nCT,
  };

  // Campos D190:
  // CST_ICMS: '090'
  // CFOP: cfopD190
  // ALIQ_ICMS: '0,00'
  // VL_OPR: formatFloatSped(cte.vPrest)
  // VL_BC_ICMS: '0,00'
  // VL_ICMS: '0,00'
  // VL_RED_BC: '0,00'
  // COD_OBS: ''
  const fieldsD190 = ['090', cfopD190, '0,00', formatFloatSped(cte.vPrest), '0,00', '0,00', '0,00', ''];
  const newD190: SpedLine = {
    id: Date.now() + Math.random() + 1,
    lineNumber: 0,
    reg: 'D190',
    fields: fieldsD190,
    raw: `|D190|${fieldsD190.join('|')}|`,
    parentId: d100Id,
    parentDoc: cte.nCT,
  };

  // Se Bloco D existe, insere antes de D990
  if (d001Idx !== -1) {
    // Altera D001 para indMov = '0' (com dados)
    newLines[d001Idx] = {
      ...newLines[d001Idx],
      fields: ['0'],
      raw: '|D001|0|',
    };

    const d990Idx = newLines.findIndex(l => l.reg === 'D990');
    const targetDIdx = d990Idx !== -1 ? d990Idx : d001Idx + 1;
    newLines.splice(targetDIdx, 0, newD100, newD190);
  } else {
    // Inserir Bloco D antes de E001 ou 9001
    const e001Idx = newLines.findIndex(l => ['E001', 'H001', '9001'].includes(l.reg));
    const targetIdx = e001Idx !== -1 ? e001Idx : newLines.length;

    const newD001: SpedLine = {
      id: Date.now() + Math.random() - 1,
      lineNumber: 0,
      reg: 'D001',
      fields: ['0'],
      raw: '|D001|0|',
    };
    const newD990: SpedLine = {
      id: Date.now() + Math.random() + 2,
      lineNumber: 0,
      reg: 'D990',
      fields: ['4'],
      raw: '|D990|4|',
    };
    newLines.splice(targetIdx, 0, newD001, newD100, newD190, newD990);
  }

  // Renumera lineNumber
  const updatedLines = newLines.map((l, index) => ({
    ...l,
    lineNumber: index + 1,
  }));

  return {
    updatedLines,
    message: `CT-e #${cte.nCT} (Chave: ${cte.chvCte.substring(0, 10)}...) integrado com sucesso ao Bloco D (D100/D190)!`,
  };
}

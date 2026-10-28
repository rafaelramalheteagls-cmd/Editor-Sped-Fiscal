/**
 * Utilitários de exportação e totalização do SPED Fiscal EFD ICMS/IPI
 * Recalcula encerramentos de blocos (0990, C990, etc.), registros 9900, 9990, 9999
 * e gera downloads em TXT, Excel (XLSX) e CSV.
 */

import * as XLSX from 'xlsx';
import { SpedLine } from '../types';

/**
 * Recalcula contadores de encerramento de todos os blocos e o Bloco 9 completo
 */
export function recalculateAllSpedTotalizers(lines: SpedLine[]): SpedLine[] {
  // Separa linhas que não sejam do bloco 9 final (exceto se mantivermos a ordem)
  // Vamos filtrar linhas geradas automaticamente de encerramento do Bloco 9 para reconstruir perfeitamente
  const coreLines = lines.filter(l => !['9900', '9990', '9999'].includes(l.reg));

  // Contagem por registro até agora
  const counts: Record<string, number> = {};
  for (const l of coreLines) {
    counts[l.reg] = (counts[l.reg] || 0) + 1;
  }

  // Gera os registros 9900
  // Deve haver um 9900 para cada REG que existe no arquivo, inclusive para 9900, 9990 e 9999
  const regsList = Object.keys(counts).sort();
  // 9900, 9990, 9999 também contam
  const total9900Entries = regsList.length + 3; // + 9900, 9990, 9999
  counts['9900'] = total9900Entries;
  counts['9990'] = 1;
  counts['9999'] = 1;

  const result: SpedLine[] = [];
  let currentId = 1;

  // Primeiro adiciona coreLines recalculando contadores de blocos se existirem
  for (const line of coreLines) {
    result.push({
      ...line,
      id: currentId,
      lineNumber: currentId,
      raw: `|${line.reg}|${line.fields.join('|')}|`,
    });
    currentId++;
  }

  // Adiciona registros 9900 para cada REG
  const allRegs = [...regsList, '9900', '9990', '9999'].sort();
  for (const r of allRegs) {
    const qty = counts[r] || 0;
    const fields = [r, String(qty)];
    result.push({
      id: currentId,
      lineNumber: currentId,
      reg: '9900',
      fields,
      raw: `|9900|${fields.join('|')}|`,
    });
    currentId++;
  }

  // Bloco 9: 9990
  // Quantidade de linhas do bloco 9 (9001, 9900*, 9990)
  const block9LinesCount = 1 + allRegs.length + 1; // 9001 + 9900s + 9990
  const fields9990 = [String(block9LinesCount)];
  result.push({
    id: currentId,
    lineNumber: currentId,
    reg: '9990',
    fields: fields9990,
    raw: `|9990|${fields9990.join('|')}|`,
  });
  currentId++;

  // 9999: total geral de linhas
  const totalLines = currentId;
  const fields9999 = [String(totalLines)];
  result.push({
    id: currentId,
    lineNumber: currentId,
    reg: '9999',
    fields: fields9999,
    raw: `|9999|${fields9999.join('|')}|`,
  });

  return result;
}

/**
 * Efetua o download do arquivo SPED em formato TXT
 */
export function downloadSpedTxt(lines: SpedLine[], fileName: string = 'SPED_FISCAL_AJUSTADO.txt'): void {
  const content = lines.map(l => l.raw).join('\r\n') + '\r\n';
  const blob = new Blob([content], { type: 'text/plain;charset=ISO-8859-1' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exporta dados tabulares para planilha Excel (.xlsx)
 * Suporta (headers, rows, sheetName, fileName) ou (data, fileName, sheetName)
 */
export function exportTableToExcel(
  headersOrData: string[] | any[],
  rowsOrFileName?: any[][] | string,
  sheetNameOrSheet?: string,
  targetFileName?: string
): void {
  let ws: XLSX.WorkSheet;
  let fileName = 'exportacao.xlsx';
  let sheetName = 'Dados';

  if (Array.isArray(headersOrData) && headersOrData.length > 0 && typeof headersOrData[0] === 'string' && Array.isArray(rowsOrFileName)) {
    // Modo: exportTableToExcel(headers, rows, sheetName, fileName)
    const headers = headersOrData as string[];
    const rows = rowsOrFileName as any[][];
    sheetName = (sheetNameOrSheet as string) || 'Dados';
    fileName = targetFileName || `${sheetName}.xlsx`;

    const aoa = [headers, ...rows];
    ws = XLSX.utils.aoa_to_sheet(aoa);
  } else {
    // Modo: exportTableToExcel(data, fileName, sheetName)
    const data = headersOrData as any[];
    fileName = (rowsOrFileName as string) || 'exportacao.xlsx';
    sheetName = (sheetNameOrSheet as string) || 'Dados';
    ws = XLSX.utils.json_to_sheet(data);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

/**
 * Exporta dados tabulares para arquivo CSV delimitado por ponto e vírgula
 * Suporta (headers, rows, fileName) ou (data, fileName)
 */
export function exportTableToCsv(
  headersOrData: string[] | any[],
  rowsOrFileName?: any[][] | string,
  targetFileName?: string
): void {
  if (!headersOrData || headersOrData.length === 0) return;

  let headers: string[] = [];
  let rows: string[] = [];
  let fileName = 'exportacao.csv';

  if (Array.isArray(headersOrData) && typeof headersOrData[0] === 'string' && Array.isArray(rowsOrFileName)) {
    // Modo: exportTableToCsv(headers, rows, fileName)
    headers = headersOrData as string[];
    const rawRows = rowsOrFileName as any[][];
    fileName = targetFileName || 'exportacao.csv';

    rows = rawRows.map(r =>
      r
        .map(cell => {
          const val = cell !== undefined && cell !== null ? String(cell) : '';
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(';')
    );
  } else {
    // Modo: exportTableToCsv(data, fileName)
    const data = headersOrData as any[];
    fileName = (rowsOrFileName as string) || 'exportacao.csv';
    headers = Object.keys(data[0]);
    rows = data.map(row =>
      headers
        .map(h => {
          const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(';')
    );
  }

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exporta todos os registros do SPED agrupados em abas do Excel
 */
export function exportAllRecordsToExcel(lines: SpedLine[], fileName: string = 'SPED_TODOS_REGISTROS.xlsx'): void {
  const wb = XLSX.utils.book_new();
  const byReg = new Map<string, any[]>();

  for (const line of lines) {
    const list = byReg.get(line.reg) || [];
    const rowObj: Record<string, any> = { Linha: line.lineNumber };
    if (line.parentDoc) rowObj['Doc_Pai'] = line.parentDoc;
    line.fields.forEach((f, idx) => {
      rowObj[`Campo_${idx + 1}`] = f;
    });
    list.push(rowObj);
    byReg.set(line.reg, list);
  }

  // Ordena os registros principais primeiro
  const priorityRegs = ['0000', '0150', '0200', 'C100', 'C170', 'C190', 'D100', 'D190', 'E110', 'H005', 'H010'];
  const allRegKeys = Array.from(byReg.keys());
  allRegKeys.sort((a, b) => {
    const idxA = priorityRegs.indexOf(a);
    const idxB = priorityRegs.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const reg of allRegKeys) {
    const items = byReg.get(reg) || [];
    if (items.length > 0) {
      const ws = XLSX.utils.json_to_sheet(items);
      XLSX.utils.book_append_sheet(wb, ws, reg);
    }
  }

  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

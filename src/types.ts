/**
 * Type definitions for SPED Fiscal Editor Pro
 */

export interface SpedLine {
  id: number;
  lineNumber: number;
  reg: string;
  fields: string[];
  raw: string;
  parentId?: number;
  parentDoc?: string;
}

export interface SpedMetadata {
  fileName: string;
  fileSize: number;
  totalLines: number;
  codVer: string;
  codFin: string;
  periodoInicio: string;
  periodoFim: string;
  razaoSocial: string;
  cnpj: string;
  cpf: string;
  uf: string;
  ie: string;
  codMun: string;
  indPerfil: string;
  indAtiv: string;
  blocksCount: Record<string, number>;
  recordsCount: Record<string, number>;
}

export interface CfopRecordDetail {
  lineNumber: number;
  parentType: string;
  parentDoc: string;
  cfop: string;
  aliquota: number;
  valorOperacao: number;
  baseIcms: number;
  valorIcms: number;
}

export interface CfopSummaryItem {
  cfop: string;
  tipo: 'ENTRADA' | 'SAIDA';
  count: number;
  totalOperacao: number;
  baseIcms: number;
  valorIcms: number;
  records: CfopRecordDetail[];
}

export interface CfopTotals {
  totalEntradas: number;
  totalSaidas: number;
  baseIcmsEntradas: number;
  baseIcmsSaidas: number;
  valorIcmsEntradas: number;
  valorIcmsSaidas: number;
}

export type ValidationSeverity = 'ERRO' | 'ADVERTENCIA' | 'INFO';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code: string;
  record: string;
  field?: string;
  line?: number;
  message: string;
  pvaRuleId?: string;
  pvaGuidance?: string;
  difference?: {
    expected: number;
    found: number;
    fieldName?: string;
  };
  canFix?: boolean;
  fixAction?: 
    | 'clean_0200' 
    | 'fix_whitespace_0200' 
    | 'fix_c100_structure'
    | 'fix_missing_tipo_item_0200'
    | 'fix_missing_d100_municipios'
    | 'fix_missing_0150_municipios'
    | 'fix_d100_participant_mismatch'
    | 'clean_unused_0150'
    | 'normalize_simples_cst102'
    | 'fix_all_pva_errors';
  relatedLines?: number[];
}

export interface HistoryEntry {
  description: string;
  timestamp: number;
  lines: SpedLine[];
}

export interface CteData {
  chvCte: string;
  nCT: string;
  serie: string;
  dhEmi: string;
  cfop: string;
  vPrest: number;
  modal: string;
  cMunIni: string;
  xMunIni: string;
  cMunFim: string;
  xMunFim: string;
  emit: {
    cnpj: string;
    ie: string;
    xNome: string;
    xLgr: string;
    nro: string;
    xBairro: string;
    cMun: string;
    xMun: string;
    cep: string;
    uf: string;
    rntrc?: string;
  };
  dest: {
    cnpj: string;
    ie: string;
    xNome: string;
  };
}

import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Wand2, 
  ExternalLink, 
  RefreshCw, 
  Filter, 
  Sparkles,
  BookOpen,
  Info,
  Search,
  X,
  FileCheck2,
  HelpCircle
} from 'lucide-react';
import { ValidationIssue } from '../types';
import { CST_ICMS_CATALOG, CstDefinition } from '../lib/cstDatabase';

interface ValidationTabProps {
  issues: ValidationIssue[];
  onRevalidate: () => void;
  onFixWhitespace0200: () => void;
  onCleanUnused0200: () => void;
  onFixInvoiceStructure?: () => void;
  onNavigateToRecord: (reg: string, lineId?: number) => void;
}

export const ValidationTab: React.FC<ValidationTabProps> = ({
  issues,
  onRevalidate,
  onFixWhitespace0200,
  onCleanUnused0200,
  onFixInvoiceStructure,
  onNavigateToRecord,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'ERRO' | 'ADVERTENCIA' | 'INFO'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [showCstGuide, setShowCstGuide] = useState(false);
  const [cstSearch, setCstSearch] = useState('');
  const [cstCategoryFilter, setCstCategoryFilter] = useState<'ALL' | 'MONOFASICO' | 'CSOSN' | 'NORMAL'>('ALL');

  const errors = issues.filter(i => i.severity === 'ERRO');
  const warnings = issues.filter(i => i.severity === 'ADVERTENCIA');
  const infos = issues.filter(i => i.severity === 'INFO');

  const filteredIssues = issues.filter(issue => {
    if (filterSeverity !== 'ALL' && issue.severity !== filterSeverity) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        issue.message.toLowerCase().includes(q) ||
        issue.record.toLowerCase().includes(q) ||
        (issue.field && issue.field.toLowerCase().includes(q)) ||
        (issue.line && issue.line.toString().includes(q))
      );
    }
    return true;
  });

  // Filter CST Catalog for the interactive guide
  const filteredCstList = useMemo(() => {
    const list = Object.values(CST_ICMS_CATALOG);
    return list.filter(item => {
      if (cstCategoryFilter === 'MONOFASICO' && item.category !== 'ICMS_MONOFASICO') return false;
      if (cstCategoryFilter === 'CSOSN' && item.category !== 'CSOSN') return false;
      if (cstCategoryFilter === 'NORMAL' && item.category !== 'ICMS_NORMAL') return false;

      if (cstSearch.trim()) {
        const q = cstSearch.toLowerCase();
        return (
          item.code.toLowerCase().includes(q) ||
          item.shortDesc.toLowerCase().includes(q) ||
          item.fullDesc.toLowerCase().includes(q) ||
          item.legalBase.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cstSearch, cstCategoryFilter]);

  return (
    <div className="space-y-6 pb-12 transition-colors">
      {/* Top Banner Status */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
        <div className="flex items-center space-x-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            errors.length === 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
          }`}>
            {errors.length === 0 ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {errors.length === 0
                  ? 'Arquivo em conformidade com as regras do PVA'
                  : `${errors.length} erro(s) fiscal(is) detectado(s)`}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Guia Prático EFD v3.2.x
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Validações oficiais atualizadas conforme Ato COTEPE/ICMS, Ajuste SINIEF 01/2023 (Monofásico 061, 02, 15, 53) e Simples Nacional (CSOSN 101, 202...).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={() => setShowCstGuide(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
            title="Consulte a tabela oficial de CST 061, 101, 202 e regras do PVA"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Tabela CST / CSOSN</span>
          </button>

          <button
            onClick={onRevalidate}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Revalidar</span>
          </button>

          {issues.some(i => i.fixAction === 'fix_whitespace_0200') && (
            <button
              onClick={onFixWhitespace0200}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Corrigir Espaços (0200)</span>
            </button>
          )}

          {issues.some(i => i.fixAction === 'clean_0200') && (
            <button
              onClick={onCleanUnused0200}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Limpar 0200 Não Utilizados</span>
            </button>
          )}

          {issues.some(i => i.fixAction === 'fix_c100_structure') && onFixInvoiceStructure && (
            <button
              onClick={onFixInvoiceStructure}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
              title="Reordena C170 e C190 antes de C195 e C197 conforme Guia Prático do PVA e recalcula totalizadores"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Corrigir Estrutura das Notas (C170/C190)</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setFilterSeverity('ALL')}
          className={`p-4 rounded-xl border text-left transition cursor-pointer ${
            filterSeverity === 'ALL'
              ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-700 shadow'
              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wider opacity-80">Total de Ocorrências</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{issues.length}</div>
        </button>

        <button
          onClick={() => setFilterSeverity('ERRO')}
          className={`p-4 rounded-xl border text-left transition cursor-pointer ${
            filterSeverity === 'ERRO'
              ? 'bg-red-600 text-white border-red-600 shadow'
              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wider opacity-80 flex items-center space-x-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Erros Críticos</span>
          </div>
          <div className={`text-2xl font-bold mt-1 tabular-nums ${filterSeverity === 'ERRO' ? 'text-white' : 'text-red-600 dark:text-red-400'}`}>{errors.length}</div>
        </button>

        <button
          onClick={() => setFilterSeverity('ADVERTENCIA')}
          className={`p-4 rounded-xl border text-left transition cursor-pointer ${
            filterSeverity === 'ADVERTENCIA'
              ? 'bg-amber-500 text-white border-amber-500 shadow'
              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wider opacity-80 flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Advertências</span>
          </div>
          <div className={`text-2xl font-bold mt-1 tabular-nums ${filterSeverity === 'ADVERTENCIA' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`}>{warnings.length}</div>
        </button>

        <button
          onClick={() => setFilterSeverity('INFO')}
          className={`p-4 rounded-xl border text-left transition cursor-pointer ${
            filterSeverity === 'INFO'
              ? 'bg-blue-600 text-white border-blue-600 shadow'
              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wider opacity-80 flex items-center space-x-1">
            <Info className="w-3.5 h-3.5" />
            <span>Informativos EFD</span>
          </div>
          <div className={`text-2xl font-bold mt-1 tabular-nums ${filterSeverity === 'INFO' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}>{infos.length}</div>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 transition-colors">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Lista de Inconsistências ({filteredIssues.length})
          </div>
          <div className="relative w-full sm:w-72">
            <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Filtrar por CST, registro, linha ou mensagem..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma inconsistência encontrada nesta visualização</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">O arquivo atende aos critérios do Guia Prático da EFD ICMS/IPI.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-24">Severidade</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-20">Registro</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-16">Linha</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-28">Campo</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300">Descrição do Erro / Regra Fiscal</th>
                  <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300 w-28">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredIssues.map(issue => (
                  <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {issue.severity === 'ERRO' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                          ERRO
                        </span>
                      )}
                      {issue.severity === 'ADVERTENCIA' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          AVISO
                        </span>
                      )}
                      {issue.severity === 'INFO' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          INFO
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {issue.record}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                      {issue.relatedLines && issue.relatedLines.length > 1 ? (
                        <span className="text-slate-800 dark:text-slate-200 font-semibold" title={`Linhas: ${issue.relatedLines.join(', ')}`}>
                          {issue.relatedLines.join(', ')}
                        </span>
                      ) : (
                        issue.line || '-'
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {issue.field || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-md">
                      {issue.message}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end space-x-2">
                        {issue.canFix && (
                          <button
                            onClick={() => {
                              if (issue.fixAction === 'fix_whitespace_0200') onFixWhitespace0200();
                              else if (issue.fixAction === 'clean_0200') onCleanUnused0200();
                              else if (issue.fixAction === 'fix_c100_structure' && onFixInvoiceStructure) onFixInvoiceStructure();
                            }}
                            className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-medium text-[11px] border border-emerald-200 dark:border-emerald-800 cursor-pointer transition"
                          >
                            Auto-Corrigir
                          </button>
                        )}
                        {issue.relatedLines && issue.relatedLines.length > 1 ? (
                          <div className="inline-flex items-center space-x-1">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mr-1">Ver {issue.record}:</span>
                            {issue.relatedLines.map(lineNum => (
                              <button
                                key={lineNum}
                                onClick={() => onNavigateToRecord(issue.record, lineNum)}
                                className="inline-flex items-center space-x-1 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded text-[11px] font-mono font-semibold border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition cursor-pointer"
                                title={`Abrir ${issue.record} na linha ${lineNum} selecionada no Editor`}
                              >
                                <span>Linha {lineNum}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            onClick={() => onNavigateToRecord(issue.record, issue.line)}
                            className="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded text-[11px] font-medium border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition cursor-pointer"
                            title={issue.line ? `Abrir linha ${issue.line} (${issue.record}) selecionada no Editor` : `Abrir registro ${issue.record} no Editor`}
                          >
                            <span>Ver no Editor</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal / Dialog: Tabela Oficial de CSTs e CSOSNs */}
      {showCstGuide && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 transition-colors">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Tabela Oficial de CSTs & CSOSNs da EFD ICMS/IPI
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ato COTEPE/ICMS nº 09/2008, Ajuste SINIEF 01/2023 (Combustíveis Monofásicos) e LC 123/2006
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCstGuide(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Filter Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setCstCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    cstCategoryFilter === 'ALL'
                      ? 'bg-slate-900 dark:bg-slate-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Todos ({Object.keys(CST_ICMS_CATALOG).length})
                </button>
                <button
                  onClick={() => setCstCategoryFilter('MONOFASICO')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    cstCategoryFilter === 'MONOFASICO'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  ⚡ Monofásico Combustíveis (061, 002, 015, 053...)
                </button>
                <button
                  onClick={() => setCstCategoryFilter('CSOSN')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    cstCategoryFilter === 'CSOSN'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800'
                  }`}
                >
                  🏢 Simples Nacional (101, 202, 500...)
                </button>
                <button
                  onClick={() => setCstCategoryFilter('NORMAL')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    cstCategoryFilter === 'NORMAL'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  ICMS Normal (000, 020, 060...)
                </button>
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={cstSearch}
                  onChange={e => setCstSearch(e.target.value)}
                  placeholder="Pesquisar CST (ex: 061, 101, 202)..."
                  className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredCstList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                  Nenhum código encontrado com o termo "{cstSearch}".
                </div>
              ) : (
                filteredCstList.map(item => (
                  <div 
                    key={item.code} 
                    className={`p-3 rounded-xl border transition ${
                      item.code === '061' || item.code === '101' || item.code === '202'
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold bg-slate-900 dark:bg-slate-700 text-white px-2 py-0.5 rounded">
                          {item.code}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {item.shortDesc}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        {item.category === 'ICMS_MONOFASICO' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Combustíveis Monofásico (LC 192/22)
                          </span>
                        )}
                        {item.category === 'CSOSN' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Simples Nacional
                          </span>
                        )}
                        {item.category === 'ICMS_NORMAL' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Regime Geral (Normal)
                          </span>
                        )}
                        {item.permiteCredito && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            Gera Crédito
                          </span>
                        )}
                        {item.exigeStZero && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                            VL_ICMS_ST = 0,00
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {item.fullDesc}
                    </p>

                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <div>
                        <strong className="text-slate-700 dark:text-slate-300">Base Legal: </strong>
                        <span>{item.legalBase}</span>
                      </div>
                      {item.observacao && (
                        <div className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200/60 dark:border-amber-800 font-medium">
                          {item.observacao}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total de {filteredCstList.length} código(s) exibidos</span>
              <button
                onClick={() => setShowCstGuide(false)}
                className="px-4 py-1.5 rounded-md bg-slate-900 dark:bg-slate-800 text-white font-medium hover:bg-slate-800 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

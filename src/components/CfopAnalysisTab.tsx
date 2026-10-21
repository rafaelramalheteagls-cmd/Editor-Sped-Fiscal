import React, { useState } from 'react';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  FileSpreadsheet, 
  Table as TableIcon,
  Receipt,
  Download,
  Printer
} from 'lucide-react';
import { CfopSummaryItem, CfopTotals } from '../types';
import { formatCurrencyBRL } from '../lib/spedParser';
import { exportTableToExcel, exportTableToCsv } from '../lib/spedExporter';

interface CfopAnalysisTabProps {
  entradas: CfopSummaryItem[];
  saidas: CfopSummaryItem[];
  totals: CfopTotals;
  onOpenPdfModal?: (reportType?: 'cfop_consolidated' | 'general', operacao?: 'ENTRADA' | 'SAIDA' | 'TODAS') => void;
}

// Common CFOP descriptions dictionary for quick reference
const CFOP_DESCRIPTIONS: Record<string, string> = {
  '1101': 'Compra para industrialização',
  '1102': 'Compra para comercialização',
  '1202': 'Devolução de venda de mercadoria adquirida de terceiros',
  '1301': 'Aquisição de serviço de comunicação para prestação da mesma natureza',
  '1302': 'Aquisição de serviço de comunicação por estabelecimento industrial',
  '1303': 'Aquisição de serviço de comunicação por estabelecimento comercial',
  '1304': 'Aquisição de serviço de comunicação por estabelecimento prestador de transporte',
  '1305': 'Aquisição de serviço de comunicação por estabelecimento de produtor rural',
  '1306': 'Aquisição de serviço de comunicação por geradora/distribuidora de energia',
  '1352': 'Aquisição de serviço de transporte por estabelecimento industrial',
  '1353': 'Aquisição de serviço de transporte por estabelecimento comercial',
  '1403': 'Compra para comercialização em operação com ICMS-ST',
  '1556': 'Compra de material para uso ou consumo',
  '1949': 'Outra entrada de mercadoria ou prestação de serviço não especificada',
  '2101': 'Compra para industrialização de outro Estado',
  '2102': 'Compra para comercialização de outro Estado',
  '2301': 'Aquisição de serviço de comunicação de outro Estado para prestação mesma natureza',
  '2302': 'Aquisição de serviço de comunicação por estabelecimento industrial de outro Estado',
  '2303': 'Aquisição de serviço de comunicação por estabelecimento comercial de outro Estado',
  '2352': 'Aquisição de serviço de transporte por estabelecimento industrial de outro Estado',
  '2353': 'Aquisição de serviço de transporte de outro Estado',
  '2403': 'Compra para comercialização com ICMS-ST de outro Estado',
  '2556': 'Compra de material para uso ou consumo de outro Estado',
  '5101': 'Venda de produção do estabelecimento',
  '5102': 'Venda de mercadoria adquirida de terceiros',
  '5202': 'Devolução de compra para comercialização',
  '5301': 'Prestação de serviço de comunicação para prestação mesma natureza',
  '5302': 'Prestação de serviço de comunicação a estabelecimento industrial',
  '5303': 'Prestação de serviço de comunicação a estabelecimento comercial',
  '5307': 'Prestação de serviço de comunicação a não contribuinte',
  '5405': 'Venda de mercadoria com ICMS retido por Substituição Tributária',
  '5929': 'Lançamento efetuado em decorrência de emissão de documento fiscal',
  '5949': 'Outra saída de mercadoria ou prestação de serviço não especificada',
  '6101': 'Venda de produção para outro Estado',
  '6102': 'Venda de mercadoria para outro Estado',
  '6301': 'Prestação de serviço de comunicação a outro Estado para prestação mesma natureza',
  '6302': 'Prestação de serviço de comunicação a estabelecimento industrial de outro Estado',
  '6303': 'Prestação de serviço de comunicação a estabelecimento comercial de outro Estado',
  '6307': 'Prestação de serviço de comunicação a não contribuinte de outro Estado',
  '6403': 'Venda de mercadoria com ICMS-ST para outro Estado',
};

export const CfopAnalysisTab: React.FC<CfopAnalysisTabProps> = ({
  entradas,
  saidas,
  totals,
  onOpenPdfModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'entradas' | 'saidas'>('geral');
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedCfop, setExpandedCfop] = useState<string | null>(null);

  const filterList = (list: CfopSummaryItem[]) => {
    if (!filterQuery.trim()) return list;
    const q = filterQuery.toLowerCase().trim();
    return list.filter(item => {
      const desc = (CFOP_DESCRIPTIONS[item.cfop] || '').toLowerCase();
      return item.cfop.includes(q) || desc.includes(q);
    });
  };

  const filteredEntradas = filterList(entradas);
  const filteredSaidas = filterList(saidas);

  const handleExportExcel = (items: CfopSummaryItem[], title: string) => {
    const headers = ['CFOP', 'Tipo', 'Descrição', 'Qtd Registros', 'Total Operação (R$)', 'Base ICMS (R$)', 'Valor ICMS (R$)'];
    const rows = items.map(i => [
      i.cfop,
      i.tipo,
      CFOP_DESCRIPTIONS[i.cfop] || 'Outras operações',
      i.count,
      i.totalOperacao,
      i.baseIcms,
      i.valorIcms,
    ]);
    exportTableToExcel(headers, rows, title, `CFOP_${title}.xlsx`);
  };

  const handleExportCsv = (items: CfopSummaryItem[], title: string) => {
    const headers = ['CFOP', 'Tipo', 'Descrição', 'Qtd Registros', 'Total Operação', 'Base ICMS', 'Valor ICMS'];
    const rows = items.map(i => [
      i.cfop,
      i.tipo,
      CFOP_DESCRIPTIONS[i.cfop] || 'Outras operações',
      i.count,
      i.totalOperacao.toFixed(2),
      i.baseIcms.toFixed(2),
      i.valorIcms.toFixed(2),
    ]);
    exportTableToCsv(headers, rows, `CFOP_${title}.csv`);
  };

  const renderCfopTable = (items: CfopSummaryItem[], isEntrada: boolean) => {
    const grandTotal = isEntrada ? totals.totalEntradas : totals.totalSaidas;

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="w-10 px-3 py-2 text-left font-bold text-slate-500 dark:text-slate-400"></th>
              <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300">CFOP</th>
              <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300">Descrição Comercial</th>
              <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300">Qtd</th>
              <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300">Total Operação</th>
              <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300">Base ICMS</th>
              <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300">Valor ICMS</th>
              <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300">% Part.</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
            {items.map(item => {
              const isExpanded = expandedCfop === item.cfop;
              const pct = grandTotal > 0 ? (item.totalOperacao / grandTotal) * 100 : 0;
              const desc = CFOP_DESCRIPTIONS[item.cfop] || 'Outras operações fiscais';

              return (
                <React.Fragment key={item.cfop}>
                  <tr 
                    onClick={() => setExpandedCfop(isExpanded ? null : item.cfop)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer select-none"
                  >
                    <td className="px-3 py-2 text-slate-400 dark:text-slate-500">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">
                      <span className={`px-1.5 py-0.5 rounded ${
                        isEntrada 
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40' 
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40'
                      }`}>
                        {item.cfop}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 font-sans max-w-xs truncate" title={desc}>
                      {desc}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                      {item.count}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatCurrencyBRL(item.totalOperacao)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatCurrencyBRL(item.baseIcms)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatCurrencyBRL(item.valorIcms)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                      {pct.toFixed(1)}%
                    </td>
                  </tr>

                  {/* Expanded Document Details */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 dark:bg-slate-800/40 p-4 border-y border-slate-200 dark:border-slate-800">
                        <div className="text-xs font-sans font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
                          <span>Detalhamento dos Documentos vinculados ao CFOP {item.cfop} ({item.records.length} registros)</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">C190 / D190 / C590 / D590 / D730</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-[11px] font-mono">
                            <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                              <tr>
                                <th className="px-2.5 py-1.5 text-left text-slate-600 dark:text-slate-400">Linha</th>
                                <th className="px-2.5 py-1.5 text-left text-slate-600 dark:text-slate-400">Tipo</th>
                                <th className="px-2.5 py-1.5 text-left text-slate-600 dark:text-slate-400">NF / Doc Pai</th>
                                <th className="px-2.5 py-1.5 text-right text-slate-600 dark:text-slate-400">Alíquota</th>
                                <th className="px-2.5 py-1.5 text-right text-slate-600 dark:text-slate-400">Valor Operação</th>
                                <th className="px-2.5 py-1.5 text-right text-slate-600 dark:text-slate-400">Base ICMS</th>
                                <th className="px-2.5 py-1.5 text-right text-slate-600 dark:text-slate-400">Valor ICMS</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {item.records.map((rec, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                  <td className="px-2.5 py-1 text-slate-400 dark:text-slate-500 tabular-nums">{rec.lineNumber}</td>
                                  <td className="px-2.5 py-1 text-slate-600 dark:text-slate-300 font-semibold">{rec.parentType}</td>
                                  <td className="px-2.5 py-1 text-indigo-700 dark:text-indigo-400 font-bold">{rec.parentDoc}</td>
                                  <td className="px-2.5 py-1 text-right text-slate-600 dark:text-slate-400 tabular-nums">{rec.aliquota.toFixed(2)}%</td>
                                  <td className="px-2.5 py-1 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrencyBRL(rec.valorOperacao)}</td>
                                  <td className="px-2.5 py-1 text-right text-slate-700 dark:text-slate-300 tabular-nums">{formatCurrencyBRL(rec.baseIcms)}</td>
                                  <td className="px-2.5 py-1 text-right font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurrencyBRL(rec.valorIcms)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 transition-colors">
      {/* Top Controls & Sub-tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
        {/* Navigation buttons */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-stretch sm:self-auto text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('geral')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              activeSubTab === 'geral' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveSubTab('entradas')}
            className={`px-3 py-1.5 rounded-md transition flex items-center space-x-1 cursor-pointer ${
              activeSubTab === 'entradas' 
                ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm font-semibold' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Entradas ({entradas.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('saidas')}
            className={`px-3 py-1.5 rounded-md transition flex items-center space-x-1 cursor-pointer ${
              activeSubTab === 'saidas' 
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm font-semibold' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Saídas ({saidas.length})</span>
          </button>
        </div>

        {/* Filter and Export buttons */}
        <div className="flex items-center space-x-2 self-stretch sm:self-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              placeholder="Buscar CFOP ou texto..."
              className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <button
            onClick={() => {
              if (activeSubTab === 'entradas') handleExportExcel(entradas, 'Entradas');
              else if (activeSubTab === 'saidas') handleExportExcel(saidas, 'Saidas');
              else handleExportExcel([...entradas, ...saidas], 'Geral');
            }}
            title="Exportar para Excel (.xlsx)"
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>

          <button
            onClick={() => {
              if (activeSubTab === 'entradas') handleExportCsv(entradas, 'Entradas');
              else if (activeSubTab === 'saidas') handleExportCsv(saidas, 'Saidas');
              else handleExportCsv([...entradas, ...saidas], 'Geral');
            }}
            title="Exportar para CSV (ponto e vírgula)"
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
          >
            <TableIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>

          {onOpenPdfModal && (
            <button
              onClick={() => {
                const op = activeSubTab === 'entradas' ? 'ENTRADA' : activeSubTab === 'saidas' ? 'SAIDA' : 'TODAS';
                onOpenPdfModal('cfop_consolidated', op);
              }}
              title="Gerar Relatório Consolidado em PDF (A4 Paisagem)"
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-xs border border-transparent dark:border-slate-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Relatório PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Overview View (Geral) */}
      {activeSubTab === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Entradas Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
            <div className="p-4 bg-blue-50/50 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowDownRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Operações de Entrada (CFOPs 1.xxx, 2.xxx, 3.xxx)</h3>
              </div>
              <span className="font-mono font-bold text-sm text-blue-900 dark:text-blue-300 tabular-nums">
                {formatCurrencyBRL(totals.totalEntradas)}
              </span>
            </div>
            <div className="p-2 flex-1">
              {renderCfopTable(filteredEntradas, true)}
            </div>
          </div>

          {/* Saídas Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Operações de Saída (CFOPs 5.xxx, 6.xxx, 7.xxx)</h3>
              </div>
              <span className="font-mono font-bold text-sm text-emerald-900 dark:text-emerald-300 tabular-nums">
                {formatCurrencyBRL(totals.totalSaidas)}
              </span>
            </div>
            <div className="p-2 flex-1">
              {renderCfopTable(filteredSaidas, false)}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Entradas View */}
      {activeSubTab === 'entradas' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <ArrowDownRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Detalhamento Completo de Entradas</span>
            </h3>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Total Entradas: <strong className="text-slate-800 dark:text-slate-200 font-semibold tabular-nums">{formatCurrencyBRL(totals.totalEntradas)}</strong>
            </div>
          </div>
          {renderCfopTable(filteredEntradas, true)}
        </div>
      )}

      {/* Detailed Saídas View */}
      {activeSubTab === 'saidas' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Detalhamento Completo de Saídas</span>
            </h3>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Total Saídas: <strong className="text-slate-800 dark:text-slate-200 font-semibold tabular-nums">{formatCurrencyBRL(totals.totalSaidas)}</strong>
            </div>
          </div>
          {renderCfopTable(filteredSaidas, false)}
        </div>
      )}
    </div>
  );
};

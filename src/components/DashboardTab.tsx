import React from 'react';
import { 
  Building2, 
  Calendar, 
  FileSpreadsheet, 
  TrendingDown, 
  TrendingUp, 
  Scale, 
  Receipt, 
  Layers, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart
} from 'lucide-react';
import { SpedMetadata, CfopSummaryItem, CfopTotals } from '../types';
import { formatCurrencyBRL, formatCnpjCpf, formatDateSped } from '../lib/spedParser';
import { SPED_BLOCK_DESCRIPTIONS } from '../lib/spedLayout';

interface DashboardTabProps {
  metadata: SpedMetadata | null;
  cfopEntradas: CfopSummaryItem[];
  cfopSaidas: CfopSummaryItem[];
  totals: CfopTotals;
  validationErrorCount: number;
  validationWarningCount: number;
  onNavigateToTab: (tab: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  metadata,
  cfopEntradas,
  cfopSaidas,
  totals,
  validationErrorCount,
  validationWarningCount,
  onNavigateToTab,
}) => {
  if (!metadata) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm my-6 transition-colors">
        <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500 mb-3" />
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Nenhum arquivo SPED carregado</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Faça o upload de um arquivo SPED Fiscal (.txt) ou clique no botão &ldquo;Exemplo&rdquo; no topo para explorar as ferramentas do editor.
        </p>
      </div>
    );
  }

  const saldoComercial = totals.totalSaidas - totals.totalEntradas;
  const saldoIcms = totals.valorIcmsSaidas - totals.valorIcmsEntradas;
  const topEntradas = cfopEntradas.slice(0, 8);
  const topSaidas = cfopSaidas.slice(0, 8);

  const totalBlockRecords = Object.values(metadata.blocksCount).reduce((acc, c) => acc + c, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Company & Period Overview Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0 shadow-sm border border-slate-800 dark:border-slate-700">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{metadata.razaoSocial}</h1>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Perfil {metadata.indPerfil || 'A'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                <span>CNPJ: <strong className="text-slate-700 dark:text-slate-300">{formatCnpjCpf(metadata.cnpj) || formatCnpjCpf(metadata.cpf) || 'N/A'}</strong></span>
                <span>IE: <strong className="text-slate-700 dark:text-slate-300">{metadata.ie || 'ISENTO'}</strong></span>
                <span>UF: <strong className="text-slate-700 dark:text-slate-300">{metadata.uf || 'N/A'}</strong></span>
                <span>Município IBGE: <strong className="text-slate-700 dark:text-slate-300">{metadata.codMun || 'N/A'}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-700/60 self-start lg:self-auto text-xs">
            <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Período Fiscal</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDateSped(metadata.periodoInicio)} até {formatDateSped(metadata.periodoFim)}
                </div>
              </div>
            </div>
            <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Versão Layout</div>
              <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">{metadata.codVer || '020'}</div>
            </div>
          </div>
        </div>

        {/* Quick Integrity & Validation Banner */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Validação SEFAZ / PVA:</span>
            {validationErrorCount === 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                0 Erros Estruturais
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 font-semibold">
                {validationErrorCount} Erro(s) encontrado(s)
              </span>
            )}
            {validationWarningCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                {validationWarningCount} Advertência(s)
              </span>
            )}
          </div>

          <button
            onClick={() => onNavigateToTab('validacao')}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-medium text-xs hover:underline flex items-center space-x-1"
          >
            <span>Verificar Regras PVA</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Entradas */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Entradas</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono tabular-nums">
              {formatCurrencyBRL(totals.totalEntradas)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>ICMS Crédito:</span>
              <strong className="text-blue-700 dark:text-blue-400 font-semibold font-mono">{formatCurrencyBRL(totals.valorIcmsEntradas)}</strong>
            </div>
          </div>
        </div>

        {/* Saídas */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Saídas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono tabular-nums">
              {formatCurrencyBRL(totals.totalSaidas)}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>ICMS Débito:</span>
              <strong className="text-emerald-700 dark:text-emerald-400 font-semibold font-mono">{formatCurrencyBRL(totals.valorIcmsSaidas)}</strong>
            </div>
          </div>
        </div>

        {/* Balanço Comercial */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Balanço Operacional</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              saldoComercial >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
            }`}>
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold tracking-tight font-mono tabular-nums ${
              saldoComercial >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {formatCurrencyBRL(saldoComercial)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {saldoComercial >= 0 ? 'Superávit comercial nas operações' : 'Déficit comercial no período'}
            </div>
          </div>
        </div>

        {/* Saldo de ICMS */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Saldo de ICMS Estimado</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              saldoIcms >= 0 ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
            }`}>
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold tracking-tight font-mono tabular-nums ${
              saldoIcms >= 0 ? 'text-amber-800 dark:text-amber-300' : 'text-indigo-800 dark:text-indigo-300'
            }`}>
              {formatCurrencyBRL(Math.abs(saldoIcms))}
            </div>
            <div className="mt-1 text-xs font-medium">
              {saldoIcms >= 0 ? (
                <span className="text-amber-700 dark:text-amber-400">ICMS a Recolher (Débito maior)</span>
              ) : (
                <span className="text-indigo-700 dark:text-indigo-400">Saldo Credor a Transportar</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Top CFOPs and Block Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top CFOPs de Entrada */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 flex flex-col transition-colors">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center space-x-2">
              <ArrowDownRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Top CFOPs de Entrada</span>
            </h3>
            <button
              onClick={() => onNavigateToTab('cfop')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
            >
              Ver todos
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[320px] divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {topEntradas.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">Nenhum registro de entrada analítico</div>
            ) : (
              topEntradas.map((item) => {
                const pct = totals.totalEntradas > 0 ? (item.totalOperacao / totals.totalEntradas) * 100 : 0;
                return (
                  <div key={item.cfop} className="py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded text-[11px] text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
                        {item.cfop}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                        {formatCurrencyBRL(item.totalOperacao)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      <span>{item.count} doc(s)</span>
                      <span>{pct.toFixed(1)}% do total</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top CFOPs de Saída */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 flex flex-col transition-colors">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center space-x-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Top CFOPs de Saída</span>
            </h3>
            <button
              onClick={() => onNavigateToTab('cfop')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
            >
              Ver todos
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[320px] divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {topSaidas.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">Nenhum registro de saída analítico</div>
            ) : (
              topSaidas.map((item) => {
                const pct = totals.totalSaidas > 0 ? (item.totalOperacao / totals.totalSaidas) * 100 : 0;
                return (
                  <div key={item.cfop} className="py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded text-[11px] text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
                        {item.cfop}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono tabular-nums">
                        {formatCurrencyBRL(item.totalOperacao)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      <span>{item.count} doc(s)</span>
                      <span>{pct.toFixed(1)}% do total</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-emerald-600 dark:bg-emerald-500 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Records Distribution by Block */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 flex flex-col transition-colors">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Distribuição por Bloco</span>
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-semibold">
              {metadata.totalLines.toLocaleString('pt-BR')} linhas
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[320px] divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {Object.entries(metadata.blocksCount).map(([block, count]) => {
              const pct = totalBlockRecords > 0 ? (count / totalBlockRecords) * 100 : 0;
              const desc = SPED_BLOCK_DESCRIPTIONS[block] || `Bloco ${block}`;
              return (
                <div key={block} className="py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={desc}>
                      {desc}
                    </span>
                    <span className="font-semibold font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {count.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mb-1">
                    <span>{pct.toFixed(1)}% do arquivo</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-purple-600 dark:bg-purple-500 h-1.5 rounded-full" 
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

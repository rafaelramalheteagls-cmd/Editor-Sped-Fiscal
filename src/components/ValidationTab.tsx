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
  HelpCircle,
  Binary,
  Layers,
  Calculator
} from 'lucide-react';
import { ValidationIssue } from '../types';
import { CST_ICMS_CATALOG } from '../lib/cstDatabase';
import { PVA_RULES_CATALOG, PvaRuleDefinition, getPvaRule } from '../lib/pvaRulesCatalog';
import { formatCurrencyBRL } from '../lib/spedParser';

interface ValidationTabProps {
  issues: ValidationIssue[];
  onRevalidate: () => void;
  onFixWhitespace0200: () => void;
  onCleanUnused0200: () => void;
  onFixInvoiceStructure?: () => void;
  onFixMissingTipoItem0200?: () => void;
  onFixMissingD100Municipios?: () => void;
  onFixMissing0150Municipios?: () => void;
  onFixD100ParticipantMismatch?: () => void;
  onCleanUnused0150?: () => void;
  onNormalizeSimplesCst102?: () => void;
  onFixC190VlOprBalance?: () => void;
  onFixAllPvaReportErrors?: () => void;
  onNavigateToRecord: (reg: string, lineId?: number) => void;
}

export const ValidationTab: React.FC<ValidationTabProps> = ({
  issues,
  onRevalidate,
  onFixWhitespace0200,
  onCleanUnused0200,
  onFixInvoiceStructure,
  onFixMissingTipoItem0200,
  onFixMissingD100Municipios,
  onFixMissing0150Municipios,
  onFixD100ParticipantMismatch,
  onCleanUnused0150,
  onNormalizeSimplesCst102,
  onFixC190VlOprBalance,
  onFixAllPvaReportErrors,
  onNavigateToRecord,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'ERRO' | 'ADVERTENCIA' | 'INFO'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  
  // Modal CST
  const [showCstGuide, setShowCstGuide] = useState(false);
  const [cstSearch, setCstSearch] = useState('');
  const [cstCategoryFilter, setCstCategoryFilter] = useState<'ALL' | 'MONOFASICO' | 'CSOSN' | 'NORMAL'>('ALL');

  // Modal Catálogo Regras PVA
  const [showPvaCatalog, setShowPvaCatalog] = useState(false);
  const [pvaCatalogSearch, setPvaCatalogSearch] = useState('');
  const [pvaCategoryFilter, setPvaCategoryFilter] = useState<'ALL' | 'APURACAO_ICMS' | 'DOCUMENTO_FISCAL' | 'BLOCO_K'>('ALL');

  // Modal Detalhes da Regra Selecionada
  const [selectedPvaRule, setSelectedPvaRule] = useState<PvaRuleDefinition | null>(null);

  const errors = issues.filter(i => i.severity === 'ERRO');
  const warnings = issues.filter(i => i.severity === 'ADVERTENCIA');
  const infos = issues.filter(i => i.severity === 'INFO');
  const pvaIssuesCount = issues.filter(i => Boolean(i.pvaRuleId)).length;

  // Estatísticas dinâmicas de inconsistências corrigíveis nesta base carregada
  const fixableStats = useMemo(() => {
    const c190Opr = issues.filter(i => i.fixAction === 'fix_c190_vl_opr_balance').length;
    const d100Part = issues.filter(i => i.fixAction === 'fix_d100_participant_mismatch').length;
    const d100Mun = issues.filter(i => i.fixAction === 'fix_missing_d100_municipios').length;
    const tipoItem0200 = issues.filter(i => i.fixAction === 'fix_missing_tipo_item_0200').length;
    const codMun0150 = issues.filter(i => i.fixAction === 'fix_missing_0150_municipios').length;
    const unused0150 = issues.filter(i => i.fixAction === 'clean_unused_0150').length;
    const cst102 = issues.filter(i => i.fixAction === 'normalize_simples_cst102').length;
    const whitespace0200 = issues.filter(i => i.fixAction === 'fix_whitespace_0200').length;
    const c100Struct = issues.filter(i => i.fixAction === 'fix_c100_structure').length;
    const unused0200 = issues.filter(i => i.fixAction === 'clean_0200').length;
    const total =
      c190Opr +
      d100Part +
      d100Mun +
      tipoItem0200 +
      codMun0150 +
      unused0150 +
      cst102 +
      whitespace0200 +
      c100Struct +
      unused0200;
    return {
      c190Opr,
      d100Part,
      d100Mun,
      tipoItem0200,
      codMun0150,
      unused0150,
      cst102,
      whitespace0200,
      c100Struct,
      unused0200,
      total,
    };
  }, [issues]);

  const filteredIssues = issues.filter(issue => {
    if (filterSeverity !== 'ALL' && issue.severity !== filterSeverity) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        issue.message.toLowerCase().includes(q) ||
        issue.record.toLowerCase().includes(q) ||
        (issue.field && issue.field.toLowerCase().includes(q)) ||
        (issue.line && issue.line.toString().includes(q)) ||
        (issue.pvaRuleId && issue.pvaRuleId.toLowerCase().includes(q)) ||
        (issue.pvaGuidance && issue.pvaGuidance.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filtro de CST
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

  // Filtro de Regras PVA
  const filteredPvaCatalog = useMemo(() => {
    const list = Object.values(PVA_RULES_CATALOG);
    return list.filter(rule => {
      if (pvaCategoryFilter !== 'ALL' && rule.category !== pvaCategoryFilter) return false;
      if (pvaCatalogSearch.trim()) {
        const q = pvaCatalogSearch.toLowerCase();
        return (
          rule.id.toLowerCase().includes(q) ||
          rule.record.toLowerCase().includes(q) ||
          rule.name.toLowerCase().includes(q) ||
          rule.officialMessage.toLowerCase().includes(q) ||
          rule.guidance.toLowerCase().includes(q) ||
          rule.solution.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [pvaCatalogSearch, pvaCategoryFilter]);

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
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Ato COTEPE 020 / PVA v3.2.x
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Validações auditadas com base no descritor oficial do PVA: somatórios do Bloco E, analíticos do Bloco C e controle do Bloco K.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={() => setShowPvaCatalog(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
            title="Consulte o catálogo de regras oficiais do PVA SPED Fiscal integradas no motor"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Regras do PVA</span>
          </button>

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

          {onFixAllPvaReportErrors && fixableStats.total > 0 && (
            <button
              onClick={onFixAllPvaReportErrors}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer animate-pulse"
              title="Aplica em lote a resolução de todas as pendências fiscais corrigíveis e recalcula totalizadores"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Corrigir Todas em 1 Clique ({fixableStats.total})</span>
            </button>
          )}

          {onFixC190VlOprBalance && fixableStats.c190Opr > 0 && (
            <button
              onClick={onFixC190VlOprBalance}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
              title="Equilibra soma de VL_OPR no C190 com o VL_DOC do C100"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Balancear C190 VL_OPR ({fixableStats.c190Opr})</span>
            </button>
          )}

          {onFixMissingTipoItem0200 && issues.some(i => i.fixAction === 'fix_missing_tipo_item_0200') && (
            <button
              onClick={onFixMissingTipoItem0200}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition cursor-pointer"
              title="Preenche TIPO_ITEM obrigatório no registro 0200 conforme histórico dos itens no C170"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Preencher TIPO_ITEM (0200)</span>
            </button>
          )}

          {onFixMissingD100Municipios && issues.some(i => i.fixAction === 'fix_missing_d100_municipios') && (
            <button
              onClick={onFixMissingD100Municipios}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-sm transition cursor-pointer"
              title="Preenche municípios de origem e destino nos registros D100 de CT-e"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Preencher Municípios (D100)</span>
            </button>
          )}

          {onFixMissing0150Municipios && issues.some(i => i.fixAction === 'fix_missing_0150_municipios') && (
            <button
              onClick={onFixMissing0150Municipios}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition cursor-pointer"
              title="Preenche código de município IBGE ausente no registro 0150"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Preencher Municípios (0150)</span>
            </button>
          )}

          {onFixD100ParticipantMismatch && issues.some(i => i.fixAction === 'fix_d100_participant_mismatch') && (
            <button
              onClick={onFixD100ParticipantMismatch}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition cursor-pointer"
              title="Corrige vínculo da transportadora a partir do CNPJ emitente da chave do CT-e"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Vincular Transportadora (D100)</span>
            </button>
          )}

          {issues.some(i => i.fixAction === 'fix_whitespace_0200') && (
            <button
              onClick={onFixWhitespace0200}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Corrigir Espaços (0200)</span>
            </button>
          )}

          {onCleanUnused0150 && issues.some(i => i.fixAction === 'clean_unused_0150') && (
            <button
              onClick={onCleanUnused0150}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition cursor-pointer"
              title="Remove participantes do registro 0150 que não foram referenciados em nenhum outro registro (evita erro PVA)"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Limpar 0150 Sem Movimento</span>
            </button>
          )}

          {onNormalizeSimplesCst102 && issues.some(i => i.fixAction === 'normalize_simples_cst102') && (
            <button
              onClick={onNormalizeSimplesCst102}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition cursor-pointer"
              title="Ajusta CST 102 para 900 nas entradas com alíquota zero para eliminar advertência do Simples no PVA"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Ajustar CST 102 Simples</span>
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

      {/* Alerta de Destaque: Inconsistências Fiscais Identificadas */}
      {fixableStats.total > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-pink-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Inconsistências Fiscais Detectadas ({fixableStats.total} passíveis de correção automática)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                  Compatibilidade 100% PVA
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Identificadas as pendências que podem ser regularizadas automaticamente:
                {[
                  fixableStats.c190Opr > 0 ? ` ${fixableStats.c190Opr} no C190 (VL_OPR divergente de VL_DOC)` : '',
                  fixableStats.d100Part > 0 ? ` ${fixableStats.d100Part} no D100 (CNPJ emitente da chave divergente)` : '',
                  fixableStats.tipoItem0200 > 0 ? ` ${fixableStats.tipoItem0200} no 0200 (TIPO_ITEM ausente)` : '',
                  fixableStats.d100Mun > 0 ? ` ${fixableStats.d100Mun} no D100 (municípios de origem/destino)` : '',
                  fixableStats.codMun0150 > 0 ? ` ${fixableStats.codMun0150} no 0150 (código do município)` : '',
                  fixableStats.unused0150 > 0 ? ` ${fixableStats.unused0150} no 0150 (participante sem movimento)` : '',
                  fixableStats.cst102 > 0 ? ` ${fixableStats.cst102} no C170 (CST 102 Simples Nacional)` : '',
                  fixableStats.whitespace0200 > 0 ? ` ${fixableStats.whitespace0200} no 0200 (espaços em descrições)` : '',
                ].filter(Boolean).join(' • ')}.
              </p>
            </div>
          </div>
          {onFixAllPvaReportErrors && (
            <button
              onClick={onFixAllPvaReportErrors}
              className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow hover:shadow-md transition flex items-center justify-center space-x-2 cursor-pointer animate-pulse"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Corrigir Todas em 1 Clique</span>
            </button>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setFilterSeverity('ALL')}
          className={`p-4 rounded-xl border text-left transition cursor-pointer ${
            filterSeverity === 'ALL'
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow'
              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wider opacity-80">Todas as Inconsistências</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{issues.length}</div>
          <div className="text-[11px] opacity-75 mt-1">{pvaIssuesCount} com regra oficial do PVA</div>
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
            <span>Erros Impeditivos</span>
          </div>
          <div className={`text-2xl font-bold mt-1 tabular-nums ${filterSeverity === 'ERRO' ? 'text-white' : 'text-red-600 dark:text-red-400'}`}>{errors.length}</div>
          <div className="text-[11px] opacity-75 mt-1">Impedem validação no PVA</div>
        </button>

        <button
          onClick={() => setFilterSeverity('ADVERTENCIA')}
          className={`p-4 rounded-xl border text-left transition cursor-pointer ${
            filterSeverity === 'ADVERTENCIA'
              ? 'bg-amber-600 text-white border-amber-600 shadow'
              : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wider opacity-80 flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Advertências</span>
          </div>
          <div className={`text-2xl font-bold mt-1 tabular-nums ${filterSeverity === 'ADVERTENCIA' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`}>{warnings.length}</div>
          <div className="text-[11px] opacity-75 mt-1">Revisão recomendada</div>
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
          <div className="text-[11px] opacity-75 mt-1">Otimizações cadastrais</div>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 transition-colors">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Lista de Inconsistências ({filteredIssues.length})
          </div>
          <div className="relative w-full sm:w-80">
            <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Filtrar por regra PVA (ex: E110, K200), campo, linha..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma inconsistência encontrada nesta visualização</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">O arquivo atende aos critérios do Guia Prático e do PVA da EFD ICMS/IPI.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-24">Severidade</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-20">Registro</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-16">Linha</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-24">Campo</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300">Descrição do Erro & Regra PVA</th>
                  <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300 w-28">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {filteredIssues.map(issue => (
                  <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
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
                    <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap align-top">
                      {issue.record}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums align-top">
                      {issue.relatedLines && issue.relatedLines.length > 1 ? (
                        <span className="text-slate-800 dark:text-slate-200 font-semibold" title={`Linhas: ${issue.relatedLines.join(', ')}`}>
                          {issue.relatedLines.join(', ')}
                        </span>
                      ) : (
                        issue.line || '-'
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap align-top">
                      {issue.field || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 align-top space-y-1.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {issue.message}
                      </div>

                      {/* Identificador Oficial da Regra do PVA */}
                      {issue.pvaRuleId && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <button
                            onClick={() => {
                              const rule = getPvaRule(issue.pvaRuleId!);
                              if (rule) setSelectedPvaRule(rule);
                            }}
                            className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition cursor-pointer"
                            title="Clique para ver o descritor oficial do PVA para esta regra"
                          >
                            <span>Regra PVA: {issue.pvaRuleId}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      {/* Orientação Técnica & Valores Esperados */}
                      {issue.pvaGuidance && (
                        <div className="p-2 rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-300">
                          <div className="flex items-start space-x-1.5">
                            <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <div><strong className="text-slate-800 dark:text-slate-200">Orientação PVA:</strong> {issue.pvaGuidance}</div>
                              {issue.difference && (
                                <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 inline-block">
                                  Esperado: <span className="font-bold text-emerald-600 dark:text-emerald-400">{typeof issue.difference.expected === 'number' ? formatCurrencyBRL(issue.difference.expected) : issue.difference.expected}</span> · 
                                  Informado: <span className="font-bold text-rose-600 dark:text-rose-400">{typeof issue.difference.found === 'number' ? formatCurrencyBRL(issue.difference.found) : issue.difference.found}</span> · 
                                  Divergência: <span className="font-bold text-amber-600 dark:text-amber-400">{typeof issue.difference.expected === 'number' && typeof issue.difference.found === 'number' ? formatCurrencyBRL(Math.abs(issue.difference.expected - issue.difference.found)) : '-'}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap align-top">
                      <div className="inline-flex items-center justify-end space-x-2">
                        {issue.canFix && (
                          <button
                            onClick={() => {
                              if (issue.fixAction === 'fix_whitespace_0200') onFixWhitespace0200();
                              else if (issue.fixAction === 'clean_0200') onCleanUnused0200();
                              else if (issue.fixAction === 'fix_c100_structure' && onFixInvoiceStructure) onFixInvoiceStructure();
                              else if (issue.fixAction === 'fix_missing_tipo_item_0200' && onFixMissingTipoItem0200) onFixMissingTipoItem0200();
                              else if (issue.fixAction === 'fix_missing_d100_municipios' && onFixMissingD100Municipios) onFixMissingD100Municipios();
                              else if (issue.fixAction === 'fix_missing_0150_municipios' && onFixMissing0150Municipios) onFixMissing0150Municipios();
                              else if (issue.fixAction === 'fix_d100_participant_mismatch' && onFixD100ParticipantMismatch) onFixD100ParticipantMismatch();
                              else if (issue.fixAction === 'clean_unused_0150' && onCleanUnused0150) onCleanUnused0150();
                              else if (issue.fixAction === 'normalize_simples_cst102' && onNormalizeSimplesCst102) onNormalizeSimplesCst102();
                              else if (issue.fixAction === 'fix_c190_vl_opr_balance' && onFixC190VlOprBalance) onFixC190VlOprBalance();
                              else if (issue.fixAction === 'fix_all_pva_errors' && onFixAllPvaReportErrors) onFixAllPvaReportErrors();
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

      {/* Modal / Dialog: Detalhes de Regra PVA Individual */}
      {selectedPvaRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 transition-colors">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {selectedPvaRule.id}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Registro: <strong>{selectedPvaRule.record}</strong> {selectedPvaRule.field ? `· Campo: ${selectedPvaRule.field}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPvaRule(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1">{selectedPvaRule.name}</h4>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  <strong className="block text-slate-900 dark:text-slate-100 mb-1">Mensagem Oficial do Validador PVA:</strong>
                  {selectedPvaRule.officialMessage}
                </div>
              </div>

              {selectedPvaRule.formula && (
                <div>
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Fórmula / Critério do PVA:</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto">
                    {selectedPvaRule.formula}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <Info className="w-3.5 h-3.5 text-blue-500" />
                  <span>Orientação de Auditoria:</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-blue-50/50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
                  {selectedPvaRule.guidance}
                </p>
              </div>

              <div>
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <Wand2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Como Corrigir no SPED Fiscal:</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-emerald-50/50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                  {selectedPvaRule.solution}
                </p>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-end">
              <button
                onClick={() => setSelectedPvaRule(null)}
                className="px-4 py-1.5 rounded-md bg-slate-900 dark:bg-slate-800 text-white font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Dialog: Catálogo Completo de Regras do PVA */}
      {showPvaCatalog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 transition-colors">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Catálogo de Regras Oficiais do PVA Integradas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Descritor oficial Ato COTEPE 020 / Estrutura 001 v2 (EFD ICMS/IPI)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPvaCatalog(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Filter Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={pvaCatalogSearch}
                  onChange={e => setPvaCatalogSearch(e.target.value)}
                  placeholder="Pesquisar regra PVA, registro (ex: E110, K200), mensagem ou fórmula..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
                <button
                  onClick={() => setPvaCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                    pvaCategoryFilter === 'ALL'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setPvaCategoryFilter('APURACAO_ICMS')}
                  className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                    pvaCategoryFilter === 'APURACAO_ICMS'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Bloco E (Apuração)
                </button>
                <button
                  onClick={() => setPvaCategoryFilter('DOCUMENTO_FISCAL')}
                  className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                    pvaCategoryFilter === 'DOCUMENTO_FISCAL'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Bloco C (Documentos)
                </button>
                <button
                  onClick={() => setPvaCategoryFilter('BLOCO_K')}
                  className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                    pvaCategoryFilter === 'BLOCO_K'
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Bloco K (Produção/Estoque)
                </button>
              </div>
            </div>

            {/* Rules List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredPvaCatalog.map(rule => (
                <div
                  key={rule.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-indigo-300 dark:hover:border-indigo-700 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                        {rule.id}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {rule.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Registro {rule.record} {rule.field ? `· Campo ${rule.field}` : ''}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                    <strong className="text-slate-800 dark:text-slate-200">Mensagem PVA: </strong>
                    {rule.officialMessage}
                  </p>

                  {rule.formula && (
                    <div className="mb-2 p-2 rounded bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                      {rule.formula}
                    </div>
                  )}

                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-[11px] space-y-1">
                    <div>
                      <strong className="text-slate-700 dark:text-slate-300">Orientação: </strong>
                      <span className="text-slate-600 dark:text-slate-400">{rule.guidance}</span>
                    </div>
                    <div>
                      <strong className="text-emerald-700 dark:text-emerald-400">Solução: </strong>
                      <span className="text-slate-600 dark:text-slate-400">{rule.solution}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{filteredPvaCatalog.length} regra(s) encontrada(s) no descritor oficial</span>
              <button
                onClick={() => setShowPvaCatalog(false)}
                className="px-4 py-1.5 rounded-md bg-slate-900 dark:bg-slate-800 text-white font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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
                    Regras de validação do PVA para CST 061 (Monofásico), CSOSNs do Simples e Regime Geral
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCstGuide(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Filter Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={cstSearch}
                  onChange={e => setCstSearch(e.target.value)}
                  placeholder="Pesquisar por código (ex: 061, 101), descrição ou base legal..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
                <button
                  onClick={() => setCstCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                    cstCategoryFilter === 'ALL'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Todos ({Object.keys(CST_ICMS_CATALOG).length})
                </button>
                <button
                  onClick={() => setCstCategoryFilter('MONOFASICO')}
                  className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                    cstCategoryFilter === 'MONOFASICO'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Combustíveis (061, 02...)
                </button>
                <button
                  onClick={() => setCstCategoryFilter('CSOSN')}
                  className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                    cstCategoryFilter === 'CSOSN'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Simples Nacional (CSOSN)
                </button>
                <button
                  onClick={() => setCstCategoryFilter('NORMAL')}
                  className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                    cstCategoryFilter === 'NORMAL'
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Regime Geral (Normal)
                </button>
              </div>
            </div>

            {/* Modal Body / List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredCstList.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Nenhum código encontrado com os critérios pesquisados.
                </div>
              ) : (
                filteredCstList.map(item => (
                  <div
                    key={item.code}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-300 dark:hover:border-emerald-700 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
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
                className="px-4 py-1.5 rounded-md bg-slate-900 dark:bg-slate-800 text-white font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
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

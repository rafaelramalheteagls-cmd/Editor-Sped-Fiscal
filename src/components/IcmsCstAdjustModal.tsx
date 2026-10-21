import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  CheckSquare,
  Square,
  Building2,
  Receipt,
  FileSpreadsheet,
  Search,
  ArrowRight,
  Calendar,
  User,
  SlidersHorizontal
} from 'lucide-react';
import { SpedLine } from '../types';
import {
  FiscalSyncOptions,
  FiscalSyncResult,
  ModifiedInvoiceDetail,
  ModifiedItemDetail,
  applyFiscalSync,
  extractContabilItems,
  extractUsoConsumoItems,
  groupInvoicesByC100,
  CFOP_USO_CONSUMO_ENTRADA,
  CFOP_CONTABIL_ENTRADA,
  CFOP_CONTABIL_SAIDA
} from '../lib/spedFiscalSync';
import { formatCurrencyBRL, formatDateSped } from '../lib/spedParser';

interface IcmsCstAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: SpedLine[];
  currentSelectedDocNum?: string;
  onApplyAdjustment: (result: FiscalSyncResult, description: string) => void;
}

export const IcmsCstAdjustModal: React.FC<IcmsCstAdjustModalProps> = ({
  isOpen,
  onClose,
  lines,
  currentSelectedDocNum,
  onApplyAdjustment,
}) => {
  // Primary Tab: '0' = Entradas, '1' = Saídas
  const [activeOper, setActiveOper] = useState<'0' | '1'>('0');

  // Scope: 'ALL' or 'SELECTED_INVOICE'
  const [scope, setScope] = useState<'ALL' | 'SELECTED_INVOICE'>('ALL');
  const [selectedDocNum, setSelectedDocNum] = useState<string>(currentSelectedDocNum || '');

  // Quick Action Toggles for Active Scope
  const [reconcileCst, setReconcileCst] = useState<boolean>(true);
  const [convertCst010And070To060, setConvertCst010And070To060] = useState<boolean>(true);
  const [adjustCfopSt, setAdjustCfopSt] = useState<boolean>(true);
  const [defaultAliq00, setDefaultAliq00] = useState<number>(18);
  const [customAliqStr, setCustomAliqStr] = useState<string>('18');

  // Uso e Consumo options (Entradas)
  const [zeroUsoConsumo, setZeroUsoConsumo] = useState<boolean>(true);
  const [usoConsumoCstMode, setUsoConsumoCstMode] = useState<'KEEP' | 'SET_090'>('KEEP');

  // Bonificações e Outras Operações (Seleção contábil granular)
  const [zeroContabil, setZeroContabil] = useState<boolean>(false);
  const [contabilCstMode, setContabilCstMode] = useState<'KEEP' | 'SET_090' | 'SET_040'>('KEEP');
  const [selectedContabilLineIds, setSelectedContabilLineIds] = useState<number[]>([]);

  // Invoices grouped
  const invoices = useMemo(() => groupInvoicesByC100(lines), [lines]);
  const entradasInvoices = useMemo(() => invoices.filter(inv => inv.indOper === '0'), [invoices]);
  const saidasInvoices = useMemo(() => invoices.filter(inv => inv.indOper === '1'), [invoices]);

  const activeInvoices = activeOper === '0' ? entradasInvoices : saidasInvoices;

  // Set default selectedDocNum if not set
  React.useEffect(() => {
    if (currentSelectedDocNum) {
      setSelectedDocNum(currentSelectedDocNum);
    } else if (activeInvoices.length > 0 && !selectedDocNum) {
      setSelectedDocNum(activeInvoices[0].docNum);
    }
  }, [currentSelectedDocNum, activeInvoices, selectedDocNum]);

  // Extract items for Contábil table
  const contabilItems = useMemo(() => {
    return extractContabilItems(lines, activeOper);
  }, [lines, activeOper]);

  // Filtered by selected invoice if in SELECTED_INVOICE mode
  const displayedContabilItems = useMemo(() => {
    if (scope === 'SELECTED_INVOICE' && selectedDocNum) {
      return contabilItems.filter(item => item.docNum === selectedDocNum);
    }
    return contabilItems;
  }, [contabilItems, scope, selectedDocNum]);

  // Extract Uso e Consumo items (Entradas)
  const usoConsumoItems = useMemo(() => {
    return extractUsoConsumoItems(lines);
  }, [lines]);

  const displayedUsoConsumoItems = useMemo(() => {
    if (scope === 'SELECTED_INVOICE' && selectedDocNum) {
      return usoConsumoItems.filter(item => item.docNum === selectedDocNum);
    }
    return usoConsumoItems;
  }, [usoConsumoItems, scope, selectedDocNum]);

  // Checkbox select all/none for Contabil
  const handleToggleSelectAllContabil = () => {
    const displayedIds = displayedContabilItems.map(item => item.lineId);
    const allSelected = displayedIds.length > 0 && displayedIds.every(id => selectedContabilLineIds.includes(id));

    if (allSelected) {
      setSelectedContabilLineIds(prev => prev.filter(id => !displayedIds.includes(id)));
    } else {
      setSelectedContabilLineIds(prev => Array.from(new Set([...prev, ...displayedIds])));
    }
  };

  const handleToggleSingleContabil = (id: number) => {
    setSelectedContabilLineIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Build options object
  const currentOptions: FiscalSyncOptions = useMemo(() => {
    return {
      indOper: activeOper,
      scope,
      selectedDocNum: scope === 'SELECTED_INVOICE' ? selectedDocNum : undefined,
      reconcileCst00and60: reconcileCst,
      convertCst010And070To060,
      adjustCfopSt,
      defaultAliq00,
      zeroUsoConsumo: activeOper === '0' && zeroUsoConsumo,
      usoConsumoCstMode,
      zeroContabilSelected: zeroContabil,
      selectedContabilLineIds,
      contabilCstMode,
    };
  }, [
    activeOper,
    scope,
    selectedDocNum,
    reconcileCst,
    convertCst010And070To060,
    adjustCfopSt,
    defaultAliq00,
    zeroUsoConsumo,
    usoConsumoCstMode,
    zeroContabil,
    selectedContabilLineIds,
    contabilCstMode,
  ]);

  // Real-time Preview Calculation
  const previewResult = useMemo(() => {
    if (!isOpen) return null;
    return applyFiscalSync(lines, currentOptions);
  }, [isOpen, lines, currentOptions]);

  // Search query and accordion expansion for affected invoices and items
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());

  // Auto-expand affected invoices on changes
  React.useEffect(() => {
    if (previewResult?.modifiedInvoices && previewResult.modifiedInvoices.length > 0) {
      if (previewResult.modifiedInvoices.length <= 3) {
        setExpandedInvoices(new Set(previewResult.modifiedInvoices.map(inv => inv.c100Index)));
      } else {
        // Expand the first one by default
        setExpandedInvoices(new Set([previewResult.modifiedInvoices[0].c100Index]));
      }
    } else {
      setExpandedInvoices(new Set());
    }
  }, [previewResult?.modifiedInvoices?.length, activeOper, scope, selectedDocNum]);

  const toggleInvoiceExpand = (c100Idx: number) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(c100Idx)) {
        next.delete(c100Idx);
      } else {
        next.add(c100Idx);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    if (!previewResult?.modifiedInvoices) return;
    setExpandedInvoices(new Set(previewResult.modifiedInvoices.map(inv => inv.c100Index)));
  };

  const handleCollapseAll = () => {
    setExpandedInvoices(new Set());
  };

  // Filter modified invoices by search query
  const filteredModifiedInvoices = useMemo(() => {
    if (!previewResult?.modifiedInvoices) return [];
    if (!searchQuery.trim()) return previewResult.modifiedInvoices;
    const q = searchQuery.toLowerCase().trim();
    return previewResult.modifiedInvoices.filter(inv => {
      if (inv.docNum.toLowerCase().includes(q) || inv.codPart.toLowerCase().includes(q)) {
        return true;
      }
      return inv.modifiedItems.some(item =>
        item.numItem.includes(q) ||
        item.codItem.toLowerCase().includes(q) ||
        item.descrItem.toLowerCase().includes(q) ||
        item.cfop.before.includes(q) ||
        item.cfop.after.includes(q) ||
        item.cst.before.includes(q) ||
        item.cst.after.includes(q) ||
        item.changeReasons.some(r => r.toLowerCase().includes(q))
      );
    });
  }, [previewResult?.modifiedInvoices, searchQuery]);

  const totalModifiedItemsCount = useMemo(() => {
    if (!previewResult?.modifiedInvoices) return 0;
    return previewResult.modifiedInvoices.reduce((acc, inv) => acc + inv.modifiedItems.length, 0);
  }, [previewResult?.modifiedInvoices]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!previewResult) return;

    const opLabel = activeOper === '0' ? 'Entradas' : 'Saídas';
    const scopeLabel = scope === 'ALL' ? `todas as notas de ${opLabel}` : `NF #${selectedDocNum}`;
    const desc = `Reconciliação Fiscal (${opLabel}): ${previewResult.stats.invoicesUpdated} nota(s) atualizada(s), ${previewResult.stats.c170Modified} item(ns) C170 ajustados e ${previewResult.stats.c190Regenerated} C190 recalculados em ${scopeLabel}.`;

    onApplyAdjustment(previewResult, desc);
    onClose();
  };

  const standardAliqs = [18, 17, 12, 7, 20, 0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-800 dark:text-slate-100 transition-colors">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Reconciliação e Ajuste Fiscal (C170, C190 e C100)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sincroniza CFOP e ICMS por CST, zera consumo e bonificações contábeis, recria analítico C190 e totaliza C100
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Tabs: Entradas vs Saídas */}
        <div className="px-6 pt-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setActiveOper('0');
                setSelectedContabilLineIds([]);
              }}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition cursor-pointer ${
                activeOper === '0'
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>📥 Aba Entradas (Aquisições / Compras)</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                {entradasInvoices.length} NFs
              </span>
            </button>

            <button
              onClick={() => {
                setActiveOper('1');
                setSelectedContabilLineIds([]);
              }}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition cursor-pointer ${
                activeOper === '1'
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>📤 Aba Saídas (Vendas / Remessas)</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                {saidasInvoices.length} NFs
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
            {activeOper === '0' ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Foco em crédito de entradas, uso/consumo e bonificações</span>
            ) : (
              <span className="text-indigo-700 dark:text-indigo-400 font-medium">Foco em débitos de ICMS, ST (5405/6405) e bonificações</span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          
          {/* Scope Selector Bar */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-4 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Escopo de Aplicação:
              </span>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'ALL'}
                  onChange={() => setScope('ALL')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>Todas as notas de {activeOper === '0' ? 'Entrada' : 'Saída'} ({activeInvoices.length} NFs)</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'SELECTED_INVOICE'}
                  onChange={() => setScope('SELECTED_INVOICE')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>Apenas Nota Fiscal Selecionada</span>
              </label>
            </div>

            {scope === 'SELECTED_INVOICE' && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Nota:</span>
                <select
                  value={selectedDocNum}
                  onChange={(e) => setSelectedDocNum(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {activeInvoices.map(inv => (
                    <option key={inv.c100Index} value={inv.docNum}>
                      NF #{inv.docNum} {inv.dtDoc ? `(${inv.dtDoc})` : ''} - Part: {inv.codPart || 'N/A'} ({inv.c170Lines.length} itens)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card 1: Reconciliação CST 00 / 60 e CFOP ST */}
            <div className={`p-4 rounded-xl border transition ${
              reconcileCst
                ? 'bg-white dark:bg-slate-800/90 border-emerald-300 dark:border-emerald-700/80 shadow-xs ring-1 ring-emerald-100 dark:ring-emerald-950'
                : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Reconciliação CST 00 & CST 60
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {activeOper === '0'
                        ? 'Ajusta 1102 <-> 1403 e 2102 <-> 2403'
                        : 'Ajusta 5102 <-> 5405 e 6102 <-> 6405'}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={reconcileCst}
                  onChange={(e) => setReconcileCst(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                />
              </div>

              {reconcileCst && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700/80 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adjustCfopSt}
                      onChange={(e) => setAdjustCfopSt(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      Alternar CFOP ST quando CST for 60/ST e Própria quando for 00
                    </span>
                  </label>

                  <label className="flex items-start space-x-2 cursor-pointer bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-900 transition">
                    <input
                      type="checkbox"
                      checked={convertCst010And070To060}
                      onChange={(e) => setConvertCst010And070To060(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 mt-0.5"
                    />
                    <div>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold block">
                        Converter CST 010 e 070 para 060 (ST)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Zera a Base e o Valor do ICMS próprio e adequa o CFOP para ST se a opção de alternar CFOP estiver ativa.
                      </span>
                    </div>
                  </label>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Alíquota Padrão para CST 00 (aplicada se houver alteração de CFOP ou CST):
                    </label>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                      Itens com CST 00 que não sofrerem alteração de CFOP/CST manterão seus valores originais intactos.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {standardAliqs.map(aliq => (
                        <button
                          key={aliq}
                          type="button"
                          onClick={() => {
                            setDefaultAliq00(aliq);
                            setCustomAliqStr(String(aliq));
                          }}
                          className={`px-2 py-1 rounded text-xs font-mono font-medium border transition cursor-pointer ${
                            defaultAliq00 === aliq
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {aliq}%
                        </button>
                      ))}
                      <div className="flex items-center space-x-1 ml-1">
                        <span className="text-[11px] text-slate-400">Outra:</span>
                        <input
                          type="number"
                          value={customAliqStr}
                          onChange={(e) => {
                            setCustomAliqStr(e.target.value);
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 0) setDefaultAliq00(val);
                          }}
                          className="w-14 text-xs font-mono px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-emerald-500 text-center"
                          min="0"
                          max="100"
                          step="0.5"
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Uso e Consumo (exclusivo Entradas) OU Info em Saídas */}
            {activeOper === '0' ? (
              <div className={`p-4 rounded-xl border transition ${
                zeroUsoConsumo
                  ? 'bg-white dark:bg-slate-800/90 border-amber-300 dark:border-amber-700/80 shadow-xs ring-1 ring-amber-100 dark:ring-amber-950'
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Zerar ICMS de Uso e Consumo
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        CFOPs 1556, 2556, 1407 e 2407 ({displayedUsoConsumoItems.length} item(ns) encontrados)
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={zeroUsoConsumo}
                    onChange={(e) => setZeroUsoConsumo(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                </div>

                {zeroUsoConsumo && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                    <p className="text-[11px] text-slate-600">
                      Zera obrigatoriamente a Base de Cálculo, Alíquota e Valor do ICMS.
                    </p>
                    <div className="pt-1">
                      <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Tratamento do CST em Uso/Consumo:
                      </span>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="usoConsumoCstMode"
                            checked={usoConsumoCstMode === 'KEEP'}
                            onChange={() => setUsoConsumoCstMode('KEEP')}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-slate-700">Manter CST original</span>
                        </label>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="usoConsumoCstMode"
                            checked={usoConsumoCstMode === 'SET_090'}
                            onChange={() => setUsoConsumoCstMode('SET_090')}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-slate-700">Alterar CST para 090 (Outras)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-800">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">
                      Regras Especializadas de Saídas
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Nas operações de saída, itens tributados com CST 60 migram automaticamente para o CFOP ST (5405/6405) e têm o ICMS próprio zerado, garantindo conformidade fiscal na EFD.
                  </p>
                </div>
                <div className="mt-3 text-[11px] text-indigo-800 bg-indigo-100/60 p-2 rounded-lg font-medium">
                  💡 Bonificações e outras remessas (5910/6910/5949/6949) podem ser marcadas individualmente na tabela abaixo.
                </div>
              </div>
            )}
          </div>

          {/* Section: Bonificações e Outras Operações (Seleção Contábil Granular) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="zeroContabilToggle"
                  checked={zeroContabil}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setZeroContabil(checked);
                    if (checked && selectedContabilLineIds.length === 0) {
                      // Pre-select all displayed by default
                      setSelectedContabilLineIds(displayedContabilItems.map(i => i.lineId));
                    }
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <label htmlFor="zeroContabilToggle" className="cursor-pointer">
                  <span className="text-xs font-bold text-slate-900">
                    Zerar ICMS em Bonificações e Outras {activeOper === '0' ? 'Entradas (1910, 2910, 1949, 2949)' : 'Saídas (5910, 6910, 5949, 6949)'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Seleção contábil granular: confira e marque exatamente quais itens devem ser zerados
                  </span>
                </label>
              </div>

              {zeroContabil && (
                <div className="flex items-center space-x-3 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-slate-500">CST destino:</span>
                    <select
                      value={contabilCstMode}
                      onChange={(e) => setContabilCstMode(e.target.value as any)}
                      className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-700"
                    >
                      <option value="KEEP">Manter CST atual</option>
                      <option value="SET_090">Alterar para 090 (Outras)</option>
                      <option value="SET_040">Alterar para 040 (Isenta)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSelectAllContabil}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition text-xs"
                  >
                    {displayedContabilItems.length > 0 && displayedContabilItems.every(i => selectedContabilLineIds.includes(i.lineId)) ? (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        <span>Desmarcar Todos</span>
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Marcar Todos</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Granular Items Table */}
            {displayedContabilItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-white rounded-lg border border-slate-200">
                Nenhum item com CFOP {activeOper === '0' ? '1910, 2910, 1949 ou 2949' : '5910, 6910, 5949 ou 6949'} encontrado no escopo selecionado.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2 w-8 text-center">
                        <input
                          type="checkbox"
                          disabled={!zeroContabil}
                          checked={displayedContabilItems.length > 0 && displayedContabilItems.every(i => selectedContabilLineIds.includes(i.lineId))}
                          onChange={handleToggleSelectAllContabil}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="p-2">NF</th>
                      <th className="p-2">Part.</th>
                      <th className="p-2 text-center">CFOP</th>
                      <th className="p-2 text-center">CST</th>
                      <th className="p-2">Item / Descrição</th>
                      <th className="p-2 text-right">Valor Item</th>
                      <th className="p-2 text-right">BC ICMS</th>
                      <th className="p-2 text-right">Alíq.</th>
                      <th className="p-2 text-right">Valor ICMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedContabilItems.map(item => {
                      const isSelected = selectedContabilLineIds.includes(item.lineId);
                      return (
                        <tr
                          key={item.lineId}
                          className={`hover:bg-slate-50 transition cursor-pointer ${
                            isSelected && zeroContabil ? 'bg-amber-50/50' : ''
                          }`}
                          onClick={() => {
                            if (zeroContabil) handleToggleSingleContabil(item.lineId);
                          }}
                        >
                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              disabled={!zeroContabil}
                              checked={isSelected}
                              onChange={() => handleToggleSingleContabil(item.lineId)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-2 font-mono font-medium text-slate-800">
                            #{item.docNum}
                          </td>
                          <td className="p-2 font-mono text-slate-500 max-w-[80px] truncate" title={item.codPart}>
                            {item.codPart || '-'}
                          </td>
                          <td className="p-2 text-center font-mono font-semibold text-indigo-700 bg-indigo-50/60 rounded">
                            {item.cfop}
                          </td>
                          <td className="p-2 text-center font-mono text-slate-700">
                            {item.cstIcms || '-'}
                          </td>
                          <td className="p-2 max-w-[200px] truncate" title={item.descrItem || item.codItem}>
                            <span className="font-mono text-slate-400 mr-1">[{item.codItem}]</span>
                            <span className="text-slate-800">{item.descrItem || 'Item sem descrição'}</span>
                          </td>
                          <td className="p-2 text-right font-mono text-slate-700">
                            {formatCurrencyBRL(item.vlItem)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-700">
                            {formatCurrencyBRL(item.vlBcIcms)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-500">
                            {item.aliqIcms ? `${item.aliqIcms}%` : '-'}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            {formatCurrencyBRL(item.vlIcms)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {zeroContabil && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>
                  <strong>{selectedContabilLineIds.filter(id => displayedContabilItems.some(i => i.lineId === id)).length}</strong> de {displayedContabilItems.length} item(ns) contábeis marcados para zeramento.
                </span>
                <span className="text-amber-700 font-medium">
                  Os itens não selecionados preservarão integralmente seus valores.
                </span>
              </div>
            )}
          </div>

          {/* Real-time Diff / Impact Panel */}
          {previewResult && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-white shadow-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Impacto e Pré-visualização do Ajuste Fiscal ({activeOper === '0' ? 'Entradas' : 'Saídas'})
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Escopo: {scope === 'ALL' ? `Todas as ${activeInvoices.length} NFs` : `NF #${selectedDocNum}`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Notas Afetadas</span>
                  <span className="text-base font-bold font-mono text-emerald-400">
                    {previewResult.stats.invoicesUpdated}
                  </span>
                  <span className="text-[10px] text-slate-400 block">cabeçalhos C100</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Itens C170 Ajustados</span>
                  <span className="text-base font-bold font-mono text-cyan-400">
                    {previewResult.stats.c170Modified}
                  </span>
                  <span className="text-[10px] text-slate-400 block">produtos/serviços</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">C190 Recalculados</span>
                  <span className="text-base font-bold font-mono text-amber-400">
                    {previewResult.stats.c190Regenerated}
                  </span>
                  <span className="text-[10px] text-slate-400 block">analíticos agrupados</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Variação do ICMS</span>
                  <span className={`text-base font-bold font-mono ${
                    previewResult.stats.diffIcms < 0
                      ? 'text-rose-400'
                      : previewResult.stats.diffIcms > 0
                      ? 'text-emerald-400'
                      : 'text-slate-200'
                  }`}>
                    {previewResult.stats.diffIcms >= 0 ? '+' : ''}
                    {formatCurrencyBRL(previewResult.stats.diffIcms)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {formatCurrencyBRL(previewResult.stats.totalIcmsBefore)} → {formatCurrencyBRL(previewResult.stats.totalIcmsAfter)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Seção Detalhada: Notas Fiscais e Itens Afetados (Comparativo De ➔ Para) */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            {/* Cabeçalho da Seção */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-lg ${activeOper === '0' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Notas Fiscais e Itens Afetados pelas Alterações Marcadas
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      (previewResult?.modifiedInvoices.length || 0) > 0
                        ? activeOper === '0' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {previewResult?.modifiedInvoices.length || 0} nota(s) • {totalModifiedItemsCount} item(ns)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Comparativo "De ➔ Para" dos campos CFOP, CST, Base de Cálculo, Alíquota e ICMS antes da aplicação
                  </p>
                </div>
              </div>

              {/* Controles de Busca e Expansão em Massa */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar NF, produto, CFOP..."
                    className="pl-8 pr-6 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44 sm:w-56 text-slate-800"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {(previewResult?.modifiedInvoices.length || 0) > 0 && (
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={handleExpandAll}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-200/80 hover:bg-slate-300 rounded-lg text-slate-700 transition"
                      title="Expandir todas as notas fiscais"
                    >
                      Expandir Tudo
                    </button>
                    <button
                      type="button"
                      onClick={handleCollapseAll}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-200/80 hover:bg-slate-300 rounded-lg text-slate-700 transition"
                      title="Recolher todas as notas fiscais"
                    >
                      Recolher
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Lista Expansível de Notas Fiscais (Accordion) */}
            <div className="divide-y divide-slate-200 max-h-[460px] overflow-y-auto">
              {(!previewResult?.modifiedInvoices || previewResult.modifiedInvoices.length === 0) ? (
                <div className="p-8 text-center bg-slate-50/50">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                  <p className="text-xs font-semibold text-slate-800">
                    Nenhuma nota fiscal ou item será alterado com as opções marcadas
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                    Todas as notas do escopo selecionado já estão em conformidade com as opções fiscais ativas ou não contêm os CFOPs/CSTs visados.
                  </p>
                </div>
              ) : filteredModifiedInvoices.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Nenhuma nota ou item corresponde à busca "{searchQuery}".
                </div>
              ) : (
                filteredModifiedInvoices.map((inv) => {
                  const isExpanded = expandedInvoices.has(inv.c100Index);
                  return (
                    <div key={inv.c100Index} className="transition">
                      {/* Linha Cabeçalho da Nota */}
                      <div
                        onClick={() => toggleInvoiceExpand(inv.c100Index)}
                        className={`p-3.5 flex flex-wrap items-center justify-between gap-2 cursor-pointer transition select-none ${
                          isExpanded ? 'bg-slate-100/80 border-b border-slate-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-slate-200/80 text-slate-500 transition"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-700" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-800 text-white shadow-xs">
                              NF #{inv.docNum}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              inv.indOper === '0'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            }`}>
                              {inv.indOper === '0' ? 'Entrada' : 'Saída'}
                            </span>
                          </div>

                          <div className="flex items-center space-x-3 text-xs text-slate-600">
                            {inv.dtDoc && (
                              <span className="flex items-center space-x-1 text-slate-500 text-[11px]">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{formatDateSped(inv.dtDoc)}</span>
                              </span>
                            )}
                            {inv.codPart && (
                              <span className="flex items-center space-x-1 text-slate-500 text-[11px]" title={inv.codPart}>
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="font-mono">Part: {inv.codPart}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Badges e Resumo da Nota */}
                        <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
                          {/* Quantidade de itens alterados */}
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            {inv.modifiedItems.length} item(ns) alterado(s)
                          </span>

                          {/* Analíticos C190 */}
                          <span className="hidden md:inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200" title="Analíticos C190">
                            C190: {inv.c190BeforeCount} ➔ {inv.c190AfterCount}
                          </span>

                          {/* Impacto no ICMS */}
                          <div className="text-right">
                            <div className="text-[11px] text-slate-500">
                              ICMS:{' '}
                              <span className="line-through text-slate-400 font-mono">
                                {formatCurrencyBRL(inv.totalIcmsBefore)}
                              </span>{' '}
                              ➔{' '}
                              <span className="font-bold text-slate-800 font-mono">
                                {formatCurrencyBRL(inv.totalIcmsAfter)}
                              </span>
                            </div>
                            {Math.abs(inv.diffIcms) > 0.009 && (
                              <span className={`text-[10px] font-mono font-semibold ${
                                inv.diffIcms < 0 ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                                ({inv.diffIcms >= 0 ? '+' : ''}{formatCurrencyBRL(inv.diffIcms)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tabela Comparativa De ➔ Para dos Itens */}
                      {isExpanded && (
                        <div className="p-3 bg-slate-50/70 overflow-x-auto">
                          {inv.modifiedItems.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
                              Os itens C170 desta nota preservaram seus valores originais. Os analíticos C190 e cabeçalho C100 foram recalculados em tempo real.
                            </div>
                          ) : (
                            <table className="min-w-full text-xs text-left bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                                <tr>
                                  <th className="p-2.5 w-12 text-center">Item</th>
                                  <th className="p-2.5 min-w-[200px]">Código / Descrição do Produto</th>
                                  <th className="p-2.5 min-w-[180px]">Motivo(s) do Ajuste</th>
                                  <th className="p-2.5 text-center min-w-[140px]">CFOP (De ➔ Para)</th>
                                  <th className="p-2.5 text-center min-w-[130px]">CST (De ➔ Para)</th>
                                  <th className="p-2.5 text-right min-w-[130px]">Base Cálc. ICMS</th>
                                  <th className="p-2.5 text-center min-w-[110px]">Alíquota</th>
                                  <th className="p-2.5 text-right min-w-[130px]">Valor ICMS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {inv.modifiedItems.map((item) => (
                                  <tr key={item.lineId} className="hover:bg-slate-50/80 transition">
                                    {/* Número do Item */}
                                    <td className="p-2.5 text-center font-mono font-bold text-slate-700 bg-slate-50/50">
                                      #{item.numItem}
                                    </td>

                                    {/* Código e Descrição */}
                                    <td className="p-2.5 max-w-[240px]">
                                      <div className="font-mono font-semibold text-slate-900 text-[11px]">
                                        [{item.codItem}]
                                      </div>
                                      <div className="text-slate-600 text-[11px] truncate" title={item.descrItem}>
                                        {item.descrItem || 'Produto sem descrição'}
                                      </div>
                                    </td>

                                    {/* Motivo(s) do Ajuste */}
                                    <td className="p-2.5">
                                      <div className="flex flex-wrap gap-1">
                                        {item.changeReasons.map((reason, rIdx) => (
                                          <span
                                            key={rIdx}
                                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                                          >
                                            {reason}
                                          </span>
                                        ))}
                                      </div>
                                    </td>

                                    {/* CFOP (De ➔ Para) */}
                                    <td className="p-2.5 text-center font-mono">
                                      {item.cfop.changed ? (
                                        <div className="inline-flex items-center space-x-1 text-[11px]">
                                          <span className="line-through text-slate-400">{item.cfop.before}</span>
                                          <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                                          <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                            {item.cfop.after}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-600 text-[11px]">{item.cfop.before}</span>
                                      )}
                                    </td>

                                    {/* CST ICMS (De ➔ Para) */}
                                    <td className="p-2.5 text-center font-mono">
                                      {item.cst.changed ? (
                                        <div className="inline-flex items-center space-x-1 text-[11px]">
                                          <span className="line-through text-slate-400">{item.cst.before}</span>
                                          <ArrowRight className="w-3 h-3 text-amber-600 shrink-0" />
                                          <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                            {item.cst.after}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-600 text-[11px]">{item.cst.before || '-'}</span>
                                      )}
                                    </td>

                                    {/* Base de Cálculo */}
                                    <td className="p-2.5 text-right font-mono">
                                      {item.bcIcms.changed ? (
                                        <div>
                                          <span className="line-through text-slate-400 text-[10px] block">
                                            {formatCurrencyBRL(item.bcIcms.before)}
                                          </span>
                                          <span className="font-bold text-slate-900 text-[11px] block">
                                            {formatCurrencyBRL(item.bcIcms.after)}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-600 text-[11px]">
                                          {formatCurrencyBRL(item.bcIcms.before)}
                                        </span>
                                      )}
                                    </td>

                                    {/* Alíquota */}
                                    <td className="p-2.5 text-center font-mono">
                                      {item.aliqIcms.changed ? (
                                        <div>
                                          <span className="line-through text-slate-400 text-[10px] block">
                                            {item.aliqIcms.before}%
                                          </span>
                                          <span className="font-bold text-slate-900 text-[11px] block">
                                            {item.aliqIcms.after}%
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-600 text-[11px]">
                                          {item.aliqIcms.before > 0 ? `${item.aliqIcms.before}%` : '-'}
                                        </span>
                                      )}
                                    </td>

                                    {/* Valor ICMS */}
                                    <td className="p-2.5 text-right font-mono">
                                      {item.vlIcms.changed ? (
                                        <div>
                                          <span className="line-through text-slate-400 text-[10px] block">
                                            {formatCurrencyBRL(item.vlIcms.before)}
                                          </span>
                                          <span className={`font-bold text-[11px] block ${
                                            item.vlIcms.after === 0
                                              ? 'text-rose-600 font-bold'
                                              : 'text-emerald-700 font-bold'
                                          }`}>
                                            {formatCurrencyBRL(item.vlIcms.after)}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-slate-800 font-semibold text-[11px]">
                                          {formatCurrencyBRL(item.vlIcms.before)}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors">
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <span>As alterações são reversíveis com <strong>Ctrl+Z</strong> a qualquer momento.</span>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleApply}
              disabled={!previewResult || (previewResult.stats.invoicesUpdated === 0 && previewResult.stats.c170Modified === 0)}
              className={`flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition cursor-pointer ${
                activeOper === '0'
                  ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600'
                  : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-600'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                Aplicar Ajustes nas {activeOper === '0' ? 'Entradas' : 'Saídas'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Plus, 
  Wand2, 
  Sparkles, 
  Layers,
  ArrowUpDown,
  Filter,
  Check
} from 'lucide-react';
import { SpedLine, SpedMetadata } from '../types';
import { SPED_LAYOUT, SPED_RECORD_DESCRIPTIONS, SPED_BLOCK_DESCRIPTIONS } from '../lib/spedLayout';
import { getCstInfo } from '../lib/cstDatabase';
import { extractC100DocNum } from '../lib/spedParser';

interface RecordEditorTabProps {
  lines: SpedLine[];
  metadata: SpedMetadata | null;
  currentReg: string;
  onSelectReg: (reg: string) => void;
  onUpdateLineField: (lineId: number, fieldIndex: number, newValue: string) => void;
  onDeleteLine: (lineId: number) => void;
  onAddLine: (reg: string) => void;
  onFixWhitespace0200: () => void;
  onCleanUnused0200: () => void;
  onOpenInventoryModal: () => void;
  onOpenIcmsCstModal: (docNum?: string) => void;
  targetNavigation?: { lineIdentifier: number; timestamp: number } | null;
}

export const RecordEditorTab: React.FC<RecordEditorTabProps> = ({
  lines,
  metadata,
  currentReg,
  onSelectReg,
  onUpdateLineField,
  onDeleteLine,
  onAddLine,
  onFixWhitespace0200,
  onCleanUnused0200,
  onOpenInventoryModal,
  onOpenIcmsCstModal,
  targetNavigation,
}) => {
  const [treeSearch, setTreeSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [pageSize, setPageSize] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);

  const lastHandledNavRef = React.useRef<number>(0);

  // In-cell editing state
  const [editingCell, setEditingCell] = useState<{
    lineId: number;
    fieldIndex: number;
    initialValue: string;
  } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<string>('');

  // Reset page when reg changes manually (without targetNavigation)
  useEffect(() => {
    if (!targetNavigation) {
      setCurrentPage(1);
      setSelectedLineId(null);
      setEditingCell(null);
    }
  }, [currentReg, targetNavigation]);

  // Handle target navigation from validation issues or global search
  useEffect(() => {
    if (!targetNavigation || targetNavigation.timestamp === lastHandledNavRef.current) {
      return;
    }

    const targetIdOrNum = targetNavigation.lineIdentifier;

    // Search in current reg lines first, then in all lines
    const found =
      lines.find(l => (l.lineNumber === targetIdOrNum || l.id === targetIdOrNum) && l.reg === currentReg) ||
      lines.find(l => l.lineNumber === targetIdOrNum || l.id === targetIdOrNum);

    if (found) {
      if (found.reg !== currentReg) {
        onSelectReg(found.reg);
        return;
      }

      lastHandledNavRef.current = targetNavigation.timestamp;
      setTableFilter(''); // Clear filter to ensure target line is displayed
      setSelectedLineId(found.id);

      // Find index in regLines of currentReg to jump to the right page
      const currentRegLines = lines.filter(l => l.reg === found.reg);
      const idx = currentRegLines.findIndex(l => l.id === found.id);
      if (idx !== -1) {
        const targetPage = Math.floor(idx / pageSize) + 1;
        setCurrentPage(targetPage);
      }

      // Smooth scroll to the target row after rendering
      setTimeout(() => {
        const el = document.getElementById(`editor-row-${found.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    } else {
      lastHandledNavRef.current = targetNavigation.timestamp;
    }
  }, [targetNavigation, currentReg, lines, pageSize, onSelectReg]);

  // Group available records from dataset
  const availableRecords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lines) {
      counts.set(l.reg, (counts.get(l.reg) || 0) + 1);
    }
    return counts;
  }, [lines]);

  // Group records by Block
  const recordsByBlock = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const reg of Array.from(availableRecords.keys()).sort()) {
      const block = reg[0];
      if (!map.has(block)) {
        map.set(block, []);
      }
      map.get(block)!.push(reg);
    }
    return map;
  }, [availableRecords]);

  // Filter tree records
  const filteredBlocks = useMemo(() => {
    if (!treeSearch) return recordsByBlock;
    const query = treeSearch.toLowerCase();
    const result = new Map<string, string[]>();

    for (const [block, regs] of recordsByBlock.entries()) {
      const matchingRegs = regs.filter(r => {
        const desc = (SPED_RECORD_DESCRIPTIONS[r] || '').toLowerCase();
        return r.toLowerCase().includes(query) || desc.includes(query);
      });
      if (matchingRegs.length > 0) {
        result.set(block, matchingRegs);
      }
    }
    return result;
  }, [recordsByBlock, treeSearch]);

  // All lines for current reg
  const regLines = useMemo(() => {
    return lines.filter(l => l.reg === currentReg);
  }, [lines, currentReg]);

  // Filter lines by table search query
  const filteredLines = useMemo(() => {
    if (!tableFilter.trim()) return regLines;
    const q = tableFilter.toLowerCase().trim();
    return regLines.filter(l => {
      if (l.lineNumber.toString().includes(q)) return true;
      if (l.parentDoc && l.parentDoc.toLowerCase().includes(q)) return true;
      return l.fields.some(f => (f || '').toLowerCase().includes(q));
    });
  }, [regLines, tableFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredLines.length / pageSize));
  const currentPageLines = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLines.slice(start, start + pageSize);
  }, [filteredLines, currentPage, pageSize]);

  // Field headers for current record
  const layoutFields = useMemo(() => {
    return SPED_LAYOUT[currentReg] || [];
  }, [currentReg]);

  const handleStartEdit = (lineId: number, fieldIndex: number, currentVal: string) => {
    setEditingCell({ lineId, fieldIndex, initialValue: currentVal });
    setCellEditValue(currentVal || '');
  };

  const handleSaveEdit = () => {
    if (editingCell) {
      if (cellEditValue !== editingCell.initialValue) {
        onUpdateLineField(editingCell.lineId, editingCell.fieldIndex, cellEditValue);
      }
      setEditingCell(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-145px)] min-h-[600px] select-none transition-colors">
      {/* Left Sidebar: Block & Record Tree */}
      <aside className="w-full lg:w-72 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col shrink-0 overflow-hidden transition-colors">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={treeSearch}
              onChange={e => setTreeSearch(e.target.value)}
              placeholder="Filtrar registros (ex: C100)..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {Array.from(filteredBlocks.entries()).map(([block, regs]) => {
            const blockDesc = SPED_BLOCK_DESCRIPTIONS[block] || `Bloco ${block}`;
            return (
              <div key={block} className="p-2">
                <div className="px-2 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span className="truncate" title={blockDesc}>Bloco {block}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-normal">
                    {regs.reduce((acc, r) => acc + (availableRecords.get(r) || 0), 0)} reg
                  </span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {regs.map(reg => {
                    const count = availableRecords.get(reg) || 0;
                    const isSelected = reg === currentReg;
                    const desc = SPED_RECORD_DESCRIPTIONS[reg] || '';

                    return (
                      <button
                        key={reg}
                        onClick={() => onSelectReg(reg)}
                        title={`${reg} - ${desc} (${count} registros)`}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition ${
                          isSelected
                            ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate pr-1">
                          <span className="font-mono font-bold">{reg}</span>
                          <span className={`text-[11px] truncate ${isSelected ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'}`}>
                            {desc.split(' ')[0]}
                          </span>
                        </div>
                        <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full shrink-0 ${
                          isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Panel: Record Grid & Controls */}
      <main className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden transition-colors">
        {/* Top Control Bar */}
        <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Record Title & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                {currentReg}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium hidden sm:inline max-w-[260px] truncate" title={SPED_RECORD_DESCRIPTIONS[currentReg]}>
                {SPED_RECORD_DESCRIPTIONS[currentReg]}
              </span>
            </div>

            {/* Quick Fix Buttons */}
            {currentReg === '0200' && (
              <button
                onClick={onFixWhitespace0200}
                title="Corrige espaços em branco duplos, no início ou fim das descrições"
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 transition font-medium text-xs cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Corrigir Espaços (0200)</span>
              </button>
            )}

            {(currentReg === '0200' || currentReg === 'C170') && (
              <button
                onClick={onCleanUnused0200}
                title="Detecta e remove itens do 0200 que nunca aparecem em C170 nem em H010"
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition font-medium text-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Limpar Não Utilizados</span>
              </button>
            )}

            {(currentReg === 'H005' || currentReg === 'H010') && (
              <button
                onClick={onOpenInventoryModal}
                title="Ajusta proporcionalmente os itens do inventário para atingir valor total desejado"
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition font-medium text-xs cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Ajustar Inventário (H005/H010)</span>
              </button>
            )}

            {(currentReg === 'C100' || currentReg === 'C170' || currentReg === 'C190') && (
              <button
                onClick={() => {
                  const sel = lines.find(l => l.id === selectedLineId);
                  let doc: string | undefined;
                  if (sel) {
                    if (sel.reg === 'C100') {
                      doc = extractC100DocNum(sel.fields);
                    } else if (sel.parentDoc) {
                      doc = sel.parentDoc;
                    }
                  }
                  onOpenIcmsCstModal(doc);
                }}
                title="Reconcilia CFOP, Base de Cálculo, Alíquota e ICMS por CST, zera consumo e bonificações e recria analítico C190"
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 transition font-medium text-xs shadow-2xs cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Ajustar ICMS/CFOP por CST</span>
              </button>
            )}

            {/* Selected Line Indicator */}
            {selectedLineId && (
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-100/80 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-medium animate-in fade-in duration-200">
                <span>Linha:</span>
                <span className="font-mono font-bold">
                  #{lines.find(l => l.id === selectedLineId)?.lineNumber || '-'}
                </span>
                <button
                  onClick={() => setSelectedLineId(null)}
                  className="text-amber-700 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 text-[10px] underline ml-1 cursor-pointer"
                  title="Desmarcar seleção"
                >
                  Desmarcar
                </button>
              </div>
            )}

            {/* Add row button */}
            <button
              onClick={() => onAddLine(currentReg)}
              title="Adicionar novo registro deste tipo"
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Nova Linha</span>
            </button>

            {/* Delete row button */}
            {selectedLineId && (
              <button
                onClick={() => {
                  onDeleteLine(selectedLineId);
                  setSelectedLineId(null);
                }}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 transition text-xs font-medium cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Linha</span>
              </button>
            )}
          </div>

          {/* Search in table & Pagination */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Filter className="w-3 h-3 text-slate-400 dark:text-slate-500 absolute left-2 top-2" />
              <input
                type="text"
                value={tableFilter}
                onChange={e => {
                  setTableFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar nesta tabela..."
                className="w-36 sm:w-44 pl-6 pr-2 py-1 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Page Size */}
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-1 px-2 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded focus:outline-none cursor-pointer"
            >
              <option value={50}>50 / pág</option>
              <option value={100}>100 / pág</option>
              <option value={500}>500 / pág</option>
              <option value={1000}>1000 / pág</option>
            </select>

            {/* Pagination Controls */}
            <div className="flex items-center space-x-1.5 font-mono text-xs text-slate-600 dark:text-slate-400">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-[11px] tabular-nums">
                {currentPage}/{totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-sans ml-1 tabular-nums">
                ({filteredLines.length.toLocaleString('pt-BR')})
              </span>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto bg-slate-50/20 dark:bg-slate-950/40 text-xs">
          {currentPageLines.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              Nenhum registro encontrado para {currentReg}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 border-separate border-spacing-0">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 w-16 bg-slate-100 dark:bg-slate-800">
                    Linha
                  </th>
                  {['C170', 'C190', 'C110', 'C113', 'C195', 'C197', 'D110', 'D190', 'C510', 'C590', 'D510', 'D590', 'D730', 'D731', 'D735', 'D737', 'D750', 'D760', 'H010'].includes(currentReg) && (
                    <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 w-24 bg-slate-100 dark:bg-slate-800">
                      Doc Pai
                    </th>
                  )}
                  {layoutFields.map((field, idx) => (
                    <th
                      key={idx}
                      className="px-3 py-2 text-left text-[11px] font-bold text-slate-700 dark:text-slate-300 tracking-wider border-b border-slate-200 dark:border-slate-700 whitespace-nowrap bg-slate-100 dark:bg-slate-800"
                      title={`Campo ${idx + 1}: ${field}`}
                    >
                      {field}
                    </th>
                  ))}
                  {/* Raw fallback if more fields exist */}
                  {currentPageLines[0]?.fields.length > layoutFields.length && (
                    <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                      Campos Extras
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {currentPageLines.map(line => {
                  const isSelected = selectedLineId === line.id;
                  const showParentDoc = ['C170', 'C190', 'C110', 'C113', 'C195', 'C197', 'D110', 'D190', 'C510', 'C590', 'D510', 'D590', 'D730', 'D731', 'D735', 'D737', 'D750', 'D760', 'H010'].includes(currentReg);

                  return (
                    <tr
                      key={line.id}
                      id={`editor-row-${line.id}`}
                      onClick={() => setSelectedLineId(line.id)}
                      className={`transition-colors duration-150 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-950/60 ring-2 ring-inset ring-amber-400 dark:ring-amber-500 font-medium'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Line Number */}
                      <td className={`px-3 py-1.5 font-mono whitespace-nowrap border-r border-slate-100 dark:border-slate-800 select-none ${
                        isSelected ? 'bg-amber-100/70 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 font-bold' : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        <div className="flex items-center space-x-1.5">
                          <span>{line.lineNumber}</span>
                          {isSelected && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-sans font-bold bg-amber-500 text-white shadow-xs animate-pulse">
                              Selecionada
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Parent Document Column */}
                      {showParentDoc && (
                        <td className="px-3 py-1.5 text-indigo-700 dark:text-indigo-400 font-semibold whitespace-nowrap border-r border-slate-100 dark:border-slate-800">
                          {line.parentDoc || '-'}
                        </td>
                      )}

                      {/* Dynamic Field Cells with in-place editor */}
                      {layoutFields.map((field, idx) => {
                        const val = line.fields[idx] ?? '';
                        const isEditingThis = editingCell?.lineId === line.id && editingCell?.fieldIndex === idx;

                        const isCstField = field === 'CST_ICMS';
                        const cstInfo = isCstField && val ? getCstInfo(val) : undefined;

                        return (
                          <td
                            key={idx}
                            onDoubleClick={() => handleStartEdit(line.id, idx, val)}
                            className="px-3 py-1 text-slate-800 dark:text-slate-200 whitespace-nowrap border-r border-slate-100/60 dark:border-slate-800/60 max-w-[320px] truncate"
                            title={
                              cstInfo
                                ? `CST ${cstInfo.code}: ${cstInfo.shortDesc}\nBase: ${cstInfo.legalBase}\nDuplo clique para editar`
                                : `Duplo clique para editar\n${field}: ${val}`
                            }
                          >
                            {isEditingThis ? (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="text"
                                  autoFocus
                                  value={cellEditValue}
                                  onChange={e => setCellEditValue(e.target.value)}
                                  onBlur={handleSaveEdit}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveEdit();
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  placeholder={isCstField ? 'Ex: 061, 101, 202' : ''}
                                  className="w-full px-1.5 py-0.5 border border-emerald-500 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none"
                                />
                                <button
                                  onClick={handleSaveEdit}
                                  className="p-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            ) : cstInfo ? (
                              <div className="flex items-center space-x-1.5">
                                <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-bold ${
                                  cstInfo.category === 'ICMS_MONOFASICO'
                                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                                    : cstInfo.category === 'CSOSN'
                                    ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                }`}>
                                  {val}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                                  {cstInfo.shortDesc}
                                </span>
                              </div>
                            ) : (
                              <span>{val || <span className="text-slate-300 dark:text-slate-600 italic">vazio</span>}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

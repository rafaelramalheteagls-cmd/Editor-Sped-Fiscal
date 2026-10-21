import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Table, 
  PieChart, 
  ShieldCheck, 
  Search, 
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

import { SpedLine, SpedMetadata, CteData } from './types';
import { parseSpedContent, computeCfopSummary } from './lib/spedParser';
import { validateSped } from './lib/spedValidator';
import { integrateCteIntoSped } from './lib/cteParser';
import { 
  recalculateAllSpedTotalizers,
  downloadSpedTxt, 
  exportTableToExcel, 
  exportTableToCsv, 
  exportAllRecordsToExcel 
} from './lib/spedExporter';
import { SPED_LAYOUT } from './lib/spedLayout';

import { Navbar } from './components/Navbar';
import { DashboardTab } from './components/DashboardTab';
import { RecordEditorTab } from './components/RecordEditorTab';
import { CfopAnalysisTab } from './components/CfopAnalysisTab';
import { ValidationTab } from './components/ValidationTab';
import { GlobalSearchTab } from './components/GlobalSearchTab';
import { CteImportModal } from './components/CteImportModal';
import { InventoryAdjustModal } from './components/InventoryAdjustModal';
import { PdfReportModal } from './components/PdfReportModal';
import { IcmsCstAdjustModal } from './components/IcmsCstAdjustModal';
import { FiscalSyncResult, fixAllInvoicesStructure } from './lib/spedFiscalSync';

export const App: React.FC = () => {
  const [lines, setLines] = useState<SpedLine[]>([]);
  const [metadata, setMetadata] = useState<SpedMetadata | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'editor' | 'cfop' | 'validacao' | 'busca'>('dashboard');
  const [currentReg, setCurrentReg] = useState<string>('C100');

  // Target navigation for Editor (e.g. from Validation issue or Search)
  const [targetNavigation, setTargetNavigation] = useState<{
    lineIdentifier: number;
    timestamp: number;
  } | null>(null);

  // History stack for Undo/Redo
  const [undoStack, setUndoStack] = useState<SpedLine[][]>([]);
  const [redoStack, setRedoStack] = useState<SpedLine[][]>([]);

  // Modals state
  const [isCteModalOpen, setIsCteModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isIcmsCstModalOpen, setIsIcmsCstModalOpen] = useState(false);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<string | undefined>(undefined);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfReportType, setPdfReportType] = useState<'cfop_consolidated' | 'general'>('cfop_consolidated');
  const [pdfOperationType, setPdfOperationType] = useState<'ENTRADA' | 'SAIDA' | 'TODAS'>('ENTRADA');

  const handleOpenIcmsCstModal = (docNum?: string) => {
    setSelectedInvoiceForModal(docNum);
    setIsIcmsCstModalOpen(true);
  };

  const handleApplyIcmsCstAdjustment = (result: FiscalSyncResult, description: string) => {
    commitLines(result.updatedLines, description);
  };

  const handleOpenPdfModal = (
    reportType: 'cfop_consolidated' | 'general' = 'cfop_consolidated',
    operacao: 'ENTRADA' | 'SAIDA' | 'TODAS' = 'ENTRADA'
  ) => {
    setPdfReportType(reportType);
    setPdfOperationType(operacao);
    setIsPdfModalOpen(true);
  };

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Helper to commit state changes with undo history and real-time SPED totalizer synchronization
  const commitLines = useCallback((newLines: SpedLine[], actionDescription?: string) => {
    // Recalcula integralmente todos os totalizadores de bloco (0990, C990, D990...) e de encerramento (9900, 9990, 9999)
    // para manter consistência absoluta em tempo real no Editor, na Validação Fiscal e em qualquer exportação
    const syncedLines = recalculateAllSpedTotalizers(newLines);

    setUndoStack(prev => [...prev.slice(-25), lines]); // keep up to 25 undo steps
    setRedoStack([]);
    setLines(syncedLines);

    // Refresh metadata record counts
    if (metadata) {
      const recordsCount: Record<string, number> = {};
      const blocksCount: Record<string, number> = {};
      for (const l of syncedLines) {
        recordsCount[l.reg] = (recordsCount[l.reg] || 0) + 1;
        blocksCount[l.reg[0]] = (blocksCount[l.reg[0]] || 0) + 1;
      }
      setMetadata({
        ...metadata,
        totalLines: syncedLines.length,
        recordsCount,
        blocksCount,
      });
    }

    if (actionDescription) {
      showToast(actionDescription, 'success');
    }
  }, [lines, metadata]);

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, lines]);
    setUndoStack(prev => prev.slice(0, prev.length - 1));
    setLines(previous);
    showToast('Ação desfeita (Ctrl+Z)', 'info');
  }, [undoStack, lines]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, lines]);
    setRedoStack(prev => prev.slice(0, prev.length - 1));
    setLines(next);
    showToast('Ação refeita (Ctrl+Y)', 'info');
  }, [redoStack, lines]);

  // Keyboard shortcut listener (Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Load sample SPED file on initial start
  const loadSampleFile = useCallback(async () => {
    try {
      const res = await fetch('/samples/sample_sped.txt');
      if (!res.ok) throw new Error('Não foi possível ler o arquivo de exemplo.');
      const text = await res.text();
      const parsed = parseSpedContent(text, 'SPED_Fiscal_Exemplo_04-2026.txt');
      setLines(parsed.lines);
      setMetadata(parsed.metadata);
      setUndoStack([]);
      setRedoStack([]);
      setCurrentReg('C100');
      showToast(`Arquivo SPED demonstrativo carregado (${parsed.lines.length} registros)!`, 'success');
    } catch (err: any) {
      showToast('Erro ao carregar exemplo: ' + err.message, 'error');
    }
  }, []);

  useEffect(() => {
    loadSampleFile();
  }, [loadSampleFile]);

  // File Upload Handler
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseSpedContent(text, file.name);
        setLines(parsed.lines);
        setMetadata(parsed.metadata);
        setUndoStack([]);
        setRedoStack([]);
        setCurrentReg('C100');
        showToast(`Arquivo "${file.name}" carregado com sucesso (${parsed.lines.length} linhas)!`, 'success');
      } catch (err: any) {
        showToast('Erro ao ler arquivo SPED: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  // Drag and Drop over window
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer?.files?.[0];
      if (file && (file.name.endsWith('.txt') || file.type.includes('text'))) {
        handleFileUpload(file);
      }
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Computed CFOP Summary
  const { entradas, saidas, totals } = useMemo(() => {
    return computeCfopSummary(lines);
  }, [lines]);

  // Computed PVA Validation Issues
  const validationIssues = useMemo(() => {
    return validateSped(lines);
  }, [lines]);

  const validationErrorCount = validationIssues.filter(i => i.severity === 'ERRO').length;
  const validationWarningCount = validationIssues.filter(i => i.severity === 'ADVERTENCIA').length;

  // Record Editor: Update cell
  const handleUpdateLineField = (lineId: number, fieldIndex: number, newValue: string) => {
    const newLines = lines.map(line => {
      if (line.id === lineId) {
        const fields = [...line.fields];
        fields[fieldIndex] = newValue;
        return {
          ...line,
          fields,
          raw: `|${line.reg}|${fields.join('|')}|`,
        };
      }
      return line;
    });
    commitLines(newLines, 'Campo atualizado com sucesso.');
  };

  // Record Editor: Delete line
  const handleDeleteLine = (lineId: number) => {
    const target = lines.find(l => l.id === lineId);
    const newLines = lines.filter(line => line.id !== lineId);
    commitLines(newLines, `Linha ${target?.lineNumber || ''} (${target?.reg || ''}) removida.`);
  };

  // Record Editor: Add line
  const handleAddLine = (reg: string) => {
    const layout = SPED_LAYOUT[reg] || [];
    const fields = new Array(layout.length).fill('');
    const newLine: SpedLine = {
      id: Date.now(),
      lineNumber: lines.length + 1,
      reg,
      fields,
      raw: `|${reg}|${fields.join('|')}|`,
    };

    // Find insertion index for this record type
    const lastRegIdx = lines.map(l => l.reg).lastIndexOf(reg);
    const newLines = [...lines];
    if (lastRegIdx >= 0) {
      newLines.splice(lastRegIdx + 1, 0, newLine);
    } else {
      newLines.push(newLine);
    }

    commitLines(newLines, `Novo registro ${reg} adicionado.`);
  };

  // Quick Action: Fix whitespace in 0200
  const handleFixWhitespace0200 = () => {
    let fixCount = 0;
    const newLines = lines.map(line => {
      if (line.reg === '0200') {
        const fields = [...line.fields];
        const descr = fields[1] || '';
        const cleanedDescr = descr.trim().replace(/\s+/g, ' ');
        if (descr !== cleanedDescr) {
          fixCount++;
          fields[1] = cleanedDescr;
          return {
            ...line,
            fields,
            raw: `|0200|${fields.join('|')}|`,
          };
        }
      }
      return line;
    });

    if (fixCount > 0) {
      commitLines(newLines, `Espaços corrigidos em ${fixCount} produto(s) do registro 0200.`);
    } else {
      showToast('Nenhum espaço incorreto encontrado no registro 0200.', 'info');
    }
  };

  // Quick Action: Clean unused 0200 items
  const handleCleanUnused0200 = () => {
    const usedProductCodes = new Set<string>();
    for (const l of lines) {
      if (l.reg === 'C170' && l.fields[1]) usedProductCodes.add(l.fields[1].trim());
      if (l.reg === 'H010' && l.fields[0]) usedProductCodes.add(l.fields[0].trim());
      if (l.reg === 'K200' && l.fields[1]) usedProductCodes.add(l.fields[1].trim());
    }

    const removedCodes: string[] = [];
    const newLines = lines.filter(l => {
      if (l.reg === '0200') {
        const cod = (l.fields[0] || '').trim();
        if (!usedProductCodes.has(cod)) {
          removedCodes.push(cod);
          return false;
        }
      }
      return true;
    });

    if (removedCodes.length > 0) {
      commitLines(newLines, `${removedCodes.length} produto(s) sem movimentação removidos do registro 0200.`);
    } else {
      showToast('Todos os produtos do registro 0200 possuem movimentação.', 'info');
    }
  };

  // Quick Action: Fix C100 note structural hierarchy (C170 and C190 before C195 and C197)
  const handleFixInvoiceStructure = () => {
    const { updatedLines, fixedNotesCount } = fixAllInvoicesStructure(lines);
    if (fixedNotesCount > 0) {
      commitLines(
        updatedLines,
        `Estrutura corrigida em ${fixedNotesCount} nota(s) fiscal(is)! Registros C170 e C190 reordenados antes de C195/C197 e totalizadores sincronizados.`
      );
    } else {
      showToast('A estrutura de todas as notas fiscais já está em conformidade com o PVA.', 'info');
    }
  };

  // Import CT-e XML
  const handleImportCte = (cte: CteData) => {
    try {
      const result = integrateCteIntoSped(lines, cte);
      commitLines(result.updatedLines, result.message);
      setCurrentReg('D100');
      setActiveTab('editor');
    } catch (err: any) {
      showToast('Erro ao integrar CT-e: ' + err.message, 'error');
    }
  };

  // Apply Inventory Adjustment
  const handleApplyInventoryAdjustment = (newLines: SpedLine[], message: string) => {
    commitLines(newLines, message);
    setCurrentReg('H010');
    setActiveTab('editor');
  };

  // Export handlers
  const handleExportTxt = () => {
    const name = metadata?.fileName ? metadata.fileName.replace(/\.txt$/i, '_editado.txt') : 'SPED_Fiscal_Editado.txt';
    downloadSpedTxt(lines, name);
    showToast('Arquivo SPED TXT exportado com totalizadores 9900/9999 recalculados!', 'success');
  };

  const handleExportCurrentExcel = () => {
    const currentLines = lines.filter(l => l.reg === currentReg);
    const layout = SPED_LAYOUT[currentReg] || [];
    const headers = ['Linha', 'Pai_Doc', ...layout];
    const rows = currentLines.map(l => [l.lineNumber, l.parentDoc || '', ...l.fields]);
    exportTableToExcel(headers, rows, `REG_${currentReg}`, `SPED_${currentReg}.xlsx`);
    showToast(`Tabela ${currentReg} exportada para Excel!`, 'success');
  };

  const handleExportCurrentCsv = () => {
    const currentLines = lines.filter(l => l.reg === currentReg);
    const layout = SPED_LAYOUT[currentReg] || [];
    const headers = ['Linha', 'Pai_Doc', ...layout];
    const rows = currentLines.map(l => [l.lineNumber, l.parentDoc || '', ...l.fields]);
    exportTableToCsv(headers, rows, `SPED_${currentReg}.csv`);
    showToast(`Tabela ${currentReg} exportada para CSV!`, 'success');
  };

  const handleExportAllExcel = () => {
    exportAllRecordsToExcel(lines, 'SPED_Fiscal_Completo.xlsx');
    showToast('Todos os registros exportados para arquivo Excel com abas separadas!', 'success');
  };

  const handleNavigateToRecord = (reg: string, lineId?: number) => {
    setCurrentReg(reg);
    if (lineId !== undefined && lineId !== null) {
      setTargetNavigation({
        lineIdentifier: lineId,
        timestamp: Date.now()
      });
      showToast(`Abrindo registro ${reg} na linha ${lineId}...`, 'info');
    } else {
      setTargetNavigation(null);
    }
    setActiveTab('editor');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 antialiased selection:bg-emerald-500 selection:text-white transition-colors duration-150">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className={`px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 text-xs font-semibold ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : toast.type === 'info'
              ? 'bg-slate-800 text-slate-100'
              : 'bg-emerald-600 text-white'
          }`}>
            {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'success' && <CheckCircle className="w-4 h-4" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header & Main Navigation */}
      <Navbar
        metadata={metadata}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        undoCount={undoStack.length}
        redoCount={redoStack.length}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onFileUpload={handleFileUpload}
        onLoadSample={loadSampleFile}
        onOpenCteModal={() => setIsCteModalOpen(true)}
        onOpenPdfModal={handleOpenPdfModal}
        onExportTxt={handleExportTxt}
        onExportCurrentExcel={handleExportCurrentExcel}
        onExportCurrentCsv={handleExportCurrentCsv}
        onExportAllExcel={handleExportAllExcel}
        onOpenIcmsCstModal={() => handleOpenIcmsCstModal()}
        currentReg={currentReg}
      />

      {/* App Workspace */}
      <div className="max-w-[1600px] mx-auto w-full px-3 sm:px-5 lg:px-6 pt-4 flex-1 flex flex-col">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 mb-4 bg-white/70 dark:bg-slate-900/80 p-1.5 rounded-xl backdrop-blur-xs shadow-2xs">
          <div className="flex items-center space-x-1 overflow-x-auto text-xs font-semibold">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard & KPIs</span>
            </button>

            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
                activeTab === 'editor'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Editor de Registros</span>
              {currentReg && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === 'editor' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {currentReg}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('cfop')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
                activeTab === 'cfop'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>Análise por CFOP</span>
            </button>

            <button
              onClick={() => setActiveTab('validacao')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
                activeTab === 'validacao'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Validação Fiscal</span>
              {validationErrorCount > 0 ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-500 text-white font-bold">
                  {validationErrorCount}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  OK
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('busca')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
                activeTab === 'busca'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Busca Global</span>
            </button>
          </div>
        </div>

        {/* Tab View Content */}
        <div className="flex-1">
          {activeTab === 'dashboard' && (
            <DashboardTab
              metadata={metadata}
              cfopEntradas={entradas}
              cfopSaidas={saidas}
              totals={totals}
              validationErrorCount={validationErrorCount}
              validationWarningCount={validationWarningCount}
              onNavigateToTab={(tab) => {
                setActiveTab(tab as any);
              }}
            />
          )}

          {activeTab === 'editor' && (
            <RecordEditorTab
              lines={lines}
              metadata={metadata}
              currentReg={currentReg}
              targetNavigation={targetNavigation}
              onSelectReg={(reg) => {
                setCurrentReg(reg);
                setTargetNavigation(null);
              }}
              onUpdateLineField={handleUpdateLineField}
              onDeleteLine={handleDeleteLine}
              onAddLine={handleAddLine}
              onFixWhitespace0200={handleFixWhitespace0200}
              onCleanUnused0200={handleCleanUnused0200}
              onOpenInventoryModal={() => setIsInventoryModalOpen(true)}
              onOpenIcmsCstModal={(docNum) => handleOpenIcmsCstModal(docNum)}
            />
          )}

          {activeTab === 'cfop' && (
            <CfopAnalysisTab
              entradas={entradas}
              saidas={saidas}
              totals={totals}
              onOpenPdfModal={handleOpenPdfModal}
            />
          )}

          {activeTab === 'validacao' && (
            <ValidationTab
              issues={validationIssues}
              onRevalidate={() => {
                showToast('Validação atualizada!', 'info');
              }}
              onFixWhitespace0200={handleFixWhitespace0200}
              onCleanUnused0200={handleCleanUnused0200}
              onFixInvoiceStructure={handleFixInvoiceStructure}
              onNavigateToRecord={handleNavigateToRecord}
            />
          )}

          {activeTab === 'busca' && (
            <GlobalSearchTab
              lines={lines}
              onNavigateToRecord={handleNavigateToRecord}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <CteImportModal
        isOpen={isCteModalOpen}
        onClose={() => setIsCteModalOpen(false)}
        onImportCte={handleImportCte}
      />

      <InventoryAdjustModal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        lines={lines}
        onApplyAdjustment={handleApplyInventoryAdjustment}
      />

      <PdfReportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        metadata={metadata}
        entradas={entradas}
        saidas={saidas}
        totals={totals}
        initialReportType={pdfReportType}
        initialOperationType={pdfOperationType}
      />

      <IcmsCstAdjustModal
        isOpen={isIcmsCstModalOpen}
        onClose={() => setIsIcmsCstModalOpen(false)}
        lines={lines}
        currentSelectedDocNum={selectedInvoiceForModal}
        onApplyAdjustment={handleApplyIcmsCstAdjustment}
      />
    </div>
  );
};

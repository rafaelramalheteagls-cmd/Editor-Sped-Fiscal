import React, { useRef, useState } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  Undo2, 
  Redo2, 
  FileCode2, 
  Printer, 
  Sparkles,
  ChevronDown,
  Table,
  CheckCircle2,
  FileSpreadsheet,
  Wand2,
  Sun,
  Moon
} from 'lucide-react';
import { SpedMetadata } from '../types';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  metadata: SpedMetadata | null;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onFileUpload: (file: File) => void;
  onLoadSample: () => void;
  onOpenCteModal: () => void;
  onOpenPdfModal: (reportType?: 'cfop_consolidated' | 'general', operacao?: 'ENTRADA' | 'SAIDA' | 'TODAS') => void;
  onExportTxt: () => void;
  onExportCurrentExcel: () => void;
  onExportCurrentCsv: () => void;
  onExportAllExcel: () => void;
  onOpenIcmsCstModal?: () => void;
  currentReg: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  metadata,
  canUndo,
  canRedo,
  undoCount,
  redoCount,
  onUndo,
  onRedo,
  onFileUpload,
  onLoadSample,
  onOpenCteModal,
  onOpenPdfModal,
  onExportTxt,
  onExportCurrentExcel,
  onExportCurrentCsv,
  onExportAllExcel,
  onOpenIcmsCstModal,
  currentReg,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = '';
    }
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-40 select-none">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand & File Info */}
          <div className="flex items-center space-x-3 min-w-0 flex-1 mr-2">
            <div className="flex items-center space-x-2.5 flex-shrink-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-inner flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex-shrink-0 whitespace-nowrap">
                <div className="flex items-center space-x-2 whitespace-nowrap">
                  <span className="font-bold text-base tracking-tight text-white whitespace-nowrap">
                    SPED Fiscal Editor
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 whitespace-nowrap">
                    Pro 2.6
                  </span>
                </div>
                <p className="text-[11px] leading-tight text-slate-400 whitespace-nowrap">
                  EFD ICMS/IPI & CT-e XML
                </p>
              </div>
            </div>

            {metadata && (
              <div className="hidden xl:flex items-center pl-3 border-l border-slate-700/60 text-xs text-slate-300 space-x-3 min-w-0 flex-shrink overflow-hidden">
                <div className="truncate max-w-[150px] 2xl:max-w-[260px]" title={metadata.razaoSocial}>
                  <span className="text-slate-400">Empresa:</span>{' '}
                  <strong className="text-white font-medium">{metadata.razaoSocial}</strong>
                </div>
                <div className="whitespace-nowrap flex-shrink-0">
                  <span className="text-slate-400">Linhas:</span>{' '}
                  <span className="font-mono text-emerald-400 font-semibold">{metadata.totalLines.toLocaleString('pt-BR')}</span>
                </div>
                {metadata.periodoInicio && (
                  <div className="hidden 2xl:block whitespace-nowrap flex-shrink-0">
                    <span className="text-slate-400">Período:</span>{' '}
                    <span className="text-slate-200">
                      {metadata.periodoInicio.slice(0, 2)}/{metadata.periodoInicio.slice(2, 4)} - {metadata.periodoFim.slice(0, 2)}/{metadata.periodoFim.slice(2, 4)}/{metadata.periodoFim.slice(4)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".txt,text/plain"
              className="hidden"
            />

            {/* Load Sample Button */}
            <button
              onClick={onLoadSample}
              title="Carregar arquivo SPED de exemplo da base"
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex-shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Exemplo</span>
            </button>

            {/* Import SPED Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition flex-shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Abrir SPED</span>
              <span className="sm:hidden">Abrir</span>
            </button>

            {/* Import CT-e Button */}
            <button
              onClick={onOpenCteModal}
              title="Importar Conhecimento de Transporte XML (CT-e) para o Bloco D"
              className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600/90 hover:bg-indigo-600 text-white transition flex-shrink-0"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Importar CT-e XML</span>
              <span className="2xl:hidden hidden sm:inline">CT-e XML</span>
              <span className="sm:hidden">CT-e</span>
            </button>

            {/* Reconciliar ICMS/CFOP Button */}
            {onOpenIcmsCstModal && (
              <button
                onClick={onOpenIcmsCstModal}
                title="Ajuste e Sincronização Fiscal: CFOP por CST, Uso/Consumo, Bonificações e recálculo C190/C100"
                className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-700 hover:bg-emerald-600 text-white shadow-sm transition flex-shrink-0"
              >
                <Wand2 className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden 2xl:inline">Ajustar ICMS/CFOP</span>
                <span className="2xl:hidden hidden sm:inline">ICMS/CFOP</span>
              </button>
            )}

            {/* Undo / Redo */}
            <div className="flex items-center bg-slate-800 rounded-md border border-slate-700 p-0.5 flex-shrink-0">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title={`Desfazer (Ctrl+Z) - ${undoCount} ações`}
                className={`p-1.5 rounded text-xs transition ${
                  canUndo ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-500 cursor-not-allowed'
                }`}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                title={`Refazer (Ctrl+Y) - ${redoCount} ações`}
                className={`p-1.5 rounded text-xs transition ${
                  canRedo ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-500 cursor-not-allowed'
                }`}
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* PDF Report */}
            <button
              onClick={() => onOpenPdfModal('cfop_consolidated', 'ENTRADA')}
              title="Gerar Relatório Consolidado por CFOP em PDF (A4 Paisagem)"
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex-shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden 2xl:inline">Relatório PDF</span>
              <span className="2xl:hidden hidden sm:inline">PDF</span>
            </button>

            {/* Dark / Light Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
              aria-label={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex-shrink-0 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden xl:inline">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-sky-300" />
                  <span className="hidden xl:inline">Escuro</span>
                </>
              )}
            </button>

            {/* Export Dropdown */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {exportDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setExportDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-64 rounded-md shadow-xl bg-slate-800 border border-slate-700 py-1.5 z-30 text-xs">
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Exportação Fiscal
                    </div>
                    <button
                      onClick={() => {
                        onExportTxt();
                        setExportDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700/80 text-white flex items-center space-x-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="font-medium">Exportar SPED TXT</div>
                        <div className="text-[11px] text-slate-400">Totalizadores 9900/9999 recalculados</div>
                      </div>
                    </button>
                    
                    <div className="my-1 border-t border-slate-700"></div>
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Exportação de Dados
                    </div>
                    <button
                      onClick={() => {
                        onExportCurrentExcel();
                        setExportDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700/80 text-white flex items-center space-x-2"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-green-400" />
                      <div>
                        <div className="font-medium">Registro {currentReg} → Excel (.xlsx)</div>
                        <div className="text-[11px] text-slate-400">Apenas a tabela atualmente selecionada</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        onExportCurrentCsv();
                        setExportDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700/80 text-white flex items-center space-x-2"
                    >
                      <Table className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="font-medium">Registro {currentReg} → CSV</div>
                        <div className="text-[11px] text-slate-400">Compatível com Excel pt-BR (ponto e vírgula)</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        onExportAllExcel();
                        setExportDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700/80 text-white flex items-center space-x-2"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="font-medium">Todos os Registros → Excel (1 arquivo)</div>
                        <div className="text-[11px] text-slate-400">Abas separadas para cada registro</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

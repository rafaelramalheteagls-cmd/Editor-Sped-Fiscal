import React, { useState, useRef } from 'react';
import { 
  X, 
  FileCode2, 
  Upload, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { CteData } from '../types';
import { parseCteXml } from '../lib/cteParser';
import { formatCurrencyBRL, formatCnpjCpf } from '../lib/spedParser';

interface CteImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCte: (cte: CteData) => void;
}

export const CteImportModal: React.FC<CteImportModalProps> = ({
  isOpen,
  onClose,
  onImportCte,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedCte, setParsedCte] = useState<CteData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = parseCteXml(text);
        setParsedCte(data);
        setErrorMsg(null);
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao processar arquivo XML do CT-e.');
        setParsedCte(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadSampleCte = async () => {
    try {
      setLoadingSample(true);
      const res = await fetch('/samples/sample_cte.xml');
      if (!res.ok) throw new Error('Não foi possível carregar o arquivo de exemplo.');
      const text = await res.text();
      const data = parseCteXml(text);
      setParsedCte(data);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar exemplo de CT-e.');
    } finally {
      setLoadingSample(false);
    }
  };

  const handleConfirmImport = () => {
    if (parsedCte) {
      onImportCte(parsedCte);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-transparent dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-inner">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Importar CT-e XML (Conhecimento de Transporte)</h3>
              <p className="text-xs text-slate-400">Gera registros analíticos D100/D190 e cadastra participante no 0150</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs text-slate-700 dark:text-slate-300">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xml,text/xml"
            className="hidden"
          />

          {/* Upload / Sample trigger */}
          {!parsedCte && (
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
              <FileCode2 className="w-12 h-12 mx-auto text-indigo-500 mb-3" />
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Selecione o arquivo XML do CT-e</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                Padrão SEFAZ modelo 57 (Conhecimento de Transporte Eletrônico)
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Escolher Arquivo XML</span>
                </button>
                <button
                  onClick={handleLoadSampleCte}
                  disabled={loadingSample}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>{loadingSample ? 'Carregando...' : 'Carregar Exemplo de CT-e'}</span>
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed CT-e Preview */}
          {parsedCte && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-bold text-indigo-900 dark:text-indigo-200 text-sm">
                    CT-e nº {parsedCte.nCT} - Série {parsedCte.serie}
                  </span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Trocar arquivo
                </button>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/70 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Chave de Acesso:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-bold break-all">{parsedCte.chvCte}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Valor da Prestação:</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    {formatCurrencyBRL(parsedCte.vPrest)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Emitente (Transportadora):</span>
                  <strong className="text-slate-900 dark:text-slate-100">{parsedCte.emit.xNome}</strong>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    CNPJ: {formatCnpjCpf(parsedCte.emit.cnpj)} | IE: {parsedCte.emit.ie || 'ISENTO'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Destinatário:</span>
                  <strong className="text-slate-900 dark:text-slate-100">{parsedCte.dest.xNome || 'Empresa'}</strong>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    CNPJ: {formatCnpjCpf(parsedCte.dest.cnpj)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Origem e Destino do Frete:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {parsedCte.xMunIni || parsedCte.cMunIni} → {parsedCte.xMunFim || parsedCte.cMunFim}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-400 block text-[11px]">CFOP / RNTRC:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">
                    CFOP: {parsedCte.cfop} | RNTRC: {parsedCte.emit.rntrc || 'N/I'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!parsedCte}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Integrar ao SPED Fiscal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

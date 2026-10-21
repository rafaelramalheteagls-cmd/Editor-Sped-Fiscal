import React, { useState, useMemo } from 'react';
import { X, Wand2, Calculator, Check, AlertCircle } from 'lucide-react';
import { SpedLine } from '../types';
import { parseFloatSped, formatFloatSped, formatCurrencyBRL } from '../lib/spedParser';

interface InventoryAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: SpedLine[];
  onApplyAdjustment: (newLines: SpedLine[], message: string) => void;
}

export const InventoryAdjustModal: React.FC<InventoryAdjustModalProps> = ({
  isOpen,
  onClose,
  lines,
  onApplyAdjustment,
}) => {
  const [targetValueInput, setTargetValueInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute current inventory values
  const { currentTotal, h005Line, h010Lines } = useMemo(() => {
    const h005 = lines.find(l => l.reg === 'H005');
    const h010 = lines.filter(l => l.reg === 'H010');

    let total = 0;
    if (h005 && h005.fields[1]) {
      total = parseFloatSped(h005.fields[1]); // VL_INV
    } else {
      total = h010.reduce((acc, l) => acc + parseFloatSped(l.fields[3]), 0); // VL_ITEM is index 3
    }

    return { currentTotal: total, h005Line: h005, h010Lines: h010 };
  }, [lines]);

  if (!isOpen) return null;

  const targetValue = parseFloatSped(targetValueInput);
  const factor = currentTotal > 0 && targetValue > 0 ? targetValue / currentTotal : 0;

  const handleApply = () => {
    if (targetValue <= 0) {
      setErrorMsg('Informe um valor final válido maior que zero.');
      return;
    }
    if (h010Lines.length === 0) {
      setErrorMsg('Nenhum registro H010 de inventário encontrado no arquivo.');
      return;
    }

    const updatedLines = lines.map(line => {
      if (line.reg === 'H005') {
        const fields = [...line.fields];
        fields[1] = formatFloatSped(targetValue); // VL_INV
        return {
          ...line,
          fields,
          raw: `|H005|${fields.join('|')}|`,
        };
      }
      if (line.reg === 'H010') {
        // Layout: ['COD_ITEM', 'UNID', 'QTD', 'VL_UNIT', 'VL_ITEM', 'IND_PROP', 'COD_PART', 'TXT_COMPL', 'COD_CTA', 'VL_ITEM_IR']
        const fields = [...line.fields];
        const oldVlUnit = parseFloatSped(fields[2]); // VL_UNIT is index 2 or 3
        const oldVlItem = parseFloatSped(fields[3]); // VL_ITEM

        const newVlItem = oldVlItem * factor;
        const qtd = parseFloatSped(fields[1]);
        const newVlUnit = qtd > 0 ? newVlItem / qtd : oldVlUnit * factor;

        fields[2] = formatFloatSped(newVlUnit, 4); // VL_UNIT
        fields[3] = formatFloatSped(newVlItem, 2); // VL_ITEM

        return {
          ...line,
          fields,
          raw: `|H010|${fields.join('|')}|`,
        };
      }
      return line;
    });

    onApplyAdjustment(
      updatedLines,
      `Inventário ajustado com sucesso para ${formatCurrencyBRL(targetValue)} (${h010Lines.length} itens recalculados)`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors">
        {/* Header */}
        <div className="p-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-transparent dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Calculator className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Ajuste de Inventário (Bloco H)</h3>
              <p className="text-xs text-slate-400">Recálculo proporcional de itens do estoque (H005 e H010)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700 dark:text-slate-300">
          <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Valor Atual do Estoque:</span>
              <strong className="text-base text-slate-900 dark:text-slate-100 font-mono">{formatCurrencyBRL(currentTotal)}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Itens no H010:</span>
              <strong className="text-base text-slate-900 dark:text-slate-100 font-mono">{h010Lines.length}</strong>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Novo Valor Total Desejado para o Estoque (R$):
            </label>
            <input
              type="text"
              value={targetValueInput}
              onChange={e => setTargetValueInput(e.target.value)}
              placeholder="Ex: 500000,00"
              className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              Cada item do registro H010 terá seu valor total e unitário recalculado proporcionalmente.
            </span>
          </div>

          {factor > 0 && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between font-mono">
                <span>Fator de Ajuste:</span>
                <strong className="text-emerald-900 dark:text-emerald-200">{factor.toFixed(6)}x</strong>
              </div>
              <div className="flex items-center justify-between font-mono mt-1">
                <span>Variação:</span>
                <strong className="text-emerald-950 dark:text-emerald-100">{((factor - 1) * 100).toFixed(2)}%</strong>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
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
            onClick={handleApply}
            disabled={factor <= 0}
            className="inline-flex items-center space-x-1 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Aplicar Novo Valor</span>
          </button>
        </div>
      </div>
    </div>
  );
};

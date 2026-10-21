import React, { useState, useMemo } from 'react';
import { Search, ArrowRight, FileText, Filter, CheckCircle2 } from 'lucide-react';
import { SpedLine } from '../types';
import { SPED_RECORD_DESCRIPTIONS } from '../lib/spedLayout';

interface GlobalSearchTabProps {
  lines: SpedLine[];
  onNavigateToRecord: (reg: string, lineId?: number) => void;
}

export const GlobalSearchTab: React.FC<GlobalSearchTabProps> = ({
  lines,
  onNavigateToRecord,
}) => {
  const [query, setQuery] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<string>('ALL');

  const searchResults = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase().trim();

    return lines
      .filter(line => {
        if (selectedBlock !== 'ALL' && line.reg[0] !== selectedBlock) return false;
        if (line.lineNumber.toString() === q) return true;
        if (line.reg.toLowerCase().includes(q)) return true;
        if (line.parentDoc && line.parentDoc.toLowerCase().includes(q)) return true;
        return line.fields.some(f => (f || '').toLowerCase().includes(q));
      })
      .slice(0, 300); // limit to 300 for snappy performance
  }, [lines, query, selectedBlock]);

  const blocks = ['ALL', '0', 'B', 'C', 'D', 'E', 'G', 'H', 'K', '1', '9'];

  return (
    <div className="space-y-6 pb-12 transition-colors">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 transition-colors">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center space-x-2">
          <Search className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>Busca Global no Arquivo SPED</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Localize rapidamente qualquer valor (Chave de NF-e, Número de Nota, CNPJ, Razão Social, Descrição de Produto, CFOP, CST ou Valor Monetário) em todas as linhas da escrituração.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Digite ao menos 2 caracteres para pesquisar em todo o arquivo..."
              className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              autoFocus
            />
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
            {blocks.map(b => (
              <button
                key={b}
                onClick={() => setSelectedBlock(b)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition shrink-0 cursor-pointer ${
                  selectedBlock === b
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {b === 'ALL' ? 'Todos Blocos' : `Bloco ${b}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Resultados da Pesquisa {query.length >= 2 && `(${searchResults.length}${searchResults.length === 300 ? '+' : ''})`}
          </span>
          {query.length >= 2 && (
            <span className="text-slate-400 dark:text-slate-500">
              Mostrando até 300 primeiras ocorrências
            </span>
          )}
        </div>

        {query.length < 2 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
            Informe um termo de busca acima para pesquisar.
          </div>
        ) : searchResults.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
            Nenhum registro encontrado correspondente ao termo &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-16">Linha</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-20">Registro</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300 w-28">Doc Pai</th>
                  <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300">Conteúdo do Registro</th>
                  <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300 w-24">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px] bg-white dark:bg-slate-900">
                {searchResults.map(line => (
                  <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                    <td className="px-3 py-2 text-slate-400 dark:text-slate-500">{line.lineNumber}</td>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">{line.reg}</td>
                    <td className="px-3 py-2 text-indigo-700 dark:text-indigo-400 font-semibold">{line.parentDoc || '-'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-xl truncate font-sans">
                      {line.fields.join(' | ')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => onNavigateToRecord(line.reg, line.id)}
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 text-[11px] font-sans font-medium transition cursor-pointer"
                      >
                        <span>Abrir</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

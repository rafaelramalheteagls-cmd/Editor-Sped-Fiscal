import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  FileText, 
  Loader2, 
  Check, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SpedMetadata, CfopSummaryItem, CfopTotals } from '../types';
import { formatCurrencyBRL, formatCnpjCpf, formatDateSped } from '../lib/spedParser';

function formatDocNumber(doc: string | undefined): string {
  if (!doc) return 'S/N';
  const clean = doc.trim();
  const digits = clean.replace(/\D/g, '');
  if (digits.length === 44) {
    const docFromKey = parseInt(digits.substring(25, 34), 10);
    if (!isNaN(docFromKey) && docFromKey > 0) {
      return String(docFromKey);
    }
  }
  return clean;
}

export interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: SpedMetadata | null;
  entradas: CfopSummaryItem[];
  saidas: CfopSummaryItem[];
  totals: CfopTotals;
  initialReportType?: 'cfop_consolidated' | 'general';
  initialOperationType?: 'ENTRADA' | 'SAIDA' | 'TODAS';
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  onClose,
  metadata,
  entradas,
  saidas,
  totals,
  initialReportType = 'cfop_consolidated',
  initialOperationType = 'ENTRADA',
}) => {
  if (!isOpen || !metadata) return null;

  // Active report model
  const [reportType, setReportType] = useState<'cfop_consolidated' | 'general'>(initialReportType);
  
  // Options for Consolidated CFOP Report
  const [operationType, setOperationType] = useState<'ENTRADA' | 'SAIDA' | 'TODAS'>(initialOperationType);
  const [numberFormat, setNumberFormat] = useState<'model' | 'br'>('model'); // 'model' matches user screenshot: R$ 2,316.70
  const [selectedCfops, setSelectedCfops] = useState<Set<string>>(() => {
    const all = new Set<string>();
    entradas.forEach(i => all.add(i.cfop));
    saidas.forEach(i => all.add(i.cfop));
    return all;
  });

  // Preview page index (0 = Capa, 1..N = CFOP pages)
  const [previewPageIndex, setPreviewPageIndex] = useState<number>(0);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Filter CFOP items according to active operation type and selection
  const relevantCfops = useMemo(() => {
    let list: CfopSummaryItem[] = [];
    if (operationType === 'ENTRADA') {
      list = entradas;
    } else if (operationType === 'SAIDA') {
      list = saidas;
    } else {
      list = [...entradas, ...saidas];
    }
    return list.filter(item => selectedCfops.has(item.cfop));
  }, [operationType, entradas, saidas, selectedCfops]);

  // Aggregate stats for the cover page
  const consolidatedStats = useMemo(() => {
    let totalRecords = 0;
    let totalValorOperacao = 0;
    let totalValorIcms = 0;

    relevantCfops.forEach(item => {
      totalRecords += item.records.length;
      totalValorOperacao += item.totalOperacao;
      totalValorIcms += item.valorIcms;
    });

    return {
      totalRecords,
      cfopsCount: relevantCfops.length,
      totalValorOperacao,
      totalValorIcms,
    };
  }, [relevantCfops]);

  // Helper currency formatter
  const formatCurrency = (val: number): string => {
    const num = Number(val || 0);
    if (numberFormat === 'model') {
      // Formato idêntico ao modelo do usuário: R$ 2,316.70
      return `R$ ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    // Formato padrão brasileiro: R$ 2.316,70
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const toggleAllCfops = (select: boolean) => {
    const newSet = new Set<string>(selectedCfops);
    const targetList = operationType === 'ENTRADA' ? entradas : operationType === 'SAIDA' ? saidas : [...entradas, ...saidas];
    targetList.forEach(item => {
      if (select) newSet.add(item.cfop);
      else newSet.delete(item.cfop);
    });
    setSelectedCfops(newSet);
  };

  const toggleCfop = (cfop: string) => {
    const newSet = new Set<string>(selectedCfops);
    if (newSet.has(cfop)) newSet.delete(cfop);
    else newSet.add(cfop);
    setSelectedCfops(newSet);
  };

  // -------------------------------------------------------------
  // GENERATE CONSOLIDATED CFOP REPORT (LANDSCAPE) - MATCHES SCREENSHOTS
  // -------------------------------------------------------------
  const generateConsolidatedCfopPdf = (): jsPDF => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

    const reportTitle = operationType === 'ENTRADA'
      ? 'Relatório Consolidado - Entradas'
      : operationType === 'SAIDA'
      ? 'Relatório Consolidado - Saídas'
      : 'Relatório Consolidado - Entradas e Saídas';

    // 1. PAGE 1: COVER PAGE (Exact match to screenshot page 1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(reportTitle, pageWidth / 2, 75, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Total de Registros: ${consolidatedStats.totalRecords}`, pageWidth / 2, 98, { align: 'center' });
    doc.text(`CFOPs Incluídos: ${consolidatedStats.cfopsCount}`, pageWidth / 2, 108, { align: 'center' });

    const totalText = `Valor Total: ${formatCurrency(consolidatedStats.totalValorOperacao)} | ICMS Total: ${formatCurrency(consolidatedStats.totalValorIcms)}`;
    doc.text(totalText, pageWidth / 2, 122, { align: 'center' });

    // 2. SUBSEQUENT PAGES: EACH CFOP ON A NEW PAGE (Exact match to screenshot pages 2..16)
    for (const item of relevantCfops) {
      doc.addPage('a4', 'landscape');

      // Title above table: "CFOP {cfop} - {count} registros"
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text(`CFOP ${item.cfop} - ${item.records.length} registros`, pageWidth / 2, 22, { align: 'center' });

      // Rows for this CFOP
      const tableBody = item.records.map(rec => [
        item.cfop,
        formatDocNumber(rec.parentDoc),
        formatCurrency(rec.valorOperacao),
        formatCurrency(rec.baseIcms),
        `${Number(rec.aliquota || 0).toFixed(1)}%`,
        formatCurrency(rec.valorIcms),
      ]);

      autoTable(doc, {
        startY: 28,
        margin: { left: 24, right: 24, top: 28, bottom: 20 },
        theme: 'grid',
        head: [['CFOP', 'Nota Fiscal', 'Valor Operação', 'Base ICMS', 'Alíquota', 'Valor ICMS']],
        body: tableBody,
        foot: [
          [
            'TOTAIS',
            '',
            formatCurrency(item.totalOperacao),
            formatCurrency(item.baseIcms),
            '',
            formatCurrency(item.valorIcms),
          ]
        ],
        showFoot: 'lastPage',
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          cellPadding: 2.2,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.15,
          fillColor: [255, 255, 255],
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineColor: [0, 0, 0],
          lineWidth: 0.15,
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineColor: [0, 0, 0],
          lineWidth: 0.15,
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'left' },
          1: { cellWidth: 45, halign: 'left' },
          2: { cellWidth: 45, halign: 'right' },
          3: { cellWidth: 45, halign: 'right' },
          4: { cellWidth: 35, halign: 'center' },
          5: { cellWidth: 49, halign: 'right' },
        },
      });
    }

    return doc;
  };

  // -------------------------------------------------------------
  // GENERATE GENERAL MACRO REPORT (PORTRAIT)
  // -------------------------------------------------------------
  const generateGeneralDemonstrativoPdf = (): jsPDF => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;

    // Header banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, 12, pageWidth - margin * 2, 17, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(255, 255, 255);
    doc.text('RELATÓRIO DEMONSTRATIVO DE APURAÇÃO FISCAL', margin + 4, 18.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('SPED EFD ICMS/IPI — Resumo Consolidado de Operações e CFOPs', margin + 4, 24.5);

    const emitDate = new Date().toLocaleDateString('pt-BR');
    const emitTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    doc.text(`Emissão: ${emitDate} às ${emitTime}`, pageWidth - margin - 4, 18.5, { align: 'right' });
    doc.text('Sistema: SPED Fiscal Editor Pro', pageWidth - margin - 4, 24.5, { align: 'right' });

    // Company identification
    const cnpjCpfFormatted = formatCnpjCpf(metadata.cnpj) || formatCnpjCpf(metadata.cpf) || 'N/A';
    const periodoFormatted = `${formatDateSped(metadata.periodoInicio)} a ${formatDateSped(metadata.periodoFim)}`;

    autoTable(doc, {
      startY: 32,
      margin: { left: margin, right: margin },
      theme: 'plain',
      body: [
        [
          { content: `Razão Social: ${metadata.razaoSocial}`, styles: { fontStyle: 'bold' } },
          { content: `CNPJ / CPF: ${cnpjCpfFormatted}`, styles: { fontStyle: 'bold' } },
        ],
        [
          { content: `Inscrição Estadual: ${metadata.ie || 'ISENTO'}` },
          { content: `Período de Apuração: ${periodoFormatted}` },
        ],
      ],
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        fillColor: [248, 250, 252],
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 6;

    // Macro Balance
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('1. RESUMO CONSOLIDADO DO PERÍODO', margin, currentY);

    const saldoComercial = totals.totalSaidas - totals.totalEntradas;
    const saldoIcms = totals.valorIcmsSaidas - totals.valorIcmsEntradas;

    autoTable(doc, {
      startY: currentY + 2.5,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [['INDICADOR', 'TOTAL OPERAÇÃO', 'ICMS CRÉDITO / DÉBITO', 'SITUAÇÃO / BALANÇO']],
      body: [
        ['Total de Entradas', formatCurrencyBRL(totals.totalEntradas), formatCurrencyBRL(totals.valorIcmsEntradas), 'Crédito Fiscal Apurado'],
        ['Total de Saídas', formatCurrencyBRL(totals.totalSaidas), formatCurrencyBRL(totals.valorIcmsSaidas), 'Débito Fiscal Apurado'],
        ['Balanço Comercial', formatCurrencyBRL(saldoComercial), '—', saldoComercial >= 0 ? 'Superávit Comercial' : 'Déficit Comercial'],
        ['Saldo de ICMS Estimado', '—', formatCurrencyBRL(Math.abs(saldoIcms)), saldoIcms >= 0 ? 'ICMS a Recolher' : 'Saldo Credor a Transportar'],
      ],
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        textColor: [15, 23, 42],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 44 },
        1: { halign: 'right', cellWidth: 42 },
        2: { halign: 'right', cellWidth: 44 },
        3: { halign: 'center', cellWidth: 52 },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    // Entradas Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('2. DETALHAMENTO DAS ENTRADAS POR CFOP', margin, currentY);

    const entradasBody = entradas.map(i => [
      i.cfop,
      String(i.count),
      formatCurrencyBRL(i.totalOperacao),
      formatCurrencyBRL(i.baseIcms),
      formatCurrencyBRL(i.valorIcms),
      `${totals.totalEntradas > 0 ? ((i.totalOperacao / totals.totalEntradas) * 100).toFixed(1) : '0.0'}%`,
    ]);
    const sumEntradasCount = entradas.reduce((acc, curr) => acc + curr.count, 0);

    autoTable(doc, {
      startY: currentY + 2.5,
      margin: { left: margin, right: margin },
      theme: 'striped',
      head: [['CFOP', 'Qtd Docs', 'Total Operação', 'Base ICMS', 'Valor ICMS', '% Part.']],
      body: entradasBody.length > 0 ? entradasBody : [['Nenhuma operação de entrada registrada.', '', '', '', '', '']],
      foot: entradasBody.length > 0 ? [
        ['TOTAL ENTRADAS', String(sumEntradasCount), formatCurrencyBRL(totals.totalEntradas), formatCurrencyBRL(totals.baseIcmsEntradas), formatCurrencyBRL(totals.valorIcmsEntradas), '100.0%']
      ] : undefined,
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 20 },
        1: { halign: 'right', cellWidth: 22 },
        2: { halign: 'right', cellWidth: 38 },
        3: { halign: 'right', cellWidth: 38 },
        4: { halign: 'right', cellWidth: 38 },
        5: { halign: 'right', cellWidth: 26 },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
    if (currentY > 235) {
      doc.addPage();
      currentY = 16;
    }

    // Saídas Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('3. DETALHAMENTO DAS SAÍDAS POR CFOP', margin, currentY);

    const saidasBody = saidas.map(i => [
      i.cfop,
      String(i.count),
      formatCurrencyBRL(i.totalOperacao),
      formatCurrencyBRL(i.baseIcms),
      formatCurrencyBRL(i.valorIcms),
      `${totals.totalSaidas > 0 ? ((i.totalOperacao / totals.totalSaidas) * 100).toFixed(1) : '0.0'}%`,
    ]);
    const sumSaidasCount = saidas.reduce((acc, curr) => acc + curr.count, 0);

    autoTable(doc, {
      startY: currentY + 2.5,
      margin: { left: margin, right: margin },
      theme: 'striped',
      head: [['CFOP', 'Qtd Docs', 'Total Operação', 'Base ICMS', 'Valor ICMS', '% Part.']],
      body: saidasBody.length > 0 ? saidasBody : [['Nenhuma operação de saída registrada.', '', '', '', '', '']],
      foot: saidasBody.length > 0 ? [
        ['TOTAL SAÍDAS', String(sumSaidasCount), formatCurrencyBRL(totals.totalSaidas), formatCurrencyBRL(totals.baseIcmsSaidas), formatCurrencyBRL(totals.valorIcmsSaidas), '100.0%']
      ] : undefined,
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 20 },
        1: { halign: 'right', cellWidth: 22 },
        2: { halign: 'right', cellWidth: 38 },
        3: { halign: 'right', cellWidth: 38 },
        4: { halign: 'right', cellWidth: 38 },
        5: { halign: 'right', cellWidth: 26 },
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`SPED Fiscal Editor Pro — Escrituração com ${metadata.totalLines} linhas de registros`, margin, 290);
      doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, 290, { align: 'right' });
    }

    return doc;
  };

  const handleSavePdf = () => {
    try {
      setIsGeneratingPdf(true);
      setNoticeMessage(null);

      const doc = reportType === 'cfop_consolidated'
        ? generateConsolidatedCfopPdf()
        : generateGeneralDemonstrativoPdf();

      const cnpjClean = (metadata.cnpj || metadata.cpf || 'EMPRESA').replace(/\D/g, '');
      const operSuffix = reportType === 'cfop_consolidated' ? `_${operationType}` : '_Geral';
      const filename = `Relatorio_Consolidado_CFOP_${cnpjClean}${operSuffix}.pdf`;

      doc.save(filename);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3500);
    } catch (err: any) {
      console.error('Falha ao gerar PDF:', err);
      setNoticeMessage(`Erro ao gerar PDF: ${err?.message || 'Erro inesperado'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    setNoticeMessage(null);
    const reportElement = document.getElementById('printable-report');
    if (!reportElement) {
      window.print();
      return;
    }

    try {
      let printFrame = document.getElementById('sped-print-frame') as HTMLIFrameElement;
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'sped-print-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
      }

      const doc = printFrame.contentWindow?.document;
      if (doc) {
        const isLandscape = reportType === 'cfop_consolidated';
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Relatório Fiscal SPED</title>
              <style>
                body {
                  font-family: Arial, Helvetica, sans-serif;
                  color: #000000;
                  margin: 0;
                  background: #ffffff;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 15px;
                  margin-bottom: 20px;
                  font-size: 11px;
                }
                th, td {
                  border: 1px solid #000000;
                  padding: 5px 8px;
                }
                th {
                  background-color: #ffffff;
                  font-weight: bold;
                  text-align: center;
                }
                .text-right { text-align: right; }
                .text-left { text-align: left; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .page-break { page-break-before: always; }
                .cover-page {
                  height: 90vh;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  text-align: center;
                }
                @media print {
                  @page {
                    size: A4 ${isLandscape ? 'landscape' : 'portrait'};
                    margin: 1.5cm;
                  }
                  body { padding: 0; }
                }
              </style>
            </head>
            <body>
              ${reportElement.innerHTML}
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch (err) {
            console.warn('Frame print error:', err);
            window.print();
          }
        }, 300);
      } else {
        window.print();
      }
    } catch (e) {
      console.warn('Print sandbox restriction:', e);
      setNoticeMessage('A impressão direta foi bloqueada pela proteção do navegador. Clique em "Salvar PDF" para baixar o arquivo.');
    }
  };

  const totalPreviewPages = 1 + relevantCfops.length;
  const currentPreviewCfop = previewPageIndex > 0 ? relevantCfops[previewPageIndex - 1] : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[95vh] transition-colors">
        {/* Top Header */}
        <div className="p-3 sm:p-4 bg-slate-900 dark:bg-slate-950 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden border-b border-transparent dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Relatórios de CFOP & Apuração Fiscal</h3>
              <p className="text-[11px] text-slate-400">Geração de relatórios consolidados em formato PDF e impressão A4</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {/* Primary Action: Direct PDF Download */}
            <button
              onClick={handleSavePdf}
              disabled={isGeneratingPdf}
              title="Gera e faz o download direto do arquivo PDF"
              className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer ${
                pdfSuccess
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              } disabled:opacity-75 disabled:cursor-not-allowed`}
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Gerando PDF...</span>
                </>
              ) : pdfSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>PDF Salvo!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar PDF</span>
                </>
              )}
            </button>

            {/* Secondary Action: Print */}
            <button
              onClick={handlePrint}
              title="Imprimir relatório"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-white transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Mode Tabs */}
        <div className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto print:hidden">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setReportType('cfop_consolidated');
                setPreviewPageIndex(0);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center space-x-1.5 cursor-pointer ${
                reportType === 'cfop_consolidated'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm border border-slate-200 dark:border-slate-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Relatório Consolidado por CFOP (Paisagem)</span>
            </button>

            <button
              onClick={() => {
                setReportType('general');
                setPreviewPageIndex(0);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center space-x-1.5 cursor-pointer ${
                reportType === 'general'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm border border-slate-200 dark:border-slate-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Demonstrativo Geral de Apuração (Retrato)</span>
            </button>
          </div>

          {/* Currency format toggle */}
          {reportType === 'cfop_consolidated' && (
            <div className="flex items-center space-x-1 text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600">
              <span className="font-medium">Formato:</span>
              <button
                onClick={() => setNumberFormat('model')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                  numberFormat === 'model' ? 'bg-slate-900 dark:bg-slate-950 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                }`}
                title="Formato idêntico ao modelo (R$ 2,316.70)"
              >
                R$ 1,234.56
              </button>
              <button
                onClick={() => setNumberFormat('br')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                  numberFormat === 'br' ? 'bg-slate-900 dark:bg-slate-950 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                }`}
                title="Formato brasileiro tradicional (R$ 2.316,70)"
              >
                R$ 1.234,56
              </button>
            </div>
          )}
        </div>

        {/* Options Toolbar for CFOP Consolidated Report */}
        {reportType === 'cfop_consolidated' && (
          <div className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
            {/* Operation Type selection */}
            <div className="flex items-center space-x-1">
              <span className="text-[11px] font-bold text-slate-600 mr-1.5">OPERAÇÃO:</span>
              <button
                onClick={() => {
                  setOperationType('ENTRADA');
                  setPreviewPageIndex(0);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                  operationType === 'ENTRADA'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Entradas ({entradas.length} CFOPs)
              </button>
              <button
                onClick={() => {
                  setOperationType('SAIDA');
                  setPreviewPageIndex(0);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                  operationType === 'SAIDA'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Saídas ({saidas.length} CFOPs)
              </button>
              <button
                onClick={() => {
                  setOperationType('TODAS');
                  setPreviewPageIndex(0);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                  operationType === 'TODAS'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Todas ({entradas.length + saidas.length} CFOPs)
              </button>
            </div>

            {/* Page preview selector / navigator */}
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-500 font-medium">Visualizar Página:</span>
              <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded px-1 py-0.5">
                <button
                  onClick={() => setPreviewPageIndex(prev => Math.max(0, prev - 1))}
                  disabled={previewPageIndex === 0}
                  className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-[11px] font-mono font-semibold text-slate-800">
                  {previewPageIndex === 0
                    ? 'Pág 1 (Capa)'
                    : `CFOP ${currentPreviewCfop?.cfop} (${previewPageIndex}/${relevantCfops.length})`}
                </span>
                <button
                  onClick={() => setPreviewPageIndex(prev => Math.min(relevantCfops.length, prev + 1))}
                  disabled={previewPageIndex >= relevantCfops.length}
                  className="p-1 text-slate-600 hover:text-slate-900 disabled:opacity-30"
                  title="Próxima página"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setPreviewPageIndex(-1)}
                className={`px-2 py-1 rounded text-[11px] font-medium border ${
                  previewPageIndex === -1
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Exibir todas as páginas do relatório em sequência contínua"
              >
                Ver Todas
              </button>
            </div>
          </div>
        )}

        {/* Notice Message if any */}
        {noticeMessage && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center space-x-2 print:hidden">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{noticeMessage}</span>
          </div>
        )}

        {/* Printable & Preview Content Area */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-200/50 dark:bg-slate-950/80 flex flex-col items-center transition-colors">
          {reportType === 'cfop_consolidated' ? (
            /* CONSOLIDATED CFOP REPORT CONTAINER (Exact match to screenshots) */
            <div id="printable-report" className="w-full flex flex-col items-center space-y-6">
              {/* PAGE 1: COVER PAGE */}
              {(previewPageIndex === 0 || previewPageIndex === -1) && (
                <div className="w-full max-w-4xl bg-white shadow-md border border-slate-300 rounded p-8 sm:p-16 aspect-[1.414/1] flex flex-col justify-center items-center text-center text-slate-950 font-sans select-none">
                  <h1 className="text-xl sm:text-2xl font-bold mb-8 text-black">
                    {operationType === 'ENTRADA'
                      ? 'Relatório Consolidado - Entradas'
                      : operationType === 'SAIDA'
                      ? 'Relatório Consolidado - Saídas'
                      : 'Relatório Consolidado - Entradas e Saídas'}
                  </h1>

                  <div className="space-y-2 text-xs sm:text-sm text-black">
                    <p>Total de Registros: {consolidatedStats.totalRecords}</p>
                    <p>CFOPs Incluídos: {consolidatedStats.cfopsCount}</p>
                  </div>

                  <div className="mt-6 text-xs sm:text-sm text-black">
                    <p>
                      Valor Total: {formatCurrency(consolidatedStats.totalValorOperacao)} | ICMS Total: {formatCurrency(consolidatedStats.totalValorIcms)}
                    </p>
                  </div>
                </div>
              )}

              {/* CFOP PAGES (One per CFOP, starting with centered title and crisp black bordered table) */}
              {relevantCfops.map((item, idx) => {
                const pageNumber = idx + 1;
                const isVisible = previewPageIndex === -1 || previewPageIndex === pageNumber;
                if (!isVisible) return null;

                return (
                  <div
                    key={item.cfop}
                    className="w-full max-w-4xl bg-white shadow-md border border-slate-300 rounded p-6 sm:p-10 text-slate-950 font-sans page-break"
                  >
                    {/* Header above table */}
                    <div className="text-center font-bold text-sm sm:text-base text-black mb-4">
                      CFOP {item.cfop} - {item.records.length} registros
                    </div>

                    {/* Table with solid black borders matching the PDF screenshot */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-black text-[11px] sm:text-xs">
                        <thead>
                          <tr className="border border-black font-bold text-black bg-white">
                            <th className="border border-black px-3 py-1.5 text-left font-bold w-24">CFOP</th>
                            <th className="border border-black px-3 py-1.5 text-left font-bold">Nota Fiscal</th>
                            <th className="border border-black px-3 py-1.5 text-right font-bold">Valor Operação</th>
                            <th className="border border-black px-3 py-1.5 text-right font-bold">Base ICMS</th>
                            <th className="border border-black px-3 py-1.5 text-center font-bold w-20">Alíquota</th>
                            <th className="border border-black px-3 py-1.5 text-right font-bold">Valor ICMS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.records.map((rec, rIdx) => (
                            <tr key={rIdx} className="border border-black text-black">
                              <td className="border border-black px-3 py-1 text-left font-mono">{item.cfop}</td>
                              <td className="border border-black px-3 py-1 text-left font-mono">{formatDocNumber(rec.parentDoc)}</td>
                              <td className="border border-black px-3 py-1 text-right font-mono">{formatCurrency(rec.valorOperacao)}</td>
                              <td className="border border-black px-3 py-1 text-right font-mono">{formatCurrency(rec.baseIcms)}</td>
                              <td className="border border-black px-3 py-1 text-center font-mono">{Number(rec.aliquota || 0).toFixed(1)}%</td>
                              <td className="border border-black px-3 py-1 text-right font-mono">{formatCurrency(rec.valorIcms)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border border-black font-bold text-black bg-white">
                            <td colSpan={2} className="border border-black px-3 py-1.5 text-left font-bold uppercase">
                              TOTAIS
                            </td>
                            <td className="border border-black px-3 py-1.5 text-right font-bold font-mono">
                              {formatCurrency(item.totalOperacao)}
                            </td>
                            <td className="border border-black px-3 py-1.5 text-right font-bold font-mono">
                              {formatCurrency(item.baseIcms)}
                            </td>
                            <td className="border border-black px-3 py-1.5 text-center font-bold font-mono"></td>
                            <td className="border border-black px-3 py-1.5 text-right font-bold font-mono">
                              {formatCurrency(item.valorIcms)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* GENERAL DEMONSTRATIVO REPORT CONTAINER (Portrait) */
            <div id="printable-report" className="w-full max-w-3xl bg-white shadow-md border border-slate-300 rounded p-8 text-slate-900 font-sans">
              <div className="border-b-2 border-slate-900 pb-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                      Relatório Demonstrativo de Apuração Fiscal
                    </h1>
                    <p className="text-xs text-slate-600">
                      SPED EFD ICMS/IPI — Resumo Consolidado de Operações e CFOPs
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
                    <div className="font-mono">Sistema: SPED Fiscal Editor Pro</div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">RAZÃO SOCIAL:</span>
                    <strong className="text-slate-900">{metadata.razaoSocial}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">CNPJ / CPF:</span>
                    <strong className="font-mono text-slate-900">
                      {formatCnpjCpf(metadata.cnpj) || formatCnpjCpf(metadata.cpf) || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">INSCRIÇÃO ESTADUAL:</span>
                    <strong className="font-mono text-slate-900">{metadata.ie || 'ISENTO'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">PERÍODO DE APURAÇÃO:</span>
                    <strong className="font-mono text-slate-900">
                      {formatDateSped(metadata.periodoInicio)} a {formatDateSped(metadata.periodoFim)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Macro stats */}
              <div className="mb-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  1. Resumo Consolidado do Período
                </h2>
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">TOTAL DE ENTRADAS</span>
                    <strong className="text-base text-slate-900 font-mono">{formatCurrencyBRL(totals.totalEntradas)}</strong>
                    <span className="text-[10px] text-blue-700 block mt-1">
                      ICMS: {formatCurrencyBRL(totals.valorIcmsEntradas)}
                    </span>
                  </div>
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">TOTAL DE SAÍDAS</span>
                    <strong className="text-base text-slate-900 font-mono">{formatCurrencyBRL(totals.totalSaidas)}</strong>
                    <span className="text-[10px] text-emerald-700 block mt-1">
                      ICMS: {formatCurrencyBRL(totals.valorIcmsSaidas)}
                    </span>
                  </div>
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">BALANÇO COMERCIAL</span>
                    <strong className="text-base font-mono text-slate-900">
                      {formatCurrencyBRL(totals.totalSaidas - totals.totalEntradas)}
                    </strong>
                  </div>
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <span className="text-slate-500 block text-[10px]">SALDO ICMS ESTIMADO</span>
                    <strong className="text-base font-mono text-slate-900">
                      {formatCurrencyBRL(Math.abs(totals.valorIcmsSaidas - totals.valorIcmsEntradas))}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Entradas table */}
              <div className="mb-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  2. Entradas por CFOP
                </h2>
                <table className="min-w-full divide-y divide-slate-200 text-xs border border-slate-200">
                  <thead className="bg-slate-50 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left">CFOP</th>
                      <th className="px-2.5 py-1.5 text-right">Qtd</th>
                      <th className="px-2.5 py-1.5 text-right">Total Operação</th>
                      <th className="px-2.5 py-1.5 text-right">Base ICMS</th>
                      <th className="px-2.5 py-1.5 text-right">Valor ICMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {entradas.map(i => (
                      <tr key={i.cfop}>
                        <td className="px-2.5 py-1 font-bold">{i.cfop}</td>
                        <td className="px-2.5 py-1 text-right text-slate-600">{i.count}</td>
                        <td className="px-2.5 py-1 text-right">{formatCurrencyBRL(i.totalOperacao)}</td>
                        <td className="px-2.5 py-1 text-right text-slate-600">{formatCurrencyBRL(i.baseIcms)}</td>
                        <td className="px-2.5 py-1 text-right text-emerald-800">{formatCurrencyBRL(i.valorIcms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

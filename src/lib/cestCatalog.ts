/**
 * Catálogo e utilitários para validação de CEST (Código Especificador da Substituição Tributária)
 * Referência: Convênio ICMS 142/2018
 */

export interface CestItem {
  cest: string;
  segmento: string;
  descricao: string;
}

export const CEST_CATALOG: Record<string, CestItem> = {
  '0100100': { cest: '0100100', segmento: 'Autopeças', descricao: 'Geradores de gás de ar comprimido' },
  '0100200': { cest: '0100200', segmento: 'Autopeças', descricao: 'Vidros de segurança temperados ou laminados' },
  '0300100': { cest: '0300100', segmento: 'Cervejas, chopes, refrigerantes e água', descricao: 'Água mineral, gasosa ou não' },
  '0300700': { cest: '0300700', segmento: 'Cervejas, chopes, refrigerantes e água', descricao: 'Refrigerantes em embalagem descartável' },
  '0301000': { cest: '0301000', segmento: 'Cervejas, chopes, refrigerantes e água', descricao: 'Cerveja de malte em lata ou garrafa' },
  '0600100': { cest: '0600100', segmento: 'Combustíveis e lubrificantes', descricao: 'Gasolina automotiva comum e aditivada' },
  '0600200': { cest: '0600200', segmento: 'Combustíveis e lubrificantes', descricao: 'Óleo diesel e biodiesel' },
  '0600300': { cest: '0600300', segmento: 'Combustíveis e lubrificantes', descricao: 'Gás liquefeito de petróleo (GLP)' },
  '0600400': { cest: '0600400', segmento: 'Combustíveis e lubrificantes', descricao: 'Etanol anidro e hidratado combustível' },
  '1000100': { cest: '1000100', segmento: 'Materiais de construção', descricao: 'Cimento portland e derivados' },
  '1300100': { cest: '1300100', segmento: 'Medicamentos e produtos farmacêuticos', descricao: 'Medicamentos de uso humano' },
  '1700100': { cest: '1700100', segmento: 'Produtos alimentícios', descricao: 'Chocolates e preparados de cacau' },
  '1701200': { cest: '1701200', segmento: 'Produtos alimentícios', descricao: 'Leite em pó e laticínios' },
  '2000100': { cest: '2000100', segmento: 'Produtos de limpeza', descricao: 'Sabões, detergentes e desinfetantes' },
  '2100100': { cest: '2100100', segmento: 'Produtos eletrônicos', descricao: 'Aparelhos emissores com receptor' },
};

export function isValidCest(cest: string): boolean {
  if (!cest) return true;
  const clean = cest.replace(/\D/g, '');
  return clean.length === 7;
}

export function formatCest(cest: string): string {
  const clean = (cest || '').replace(/\D/g, '');
  if (clean.length === 7) {
    return `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 7)}`;
  }
  return cest;
}

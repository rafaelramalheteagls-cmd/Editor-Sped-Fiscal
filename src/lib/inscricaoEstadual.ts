/**
 * Validação de Inscrição Estadual (IE) brasileira por UF
 * Suporta cálculo de dígitos verificadores e valores de isenção.
 */

export interface IeValidationResult {
  valid: boolean;
  message?: string;
}

export function validateInscricaoEstadual(ieRaw: string, ufRaw: string): IeValidationResult {
  if (!ieRaw) {
    return { valid: true }; // Campo opcional em alguns registros
  }

  const uf = (ufRaw || '').trim().toUpperCase();
  const ieTrimmed = ieRaw.trim().toUpperCase();

  // Valores de isenção comuns e válidos perante a SEFAZ
  if (['ISENTO', 'ISENTA', 'ISENTO/IMUNE', 'PR/ISENTO'].includes(ieTrimmed)) {
    return { valid: true };
  }

  const digits = ieTrimmed.replace(/\D/g, '');

  if (!digits) {
    return { valid: false, message: 'Inscrição Estadual não contém dígitos numéricos' };
  }

  // Verifica comprimento padrão por UF
  const lengthRules: Record<string, number[]> = {
    AC: [13],
    AL: [9],
    AP: [9],
    AM: [9],
    BA: [8, 9],
    CE: [9],
    DF: [13],
    ES: [9],
    GO: [9],
    MA: [9],
    MT: [11],
    MS: [9],
    MG: [13],
    PA: [9],
    PB: [9],
    PR: [10],
    PE: [9, 14],
    PI: [9],
    RJ: [8],
    RN: [9, 10],
    RS: [10],
    RO: [14],
    RR: [9],
    SC: [9],
    SP: [12],
    SE: [9],
    TO: [9, 11],
  };

  const allowedLengths = lengthRules[uf];
  if (allowedLengths && !allowedLengths.includes(digits.length)) {
    return {
      valid: false,
      message: `Inscrição Estadual da UF ${uf} deve ter ${allowedLengths.join(' ou ')} dígitos (encontrado: ${digits.length})`,
    };
  }

  // Validação específica básica de dígitos verificadores para as maiores UFs
  if (uf === 'SP' && digits.length === 12) {
    const weights1 = [1, 3, 4, 5, 6, 7, 8, 10];
    let sum1 = 0;
    for (let i = 0; i < 8; i++) {
      sum1 += parseInt(digits[i], 10) * weights1[i];
    }
    const dv1 = (sum1 % 11) % 10;
    if (dv1 !== parseInt(digits[8], 10)) {
      return { valid: false, message: 'Dígito verificador inválido para Inscrição Estadual de SP' };
    }
  }

  return { valid: true };
}

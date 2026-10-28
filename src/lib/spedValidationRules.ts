/**
 * Regras e validadores auxiliares de integridade fiscal para o SPED Fiscal EFD ICMS/IPI
 */

export function validateCnpj(cnpjRaw: string): boolean {
  if (!cnpjRaw) return false;
  const digits = cnpjRaw.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  let size = 12;
  let numbers = digits.substring(0, size);
  const digitsCheck = digits.substring(size);
  let pos = size - 7;
  let sum = 0;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digitsCheck.charAt(0), 10)) return false;

  size = size + 1;
  numbers = digits.substring(0, size);
  pos = size - 7;
  sum = 0;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digitsCheck.charAt(1), 10);
}

export function validateCpf(cpfRaw: string): boolean {
  if (!cpfRaw) return false;
  const digits = cpfRaw.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(digits.charAt(10), 10);
}

export function validateChaveNfe(chaveRaw: string): boolean {
  if (!chaveRaw) return false;
  const clean = chaveRaw.replace(/\D/g, '');
  if (clean.length !== 44) return false;

  // Cálculo módulo 11 com pesos 2 a 9 da chave de acesso
  let sum = 0;
  let weight = 2;
  for (let i = 42; i >= 0; i--) {
    sum += parseInt(clean.charAt(i), 10) * weight;
    weight = weight >= 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const dv = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return dv === parseInt(clean.charAt(43), 10);
}

export function parseSpedDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.length !== 8) return null;
  const d = parseInt(dateStr.substring(0, 2), 10);
  const m = parseInt(dateStr.substring(2, 4), 10) - 1;
  const y = parseInt(dateStr.substring(4, 8), 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  const date = new Date(y, m, d);
  if (date.getDate() !== d || date.getMonth() !== m || date.getFullYear() !== y) return null;
  return date;
}

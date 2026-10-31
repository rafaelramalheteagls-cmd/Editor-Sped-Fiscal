/**
 * Motor de Validação Fiscal do SPED (Compatível com PVA da Receita Federal / SEFAZ)
 * Implementa regras oficiais extraídas do descritor do PVA (Ato COTEPE 020 / Estrutura 001 v2)
 * e do Guia Prático da EFD ICMS/IPI.
 */

import { SpedLine, ValidationIssue } from '../types';
import { parseFloatSped, formatFloatSped, formatCurrencyBRL } from './spedParser';
import { validateCnpj, validateCpf, validateChaveNfe, parseSpedDate } from './spedValidationRules';
import { validateInscricaoEstadual } from './inscricaoEstadual';
import { isValidCest } from './cestCatalog';
import { PVA_RULES_CATALOG, getPvaRule } from './pvaRulesCatalog';

export function validateSped(lines: SpedLine[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!lines || lines.length === 0) {
    return [
      {
        id: 'EMPTY_FILE',
        severity: 'ERRO',
        code: 'INT-000',
        record: '0000',
        message: 'O arquivo está vazio ou nenhum registro válido foi encontrado.',
      },
    ];
  }

  // 1. Mapeamento de registros e hierarquia
  const regMap = new Map<string, SpedLine[]>();
  for (const line of lines) {
    const list = regMap.get(line.reg) || [];
    list.push(line);
    regMap.set(line.reg, list);
  }

  // 2. Registros obrigatórios
  const required = ['0000', '0001', '9001', '9990', '9999'];
  for (const reg of required) {
    if (!regMap.has(reg)) {
      issues.push({
        id: `REQ_${reg}`,
        severity: 'ERRO',
        code: 'INT-001',
        record: reg,
        message: `Registro obrigatório ${reg} não encontrado no arquivo.`,
      });
    }
  }

  // 3. Validação do Registro 0000
  const r0000 = regMap.get('0000')?.[0];
  let dtIniDecl: string = '';
  let dtFinDecl: string = '';
  let ufDecl: string = '';

  if (r0000) {
    dtIniDecl = r0000.fields[2] || '';
    dtFinDecl = r0000.fields[3] || '';
    const cnpj = r0000.fields[5];
    const cpf = r0000.fields[6];
    const uf = r0000.fields[7] || '';
    ufDecl = uf;
    const ie = r0000.fields[8];

    if (!cnpj && !cpf) {
      issues.push({
        id: '0000_DOC_MISSING',
        severity: 'ERRO',
        code: 'REG-0000-01',
        record: '0000',
        line: r0000.lineNumber,
        field: 'CNPJ/CPF',
        message: 'CNPJ ou CPF do declarante deve ser informado no registro 0000.',
      });
    } else if (cnpj && !validateCnpj(cnpj)) {
      issues.push({
        id: '0000_CNPJ_INVALID',
        severity: 'ERRO',
        code: 'REG-0000-02',
        record: '0000',
        line: r0000.lineNumber,
        field: 'CNPJ',
        message: `CNPJ inválido no registro 0000: ${cnpj}.`,
      });
    } else if (cpf && !validateCpf(cpf)) {
      issues.push({
        id: '0000_CPF_INVALID',
        severity: 'ERRO',
        code: 'REG-0000-03',
        record: '0000',
        line: r0000.lineNumber,
        field: 'CPF',
        message: `CPF inválido no registro 0000: ${cpf}.`,
      });
    }

    if (ie) {
      const ieResult = validateInscricaoEstadual(ie, uf);
      if (!ieResult.valid) {
        issues.push({
          id: '0000_IE_INVALID',
          severity: 'ADVERTENCIA',
          code: 'REG-0000-04',
          record: '0000',
          line: r0000.lineNumber,
          field: 'IE',
          message: ieResult.message || `Inscrição Estadual inválida para a UF ${uf}: ${ie}.`,
        });
      }
    }

    const dIni = parseSpedDate(dtIniDecl);
    const dFin = parseSpedDate(dtFinDecl);
    if (!dIni || !dFin) {
      issues.push({
        id: '0000_DATE_FORMAT',
        severity: 'ERRO',
        code: 'REG-0000-05',
        record: '0000',
        line: r0000.lineNumber,
        field: 'DT_INI/DT_FIN',
        message: 'Data de início ou fim do período em formato inválido (esperado DDMMAAAA).',
      });
    } else if (dIni > dFin) {
      issues.push({
        id: '0000_DATE_ORDER',
        severity: 'ERRO',
        code: 'REG-0000-06',
        record: '0000',
        line: r0000.lineNumber,
        field: 'DT_FIN',
        message: 'Data inicial não pode ser superior à data final de apuração.',
      });
    }
  }

  // 4. Validação do Cadastro de Participantes (0150)
  const r0150List = regMap.get('0150') || [];
  const participantMap = new Map<string, { cnpj?: string; cpf?: string; nome?: string; codMun?: string }>();

  for (const r0150 of r0150List) {
    const codPart = (r0150.fields[0] || '').trim();
    const nome = r0150.fields[1] || '';
    const codPais = (r0150.fields[2] || '').trim();
    const cnpj = (r0150.fields[3] || '').trim();
    const cpf = (r0150.fields[4] || '').trim();
    const codMun = (r0150.fields[6] || '').trim();

    if (codPart) {
      participantMap.set(codPart, { cnpj, cpf, nome, codMun });
    }

    if (!codPart) {
      issues.push({
        id: `0150_EMPTY_${r0150.lineNumber}`,
        severity: 'ERRO',
        code: 'REG-0150-01',
        record: '0150',
        line: r0150.lineNumber,
        field: 'COD_PART',
        message: 'Código de participante COD_PART é de preenchimento obrigatório.',
      });
    }
    if (cnpj && !validateCnpj(cnpj)) {
      issues.push({
        id: `0150_CNPJ_${r0150.lineNumber}`,
        severity: 'ERRO',
        code: 'REG-0150-02',
        record: '0150',
        line: r0150.lineNumber,
        field: 'CNPJ',
        message: `CNPJ inválido no participante [${codPart}]: ${cnpj}.`,
      });
    }
    if (cpf && !validateCpf(cpf)) {
      issues.push({
        id: `0150_CPF_${r0150.lineNumber}`,
        severity: 'ERRO',
        code: 'REG-0150-03',
        record: '0150',
        line: r0150.lineNumber,
        field: 'CPF',
        message: `CPF inválido no participante [${codPart}]: ${cpf}.`,
      });
    }

    // Regra Oficial PVA: Campo obrigatório para contribuintes domiciliados no Brasil
    const isBrasil = !codPais || codPais === '' || codPais === '1058';
    if (isBrasil && (!codMun || codMun.length !== 7)) {
      issues.push({
        id: `0150_MUN_${r0150.lineNumber}`,
        severity: 'ERRO',
        code: 'REG-0150-MUN',
        pvaRuleId: 'REGRA_0150_COD_MUN_BRASIL',
        pvaGuidance: 'Campo obrigatório para contribuintes domiciliados no Brasil.',
        record: '0150',
        line: r0150.lineNumber,
        field: 'COD_MUN',
        message: `Campo 08 (COD_MUN) obrigatório para contribuintes domiciliados no Brasil no participante [${codPart} - ${nome}].`,
        canFix: true,
        fixAction: 'fix_missing_0150_municipios',
      });
    }
  }

  // 5. Validação de Itens (0200) e checagem de tipos
  const r0200List = regMap.get('0200') || [];
  const registeredItemCodes = new Set<string>();
  const itemTypeMap = new Map<string, string>(); // codItem -> tipoItem
  const usedItemCodes = new Set<string>();
  const whitespaceItemLines: number[] = [];
  const VALID_TIPOS_ITEM = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '99'];

  for (const r0200 of r0200List) {
    const codItem = (r0200.fields[0] || '').trim();
    const descrItem = r0200.fields[1] || '';
    const tipoItem = (r0200.fields[5] || '').trim();
    const cest = r0200.fields[11];

    if (codItem) {
      registeredItemCodes.add(codItem);
      itemTypeMap.set(codItem, tipoItem);
    }

    // Regra Oficial PVA: Campo obrigatório (TIPO_ITEM)
    if (!tipoItem || !VALID_TIPOS_ITEM.includes(tipoItem)) {
      issues.push({
        id: `0200_TIPO_ITEM_${r0200.lineNumber}`,
        severity: 'ERRO',
        code: 'REG-0200-TIPO',
        pvaRuleId: 'REGRA_0200_TIPO_ITEM_OBRIGATORIO',
        pvaGuidance: 'Campo obrigatório.',
        record: '0200',
        line: r0200.lineNumber,
        field: 'TIPO_ITEM',
        message: `Campo 07 (TIPO_ITEM) obrigatório não informado no item [${codItem} - ${descrItem}].`,
        canFix: true,
        fixAction: 'fix_missing_tipo_item_0200',
      });
    }

    if (descrItem.startsWith(' ') || descrItem.endsWith(' ') || descrItem.includes('  ')) {
      whitespaceItemLines.push(r0200.lineNumber);
    }

    if (cest && !isValidCest(cest)) {
      issues.push({
        id: `0200_CEST_${r0200.lineNumber}`,
        severity: 'ADVERTENCIA',
        code: 'REG-0200-02',
        record: '0200',
        line: r0200.lineNumber,
        field: 'CEST',
        message: `CEST inválido no item [${codItem}]: deve ter exatamente 7 dígitos numéricos (encontrado: ${cest}).`,
      });
    }
  }

  if (whitespaceItemLines.length > 0) {
    issues.push({
      id: '0200_WHITESPACE',
      severity: 'ADVERTENCIA',
      code: 'REG-0200-WS',
      record: '0200',
      line: whitespaceItemLines[0],
      field: 'DESCR_ITEM',
      message: `${whitespaceItemLines.length} item(ns) no registro 0200 contêm espaços no início, fim ou espaços duplos.`,
      canFix: true,
      fixAction: 'fix_whitespace_0200',
      relatedLines: whitespaceItemLines,
    });
  }

  // Coleta de itens usados
  for (const line of lines) {
    if (line.reg === 'C170' && line.fields[1]) {
      usedItemCodes.add(line.fields[1].trim());
    } else if (line.reg === 'H010' && line.fields[0]) {
      usedItemCodes.add(line.fields[0].trim());
    } else if (line.reg === 'K200' && line.fields[1]) {
      usedItemCodes.add(line.fields[1].trim());
    } else if (line.reg === 'K230' && line.fields[3]) {
      usedItemCodes.add(line.fields[3].trim());
    } else if (line.reg === 'K235' && line.fields[1]) {
      usedItemCodes.add(line.fields[1].trim());
    }
  }

  const unusedItemsCount = Array.from(registeredItemCodes).filter(code => !usedItemCodes.has(code)).length;
  if (unusedItemsCount > 0) {
    issues.push({
      id: '0200_UNUSED_ITEMS',
      severity: 'INFO',
      code: 'REG-0200-UNUSED',
      record: '0200',
      message: `${unusedItemsCount} produto(s) cadastrado(s) no registro 0200 não possuem movimentação em C170, H010 ou Bloco K.`,
      canFix: true,
      fixAction: 'clean_0200',
    });
  }

  // Coleta e validação de participantes usados (0150)
  const usedParticipants = new Set<string>();
  for (const line of lines) {
    if (line.reg === '0150') continue;
    if (line.reg === 'C100' && line.fields[2]) usedParticipants.add(line.fields[2].trim());
    if (line.reg === 'D100' && line.fields[2]) usedParticipants.add(line.fields[2].trim());
    if (line.reg === 'C113' && line.fields[2]) usedParticipants.add(line.fields[2].trim());
    if (line.reg === 'C140' && line.fields[0]) usedParticipants.add(line.fields[0].trim());
    if (line.reg === 'C160' && line.fields[0]) usedParticipants.add(line.fields[0].trim());
    if (line.reg === 'C165' && line.fields[0]) usedParticipants.add(line.fields[0].trim());
    if (line.reg === 'H010' && line.fields[6]) usedParticipants.add(line.fields[6].trim());
    if (line.reg === 'K200' && line.fields[4]) usedParticipants.add(line.fields[4].trim());
  }

  for (const r0150 of r0150List) {
    const codPart = (r0150.fields[0] || '').trim();
    const nome = r0150.fields[1] || '';
    if (codPart && !usedParticipants.has(codPart)) {
      issues.push({
        id: `0150_UNUSED_${r0150.lineNumber}`,
        severity: 'ERRO',
        code: 'REG-0150-SEM-MOV',
        pvaRuleId: 'REGRA_0150_SEM_MOVIMENTO',
        pvaGuidance: 'Não informar participante, se não referenciado em pelo menos um dos demais blocos.',
        record: '0150',
        line: r0150.lineNumber,
        field: '2 - COD_PART',
        message: `Não informar participante, se não referenciado em pelo menos um dos demais blocos: [${codPart} - ${nome}].`,
        canFix: true,
        fixAction: 'clean_unused_0150',
      });
    }
  }

  // ========================================================================
  // 6. VALIDAÇÃO OFICIAL PVA - BLOCO C (DOCUMENTOS FISCAIS DE MERCADORIAS)
  // ========================================================================
  let currentC100Line: SpedLine | null = null;
  let currentC170s: SpedLine[] = [];
  let currentC190s: SpedLine[] = [];

  const validateInvoiceWithPvaRules = (c100: SpedLine, c170List: SpedLine[], c190List: SpedLine[]) => {
    const docNum = c100.fields[6] || `Linha ${c100.lineNumber}`;
    const indOper = c100.fields[0] || '';
    const codMod = c100.fields[3] || '';
    const codSit = c100.fields[4] || '';
    const chvNfe = c100.fields[7] || '';
    const vlDoc = parseFloatSped(c100.fields[10]);
    const vlDesc = parseFloatSped(c100.fields[12]);
    const vlMerc = parseFloatSped(c100.fields[14]);
    const vlBcIcms = parseFloatSped(c100.fields[19]);
    const vlIcms = parseFloatSped(c100.fields[20]);
    const vlBcIcmsSt = parseFloatSped(c100.fields[21]);
    const vlIcmsSt = parseFloatSped(c100.fields[22]);
    const vlIpi = parseFloatSped(c100.fields[23]);

    // Ignora notas canceladas ou inutilizadas para regras de somatórios
    if (['02', '03', '04', '05'].includes(codSit)) return;

    // Chave de acesso SEFAZ
    if (chvNfe && chvNfe.length === 44) {
      if (!validateChaveNfe(chvNfe)) {
        issues.push({
          id: `C100_CHV_${c100.lineNumber}`,
          severity: 'ERRO',
          code: 'REG-C100-CHV',
          record: 'C100',
          line: c100.lineNumber,
          field: 'CHV_NFE',
          message: `Dígito verificador ou estrutura inválida na chave de acesso da NF-e #${docNum}: ${chvNfe}.`,
          pvaRuleId: 'REGRA_VALIDA_CHV_NFE_CTE',
          pvaGuidance: 'Verifique a chave de acesso informada. O dígito verificador final difere do cálculo módulo 11 oficial da SEFAZ.'
        });
      }
    }

    // REGRA_VL_MERC_C170 (PVA): C100.VL_MERC >= Σ(C170.VL_ITEM)
    if (c170List.length > 0 && !(codMod === '55' && c100.fields[1] === '0')) {
      const sumVlItem = c170List.reduce((acc, l) => acc + parseFloatSped(l.fields[5]), 0);
      if (vlMerc - sumVlItem < -0.05) {
        const rule = getPvaRule('REGRA_VL_MERC_C170');
        issues.push({
          id: `PVA_REGRA_VL_MERC_C170_${c100.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_VL_MERC_C170',
          record: 'C100',
          line: c100.lineNumber,
          field: 'VL_MERC',
          message: `NF #${docNum}: Valor das mercadorias no C100 (${formatCurrencyBRL(vlMerc)}) é menor que a soma dos itens C170 (${formatCurrencyBRL(sumVlItem)}).`,
          pvaRuleId: 'REGRA_VL_MERC_C170',
          pvaGuidance: rule?.guidance,
          difference: { expected: sumVlItem, found: vlMerc, fieldName: 'VL_MERC' }
        });
      }

      // REGRA_VALIDA_DESC_DOC_ITEM (PVA): C100.VL_DESC == Σ(C170.VL_DESC)
      const sumVlDesc = c170List.reduce((acc, l) => acc + parseFloatSped(l.fields[6]), 0);
      if (Math.abs(vlDesc - sumVlDesc) > 0.05) {
        const rule = getPvaRule('REGRA_VALIDA_DESC_DOC_ITEM');
        issues.push({
          id: `PVA_REGRA_VALIDA_DESC_DOC_ITEM_${c100.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_VALIDA_DESC_DOC_ITEM',
          record: 'C100',
          line: c100.lineNumber,
          field: 'VL_DESC',
          message: `NF #${docNum}: Desconto no cabeçalho C100 (${formatCurrencyBRL(vlDesc)}) difere da soma dos descontos dos itens C170 (${formatCurrencyBRL(sumVlDesc)}).`,
          pvaRuleId: 'REGRA_VALIDA_DESC_DOC_ITEM',
          pvaGuidance: rule?.guidance,
          difference: { expected: sumVlDesc, found: vlDesc, fieldName: 'VL_DESC' }
        });
      }

      // Validações por item C170
      for (const c170 of c170List) {
        const cst = (c170.fields[8] || '').trim();
        const cfop = (c170.fields[9] || '').trim();
        const aliqIcms = parseFloatSped(c170.fields[12]);
        const vlIcmsItem = parseFloatSped(c170.fields[13]);
        const itemNum = c170.fields[0];

        // REGRA_CFOP_C100 (PVA): Coerência de CFOP com IND_OPER
        if (cfop.length >= 1) {
          const firstDigit = cfop.charAt(0);
          const isEntrada = indOper === '0';
          const validForEntrada = ['1', '2', '3'].includes(firstDigit);
          const validForSaida = ['5', '6', '7'].includes(firstDigit);

          if ((isEntrada && !validForEntrada) || (!isEntrada && !validForSaida)) {
            const rule = getPvaRule('REGRA_CFOP_C100');
            issues.push({
              id: `PVA_REGRA_CFOP_C100_${c170.lineNumber}`,
              severity: 'ERRO',
              code: 'REGRA_CFOP_C100',
              record: 'C170',
              line: c170.lineNumber,
              field: 'CFOP',
              message: `Item #${itemNum} da NF #${docNum}: CFOP ${cfop} incompatível com operação de ${isEntrada ? 'Entrada (deve iniciar com 1, 2 ou 3)' : 'Saída (deve iniciar com 5, 6 ou 7)'}.`,
              pvaRuleId: 'REGRA_CFOP_C100',
              pvaGuidance: rule?.guidance
            });
          }
        }

        // REGRA_ALIQ_ICMS_C170 (PVA): CST final 00, 10, 20, 70 exige ALIQ_ICMS > 0 nas saídas normais
        if (indOper === '1' && (codSit === '00' || codSit === '01')) {
          const last2Cst = cst.length >= 2 ? cst.substring(cst.length - 2) : '';
          if (['00', '10', '20', '70'].includes(last2Cst) && aliqIcms <= 0) {
            const rule = getPvaRule('REGRA_ALIQ_ICMS_C170');
            issues.push({
              id: `PVA_REGRA_ALIQ_ICMS_C170_${c170.lineNumber}`,
              severity: 'ADVERTENCIA',
              code: 'REGRA_ALIQ_ICMS_C170',
              record: 'C170',
              line: c170.lineNumber,
              field: 'ALIQ_ICMS',
              message: `Item #${itemNum} da NF #${docNum}: CST ${cst} requer alíquota de ICMS maior que zero em operações normais de saída.`,
              pvaRuleId: 'REGRA_ALIQ_ICMS_C170',
              pvaGuidance: rule?.guidance
            });
          }
        }

        // CST 060 sem destaque
        if ((cst === '060' || cst === '60') && vlIcmsItem > 0.01) {
          issues.push({
            id: `C170_CST60_${c170.lineNumber}`,
            severity: 'ERRO',
            code: 'REG-C170-CST60',
            record: 'C170',
            line: c170.lineNumber,
            field: 'VL_ICMS',
            message: `Item #${itemNum} da NF #${docNum} com CST 060 (ST cobrada anteriormente) não pode ter destaque de ICMS.`,
            canFix: true,
            fixAction: 'fix_c100_structure',
          });
        }
      }
    }

    // Validações dos Registros Analíticos C190 vs Cabeçalho C100
    if (c190List.length > 0) {
      // Regra Oficial PVA: Duplicidade de ocorrência da chave CST_ICMS, CFOP, ALIQ_ICMS no C190
      const seenC190Keys = new Map<string, SpedLine>();
      for (const c190 of c190List) {
        const cst = (c190.fields[0] || '').trim();
        const cfop = (c190.fields[1] || '').trim();
        const aliqVal = parseFloatSped(c190.fields[2]);
        const aliq = formatFloatSped(aliqVal);
        const key = `${cst}|${cfop}|${aliq}`;

        if (seenC190Keys.has(key)) {
          const firstOccur = seenC190Keys.get(key)!;
          const rule = getPvaRule('REGRA_C190_DUPLICIDADE_CHAVE');
          issues.push({
            id: `C190_DUP_${c190.lineNumber}`,
            severity: 'ERRO',
            code: 'REGRA_C190_DUPLICIDADE_CHAVE',
            record: 'C190',
            line: c190.lineNumber,
            field: 'CST_ICMS, CFOP, ALIQ_ICMS',
            message: `Duplicidade de ocorrência da chave CST_ICMS (${cst}), CFOP (${cfop}), ALIQ_ICMS (${aliq}) na NF #${docNum}.`,
            pvaRuleId: 'REGRA_C190_DUPLICIDADE_CHAVE',
            pvaGuidance: rule?.guidance || 'No mesmo documento fiscal (C100), não podem existir dois registros C190 com a mesma combinação de CST, CFOP e Alíquota de ICMS.',
            canFix: true,
            fixAction: 'consolidate_c190_duplicates',
            relatedLines: [firstOccur.lineNumber, c190.lineNumber],
          });
        } else {
          seenC190Keys.set(key, c190);
        }
      }

      const sumVlOpr = c190List.reduce((acc, l) => acc + parseFloatSped(l.fields[3]), 0);
      const sumBcIcms = c190List.reduce((acc, l) => acc + parseFloatSped(l.fields[4]), 0);
      const sumVlIcms = c190List.reduce((acc, l) => acc + parseFloatSped(l.fields[5]), 0);
      const sumBcIcmsSt = c190List.reduce((acc, l) => acc + parseFloatSped(l.fields[6]), 0);
      const sumVlIcmsSt = c190List.reduce((acc, l) => acc + parseFloatSped(l.fields[7]), 0);
      const sumVlIpi = c190List.reduce((acc, l) => acc + parseFloatSped(l.fields[9]), 0);

      // Total da operação C190 vs VL_DOC (REGRA_C190_SOMA_VL_OPR)
      if (Math.abs(sumVlOpr - vlDoc) > 0.05) {
        const rule = getPvaRule('REGRA_C190_SOMA_VL_OPR');
        issues.push({
          id: `C100_DIFF_DOC_${c100.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_C190_SOMA_VL_OPR',
          record: 'C190',
          line: c190List[0].lineNumber,
          field: 'VL_OPR',
          message: `Soma de VL_OPR nos registros C190 (${formatCurrencyBRL(sumVlOpr)}) difere de VL_DOC no C100 (${formatCurrencyBRL(vlDoc)}) na NF #${docNum}.`,
          pvaRuleId: 'REGRA_C190_SOMA_VL_OPR',
          pvaGuidance: rule?.guidance,
          canFix: true,
          fixAction: 'fix_c190_vl_opr_balance',
          difference: { expected: vlDoc, found: sumVlOpr, fieldName: 'VL_OPR' },
          relatedLines: [c100.lineNumber, ...c190List.map(l => l.lineNumber)],
        });
      }

      // REGRA_VL_BC_ICMS_ANALIT (PVA): C100.VL_BC_ICMS == Σ(C190.VL_BC_ICMS)
      if (Math.abs(sumBcIcms - vlBcIcms) > 0.05) {
        const rule = getPvaRule('REGRA_VL_BC_ICMS_ANALIT');
        issues.push({
          id: `PVA_REGRA_VL_BC_ICMS_ANALIT_${c100.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_VL_BC_ICMS_ANALIT',
          record: 'C100',
          line: c100.lineNumber,
          field: 'VL_BC_ICMS',
          message: `NF #${docNum}: Base de cálculo do ICMS no C100 (${formatCurrencyBRL(vlBcIcms)}) difere da soma dos C190 (${formatCurrencyBRL(sumBcIcms)}).`,
          pvaRuleId: 'REGRA_VL_BC_ICMS_ANALIT',
          pvaGuidance: rule?.guidance,
          difference: { expected: sumBcIcms, found: vlBcIcms, fieldName: 'VL_BC_ICMS' }
        });
      }

      // REGRA_VL_ICMS_ANALIT (PVA): C100.VL_ICMS == Σ(C190.VL_ICMS)
      if (Math.abs(sumVlIcms - vlIcms) > 0.05) {
        const rule = getPvaRule('REGRA_VL_ICMS_ANALIT');
        issues.push({
          id: `PVA_REGRA_VL_ICMS_ANALIT_${c100.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_VL_ICMS_ANALIT',
          record: 'C100',
          line: c100.lineNumber,
          field: 'VL_ICMS',
          message: `NF #${docNum}: Valor do ICMS no C100 (${formatCurrencyBRL(vlIcms)}) difere da soma dos C190 (${formatCurrencyBRL(sumVlIcms)}).`,
          pvaRuleId: 'REGRA_VL_ICMS_ANALIT',
          pvaGuidance: rule?.guidance,
          difference: { expected: sumVlIcms, found: vlIcms, fieldName: 'VL_ICMS' },
          canFix: true,
          fixAction: 'fix_c100_structure',
        });
      }

      // REGRA_VL_BC_ICMS_ST_ANALIT (PVA)
      if (Math.abs(sumBcIcmsSt - vlBcIcmsSt) > 0.05) {
        const rule = getPvaRule('REGRA_VL_BC_ICMS_ST_ANALIT');
        issues.push({
          id: `PVA_REGRA_VL_BC_ICMS_ST_ANALIT_${c100.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_VL_BC_ICMS_ST_ANALIT',
          record: 'C100',
          line: c100.lineNumber,
          field: 'VL_BC_ICMS_ST',
          message: `NF #${docNum}: Base de cálculo ICMS ST no C100 (${formatCurrencyBRL(vlBcIcmsSt)}) difere da soma dos C190 (${formatCurrencyBRL(sumBcIcmsSt)}).`,
          pvaRuleId: 'REGRA_VL_BC_ICMS_ST_ANALIT',
          pvaGuidance: rule?.guidance,
          difference: { expected: sumBcIcmsSt, found: vlBcIcmsSt, fieldName: 'VL_BC_ICMS_ST' }
        });
      }

      // REGRA_VL_ICMS_ST_ANALIT (PVA)
      if (Math.abs(sumVlIcmsSt - vlIcmsSt) > 0.05) {
        const rule = getPvaRule('REGRA_VL_ICMS_ST_ANALIT');
        issues.push({
          id: `PVA_REGRA_VL_ICMS_ST_ANALIT_${c100.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_VL_ICMS_ST_ANALIT',
          record: 'C100',
          line: c100.lineNumber,
          field: 'VL_ICMS_ST',
          message: `NF #${docNum}: Valor do ICMS ST no C100 (${formatCurrencyBRL(vlIcmsSt)}) difere da soma dos C190 (${formatCurrencyBRL(sumVlIcmsSt)}).`,
          pvaRuleId: 'REGRA_VL_ICMS_ST_ANALIT',
          pvaGuidance: rule?.guidance,
          difference: { expected: sumVlIcmsSt, found: vlIcmsSt, fieldName: 'VL_ICMS_ST' }
        });
      }

      // REGRA_VL_IPI_C190 (PVA)
      if (Math.abs(sumVlIpi - vlIpi) > 0.05) {
        const rule = getPvaRule('REGRA_VL_IPI_C190');
        issues.push({
          id: `PVA_REGRA_VL_IPI_C190_${c100.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_VL_IPI_C190',
          record: 'C100',
          line: c100.lineNumber,
          field: 'VL_IPI',
          message: `NF #${docNum}: Valor do IPI no C100 (${formatCurrencyBRL(vlIpi)}) difere da soma do IPI dos C190 (${formatCurrencyBRL(sumVlIpi)}).`,
          pvaRuleId: 'REGRA_VL_IPI_C190',
          pvaGuidance: rule?.guidance,
          difference: { expected: sumVlIpi, found: vlIpi, fieldName: 'VL_IPI' }
        });
      }

      // REGRA_CFOP_NFCE (PVA): NFC-e (modelo 65) deve ter CFOP iniciando por 5
      if (codMod === '65') {
        for (const c190 of c190List) {
          const cfop = c190.fields[1] || '';
          if (cfop && !cfop.startsWith('5')) {
            const rule = getPvaRule('REGRA_CFOP_NFCE');
            issues.push({
              id: `PVA_REGRA_CFOP_NFCE_${c190.lineNumber}`,
              severity: 'ERRO',
              code: 'REGRA_CFOP_NFCE',
              record: 'C190',
              line: c190.lineNumber,
              field: 'CFOP',
              message: `NFC-e #${docNum}: O CFOP ${cfop} no registro C190 é inválido para NFC-e (deve iniciar com "5").`,
              pvaRuleId: 'REGRA_CFOP_NFCE',
              pvaGuidance: rule?.guidance
            });
          }
        }
      }

      // Regra Oficial PVA: Alíquota de ICMS em documento de entrada (Simples Nacional / CST 102/02)
      for (const c170 of c170List) {
        const cst = (c170.fields[8] || '').trim();
        const aliqIcms = parseFloatSped(c170.fields[12]);
        const numItem = c170.fields[0] || '';

        if (indOper === '0' && (cst.endsWith('02') || cst.endsWith('15')) && aliqIcms <= 0) {
          issues.push({
            id: `C170_ALIQ_SIMPLES_${c170.lineNumber}`,
            severity: 'ADVERTENCIA',
            code: 'REG-C170-ALIQ-SIMPLES',
            pvaRuleId: 'REGRA_ALIQ_ICMS_C170_SIMPLES',
            pvaGuidance:
              'Contribuintes optantes pelo Simples Nacional devem desconsiderar essa advertência. Se o campo IND_OPER do registro C100 for igual a 0(zero) e se os dois últimos caracteres do CST_ICMS forem 02 ou 15, o campo ALIQ_ICMS deve ser maior que 0 (zero).',
            record: 'C170',
            line: c170.lineNumber,
            field: '14 - ALIQ_ICMS',
            message: `Contribuintes optantes pelo Simples Nacional devem desconsiderar essa advertência. Se o campo IND_OPER do registro C100 for igual a 0(zero) e se os dois últimos caracteres do CST_ICMS forem 02 ou 15, o campo ALIQ_ICMS deve ser maior que 0 (zero). Item [${numItem}] com CST ${cst}.`,
            canFix: true,
            fixAction: 'normalize_simples_cst102',
          });
        }
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.reg === 'C100') {
      if (currentC100Line) {
        validateInvoiceWithPvaRules(currentC100Line, currentC170s, currentC190s);
      }
      currentC100Line = line;
      currentC170s = [];
      currentC190s = [];
    } else if (line.reg === 'C170') {
      currentC170s.push(line);
    } else if (line.reg === 'C190') {
      currentC190s.push(line);
    } else if (['C500', 'D100', 'E001', 'C001'].includes(line.reg)) {
      if (currentC100Line) {
        validateInvoiceWithPvaRules(currentC100Line, currentC170s, currentC190s);
        currentC100Line = null;
        currentC170s = [];
        currentC190s = [];
      }
    }
  }

  if (currentC100Line) {
    validateInvoiceWithPvaRules(currentC100Line, currentC170s, currentC190s);
  }

  // ========================================================================
  // 6.5. VALIDAÇÃO OFICIAL PVA - BLOCO D (CONHECIMENTOS DE TRANSPORTE - D100)
  // ========================================================================
  const rD100List = regMap.get('D100') || [];
  for (const rD100 of rD100List) {
    const indOper = (rD100.fields[0] || '').trim();
    const codPart = (rD100.fields[2] || '').trim();
    const codMod = (rD100.fields[3] || '').trim();
    const numDoc = rD100.fields[7] || '';
    const chvCte = (rD100.fields[8] || '').trim();
    const codMunOrig = (rD100.fields[22] || '').trim();
    const codMunDest = (rD100.fields[23] || '').trim();

    // Regra Oficial PVA: Para documentos de entrada (IND_OPER=0), o preenchimento do campo é obrigatório se "COD_MOD" for igual a "57", "63" ou "67".
    if (indOper === '0' && ['57', '63', '67'].includes(codMod)) {
      if (!codMunOrig || codMunOrig.length !== 7) {
        issues.push({
          id: `D100_MUN_ORIG_${rD100.lineNumber}`,
          severity: 'ERRO',
          code: 'REG-D100-MUN-ORIG',
          pvaRuleId: 'REGRA_D100_MUNICIPIOS_OBRIGATORIOS',
          pvaGuidance: 'Para documentos de entrada (IND_OPER=0), o preenchimento do campo é obrigatório se "COD_MOD" for igual a "57", "63" ou "67".',
          record: 'D100',
          line: rD100.lineNumber,
          field: '24 - COD_MUN_ORIG',
          message: `Campo 24 (COD_MUN_ORIG) obrigatório não informado no CT-e [${numDoc}].`,
          canFix: true,
          fixAction: 'fix_missing_d100_municipios',
        });
      }

      if (!codMunDest || codMunDest.length !== 7) {
        issues.push({
          id: `D100_MUN_DEST_${rD100.lineNumber}`,
          severity: 'ERRO',
          code: 'REG-D100-MUN-DEST',
          pvaRuleId: 'REGRA_D100_MUNICIPIOS_OBRIGATORIOS',
          pvaGuidance: 'Para documentos de entrada (IND_OPER=0), o preenchimento do campo é obrigatório se "COD_MOD" for igual a "57", "63" ou "67".',
          record: 'D100',
          line: rD100.lineNumber,
          field: '25 - COD_MUN_DEST',
          message: `Campo 25 (COD_MUN_DEST) obrigatório não informado no CT-e [${numDoc}].`,
          canFix: true,
          fixAction: 'fix_missing_d100_municipios',
        });
      }
    }

    // Regra Oficial PVA: O CNPJ/CPF da chave do documento eletrônico não confere com o CNPJ/CPF do participante informado.
    if (chvCte.length === 44) {
      const cnpjChave = chvCte.substring(6, 20);
      const partInfo = participantMap.get(codPart);
      const cnpjPart = partInfo?.cnpj || '';

      if (cnpjPart && cnpjChave !== cnpjPart) {
        issues.push({
          id: `D100_CHV_PART_${rD100.lineNumber}`,
          severity: 'ERRO',
          code: 'REG-D100-CHV-PART',
          pvaRuleId: 'REGRA_D100_CNPJ_CHAVE_PARTICIPANTE',
          pvaGuidance: 'O CNPJ/CPF da chave do documento eletrônico não confere com o CNPJ/CPF do participante informado.',
          record: 'D100',
          line: rD100.lineNumber,
          field: '10 - CHV_CTE',
          message: `O CNPJ da chave (${cnpjChave}) não confere com o participante [${codPart} - ${partInfo?.nome || ''}] informado no CT-e [${numDoc}].`,
          canFix: true,
          fixAction: 'fix_d100_participant_mismatch',
        });
      }
    }
  }

  // Validação de duplicidade de registros analíticos D190 por D100
  let currentD100Line: SpedLine | null = null;
  let currentD190s: SpedLine[] = [];

  const validateTransportWithPvaRules = (d100: SpedLine, d190List: SpedLine[]) => {
    const numDoc = d100.fields[7] || '';
    const seenD190Keys = new Map<string, SpedLine>();
    for (const d190 of d190List) {
      const cst = (d190.fields[0] || '').trim();
      const cfop = (d190.fields[1] || '').trim();
      const aliqVal = parseFloatSped(d190.fields[2]);
      const aliq = formatFloatSped(aliqVal);
      const key = `${cst}|${cfop}|${aliq}`;

      if (seenD190Keys.has(key)) {
        const firstOccur = seenD190Keys.get(key)!;
        const rule = getPvaRule('REGRA_D190_DUPLICIDADE_CHAVE');
        issues.push({
          id: `D190_DUP_${d190.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_D190_DUPLICIDADE_CHAVE',
          record: 'D190',
          line: d190.lineNumber,
          field: 'CST_ICMS, CFOP, ALIQ_ICMS',
          message: `Duplicidade de ocorrência da chave CST_ICMS (${cst}), CFOP (${cfop}), ALIQ_ICMS (${aliq}) no CT-e #${numDoc}.`,
          pvaRuleId: 'REGRA_D190_DUPLICIDADE_CHAVE',
          pvaGuidance: rule?.guidance || 'No mesmo documento de transporte (D100), não podem existir dois registros D190 com a mesma combinação de CST, CFOP e Alíquota.',
          canFix: true,
          fixAction: 'consolidate_d190_duplicates',
          relatedLines: [firstOccur.lineNumber, d190.lineNumber],
        });
      } else {
        seenD190Keys.set(key, d190);
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.reg === 'D100') {
      if (currentD100Line) {
        validateTransportWithPvaRules(currentD100Line, currentD190s);
      }
      currentD100Line = line;
      currentD190s = [];
    } else if (line.reg === 'D190') {
      currentD190s.push(line);
    } else if (['E001', 'D990', '1001', 'C001'].includes(line.reg)) {
      if (currentD100Line) {
        validateTransportWithPvaRules(currentD100Line, currentD190s);
        currentD100Line = null;
        currentD190s = [];
      }
    }
  }
  if (currentD100Line) {
    validateTransportWithPvaRules(currentD100Line, currentD190s);
  }

  // ========================================================================
  // 7. VALIDAÇÃO OFICIAL PVA - BLOCO E (APURAÇÃO DO ICMS OPERAÇÕES PRÓPRIAS)
  // ========================================================================
  const rE100List = regMap.get('E100') || [];
  const rE110List = regMap.get('E110') || [];
  const rE111List = regMap.get('E111') || [];
  const rE116List = regMap.get('E116') || [];
  const rE113List = regMap.get('E113') || [];

  // Somatório global dos registros analíticos do período para confronto com o E110
  // Conforme query oficial:
  // Débitos: C190, C320, C390, C490, C590, C690, C790, C890, D190, D300, D390, D410, D590, D690, D696, D730, D760
  // CFOPs: 5.xxx (exceto 5605), 6.xxx, 7.xxx, 1605
  // Créditos: C190, C590, D190, D590, D730
  // CFOPs: 1.xxx (exceto 1605), 2.xxx, 3.xxx, 5605
  let calculatedDebitosIcms = 0;
  let calculatedCreditosIcms = 0;

  for (const line of lines) {
    let cfop = '';
    let vlIcms = 0;

    if (line.reg === 'C190') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'C320') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'C390') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'C490') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'C590') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'C690') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'C790') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'C850' || line.reg === 'C890') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'D190') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'D300') {
      cfop = line.fields[6] || '';
      vlIcms = parseFloatSped(line.fields[15]);
    } else if (line.reg === 'D390') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[8]);
    } else if (line.reg === 'D410') {
      cfop = line.fields[7] || '';
      vlIcms = parseFloatSped(line.fields[13]);
    } else if (line.reg === 'D590') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'D690') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'D696') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    } else if (line.reg === 'D730' || line.reg === 'D760') {
      cfop = line.fields[1] || '';
      vlIcms = parseFloatSped(line.fields[5]);
    }

    if (!cfop || vlIcms <= 0) continue;

    const first = cfop.charAt(0);
    // Débitos
    if (cfop === '1605' || (first === '5' && cfop !== '5605') || first === '6' || first === '7') {
      calculatedDebitosIcms += vlIcms;
    }
    // Créditos
    if (cfop === '5605' || (first === '1' && cfop !== '1605') || first === '2' || first === '3') {
      calculatedCreditosIcms += vlIcms;
    }
  }

  // Validação dos registros E110
  for (const rE110 of rE110List) {
    const vlTotDebitos = parseFloatSped(rE110.fields[0]);
    const vlAjDebitos = parseFloatSped(rE110.fields[1]);
    const vlTotAjDebitos = parseFloatSped(rE110.fields[2]);
    const vlEstornosCred = parseFloatSped(rE110.fields[3]);
    const vlTotCreditos = parseFloatSped(rE110.fields[4]);
    const vlAjCreditos = parseFloatSped(rE110.fields[5]);
    const vlTotAjCreditos = parseFloatSped(rE110.fields[6]);
    const vlEstornosDeb = parseFloatSped(rE110.fields[7]);
    const vlSldCredorAnt = parseFloatSped(rE110.fields[8]);
    const vlSldApurado = parseFloatSped(rE110.fields[9]);
    const vlTotDed = parseFloatSped(rE110.fields[10]);
    const vlIcmsRecolher = parseFloatSped(rE110.fields[11]);
    const vlSldCredorTransportar = parseFloatSped(rE110.fields[12]);
    const debEsp = parseFloatSped(rE110.fields[13]);

    // 7.1 REGRA_VL_TOT_DEBITOS_E110_17002_V1
    if (Math.abs(vlTotDebitos - calculatedDebitosIcms) > 0.05) {
      const rule = getPvaRule('REGRA_VL_TOT_DEBITOS_E110_17002_V1');
      issues.push({
        id: `PVA_REGRA_VL_TOT_DEBITOS_E110_${rE110.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_VL_TOT_DEBITOS_E110_17002_V1',
        record: 'E110',
        line: rE110.lineNumber,
        field: 'VL_TOT_DEBITOS',
        message: `Registro E110: Total de débitos (${formatCurrencyBRL(vlTotDebitos)}) difere do somatório dos documentos analíticos de saída (${formatCurrencyBRL(calculatedDebitosIcms)}).`,
        pvaRuleId: 'REGRA_VL_TOT_DEBITOS_E110_17002_V1',
        pvaGuidance: rule?.guidance,
        difference: { expected: calculatedDebitosIcms, found: vlTotDebitos, fieldName: 'VL_TOT_DEBITOS' }
      });
    }

    // 7.2 REGRA_VL_TOT_CREDITOS_E110_17002_V1
    if (Math.abs(vlTotCreditos - calculatedCreditosIcms) > 0.05) {
      const rule = getPvaRule('REGRA_VL_TOT_CREDITOS_E110_17002_V1');
      issues.push({
        id: `PVA_REGRA_VL_TOT_CREDITOS_E110_${rE110.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_VL_TOT_CREDITOS_E110_17002_V1',
        record: 'E110',
        line: rE110.lineNumber,
        field: 'VL_TOT_CREDITOS',
        message: `Registro E110: Total de créditos (${formatCurrencyBRL(vlTotCreditos)}) difere do somatório dos documentos analíticos de entrada (${formatCurrencyBRL(calculatedCreditosIcms)}).`,
        pvaRuleId: 'REGRA_VL_TOT_CREDITOS_E110_17002_V1',
        pvaGuidance: rule?.guidance,
        difference: { expected: calculatedCreditosIcms, found: vlTotCreditos, fieldName: 'VL_TOT_CREDITOS' }
      });
    }

    // 7.3 REGRA_SLD_DEVEDOR_E110 & REGRA_SLD_CREDOR_E110
    const totalDebitos = vlTotDebitos + vlAjDebitos + vlTotAjDebitos + vlEstornosCred;
    const totalCreditos = vlTotCreditos + vlAjCreditos + vlTotAjCreditos + vlEstornosDeb + vlSldCredorAnt;
    const expectedSaldoDevedor = totalDebitos > totalCreditos ? totalDebitos - totalCreditos : 0;
    const expectedSaldoCredor = totalCreditos > totalDebitos ? totalCreditos - totalDebitos : 0;

    if (Math.abs(vlSldApurado - expectedSaldoDevedor) > 0.05) {
      const rule = getPvaRule('REGRA_SLD_DEVEDOR_E110');
      issues.push({
        id: `PVA_REGRA_SLD_DEVEDOR_E110_${rE110.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_SLD_DEVEDOR_E110',
        record: 'E110',
        line: rE110.lineNumber,
        field: 'VL_SLD_APURADO',
        message: `Registro E110: Saldo devedor apurado incorretamente (${formatCurrencyBRL(vlSldApurado)} vs esperado ${formatCurrencyBRL(expectedSaldoDevedor)}).`,
        pvaRuleId: 'REGRA_SLD_DEVEDOR_E110',
        pvaGuidance: rule?.guidance,
        difference: { expected: expectedSaldoDevedor, found: vlSldApurado, fieldName: 'VL_SLD_APURADO' }
      });
    }

    if (Math.abs(vlSldCredorTransportar - expectedSaldoCredor) > 0.05) {
      const rule = getPvaRule('REGRA_SLD_CREDOR_E110');
      issues.push({
        id: `PVA_REGRA_SLD_CREDOR_E110_${rE110.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_SLD_CREDOR_E110',
        record: 'E110',
        line: rE110.lineNumber,
        field: 'VL_SLD_CREDOR_TRANSPORTAR',
        message: `Registro E110: Saldo credor a transportar apurado incorretamente (${formatCurrencyBRL(vlSldCredorTransportar)} vs esperado ${formatCurrencyBRL(expectedSaldoCredor)}).`,
        pvaRuleId: 'REGRA_SLD_CREDOR_E110',
        pvaGuidance: rule?.guidance,
        difference: { expected: expectedSaldoCredor, found: vlSldCredorTransportar, fieldName: 'VL_SLD_CREDOR_TRANSPORTAR' }
      });
    }

    // 7.4 REGRA_ICMS_RECOLHER
    const expectedRecolher = Math.max(0, vlSldApurado - vlTotDed);
    if (Math.abs(vlIcmsRecolher - expectedRecolher) > 0.05) {
      const rule = getPvaRule('REGRA_ICMS_RECOLHER');
      issues.push({
        id: `PVA_REGRA_ICMS_RECOLHER_${rE110.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_ICMS_RECOLHER',
        record: 'E110',
        line: rE110.lineNumber,
        field: 'VL_ICMS_RECOLHER',
        message: `Registro E110: ICMS a recolher (${formatCurrencyBRL(vlIcmsRecolher)}) não confere com Saldo Apurado menos Deduções (${formatCurrencyBRL(expectedRecolher)}).`,
        pvaRuleId: 'REGRA_ICMS_RECOLHER',
        pvaGuidance: rule?.guidance,
        difference: { expected: expectedRecolher, found: vlIcmsRecolher, fieldName: 'VL_ICMS_RECOLHER' }
      });
    }

    // 7.5 REGRA_VALIDA_VL_TOT_DED_E110
    if (vlTotDed > vlSldApurado + 0.01) {
      const rule = getPvaRule('REGRA_VALIDA_VL_TOT_DED_E110');
      issues.push({
        id: `PVA_REGRA_VALIDA_VL_TOT_DED_E110_${rE110.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_VALIDA_VL_TOT_DED_E110',
        record: 'E110',
        line: rE110.lineNumber,
        field: 'VL_TOT_DED',
        message: `Registro E110: O valor total de deduções (${formatCurrencyBRL(vlTotDed)}) não pode ser superior ao saldo devedor apurado (${formatCurrencyBRL(vlSldApurado)}).`,
        pvaRuleId: 'REGRA_VALIDA_VL_TOT_DED_E110',
        pvaGuidance: rule?.guidance
      });
    }

    // 7.6 Confronto E110 com E111
    let sumE111OutrosDeb = 0;
    let sumE111EstornoCred = 0;
    let sumE111OutrosCred = 0;
    let sumE111EstornoDeb = 0;

    for (const rE111 of rE111List) {
      const codAj = (rE111.fields[0] || '').trim();
      const vlAj = parseFloatSped(rE111.fields[2]);
      if (codAj.length >= 4) {
        const d3 = codAj.charAt(2);
        const d4 = codAj.charAt(3);
        if (d3 === '0') {
          if (d4 === '0') sumE111OutrosDeb += vlAj;
          else if (d4 === '1') sumE111EstornoCred += vlAj;
          else if (d4 === '2') sumE111OutrosCred += vlAj;
          else if (d4 === '3') sumE111EstornoDeb += vlAj;
        }
      }
    }

    if (Math.abs(vlTotAjDebitos - sumE111OutrosDeb) > 0.05) {
      const rule = getPvaRule('REGRA_VL_TOT_AJ_DEBITOS_E110');
      issues.push({
        id: `PVA_REGRA_VL_TOT_AJ_DEBITOS_E110_${rE110.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_VL_TOT_AJ_DEBITOS_E110',
        record: 'E110',
        line: rE110.lineNumber,
        field: 'VL_TOT_AJ_DEBITOS',
        message: `Registro E110: Campo VL_TOT_AJ_DEBITOS (${formatCurrencyBRL(vlTotAjDebitos)}) difere da soma dos outros débitos do E111 (${formatCurrencyBRL(sumE111OutrosDeb)}).`,
        pvaRuleId: 'REGRA_VL_TOT_AJ_DEBITOS_E110',
        pvaGuidance: rule?.guidance
      });
    }

    if (Math.abs(vlEstornosCred - sumE111EstornoCred) > 0.05) {
      const rule = getPvaRule('REGRA_VL_ESTORNOS_CRED_E110');
      issues.push({
        id: `PVA_REGRA_VL_ESTORNOS_CRED_E110_${rE110.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_VL_ESTORNOS_CRED_E110',
        record: 'E110',
        line: rE110.lineNumber,
        field: 'VL_ESTORNOS_CRED',
        message: `Registro E110: Campo VL_ESTORNOS_CRED (${formatCurrencyBRL(vlEstornosCred)}) difere da soma dos estornos de crédito do E111 (${formatCurrencyBRL(sumE111EstornoCred)}).`,
        pvaRuleId: 'REGRA_VL_ESTORNOS_CRED_E110',
        pvaGuidance: rule?.guidance
      });
    }

    if (Math.abs(vlTotAjCreditos - sumE111OutrosCred) > 0.05) {
      const rule = getPvaRule('REGRA_VL_TOT_AJ_CREDITOS_E110');
      issues.push({
        id: `PVA_REGRA_VL_TOT_AJ_CREDITOS_E110_${rE110.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_VL_TOT_AJ_CREDITOS_E110',
        record: 'E110',
        line: rE110.lineNumber,
        field: 'VL_TOT_AJ_CREDITOS',
        message: `Registro E110: Campo VL_TOT_AJ_CREDITOS (${formatCurrencyBRL(vlTotAjCreditos)}) difere da soma dos outros créditos do E111 (${formatCurrencyBRL(sumE111OutrosCred)}).`,
        pvaRuleId: 'REGRA_VL_TOT_AJ_CREDITOS_E110',
        pvaGuidance: rule?.guidance
      });
    }

    if (Math.abs(vlEstornosDeb - sumE111EstornoDeb) > 0.05) {
      const rule = getPvaRule('REGRA_VL_ESTORNOS_DEB_E110');
      issues.push({
        id: `PVA_REGRA_VL_ESTORNOS_DEB_E110_${rE110.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_VL_ESTORNOS_DEB_E110',
        record: 'E110',
        line: rE110.lineNumber,
        field: 'VL_ESTORNOS_DEB',
        message: `Registro E110: Campo VL_ESTORNOS_DEB (${formatCurrencyBRL(vlEstornosDeb)}) difere da soma dos estornos de débito do E111 (${formatCurrencyBRL(sumE111EstornoDeb)}).`,
        pvaRuleId: 'REGRA_VL_ESTORNOS_DEB_E110',
        pvaGuidance: rule?.guidance
      });
    }

    // 7.7 REGRA_ICMS_REC_E116: Soma(E116.VL_OR) == E110.VL_ICMS_RECOLHER + E110.DEB_ESP
    if (rE116List.length > 0 || (vlIcmsRecolher + debEsp) > 0.01) {
      const sumE116VlOr = rE116List.reduce((acc, l) => acc + parseFloatSped(l.fields[1]), 0);
      const expectedGuias = vlIcmsRecolher + debEsp;
      if (Math.abs(sumE116VlOr - expectedGuias) > 0.05) {
        const rule = getPvaRule('REGRA_ICMS_REC_E116');
        issues.push({
          id: `PVA_REGRA_ICMS_REC_E116_${rE110.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_ICMS_REC_E116',
          record: 'E116',
          line: rE116List[0]?.lineNumber || rE110.lineNumber,
          field: 'VL_OR',
          message: `Soma das obrigações a recolher em E116 (${formatCurrencyBRL(sumE116VlOr)}) difere de ICMS a recolher + débitos especiais no E110 (${formatCurrencyBRL(expectedGuias)}).`,
          pvaRuleId: 'REGRA_ICMS_REC_E116',
          pvaGuidance: rule?.guidance,
          difference: { expected: expectedGuias, found: sumE116VlOr, fieldName: 'VL_OR' }
        });
      }
    }
  }

  // 7.8 REGRA_TOT_VL_AJ_ITEM_E113 (E111 vs E113)
  if (rE113List.length > 0) {
    // Agrupa E113 por parentId
    const e113ByParent = new Map<number, SpedLine[]>();
    for (const line of rE113List) {
      if (line.parentId) {
        const list = e113ByParent.get(line.parentId) || [];
        list.push(line);
        e113ByParent.set(line.parentId, list);
      }
    }

    for (const rE111 of rE111List) {
      const children = e113ByParent.get(rE111.id);
      if (children && children.length > 0) {
        const vlAjApur = parseFloatSped(rE111.fields[2]);
        const sumE113 = children.reduce((acc, l) => acc + parseFloatSped(l.fields[7]), 0);
        if (Math.abs(vlAjApur - sumE113) > 0.05) {
          const rule = getPvaRule('REGRA_TOT_VL_AJ_ITEM_E113');
          issues.push({
            id: `PVA_REGRA_TOT_VL_AJ_ITEM_E113_${rE111.lineNumber}`,
            severity: 'ERRO',
            code: 'REGRA_TOT_VL_AJ_ITEM_E113',
            record: 'E111',
            line: rE111.lineNumber,
            field: 'VL_AJ_APUR',
            message: `Registro E111: Valor do ajuste (${formatCurrencyBRL(vlAjApur)}) difere da soma dos detalhamentos em E113 (${formatCurrencyBRL(sumE113)}).`,
            pvaRuleId: 'REGRA_TOT_VL_AJ_ITEM_E113',
            pvaGuidance: rule?.guidance,
            difference: { expected: sumE113, found: vlAjApur, fieldName: 'VL_AJ_APUR' }
          });
        }
      }
    }
  }

  // ========================================================================
  // 8. VALIDAÇÃO OFICIAL PVA - BLOCO K (CONTROLE DA PRODUÇÃO E DO ESTOQUE)
  // ========================================================================
  const rK010 = regMap.get('K010')?.[0];
  const indTpLeiaute = rK010 ? (rK010.fields[0] || '').trim() : '0'; // '0': simplificado, '1': completo
  const rK100List = regMap.get('K100') || [];
  const rK200List = regMap.get('K200') || [];

  // Mapear K100 por períodos
  let activeK100DtFin = '';
  let activeK100DtIni = '';
  if (rK100List.length > 0) {
    activeK100DtIni = rK100List[0].fields[0] || dtIniDecl;
    activeK100DtFin = rK100List[0].fields[1] || dtFinDecl;
  } else {
    activeK100DtIni = dtIniDecl;
    activeK100DtFin = dtFinDecl;
  }

  // 8.1 REGRA_DATA_FINAL_ESTOQUE (K200.DT_EST == K100.DT_FIN)
  for (const rK200 of rK200List) {
    const dtEst = (rK200.fields[0] || '').trim();
    const codItem = (rK200.fields[1] || '').trim();
    const indEst = (rK200.fields[3] || '').trim();
    const codPart = (rK200.fields[4] || '').trim();

    if (activeK100DtFin && dtEst && dtEst !== activeK100DtFin) {
      const rule = getPvaRule('REGRA_DATA_FINAL_ESTOQUE');
      issues.push({
        id: `PVA_REGRA_DATA_FINAL_ESTOQUE_${rK200.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_DATA_FINAL_ESTOQUE',
        record: 'K200',
        line: rK200.lineNumber,
        field: 'DT_EST',
        message: `Estoque K200 [${codItem}]: Data do estoque (${dtEst}) difere da data final do período de apuração K100 (${activeK100DtFin}).`,
        pvaRuleId: 'REGRA_DATA_FINAL_ESTOQUE',
        pvaGuidance: rule?.guidance,
      });
    }

    // 8.2 REGRA_OBRIGATORIO_COD_PART_ESTOQUE e REGRA_NAO_INFORMAR_COD_PART_K200
    if ((indEst === '1' || indEst === '2') && !codPart) {
      const rule = getPvaRule('REGRA_OBRIGATORIO_COD_PART_ESTOQUE');
      issues.push({
        id: `PVA_REGRA_OBRIGATORIO_COD_PART_ESTOQUE_${rK200.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_OBRIGATORIO_COD_PART_ESTOQUE',
        record: 'K200',
        line: rK200.lineNumber,
        field: 'COD_PART',
        message: `Estoque K200 [${codItem}]: Participante COD_PART é obrigatório quando o estoque está em posse ou pertence a terceiros (IND_EST=${indEst}).`,
        pvaRuleId: 'REGRA_OBRIGATORIO_COD_PART_ESTOQUE',
        pvaGuidance: rule?.guidance,
      });
    } else if (indEst === '0' && codPart) {
      const rule = getPvaRule('REGRA_NAO_INFORMAR_COD_PART_K200');
      issues.push({
        id: `PVA_REGRA_NAO_INFORMAR_COD_PART_K200_${rK200.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_NAO_INFORMAR_COD_PART_K200',
        record: 'K200',
        line: rK200.lineNumber,
        field: 'COD_PART',
        message: `Estoque K200 [${codItem}]: COD_PART não deve ser informado para estoque próprio em poder próprio (IND_EST=0).`,
        pvaRuleId: 'REGRA_NAO_INFORMAR_COD_PART_K200',
        pvaGuidance: rule?.guidance,
      });
    }

    // 8.3 REGRA_VALIDA_COD_ITEM_TP_ITEM no K200
    const itemType = itemTypeMap.get(codItem);
    if (itemType && ['07', '08', '09'].includes(itemType)) {
      const rule = getPvaRule('REGRA_VALIDA_COD_ITEM_TP_ITEM');
      issues.push({
        id: `PVA_REGRA_VALIDA_COD_ITEM_TP_ITEM_${rK200.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_VALIDA_COD_ITEM_TP_ITEM',
        record: 'K200',
        line: rK200.lineNumber,
        field: 'COD_ITEM',
        message: `Estoque K200: Item [${codItem}] possui tipo inválido (${itemType}) para controle de estoque. Tipos válidos: 00, 01, 02, 03, 04, 05 ou 10.`,
        pvaRuleId: 'REGRA_VALIDA_COD_ITEM_TP_ITEM',
        pvaGuidance: rule?.guidance,
      });
    }
  }

  // 8.4 Validação K230 (Produção Própria) e K235 (Insumos)
  let currentK230: SpedLine | null = null;
  let currentK235List: SpedLine[] = [];

  const checkK230WithPvaRules = (k230: SpedLine, k235List: SpedLine[]) => {
    const dtIniOp = (k230.fields[0] || '').trim();
    const dtFinOp = (k230.fields[1] || '').trim();
    const codDocOp = (k230.fields[2] || '').trim();
    const codItemResultante = (k230.fields[3] || '').trim();

    // REGRA_OBRIGATORIO_K235_V2: Leiaute completo exige insumos em OP concluída
    if (indTpLeiaute === '1' && dtFinOp && k235List.length === 0) {
      const rule = getPvaRule('REGRA_OBRIGATORIO_K235_V2');
      issues.push({
        id: `PVA_REGRA_OBRIGATORIO_K235_V2_${k230.lineNumber}`,
        severity: 'ERRO',
        code: 'REGRA_OBRIGATORIO_K235_V2',
        record: 'K230',
        line: k230.lineNumber,
        field: 'REG',
        message: `OP #${codDocOp || k230.lineNumber}: Ordem de produção de [${codItemResultante}] concluída em leiaute completo exige pelo menos um insumo no registro K235.`,
        pvaRuleId: 'REGRA_OBRIGATORIO_K235_V2',
        pvaGuidance: rule?.guidance,
      });
    }

    const dIniOp = parseSpedDate(dtIniOp);
    const dFinOp = parseSpedDate(dtFinOp);

    for (const k235 of k235List) {
      const dtSaida = (k235.fields[0] || '').trim();
      const codInsumo = (k235.fields[1] || '').trim();

      // REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K230 (PVA): Insumo != Produto
      if (codInsumo && codInsumo === codItemResultante) {
        const rule = getPvaRule('REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K230');
        issues.push({
          id: `PVA_REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K230_${k235.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K230',
          record: 'K235',
          line: k235.lineNumber,
          field: 'COD_ITEM',
          message: `Insumo consumido [${codInsumo}] não pode ter o mesmo código do produto resultante da OP no K230.`,
          pvaRuleId: 'REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K230',
          pvaGuidance: rule?.guidance,
        });
      }

      // REGRA_VALIDA_DT_SAIDA_ESTOQUE_ALOCACAO_PRODUTO: DT_SAIDA dentro do período da OP
      const dSaida = parseSpedDate(dtSaida);
      if (dSaida && dIniOp) {
        if (dSaida < dIniOp || (dFinOp && dSaida > dFinOp)) {
          const rule = getPvaRule('REGRA_VALIDA_DT_SAIDA_ESTOQUE_ALOCACAO_PRODUTO');
          issues.push({
            id: `PVA_REGRA_VALIDA_DT_SAIDA_ESTOQUE_ALOCACAO_PRODUTO_${k235.lineNumber}`,
            severity: 'ERRO',
            code: 'REGRA_VALIDA_DT_SAIDA_ESTOQUE_ALOCACAO_PRODUTO',
            record: 'K235',
            line: k235.lineNumber,
            field: 'DT_SAIDA',
            message: `Data de saída do insumo [${codInsumo}] (${dtSaida}) fora do período da ordem de produção (${dtIniOp} a ${dtFinOp || 'aberta'}).`,
            pvaRuleId: 'REGRA_VALIDA_DT_SAIDA_ESTOQUE_ALOCACAO_PRODUTO',
            pvaGuidance: rule?.guidance,
          });
        }
      }

      // REGRA_VALIDA_COD_ITEM_TP_ITEM no K235
      const insumoType = itemTypeMap.get(codInsumo);
      if (insumoType && ['07', '08', '09'].includes(insumoType)) {
        const rule = getPvaRule('REGRA_VALIDA_COD_ITEM_TP_ITEM');
        issues.push({
          id: `PVA_REGRA_VALIDA_COD_ITEM_TP_ITEM_K235_${k235.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_VALIDA_COD_ITEM_TP_ITEM',
          record: 'K235',
          line: k235.lineNumber,
          field: 'COD_ITEM',
          message: `Insumo [${codInsumo}] possui tipo de item inválido (${insumoType}) para consumo de produção.`,
          pvaRuleId: 'REGRA_VALIDA_COD_ITEM_TP_ITEM',
          pvaGuidance: rule?.guidance,
        });
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.reg === 'K230') {
      if (currentK230) {
        checkK230WithPvaRules(currentK230, currentK235List);
      }
      currentK230 = line;
      currentK235List = [];
    } else if (line.reg === 'K235') {
      currentK235List.push(line);
    } else if (['K200', 'K250', 'K260', 'K290', 'K100', 'K990'].includes(line.reg)) {
      if (currentK230) {
        checkK230WithPvaRules(currentK230, currentK235List);
        currentK230 = null;
        currentK235List = [];
      }
    }
  }
  if (currentK230) {
    checkK230WithPvaRules(currentK230, currentK235List);
  }

  // 8.5 Validação K250 e K255 (Industrialização em Terceiros)
  let currentK250: SpedLine | null = null;
  let currentK255List: SpedLine[] = [];

  const checkK250WithPvaRules = (k250: SpedLine, k255List: SpedLine[]) => {
    const codItemResultante = (k250.fields[1] || '').trim();

    for (const k255 of k255List) {
      const codInsumo = (k255.fields[1] || '').trim();
      if (codInsumo && codInsumo === codItemResultante) {
        const rule = getPvaRule('REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K250');
        issues.push({
          id: `PVA_REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K250_${k255.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K250',
          record: 'K255',
          line: k255.lineNumber,
          field: 'COD_ITEM',
          message: `Insumo consumido em terceiros [${codInsumo}] não pode ter o mesmo código do produto resultante fabricado no K250.`,
          pvaRuleId: 'REGRA_DIFERENTE_COD_ITEM_RESULTANTE_K250',
          pvaGuidance: rule?.guidance,
        });
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.reg === 'K250') {
      if (currentK250) {
        checkK250WithPvaRules(currentK250, currentK255List);
      }
      currentK250 = line;
      currentK255List = [];
    } else if (line.reg === 'K255') {
      currentK255List.push(line);
    } else if (['K200', 'K230', 'K260', 'K290', 'K100', 'K990'].includes(line.reg)) {
      if (currentK250) {
        checkK250WithPvaRules(currentK250, currentK255List);
        currentK250 = null;
        currentK255List = [];
      }
    }
  }
  if (currentK250) {
    checkK250WithPvaRules(currentK250, currentK255List);
  }

  // 8.6 Validação K290, K291 e K292 (Produção Conjunta)
  let currentK290: SpedLine | null = null;
  let currentK291Codes = new Set<string>();
  let currentK292List: SpedLine[] = [];

  const checkK290WithPvaRules = (k290: SpedLine, k291Codes: Set<string>, k292List: SpedLine[]) => {
    for (const k292 of k292List) {
      const codInsumo = (k292.fields[0] || '').trim();
      if (k291Codes.has(codInsumo)) {
        const rule = getPvaRule('REGRA_COD_ITEM_K291_K292');
        issues.push({
          id: `PVA_REGRA_COD_ITEM_K291_K292_${k292.lineNumber}`,
          severity: 'ERRO',
          code: 'REGRA_COD_ITEM_K291_K292',
          record: 'K292',
          line: k292.lineNumber,
          field: 'COD_ITEM',
          message: `Produção conjunta K290: O item [${codInsumo}] não pode constar simultaneamente como produto resultante (K291) e insumo consumido (K292).`,
          pvaRuleId: 'REGRA_COD_ITEM_K291_K292',
          pvaGuidance: rule?.guidance,
        });
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.reg === 'K290') {
      if (currentK290) {
        checkK290WithPvaRules(currentK290, currentK291Codes, currentK292List);
      }
      currentK290 = line;
      currentK291Codes = new Set<string>();
      currentK292List = [];
    } else if (line.reg === 'K291') {
      if (line.fields[0]) currentK291Codes.add(line.fields[0].trim());
    } else if (line.reg === 'K292') {
      currentK292List.push(line);
    } else if (['K200', 'K230', 'K250', 'K260', 'K100', 'K990'].includes(line.reg)) {
      if (currentK290) {
        checkK290WithPvaRules(currentK290, currentK291Codes, currentK292List);
        currentK290 = null;
        currentK291Codes = new Set<string>();
        currentK292List = [];
      }
    }
  }
  if (currentK290) {
    checkK290WithPvaRules(currentK290, currentK291Codes, currentK292List);
  }

  // ========================================================================
  // 9. VALIDAÇÃO OFICIAL PVA - TOTALIZADORES DE BLOCO E ENCERRAMENTO
  // ========================================================================
  const blockTotalizerSpecs: Array<{ reg: string; block: string }> = [
    { reg: '0990', block: '0' },
    { reg: 'B990', block: 'B' },
    { reg: 'C990', block: 'C' },
    { reg: 'D990', block: 'D' },
    { reg: 'E990', block: 'E' },
    { reg: 'G990', block: 'G' },
    { reg: 'H990', block: 'H' },
    { reg: 'K990', block: 'K' },
    { reg: '1990', block: '1' },
    { reg: '9990', block: '9' },
  ];

  const actualBlockCounts: Record<string, number> = {};
  for (const l of lines) {
    const b = l.reg[0];
    actualBlockCounts[b] = (actualBlockCounts[b] || 0) + 1;
  }

  for (const spec of blockTotalizerSpecs) {
    const totLine = regMap.get(spec.reg)?.[0];
    if (totLine) {
      const reportedQty = parseInt(totLine.fields[0] || '0', 10);
      const expectedQty = actualBlockCounts[spec.block] || 0;
      if (reportedQty !== expectedQty) {
        issues.push({
          id: `TOTALIZER_${spec.reg}`,
          severity: 'ERRO',
          code: `REG-${spec.reg}-QTY`,
          pvaRuleId: `REGRA_QTD_LIN_${spec.block}`,
          pvaGuidance: `A quantidade de linhas do bloco ${spec.block} deve ser igual ao total de registros existentes no bloco.`,
          record: spec.reg,
          line: totLine.lineNumber,
          field: `2 - QTD_LIN_${spec.block}`,
          message: `Quantidade de linhas do bloco ${spec.block} informada (${reportedQty}) não confere com a esperada pelo sistema (${expectedQty}).`,
          difference: {
            expected: expectedQty,
            found: reportedQty,
            fieldName: `QTD_LIN_${spec.block}`,
          },
        });
      }
    }
  }

  // 9999: total geral de linhas
  const r9999 = regMap.get('9999')?.[0];
  if (r9999) {
    const reportedTotal = parseInt(r9999.fields[0] || '0', 10);
    const expectedTotal = lines.length;
    if (reportedTotal !== expectedTotal) {
      issues.push({
        id: 'TOTALIZER_9999',
        severity: 'ERRO',
        code: 'REG-9999-QTY',
        pvaRuleId: 'REGRA_QTD_LIN_TOTAL',
        pvaGuidance: 'O campo QTD_LIN deve ser igual ao total de linhas existentes em todo o arquivo SPED.',
        record: '9999',
        line: r9999.lineNumber,
        field: '2 - QTD_LIN',
        message: `Quantidade total de linhas do arquivo informada (${reportedTotal}) não confere com a esperada pelo sistema (${expectedTotal}).`,
        difference: {
          expected: expectedTotal,
          found: reportedTotal,
          fieldName: 'QTD_LIN',
        },
      });
    }
  }

  return issues;
}

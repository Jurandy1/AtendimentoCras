/**
 * Validação de NIS (PIS/PASEP) com algoritmo de dígito verificador
 * Baseado no algoritmo oficial do Ministério da Previdência Social
 */

export const validateNIS = (nis) => {
  if (!nis) return false;
  
  // Remove tudo que não é número
  const nisLimpo = String(nis).replace(/\D/g, '');
  
  // NIS deve ter 11 dígitos
  if (nisLimpo.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais (caso comum de teste)
  if (/^(\d)\1{10}$/.test(nisLimpo)) return false;
  
  // Separa o número base do dígito verificador
  const base = nisLimpo.substring(0, 10);
  const dv = parseInt(nisLimpo.substring(10, 11));
  
  // Calcula o dígito verificador
  let soma = 0;
  let peso = 2;
  
  // Percorre da direita para esquerda
  for (let i = base.length - 1; i >= 0; i--) {
    const digito = parseInt(base.charAt(i));
    soma += digito * peso;
    peso++;
    if (peso > 9) peso = 2; // Reinicia o peso após 9
  }
  
  // Calcula o resto
  const resto = soma % 11;
  let dvCalculado;
  
  if (resto === 0 || resto === 1) {
    dvCalculado = 0;
  } else {
    dvCalculado = 11 - resto;
  }
  
  return dv === dvCalculado;
};

/**
 * Formata NIS para exibição (XXX.XXXXX.XX-X)
 */
export const formatNIS = (nis) => {
  if (!nis) return '';
  
  const nisLimpo = String(nis).replace(/\D/g, '');
  if (nisLimpo.length !== 11) return nis;
  
  return `${nisLimpo.substring(0, 3)}.${nisLimpo.substring(3, 8)}.${nisLimpo.substring(8, 10)}-${nisLimpo.substring(10, 11)}`;
};

/**
 * Gera NIS válido para testes (não use em produção)
 */
export const generateValidNIS = () => {
  // Gera 10 dígitos aleatórios
  const base = Math.floor(Math.random() * 9000000000) + 1000000000;
  
  let soma = 0;
  let peso = 2;
  
  for (let i = String(base).length - 1; i >= 0; i--) {
    const digito = parseInt(String(base).charAt(i));
    soma += digito * peso;
    peso++;
    if (peso > 9) peso = 2;
  }
  
  const resto = soma % 11;
  let dv;
  
  if (resto === 0 || resto === 1) {
    dv = 0;
  } else {
    dv = 11 - resto;
  }
  
  return String(base) + dv;
};
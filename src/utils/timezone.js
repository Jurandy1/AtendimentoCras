/**
 * Funções de timezone e data para o Brasil (BRT)
 */

import { parseBRDateToDate } from './helpers';

/**
 * Converte uma data para BRT (Brasília Time)
 * Considera o horário de verão automaticamente
 */
export const convertToBRT = (date) => {
  if (!date) return null;
  
  // Se for Timestamp do Firestore, converte para Date
  if (date.toDate && typeof date.toDate === 'function') {
    date = date.toDate();
  }
  
  // Se for string, converte para Date
  if (typeof date === 'string') {
    const raw = String(date || '').trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      date = parseBRDateToDate(raw);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      date = new Date(raw + 'T12:00:00');
    } else {
      date = new Date(raw);
    }
  }
  
  // Se não for Date, retorna null
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  
  // Converte para BRT (UTC-3 ou UTC-2 no horário de verão)
  return new Date(date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
};

/**
 * Cria timestamps de início e fim de dia em BRT para filtros
 */
export const getBRTRange = (dateString) => {
  if (!dateString) return { start: null, end: null };
  
  const raw = dateString instanceof Date ? dateString : String(dateString || '').trim();

  let date = null;
  if (raw instanceof Date) {
    date = raw;
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    date = parseBRDateToDate(raw);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    date = new Date(raw + 'T00:00:00');
  } else {
    const d = new Date(raw);
    date = isNaN(d.getTime()) ? null : d;
  }

  if (!date) return { start: null, end: null };

  const brtDate = convertToBRT(date);
  
  if (!brtDate) return { start: null, end: null };
  
  // Início do dia (00:00:00)
  const start = new Date(brtDate);
  start.setHours(0, 0, 0, 0);
  
  // Fim do dia (23:59:59.999)
  const end = new Date(brtDate);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};

/**
 * Formata data para exibição em BRT
 */
export const formatBRTDate = (date, format = 'full') => {
  const brtDate = convertToBRT(date);
  if (!brtDate) return '';
  
  const options = {
    full: { 
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    },
    date: { 
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric'
    },
    time: { 
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit'
    }
  };
  
  return brtDate.toLocaleString('pt-BR', options[format] || options.full);
};

/**
 * Verifica se horário atual está em horário comercial BRT
 */
export const isBusinessHoursBRT = () => {
  const now = convertToBRT(new Date());
  if (!now) return false;
  
  const hours = now.getHours();
  const day = now.getDay();
  
  // Segunda a sexta, 8h às 18h
  return day >= 1 && day <= 5 && hours >= 8 && hours < 18;
};

/**
 * Calcula diferença entre datas em BRT
 */
export const getBRTDiff = (startDate, endDate, unit = 'minutes') => {
  const start = convertToBRT(startDate);
  const end = convertToBRT(endDate);
  
  if (!start || !end) return 0;
  
  const diffMs = end.getTime() - start.getTime();
  
  switch (unit) {
    case 'seconds': return Math.floor(diffMs / 1000);
    case 'minutes': return Math.floor(diffMs / (1000 * 60));
    case 'hours': return Math.floor(diffMs / (1000 * 60 * 60));
    case 'days': return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    default: return diffMs;
  }
};

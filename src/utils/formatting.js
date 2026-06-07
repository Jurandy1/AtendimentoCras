import { Timestamp } from 'firebase/firestore';

export const maskCPF = (cpf) => { 
  if (!cpf) return "Não informado"; 
  const cleaned = cpf.replace(/\D/g, ''); 
  if (cleaned.length !== 11) return "CPF inválido"; 
  return `${cleaned.substring(0, 3)}.***.***-${cleaned.substring(9, 11)}`; 
};

export const formatTime = (timestamp) => { 
  if (!timestamp || !timestamp.toDate) return "--:--"; 
  return timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); 
};

export const formatDateTime = (timestamp) => { 
  if (!timestamp || !timestamp.toDate) return "-"; 
  return timestamp.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); 
};

export const calculateWaitTime = (horaChegada) => { 
  if (!horaChegada || !horaChegada.toDate) return "0 min"; 
  const now = new Date(); 
  const arrived = horaChegada.toDate(); 
  const diffMs = now.getTime() - arrived.getTime(); 
  const diffMin = Math.round(diffMs / (1000 * 60)); 
  return `${diffMin} min`; 
};

export const calculateDuration = (horaInicio, horaFim) => { 
  if (!horaInicio || !horaFim || !horaInicio.toDate || !horaFim.toDate) {
    console.warn('calculateDuration: Dados inválidos:', {
      horaInicio: horaInicio,
      horaFim: horaFim,
      temHoraInicio: !!horaInicio,
      temHoraFim: !!horaFim,
      temToDateInicio: !!(horaInicio && horaInicio.toDate),
      temToDateFim: !!(horaFim && horaFim.toDate)
    });
    return "-"; 
  }
  const start = horaInicio.toDate(); 
  const end = horaFim.toDate(); 
  const diffMs = end.getTime() - start.getTime(); 
  const diffMin = Math.max(1, Math.round(diffMs / (1000 * 60))); 
  return `${diffMin} min`; 
};

export const getStartOfToday = () => { 
  const today = new Date(); 
  today.setHours(0, 0, 0, 0); 
  return today; 
};

export const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

export const parseDateFromInput = (dateString) => {
  if (!dateString) return null;
  // Se já for um timestamp Firestore, retorna como está
  if (dateString && dateString.toDate) return dateString;
  // Converte string YYYY-MM-DD para Date
  const [year, month, day] = dateString.split('-');
  return new Date(year, month - 1, day);
};

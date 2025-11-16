(() => {
  const COR_PRINCIPAL = "#1351B4";
  const COR_PRINCIPAL_HOVER = "#104191";
  const CORES_STATUS = { aguardando: "bg-yellow-100 text-yellow-800 border-yellow-300", chamando: "bg-blue-100 text-blue-800 border-blue-300", em_atendimento: "bg-green-100 text-green-800 border-green-300", finalizado: "bg-gray-100 text-gray-700 border-gray-300" };
  const CORES_TIPO_PADRAO = ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA', '#D81B60', '#00ACC1', '#FB8C00'];
  const maskCPF = (cpf) => { if (!cpf) return "Não informado"; const cleaned = cpf.replace(/\D/g, ''); if (cleaned.length !== 11) return "CPF inválido"; return `${cleaned.substring(0, 3)}.***.***-${cleaned.substring(9, 11)}`; };
  const formatTime = (timestamp) => { if (!timestamp) return "--:--"; return timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const formatDateTime = (timestamp) => { if (!timestamp) return "-"; return timestamp.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const calculateWaitTime = (horaChegada) => { if (!horaChegada) return "0 min"; const now = new Date(); const arrived = horaChegada.toDate(); const diffMs = now.getTime() - arrived.getTime(); const diffMin = Math.round(diffMs / (1000 * 60)); return `${diffMin} min`; };
  const calculateDuration = (horaInicio, horaFim) => { if (!horaInicio || !horaFim) return "-"; const start = horaInicio.toDate(); const end = horaFim.toDate(); const diffMs = end.getTime() - start.getTime(); const diffMin = Math.max(1, Math.round(diffMs / (1000 * 60))); return `${diffMin} min`; };
  const getStartOfToday = () => { const today = new Date(); today.setHours(0, 0, 0, 0); return today; };
  window.Utils = { COR_PRINCIPAL, COR_PRINCIPAL_HOVER, CORES_STATUS, CORES_TIPO_PADRAO, maskCPF, formatTime, formatDateTime, calculateWaitTime, calculateDuration, getStartOfToday };
})();

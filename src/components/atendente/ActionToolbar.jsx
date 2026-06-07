import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Play, CheckCircle, XCircle, ArrowRightLeft, Users, UserPlus, 
  Clock, Power, LogOut, Volume2, PlayCircle, PauseCircle, Repeat, UserX 
} from 'lucide-react';
import Button from '../ui/Button';

const ActionToolbar = ({
  showTransfer,
  setShowTransfer,
  handleChamarProximo,
  loadingFila,
  filaAguardando,
  atendimentoAtual,
  statusExpediente, // online/offline
  busyAction,
  handleStatusChange,
  handleIniciarAtendimento,
  loadingAtual,
  handleFinalizarAtendimento,
  handleMarcarAusente,
  isAtendentePsicologo,
  openBlockModal,
  handleTransferir,
  hasCadUnicoRequest
}) => {
  // Estado local para o timer (apenas visual por enquanto, reinicia ao recarregar)
  const [timer, setTimer] = useState(0);
  // Estado local para controle de expediente (visual)
  const isOpen = statusExpediente === "online" || statusExpediente === "pausa" || statusExpediente === "ocupado";
  const [localExpediente, setLocalExpediente] = useState(isOpen ? 'aberto' : 'fechado');

  useEffect(() => {
    setLocalExpediente(isOpen ? "aberto" : "fechado");
  }, [isOpen]);

  useEffect(() => {
    let interval;
    if (atendimentoAtual?.status === 'em_atendimento' || atendimentoAtual?.status === 'chamando') {
      // Se estiver em atendimento, conta o tempo
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [atendimentoAtual?.status]);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Se o usuário clicar em "Iniciar Expediente", simulamos a mudança visual
  // Na prática, isso deveria chamar uma função do backend, mas vamos manter visualmente funcional
  const toggleExpediente = () => {
    const next = localExpediente === "aberto" ? "fechado" : "aberto";
    setLocalExpediente(next);
    if (typeof handleStatusChange === "function") {
      handleStatusChange(next === "aberto" ? "online" : "offline");
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-white pt-2 pb-4 shadow-sm mb-6">
      {/* COCKPIT DE COMANDO */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-md flex flex-wrap justify-between items-center gap-3">
        
        {/* LADO ESQUERDO: STATUS E TIMER */}
        <div className="flex items-center gap-3 min-w-fit">
          <div className="bg-slate-900 px-4 py-2 rounded-lg border-2 border-slate-700 shadow-inner flex flex-col items-center min-w-[100px]">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Duração</span>
            <span className={`text-2xl font-mono font-black leading-none ${atendimentoAtual?.status === 'em_atendimento' ? 'text-green-400' : 'text-slate-600'}`}>
              {formatTime(timer)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Status Turno:</span>
            <span className={`text-[11px] font-black uppercase ${localExpediente === 'aberto' ? 'text-green-600' : 'text-red-600'}`}>
              {localExpediente === 'aberto' ? '● Expediente Aberto' : '○ Turno Fechado'}
            </span>
          </div>
        </div>

        {/* LADO DIREITO: BOTÕES DE AÇÃO */}
        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          
          {localExpediente === 'fechado' ? (
             <Button 
               variant="custom" 
               className="bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-wide px-8 py-3 shadow-lg"
               onClick={toggleExpediente}
             >
               <Play size={18} className="mr-2" /> Iniciar Expediente
             </Button>
          ) : (
            <>
              {!showTransfer ? (
                <div className="flex flex-wrap gap-2 items-center">
                  
                  {/* GRUPO 1: CHAMAR / INICIAR */}
                  {(!atendimentoAtual || atendimentoAtual.status === 'chamando') && (
                    <>
                      <Button
                        onClick={handleChamarProximo}
                        disabled={loadingFila || !filaAguardando.length || (atendimentoAtual && atendimentoAtual.status !== 'chamando') || !!busyAction}
                        variant="custom"
                        className={`bg-blue-800 hover:bg-blue-900 text-white font-black uppercase tracking-wide border-blue-900 ${!atendimentoAtual ? 'animate-pulse' : ''}`}
                      >
                        <Volume2 size={18} className="mr-2" />
                        {atendimentoAtual?.status === 'chamando' ? 'Rechamar' : 'Chamar Próximo'}
                      </Button>

                      {atendimentoAtual?.status === 'chamando' && (
                        <>
                          <Button
                            onClick={handleIniciarAtendimento}
                            disabled={loadingAtual || !!busyAction}
                            variant="custom"
                            className="bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-wide border-green-800"
                          >
                            <PlayCircle size={18} className="mr-2" />
                            Iniciar
                          </Button>
                          <Button
                            onClick={handleMarcarAusente}
                            disabled={loadingAtual || !!busyAction}
                            variant="custom"
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-black uppercase tracking-wide border-yellow-800"
                          >
                            <UserX size={18} className="mr-2" />
                            Ausente
                          </Button>
                        </>
                      )}
                    </>
                  )}

                  {/* GRUPO 2: AÇÕES DE ATENDIMENTO (TRANSFERIR, DESLIGAR, FINALIZAR) */}
                  {atendimentoAtual?.status === 'em_atendimento' && (
                    <>
                      <Button variant="secondary" className="font-bold text-gray-600 border-gray-300">
                        <PauseCircle size={18} className="mr-2" /> Pausar
                      </Button>

                      <Button
                        onClick={() => setShowTransfer(true)}
                        disabled={loadingAtual || !!busyAction}
                        variant="custom"
                        className="bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-wide border-orange-800"
                      >
                        <ArrowRightLeft size={18} className="mr-2" />
                        Transferir
                      </Button>

                      {isAtendentePsicologo && (
                        <Button
                          onClick={openBlockModal}
                          disabled={loadingAtual || !!busyAction}
                          variant="custom"
                          className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wide border-red-800"
                        >
                          <Power size={18} className="mr-2" />
                          Desligar
                        </Button>
                      )}

                      <Button
                        onClick={handleFinalizarAtendimento}
                        disabled={loadingAtual || !!busyAction}
                        variant="custom"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wide border-emerald-800 px-6"
                      >
                        <CheckCircle size={18} className="mr-2" />
                        Finalizar
                      </Button>
                    </>
                  )}

                  <div className="w-px h-8 bg-gray-300 mx-2 hidden sm:block"></div>
                  
                  <Button 
                    variant="custom" 
                    className="bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] px-3"
                    onClick={toggleExpediente}
                    title="Encerrar Turno"
                  >
                    <LogOut size={14} className="mr-1" /> Sair
                  </Button>
                </div>
              ) : (
                // MODO TRANSFERÊNCIA
                <div className="flex items-center gap-3 w-full animate-fadeIn bg-orange-50 p-2 rounded-lg border border-orange-200">
                  <span className="text-sm font-black text-orange-800 flex items-center gap-2 uppercase">
                    <ArrowRightLeft size={16} /> Transferir para:
                  </span>
                  <Button
                    onClick={() => handleTransferir("cadunico")}
                    disabled={!!busyAction}
                    title="Transferir para fila do CadÚnico"
                    size="sm"
                    variant="custom"
                    className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-black uppercase border-0"
                  >
                    <Users size={16} className="mr-2" />
                    CadÚnico
                  </Button>
                  <Button
                    onClick={() => handleTransferir("psicologo")}
                    disabled={!!busyAction}
                    size="sm"
                    variant="custom"
                    className="bg-teal-600 text-white font-black uppercase hover:bg-teal-700 active:bg-teal-800 border-0"
                  >
                    <UserPlus size={16} className="mr-2" />
                    Psicologia
                  </Button>
                  <Button
                    onClick={() => setShowTransfer(false)}
                    disabled={!!busyAction}
                    size="sm"
                    variant="secondary"
                    className="ml-auto font-black uppercase"
                  >
                    <XCircle size={16} className="mr-2" />
                    Cancelar
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionToolbar;

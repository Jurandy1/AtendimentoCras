import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import FichaAtendimentoTecnico from './FichaAtendimentoTecnico';
import StartExpediente from './StartExpediente';
import UltimasObservacoes from './UltimasObservacoes';
import DesfechoEspecialPanel from './DesfechoEspecialPanel';
import { 
  LayoutDashboard, Users, BookOpen, MonitorPlay, UserCircle, FileText, History, Settings, 
  Download, LogOut, Menu, Bell, ChevronDown, Calendar, Save, Eraser, Lock, Search, 
  ClipboardList, Volume2, Clock, CheckCircle2, AlertCircle, ArrowRight, UserPlus, 
  Stethoscope, Database, Play, Pause, Power, ArrowRightLeft, Repeat, UserX, Mic, 
  PhoneOff, PauseCircle, PlayCircle, MapPin, Siren, FileInput, Info, FileCheck, 
  AlertTriangle, X, Maximize2, ZoomIn, ZoomOut, Loader
} from 'lucide-react';
import Card from '../ui/Card';
import UiButton from '../ui/Button';
import UiInput from '../ui/Input';
import UiSelect from '../ui/Select';
import { formatBRDateTyping, fixFirebaseStorageUrl, simplify } from '../../utils';
import ConfirmDialog from '../ui/ConfirmDialog';

// --- COMPONENTES DE UI ---

const Button = ({ children, variant = 'primary', icon: Icon, className = '', ...props }) => {
  const baseStyle = "flex items-center justify-center gap-2 px-3 py-2 rounded font-black transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] uppercase tracking-widest shadow-sm border whitespace-nowrap";
  const variants = {
    primary: "bg-[#1e40af] hover:bg-[#1e3a8a] text-white border-blue-900",
    secondary: "bg-white hover:bg-gray-50 text-blue-900 border-gray-300",
    success: "bg-[#16a34a] hover:bg-[#15803d] text-white border-green-700",
    warning: "bg-[#d97706] hover:bg-[#b45309] text-white border-orange-700",
    transfer: "bg-[#ea580c] hover:bg-[#c2410c] text-white border-orange-800",
    danger: "bg-[#dc2626] hover:bg-[#b91c1c] text-white border-red-800",
    dark: "bg-gray-800 hover:bg-gray-900 text-white border-gray-900",
    info: "bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-800",
  };
  return (
    <UiButton variant="custom" className={`${baseStyle} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {Icon && <Icon size={14} className="shrink-0" />}
      <span>{children}</span>
    </UiButton>
  );
};

const InputField = ({ label, placeholder, required, type = "text", helperText, icon: Icon, className = "", ...props }) => (
  <div className={className}>
    <UiInput
      type={type}
      placeholder={placeholder}
      label={
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      }
      endContent={Icon ? <Icon size={16} /> : null}
      {...props}
    />
    {helperText && <span className="mt-1 text-[9px] text-blue-600 font-bold italic leading-tight block">{helperText}</span>}
  </div>
);

const SelectField = ({ label, options, required, className = "", ...props }) => (
  <UiSelect
    className={className}
    label={
      <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
    }
    defaultValue=""
    {...props}
  >
    <option value="" disabled>Selecione</option>
    {options.map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}
  </UiSelect>
);

// --- COMPONENTE: MODAL DE DESLIGAMENTO ---

const DesligamentoModal = ({ isOpen, onClose, onConfirm, cidadao, blockReason, blockDate, blockTecnico, setBlockReason, setBlockDate, setBlockTecnico }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl border-t-8 border-red-600 animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-red-100 rounded-full text-red-600 shrink-0"><UserX size={32} /></div>
            <div>
              <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Realizar Desligamento</h2>
              <p className="text-xs text-gray-500">Encerrando acompanhamento de <strong>{cidadao?.nome}</strong>.</p>
            </div>
          </div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onConfirm(); }}>
            <div>
               <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Motivo do Desligamento *</label>
               <textarea 
                  className="w-full h-24 p-3 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 shadow-inner" 
                  placeholder="Descreva o motivo do desligamento técnico..."
                  value={blockReason || ""}
                  onChange={(e) => setBlockReason && setBlockReason(e.target.value)}
                  required
               ></textarea>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField 
                  label="Data" 
                  type="text"
                  required 
                  value={blockDate || new Date().toLocaleDateString('pt-BR')}
                  placeholder="dd/mm/aaaa"
                  inputMode="numeric"
                  onChange={(e) => setBlockDate && setBlockDate(formatBRDateTyping(e.target.value))}
              />
              <InputField 
                  label="Técnico Responsável" 
                  required 
                  placeholder="Nome do Técnico"
                  value={blockTecnico || ""}
                  onChange={(e) => setBlockTecnico && setBlockTecnico(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
              <button type="button" onClick={onClose} className="px-4 text-[10px] font-black text-gray-500 uppercase hover:text-gray-700 transition-colors">Cancelar</button>
              <Button variant="danger" icon={Power} type="submit">Confirmar Desligamento</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const TransferenciaModal = ({ isOpen, onClose, onConfirm, atendentesList, crasUnidades, currentCrasId }) => {
  const [selectedAtendente, setSelectedAtendente] = useState("");
  const [destino, setDestino] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAtendente("");
      setDestino(null);
    }
  }, [isOpen]);

  const atendentesDisponiveis = useMemo(() => {
     if (!atendentesList) return [];
     const THRESHOLD = 15 * 60 * 1000;
     return atendentesList.filter((a) => {
       const lsRaw = a?.last_seen;
       const lsMs =
         lsRaw?.toMillis?.() ??
         lsRaw?.toDate?.()?.getTime?.() ??
         (typeof lsRaw === "number" ? lsRaw : 0);
       const isStale = lsMs > 0 && Date.now() - lsMs > THRESHOLD;
       const trueStatus = isStale ? "offline" : (a?.status || "offline");
       return (
         simplify(trueStatus) === "online" &&
         (!currentCrasId || String(a?.cras_id || "") === String(currentCrasId || ""))
       );
     });
  }, [atendentesList, currentCrasId]);

  const handleConfirm = () => {
     onConfirm(destino, selectedAtendente);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter text-center flex items-center justify-center gap-2">
            <ArrowRightLeft className="text-blue-600" />
            Transferir Atendimento
          </h2>
          <p className="text-center text-xs text-gray-500 mt-2 font-medium">Selecione o setor de destino e, opcionalmente, um profissional específico.</p>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* SELEÇÃO DE SETOR */}
          <div className="space-y-3">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">1. Selecione o Setor de Destino</label>
             <div className="grid grid-cols-3 gap-3">
               {[
                 {
                   key: "psicologo",
                   label: "Psicologia",
                   Icon: Stethoscope,
                   ring: "ring-blue-400",
                   active: "border-blue-500 bg-blue-50",
                   icon: "bg-blue-500 text-white",
                   iconOff: "bg-blue-100 text-blue-600",
                   count: atendentesDisponiveis.filter((a) =>
                     simplify(a.cargo || "").includes("psic")
                   ).length,
                 },
                 {
                   key: "cadunico",
                   label: "CadÚnico",
                   Icon: Database,
                   ring: "ring-cyan-400",
                   active: "border-cyan-500 bg-cyan-50",
                   icon: "bg-cyan-500 text-white",
                   iconOff: "bg-cyan-100 text-cyan-600",
                   count: atendentesDisponiveis.filter((a) => {
                     const c = simplify(a.cargo || "");
                     return c.includes("cad") || c.includes("unico");
                   }).length,
                 },
                 {
                   key: "coordenador",
                   label: "Coordenação",
                   Icon: Users,
                   ring: "ring-purple-400",
                   active: "border-purple-500 bg-purple-50",
                   icon: "bg-purple-500 text-white",
                   iconOff: "bg-purple-100 text-purple-600",
                   count: atendentesDisponiveis.filter((a) =>
                     simplify(a.cargo || "").includes("coord")
                   ).length,
                 },
               ].map(({ key, label, Icon, ring, active, icon, iconOff, count }) => (
                 <button
                   key={key}
                   type="button"
                   onClick={() => {
                     setDestino(key);
                     setSelectedAtendente("");
                   }}
                   className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all ${
                     destino === key
                       ? `${active} ring-2 ${ring} ring-offset-1`
                       : "border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                   }`}
                 >
                   <div
                     className={`p-3 rounded-xl transition-colors ${
                       destino === key ? icon : iconOff
                     }`}
                   >
                     <Icon size={22} />
                   </div>
                   <span
                     className={`text-xs font-black uppercase leading-tight ${
                       destino === key ? "" : "text-gray-600"
                     }`}
                   >
                     {label}
                   </span>
                   <span
                     className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                       count > 0
                         ? "bg-emerald-100 text-emerald-700"
                         : "bg-gray-100 text-gray-400"
                     }`}
                   >
                     {count > 0 ? `${count} online` : "indisponível"}
                   </span>
                 </button>
               ))}
             </div>
          </div>

          {/* SELEÇÃO DE PROFISSIONAL (OPCIONAL) */}
          <div className={`transition-all duration-300 ${destino ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-2 pointer-events-none'}`}>
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                2. Selecione um Profissional (Opcional)
             </label>
             <div className="relative">
                <select
                   value={selectedAtendente}
                   onChange={(e) => setSelectedAtendente(e.target.value)}
                   disabled={!destino}
                   className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none transition-shadow"
                >
                   <option value="">Qualquer atendente disponível</option>
                   {atendentesDisponiveis.map(at => {
                      // Normalizar cargo e verificar se deve ser exibido baseado no destino
                      let cargoDisplay = at.cargo || 'Servidor';
                      let show = true;

                      const cargoNorm = simplify(at.cargo || "");
                      const isPsi = cargoNorm.includes("psic");
                      const isCad = cargoNorm.includes("cad");
                      const isCoord = cargoNorm.includes("coord");

                      if (isPsi) cargoDisplay = 'Psicólogo(a)';
                      else if (isCad) cargoDisplay = 'CadÚnico';
                      else if (isCoord) cargoDisplay = 'Coordenador(a)';
                      
                      // Filtragem baseada no destino selecionado
                      if (destino === 'psicologo') {
                          // Se destino é Psicologia, mostra APENAS Psicólogos
                          if (!isPsi) show = false;
                      } else if (destino === 'cadunico') {
                          // Se destino é CadÚnico, mostra APENAS CadÚnico
                          if (!isCad) show = false;
                      } else if (destino === 'coordenador') {
                          // Se destino é Coordenador, mostra APENAS Coordenadores
                          if (!isCoord) show = false;
                      }

                      if (!show) return null;
                      
                      return (
                        <option key={at.id} value={at.id}>
                           {at.nome} - {cargoDisplay} ({at.status})
                        </option>
                      );
                   })}
                </select>
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
             </div>
             {selectedAtendente && (
                <p className="text-[10px] text-blue-600 mt-2 font-medium bg-blue-50 p-2 rounded border border-blue-100 flex items-center gap-2">
                   <Info size={12} />
                   Apenas este profissional poderá chamar o atendimento.
                </p>
             )}
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button 
             onClick={onClose} 
             className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 uppercase tracking-wider transition-colors"
          >
             Cancelar
          </button>
          <Button 
             variant={destino === 'cadunico' ? 'info' : 'primary'} 
             onClick={handleConfirm}
             disabled={!destino}
             icon={ArrowRightLeft}
             className="px-6"
          >
             Confirmar Transferência
          </Button>
        </div>
      </div>
    </div>
  );
};

const FotoZoomModal = ({ isOpen, onClose, imgSrc, nome }) => {
  const [scale, setScale] = useState(1);
  
  if (!isOpen || !imgSrc) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 1));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
         <div className="absolute top-4 right-4 z-10 flex gap-2">
            <button onClick={handleZoomOut} className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70"><ZoomOut /></button>
            <button onClick={handleZoomIn} className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70"><ZoomIn /></button>
            <button onClick={onClose} className="p-2 bg-red-600/80 text-white rounded-full hover:bg-red-700"><X /></button>
         </div>
         <img 
           src={imgSrc} 
           alt={nome} 
           className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl transition-transform duration-200"
           style={{ transform: `scale(${scale})` }}
           onError={(e) => {
             e.target.onerror = null; 
             e.target.src = `https://ui-avatars.com/api/?name=${nome}&background=0D8ABC&color=fff&size=512`;
           }}
         />
         <p className="text-white mt-4 font-bold text-lg">{nome}</p>
      </div>
    </div>
  );
};

const PainelAtendimento = ({
  atendimentoAtual,
  loadingAtual,
  getNomeCidadao,
  getWaitMinutes,
  salaAtualId,
  getSalaNome,
  draftRecovered,
  draftSavedAt,
  draftServerError,
  isCadUnicoAtual,
  isAtendenteCadUnico,
  isObservacaoOnly,
  cadunicoAcoes,
  setCadunicoAcoes,
  cadunicoObs,
  setCadunicoObs,
  rmaData,
  setRmaData,
  isAtendentePsicologo,
  isAtendenteTecnico,
  isAtendenteAssistenteSocial,
  observacoes,
  setObservacoes,
  templatesObservacao,
  inserirTemplate,
  salvarRascunhoNoSistema,
  clearLocalDraft,
  draftServerSaving,
  formatEventoTime,
  // Props extras mapeadas de AtendentePage
  statusExpediente,
  handleStatusChange,
  filaAguardando,
  handleChamarProximo,
  handleIniciarAtendimento,
  handleFinalizarAtendimento,
  handleMarcarAusente,
  handleRechamar,
  handleTransferir,
  handleBlockUser,
  handleVincularUnidade,
  handleRegistrarVisitaOutraUnidade,
  handleReligarETransferir,
  handleReceberNaUnidade,
  visitaEsporadicaAlerta,
  blockReason,
  setBlockReason,
  blockDate,
  setBlockDate,
  blockTecnico,
  setBlockTecnico,
  isGestor,
  isViewOnly = false,
  currentUserCrasId = null,
  setSelectedAtendente,
  // Props para Abertura de Expediente
  salasParaSelecao,
  handleTrocarSala,
  selectedAtendente,
  busyAction,
  isCoordenador,
  // Novas props
  atendentesList,
  crasUnidades,
  isTestMode,
  toggleTestMode,
  tipoAcompanhamento,
  setTipoAcompanhamento,
  tipoAcompanhamentoLocked
}) => {
  const role = isAtendenteTecnico
    ? 'psicologo'
    : isAtendenteCadUnico
      ? 'cadunico'
      : 'recepcao';
  const expediente = (statusExpediente === 'online' || statusExpediente === 'ocupado' || statusExpediente === 'pausa') ? 'aberto' : 'fechado';
  
  // Determina o status visual baseado no estado real
  let status = 'ocioso';
  
  // Safe check for atendimentoAtual
  const hasAtendimento = atendimentoAtual && atendimentoAtual.id;
  
  if (hasAtendimento) {
      // Normalizar status para minusculo
      const s = (atendimentoAtual.status || '').toLowerCase().trim();
      
      // Se o status for EXPLICITAMENTE 'chamando', mostra a tela de chamada
      if (s === 'chamando') {
          status = 'chamando';
      } else {
          // Qualquer outro status (em_atendimento), mostra o painel ativo
          status = 'ativo';
      }
  }
  
  const [timer, setTimer] = useState(0);
  const isPaused = statusExpediente === "pausa";
  const [dadosComplementaresDirty, setDadosComplementaresDirty] = useState(false);
  const localStartTimeRef = useRef(null);
  const dadosComplementaresRef = useRef(null);
  const isUsuarioDesligado = atendimentoAtual?.usuario_desligado === true;
  const podeReligar = !!(isAtendentePsicologo || isAtendenteAssistenteSocial);

  const filaTopo = useMemo(
    () => (Array.isArray(filaAguardando) ? filaAguardando.slice(0, 6) : []),
    [filaAguardando]
  );

  const outraUnidadeInfo = useMemo(() => {
    const crasAtendente = selectedAtendente?.cras_id || null;
    const crasCidadao =
      atendimentoAtual?.cidadao?.cras_id_principal ||
      atendimentoAtual?.cidadao?.cras_id ||
      atendimentoAtual?.usuario_cras_id_original ||
      atendimentoAtual?.cross_unit?.origem_cras_id ||
      null;
    const ehOutra =
      atendimentoAtual?.usuario_de_outra_unidade === true ||
      (crasAtendente && crasCidadao && String(crasAtendente) !== String(crasCidadao));
    if (!ehOutra) return null;
    const origemNome = crasUnidades?.find((c) => c?.id === crasCidadao)?.nome || "outra unidade";
    const destinoNome = crasUnidades?.find((c) => c?.id === crasAtendente)?.nome || "esta unidade";
    return { crasCidadao, crasAtendente, origemNome, destinoNome };
  }, [atendimentoAtual, selectedAtendente?.cras_id, crasUnidades]);

  const atendentesMonitor = useMemo(() => {
    if (!Array.isArray(atendentesList)) return [];
    const crasId =
      isCoordenador ? (currentUserCrasId || selectedAtendente?.cras_id || null) : (selectedAtendente?.cras_id || null);
    if (!crasId) return atendentesList;
    return atendentesList.filter((a) => String(a?.cras_id || "") === String(crasId));
  }, [atendentesList, selectedAtendente?.cras_id, isCoordenador, currentUserCrasId]);

  const safeSetTipoAcompanhamento = useCallback((next) => {
    if (isViewOnly) return;
    if (tipoAcompanhamentoLocked) return;
    setTipoAcompanhamento?.(next);
  }, [setTipoAcompanhamento, tipoAcompanhamentoLocked, isViewOnly]);

  useEffect(() => {
    if (!atendimentoAtual?.id || isViewOnly) return;
    const handler = (e) => {
      const dirtyFicha =
        dadosComplementaresDirty ||
        !!dadosComplementaresRef.current?.hasUnsavedChanges?.();
      if (!dirtyFicha) return;
      e.preventDefault();
      e.returnValue =
        "Há alterações não salvas na ficha do usuário. Salve antes de sair.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [atendimentoAtual?.id, dadosComplementaresDirty, isViewOnly]);
  
  // Persistência do Timer: Calcular baseado no timestamp do servidor
  useEffect(() => {
    let interval;
    
    // Função para atualizar o timer baseado na hora de início real
    const updateTimerFromTimestamp = () => {
        let startTime;
        if (atendimentoAtual?.hora_inicio) {
          if (atendimentoAtual.hora_inicio.toDate) {
              startTime = atendimentoAtual.hora_inicio.toDate().getTime();
          } else if (atendimentoAtual.hora_inicio instanceof Date) {
              startTime = atendimentoAtual.hora_inicio.getTime();
          } else if (typeof atendimentoAtual.hora_inicio === 'number') {
              startTime = atendimentoAtual.hora_inicio;
          }
          if (startTime) localStartTimeRef.current = null;
        }

        if (!startTime) {
          if (!localStartTimeRef.current) localStartTimeRef.current = Date.now();
          startTime = localStartTimeRef.current;
        }

        const now = Date.now();
        const diffSeconds = Math.floor((now - startTime) / 1000);
        setTimer(diffSeconds > 0 ? diffSeconds : 0);
    };

    if (status === 'ativo' && !isPaused) {
        // Atualiza imediatamente ao montar/mudar status
        updateTimerFromTimestamp();
        
        // Cria intervalo para atualizar a cada segundo
        interval = setInterval(() => {
            updateTimerFromTimestamp();
        }, 1000);
    } else {
        // Se não estiver ativo, zera o timer
        if (status !== 'ativo') {
             setTimer(0);
             localStartTimeRef.current = null;
        }
    }

    return () => clearInterval(interval);
  }, [status, isPaused, atendimentoAtual?.hora_inicio]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [showMonitor, setShowMonitor] = useState(false); // Estado para o modal de monitoramento
  const [fotoZoom, setFotoZoom] = useState(null); // Estado para o modal de foto zoom

  // Estado para Abertura de Expediente
  const [salaSelecionada, setSalaSelecionada] = useState(salaAtualId || "");
  const [forceSelectSala, setForceSelectSala] = useState(false);

  // Efeito para timer do botão Rechamar
  const [rechamarTimer, setRechamarTimer] = useState(0);
  useEffect(() => {
      let interval;
      if (atendimentoAtual?.hora_chamada && status === 'chamando') {
          const updateTimer = () => {
              let lastCallTime;
              if (atendimentoAtual.hora_chamada.toDate) {
                  lastCallTime = atendimentoAtual.hora_chamada.toDate().getTime();
              } else if (atendimentoAtual.hora_chamada instanceof Date) {
                  lastCallTime = atendimentoAtual.hora_chamada.getTime();
              } else if (typeof atendimentoAtual.hora_chamada === 'number') {
                  lastCallTime = atendimentoAtual.hora_chamada;
              }

              if (lastCallTime) {
                  const now = Date.now();
                  const diff = Math.ceil((60000 - (now - lastCallTime)) / 1000);
                  setRechamarTimer(diff > 0 ? diff : 0);
              }
          };
          
          updateTimer(); // Chama imediatamente
          interval = setInterval(updateTimer, 1000);
      } else {
          setRechamarTimer(0);
      }
      return () => clearInterval(interval);
  }, [atendimentoAtual, status]);

  // Auto-pause ao mudar de aba (REMOVIDO: Agora o timer é absoluto e não pausa visualmente)
  // O backend/hora_inicio é a verdade absoluta.
  /*
  useEffect(() => {
    const handleVisibilityChange = () => {
       // ... lógica antiga de pausa visual removida para evitar conflito com timestamp absoluto
    };
    // ...
  }, []);
  */

  // Lógica antiga de intervalo simples (REMOVIDA/SUBSTITUÍDA pela lógica acima baseada em timestamp)
  /*
  useEffect(() => {
    let interval;
    if (status === 'ativo' && expediente === 'aberto' && !isPaused) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    // ...
  }, [status, expediente, isPaused]);
  */

  // Modal states for Start and Unsaved
  const [confirmStartAction, setConfirmStartAction] = useState(null);
  const [confirmUnsavedAction, setConfirmUnsavedAction] = useState(null);

  if (statusExpediente === 'offline' || !salaAtualId || forceSelectSala) {
    if (isViewOnly) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="p-6 bg-gray-100 rounded-full">
            <MonitorPlay size={48} className="text-gray-400" />
          </div>
          <div>
            <p className="font-black text-lg text-gray-700 uppercase tracking-tight">
              {selectedAtendente?.nome} está offline
            </p>
            <p className="text-sm text-gray-500 mt-1">
              O expediente deste atendente ainda não foi iniciado.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedAtendente?.(null)}
            className="mt-4 px-6 py-2 rounded-lg border-2 border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <X size={16} />
            Selecionar outro atendente
          </button>
        </div>
      );
    }
    const handleCheckAndStart = async (salaId) => {
        // Verificação básica de horário (07:00 - 18:00) removida para Coordenador
        if (!isCoordenador) {
            const now = new Date();
            const hour = now.getHours();
            if (hour < 7 || hour >= 18) {
                 setConfirmStartAction(() => async () => {
                     setConfirmStartAction(null);
                     if (handleTrocarSala) await handleTrocarSala(salaId || salaSelecionada);
                     if (handleStatusChange) await handleStatusChange('online');
                     setForceSelectSala(false);
                 });
                 return;
            }
        }

        // AGUARDAR a troca de sala antes de mudar o status para evitar erro de validação no hook
        if (handleTrocarSala) {
            await handleTrocarSala(salaId || salaSelecionada);
        }
        
        if (handleStatusChange) {
            await handleStatusChange('online');
        }
        
        setForceSelectSala(false);
    };

    return (
        <>
          <StartExpediente 
              selectedAtendente={selectedAtendente}
              salaAtualId={salaAtualId || salaSelecionada}
              handleTrocarSala={setSalaSelecionada}
              busyAction={busyAction}
              salasParaSelecao={salasParaSelecao}
              onStart={handleCheckAndStart}
              handleStatusChange={handleStatusChange}
              setSelectedAtendente={() => {}} // Não aplicável aqui
              statusExpediente={statusExpediente}
          />
          <ConfirmDialog
              isOpen={!!confirmStartAction}
              title="Atenção"
              message="Você está tentando iniciar o expediente fora do horário comercial (07:00 - 18:00). Deseja continuar?"
              confirmText="Continuar"
              cancelText="Cancelar"
              onConfirm={confirmStartAction}
              onCancel={() => setConfirmStartAction(null)}
              type="warning"
          />
        </>
    );
  }

  const verifyUnsavedChanges = async (actionCallback) => {
      if (dadosComplementaresRef.current && dadosComplementaresRef.current.hasUnsavedChanges()) {
          setConfirmUnsavedAction(() => async () => {
              setConfirmUnsavedAction(null);
              const success = await dadosComplementaresRef.current.salvar();
              if (success && actionCallback) actionCallback();
          });
          return false; // Stop the original flow
      }
      if (actionCallback) actionCallback();
      return true;
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const guardAction = (fn) => {
    return (...args) => {
      if (isViewOnly) {
        console.warn("[ViewOnly] Ação bloqueada — modo espectador ativo.");
        return;
      }
      return fn?.(...args);
    };
  };

  const handleChamar = guardAction(() => handleChamarProximo?.());
  const handleIniciar = guardAction(() => handleIniciarAtendimento?.());
  
  const handleFinalizar = guardAction(async () => {
    // Auto-salva ficha se houver alterações pendentes (sem perguntar ao usuário)
    const hasDadosRef = !!dadosComplementaresRef.current;
    const hasUnsaved = hasDadosRef && dadosComplementaresRef.current.hasUnsavedChanges();
    console.log('[Finalizar] Iniciando...', { hasDadosRef, hasUnsaved, role });
    if (hasUnsaved) {
      console.log('[Finalizar] Auto-salvando ficha antes de finalizar...');
      const saved = await dadosComplementaresRef.current.salvar();
      console.log('[Finalizar] Resultado do auto-save:', saved);
      if (!saved) return;
    }
    await handleFinalizarAtendimento?.();
  });

  const handleAusente = guardAction(() => handleMarcarAusente?.());
  const handleRechamarAction = guardAction(() => handleRechamar?.());
  
  const handleDesligarClick = guardAction(async () => {
    verifyUnsavedChanges(() => {
      setIsModalOpen(true);
    });
  });

  const handleTransferirClick = guardAction(async () => {
    verifyUnsavedChanges(() => {
      setIsTransferModalOpen(true);
    });
  });

  const handleDesligarConfirmado = guardAction(() => {
    setIsModalOpen(false);
    handleBlockUser?.();
  });
  
  const handleTransferirConfirmado = guardAction(async (destino, atendentePreferencial) => {
    setIsTransferModalOpen(false);
    await handleTransferir?.(destino, atendentePreferencial);
  });
  
  const handleSairClick = guardAction(async () => {
    if (status !== 'ocioso') return;
    await handleStatusChange?.('offline');
  });

  const togglePause = guardAction(() => {
    const nextStatus = statusExpediente === "pausa" ? "online" : "pausa";
    // Chama a função para atualizar no Firestore
    handleStatusChange?.(nextStatus);
  });

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      
      {/* BARRA DE AVISO MODO ESPECTADOR (COORDENADOR VISUALIZANDO OUTRO) */}
      {isViewOnly && selectedAtendente && (
        <div className="px-4 py-2 rounded-lg flex items-center justify-between shadow-sm border-2 border-amber-300 bg-amber-50 text-amber-900 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <MonitorPlay size={16} className="text-amber-600 shrink-0" />
            <div className="flex flex-col">
              <span className="font-black text-[10px] uppercase tracking-widest leading-none">
                Modo Espectador — Somente Leitura
              </span>
              <span className="text-[9px] font-medium mt-0.5 text-amber-700">
                Você está visualizando o painel de <strong>{selectedAtendente?.nome}</strong>. Para atuar, acesse o seu próprio painel.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedAtendente?.(null)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[9px] font-black uppercase bg-amber-200 hover:bg-amber-300 text-amber-900 transition-colors"
            title="Sair do modo espectador"
          >
            <X size={12} />
            Sair
          </button>
        </div>
      )}

      {/* BARRA DE COMANDO SUPERIOR (O COCKPIT) */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-md sticky top-0 z-30 flex flex-wrap justify-between items-center gap-3">
         <div className="flex items-center gap-3 min-w-fit">
            <div className={`flex flex-col items-center px-4 py-2 rounded-xl border transition-colors ${status === 'ativo' ? 'bg-slate-900 border-slate-700' : 'bg-gray-100 border-gray-200'}`}>
               <span className={`text-[8px] font-bold uppercase tracking-widest leading-none mb-0.5 ${status === 'ativo' ? 'text-slate-400' : 'text-gray-400'}`}>Duração</span>
               <span className={`text-2xl font-mono font-black leading-none tabular-nums ${status === 'ativo' ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {loadingAtual ? '--:--' : formatTime(timer)}
               </span>
            </div>
            <div className="flex flex-col gap-1">
               {(() => {
                  const pill = status === 'ativo'
                     ? { label: 'Em Atendimento', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500 animate-pulse' }
                     : status === 'chamando'
                     ? { label: 'Chamando…',      cls: 'bg-blue-100 text-blue-800 border-blue-300',     dot: 'bg-blue-500 animate-bounce' }
                     : expediente === 'aberto'
                     ? { label: 'Guichê Livre',   cls: 'bg-sky-100 text-sky-800 border-sky-300',        dot: 'bg-sky-400' }
                     : { label: 'Turno Fechado',  cls: 'bg-gray-100 text-gray-600 border-gray-300',     dot: 'bg-gray-400' };
                  return (
                     <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${pill.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pill.dot}`} />
                        {pill.label}
                     </span>
                  );
               })()}
               {selectedAtendente && salaAtualId && (
                  <span className="text-[9px] text-gray-500 font-medium pl-1 truncate max-w-[180px]">
                     {selectedAtendente.nome} · {getSalaNome(salaAtualId)}
                  </span>
               )}
            </div>
            
            {/* BOTÕES EXTRAS COORDENADOR */}
            {isCoordenador && (
               <div className="flex gap-2 ml-2 border-l pl-2 border-gray-200">
                  <Button 
                    variant="dark" 
                    icon={Users} 
                    onClick={() => setShowMonitor(true)}
                    className="h-full"
                    title="Ver status de todos os atendentes"
                    aria-label="Abrir monitoramento de equipe"
                  >
                    Monitorar Equipe
                  </Button>
               </div>
            )}
         </div>

         <div className="flex flex-wrap items-center gap-2">
            {expediente === 'fechado' ? (
               <Button variant="success" icon={Play} onClick={() => handleStatusChange && handleStatusChange('online')} className="px-8 py-3" aria-label="Iniciar expediente">Iniciar Expediente</Button>
            ) : (
               <div className="flex flex-wrap gap-1.5">
                  {status === 'ocioso' && (
                     <>
                        <Button
                           variant="primary"
                           icon={Volume2}
                           onClick={handleChamar}
                           disabled={!filaAguardando?.length}
                           className={`min-w-[150px] transition-all ${filaAguardando?.length > 0 ? 'animate-pulse shadow-md shadow-blue-200' : 'opacity-60'}`}
                           aria-label="Chamar próximo da fila"
                        >
                           {filaAguardando?.length > 0
                              ? `Chamar Próximo (${filaAguardando.length})`
                              : 'Fila Vazia'}
                        </Button>
                        <Button 
                           variant={isPaused ? "primary" : "secondary"} 
                           icon={isPaused ? PlayCircle : PauseCircle} 
                           onClick={togglePause}
                           disabled={status !== 'ocioso'}
                           title={status !== 'ocioso' ? "Finalize o atendimento antes de pausar" : (isPaused ? "Retomar turno" : "Pausar turno")}
                           aria-label={isPaused ? "Retomar turno" : "Pausar turno"}
                        >
                           {isPaused ? "Retomar" : "Pausar"}
                        </Button>
                        
                        {isCoordenador && toggleTestMode && (
                           <Button 
                             variant={isTestMode ? "warning" : "secondary"} 
                             icon={Stethoscope} 
                             onClick={toggleTestMode}
                             title="Ativar Modo Teste (Sandbox)"
                             aria-label={isTestMode ? "Desativar modo teste" : "Ativar modo teste"}
                           >
                             {isTestMode ? "TESTE ATIVO" : "Teste"}
                           </Button>
                        )}
                     </>
                  )}
                  {/* Status chamando (quando o atendimento atual está no status 'chamando') */}
                  {status === 'chamando' && (
                     <>
                        <Button variant="success" icon={PlayCircle} onClick={handleIniciar} aria-label="Iniciar atendimento">Iniciar Atendimento</Button>
                        <div className="flex flex-col items-center gap-0.5">
                           <Button
                              variant="secondary"
                              icon={Repeat}
                              onClick={handleRechamarAction}
                              disabled={rechamarTimer > 0}
                              aria-label={rechamarTimer > 0 ? `Aguarde ${rechamarTimer}s` : "Rechamar na TV"}
                              className={rechamarTimer > 0 ? 'opacity-60' : ''}
                           >
                              {rechamarTimer > 0 ? `Aguardar ${rechamarTimer}s` : 'Rechamar'}
                           </Button>
                           {rechamarTimer > 0 && (
                              <div className="w-full h-0.5 bg-gray-200 rounded-full overflow-hidden">
                                 <div
                                    className="h-full bg-blue-400 rounded-full transition-all duration-1000"
                                    style={{ width: `${((60 - rechamarTimer) / 60) * 100}%` }}
                                 />
                              </div>
                           )}
                        </div>
                        <Button variant="warning" icon={UserX} onClick={handleAusente} aria-label="Marcar como ausente">Ausente</Button>
                     </>
                  )}
                  {/* Status ativo (em atendimento) */}
                  {status === 'ativo' && (
                     <>
                        {new Date().getHours() >= 18 && (
                          <p className="col-span-full text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-center gap-1">
                            <Clock size={12} /> Após 20h o sistema finaliza automaticamente com os dados preenchidos. Salve o rascunho e finalize antes para evitar perda de dados.
                          </p>
                        )}
                        <Button variant="transfer" icon={ArrowRightLeft} onClick={handleTransferirClick} aria-label="Transferir para outro setor">Transferir</Button>
                        {isAtendenteTecnico && (
                          <Button variant="danger" icon={Power} onClick={handleDesligarClick} aria-label="Desligar usuário">Desligar</Button>
                        )}
                        <Button variant="success" icon={CheckCircle2} onClick={handleFinalizar} className="px-6" aria-label="Finalizar atendimento">Finalizar</Button>
                     </>
                  )}
                  <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block"></div>
                  <Button variant="secondary" icon={MapPin} onClick={() => setForceSelectSala(true)} title="Mudar de sala" aria-label="Trocar sala de atendimento">Trocar Sala</Button>
                  <Button variant="dark" icon={LogOut} onClick={handleSairClick} disabled={status !== 'ocioso'} title="Encerrar turno" aria-label="Encerrar expediente e sair">Sair</Button>
               </div>
            )}
         </div>
      </div>

      {atendimentoAtual && (outraUnidadeInfo || isUsuarioDesligado) && (
        <DesfechoEspecialPanel
          atendimentoAtual={atendimentoAtual}
          selectedAtendente={selectedAtendente}
          crasUnidades={crasUnidades}
          outraUnidadeInfo={isUsuarioDesligado ? null : outraUnidadeInfo}
          onReligarETransferir={guardAction(handleReligarETransferir)}
          onReceberNaUnidade={guardAction(handleReceberNaUnidade)}
          canReligar={podeReligar}
          busyAction={busyAction}
          isViewOnly={isViewOnly}
        />
      )}

      {visitaEsporadicaAlerta && hasAtendimento && (status === "ativo" || status === "chamando") && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg shrink-0">
              <AlertTriangle size={18} className="text-amber-700" />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm uppercase tracking-wide text-amber-900">
                Alerta: Visita em Outra Unidade
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Este usuário foi atendido em{" "}
                <strong>{visitaEsporadicaAlerta.unidade_nome || "outra unidade"}</strong> em{" "}
                {visitaEsporadicaAlerta.data
                  ? new Date(visitaEsporadicaAlerta.data).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "---"}{" "}
                por <strong>{visitaEsporadicaAlerta.atendente_nome || "técnico"}</strong>.
              </p>
              {visitaEsporadicaAlerta.obs && (
                <div className="mt-2 p-2 bg-white rounded border border-amber-200">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">
                    Observação deixada
                  </p>
                  <p className="text-xs text-gray-700 italic">"{visitaEsporadicaAlerta.obs}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6">
         {/* COLUNA ESQUERDA: CONTEXTO */}
         <div className="w-full xl:w-[320px] space-y-4 shrink-0">
            <Card title="Usuário em Atendimento" icon={UserCircle}>
               {(status === 'ativo' || status === 'chamando') && atendimentoAtual ? (
                  <div className="text-center animate-in slide-in-from-left-2 duration-300">
                     <div className="relative w-32 h-32 mx-auto mb-3 group cursor-pointer" onClick={() => atendimentoAtual.cidadao?.fotoUrl && setFotoZoom(fixFirebaseStorageUrl(atendimentoAtual.cidadao.fotoUrl))}>
                        {atendimentoAtual.cidadao?.fotoUrl ? (
                           <>
                              <img 
                                src={fixFirebaseStorageUrl(atendimentoAtual.cidadao.fotoUrl)} 
                                alt="Foto do Cidadão" 
                                className="w-full h-full object-cover rounded-full border-4 border-blue-100 shadow-md"
                                onError={(e) => {
                                  e.target.onerror = null; 
                                  e.target.src = `https://ui-avatars.com/api/?name=${getNomeCidadao(atendimentoAtual)}&background=0D8ABC&color=fff&size=128`;
                                }}
                              />
                              <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Maximize2 className="text-white" />
                              </div>
                           </>
                        ) : (
                           <div className="w-full h-full bg-gray-100 rounded-full border-4 border-blue-50 flex items-center justify-center text-3xl font-black text-gray-300 shadow-sm">
                              {atendimentoAtual.cidadao?.nome ? atendimentoAtual.cidadao.nome.substring(0,2).toUpperCase() : "MO"}
                           </div>
                        )}
                     </div>
                     <h2 className="text-sm font-black text-gray-800 uppercase tracking-tighter leading-tight">
                        {getNomeCidadao(atendimentoAtual)}
                     </h2>
                     <p className="text-[9px] text-blue-600 font-bold uppercase mt-1">
                        CPF: {atendimentoAtual.cidadao?.cpf || "---"}
                     </p>
                     {(atendimentoAtual.cidadao?.naturalidade || atendimentoAtual.cidadao?.uf) && (
                        <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">
                           {atendimentoAtual.cidadao?.naturalidade} - {atendimentoAtual.cidadao?.uf}
                        </p>
                     )}
                  </div>
               ) : (
                  <div className="py-10 text-center text-[9px] font-black uppercase tracking-widest leading-none flex flex-col items-center gap-2 opacity-50">
                     {status === 'chamando' ? (
                        <>
                           <Loader size={32} className="animate-spin text-blue-500" />
                           <span>Chamando...</span>
                        </>
                     ) : (
                        <span>Guichê Livre</span>
                     )}
                  </div>
               )}
            </Card>

            {/* HISTÓRICO DAS ÚLTIMAS 3 OBSERVAÇÕES DO CIDADÃO */}
            {(status === 'ativo' || status === 'chamando') && atendimentoAtual?.cidadao?.cpf && (
              <UltimasObservacoes
                cpf={atendimentoAtual.cidadao.cpf}
                currentAtendimentoId={atendimentoAtual.id}
                atendentesList={atendentesList}
                crasUnidades={crasUnidades}
              />
            )}

            <Card title="Fila de Espera" icon={Users} badge={filaAguardando ? filaAguardando.length.toString().padStart(2, '0') : "00"}>
               {isViewOnly && (
                 <p className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2 flex items-center gap-1">
                   <MonitorPlay size={10} />
                   Fila ao vivo de {selectedAtendente?.nome}
                 </p>
               )}
               <div className="space-y-1.5">
                  {filaTopo.length > 0 ? filaTopo.map((item, i) => {
                     const isTransfer = !!(item.hora_transferencia || item.atendente_id_anterior);
                     const isPrio = item.cidadao?.prioridade && item.cidadao.prioridade !== 'Nenhuma';
                     const nomeCidadao = item.cidadao?.nomeSocial || item.cidadao?.nome || 'Cidadão';
                     const fotoCidadao = item.cidadao?.fotoUrl || item.cidadao?.foto || null;
                     const iniciais = String(nomeCidadao)
                       .trim()
                       .split(/\s+/)
                       .filter(Boolean)
                       .slice(0, 2)
                       .map((p) => p[0])
                       .join("")
                       .toUpperCase();
                     return (
                        <div key={item.id || i} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border text-[10px] transition-colors ${
                           isPrio    ? 'bg-red-50 border-red-200' :
                           isTransfer? 'bg-purple-50 border-purple-200' :
                           i === 0   ? 'bg-blue-50 border-blue-200' :
                                       'bg-white border-gray-200'
                        }`}>
                           <span className={`w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center shrink-0 mt-px ${
                              isPrio     ? 'bg-red-500 text-white' :
                              isTransfer ? 'bg-purple-500 text-white' :
                              i === 0    ? 'bg-blue-600 text-white' :
                                           'bg-gray-200 text-gray-600'
                           }`}>{i + 1}</span>
                           <div className="w-7 h-7 rounded-full overflow-hidden border border-gray-200 bg-gray-100 shrink-0">
                             {fotoCidadao ? (
                               <img
                                 src={fotoCidadao}
                                 alt={nomeCidadao}
                                 className="w-full h-full object-cover"
                                 loading="lazy"
                                 referrerPolicy="no-referrer"
                               />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center text-[9px] font-black text-gray-600">
                                 {iniciais || "?"}
                               </div>
                             )}
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 truncate leading-tight">
                                 {nomeCidadao}
                              </p>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                 <span className="text-gray-400 flex items-center gap-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    {getWaitMinutes(item.hora_chegada)}
                                 </span>
                                 {isTransfer && (
                                    <span className="bg-purple-100 text-purple-700 border border-purple-200 px-1 py-px rounded font-bold" style={{fontSize:'8px'}}>
                                       ⇄ Transf.
                                    </span>
                                 )}
                                 {isPrio && (
                                    <span className="bg-red-100 text-red-600 border border-red-200 px-1 py-px rounded font-bold" style={{fontSize:'8px'}}>
                                       ★ Prior.
                                    </span>
                                 )}
                              </div>
                           </div>
                        </div>
                     );
                  }) : (
                     <div className="text-gray-400 text-center py-4 text-[10px] font-medium">Fila vazia</div>
                  )}
                  {(filaAguardando?.length || 0) > 6 && (
                     <p className="text-center text-[9px] text-gray-400 pt-1">
                        +{filaAguardando.length - 6} na fila
                     </p>
                  )}
               </div>
            </Card>
         </div>

         {/* COLUNA DIREITA: FORMULÁRIO RMA RIGOROSO */}
         <div className={`flex-1 ${isViewOnly ? "opacity-60 pointer-events-none" : ""}`}>
            {status === 'ativo' ? (
               <div className="animate-in slide-in-from-bottom-2 duration-400 space-y-4">
                  
                  {/* RMA INDIVIDUAL (PSICÓLOGO) */}
                  {!isObservacaoOnly && role === 'psicologo' && !isAtendenteCadUnico && (
                    <>
                      {/* NOVO CAMPO: SELEÇÃO DE TIPO (TOPO) */}
                      <Card title="Classificação do Atendimento" icon={UserPlus} className={`border-l-4 transition-all ${!tipoAcompanhamento ? 'border-red-500 bg-red-50 ring-2 ring-red-100 ring-offset-2' : 'border-blue-500 bg-white'}`}>
                        <div className="space-y-3">
                           <div className="flex flex-col sm:flex-row gap-4">
                              <label className={`flex-1 relative cursor-pointer group`}>
                                 <input 
                                    type="radio" 
                                    name="tipoAcompanhamento" 
                                    value="novo" 
                                    checked={tipoAcompanhamento === 'novo'} 
                                    onChange={() => safeSetTipoAcompanhamento('novo')}
                                    className="peer sr-only"
                                    disabled={isViewOnly || !!tipoAcompanhamentoLocked}
                                 />
                                 <div className="p-4 rounded-lg border-2 border-gray-200 bg-white hover:bg-gray-50 peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 transition-all flex items-center justify-center gap-3 h-full">
                                    <UserPlus size={24} className="text-gray-400 peer-checked:text-blue-600" />
                                    <div className="flex flex-col items-start">
                                       <span className="font-black uppercase text-sm tracking-wide">Usuário Novo</span>
                                    </div>
                                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full border border-gray-300 peer-checked:border-blue-500 peer-checked:bg-blue-500 flex items-center justify-center transition-colors">
                                       <div className="w-1.5 h-1.5 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
                                    </div>
                                 </div>
                              </label>

                              <label className={`flex-1 relative cursor-pointer group`}>
                                 <input 
                                    type="radio" 
                                    name="tipoAcompanhamento" 
                                    value="acompanhamento" 
                                    checked={tipoAcompanhamento === 'acompanhamento'} 
                                    onChange={() => safeSetTipoAcompanhamento('acompanhamento')}
                                    className="peer sr-only"
                                    disabled={isViewOnly || !!tipoAcompanhamentoLocked}
                                 />
                                 <div className="p-4 rounded-lg border-2 border-gray-200 bg-white hover:bg-gray-50 peer-checked:border-green-500 peer-checked:bg-green-50 peer-checked:text-green-700 transition-all flex items-center justify-center gap-3 h-full">
                                    <History size={24} className="text-gray-400 peer-checked:text-green-600" />
                                    <div className="flex flex-col items-start">
                                       <span className="font-black uppercase text-sm tracking-wide">Acompanhamento</span>
                                    </div>
                                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full border border-gray-300 peer-checked:border-green-500 peer-checked:bg-green-500 flex items-center justify-center transition-colors">
                                       <div className="w-1.5 h-1.5 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
                                    </div>
                                 </div>
                              </label>
                           </div>
                           {!tipoAcompanhamento && (
                              <div className="flex items-center gap-2 text-red-600 text-xs font-bold bg-red-100 p-2 rounded animate-pulse">
                                 <AlertCircle size={14} />
                                 Seleção Obrigatória: Indique se é Usuário Novo ou Acompanhamento para finalizar.
                              </div>
                           )}
                           {!!tipoAcompanhamentoLocked && !!tipoAcompanhamento && (
                              <div className="flex items-center gap-2 text-gray-700 text-xs font-bold bg-gray-100 p-2 rounded">
                                 <Lock size={14} />
                                 Definido por outro profissional. Apenas quem definiu pode alterar.
                              </div>
                           )}
                        </div>
                      </Card>

                      <FichaAtendimentoTecnico
                        ref={dadosComplementaresRef}
                        atendimentoAtual={atendimentoAtual}
                        rmaData={rmaData}
                        setRmaData={setRmaData}
                        crasUnidades={crasUnidades}
                        onSaveSuccess={() => {}}
                        onDirtyChange={setDadosComplementaresDirty}
                      />
                    </>
                  )}

                  {role === 'psicologo' ? (
                     <div className="space-y-4">
                        {/* EVOLUÇÃO */}
                        <Card title="Evolução Técnica / Diário de Atendimento" icon={FileText}>
                           <textarea 
                                className={`w-full h-32 p-3 bg-gray-50 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-600 shadow-inner resize-none font-medium ${isViewOnly ? "opacity-60 cursor-not-allowed bg-gray-50" : ""}`} 
                                placeholder={isViewOnly ? "Observações do atendente (somente leitura)" : "Relato técnico do atendimento..."}
                                value={observacoes}
                                onChange={(e) => !isViewOnly && setObservacoes(e.target.value)}
                                disabled={isViewOnly}
                           ></textarea>
                           {!isViewOnly && (
                             <div className="mt-2 flex justify-end">
                                  <Button variant="secondary" icon={Save} onClick={salvarRascunhoNoSistema} disabled={draftServerSaving}>
                                      {draftServerSaving ? "Salvando..." : "Salvar Rascunho"}
                                  </Button>
                             </div>
                           )}
                        </Card>
                     </div>
                  ) : (
                     <Card title="Gestão Cadastro Único - Ações Administrativas" icon={Database} className="border-t-4 border-cyan-700">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                           {[
                              {
                                 value: "consulta", 
                                 l:'Consulta', 
                                 i:Search, 
                                 c:'text-blue-700 bg-blue-50 border-blue-200',
                                 desc: 'Apenas consulta de dados. Não gera contagem de atualização no RMA.'
                              },
                              {
                                 value: "inclusao", 
                                 l:'Inclusão (C.1)', 
                                 i:UserPlus, 
                                 c:'text-green-700 bg-green-50 border-green-200',
                                 desc: 'C.1. Pessoas que foram incluídas no Cadastro Único para Programas Sociais, no mês'
                              },
                              {
                                 value: "recadastro", 
                                 l:'Atualização (C.2)', 
                                 i:FileCheck, 
                                 c:'text-cyan-700 bg-cyan-50 border-cyan-200',
                                 desc: 'C.2. Pessoas que realizaram atualização do Cadastro Único para Programas Sociais, no mês'
                              },
                              {
                                 value: "transferencia", 
                                 l:'Transferência', 
                                 i:ArrowRightLeft, 
                                 c:'text-orange-700 bg-orange-50 border-orange-200',
                                 desc: 'Transferência de município. Conta como atualização (C.2) se houver alteração cadastral.'
                              }
                           ].map((a, i) => {
                              const ActionIcon = a.i;
                              const isSelected = cadunicoAcoes.includes(a.value);
                              return (
                                 <button 
                                    key={i} 
                                    type="button"
                                    disabled={isViewOnly}
                                    onClick={() => {
                                      if (isViewOnly) return;
                                      setCadunicoAcoes((prev) =>
                                        prev.includes(a.value)
                                          ? prev.filter((v) => v !== a.value)
                                          : [...prev, a.value]
                                      );
                                    }}
                                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-105 h-32 shadow-sm ${a.c} ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''} ${isViewOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    title={a.desc}
                                 >
                                    <ActionIcon size={32} />
                                    <span className="text-[9px] font-black uppercase text-center">{a.l}</span>
                                    {/* Exibir descrição simplificada apenas se selecionado ou no hover (via title nativo já resolve a dúvida) */}
                                 </button>
                              );
                           })}
                        </div>
                        {/* Benefícios cadastrais — Section 4 do RMA, parte CadÚnico */}
                        <div className="border-t border-gray-200 pt-4 mt-2 mb-4">
                           <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                              Benefícios cadastrais identificados
                           </p>
                           <p className="text-[10px] text-gray-400 italic mb-3">
                              Marque se este(a) usuário(a) já é beneficiário(a) destes programas. Atualizado a cada atendimento.
                           </p>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <label className={`flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                 rmaData?.beneficio_bolsa_familia
                                    ? 'bg-cyan-50 border-cyan-400 ring-1 ring-cyan-200'
                                    : 'bg-white border-gray-200 hover:border-cyan-200'
                              }`}>
                                 <input
                                    type="checkbox"
                                    checked={!!rmaData?.beneficio_bolsa_familia}
                                    disabled={isViewOnly}
                                    onChange={(e) => {
                                      if (isViewOnly) return;
                                      setRmaData((p) => ({ ...p, beneficio_bolsa_familia: e.target.checked }));
                                    }}
                                    className="w-5 h-5 mt-0.5 text-cyan-600 rounded focus:ring-2 focus:ring-cyan-500 cursor-pointer shrink-0"
                                 />
                                 <div className="flex-1">
                                    <span className={`block text-xs font-bold ${rmaData?.beneficio_bolsa_familia ? 'text-cyan-900' : 'text-gray-700'}`}>
                                       Programa Bolsa Família
                                    </span>
                                    <span className="text-[10px] text-gray-500 leading-tight">
                                       Recebe transferência de renda condicionada
                                    </span>
                                 </div>
                              </label>

                              <label className={`flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                 rmaData?.beneficio_bpc
                                    ? 'bg-cyan-50 border-cyan-400 ring-1 ring-cyan-200'
                                    : 'bg-white border-gray-200 hover:border-cyan-200'
                              }`}>
                                 <input
                                    type="checkbox"
                                    checked={!!rmaData?.beneficio_bpc}
                                    disabled={isViewOnly}
                                    onChange={(e) => {
                                      if (isViewOnly) return;
                                      setRmaData((p) => ({ ...p, beneficio_bpc: e.target.checked }));
                                    }}
                                    className="w-5 h-5 mt-0.5 text-cyan-600 rounded focus:ring-2 focus:ring-cyan-500 cursor-pointer shrink-0"
                                 />
                                 <div className="flex-1">
                                    <span className={`block text-xs font-bold ${rmaData?.beneficio_bpc ? 'text-cyan-900' : 'text-gray-700'}`}>
                                       BPC
                                    </span>
                                    <span className="text-[10px] text-gray-500 leading-tight">
                                       Benefício de Prestação Continuada (LOAS)
                                    </span>
                                 </div>
                              </label>
                           </div>
                        </div>
                        <textarea 
                            className="w-full h-32 p-3 bg-gray-50 border border-gray-300 rounded text-sm resize-none shadow-inner" 
                            placeholder={isViewOnly ? "Observações do CadÚnico (somente leitura)..." : "Observações do CadÚnico..."}
                            value={cadunicoObs}
                            disabled={isViewOnly}
                            onChange={(e) => {
                              if (isViewOnly) return;
                              setCadunicoObs(e.target.value);
                            }}
                        ></textarea>
                     </Card>
                  )}
               </div>
            ) : (
               <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded border-2 border-dashed border-gray-200 opacity-40">
                  <div className="p-8 bg-gray-100 rounded-full mb-4"><MonitorPlay size={48} className="text-gray-300" /></div>
                  <h3 className="text-xl font-black text-gray-400 uppercase tracking-tighter leading-none">Guichê Disponível</h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-2 italic">Aguardando início de atendimento</p>
               </div>
            )}
         </div>
      </div>

      <DesligamentoModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onConfirm={handleDesligarConfirmado} 
        cidadao={atendimentoAtual?.cidadao}
        blockReason={blockReason}
        blockDate={blockDate}
        blockTecnico={blockTecnico}
        setBlockReason={setBlockReason}
        setBlockDate={setBlockDate}
        setBlockTecnico={setBlockTecnico}
      />

      <TransferenciaModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onConfirm={handleTransferirConfirmado}
        atendentesList={atendentesList}
        crasUnidades={crasUnidades}
        currentCrasId={selectedAtendente?.cras_id || null}
      />

      <FotoZoomModal 
         isOpen={!!fotoZoom}
         onClose={() => setFotoZoom(null)}
         imgSrc={fotoZoom}
         nome={atendimentoAtual?.cidadao?.nome}
      />
      
      {/* MODAL MONITORAMENTO EQUIPE */}
      {showMonitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col">
              <div className="p-4 bg-gray-900 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3">
                    <Users size={20} className="text-blue-400" />
                    <div>
                       <h2 className="text-lg font-bold uppercase tracking-wide">Monitoramento de Equipe</h2>
                       <p className="text-xs text-gray-400">Visão geral em tempo real</p>
                    </div>
                 </div>
                 <button onClick={() => setShowMonitor(false)} className="p-1 hover:bg-gray-700 rounded transition-colors"><X size={20} /></button>
              </div>
              
              <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                 {(!atendentesMonitor || atendentesMonitor.length === 0) ? (
                    <div className="text-center py-10 text-gray-500">Nenhum atendente encontrado.</div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {atendentesMonitor.map(at => {
                          const THRESHOLD = 15 * 60 * 1000;
                          const lsRaw = at?.last_seen;
                          const lsMs =
                            lsRaw?.toMillis?.() ??
                            lsRaw?.toDate?.()?.getTime?.() ??
                            (typeof lsRaw === "number" ? lsRaw : 0);
                          const isStale = lsMs > 0 && Date.now() - lsMs > THRESHOLD;
                          const trueStatus = isStale ? "offline" : (at.status || "offline");
                          const minutosDesdeVisto = lsMs > 0 ? Math.floor((Date.now() - lsMs) / 60000) : null;

                          const statusInfo =
                            trueStatus === 'online'  ? { label: 'Online',         color: 'bg-green-100 text-green-700 border-green-200' } :
                            trueStatus === 'ocupado' ? { label: 'Em Atendimento', color: 'bg-blue-100 text-blue-700 border-blue-200'   } :
                            trueStatus === 'pausa'   ? { label: 'Pausa',          color: 'bg-yellow-100 text-yellow-700 border-yellow-200' } :
                                                       { label: 'Offline',        color: 'bg-gray-100 text-gray-500 border-gray-200'   };
                          
                          return (
                             <div key={at.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                                <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase rounded-bl-lg border-b border-l ${statusInfo.color}`}>
                                   {statusInfo.label}
                                </div>
                                
                                <div className="flex items-center gap-3 mb-3 mt-2">
                                   <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                                      {at.nome?.charAt(0)}
                                   </div>
                                   <div>
                                      <h3 className="font-bold text-gray-800 leading-tight">{at.nome}</h3>
                                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{at.cargo || 'Cargo n/d'}</p>
                                   </div>
                                </div>
                                
                                <div className="space-y-2">
                                   <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
                                      <span className="text-gray-500">Unidade</span>
                                      <span className="font-medium text-gray-700">
                                         {crasUnidades?.find(c => c.id === at.cras_id)?.nome || 'N/D'}
                                      </span>
                                   </div>
                                   
                                   {at.guiche && (
                                      <div className="flex justify-between items-center text-xs">
                                         <span className="text-gray-500">Guichê / Sala</span>
                                         <span className="font-medium text-gray-700">Sala {at.guiche}</span>
                                      </div>
                                   )}
                                </div>
                                
                                {minutosDesdeVisto !== null && (
                                  <div className={`mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] ${
                                    minutosDesdeVisto <= 5  ? 'text-green-600' :
                                    minutosDesdeVisto <= 14 ? 'text-amber-600' :
                                                             'text-red-500'
                                  }`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    {minutosDesdeVisto === 0 ? 'Visto agora' : `Visto há ${minutosDesdeVisto} min`}
                                    {isStale && (
                                      <span className="ml-auto bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded font-bold" style={{fontSize:'8px'}}>
                                        INATIVO
                                      </span>
                                    )}
                                  </div>
                                )}
                             </div>
                          );
                       })}
                    </div>
                 )}
              </div>
              <div className="p-4 bg-white border-t border-gray-200 text-right">
                 <Button variant="secondary" onClick={() => setShowMonitor(false)}>Fechar</Button>
              </div>
           </div>
        </div>
      )}
      
      <ConfirmDialog
        isOpen={!!confirmUnsavedAction}
        title="Alterações não salvas"
        message="Existem dados NÃO SALVOS no formulário de Dados Complementares!\n\nDeseja SALVAR as alterações antes de continuar?"
        confirmText="Salvar e Continuar"
        cancelText="Cancelar"
        onConfirm={confirmUnsavedAction}
        onCancel={() => setConfirmUnsavedAction(null)}
        type="warning"
      />
    </div>
  );
};

export default PainelAtendimento;

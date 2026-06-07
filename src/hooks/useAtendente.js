import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  query,
  collection,
  where,
  onSnapshot,
  runTransaction,
  getDoc,
  getDocs,
  limit,
  orderBy,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { getNomeCidadao, parseFlexibleDate, simplify, normalizeRole, getFriendlyFirebaseError } from "../utils";

export const useAtendente = ({
  crasUnidades,
  tiposAtendimento,
  atendentesList,
  salasAtendimento,
}) => {
  const { db, appId, user, userProfile } = useAuth();
  
  const [selectedAtendente, setSelectedAtendente] = useState(null);
  const [salaAtualId, setSalaAtualId] = useState("");
  const [statusExpediente, setStatusExpediente] = useState("offline");
  const [expedienteBloqueadoAte, setExpedienteBloqueadoAte] = useState(null);
  const [filaAguardando, setFilaAguardando] = useState([]);
  const [atendimentoAtual, setAtendimentoAtual] = useState(null);
  const [observacoes, setObservacoes] = useState("");
  const [cadunicoAcoes, setCadunicoAcoes] = useState([]);
  const [cadunicoObs, setCadunicoObs] = useState("");
  const [rmaData, setRmaData] = useState({}); // Estado para o formulário RMA
  const [loadingFila, setLoadingFila] = useState(false);
  const [loadingAtual, setLoadingAtual] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [visitaEsporadicaAlerta, setVisitaEsporadicaAlerta] = useState(null);
  
  // Estado para Tipo de Acompanhamento (Psicólogo) - Novo/Acompanhamento
  const [tipoAcompanhamento, setTipoAcompanhamento] = useState(null); // 'novo' | 'acompanhamento'
  const [tipoAcompanhamentoLocked, setTipoAcompanhamentoLocked] = useState(false);

  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [alertExpedienteMostrado, setAlertExpedienteMostrado] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [uiError, setUiError] = useState(null);
  const [migrationError, setMigrationError] = useState(null);
  const [filaBusca, setFilaBusca] = useState("");
  const [previewFilaItem, setPreviewFilaItem] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [draftServerSaving, setDraftServerSaving] = useState(false);
  const [draftServerError, setDraftServerError] = useState(null);
  
  // Estado para Bloqueio de Usuário (Psicólogo)
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockDate, setBlockDate] = useState(new Date().toLocaleDateString('pt-BR'));
  const [blockTecnico, setBlockTecnico] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);

  const atendimentoAtualIdRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const roleNormComputed = useMemo(() => {
    return normalizeRole(
      userProfile?.roleNorm || userProfile?.role || selectedAtendente?.cargo || ""
    );
  }, [userProfile, selectedAtendente?.cargo]);

  const isGestor = useMemo(() => {
    return (
      !!roleNormComputed &&
      ["coordenador", "superintendente", "admin", "master", "super_admin"].includes(
        roleNormComputed
      )
    );
  }, [roleNormComputed]);

  const isCoordenador = useMemo(() => roleNormComputed === "coordenador", [roleNormComputed]);

  const isViewOnly = useMemo(() => {
    if (!isGestor) return false;
    if (!selectedAtendente) return false;
    const myIds = [userProfile?.id, userProfile?.uid, user?.uid]
      .filter(Boolean)
      .map((v) => String(v));
    const selId = String(selectedAtendente?.id || "");
    const selUid = String(selectedAtendente?.uid || "");
    const isOwn = myIds.includes(selId) || myIds.includes(selUid);
    return !isOwn;
  }, [isGestor, selectedAtendente, userProfile, user?.uid]);

  const selectedAtendenteRole = useMemo(() => {
    if (!selectedAtendente) return null;
    return normalizeRole(selectedAtendente.cargo || selectedAtendente.role || "");
  }, [selectedAtendente]);

  const isSelectedAtendenteCoordenador = useMemo(() => {
    return selectedAtendenteRole === "coordenador";
  }, [selectedAtendenteRole]);

  const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;
  const getAtendenteTrueStatus = useCallback(
    (atendente) => {
      const raw = atendente?.status || "offline";
      if (!["online", "ocupado", "pausa"].includes(raw)) return raw;
      const ls = atendente?.last_seen;
      if (!ls) return "offline";
      const ms =
        typeof ls?.toMillis === "function"
          ? ls.toMillis()
          : typeof ls?.toDate === "function"
          ? ls.toDate().getTime()
          : typeof ls === "number"
          ? ls
          : 0;
      if (!ms) return "offline";
      return Date.now() - ms > ONLINE_THRESHOLD_MS ? "offline" : raw;
    },
    [ONLINE_THRESHOLD_MS]
  );

  const collectionPath = `artifacts/${appId}/public/data/atendimentos`;

  const tipoById = useMemo(() => {
    const m = new Map();
    (tiposAtendimento || []).forEach((t) => {
      if (t && t.id) m.set(t.id, t);
    });
    return m;
  }, [tiposAtendimento]);

  const isAtendentePsicologo = useMemo(() => {
    const cargo = (selectedAtendente?.cargo || "").toLowerCase();
    const tipo = (selectedAtendente?.tipo || "").toLowerCase();
    return cargo.includes("psic") || tipo.includes("psic");
  }, [selectedAtendente]);

  const isAtendenteAssistenteSocial = useMemo(() => {
    const cargo = (selectedAtendente?.cargo || "").toLowerCase();
    const tipo = (selectedAtendente?.tipo || "").toLowerCase();
    return (
      cargo.includes("assistente social") ||
      cargo.includes("servico social") ||
      cargo.includes("serviço social") ||
      tipo.includes("assistente social") ||
      tipo.includes("servico social") ||
      tipo.includes("serviço social")
    );
  }, [selectedAtendente]);

  const isAtendenteTecnico = useMemo(() => {
    return isAtendentePsicologo || isAtendenteAssistenteSocial;
  }, [isAtendentePsicologo, isAtendenteAssistenteSocial]);

  const isCadUnicoAtual = useMemo(() => {
    if (!atendimentoAtual) return false;
    const t = tipoById.get(atendimentoAtual.tipo_atendimento_id);
    const n = (t?.nome || "").toLowerCase();
    return n.includes("cad") || n.includes("único");
  }, [atendimentoAtual, tipoById]);

  const cadUnicoTypeIds = useMemo(() => {
    return (tiposAtendimento || [])
      .filter((t) => {
        const n = (t?.nome || "").toLowerCase();
        return n.includes("cad") || n.includes("único");
      })
      .map((t) => t.id);
  }, [tiposAtendimento]);

  const cadUnicoTypeId = useMemo(() => {
    const t = (tiposAtendimento || []).find((x) => {
      const n = (x?.nome || "").toLowerCase();
      return n.includes("cad") || n.includes("único");
    });
    return t?.id || null;
  }, [tiposAtendimento]);

  const psicTypeId = useMemo(() => {
    const t = (tiposAtendimento || []).find((x) =>
      (x?.nome || "").toLowerCase().includes("psic")
    );
    return t?.id || null;
  }, [tiposAtendimento]);

  const coordTypeId = useMemo(() => {
    const t = (tiposAtendimento || []).find((x) =>
      (x?.nome || "").toLowerCase().includes("coordenador")
    );
    return t?.id || null;
  }, [tiposAtendimento]);

  const isObservacaoOnly = useMemo(() => {
    if (!selectedAtendente || !Array.isArray(selectedAtendente.tipos_atende)) return false;

    const nomesTipos = selectedAtendente.tipos_atende.map(tipoId => {
      const tipo = tipoById.get(tipoId);
      return (tipo?.nome || "").toLowerCase();
    });

    const cargo = (selectedAtendente?.cargo || "").toLowerCase();
    if (cargo.includes("psic")) return false;
    if (cargo.includes("assistente social") || cargo.includes("servico social") || cargo.includes("serviço social")) return false;
    if (cargo.includes("orient")) return false;
    return nomesTipos.some(
      (nome) => (nome.includes("social") || nome.includes("coordenador")) && !cargo.includes("assistente") && !cargo.includes("orient")
    );
  }, [selectedAtendente, tipoById]);

  const getWaitMinutes = (horaChegada) => {
    const ms = horaChegada?.toMillis?.() || 0;
    if (!ms) return "-";
    const diffMin = Math.max(0, Math.round((Date.now() - ms) / 60000));
    return `${diffMin} min`;
  };

  const filaFiltrada = useMemo(() => {
    const q = simplify(String(filaBusca || "").trim());
    if (!q) return filaAguardando;
    return (filaAguardando || []).filter((item) => {
      const nome = simplify(getNomeCidadao(item));
      const cpf = simplify(String(item?.cidadao?.cpf || ""));
      const tipo = simplify(String(item?.tipo_nome || ""));
      return nome.includes(q) || cpf.includes(q) || tipo.includes(q);
    });
  }, [filaAguardando, filaBusca]);

  const filaResumo = useMemo(() => {
    const prioridade = (filaFiltrada || []).filter(
      (i) => i.cidadao?.prioridade && i.cidadao.prioridade !== "Nenhuma"
    ).length;
    const normal = Math.max(0, (filaFiltrada || []).length - prioridade);
    return { prioridade, normal, total: (filaFiltrada || []).length };
  }, [filaFiltrada]);

  const draftKey = useMemo(() => {
    if (!atendimentoAtual?.id || !selectedAtendente?.id) return null;
    return `atendimento_draft:${atendimentoAtual.id}:${selectedAtendente.id}`;
  }, [atendimentoAtual?.id, selectedAtendente?.id]);

  useEffect(() => {
    if (!draftKey) {
      setDraftSavedAt(null);
      setDraftRecovered(false);
      setDraftServerError(null);
      return;
    }
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) {
        setDraftSavedAt(null);
        setDraftRecovered(false);
        return;
      }
      const parsed = JSON.parse(raw);
      const hasAny =
        (parsed?.observacoes && String(parsed.observacoes).trim()) ||
        (parsed?.cadunicoObs && String(parsed.cadunicoObs).trim()) ||
        (Array.isArray(parsed?.cadunicoAcoes) && parsed.cadunicoAcoes.length) ||
        (parsed?.rmaData && Object.keys(parsed.rmaData).length > 0);
      if (!hasAny) {
        setDraftSavedAt(null);
        setDraftRecovered(false);
        return;
      }
      if (typeof parsed?.observacoes === "string") setObservacoes(parsed.observacoes);
      if (typeof parsed?.cadunicoObs === "string") setCadunicoObs(parsed.cadunicoObs);
      if (Array.isArray(parsed?.cadunicoAcoes)) setCadunicoAcoes(parsed.cadunicoAcoes);
      if (parsed?.rmaData && typeof parsed.rmaData === "object") setRmaData(parsed.rmaData);
      setDraftSavedAt(typeof parsed?.savedAt === "number" ? parsed.savedAt : null);
      setDraftRecovered(true);
    } catch {
      setDraftSavedAt(null);
      setDraftRecovered(false);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    const id = window.setTimeout(() => {
      if (!mounted.current) return;
      try {
        const payload = {
          observacoes: observacoes || "",
          cadunicoObs: cadunicoObs || "",
          cadunicoAcoes: Array.isArray(cadunicoAcoes) ? cadunicoAcoes : [],
          rmaData: rmaData || {},
          savedAt: Date.now(),
        };
        window.localStorage.setItem(draftKey, JSON.stringify(payload));
        if (mounted.current) {
            setDraftSavedAt(payload.savedAt);
        }
      } catch {}
    }, 1000);
    return () => window.clearTimeout(id);
  }, [draftKey, observacoes, cadunicoObs, cadunicoAcoes, rmaData]);

  const clearLocalDraft = () => {
    if (!draftKey) return;
    try {
      window.localStorage.removeItem(draftKey);
    } catch {}
    setDraftSavedAt(null);
    setDraftRecovered(false);
  };

  const makeEvento = (tipo, texto) => {
    return {
      tipo,
      texto,
      criado_em: new Date(),
      atendente_id: selectedAtendente?.id || null,
      atendente_nome: selectedAtendente?.nome || null,
    };
  };

  const stripUndefinedDeep = (value) => {
    if (Array.isArray(value)) {
      return value
        .filter((v) => v !== undefined)
        .map((v) => stripUndefinedDeep(v));
    }
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).forEach((k) => {
        const v = value[k];
        if (v === undefined) return;
        out[k] = stripUndefinedDeep(v);
      });
      return out;
    }
    return value;
  };

  const formatEventoTime = (ts) => {
    if (!ts) return "";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const salvarRascunhoNoSistema = async (opts = {}) => {
    if (!db || !atendimentoAtual?.id) return;
    if (!opts.silent) {
      setDraftServerSaving(true);
      setDraftServerError(null);
    }
    try {
      const ref = doc(db, collectionPath, atendimentoAtual.id);
      const payload = {
        observacoes_rascunho: observacoes || "",
        cadunico_observacao_rascunho: cadunicoObs || "",
        cadunico_acoes_rascunho: Array.isArray(cadunicoAcoes) ? cadunicoAcoes : [],
        rascunho_atualizado_em: serverTimestamp(),
      };
      if (Object.keys(rmaData || {}).length > 0) {
        payload.rma_rascunho = stripUndefinedDeep(rmaData);
      }
      if (!opts.silent) {
        payload.eventos = arrayUnion(makeEvento("rascunho", "Rascunho salvo no sistema."));
      }
      await updateDoc(ref, payload);
    } catch (e) {
      if (mounted.current && !opts.silent) {
        setDraftServerError(getFriendlyFirebaseError(e, "Não foi possível salvar o rascunho no sistema."));
      }
    } finally {
      if (mounted.current && !opts.silent) {
        setDraftServerSaving(false);
      }
    }
  };

  const templatesObservacao = [
    "Orientações realizadas.",
    "Documentos pendentes.",
  ];

  const inserirTemplate = (texto) => {
    const hora = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const linha = `[${hora}] ${texto}`;
    setObservacoes((prev) => {
      const base = String(prev || "");
      if (!base.trim()) return linha;
      return base.endsWith("\n") ? `${base}${linha}` : `${base}\n${linha}`;
    });
  };

  // Auto-save rascunho a cada 2 min quando há atendimento em andamento
  const salvarRascunhoRef = useRef(salvarRascunhoNoSistema);
  salvarRascunhoRef.current = salvarRascunhoNoSistema;
  useEffect(() => {
    if (!atendimentoAtual?.id || isViewOnly) return;
    const interval = setInterval(() => {
      if (!mounted.current) return;
      salvarRascunhoRef.current?.({ silent: true });
    }, 120000);
    return () => clearInterval(interval);
  }, [atendimentoAtual?.id, isViewOnly]);

  // Aviso ao fechar aba quando há alterações não salvas
  useEffect(() => {
    const hasDraft = !!(observacoes?.trim() || cadunicoObs?.trim() || (Array.isArray(cadunicoAcoes) && cadunicoAcoes.length > 0) || (rmaData && Object.keys(rmaData).length > 0));
    if (!atendimentoAtual?.id || !hasDraft || isViewOnly) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "Há dados não salvos. Deseja sair?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [atendimentoAtual?.id, observacoes, cadunicoObs, cadunicoAcoes, rmaData, isViewOnly]);

  useEffect(() => {
    if (!user || !atendentesList || selectedAtendente) return;

    // Se for Coordenador/Admin, NÃO seleciona automaticamente!
    // Queremos que ele veja a lista de seleção primeiro
    if (isGestor) return;

    const email = (user.email || "").toLowerCase();
    
    // Procura por coincidência de email
    const matches = atendentesList.filter(
      (a) => (a.email || "").toLowerCase() === email
    );

    // 1. Tenta encontrar o perfil CORRETO (onde ID == UID)
    const exactMatch = matches.find(a => a.id === user.uid);
    
    // 2. Tenta encontrar perfil "fantasma" (email igual, mas ID diferente/aleatório)
    const ghostMatch = matches.find(a => a.id !== user.uid);

    if (exactMatch) {
      // Cenário Ideal: Encontrou o perfil vinculado ao UID corretamente.
      if (!exactMatch.uid) {
         // Pequena correção silenciosa se o campo uid estiver faltando dentro do doc
         // (Não bloqueante, mas bom corrigir)
      }
      setSelectedAtendente(exactMatch);
    } else if (ghostMatch) {
      // Cenário de Erro: O usuário tem um perfil, mas foi criado manualmente pelo Admin (ID aleatório)
      // e não pelo fluxo de registro (ID=UID). Isso causa erro de permissão.
      console.log("Detectado perfil desconectado (ID do Doc != UID do Auth). Iniciando migração automática...");
      
      const migrateProfile = async () => {
        try {
          // Referências
          const oldRef = doc(db, `artifacts/${appId}/public/data/atendentes`, ghostMatch.id);
          const newRef = doc(db, `artifacts/${appId}/public/data/atendentes`, user.uid);

          // Dados a migrar
          const dataToMove = { ...ghostMatch };
          delete dataToMove.id; // Remover ID antigo dos dados

          // 1. Criar o documento correto (ID = UID)
          // O usuário deve ter permissão para criar seu próprio documento (create if request.auth.uid == resource.id)
          await setDoc(newRef, {
            ...dataToMove,
            uid: user.uid,
            email: email, // Garante email certo
            migrated_at: serverTimestamp()
          }, { merge: true });

          console.log("Perfil migrado para o UID correto com sucesso.");

          // 2. Tentar deletar o antigo (Best Effort)
          // Se falhar (permissão), tudo bem, o novo já existe e será priorizado na próxima renderização.
          try {
            await deleteDoc(oldRef);
            console.log("Perfil antigo (fantasma) removido.");
          } catch (delErr) {
            console.warn("Não foi possível remover o perfil antigo (provavelmente sem permissão), mas o novo foi criado e será usado.", delErr);
          }

          // Não setamos selectedAtendente aqui. 
          // O Firestore vai detectar o novo documento, atualizar atendentesList, e este useEffect vai rodar de novo
          // e cair no 'if (exactMatch)'.
          
        } catch (err) {
          console.error("Falha crítica ao migrar perfil:", err);
          // Guardar erro para exibir modal com UID
          if (mounted.current) {
            setMigrationError({ uid: user.uid, email: email, error: err.message });
          }
          // Fallback: Tenta usar o perfil quebrado mesmo, mas vai dar erro de permissão ao editar.
          // setSelectedAtendente(ghostMatch); <--- COMENTADO PARA NÃO PERMITIR USO DE PERFIL QUEBRADO
        }
      };

      migrateProfile();
    }
  }, [user, atendentesList, selectedAtendente, db, appId, isGestor]);

  useEffect(() => {
    if (!selectedAtendente) {
      setStatusExpediente("offline");
      setSalaAtualId("");
      setExpedienteBloqueadoAte(null);
      setLastHeartbeat(null);
      return;
    }
    setStatusExpediente(selectedAtendente.status || "offline");
    const encField = selectedAtendente.expedienteEncerradoEm;
    if (encField && encField.toDate) {
      const base = new Date(encField.toDate());
      const liberacao = new Date(base);
      liberacao.setDate(liberacao.getDate() + 1);
      liberacao.setHours(8, 0, 0, 0);
      const now = new Date();
      if (now >= liberacao) {
        setExpedienteBloqueadoAte(null);
        const isOwnProfile =
          selectedAtendente.id === user?.uid || selectedAtendente.uid === user?.uid;
        if (db && appId && isOwnProfile) {
          updateDoc(
            doc(db, `artifacts/${appId}/public/data/atendentes`, selectedAtendente.id),
            { expedienteEncerradoEm: null, encerradoAutomatico: false }
          ).catch(() => {});
        }
      } else {
        setExpedienteBloqueadoAte(liberacao);
      }
    } else {
      setExpedienteBloqueadoAte(null);
    }
    if (selectedAtendente.sala_atual_id) {
      setSalaAtualId(selectedAtendente.sala_atual_id);
    } else if (selectedAtendente.sala_id) {
      setSalaAtualId(selectedAtendente.sala_id);
    } else {
      setSalaAtualId("");
    }
  }, [selectedAtendente, db, appId, user?.uid]);

  useEffect(() => {
    if (!db || !selectedAtendente) return;
    // Só envia heartbeat para o próprio perfil — coordenador visualizando outro atendente não deve escrever no doc alheio
    const isOwnProfile = selectedAtendente.id === user?.uid || selectedAtendente.uid === user?.uid;
    if (!isOwnProfile) return;
    const ref = doc(
      db,
      `artifacts/${appId}/public/data/atendentes`,
      selectedAtendente.id
    );
    const updateHeartbeat = async () => {
      try {
        await updateDoc(ref, { last_seen: serverTimestamp() });
        setLastHeartbeat(new Date());
      } catch (e) {
        console.error(e);
      }
    };
    updateHeartbeat();
    const id = setInterval(updateHeartbeat, 300000);
    return () => clearInterval(id);
  }, [db, appId, selectedAtendente, user?.uid]);

  useEffect(() => {
    if (!db || !selectedAtendente || !isGestor) return;
    const trueStatus = getAtendenteTrueStatus(selectedAtendente);
    const storedStatus = selectedAtendente?.status || "offline";
    const isGhost =
      ["online", "ocupado", "pausa"].includes(storedStatus) && trueStatus === "offline";
    if (!isGhost) return;
    const ref = doc(db, `artifacts/${appId}/public/data/atendentes`, selectedAtendente.id);
    updateDoc(ref, { status: "offline" }).catch(() => {});
  }, [db, appId, selectedAtendente, isGestor, getAtendenteTrueStatus]);

  const selectedAtendenteRef = useRef(selectedAtendente);
  selectedAtendenteRef.current = selectedAtendente;

  const expedienteRuntimeRef = useRef({
    atendimentoAtual: null,
    filaAguardando: [],
    observacoes: "",
    cadunicoObs: "",
    cadunicoAcoes: [],
    rmaData: {},
    tipoAcompanhamento: null,
    isAtendenteTecnico: false,
    isCadUnicoAtual: false,
  });
  expedienteRuntimeRef.current.atendimentoAtual = atendimentoAtual;
  expedienteRuntimeRef.current.filaAguardando = filaAguardando;
  expedienteRuntimeRef.current.observacoes = observacoes;
  expedienteRuntimeRef.current.cadunicoObs = cadunicoObs;
  expedienteRuntimeRef.current.cadunicoAcoes = cadunicoAcoes;
  expedienteRuntimeRef.current.rmaData = rmaData;
  expedienteRuntimeRef.current.tipoAcompanhamento = tipoAcompanhamento;
  expedienteRuntimeRef.current.isAtendenteTecnico = isAtendenteTecnico;
  expedienteRuntimeRef.current.isCadUnicoAtual = isCadUnicoAtual;

  useEffect(() => {
    const selectedAtendenteId = selectedAtendente?.id;
    if (!db || !selectedAtendenteId) return;
    const isOwnSelection =
      selectedAtendente?.id === userProfile?.id ||
      selectedAtendente?.id === user?.uid ||
      selectedAtendente?.uid === user?.uid;
    if (isGestor && !isOwnSelection) return;
    const ref = doc(
      db,
      `artifacts/${appId}/public/data/atendentes`,
      selectedAtendenteId
    );
    const checkExpediente = async () => {
      const now = new Date();
      const day = now.getDay();
      if (day === 0 || day === 6) return;
      const startToday = new Date(now);
      startToday.setHours(0, 0, 0, 0);
      const selected = selectedAtendenteRef.current;
      const runtime = expedienteRuntimeRef.current;
      const encField = selected?.expedienteEncerradoEm;
      const lastSeenField = selected?.last_seen;
      const autoFlag = !!selected?.encerradoAutomatico;
      if (statusExpediente !== "offline") {
        let encIsToday = false;
        if (encField && encField.toDate) {
          const encDate = encField.toDate();
          encIsToday = encDate >= startToday;
        }
        if (!encIsToday) {
          const hour = now.getHours();
          let mustAutoClose = false;
          let resetForDay = false;

          if (hour >= 19 && !isGestor) {
            const temAtendimento = !!runtime.atendimentoAtual;
            const temFila = runtime.filaAguardando && runtime.filaAguardando.length > 0;

            if (hour >= 20 && temAtendimento) {
              try {
                await salvarRascunhoRef.current?.({ silent: true });
                
                const tipoFinal = runtime.tipoAcompanhamento || null;
                const tipoFinalSeguro =
                  runtime.isAtendenteTecnico && !tipoFinal ? "acompanhamento" : tipoFinal;
                
                const atendimento = runtime.atendimentoAtual;
                const updateData = {
                  status: "finalizado",
                  hora_fim: serverTimestamp(),
                  observacoes: runtime.observacoes || "",
                  tipo_acompanhamento: tipoFinalSeguro,
                  _auto_finalizado: true, // Bug 7 Fix: Adiciona flag para identificar nos relatórios
                  observacoes_rascunho: "",
                  cadunico_observacao_rascunho: "",
                  cadunico_acoes_rascunho: [],
                  eventos: arrayUnion(makeEvento("sistema", "Finalizado automaticamente às 20h (atendente não finalizou). Dados salvos.")),
                };

                // ═══ Registra evolução final no histórico imutável (auto-finalização 20h) ═══
                const obsAuto = String(runtime.observacoes || "").trim();
                if (obsAuto) {
                  updateData.evolucoes = arrayUnion({
                    autor_id: selected?.id || null,
                    autor_uid: user?.uid || null,
                    autor_nome: selected?.nome || userProfile?.nome || null,
                    autor_cargo: selected?.cargo || userProfile?.cargo || null,
                    texto: obsAuto,
                    timestamp: new Date(),
                    contexto: 'finalizado',
                    auto_finalizado: true,
                  });
                }

                if (runtime.isCadUnicoAtual) {
                  updateData.cadunico_acoes = runtime.cadunicoAcoes || [];
                  updateData.cadunico_observacao = runtime.cadunicoObs || "";
                  const temInclusao = (runtime.cadunicoAcoes || []).includes("inclusao");
                  const temRecadastro = (runtime.cadunicoAcoes || []).includes("recadastro");
                  const temTransferencia = (runtime.cadunicoAcoes || []).includes("transferencia");
                  if (temInclusao || temRecadastro || temTransferencia) {
                    updateData.rma = stripUndefinedDeep({
                      ...(atendimento?.rma || {}),
                      c_status: "confirmado",
                      c_validado_por: user?.uid || selected?.id,
                      c_validado_por_nome: selected?.nome || userProfile?.nome || "CadÚnico",
                      c_data_validacao: new Date().toISOString(),
                      c1_inclusao_cadunico: temInclusao,
                      c2_atualizacao_cadunico: temRecadastro || temTransferencia,
                    });
                  }
                }
                if (runtime.isAtendenteTecnico) {
                  updateData.rma = stripUndefinedDeep({
                    ...runtime.rmaData,
                    c_status: "confirmado",
                    c_data_criacao: new Date().toISOString(),
                  });
                }
                const docRef = doc(db, collectionPath, atendimento.id);
                await updateDoc(docRef, updateData);
                if (mounted.current) {
                  setAtendimentoAtual(null);
                  clearLocalDraft();
                  setRmaData({});
                  setTipoAcompanhamento(null);
                  setUiError("Atendimento finalizado automaticamente às 20h. Os dados foram salvos.");
                }
              } catch (e) {
                console.error("Erro ao auto-finalizar às 20h:", e);
              }
              return;
            }

            if (!temAtendimento && !temFila) {
              mustAutoClose = true;
            }
          } else if (hour >= 8 && lastSeenField && lastSeenField.toDate) {
            if (selected?.status === "online") {
              const lastSeenDate = lastSeenField.toDate();
              if (lastSeenDate < startToday) {
                resetForDay = true;
              }
            }
          }

          if (mustAutoClose) {
            const liberacao = new Date(now);
            liberacao.setDate(liberacao.getDate() + 1);
            liberacao.setHours(8, 0, 0, 0);
            setExpedienteBloqueadoAte(liberacao);
            try {
              await updateDoc(ref, {
                status: "offline",
                expedienteEncerradoEm: serverTimestamp(),
                encerradoAutomatico: true,
              });
              setStatusExpediente("offline");
            } catch (e) {
              console.error(e);
            }
            return;
          }

          if (resetForDay) {
            try {
              await updateDoc(ref, {
                status: "offline",
                expedienteEncerradoEm: null,
              });
              setStatusExpediente("offline");
              setExpedienteBloqueadoAte(null);
            } catch (e) {
              console.error(e);
            }
            return;
          }
        }
      } else {
        if (
          !alertExpedienteMostrado &&
          autoFlag &&
          encField &&
          encField.toDate
        ) {
          const encDate = encField.toDate();
          const encDay = new Date(encDate);
          encDay.setHours(0, 0, 0, 0);
          const diffMs = startToday.getTime() - encDay.getTime();
          const diffDays = Math.round(diffMs / 86400000);
          const hourNow = now.getHours();
          if (diffDays === 1 && hourNow >= 8) {
            setUiError(
              "Seu expediente anterior foi encerrado automaticamente porque não foi encerrado manualmente até as 19h. Lembre-se de clicar em 'Encerrar expediente' ao final do dia."
            );
            setAlertExpedienteMostrado(true);
            try {
              await updateDoc(ref, { encerradoAutomatico: false });
            } catch (e) {
              console.error(e);
            }
          }
        }
      }
    };
    checkExpediente();
    const id = setInterval(checkExpediente, 60000);
    return () => clearInterval(id);
  }, [
    db,
    appId,
    selectedAtendente?.id,
    statusExpediente,
    alertExpedienteMostrado,
    isGestor,
  ]);

  const crasIdAtendente = useMemo(() => {
    const isOwnSelection =
      selectedAtendente?.id === userProfile?.id ||
      selectedAtendente?.id === user?.uid ||
      selectedAtendente?.uid === user?.uid;

    const crasId = selectedAtendente?.cras_id || (isOwnSelection ? userProfile?.cras_id : null) || null;
    const isSuperAdmin = ["super_admin", "superintendente", "master", "admin"].includes(roleNormComputed);
    if (isSuperAdmin && !crasId) return isOwnSelection ? "__ALL__" : null;
    return crasId;
  }, [
    selectedAtendente?.id,
    selectedAtendente?.uid,
    selectedAtendente?.cras_id,
    userProfile?.id,
    userProfile?.cras_id,
    user?.uid,
    roleNormComputed,
  ]);

  const isAtendenteCadUnico = useMemo(() => {
    if (!selectedAtendente) return false;
    const cargo = (selectedAtendente.cargo || "").toLowerCase();
    return cargo.includes("cad") || cargo.includes("único") || cargo.includes("unico");
  }, [selectedAtendente]);

  useEffect(() => {
    const expedienteAberto =
      statusExpediente === "online" ||
      statusExpediente === "ocupado" ||
      statusExpediente === "pausa";
    if (!db || !selectedAtendente || !expedienteAberto || crasIdAtendente == null) {
      setFilaAguardando([]);
      setLoadingFila(false);
      return;
    }
    setLoadingFila(true);
    
    // Query principal: busca atendimentos aguardando sem preferência de atendente
    // IMPORTANTE: Não filtramos por atendente_id aqui porque queremos ver todos os aguardando
    // O filtro por tipo de atendimento é feito na função rebuildFila
    const q =
      crasIdAtendente === "__ALL__"
        ? query(
            collection(db, collectionPath),
            where("status", "==", "aguardando"),
            where("atendente_preferencial_id", "==", null),
            limit(500)
          )
        : query(
            collection(db, collectionPath),
            where("cras_id", "==", crasIdAtendente),
            where("status", "==", "aguardando"),
            where("atendente_preferencial_id", "==", null),
            limit(500)
          );
    const atendenteKeys = [
      selectedAtendente?.id,
      selectedAtendente?.uid,
      user?.uid
    ]
      .filter(Boolean)
      .map((v) => String(v));

    const uniqueAtendenteKeys = Array.from(new Set(atendenteKeys));

    const prefUnsubs = [];
    const prefDocsByKey = new Map();
    let currentBaseFila = [];
    let baseCarregada = false;

    const setSnapshotForKey = (key, snapshot) => {
      const nextMap = new Map();
      snapshot.docs.forEach((docSnap) => {
        nextMap.set(docSnap.id, docSnap);
      });
      prefDocsByKey.set(key, nextMap);
    };

    const getMergedPrefMap = () => {
      const merged = new Map();
      Array.from(prefDocsByKey.values()).forEach((m) => {
        Array.from(m.entries()).forEach(([id, docSnap]) => {
          merged.set(id, docSnap);
        });
      });
      return merged;
    };

    const rebuildFila = (baseFila) => {
      // Proteção contra baseFila undefined ou não-array
      if (!Array.isArray(baseFila)) {
        baseFila = [];
      }

      const tipoCache = tipoById;
      const suportados =
        Array.isArray(selectedAtendente.tipos_atende) && selectedAtendente.tipos_atende.length > 0
          ? selectedAtendente.tipos_atende
          : (isSelectedAtendenteCoordenador && coordTypeId ? [coordTypeId] : null);

      const prefMap = getMergedPrefMap();
      const prefIds = new Set(prefMap.keys());
      const mappedPref = Array.from(prefMap.values()).map((docSnap) => {
        const data = docSnap.data();
        const tipo = tipoCache.get(data.tipo_atendimento_id);
        return {
          id: docSnap.id,
          ...data,
          tipo_nome: tipo?.nome || "Atendimento",
          tipo_cor: tipo?.cor || "#777",
        };
      });

      // Filtra a fila base: remove documentos que têm atendente_id definido
      // mas não são o atendente atual.
      // REMOVIDO: Filtro por atendente_id_anterior para permitir que usuários 
      // transferidos voltem a aparecer na fila se necessário.
      let fila = baseFila.filter((item) => {
        // Se tem atendente_id definido e não é o atendente atual, exclui
        if (item.atendente_id && !uniqueAtendenteKeys.includes(String(item.atendente_id))) {
          return false;
        }
        
        // Exclui se já estiver na lista de preferências (para não duplicar)
        if (prefIds.has(item.id)) return false;

        const pref = item.atendente_preferencial_id || null;

        // Se tem preferencial, O Coordenador deve ver também! (Ticket Fantasma Fix)
        const roleRaw = String(selectedAtendente.role || selectedAtendente.cargo || "").toLowerCase();
        const isCoordenadorOuAdminSelecionado =
          roleRaw === "coordenador" ||
          roleRaw === "admin" ||
          roleRaw === "super_admin" ||
          selectedAtendenteRole === "coordenador" ||
          selectedAtendenteRole === "admin" ||
          selectedAtendenteRole === "super_admin";

        if (pref) {
          return uniqueAtendenteKeys.includes(String(pref)) || isCoordenadorOuAdminSelecionado;
        }

        if (suportados) {
          const isCadTicket = cadUnicoTypeIds.includes(item.tipo_atendimento_id);
          if (isAtendenteCadUnico && isCadTicket) return true;
          return suportados.includes(item.tipo_atendimento_id);
        }

        // Se o atendente é do CadÚnico e não tem tipos definidos, ele DEVE ver CadÚnico
        if (isAtendenteCadUnico) {
            return cadUnicoTypeIds.includes(item.tipo_atendimento_id);
        }

        // Se o atendente for coordenador e não tiver tipos definidos, ele deve ver tudo
        if (isCoordenadorOuAdminSelecionado) {
            return !cadUnicoTypeIds.includes(item.tipo_atendimento_id);
        }

        // Caso contrário (outros atendentes sem tipos definidos), vê tudo exceto CadÚnico
        return !cadUnicoTypeIds.includes(item.tipo_atendimento_id);
      });

      const combined = [...mappedPref, ...fila];
      const getEffectiveTime = (item) => {
        const t = item?.hora_transferencia?.toMillis?.();
        if (t) return t;
        return item?.hora_chegada?.toMillis?.() || 0;
      };
      const isPriority = (item) => {
        return item?.cidadao?.prioridade && item.cidadao.prioridade !== "Nenhuma";
      };
      combined.sort((a, b) => {
        const pa = isPriority(a) ? 0 : 1;
        const pb = isPriority(b) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return getEffectiveTime(a) - getEffectiveTime(b);
      });
      return combined;
    };

    uniqueAtendenteKeys.forEach((key) => {
      prefDocsByKey.set(key, new Map());
      const qPref =
        crasIdAtendente === "__ALL__"
          ? query(
              collection(db, collectionPath),
              where("status", "==", "aguardando"),
              where("atendente_preferencial_id", "==", key),
              limit(200)
            )
          : query(
              collection(db, collectionPath),
              where("cras_id", "==", crasIdAtendente),
              where("status", "==", "aguardando"),
              where("atendente_preferencial_id", "==", key),
              limit(200)
            );
      const unsub = onSnapshot(
        qPref,
        (snapshot) => {
          if (!mounted.current) return;
          setSnapshotForKey(key, snapshot);
          
          // Reconstruir a fila baseada na lista atual de atendimentos aguardando
          if (!baseCarregada) return;
          setFilaAguardando(rebuildFila(currentBaseFila));
          setLoadingFila(false);
        },
        () => {}
      );
      prefUnsubs.push(unsub);
    });

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!mounted.current) return;
        let fila = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const tipo = tipoById.get(data.tipo_atendimento_id);
          return {
            id: docSnap.id,
            ...data,
            tipo_nome: tipo?.nome || "Atendimento",
            tipo_cor: tipo?.cor || "#777",
          };
        });

        if (mounted.current) {
          currentBaseFila = fila;
          baseCarregada = true;
          const combined = rebuildFila(fila);
          setFilaAguardando(combined);
          setLoadingFila(false);
        }
      },
      () => {
        if (mounted.current) {
          setLoadingFila(false);
        }
      }
    );
    return () => {
      unsubscribe();
      prefUnsubs.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
      prefDocsByKey.clear();
    };
  }, [
    db,
    selectedAtendente,
    crasIdAtendente,
    collectionPath,
    tipoById,
    cadUnicoTypeIds,
    statusExpediente,
    user,
    selectedAtendenteRole,
    isSelectedAtendenteCoordenador,
    coordTypeId,
    isAtendenteCadUnico, // Bug 4 Fix: Dependência correta para filtragem da fila
  ]);

  useEffect(() => {
    if (!db || !selectedAtendente || !selectedAtendente.id) {
      setAtendimentoAtual(null);
      setLoadingAtual(false);
      return;
    }
    setLoadingAtual(true);
    const q = query(
      collection(db, collectionPath),
      where("atendente_id", "==", selectedAtendente.id),
      where("status", "in", ["chamando", "em_atendimento"]),
      limit(1)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!mounted.current) return;
        if (snapshot.empty) {
          atendimentoAtualIdRef.current = null;
          if (mounted.current) {
            setAtendimentoAtual(null);
            setObservacoes("");
            setShowTransfer(false);
            setDraftRecovered(false);
            setTipoAcompanhamento(null);
            setTipoAcompanhamentoLocked(false);
            setVisitaEsporadicaAlerta(null);
          }
        } else {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data();
          const tipo = tipoById.get(data.tipo_atendimento_id);
          const prevId = atendimentoAtualIdRef.current;
          const isSame = prevId === docSnap.id;
          atendimentoAtualIdRef.current = docSnap.id;
          if (mounted.current) {
            setAtendimentoAtual({
              id: docSnap.id,
              ...data,
              tipo_nome: tipo?.nome || "Atendimento",
              tipo_cor: tipo?.cor || "#777",
            });
            if (!isSame) {
              // Se há um rascunho salvo no banco, usa ele como estado inicial. Senão, usa o normal
              const obsInicial = data.observacoes_rascunho || data.observacoes || "";
              setObservacoes(obsInicial);
              setVisitaEsporadicaAlerta(null);

              setCadunicoAcoes(
                Array.isArray(data.cadunico_acoes) ? data.cadunico_acoes : []
              );
              setCadunicoObs(data.cadunico_observacao || "");
              setTipoAcompanhamento(data.tipo_acompanhamento || null);
              setTipoAcompanhamentoLocked(false);
              
              // Inicializa dados do RMA se existirem (para que CadÚnico veja o que Psicólogo marcou)
              if (data.rma) {
                setRmaData(data.rma);
              } else {
                setRmaData({});
              }
            }
          }
        }
        if (mounted.current) {
          setLoadingAtual(false);
        }
      },
      () => {
        if (mounted.current) {
          setLoadingAtual(false);
        }
      }
    );
    return () => unsubscribe();
  }, [db, selectedAtendente, collectionPath, tipoById]);

  useEffect(() => {
    if (!atendimentoAtual || !db || !appId) return;

    const currentAtendenteId = selectedAtendente?.id || user?.uid || null;

    const fetchCitizenData = async () => {
      try {
        const cpf = atendimentoAtual.cidadao?.cpf ? atendimentoAtual.cidadao.cpf.replace(/\D/g, "") : null;
        if (!cpf || cpf.length !== 11) return;

        const docRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpf);
        const docSnap = await getDoc(docRef);

        let tipoVal = null;
        let definidoPor = null;

        if (docSnap.exists()) {
          const data = docSnap.data();
          definidoPor = data.tipoAcompanhamentoDefinidoPor || null;
          tipoVal = data.tipoAcompanhamento || null;
          const visitaEsp = data.ultima_visita_esporadica;
          if (
            visitaEsp &&
            visitaEsp.unidade_id &&
            String(visitaEsp.unidade_id) !== String(selectedAtendente?.cras_id || "")
          ) {
            if (mounted.current) setVisitaEsporadicaAlerta(visitaEsp);
          } else if (mounted.current) {
            setVisitaEsporadicaAlerta(null);
          }

          if (tipoVal && !definidoPor && data.ultimoAtendimentoResumo?.atendenteId) {
            definidoPor = data.ultimoAtendimentoResumo.atendenteId;
          }
        }

        if (!tipoVal && atendimentoAtual.tipo_acompanhamento) {
          tipoVal = atendimentoAtual.tipo_acompanhamento;
          definidoPor = atendimentoAtual.atendente_id || null;
        }

        if (!tipoVal) {
          const q = query(
            collection(db, `artifacts/${appId}/public/data/atendimentos`),
            where("cidadao.cpf", "==", cpf),
            where("status", "==", "finalizado"),
            orderBy("hora_fim", "desc"),
            limit(1)
          );
          try {
            const snap = await getDocs(q);
            if (!snap.empty) {
              const at = snap.docs[0].data();
              const t = at.tipo_acompanhamento || null;
              if (t) {
                tipoVal = t;
                definidoPor = at.atendente_id || null;
                if (mounted.current && cpf) {
                  setDoc(
                    doc(db, `artifacts/${appId}/public/data/cidadaos`, cpf),
                    { tipoAcompanhamento: tipoVal, tipoAcompanhamentoDefinidoPor: definidoPor },
                    { merge: true }
                  ).catch(() => {});
                }
              }
            }
          } catch (_) {}
        }

        if (mounted.current && tipoVal) {
          setTipoAcompanhamento(tipoVal);
          setTipoAcompanhamentoLocked(definidoPor != null && definidoPor !== currentAtendenteId);
        }
      } catch (e) {
        console.error("Erro ao buscar dados do cidadão:", e);
      }
    };

    fetchCitizenData();
  }, [atendimentoAtual, db, appId, selectedAtendente?.id, user?.uid]);

  const definirTipoAcompanhamento = (valor) => {
    if (!valor) return;
    if (tipoAcompanhamentoLocked) return;

    setTipoAcompanhamento(valor);

    if (!isAtendenteTecnico) return;
    if (!db || !appId || !atendimentoAtual?.cidadao?.cpf) return;

    const cpfLimpo = String(atendimentoAtual.cidadao.cpf).replace(/\D/g, "");
    if (!cpfLimpo) return;

    const definidoPor = selectedAtendente?.id || user?.uid || null;
    setTipoAcompanhamentoLocked(true);
    setDoc(
      doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo),
      { tipoAcompanhamento: valor, tipoAcompanhamentoDefinidoPor: definidoPor },
      { merge: true }
    ).catch(() => {
      if (mounted.current) {
        setTipoAcompanhamentoLocked(false);
        setUiError("Não foi possível salvar a classificação do usuário. Tente novamente.");
      }
    });
  };

  const handleStatusChange = async (newStatus) => {
    if (!db || !selectedAtendente) return;
    if (busyAction) return;
    if (newStatus === "offline" && atendimentoAtual) {
      setUiError("Finalize o atendimento antes de encerrar o turno.");
      return;
    }

    const currentStatus = statusExpediente;
    const isResumingFromPause = currentStatus === "pausa" && newStatus === "online";

    // Bloqueio de horário: apenas entre 07:00 e 18:00 (somente ao iniciar do offline).
    // Retomar do pausa sempre é permitido (senão o atendente fica preso).
    // Se houver atendimento em andamento, permite voltar ao online para concluir.
    if (
      newStatus === "online" &&
      currentStatus === "offline" &&
      !atendimentoAtual &&
      !isGestor &&
      !selectedAtendente.podeTrabalharForaHorario
    ) {
      const now = new Date();
      const hora = now.getHours();
      // Permitir iniciar um pouco antes (07:00) até 18:00
      if (hora < 7 || hora >= 18) {
        setUiError(
          "O expediente só pode ser iniciado entre 07:00 e 18:00. Fora deste horário, o sistema permanece offline."
        );
        return;
      }
    }

    if (newStatus !== "offline" && expedienteBloqueadoAte && !isGestor && !selectedAtendente.podeTrabalharForaHorario) {
      // Se tiver bloqueio, verifica se ainda está dentro do prazo
      if (new Date() < expedienteBloqueadoAte) {
        // Se a data de bloqueio é válida, impede o login
        alert(
          "Seu expediente foi encerrado. Apenas amanhã às 08h ou mediante liberação do Coordenador será possível voltar a atender."
        );
        return;
      } else {
        // Se já passou o prazo (ex: dia seguinte), limpa o bloqueio localmente
        setExpedienteBloqueadoAte(null);
        const encField = selectedAtendente?.expedienteEncerradoEm;
        if (encField && encField.toDate) {
          const isOwnProfile =
            selectedAtendente.id === user?.uid || selectedAtendente.uid === user?.uid;
          if (isOwnProfile) {
            updateDoc(
              doc(db, `artifacts/${appId}/public/data/atendentes`, selectedAtendente.id),
              { expedienteEncerradoEm: null, encerradoAutomatico: false }
            ).catch(() => {});
          }
        }
      }
    }
    if (newStatus === "online" && !salaAtualId && currentStatus === "offline" && !isResumingFromPause) {
      if (!isGestor) {
        // Verifica se a sala já está no documento do Firestore antes de barrar
        const docRef = doc(db, `artifacts/${appId}/public/data/atendentes`, selectedAtendente.id);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();
        if (!data?.sala_atual_id && !data?.sala_id) {
            alert("Selecione a sala de atendimento antes de iniciar o expediente.");
            return;
        }
      }
    }
    try {
      setBusyAction("status");
      setUiError(null);
      const updateData = { status: newStatus };
      if (newStatus === "online") {
        updateData.last_seen = serverTimestamp();
      }
      const prevBloqueio = expedienteBloqueadoAte;
      if (newStatus === "offline") {
        updateData.expedienteEncerradoEm = serverTimestamp();
        const agora = new Date();
        const liberacao = new Date(agora);
        liberacao.setDate(liberacao.getDate() + 1);
        liberacao.setHours(8, 0, 0, 0);
        setExpedienteBloqueadoAte(liberacao);
      }
      const ref = doc(
        db,
        `artifacts/${appId}/public/data/atendentes`,
        selectedAtendente.id
      );
      try {
        await updateDoc(ref, updateData);
      } catch (writeErr) {
        if (newStatus === "offline") {
          setExpedienteBloqueadoAte(prevBloqueio);
        }
        throw writeErr;
      }
      setStatusExpediente(newStatus);
    } catch (e) {
      console.error(e);
      setUiError("Não foi possível atualizar o status do expediente.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleTrocarSala = async (novaSalaId) => {
    if (!db || !selectedAtendente) return;
    if (busyAction) return;
    const prevSala = salaAtualId;
    setSalaAtualId(novaSalaId);
    try {
      setBusyAction("sala");
      setUiError(null);
      const ref = doc(
        db,
        `artifacts/${appId}/public/data/atendentes`,
        selectedAtendente.id
      );
      await updateDoc(ref, { sala_atual_id: novaSalaId });
    } catch (e) {
      setSalaAtualId(prevSala);
      console.error(e);
      setUiError("Não foi possível atualizar a sala.");
    } finally {
      setBusyAction(null);
    }
  };

  const getSalaNome = (id) => {
    if (!id) return "";
    const sala = (salasAtendimento || []).find((s) => s.id === id);
    if (sala?.nome) return sala.nome;
    if (selectedAtendente?.guiche) return `Guichê ${selectedAtendente.guiche}`;
    return "";
  };

  const ensureAuthProfileConsistency = async () => {
    if (!db || !appId || !user) return false;
    const emailNorm = (user.email || "").toString().trim().toLowerCase();
    if (!emailNorm) return false;

    // Só usa dados do selectedAtendente se for o próprio perfil (evita corromper role/nome/cargo do coordenador com dados de outro atendente)
    const isOwnAtendente = selectedAtendente?.id === user.uid || selectedAtendente?.uid === user.uid;
    const ownAtendente = isOwnAtendente ? selectedAtendente : null;

    const roleCandidate =
      userProfile?.role ||
      userProfile?.roleNorm ||
      ownAtendente?.role ||
      ownAtendente?.cargo ||
      userProfile?.cargo ||
      "";

    let role = normalizeRole(roleCandidate);
    if (!role) {
      const cargo = String(ownAtendente?.cargo || userProfile?.cargo || "").toLowerCase();
      if (cargo.includes("coordenad")) role = "coordenador";
      else if (cargo.includes("psic")) role = "psicologo";
      else if (cargo.includes("recep")) role = "recepcionista";
      else role = "atendente";
    }

    const perfilBase = {
      email: emailNorm,
      nome: userProfile?.nome || ownAtendente?.nome || emailNorm,
      role,
      cras_id: ownAtendente?.cras_id || userProfile?.cras_id || "",
      cargo: ownAtendente?.cargo || userProfile?.cargo || "",
      permissions: Array.isArray(userProfile?.permissions) ? userProfile.permissions : [],
    };

    try {
      await setDoc(doc(db, `artifacts/${appId}/public/data/users`, user.uid), perfilBase, { merge: true });
    } catch (err) {}

    try {
      await setDoc(doc(db, `artifacts/${appId}/public/data/users_by_email`, emailNorm), perfilBase, { merge: true });
    } catch (err) {}

    // Só sincroniza UID no próprio perfil — nunca sobrescreve UID de outro atendente
    const isOwnProfile = selectedAtendente?.id === user.uid || selectedAtendente?.uid === user.uid;
    if (isOwnProfile && selectedAtendente?.id) {
      try {
        await updateDoc(doc(db, `artifacts/${appId}/public/data/atendentes`, selectedAtendente.id), { uid: user.uid });
      } catch (err) {}
    }

    return true;
  };

  const handleChamarProximo = async () => {
    if (statusExpediente !== "online") {
      setUiError("Seu status está offline/pausa. Volte para Online e selecione a sala para chamar o próximo.");
      return;
    }
    if (crasIdAtendente === "__ALL__") {
      setUiError("Selecione uma unidade para chamar o próximo usuário. Na visão geral (todas as unidades) o sistema não permite chamar.");
      return;
    }
    if (
      !db ||
      !selectedAtendente ||
      filaAguardando.length === 0 ||
      atendimentoAtual
    )
      return;
    if (busyAction) return;
    if (!salaAtualId) {
      setUiError("Selecione a sala de atendimento antes de chamar o próximo usuário.");
      return;
    }

    const prioridadeFila = filaAguardando.filter(
      (i) => i.cidadao?.prioridade && i.cidadao.prioridade !== "Nenhuma"
    );
    const normalFila = filaAguardando.filter(
      (i) => !i.cidadao?.prioridade || i.cidadao.prioridade === "Nenhuma"
    );

    const candidatos = [...prioridadeFila, ...normalFila];
    if (candidatos.length === 0) return;

    let ticketCapturado = false;
    let lastError = null;
    let didSelfHeal = false;

    setBusyAction("chamar");
    setUiError(null);

    try {
      // FIX: Limitar tentativas e adicionar delay para evitar erro "Quota exceeded" (HTTP 429)
      // Tenta até 10 candidatos para aumentar as chances de sucesso se os primeiros estiverem sendo capturados
      const MAX_ATTEMPTS = 10;
      const candidatosParaTentar = candidatos.slice(0, MAX_ATTEMPTS);

      for (let i = 0; i < candidatosParaTentar.length; i++) {
        const proximo = candidatosParaTentar[i];
        if (!proximo || !proximo.id) continue;

        try {
          await runTransaction(db, async (transaction) => {
            const docRef = doc(db, collectionPath, proximo.id);
            const docSnap = await transaction.get(docRef);

            if (!docSnap.exists()) {
              throw new Error("O ticket de atendimento não foi encontrado.");
            }

            const data = docSnap.data();
            const currentStatus = (data.status || "").trim().toLowerCase();
            
            // Se já estiver sendo chamado por MIM, considera capturado e sai
            if (currentStatus === "chamando" && data.atendente_id === selectedAtendente.id) {
               ticketCapturado = true;
               return;
            }

            if (currentStatus !== "aguardando") {
              throw new Error(`Este usuário já foi chamado por outro profissional (${currentStatus}).`);
            }

            transaction.update(docRef, {
              status: "chamando",
              atendente_id: selectedAtendente.id,
              hora_chamada: serverTimestamp(),
              atendente_guiche: getSalaNome(salaAtualId),
              eventos: arrayUnion(
                makeEvento(
                  "chamado",
                  `Usuário chamado para ${getSalaNome(salaAtualId) || "atendimento"}.`
                )
              ),
            });
          });

          ticketCapturado = true;
          break;
        } catch (e) {
          console.error(`Erro ao tentar capturar ticket ${proximo.id}:`, e);
          lastError = e;

          // Check for Quota Exceeded / Resource Exhausted explicitly
          const errString = String(e).toLowerCase();
          if (errString.includes("quota exceeded") || (e.code && e.code === "resource-exhausted")) {
              console.error("Quota exceeded detected. Stopping loop.");
              lastError = "O sistema está sobrecarregado no momento. Aguarde alguns segundos e tente novamente.";
              break;
          }

          // Se for erro de permissão do Firebase
          if (e && e.code === "permission-denied") {
              const isOutro = user && selectedAtendente && 
                             (user.email || "").toLowerCase() !== (selectedAtendente.email || "").toLowerCase();
              
              if (isOutro) {
                  lastError = `Erro de permissão: Você está logado como ${user.email} mas tentando atender como ${selectedAtendente.nome}.`;
              } else {
                  if (!didSelfHeal) {
                    didSelfHeal = true;
                    await ensureAuthProfileConsistency();
                    // A tentativa seguinte do loop usará o perfil corrigido
                  } else {
                    lastError = "Sua conta não tem permissão para realizar atendimentos. Contate o administrador.";
                  }
              }
          }
        }
      }

      if (!ticketCapturado) {
        // Se não conseguiu capturar nada e havia candidatos, explica o motivo
        if (candidatos.length > 0 && lastError) {
          // Se for erro de preferência, mostra alerta amigável
          if (String(lastError).includes("preferencialmente")) {
            setUiError("Os usuários na fila estão direcionados para outros profissionais.");
          } else if (String(lastError).includes("já foi chamado")) {
            setUiError("Os primeiros usuários da fila acabaram de ser chamados. Tente novamente em instantes.");
          } else {
            setUiError(String(lastError));
          }
        } else {
          setUiError("Não foi possível chamar o próximo usuário da fila no momento.");
        }
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleIniciarAtendimento = async () => {
    if (!db || !atendimentoAtual) return;
    if (busyAction) return;
    if (!salaAtualId) {
      alert("Selecione a sala de atendimento antes de iniciar o atendimento.");
      return;
    }
    try {
      setBusyAction("iniciar");
      setUiError(null);
      
      await runTransaction(db, async (transaction) => {
          const docRef = doc(db, collectionPath, atendimentoAtual.id);
          const docSnap = await transaction.get(docRef);
          
          if (!docSnap.exists()) throw new Error("Documento não encontrado");
          
          const data = docSnap.data();
          // Validação de estado
          const currentStatus = String(data.status || "").trim().toLowerCase();
          
          // Se já estiver em atendimento pelo próprio atendente, não faz nada e assume sucesso
          if (currentStatus === 'em_atendimento' && data.atendente_id === selectedAtendente.id) {
             return;
          }

          if (currentStatus !== 'chamando') {
             throw new Error(`Estado inválido para iniciar: ${currentStatus || "-"}. O atendimento pode ter sido alterado.`);
          }
          
          transaction.update(docRef, {
            status: "em_atendimento",
            hora_inicio: serverTimestamp(),
            eventos: arrayUnion(makeEvento("inicio", "Atendimento iniciado.")),
          });
      });
      
    } catch (e) {
      console.error(e);
      let msg = getFriendlyFirebaseError(e, "Erro ao iniciar atendimento.");
      setUiError(msg);
    } finally {
      setBusyAction(null);
    }
  };

  const handleFinalizarAtendimento = async () => {
    if (!db || !atendimentoAtual) return;
    if (busyAction) return;
    try {
      setBusyAction("finalizar");
      setUiError(null);

      const observacoesSnapshot = observacoes;
      const cadunicoAcoesSnapshot = Array.isArray(cadunicoAcoes) ? [...cadunicoAcoes] : [];
      const cadunicoObsSnapshot = cadunicoObs;
      const rmaDataSnapshot = rmaData ? JSON.parse(JSON.stringify(rmaData)) : {};
      const tipoAcompanhamentoSnapshot = tipoAcompanhamento;
      const atendimentoRmaSnapshot = atendimentoAtual?.rma ? JSON.parse(JSON.stringify(atendimentoAtual.rma)) : {};
      
      await runTransaction(db, async (transaction) => {
          const docRef = doc(db, collectionPath, atendimentoAtual.id);
          const docSnap = await transaction.get(docRef);
          
          if (!docSnap.exists()) throw new Error("Documento não encontrado");
          
          const data = docSnap.data();
          // Validação de estado
          const currentStatus = String(data.status || "").trim().toLowerCase();
          
          // Se já estiver finalizado, assume sucesso
          if (currentStatus === 'finalizado') return;

          if (currentStatus !== 'em_atendimento' && currentStatus !== 'chamando') {
             throw new Error(`Estado inválido para finalizar: ${currentStatus || "-"}.`);
          }

          if (isAtendenteTecnico && !tipoAcompanhamentoSnapshot) {
             throw new Error("Classificação Obrigatória: Selecione se o usuário é 'Novo' ou 'Acompanhamento' no topo da página.");
          }

          if (atendimentoAtual.cidadao?.cpf) {
            const cpfLimpo = atendimentoAtual.cidadao.cpf.replace(/\D/g, "");
            if (cpfLimpo) {
              const cidadaoRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
              const payload = {
                ultimaAtualizacaoFicha: serverTimestamp(),
                ultimoAtendimentoResumo: {
                  atendimentoId: atendimentoAtual.id,
                  tipoAtendimentoId: atendimentoAtual.tipo_atendimento_id || data.tipo_atendimento_id,
                  tipoAtendimentoNome: atendimentoAtual.tipo_nome || data.tipo_nome || null,
                  atendenteId: selectedAtendente?.id || user?.uid || null,
                  atendenteNome: selectedAtendente?.nome || userProfile?.nome || null,
                  horaFimISO: new Date().toISOString(),
                },
              };
              const crasAtendente = selectedAtendente?.cras_id || null;
              const crasCidadao =
                data?.cidadao?.cras_id_principal ||
                data?.cidadao?.cras_id ||
                data?.usuario_cras_id_original ||
                data?.cross_unit?.origem_cras_id ||
                null;
              const isOutraUnidade =
                !!crasAtendente && !!crasCidadao && String(crasAtendente) !== String(crasCidadao);
              const isEsporadico =
                data.usuario_desligado === true ||
                (isOutraUnidade && !data.recebido_em && !data.vinculado_em);
              if (isEsporadico) {
                payload.ultima_visita_esporadica = {
                  atendimento_id: atendimentoAtual.id,
                  data: new Date().toISOString(),
                  unidade_id: crasAtendente,
                  unidade_nome:
                    crasUnidades?.find((c) => c?.id === crasAtendente)?.nome || "",
                  atendente_id: selectedAtendente?.id || user?.uid || null,
                  atendente_nome: selectedAtendente?.nome || "",
                  obs: String(observacoesSnapshot || "").substring(0, 400),
                  tipo: atendimentoAtual.tipo_nome || data.tipo_nome || "",
                };
              }
              if (isAtendenteTecnico && tipoAcompanhamentoSnapshot) {
                payload.tipoAcompanhamento = tipoAcompanhamentoSnapshot;
                payload.tipoAcompanhamentoDefinidoPor = selectedAtendente?.id || user?.uid || null;
              }
              transaction.set(cidadaoRef, payload, { merge: true });
            }
          }

          const updateData = {
            status: "finalizado",
            hora_fim: serverTimestamp(),
            observacoes: observacoesSnapshot,
            tipo_acompanhamento: isAtendenteTecnico ? tipoAcompanhamentoSnapshot : null,
            eventos: arrayUnion(makeEvento("finalizado", "Atendimento finalizado.")),
            observacoes_rascunho: "",
            cadunico_observacao_rascunho: "",
            cadunico_acoes_rascunho: [],
          };

          // ═══════════════════════════════════════════════════════════
          // NOVO: Registra a evolução final no histórico imutável.
          // O array `evolucoes` é a fonte das "Últimas 3 Observações"
          // que aparecem para qualquer atendente atendendo o cidadão.
          // ═══════════════════════════════════════════════════════════
          const obsFinalParaHistorico = String(observacoesSnapshot || "").trim();
          if (obsFinalParaHistorico) {
            const crasAtendente = selectedAtendente?.cras_id || null;
            const crasCidadao =
              data?.cidadao?.cras_id_principal ||
              data?.cidadao?.cras_id ||
              data?.usuario_cras_id_original ||
              data?.cross_unit?.origem_cras_id ||
              null;
            const isOutraUnidade =
              !!crasAtendente && !!crasCidadao && String(crasAtendente) !== String(crasCidadao);
            const isEsporadico =
              data.usuario_desligado === true ||
              (isOutraUnidade && !data.recebido_em && !data.vinculado_em);
            updateData.evolucoes = arrayUnion({
              autor_id: selectedAtendente?.id || null,
              autor_uid: user?.uid || null,
              autor_nome: selectedAtendente?.nome || userProfile?.nome || null,
              autor_cargo: selectedAtendente?.cargo || userProfile?.cargo || null,
              texto: obsFinalParaHistorico,
              timestamp: new Date(),
              contexto: isEsporadico ? "esporadico" : "finalizado",
            });
          }

          if (currentStatus === 'chamando' && !data.hora_inicio) {
            updateData.hora_inicio = serverTimestamp();
          }
          
          // Lógica existente para salvar ações específicas do CadÚnico (campo legado/display)
          if (isCadUnicoAtual) {
            updateData.cadunico_acoes = cadunicoAcoesSnapshot;
            updateData.cadunico_observacao = cadunicoObsSnapshot || "";

            // NOVA LÓGICA: Alimentar automaticamente o RMA baseado nas ações do CadÚnico
            // Isso garante que atendimentos diretos no CadÚnico contem no relatório RMA (Bloco C)
            
            // Verifica se já existe um objeto RMA (ex: vindo de encaminhamento) ou cria um novo
            const rmaBase = atendimentoRmaSnapshot || {};
            // Nota: Em transação idealmente leríamos 'data.rma', mas como rmaData é local... vamos confiar no merge
            
            // Mapeia ações visuais para campos do RMA
            const temInclusao = cadunicoAcoesSnapshot.includes('inclusao');
            const temRecadastro = cadunicoAcoesSnapshot.includes('recadastro');
            const temTransferencia = cadunicoAcoesSnapshot.includes('transferencia');
            
            // Se houve alguma ação relevante para o RMA
            if (temInclusao || temRecadastro || temTransferencia) {
                updateData.rma = {
                    ...stripUndefinedDeep(rmaBase),
                    c_status: 'confirmado', // Auto-confirma pois foi feito pelo próprio CadÚnico
                    c_validado_por: user?.uid || selectedAtendente?.id,
                    c_validado_por_nome: selectedAtendente?.nome || userProfile?.nome || 'CadÚnico',
                    c_data_validacao: new Date().toISOString(),
                    
                    // Mapeamento
                    c1_inclusao_cadunico: temInclusao || rmaBase.c1_inclusao_cadunico === true,
                    // Consideramos Transferência como uma forma de Atualização Cadastral também
                    c2_atualizacao_cadunico: temRecadastro || temTransferencia || rmaBase.c2_atualizacao_cadunico === true
                };
            }
          }
          
          if (isAtendenteTecnico) {
            // Verifica se há solicitação de CadÚnico (C.1 ou C.2)
            const temSolicitacaoCadUnico = rmaDataSnapshot.c1_inclusao_cadunico || rmaDataSnapshot.c2_atualizacao_cadunico;

            updateData.rma = {
              ...stripUndefinedDeep(rmaDataSnapshot),
              c_status: temSolicitacaoCadUnico ? "pendente" : "confirmado",
              c_data_criacao: new Date().toISOString()
            };
            console.log('[Finalizar] RMA salvo:', { isAtendenteTecnico, rmaKeys: Object.keys(rmaDataSnapshot), rmaData: updateData.rma });
          } else {
            console.log('[Finalizar] RMA NÃO salvo (isAtendenteTecnico=false)');
          }

          // Validação do RMA pelo CadÚnico
          if (isAtendenteCadUnico && atendimentoRmaSnapshot?.c_status === 'pendente') {
              // Determina a ação final baseada nos CHECKBOXES C1/C2 que o atendente marcou/confirmou
              // E sincroniza com rmaData atual para garantir consistência
              
              updateData.rma = {
                  ...stripUndefinedDeep(atendimentoRmaSnapshot), // Mantém dados originais
                  ...stripUndefinedDeep(rmaDataSnapshot), // Sobrescreve com o que estiver no estado atual (editado pelo CadÚnico)
                  c_status: 'confirmado',
                  c_validado_por: user?.uid || selectedAtendente?.id,
                  c_validado_por_nome: selectedAtendente?.nome || userProfile?.nome || 'CadÚnico',
                  c_data_validacao: new Date().toISOString()
              };
          }

          if (updateData.rma) {
            updateData.rma = stripUndefinedDeep(updateData.rma);
          }

          transaction.update(docRef, updateData);
      });

      clearLocalDraft();
      setRmaData({}); // Limpa os dados do RMA após finalizar
      setTipoAcompanhamento(null);
    } catch (e) {
      console.error(e);
      let msg = getFriendlyFirebaseError(e, "Erro ao finalizar atendimento.");
      setUiError(msg);
    } finally {
      setBusyAction(null);
    }
  };

  const handleMarcarAusente = async () => {
    if (!db || !atendimentoAtual) return;
    if (busyAction) return;
    try {
      setBusyAction("ausente");
      setUiError(null);
      
      await runTransaction(db, async (transaction) => {
          const docRef = doc(db, collectionPath, atendimentoAtual.id);
          const docSnap = await transaction.get(docRef);
          
          if (!docSnap.exists()) throw new Error("Documento não encontrado");
          
          const data = docSnap.data();
          // Validação de estado
          if (data.status !== 'chamando') {
             throw new Error(`Estado inválido para marcar ausente: ${data.status}. O atendimento deve estar no status 'chamando'.`);
          }

          transaction.update(docRef, {
            status: "ausente",
            hora_fim: serverTimestamp(),
            eventos: arrayUnion(makeEvento("ausente", "Atendimento marcado como ausente.")),
            observacoes_rascunho: "",
            cadunico_observacao_rascunho: "",
            cadunico_acoes_rascunho: [],
          });
      });
      
      clearLocalDraft();
    } catch (e) {
      console.error(e);
      let msg = getFriendlyFirebaseError(e, "Erro ao registrar ausência.");
      setUiError(msg);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRechamar = async () => {
    if (!db || !atendimentoAtual) return;
    if (busyAction) return;
    
    // Validação de 1 minuto
    if (atendimentoAtual.hora_chamada) {
        let lastCallTime;
        // Tenta converter de Timestamp do Firestore ou Date
        if (atendimentoAtual.hora_chamada.toDate) {
            lastCallTime = atendimentoAtual.hora_chamada.toDate().getTime();
        } else if (atendimentoAtual.hora_chamada instanceof Date) {
            lastCallTime = atendimentoAtual.hora_chamada.getTime();
        } else if (typeof atendimentoAtual.hora_chamada === 'number') { // Millis
            lastCallTime = atendimentoAtual.hora_chamada;
        }

        if (lastCallTime) {
            const now = Date.now();
            const diffMs = now - lastCallTime;
            const oneMinuteMs = 60 * 1000;
            
            if (diffMs < oneMinuteMs) {
                const waitSeconds = Math.ceil((oneMinuteMs - diffMs) / 1000);
                alert(`Aguarde ${waitSeconds} segundos para rechamar o usuário.`);
                return;
            }
        }
    }

    try {
      setBusyAction("rechamar");
      setUiError(null);
      const ref = doc(db, collectionPath, atendimentoAtual.id);
      
      await updateDoc(ref, {
        hora_chamada: serverTimestamp(), // Atualiza horário para tocar na TV
        eventos: arrayUnion(makeEvento("rechamada", "Usuário rechamado."))
      });
      
    } catch (e) {
      console.error(e);
      let msg = getFriendlyFirebaseError(e, "Erro ao rechamar usuário.");
      setUiError(msg);
    } finally {
      setBusyAction(null);
    }
  };

  const handleBlockUser = async () => {
    if (!db || !appId || !atendimentoAtual) return;
    if (busyAction || isBlocking) return;
    const cpfLimpo = (atendimentoAtual.cidadao?.cpf || "").replace(/\D/g, "");
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      alert("CPF do usuário não encontrado ou inválido. Não é possível desligar sem CPF.");
      return;
    }
    const nomeBruto = getNomeCidadao(atendimentoAtual);
    const nomeNorm = nomeBruto
      ? nomeBruto
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      : "";
    let dataDesligamento = blockDate;
    try {
      const d = blockDate ? parseFlexibleDate(blockDate) : null;
      const safe = d || new Date();
      if (!isNaN(safe.getTime())) {
        dataDesligamento = safe.toLocaleDateString("pt-BR");
      }
    } catch {
      dataDesligamento = blockDate;
    }
    const collectionPath = `artifacts/${appId}/public/data/usuarios_bloqueados`;
    setIsBlocking(true);
    setUiError(null);
    try {
      const docData = {
        nome: nomeBruto,
        cpf: cpfLimpo,
        nomeNormalizado: nomeNorm,
        motivoDesligamento: blockReason.trim(),
        dataDesligamento,
        demandaOrigem: atendimentoAtual.tipo_nome || "",
        tecnicoDesligou: blockTecnico.trim() || userProfile?.nome || userProfile?.email || "",
        cras_id: selectedAtendente?.cras_id || null,
        cras_id_desligamento: selectedAtendente?.cras_id || null,
        nome_unidade_desligamento:
          crasUnidades?.find((c) => c?.id === selectedAtendente?.cras_id)?.nome || null,
        dataAtendimentoInicial: atendimentoAtual.hora_chegada
          ? atendimentoAtual.hora_chegada.toDate
            ? atendimentoAtual.hora_chegada.toDate().toLocaleDateString("pt-BR")
            : ""
          : "",
        importadoEm: new Date(),
        origemImportacao: "desligado_pelo_atendimento",
      };
      await setDoc(doc(collection(db, collectionPath), cpfLimpo), docData, {
        merge: true,
      });
      await handleFinalizarAtendimento();
      setShowBlockModal(false);
    } catch (e) {
      console.error("Erro ao desligar usuário:", e);
      let msg = getFriendlyFirebaseError(e, "Erro ao desligar usuário.");
      setUiError(msg);
    } finally {
      setIsBlocking(false);
    }
  };

  const openBlockModal = () => {
    setBlockReason("");
    setBlockDate(new Date().toISOString().split("T")[0]);
    setBlockTecnico(selectedAtendente?.nome || "");
    setShowBlockModal(true);
  };

  const handleTransferir = async (destino, atendentePreferencialId = null) => {
    if (!db || !atendimentoAtual) return;
    if (busyAction) return;
    try {
      setBusyAction("transferir");
      setUiError(null);
      let novoTipoId = null;
      if (destino === "cadunico") {
        novoTipoId = cadUnicoTypeId;
      } else if (destino === "psicologo") {
        novoTipoId = psicTypeId;
      } else if (destino === "coordenador") {
        // Fallback para coordenador se existir no sistema
        const t = (tiposAtendimento || []).find((x) =>
          (x?.nome || "").toLowerCase().includes("coordenador")
        );
        novoTipoId = t?.id;
      }

      // Se não encontrou o ID pelo método padrão, tenta buscar pelo nome
      if (!novoTipoId && tiposAtendimento) {
         const t = tiposAtendimento.find(x => x.nome.toLowerCase().includes(destino));
         if (t) novoTipoId = t.id;
      }

      if (!novoTipoId) {
        // Se ainda assim falhar, tenta usar o ID do primeiro tipo disponível que não seja o atual
        // Isso é um fallback de segurança para não travar
        console.warn("Tipo de destino exato não encontrado. Tentando inferir...");
        if (destino === 'cadunico') {
             // Tenta qualquer coisa que não seja psicólogo
             novoTipoId = tiposAtendimento.find(t => !t.nome.toLowerCase().includes('psic'))?.id;
        } else {
             // Tenta qualquer coisa que seja psicólogo
             novoTipoId = tiposAtendimento.find(t => t.nome.toLowerCase().includes('psic'))?.id;
        }
      }

      if (!novoTipoId) {
        alert("Erro crítico: Tipo de atendimento de destino não encontrado no sistema. Contate o suporte.");
        return;
      }

      const ref = doc(db, collectionPath, atendimentoAtual.id);

      // ═══════════════════════════════════════════════════════════════
      // NOVO: Registra a observação atual no histórico imutável.
      // Toda transferência salva uma "evolução" no array `evolucoes`.
      // Esse array é a fonte das "Últimas 3 Observações" que ficam
      // visíveis para qualquer atendente subsequente do cidadão.
      // ═══════════════════════════════════════════════════════════════
      const obsParaHistorico = String(observacoes || "").trim();
      const evolucaoTransferencia = obsParaHistorico ? {
        autor_id: selectedAtendente?.id || null,
        autor_uid: user?.uid || null,
        autor_nome: selectedAtendente?.nome || userProfile?.nome || null,
        autor_cargo: selectedAtendente?.cargo || userProfile?.cargo || null,
        texto: obsParaHistorico,
        timestamp: new Date(),
        contexto: 'transferencia',
        destino: destino || null,
      } : null;
      
      const updatePayload = {
        status: "aguardando",
        hora_transferencia: serverTimestamp(),
        atendente_id: null,
        atendente_id_anterior: selectedAtendente.id, // Marca quem transferiu
        atendente_preferencial_id: atendentePreferencialId || null, // Define ou limpa preferência
        tipo_atendimento_id: novoTipoId,
        hora_chamada: null,
        hora_inicio: null,
        observacoes: observacoes || "",
        cadunico_observacao: cadunicoObs || "",
        cadunico_acoes: cadunicoAcoes || [],
        eventos: arrayUnion(
          makeEvento(
            "transferencia",
            `Transferido para ${destino === "cadunico" ? "CadÚnico" : (destino === "psicologo" ? "Psicologia" : "Coordenador")}.${atendentePreferencialId ? ' (Direcionado)' : ''}`
          )
        ),
        observacoes_rascunho: "",
        cadunico_observacao_rascunho: "",
        cadunico_acoes_rascunho: [],
      };

      if (atendentePreferencialId) {
        const atendentesArr = Array.isArray(atendentesList) ? atendentesList : [];
        const atendenteDestino = atendentesArr.find(
          (a) => String(a?.id || a?.uid || "") === String(atendentePreferencialId)
        );
        const crasOrigem = selectedAtendente?.cras_id || null;
        const crasDestino = atendenteDestino?.cras_id || null;
        if (crasOrigem && crasDestino && String(crasDestino) !== String(crasOrigem)) {
          updatePayload.cras_id = crasDestino;
          updatePayload.cras_id_origem = crasOrigem;
          updatePayload.transferencia_inter_unidade = true;
          updatePayload.transferido_em = serverTimestamp();
        }
      }

      // Se houver evolução para registrar, anexa ao array imutável
      if (evolucaoTransferencia) {
        updatePayload.evolucoes = arrayUnion(evolucaoTransferencia);
      }

      if (isAtendenteTecnico) {
        // Verifica se há solicitação de CadÚnico (C.1 ou C.2)
        // Nota: As chaves devem corresponder ao RMAForm (c1_inclusao_cadunico, c2_atualizacao_cadunico)
        const temSolicitacaoCadUnico = rmaData.c1_inclusao_cadunico || rmaData.c2_atualizacao_cadunico;
        
        // Se transferir para CadÚnico ou tiver solicitação explícita, marca como pendente
        if (destino === 'cadunico' || temSolicitacaoCadUnico) {
            updatePayload.rma = {
                ...stripUndefinedDeep(rmaData),
                c_status: "pendente",
                c_data_criacao: new Date().toISOString()
            };
        } else {
            // Apenas salva os dados sem marcar pendente (rascunho)
            updatePayload.rma = {
                ...stripUndefinedDeep(rmaData),
                c_status: "rascunho"
            };
        }
      }

      await updateDoc(ref, updatePayload);
      
      // Força uma reconstrução da fila removendo o documento transferido
      // Isso garante que o usuário desapareça imediatamente da fila
      setFilaAguardando((prev) => {
        if (!Array.isArray(prev)) return [];
        return prev.filter((item) => item.id !== atendimentoAtual.id);
      });
      
      // FIX: Também limpar o estado de atendimento no documento do atendente para liberar o guichê
      try {
        const atendenteRef = doc(db, `artifacts/${appId}/public/data/atendentes`, selectedAtendente.id);
        await updateDoc(atendenteRef, {
            atendimentoAtualId: null,
            emAtendimento: false
        });
      } catch (err) {
        console.error("Erro ao liberar guichê no atendente:", err);
      }
      
      setAtendimentoAtual(null);
      setShowTransfer(false);
      clearLocalDraft();
      
      // M5 Fix: Limpar rmaData e cadunicoAcoes após transferência
      setRmaData({});
      setCadunicoAcoes([]);
      setCadunicoObs("");
      
      // Bug 6 Fix: Feedback não-bloqueante (evita enfileiramento de snapshots)
      setUiError("SUCCESS: Atendimento transferido com sucesso! O usuário foi enviado para a fila de espera e seu guichê foi liberado.");
      
      // Remove o aviso de sucesso após 5 segundos
      setTimeout(() => {
        if (mounted.current) {
          setUiError((prev) => (prev?.startsWith("SUCCESS:") ? null : prev));
        }
      }, 5000);
      
    } catch (e) {
      console.error(e);
      let msg = getFriendlyFirebaseError(e, "Erro ao transferir atendimento.");
      setUiError(msg);
    } finally {
      setBusyAction(null);
    }
  };

  const getStatusInfo = (atendenteOrStatus) => {
    const trueStatus =
      atendenteOrStatus && typeof atendenteOrStatus === "object"
        ? getAtendenteTrueStatus(atendenteOrStatus)
        : atendenteOrStatus;
    if (trueStatus === "online" || trueStatus === "ocupado") {
      return {
        label: "Online",
        classes: "bg-green-100 text-green-800 border border-green-200",
      };
    }
    if (trueStatus === "pausa") {
      return {
        label: "Em pausa",
        classes: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      };
    }
    return {
      label: "Offline",
      classes: "bg-gray-100 text-gray-700 border border-gray-200",
    };
  };

  const unidade =
    crasUnidades.find((c) => c.id === selectedAtendente?.cras_id)?.nome ||
    "Unidade";

  const getSalasDisponiveis = () => {
    if (!salasAtendimento || !selectedAtendente) return [];

    if (
      Array.isArray(selectedAtendente.salas_permitidas) &&
      selectedAtendente.salas_permitidas.length > 0
    ) {
      const permitted = salasAtendimento.filter((s) =>
        selectedAtendente.salas_permitidas.includes(s.id)
      );
      if (permitted.length > 0) return permitted;
    }

    // Fallback: se atendente não tem cras_id no perfil, usa do userProfile (evita lista vazia)
    const crasId = selectedAtendente.cras_id || userProfile?.cras_id;
    if (!crasId || crasId === "__ALL__") return salasAtendimento;
    return salasAtendimento.filter(
      (s) => !s.cras_id || s.cras_id === crasId
    );
  };

  const salasParaSelecao = getSalasDisponiveis();

  const handleVincularUnidade = async () => {
    if (!db || !appId || !atendimentoAtual || !selectedAtendente?.cras_id) return;
    try {
      const cpfLimpo = String(atendimentoAtual.cidadao?.cpf || "").replace(/\D/g, "");
      const novoCrasId = selectedAtendente.cras_id;
      const crasAnterior =
        atendimentoAtual?.cidadao?.cras_id_principal ||
        atendimentoAtual?.cidadao?.cras_id ||
        atendimentoAtual?.usuario_cras_id_original ||
        null;

      const atdRef = doc(db, collectionPath, atendimentoAtual.id);
      await updateDoc(atdRef, {
        cras_id: novoCrasId,
        usuario_de_outra_unidade: false,
        usuario_cras_id_original: crasAnterior,
        "cidadao.cras_id": novoCrasId,
        "cidadao.cras_id_principal": novoCrasId,
        vinculado_em: serverTimestamp(),
        vinculado_por: selectedAtendente.id || user?.uid || null,
        eventos: arrayUnion(
          makeEvento(
            "vinculo_unidade",
            `Usuário vinculado a esta unidade por ${selectedAtendente.nome || "atendente"}.`
          )
        ),
      });

      if (cpfLimpo && cpfLimpo.length === 11) {
        const cidRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
        await setDoc(
          cidRef,
          {
            cras_id: novoCrasId,
            cras_id_principal: novoCrasId,
            cras_id_anterior: crasAnterior,
            vinculado_em: serverTimestamp(),
          },
          { merge: true }
        );
      }

      setUiError("SUCCESS: Usuário vinculado a esta unidade com sucesso.");
      setTimeout(() => {
        if (mounted.current) setUiError((p) => (p?.startsWith("SUCCESS:") ? null : p));
      }, 4000);
    } catch (e) {
      console.error(e);
      setUiError("Erro ao vincular usuário à unidade.");
    }
  };

  const handleRegistrarVisitaOutraUnidade = async (observacao) => {
    if (!db || !atendimentoAtual) return;
    try {
      const texto = String(observacao || "").trim();
      if (!texto) return;
      const atdRef = doc(db, collectionPath, atendimentoAtual.id);

      const evolucao = {
        autor_id: selectedAtendente?.id || null,
        autor_uid: user?.uid || null,
        autor_nome: selectedAtendente?.nome || userProfile?.nome || null,
        autor_cargo: selectedAtendente?.cargo || userProfile?.cargo || null,
        texto,
        timestamp: new Date(),
        contexto: "visita_outra_unidade",
        cras_id_visita: selectedAtendente?.cras_id || null,
      };

      await updateDoc(atdRef, {
        evolucoes: arrayUnion(evolucao),
        eventos: arrayUnion(
          makeEvento(
            "visita_outra_unidade",
            `Visita registrada por ${selectedAtendente?.nome || "atendente"} em outra unidade.`
          )
        ),
        visitou_outra_unidade: true,
      });

      setUiError(
        "SUCCESS: Observação de visita registrada. Ficará visível para os técnicos da unidade de origem."
      );
      setTimeout(() => {
        if (mounted.current) setUiError((p) => (p?.startsWith("SUCCESS:") ? null : p));
      }, 5000);
    } catch (e) {
      console.error(e);
      setUiError("Erro ao registrar observação de visita.");
    }
  };

  const handleReligarETransferir = async (justificativa) => {
    if (!db || !appId || !atendimentoAtual) return false;
    if (busyAction) return false;
    if (!isAtendentePsicologo && !isAtendenteAssistenteSocial) {
      setUiError("Apenas Psicólogo(a) ou Assistente Social pode religar o usuário.");
      return false;
    }
    const cpfLimpo = String(atendimentoAtual.cidadao?.cpf || "").replace(/\D/g, "");
    if (!cpfLimpo || cpfLimpo.length !== 11) return false;
    const motivo = String(justificativa || "").trim();
    if (!motivo) return false;

    try {
      setBusyAction("religar");
      setUiError(null);

      const novoCrasId = selectedAtendente?.cras_id || null;
      const unidadeNome = crasUnidades?.find((c) => c?.id === novoCrasId)?.nome || "";

      const bloqueadoRef = doc(db, `artifacts/${appId}/public/data/usuarios_bloqueados`, cpfLimpo);
      try {
        await deleteDoc(bloqueadoRef);
      } catch {}

      const cidRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
      await setDoc(
        cidRef,
        {
          cras_id: novoCrasId,
          cras_id_principal: novoCrasId,
          religado_em: serverTimestamp(),
          religado_por: selectedAtendente?.nome || "",
          religado_por_id: selectedAtendente?.id || user?.uid || null,
          religacao_justificativa: motivo,
        },
        { merge: true }
      );

      const atdRef = doc(db, collectionPath, atendimentoAtual.id);
      await updateDoc(atdRef, {
        usuario_desligado: false,
        info_desligamento: null,
        ...(novoCrasId
          ? {
              cras_id: novoCrasId,
              "cidadao.cras_id": novoCrasId,
              "cidadao.cras_id_principal": novoCrasId,
            }
          : {}),
        eventos: arrayUnion(
          makeEvento(
            "religacao",
            `Usuário religado e transferido para ${unidadeNome}. Justificativa: ${motivo}`
          )
        ),
      });

      setUiError(`SUCCESS: Usuário religado e transferido para ${unidadeNome} com sucesso.`);
      setTimeout(() => {
        if (mounted.current) setUiError((p) => (p?.startsWith("SUCCESS:") ? null : p));
      }, 5000);
      return true;
    } catch (e) {
      console.error("[handleReligarETransferir]", e);
      setUiError(getFriendlyFirebaseError(e, "Erro ao religar usuário."));
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const handleReceberNaUnidade = async (justificativa) => {
    if (!db || !appId || !atendimentoAtual || !selectedAtendente?.cras_id) return false;
    if (busyAction) return false;
    const motivo = String(justificativa || "").trim();
    if (!motivo) return false;

    try {
      setBusyAction("receber");
      setUiError(null);

      const cpfLimpo = String(atendimentoAtual.cidadao?.cpf || "").replace(/\D/g, "");
      const novoCrasId = selectedAtendente.cras_id;
      const unidadeNome = crasUnidades?.find((c) => c?.id === novoCrasId)?.nome || "";
      const crasAnterior =
        atendimentoAtual?.cidadao?.cras_id_principal ||
        atendimentoAtual?.cidadao?.cras_id ||
        atendimentoAtual?.usuario_cras_id_original ||
        atendimentoAtual?.cross_unit?.origem_cras_id ||
        null;

      if (cpfLimpo && cpfLimpo.length === 11) {
        const cidRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
        await setDoc(
          cidRef,
          {
            cras_id: novoCrasId,
            cras_id_principal: novoCrasId,
            cras_id_anterior: crasAnterior,
            recebido_em: serverTimestamp(),
            recebido_por: selectedAtendente?.nome || "",
            recebido_por_id: selectedAtendente?.id || user?.uid || null,
            recebimento_justificativa: motivo,
          },
          { merge: true }
        );
      }

      const atdRef = doc(db, collectionPath, atendimentoAtual.id);
      await updateDoc(atdRef, {
        cras_id: novoCrasId,
        usuario_de_outra_unidade: false,
        usuario_cras_id_original: crasAnterior,
        "cidadao.cras_id": novoCrasId,
        "cidadao.cras_id_principal": novoCrasId,
        recebido_em: serverTimestamp(),
        eventos: arrayUnion(
          makeEvento(
            "recebimento_unidade",
            `Usuário recebido e transferido para ${unidadeNome}. Justificativa: ${motivo}`
          )
        ),
      });

      setUiError(`SUCCESS: Usuário recebido e transferido para ${unidadeNome} com sucesso.`);
      setTimeout(() => {
        if (mounted.current) setUiError((p) => (p?.startsWith("SUCCESS:") ? null : p));
      }, 5000);
      return true;
    } catch (e) {
      console.error("[handleReceberNaUnidade]", e);
      setUiError(getFriendlyFirebaseError(e, "Erro ao receber usuário."));
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  return {
    selectedAtendente,
    setSelectedAtendente,
    salaAtualId,
    setSalaAtualId,
    statusExpediente,
    filaAguardando,
    atendimentoAtual,
    observacoes,
    setObservacoes,
    cadunicoAcoes,
    setCadunicoAcoes,
    cadunicoObs,
    setCadunicoObs,
    rmaData,
    setRmaData,
    loadingFila,
    loadingAtual,
    showTransfer,
    setShowTransfer,
    visitaEsporadicaAlerta,
    lastHeartbeat,
    busyAction,
    uiError,
    migrationError,
    filaBusca,
    setFilaBusca,
    previewFilaItem,
    setPreviewFilaItem,
    draftSavedAt,
    draftRecovered,
    draftServerSaving,
    draftServerError,
    showBlockModal,
    setShowBlockModal,
    blockReason,
    setBlockReason,
    blockDate,
    setBlockDate,
    blockTecnico,
    setBlockTecnico,
    isBlocking,
    isGestor,
    isCoordenador,
    isViewOnly,
    tipoById,
    cadUnicoTypeIds,
    cadUnicoTypeId,
    psicTypeId,
    getWaitMinutes,
    filaFiltrada,
    filaResumo,
    isCadUnicoAtual,
    isAtendentePsicologo,
    isAtendenteAssistenteSocial,
    isAtendenteTecnico,
    isAtendenteCadUnico,
    isObservacaoOnly,
    handleStatusChange,
    handleTrocarSala,
    getSalaNome,
    handleChamarProximo,
    handleIniciarAtendimento,
    handleFinalizarAtendimento,
    handleMarcarAusente,
    handleRechamar,
    handleBlockUser,
    openBlockModal,
    handleTransferir,
    handleVincularUnidade,
    handleRegistrarVisitaOutraUnidade,
    handleReligarETransferir,
    handleReceberNaUnidade,
    getStatusInfo,
    unidade,
    salasParaSelecao,
    templatesObservacao,
    inserirTemplate,
    salvarRascunhoNoSistema,
    clearLocalDraft,
    formatEventoTime,
    tipoAcompanhamento,
    setTipoAcompanhamento: definirTipoAcompanhamento,
    tipoAcompanhamentoLocked,
  };
};

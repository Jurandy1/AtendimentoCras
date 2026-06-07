import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, getDocs, onSnapshot, doc, updateDoc, query, where, orderBy, Timestamp, limit, arrayUnion } from 'firebase/firestore';
import {
  Loader, Filter, Download, LayoutDashboard, List,
  Users, Clock, Hourglass, TrendingUp, Calendar,
  BarChart2, PieChart, MapPin, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import {
  calculateWaitTime, formatBRDateTyping, formatDateTime, getAgeFromBRDate,
  getAgeGroup, getBRTRange, getFriendlyFirebaseError, getIBGEMunicipiosByUF,
  isTestUser, logAdminAction, maskCPF, simplify, normalizeRole, safeRemoveChild
} from '../utils';
import { useAuth } from '../contexts/AuthContext';
import Chart from 'chart.js/auto';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import RelatoriosAvancados from './RelatoriosAvancados';

// ════════════════════════════════════════════════════════════════════
// CONSTANTES
// ════════════════════════════════════════════════════════════════════

const REPORT_DOC_LIMIT = 2000;        // Limite máximo de docs por busca de relatório
const LIVE_STATS_LIMIT = 500;         // Limite para live stats (apenas dia atual)
const LIST_PAGE_SIZE = 50;            // Paginação da tabela de detalhes
const CAD_PAGE_SIZE = 10;             // Paginação da tabela CadÚnico

// ════════════════════════════════════════════════════════════════════
// HELPERS DE DURAÇÃO (UNIFICADOS — usados em tela, PDF e CSV)
// ════════════════════════════════════════════════════════════════════

const getDuracaoEmMinutos = (item) => {
  const fim = item?.hora_fim;
  if (!fim?.toMillis) return 0;
  const inicio = item.hora_inicio || item.hora_chamada || item.hora_chegada;
  if (!inicio?.toMillis) return 0;
  const diffMs = fim.toMillis() - inicio.toMillis();
  if (diffMs <= 0) return 0;
  return Math.max(1, Math.round(diffMs / 60000));
};

const getDuracaoFormatada = (item) => {
  const minutos = getDuracaoEmMinutos(item);
  return minutos ? `${minutos} min` : '-';
};

const getEsperaEmMinutos = (item) => {
  const fimEspera = item?.hora_chamada || item?.hora_inicio;
  if (!fimEspera?.toMillis || !item?.hora_chegada?.toMillis) return 0;
  const diff = fimEspera.toMillis() - item.hora_chegada.toMillis();
  return diff > 0 ? Math.round(diff / 60000) : 0;
};

const RelatoriosPage = ({ crasUnidades, tiposAtendimento, atendentesList }) => {
  const { userProfile, db, appId } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const roleNorm = userProfile?.roleNorm || normalizeRole(userProfile?.role);
  const crasRestrito = (roleNorm === 'coordenador') && userProfile?.cras_id ? userProfile.cras_id : null;

  const hojeStr = new Date().toLocaleDateString('pt-BR');
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
  const seteDiasStr = seteDiasAtras.toLocaleDateString('pt-BR');

  const [filters, setFilters] = useState({
    dataInicio: seteDiasStr,
    dataFim: hojeStr,
    cras_id: 'todos',
    tipo_atendimento_id: 'todos',
    status: 'todos'
  });
  const [cadFilters, setCadFilters] = useState({ acao: 'todos', servidor: 'todos' });
  const [cadPage, setCadPage] = useState(1);
  const [listPage, setListPage] = useState(1);

  const [reportData, setReportData] = useState([]);
  const [reportMeta, setReportMeta] = useState({ lastFetch: null, limitReached: false });
  const [liveStats, setLiveStats] = useState(null);
  const [liveDocs, setLiveDocs] = useState([]);
  const [liveModalType, setLiveModalType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ibgeNaturalidadeMap, setIbgeNaturalidadeMap] = useState({});
  const [cityPoints, setCityPoints] = useState([]);
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapLayerGroupRef = useRef(null);
  const leafletRef = useRef(null);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const [remanejarTarget, setRemanejarTarget] = useState(null);

  // Refs dos charts (para destruir antes de recriar)
  const chartRefs = useRef({
    genero: null,
    prioridade: null,
    tipo: null,
    atendente: null,
    timeline: null,
    waitDist: null,
    peakHours: null,
    orientacao: null,
    religiao: null,
    faixaEtaria: null,
    naturalidade: null,
  });

  const collectionPath = `artifacts/${appId}/public/data/atendimentos`;

  // ════════════════════════════════════════════════════════════════════
  // CLEANUP GLOBAL — destrói todos os charts ao desmontar
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const refs = chartRefs.current;
    return () => {
      Object.values(refs).forEach((chart) => {
        if (chart) {
          try { chart.destroy(); } catch {}
        }
      });
    };
  }, []);

  useEffect(() => {
    if (crasRestrito) {
      setFilters(prev => ({ ...prev, cras_id: crasRestrito }));
    }
  }, [crasRestrito]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleCadFilterChange = (e) => {
    const { name, value } = e.target;
    setCadFilters(prev => ({ ...prev, [name]: value }));
    setCadPage(1);
  };

  // ════════════════════════════════════════════════════════════════════
  // BUSCA DE RELATÓRIO — getDocs (SNAPSHOT, NÃO LISTENER)
  // 
  // Decisão de eficiência: relatórios históricos NÃO mudam, então usar
  // onSnapshot aqui era desperdício puro de leituras Firebase. O usuário
  // pode clicar "Atualizar" se quiser ver mudanças do dia atual.
  // O live stats (do dia) continua sendo onSnapshot em outro effect.
  // ════════════════════════════════════════════════════════════════════
  const handleSearch = useCallback(async () => {
    if (!db) {
      setError('Banco de dados não está disponível.');
      return;
    }

    setLoading(true);
    setError(null);
    setListPage(1);

    try {
      const baseCol = collection(db, collectionPath);
      const crasEfetivo =
        (roleNorm === 'coordenador') && userProfile?.cras_id
          ? userProfile.cras_id
          : filters.cras_id !== 'todos'
            ? filters.cras_id
            : null;

      const { start: inicioDate } = getBRTRange(filters.dataInicio);
      const { end: fimDate } = getBRTRange(filters.dataFim);

      const constraints = [];
      if (crasEfetivo) constraints.push(where('cras_id', '==', crasEfetivo));
      if (filters.tipo_atendimento_id !== 'todos') constraints.push(where('tipo_atendimento_id', '==', filters.tipo_atendimento_id));
      if (filters.status !== 'todos') constraints.push(where('status', '==', filters.status));
      if (inicioDate) constraints.push(where('hora_chegada', '>=', Timestamp.fromDate(inicioDate)));
      if (fimDate) constraints.push(where('hora_chegada', '<=', Timestamp.fromDate(fimDate)));
      constraints.push(orderBy('hora_chegada', 'desc'));
      constraints.push(limit(REPORT_DOC_LIMIT));

      const q = query(baseCol, ...constraints);

      // ✅ getDocs (snapshot one-shot) em vez de onSnapshot (listener contínuo)
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const limitReached = data.length >= REPORT_DOC_LIMIT;

      // Filtros de memória
      data = data.filter((item) => {
        if (item.status === 'cancelado') return false;
        if (item.status === 'ausente') return false;
        if (isTestUser(item)) return false;
        const tipoName = (tiposAtendimento || []).find(t => t.id === item.tipo_atendimento_id)?.nome || '';
        if (tipoName.toLowerCase().includes('abordagem social')) return false;
        return true;
      });

      setReportData(data);
      setReportMeta({ lastFetch: new Date(), limitReached });
      setLoading(false);
    } catch (err) {
      console.error('Erro na busca de relatório:', err);
      if (err.code === 'failed-precondition' || String(err?.message || '').includes('index')) {
        setError('Configurando banco de dados (criando índices). Aguarde alguns minutos e tente novamente.');
      } else {
        setError(getFriendlyFirebaseError(err, 'Erro ao buscar dados do relatório.'));
      }
      setLoading(false);
    }
  }, [db, collectionPath, roleNorm, userProfile, filters, tiposAtendimento]);

  // Carregar dados ao montar e quando mudar perfil/role/cras-restrito
  useEffect(() => {
    if (!userProfile?.uid) return;
    if (Array.isArray(tiposAtendimento) && tiposAtendimento.length === 0) return;
    handleSearch();
  }, [userProfile?.uid, tiposAtendimento?.length, handleSearch]);

  const handleDeleteLive = async (id) => {
    if (!db) return;
    const confirmed = window.confirm('Tem certeza que deseja retirar este registro da fila? Ele ficará marcado como cancelado no histórico.');
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, collectionPath, id), { status: 'cancelado' });
    } catch (e) {
      console.error(e);
      alert('Erro ao remover registro.');
    }
  };

  const handleRemanejar = async (item, destino) => {
    if (!db || !item?.id) return;
    let novoTipoId = null;
    if (destino === 'cadunico') novoTipoId = cadUnicoTypeId;
    if (destino === 'psicologo') novoTipoId = psicTypeId;
    if (!novoTipoId) {
      const destinoLabel = destino === 'cadunico' ? 'CadÚnico' : 'Psicologia';
      const matchHint = destino === 'cadunico' ? 'cad / único' : 'psic';
      alert(`Não foi possível remanejar: tipo de atendimento de destino (${destinoLabel}) não está cadastrado/identificado. Cadastre um tipo contendo "${matchHint}" em Configurações > Tipos de atendimento.`);
      return;
    }
    try {
      const ref = doc(db, collectionPath, item.id);
      await updateDoc(ref, {
        status: 'aguardando',
        atendente_id: null,
        atendente_preferencial_id: null,
        tipo_atendimento_id: novoTipoId,
        hora_chamada: null,
        hora_inicio: null
      });
      await updateDoc(ref, {
        eventos: arrayUnion({
          tipo: 'transferencia',
          texto: `Transferido para ${destino === 'cadunico' ? 'CadÚnico' : 'Psicologia'}.`,
          criado_em: new Date(),
          atendente_id: userProfile?.uid || null,
          atendente_nome: userProfile?.nome || null
        })
      });
      setRemanejarTarget(null);
    } catch (e) {
      console.error(e);
      alert('Erro ao remanejar atendimento.');
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // LIVE STATS — onSnapshot SOMENTE PARA O DIA ATUAL
  // 
  // Aqui sim faz sentido ser realtime: TV/painel reflete fila ao vivo.
  // Restringido ao dia atual + limit(500) para minimizar custos.
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!db) return;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const baseCol = collection(db, collectionPath);
    const crasEfetivo =
      (roleNorm === 'coordenador') && userProfile?.cras_id
        ? userProfile.cras_id
        : filters.cras_id && filters.cras_id !== 'todos'
          ? filters.cras_id
          : null;

    const applySnapshot = (docsRaw) => {
      const docs = docsRaw.filter(d => {
        if (d.status === 'cancelado') return false;
        if (d.status === 'ausente') return false;
        if (isTestUser(d)) return false;
        const tipoName = (tiposAtendimento || []).find(t => t.id === d.tipo_atendimento_id)?.nome || '';
        return !tipoName.toLowerCase().includes('abordagem social');
      });

      setLiveDocs(prevDocs => {
        const prevIds = prevDocs.map(d => d.id).sort().join(',');
        const newIds = docs.map(d => d.id).sort().join(',');
        if (prevIds === newIds && prevDocs.length === docs.length) return prevDocs;
        return docs;
      });

      let aguardando = 0, chamando = 0, emAtendimento = 0, finalizado = 0;
      docs.forEach((d) => {
        if (d.status === 'aguardando') aguardando++;
        else if (d.status === 'chamando') chamando++;
        else if (d.status === 'em_atendimento') emAtendimento++;
        else if (d.status === 'finalizado') finalizado++;
      });

      setLiveStats({
        totalHoje: docs.length,
        aguardando,
        emAtendimento,
        chamando,
        emAndamento: chamando + emAtendimento,
        finalizado,
        cancelado: 0,
      });
    };

    let unsubFallback = null;
    let unsubMain = null;

    const constraints = [where('hora_chegada', '>=', Timestamp.fromDate(startOfToday))];
    if (crasEfetivo) constraints.push(where('cras_id', '==', crasEfetivo));
    constraints.push(orderBy('hora_chegada', 'desc'));
    constraints.push(limit(LIVE_STATS_LIMIT));
    const q = query(baseCol, ...constraints);

    unsubMain = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        applySnapshot(docs);
      },
      (err) => {
        console.error('Erro live stats principal:', err);
        if (unsubMain) unsubMain();
        if (unsubFallback) return;

        let qFallback = baseCol;
        if ((roleNorm === 'coordenador') && userProfile?.cras_id) {
          qFallback = query(qFallback, where('cras_id', '==', userProfile.cras_id), limit(100));
        } else {
          qFallback = query(qFallback, limit(100));
        }

        unsubFallback = onSnapshot(
          qFallback,
          (snapshot) => {
            const allDocs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            const docs = allDocs.filter((d) => {
              const hc = d.hora_chegada;
              if (!hc?.toDate) return false;
              if (hc.toDate() < startOfToday) return false;
              if (filters.cras_id && filters.cras_id !== 'todos' && (!userProfile?.cras_id || (roleNorm !== 'coordenador')) && d.cras_id !== filters.cras_id) {
                return false;
              }
              return true;
            });
            applySnapshot(docs);
          },
          () => setLiveStats(null)
        );
      }
    );

    return () => {
      if (unsubMain) unsubMain();
      if (unsubFallback) unsubFallback();
    };
  }, [db, collectionPath, filters.cras_id, userProfile, roleNorm, tiposAtendimento]);

  const aguardandoList = useMemo(
    () => liveDocs.filter((d) => d.status === 'aguardando'),
    [liveDocs]
  );

  const emAndamentoList = useMemo(
    () => liveDocs.filter((d) => d.status === 'chamando' || d.status === 'em_atendimento'),
    [liveDocs]
  );

  // ════════════════════════════════════════════════════════════════════
  // LOOKUPS — memoizados em Maps (O(1) em vez de O(n) por chamada)
  // ════════════════════════════════════════════════════════════════════
  const tipoById = useMemo(() => {
    const m = new Map();
    (tiposAtendimento || []).forEach((t) => { if (t?.id) m.set(t.id, t); });
    return m;
  }, [tiposAtendimento]);

  const crasById = useMemo(() => {
    const m = new Map();
    (crasUnidades || []).forEach((c) => { if (c?.id) m.set(c.id, c); });
    return m;
  }, [crasUnidades]);

  const atendenteById = useMemo(() => {
    const m = new Map();
    (atendentesList || []).forEach((a) => { if (a?.id) m.set(a.id, a); });
    return m;
  }, [atendentesList]);

  const getTipoNome = useCallback((id) => tipoById.get(id)?.nome || 'N/A', [tipoById]);
  const getCrasNome = useCallback((id) => crasById.get(id)?.nome || 'N/A', [crasById]);
  const getAtendenteNome = useCallback((id) => atendenteById.get(id)?.nome || 'Não informado', [atendenteById]);

  const cadUnicoTypeId = useMemo(() => {
    const t = (tiposAtendimento || []).find((x) => {
      const n = (x?.nome || '').toLowerCase();
      return n.includes('cad') || n.includes('único');
    });
    return t?.id || null;
  }, [tiposAtendimento]);

  const psicTypeId = useMemo(() => {
    const t = (tiposAtendimento || []).find((x) =>
      (x?.nome || '').toLowerCase().includes('psic')
    );
    return t?.id || null;
  }, [tiposAtendimento]);

  const isGestor = useMemo(
    () => ['coordenador', 'superintendente', 'admin', 'master', 'super_admin'].includes(roleNorm),
    [roleNorm]
  );

  const cadAcoesInfo = useMemo(() => {
    const actionLabels = {
      consulta: 'Consulta',
      inclusao: 'Inclusão',
      recadastro: 'Recadastro',
      transferencia: 'Transferência',
    };

    const normalizeAcoes = (item) => {
      const raw = Array.isArray(item?.cadunico_acoes) ? item.cadunico_acoes : [];
      const cleaned = raw.map((x) => String(x || '').trim()).filter(Boolean);
      const unique = Array.from(new Set(cleaned));
      const known = unique.filter((a) => Object.prototype.hasOwnProperty.call(actionLabels, a));
      const unknown = unique.filter((a) => !Object.prototype.hasOwnProperty.call(actionLabels, a));
      return { known, unknown };
    };

    const isCadunicoRegistro = (item) => {
      const { known, unknown } = normalizeAcoes(item);
      if (known.length || unknown.length) return true;
      const tipoNome = (tipoById.get(item?.tipo_atendimento_id)?.nome || '').toLowerCase();
      return tipoNome.includes('cad') || tipoNome.includes('único');
    };

    return { actionLabels, normalizeAcoes, isCadunicoRegistro };
  }, [tipoById]);

  const cadunicoBase = useMemo(() => {
    const base = (reportData || []).filter(cadAcoesInfo.isCadunicoRegistro);
    return base.map((item) => {
      const cpfDigits = String(item?.cidadao?.cpf || '').replace(/\D/g, '');
      const atendente = atendenteById.get(item?.atendente_id);
      const acoes = cadAcoesInfo.normalizeAcoes(item);
      return {
        ...item,
        cpfDigits,
        atendente_nome: atendente?.nome || 'Não informado',
        atendente_cargo: atendente?.cargo || '',
        acoes_known: acoes.known,
        acoes_unknown: acoes.unknown,
      };
    });
  }, [reportData, cadAcoesInfo, atendenteById]);

  const cadunicoFiltrado = useMemo(() => {
    let data = cadunicoBase;
    if (cadFilters.acao && cadFilters.acao !== 'todos') {
      data = data.filter((item) => (item.acoes_known || []).includes(cadFilters.acao));
    }
    if (cadFilters.servidor && cadFilters.servidor !== 'todos') {
      data = data.filter((item) => String(item.atendente_id || '') === String(cadFilters.servidor));
    }
    return data;
  }, [cadunicoBase, cadFilters]);

  const cadunicoResumo = useMemo(() => {
    const totalRegistros = cadunicoFiltrado.length;
    const cpfs = new Set();
    let semCpf = 0;
    const countsAcoes = { consulta: 0, inclusao: 0, recadastro: 0, transferencia: 0 };
    let semAcaoRegistrada = 0;
    const porServidor = new Map();

    cadunicoFiltrado.forEach((item) => {
      if (item.cpfDigits && item.cpfDigits.length === 11) cpfs.add(item.cpfDigits);
      else semCpf += 1;

      const known = Array.isArray(item.acoes_known) ? item.acoes_known : [];
      if (known.length === 0) semAcaoRegistrada += 1;
      known.forEach((a) => {
        if (Object.prototype.hasOwnProperty.call(countsAcoes, a)) countsAcoes[a] += 1;
      });

      const servidorId = item.atendente_id || 'nao_informado';
      const prev = porServidor.get(servidorId) || {
        id: servidorId,
        nome: item.atendente_nome || 'Não informado',
        cargo: item.atendente_cargo || '',
        totalRegistros: 0,
        acoes: { consulta: 0, inclusao: 0, recadastro: 0, transferencia: 0 },
      };
      prev.totalRegistros += 1;
      known.forEach((a) => {
        if (Object.prototype.hasOwnProperty.call(prev.acoes, a)) prev.acoes[a] += 1;
      });
      porServidor.set(servidorId, prev);
    });

    const servidores = Array.from(porServidor.values()).sort((a, b) => b.totalRegistros - a.totalRegistros);
    return { totalRegistros, usuariosUnicos: cpfs.size, semCpf, semAcaoRegistrada, countsAcoes, servidores };
  }, [cadunicoFiltrado]);

  const getStatusLabel = (status) => {
    const map = {
      aguardando: 'Aguardando', chamando: 'Chamando', em_atendimento: 'Em atendimento',
      finalizado: 'Finalizado', cancelado: 'Cancelado', ausente: 'Ausente'
    };
    return map[status] || status || '-';
  };

  const getStatusClass = (status) => {
    const map = {
      finalizado: 'bg-green-50 text-green-700 border-green-200',
      em_atendimento: 'bg-blue-50 text-blue-700 border-blue-200',
      chamando: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      aguardando: 'bg-yellow-50 text-yellow-800 border-yellow-200',
      ausente: 'bg-orange-50 text-orange-700 border-orange-200',
      cancelado: 'bg-red-50 text-red-700 border-red-200',
    };
    return map[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  // ════════════════════════════════════════════════════════════════════
  // ESTATÍSTICAS DO DASHBOARD
  // ════════════════════════════════════════════════════════════════════
  const stats = useMemo(() => {
    if (!reportData.length) {
      return {
        total: 0, avgWait: 0, avgService: 0,
        genero: {}, prioridade: {}, tipo: {}, atendente: {}, timeline: {},
        waitTimeDist: { '0-15 min': 0, '15-30 min': 0, '30-60 min': 0, '> 60 min': 0 },
        peakHours: {},
        cadunico: { total: 0, acoes: { consulta: 0, inclusao: 0, recadastro: 0, transferencia: 0 } },
        orientacao: {}, religiao: {}, faixaEtaria: {},
        naturalidade: {}, naturalidadeLabels: {}
      };
    }

    let totalAtendidos = 0;
    let totalWaitTimeMinutes = 0;
    let totalServiceTimeMinutes = 0;
    let countWait = 0;
    let countService = 0;

    const generoCount = {};
    const prioridadeCount = {};
    const tipoCount = {};
    const atendenteCount = {};
    const timelineCount = {};
    const waitTimeDist = { '0-15 min': 0, '15-30 min': 0, '30-60 min': 0, '> 60 min': 0 };
    const peakHours = {};
    const orientacaoCount = {};
    const religiaoCount = {};
    const faixaEtariaCount = {};
    const naturalidadeCount = {};
    const naturalidadeLabels = {};
    let totalCadunico = 0;
    const cadunicoAcoes = { consulta: 0, inclusao: 0, recadastro: 0, transferencia: 0 };

    reportData.forEach(item => {
      const tipoNameRaw = getTipoNome(item.tipo_atendimento_id);
      if (tipoNameRaw && tipoNameRaw.toLowerCase().includes('abordagem social')) return;

      totalAtendidos++;

      // Tempo de espera (chegada → chamada/início) — usando helper unificado
      const waitMin = getEsperaEmMinutos(item);
      if (waitMin > 0) {
        totalWaitTimeMinutes += waitMin;
        countWait++;
        if (waitMin <= 15) waitTimeDist['0-15 min']++;
        else if (waitMin <= 30) waitTimeDist['15-30 min']++;
        else if (waitMin <= 60) waitTimeDist['30-60 min']++;
        else waitTimeDist['> 60 min']++;
      }

      if (item.hora_chegada?.toDate) {
        const hour = item.hora_chegada.toDate().getHours();
        peakHours[hour] = (peakHours[hour] || 0) + 1;
      }

      // Tempo de atendimento (helper unificado)
      const duracaoMin = getDuracaoEmMinutos(item);
      if (duracaoMin > 0 && duracaoMin < 480) {
        totalServiceTimeMinutes += duracaoMin;
        countService++;
      }

      const sexo = item.cidadao?.sexo || 'Não informado';
      generoCount[sexo] = (generoCount[sexo] || 0) + 1;

      const orientacao = item.cidadao?.orientacaoSexual || 'Não informado';
      orientacaoCount[orientacao] = (orientacaoCount[orientacao] || 0) + 1;

      const religiao = item.cidadao?.religiao || 'Não informado';
      religiaoCount[religiao] = (religiaoCount[religiao] || 0) + 1;

      const idade = getAgeFromBRDate(item.cidadao?.dataNascimento);
      const faixa = idade === null ? 'Não informado' : getAgeGroup(idade);
      faixaEtariaCount[faixa] = (faixaEtariaCount[faixa] || 0) + 1;

      const nat = String(item.cidadao?.naturalidade || '').trim();
      const uf = String(item.cidadao?.uf || '').trim().toUpperCase();
      let naturalidadeKey = 'Não informado';
      let naturalidadeLabel = 'Não informado';
      if (nat && uf) {
        const simp = simplify(nat);
        const resolved = ibgeNaturalidadeMap?.[`${uf}|${simp}`] || null;
        if (resolved?.id) {
          naturalidadeKey = `${uf}|IBGE:${resolved.id}`;
          naturalidadeLabel = `${resolved.nome}/${uf} (${resolved.id})`;
        } else {
          naturalidadeKey = `${uf}|${simp}`;
          naturalidadeLabel = `${nat}/${uf}`;
        }
      } else if (nat) {
        naturalidadeKey = `NO_UF|${simplify(nat)}`;
        naturalidadeLabel = nat;
      }
      naturalidadeCount[naturalidadeKey] = (naturalidadeCount[naturalidadeKey] || 0) + 1;
      if (!naturalidadeLabels[naturalidadeKey]) naturalidadeLabels[naturalidadeKey] = naturalidadeLabel;

      const prioridade = item.cidadao?.prioridade || 'Nenhuma';
      prioridadeCount[prioridade] = (prioridadeCount[prioridade] || 0) + 1;

      const tipoName = getTipoNome(item.tipo_atendimento_id);
      tipoCount[tipoName] = (tipoCount[tipoName] || 0) + 1;

      if (item.atendente_id) {
        const nome = atendenteById.get(item.atendente_id)?.nome || item.atendente_id;
        atendenteCount[nome] = (atendenteCount[nome] || 0) + 1;
      }

      if (item.hora_chegada?.toDate) {
        const dateStr = item.hora_chegada.toDate().toLocaleDateString('pt-BR');
        timelineCount[dateStr] = (timelineCount[dateStr] || 0) + 1;
      }

      if (Array.isArray(item.cadunico_acoes) && item.cadunico_acoes.length > 0) {
        totalCadunico += 1;
        item.cadunico_acoes.forEach((acao) => {
          if (Object.prototype.hasOwnProperty.call(cadunicoAcoes, acao)) cadunicoAcoes[acao] += 1;
        });
      }
    });

    const groupRare = (obj, minCount) => {
      const out = {};
      let outros = 0;
      Object.entries(obj || {}).forEach(([k, v]) => {
        if (k === 'Não informado') { out[k] = v; return; }
        if (typeof v !== 'number' || Number.isNaN(v)) return;
        if (v < minCount) outros += v;
        else out[k] = v;
      });
      if (outros > 0) out.Outros = (out.Outros || 0) + outros;
      return out;
    };

    return {
      total: totalAtendidos,
      avgWait: countWait ? Math.round(totalWaitTimeMinutes / countWait) : 0,
      avgService: countService ? Math.round(totalServiceTimeMinutes / countService) : 0,
      genero: generoCount,
      orientacao: groupRare(orientacaoCount, 3),
      religiao: groupRare(religiaoCount, 3),
      faixaEtaria: faixaEtariaCount,
      naturalidade: naturalidadeCount,
      naturalidadeLabels,
      prioridade: prioridadeCount,
      tipo: tipoCount,
      atendente: atendenteCount,
      timeline: timelineCount,
      waitTimeDist,
      peakHours,
      cadunico: { total: totalCadunico, acoes: cadunicoAcoes }
    };
  }, [reportData, ibgeNaturalidadeMap, getTipoNome, atendenteById]);

  // ════════════════════════════════════════════════════════════════════
  // RESOLUÇÃO IBGE DE NATURALIDADE (com cache + fuzzy match)
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let cancelled = false;
    const levenshtein = (a, b) => {
      if (a === b) return 0;
      const la = a.length, lb = b.length;
      if (la === 0) return lb;
      if (lb === 0) return la;
      const v0 = new Array(lb + 1), v1 = new Array(lb + 1);
      for (let i = 0; i <= lb; i++) v0[i] = i;
      for (let i = 0; i < la; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < lb; j++) {
          const cost = a[i] === b[j] ? 0 : 1;
          v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        for (let j = 0; j <= lb; j++) v0[j] = v1[j];
      }
      return v0[lb];
    };

    const maxDistFor = (s) => {
      const len = s.length;
      if (len <= 4) return 0;
      if (len <= 7) return 1;
      if (len <= 12) return 2;
      return 3;
    };

    const run = async () => {
      const pairs = new Map();
      reportData.forEach((item) => {
        const tipoName = getTipoNome(item.tipo_atendimento_id);
        if (tipoName && tipoName.toLowerCase().includes('abordagem social')) return;
        const nat = String(item.cidadao?.naturalidade || '').trim();
        const uf = String(item.cidadao?.uf || '').trim().toUpperCase();
        if (!nat || !uf || uf.length !== 2) return;
        const key = `${uf}|${simplify(nat)}`;
        pairs.set(key, { uf, nat });
      });
      if (!pairs.size) {
        if (!cancelled) setIbgeNaturalidadeMap({});
        return;
      }
      const byUf = new Map();
      for (const { uf, nat } of pairs.values()) {
        if (!byUf.has(uf)) byUf.set(uf, new Map());
        byUf.get(uf).set(simplify(nat), nat);
      }
      const nextMap = {};
      for (const [uf, natMap] of byUf.entries()) {
        const municipios = await getIBGEMunicipiosByUF(uf);
        if (!municipios.length) continue;
        const munIndex = new Map(municipios.map((m) => [simplify(m.nome), m]));
        const munKeys = Array.from(munIndex.keys());
        for (const [simp, rawName] of natMap.entries()) {
          let found = munIndex.get(simp) || null;
          let matchType = 'exact';
          if (!found) {
            const maxDist = maxDistFor(simp);
            if (maxDist > 0) {
              let best = null, bestDist = Infinity;
              for (const candidate of munKeys) {
                const dist = levenshtein(simp, candidate);
                if (dist < bestDist) {
                  bestDist = dist;
                  best = candidate;
                  if (bestDist === 1) break;
                }
              }
              if (best && bestDist <= maxDist) {
                found = munIndex.get(best) || null;
                matchType = 'fuzzy';
              }
            }
          }
          if (!found) continue;
          nextMap[`${uf}|${simp}`] = { uf, nome: found.nome, id: found.id, raw: rawName, matchType };
        }
      }
      if (!cancelled) setIbgeNaturalidadeMap(nextMap);
    };
    run();
    return () => { cancelled = true; };
  }, [reportData, getTipoNome]);

  // ════════════════════════════════════════════════════════════════════
  // CRIAÇÃO DE CHARTS — com cleanup adequado
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (activeTab !== 'dashboard' || !stats) return;

    const createChart = (canvasId, refKey, type, data, options) => {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;
      if (chartRefs.current[refKey]) {
        try { chartRefs.current[refKey].destroy(); } catch {}
      }
      chartRefs.current[refKey] = new Chart(ctx, {
        type,
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          ...options
        }
      });
    };

    createChart('chart-genero', 'genero', 'doughnut', {
      labels: Object.keys(stats.genero).map(k => k === 'M' ? 'Masculino' : k === 'F' ? 'Feminino' : k),
      datasets: [{ data: Object.values(stats.genero), backgroundColor: ['#3B82F6', '#EC4899', '#9CA3AF', '#F59E0B'], borderWidth: 0 }]
    }, { cutout: '60%' });

    createChart('chart-tipo', 'tipo', 'bar', {
      labels: Object.keys(stats.tipo),
      datasets: [{ label: 'Atendimentos', data: Object.values(stats.tipo), backgroundColor: '#3B82F6', borderRadius: 4 }]
    }, {
      indexAxis: 'y',
      scales: { x: { beginAtZero: true } },
      plugins: { legend: { display: false } }
    });

    const sortedDates = Object.keys(stats.timeline).sort((a, b) => {
      const [da, ma, ya] = a.split('/');
      const [dbb, mb, yb] = b.split('/');
      return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, dbb);
    });

    createChart('chart-timeline', 'timeline', 'line', {
      labels: sortedDates,
      datasets: [{
        label: 'Volume Diário',
        data: sortedDates.map(d => stats.timeline[d]),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3
      }]
    }, { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } });

    const waitLabels = Object.keys(stats.waitTimeDist || {});
    if (waitLabels.length > 0) {
      createChart('chart-wait-dist', 'waitDist', 'bar', {
        labels: waitLabels,
        datasets: [{ label: 'Atendimentos', data: waitLabels.map(k => stats.waitTimeDist[k]), backgroundColor: '#6366F1', borderRadius: 4 }]
      }, {
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: { legend: { display: false } }
      });
    }

    const hourKeys = Object.keys(stats.peakHours || {}).sort((a, b) => Number(a) - Number(b));
    if (hourKeys.length > 0) {
      createChart('chart-peak-hours', 'peakHours', 'bar', {
        labels: hourKeys.map(h => `${h}h`),
        datasets: [{ label: 'Atendimentos', data: hourKeys.map(h => stats.peakHours[h]), backgroundColor: '#F97316', borderRadius: 4 }]
      }, {
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: { legend: { display: false } }
      });
    }

    createChart('chart-orientacao', 'orientacao', 'bar', {
      labels: Object.keys(stats.orientacao),
      datasets: [{
        label: 'Quantidade',
        data: Object.values(stats.orientacao),
        backgroundColor: ['#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#6366F1'],
        borderRadius: 4
      }]
    }, {
      indexAxis: 'y',
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } }
    });

    createChart('chart-religiao', 'religiao', 'doughnut', {
      labels: Object.keys(stats.religiao),
      datasets: [{
        data: Object.values(stats.religiao),
        backgroundColor: ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#9CA3AF'],
        borderWidth: 0
      }]
    }, { cutout: '50%' });

    const faixaOrder = ['0-5', '6-12', '13-17', '18-24', '25-34', '35-44', '45-59', '60+', 'Não informado'];
    const faixaLabels = faixaOrder.filter((k) => stats.faixaEtaria && Object.prototype.hasOwnProperty.call(stats.faixaEtaria, k));
    const extraFaixas = Object.keys(stats.faixaEtaria || {}).filter((k) => !faixaLabels.includes(k));
    const finalFaixaLabels = [...faixaLabels, ...extraFaixas];
    if (finalFaixaLabels.length > 0) {
      createChart('chart-faixa-etaria', 'faixaEtaria', 'bar', {
        labels: finalFaixaLabels,
        datasets: [{ label: 'Pessoas', data: finalFaixaLabels.map((k) => stats.faixaEtaria[k] || 0), backgroundColor: '#0EA5E9', borderRadius: 4 }]
      }, {
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: { legend: { display: false } }
      });
    }

    const natEntries = Object.entries(stats.naturalidade || {}).sort((a, b) => b[1] - a[1]);
    if (natEntries.length > 0) {
      const top = natEntries.slice(0, 10);
      const rest = natEntries.slice(10);
      const labels = top.map(([k]) => {
        if (k === 'Não informado') return 'Não informado';
        if (k.startsWith('NO_UF|')) return stats.naturalidadeLabels?.[k] || 'Não informado';
        if (String(k).includes('|IBGE:')) return stats.naturalidadeLabels?.[k] || 'Não informado';
        const [uf, simp] = String(k).split('|');
        const ibge = ibgeNaturalidadeMap?.[`${uf}|${simp}`];
        const base = stats.naturalidadeLabels?.[k] || `${simp}/${uf}`;
        if (!ibge?.nome) return base;
        return `${ibge.nome}/${uf}${ibge.id ? ` (${ibge.id})` : ''}`;
      });
      const values = top.map(([, v]) => v);
      if (rest.length > 0) {
        labels.push('Outros');
        values.push(rest.reduce((sum, [, v]) => sum + v, 0));
      }
      createChart('chart-naturalidade', 'naturalidade', 'bar', {
        labels,
        datasets: [{ label: 'Pessoas', data: values, backgroundColor: '#22C55E', borderRadius: 4 }]
      }, {
        indexAxis: 'y',
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: { legend: { display: false } }
      });
    }
  }, [stats, activeTab, ibgeNaturalidadeMap]);

  // ════════════════════════════════════════════════════════════════════
  // MAPA DE CIDADES (Leaflet)
  // ════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (activeTab !== 'mapa') return;
    const entries = Object.entries(stats?.naturalidade || {}).filter(([k]) => k !== 'Não informado');
    if (!entries.length) {
      setCityPoints([]);
      return;
    }
    const byCount = entries.sort((a, b) => b[1] - a[1]).slice(0, 20);
    const cacheRaw = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('geo_city_cache_v1') : null;
    const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
    const tasks = byCount.map(async ([key, count]) => {
      let uf = '', nome = '';
      if (key.startsWith('NO_UF|')) {
        nome = stats.naturalidadeLabels?.[key] || key.slice('NO_UF|'.length);
      } else if (String(key).includes('|IBGE:')) {
        const label = stats.naturalidadeLabels?.[key] || '';
        const parts = label.split('/');
        nome = parts[0] || '';
        uf = parts[1]?.split(' ')[0] || '';
      } else {
        const parts = String(key).split('|');
        uf = parts[0] || '';
        const simp = parts[1] || '';
        const ibge = ibgeNaturalidadeMap?.[`${uf}|${simp}`];
        nome = ibge?.nome || stats.naturalidadeLabels?.[key] || simp;
      }
      const cacheKey = `${nome}|${uf}`;
      let lat = cache?.[cacheKey]?.lat || null;
      let lon = cache?.[cacheKey]?.lon || null;
      if (!lat || !lon) {
        try {
          const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(nome)}&state=${encodeURIComponent(uf)}&country=Brazil&format=json&limit=1`;
          const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json) && json.length > 0) {
              lat = Number(json[0].lat);
              lon = Number(json[0].lon);
              cache[cacheKey] = { lat, lon };
            }
          }
        } catch {}
      }
      return { label: `${nome}/${uf}`.trim(), uf, count, lat, lon };
    });
    Promise.all(tasks).then((pts) => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('geo_city_cache_v1', JSON.stringify(cache));
        }
      } catch {}
      setCityPoints(pts.filter(p => typeof p.lat === 'number' && typeof p.lon === 'number'));
    });
  }, [activeTab, stats, ibgeNaturalidadeMap]);

  useEffect(() => {
    const destroyMap = () => {
      const container = mapContainerRef.current;
      if (mapRef.current) {
        try { mapRef.current.off(); } catch {}
        try { mapRef.current.remove(); } catch {}
      }
      mapRef.current = null;
      mapLayerGroupRef.current = null;
      if (container) {
        try { container.innerHTML = ''; } catch {}
        if (container._leaflet_id) {
          try { delete container._leaflet_id; } catch { container._leaflet_id = undefined; }
        }
      }
    };

    if (activeTab !== 'mapa') {
      destroyMap();
      return;
    }
    if (!mapContainerRef.current) return;

    let cancelled = false;
    const run = async () => {
      const L = await import('leaflet');
      leafletRef.current = L;
      if (cancelled) return;

      const container = mapContainerRef.current;
      if (!container) return;

      if (container._leaflet_id && !mapRef.current) {
        try { delete container._leaflet_id; } catch { container._leaflet_id = undefined; }
      }

      if (mapRef.current) {
        try {
          const currentContainer = mapRef.current.getContainer?.();
          if (currentContainer && currentContainer !== container) {
            destroyMap();
          }
        } catch {}
      }

      if (!mapRef.current) {
        mapRef.current = L.map(container).setView([-15.78, -47.93], 4);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, crossOrigin: true, attribution: '&copy; OpenStreetMap contributors' }).addTo(mapRef.current);
        setMapReadyTick((v) => v + 1);
      } else {
        setMapReadyTick((v) => v + 1);
      }
    };

    run().catch((e) => {
      console.error(e);
      setError(getFriendlyFirebaseError(e, 'Erro ao carregar o mapa.'));
    });

    return () => {
      cancelled = true;
      destroyMap();
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'mapa') return;
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (mapLayerGroupRef.current) {
      try { map.removeLayer(mapLayerGroupRef.current); } catch {}
      mapLayerGroupRef.current = null;
    }

    const group = L.layerGroup();
    cityPoints.forEach((p) => {
      const radius = Math.max(6, Math.min(24, 6 + Math.log(1 + p.count) * 6));
      const marker = L.circleMarker([p.lat, p.lon], { radius, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.6 });
      marker.bindPopup(`${p.label} · ${p.count}`);
      group.addLayer(marker);
    });
    group.addTo(map);
    mapLayerGroupRef.current = group;

    if (cityPoints.length) {
      const bounds = L.latLngBounds(cityPoints.map(p => [p.lat, p.lon]));
      map.fitBounds(bounds.pad(0.2));
    }
  }, [activeTab, cityPoints, mapReadyTick]);

  // ════════════════════════════════════════════════════════════════════
  // EXPORTS — usando os MESMOS helpers de duração e espera (consistência)
  // ════════════════════════════════════════════════════════════════════
  const getRelatorioUnidadeTexto = () => {
    if (crasRestrito) return getCrasNome(crasRestrito);
    if (filters.cras_id && filters.cras_id !== 'todos') return getCrasNome(filters.cras_id);
    return 'Todas as unidades';
  };

  const getRelatorioPeriodoTexto = () => {
    return `${filters.dataInicio || '...'} até ${filters.dataFim || '...'}`;
  };

  const addPdfHeader = (doc, titulo) => {
    const responsavel = userProfile?.nome || userProfile?.email || '';
    const cargo = userProfile?.role || '';

    doc.setFillColor(19, 81, 180);
    doc.rect(0, 0, 210, 26, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('Centro Pop Centro – São Luís/MA', 14, 12);
    doc.setFontSize(11);
    doc.text('SEMCAS | Sistema de Atendimento', 14, 20);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(16);
    doc.text(titulo, 14, 38);

    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    doc.text(`Unidade: ${getRelatorioUnidadeTexto()}`, 14, 45);
    doc.text(`Período: ${getRelatorioPeriodoTexto()}`, 14, 50);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 55);
    if (responsavel) {
      doc.text(`Responsável: ${responsavel}${cargo ? ` (${cargo})` : ''}`, 14, 60);
      return 66;
    }
    return 62;
  };

  const handleExportPDF = async () => {
    if (reportData.length === 0) return;

    try {
      await logAdminAction(db, appId, userProfile, 'EXPORT_RELATORIO_PDF', 'Exportação de relatório PDF', { count: reportData.length, filters });
    } catch (e) { console.error('Erro ao registrar log de exportação', e); }

    const doc = new jsPDF();
    const startYBase = addPdfHeader(doc, 'Relatório de Atendimentos');

    let y = startYBase;
    if (stats?.cadunico) {
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39);
      doc.text('Resumo CadÚnico:', 14, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      doc.text(`Consulta: ${stats.cadunico.acoes.consulta}`, 20, y); y += 6;
      doc.text(`Inclusão: ${stats.cadunico.acoes.inclusao}`, 20, y); y += 6;
      doc.text(`Recadastro: ${stats.cadunico.acoes.recadastro}`, 20, y); y += 6;
      doc.text(`Transferência: ${stats.cadunico.acoes.transferencia}`, 20, y); y += 6;
    }

    const tableColumn = ['Data/Hora', 'Cidadão', 'Idade', 'Cidade natal', 'Tipo', 'Status', 'Espera', 'Duração', 'Ações CadÚnico', 'Servidor', 'Local'];
    const tableRows = [];

    reportData.forEach(item => {
      const tipoName = getTipoNome(item.tipo_atendimento_id);
      if (tipoName?.toLowerCase().includes('abordagem social')) return;

      const waitMin = getEsperaEmMinutos(item);
      const duracaoMin = getDuracaoEmMinutos(item);

      let acoes = '';
      if (Array.isArray(item.cadunico_acoes)) {
        acoes = item.cadunico_acoes.map(a =>
          a === 'consulta' ? 'Consulta' :
          a === 'inclusao' ? 'Inclusão' :
          a === 'recadastro' ? 'Recadastro' :
          a === 'transferencia' ? 'Transferência' : a
        ).join(', ');
      }

      const idade = getAgeFromBRDate(item.cidadao?.dataNascimento);
      const nat = String(item.cidadao?.naturalidade || '').trim();
      const uf = String(item.cidadao?.uf || '').trim().toUpperCase();
      const natKey = nat && uf ? `${uf}|${simplify(nat)}` : '';
      const ibge = natKey ? ibgeNaturalidadeMap[natKey] : null;
      const cidadeNatal = nat && uf ? `${ibge?.nome || nat}/${uf}${ibge?.id ? ` (${ibge.id})` : ''}` : nat || '';

      tableRows.push([
        formatDateTime(item.hora_chegada),
        item.cidadao?.nome || item.nome_exibicao || 'Não informado',
        idade === null ? '' : String(idade),
        cidadeNatal,
        tipoName,
        item.status,
        waitMin > 0 ? `${waitMin} min` : '',
        duracaoMin > 0 ? `${duracaoMin} min` : '',
        acoes,
        getAtendenteNome(item.atendente_id),
        item.atendente_guiche || ''
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: y + 4,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [19, 81, 180] }
    });

    doc.save(`relatorio_atendimentos_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleExportCSV = async () => {
    if (reportData.length === 0) return;

    try {
      await logAdminAction(db, appId, userProfile, 'EXPORT_RELATORIO_CSV', 'Exportação de relatório CSV', { count: reportData.length, filters });
    } catch (e) { console.error('Erro ao registrar log de exportação', e); }

    const headers = [
      'ID', 'DataHoraChegada', 'NomeCidadao', 'CPFCidadao', 'Sexo', 'Prioridade',
      'CRAS', 'TipoAtendimento', 'Status', 'AtendenteID', 'AtendenteNome', 'Local',
      'TempoEspera(min)', 'Duracao(min)', 'DataNascimento', 'Idade', 'FaixaEtaria',
      'Naturalidade', 'UFNaturalidade', 'CodigoMunicipioIBGE', 'Religiao', 'OrientacaoSexual',
      'Observacoes', 'Eventos'
    ];

    const csvContent = [
      headers.join(','),
      ...reportData
        .filter(item => {
          const tipoName = getTipoNome(item.tipo_atendimento_id);
          return !tipoName?.toLowerCase().includes('abordagem social');
        })
        .map(item => {
          const wait = getEsperaEmMinutos(item);
          const duration = getDuracaoEmMinutos(item);
          const idade = getAgeFromBRDate(item.cidadao?.dataNascimento);
          const faixa = idade === null ? '' : getAgeGroup(idade);
          const nat = String(item.cidadao?.naturalidade || '').trim();
          const uf = String(item.cidadao?.uf || '').trim().toUpperCase();
          const natKey = nat && uf ? `${uf}|${simplify(nat)}` : '';
          const ibge = natKey ? ibgeNaturalidadeMap[natKey] : null;

          const row = [
            item.id,
            formatDateTime(item.hora_chegada),
            item.cidadao?.nome || '',
            item.cidadao?.cpf || '',
            item.cidadao?.sexo || '',
            item.cidadao?.prioridade || '',
            getCrasNome(item.cras_id),
            getTipoNome(item.tipo_atendimento_id),
            item.status,
            item.atendente_id || '',
            getAtendenteNome(item.atendente_id),
            item.atendente_guiche || '',
            wait,
            duration,
            item.cidadao?.dataNascimento || '',
            idade === null ? '' : idade,
            faixa,
            nat || '',
            uf || '',
            ibge?.id || '',
            item.cidadao?.religiao || '',
            item.cidadao?.orientacaoSexual || '',
            item.observacoes || '',
            (() => {
              const eventos = Array.isArray(item.eventos)
                ? item.eventos.map(e => e?.texto || e?.tipo).filter(Boolean)
                : [];
              return eventos.length ? JSON.stringify(eventos) : '';
            })()
          ];
          return row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_atendimentos_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    safeRemoveChild(document.body, link);
  };

  const handleExportCadunicoCSV = async () => {
    if (!cadunicoFiltrado.length) return;

    try {
      await logAdminAction(db, appId, userProfile, 'EXPORT_CADUNICO_CSV', 'Exportação de relatório CadÚnico CSV', { count: cadunicoFiltrado.length, filters: cadFilters });
    } catch (e) { console.error('Erro ao registrar log de exportação', e); }

    const headers = ['DataHoraChegada', 'NomeCidadao', 'CPF', 'AcoesCadUnico', 'Servidor', 'Local', 'Status', 'Duracao(min)', 'Observacoes', 'Eventos'];
    const labelAcao = (a) => cadAcoesInfo.actionLabels[a] || a;

    const rows = cadunicoFiltrado.map((item) => {
      const acoes = item.acoes_known?.length ? item.acoes_known.map(labelAcao).join(' | ') : 'Sem ação registrada';
      const cpf = item.cpfDigits ? maskCPF(item.cpfDigits) : '';
      const obs = `${item.observacoes || ''}${item.cadunico_observacao ? `${item.observacoes ? ' ' : ''}[CadÚnico] ${item.cadunico_observacao}` : ''}`;
      const duracaoMin = getDuracaoEmMinutos(item);
      return [
        formatDateTime(item.hora_chegada),
        item.cidadao?.nome || item.nome_exibicao || 'Não informado',
        cpf,
        acoes,
        item.atendente_nome || '',
        item.atendente_guiche || '',
        item.status || '',
        duracaoMin,
        obs,
        (() => {
          const eventos = Array.isArray(item.eventos)
            ? item.eventos.map(e => e?.texto || e?.tipo).filter(Boolean)
            : [];
          return eventos.length ? JSON.stringify(eventos) : '';
        })(),
      ];
    });

    const escapeField = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(r => r.map(escapeField).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_cadunico_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    safeRemoveChild(document.body, link);
  };

  const handleExportCadunicoPDF = async () => {
    if (!cadunicoFiltrado.length) return;

    try {
      await logAdminAction(db, appId, userProfile, 'EXPORT_CADUNICO_PDF', 'Exportação de relatório CadÚnico PDF', { count: cadunicoFiltrado.length, filters: cadFilters });
    } catch (e) { console.error('Erro ao registrar log de exportação', e); }

    const doc = new jsPDF();
    const startYBase = addPdfHeader(doc, 'Relatório CadÚnico');

    const resumoRows = [
      ['Registros (CadÚnico)', String(cadunicoResumo.totalRegistros)],
      ['Usuários únicos (CPF)', String(cadunicoResumo.usuariosUnicos)],
      ['Sem CPF', String(cadunicoResumo.semCpf)],
      ['Sem ação registrada', String(cadunicoResumo.semAcaoRegistrada)],
      ['Consultas', String(cadunicoResumo.countsAcoes.consulta)],
      ['Inclusões', String(cadunicoResumo.countsAcoes.inclusao)],
      ['Recadastros', String(cadunicoResumo.countsAcoes.recadastro)],
      ['Transferências', String(cadunicoResumo.countsAcoes.transferencia)],
    ];

    autoTable(doc, {
      head: [['Resumo', 'Total']],
      body: resumoRows,
      startY: startYBase,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [19, 81, 180] },
      theme: 'grid',
    });

    const yAfterResumo = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : 80;
    const servidores = cadunicoResumo.servidores.slice(0, 20).map((s) => ([
      s.nome, s.cargo || '', String(s.totalRegistros),
      String(s.acoes.consulta), String(s.acoes.inclusao),
      String(s.acoes.recadastro), String(s.acoes.transferencia),
    ]));

    autoTable(doc, {
      head: [['Servidor', 'Cargo', 'Registros', 'Consulta', 'Inclusão', 'Recadastro', 'Transferência']],
      body: servidores,
      startY: yAfterResumo,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [19, 81, 180] },
      theme: 'grid',
    });

    const yAfterServ = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 8 : yAfterResumo + 60;
    const labelAcao = (a) => cadAcoesInfo.actionLabels[a] || a;
    const detalheRows = cadunicoFiltrado.map((item) => {
      const acoes = item.acoes_known?.length ? item.acoes_known.map(labelAcao).join(', ') : 'Sem ação';
      const cpf = item.cpfDigits ? maskCPF(item.cpfDigits) : '';
      const duracaoMin = getDuracaoEmMinutos(item);
      return [
        formatDateTime(item.hora_chegada),
        item.cidadao?.nome || item.nome_exibicao || 'Não informado',
        cpf, acoes,
        item.atendente_nome || '',
        item.atendente_guiche || '',
        `${duracaoMin} min`,
      ];
    });

    autoTable(doc, {
      head: [['Data/Hora', 'Cidadão', 'CPF', 'Ação', 'Servidor', 'Local', 'Duração']],
      body: detalheRows,
      startY: yAfterServ,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [19, 81, 180] },
      theme: 'striped',
    });

    doc.save(`relatorio_cadunico_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ════════════════════════════════════════════════════════════════════
  // PAGINAÇÃO DA TABELA DE DETALHES
  // ════════════════════════════════════════════════════════════════════
  const totalListPages = Math.max(1, Math.ceil(reportData.length / LIST_PAGE_SIZE));
  const reportDataPaged = useMemo(
    () => reportData.slice((listPage - 1) * LIST_PAGE_SIZE, listPage * LIST_PAGE_SIZE),
    [reportData, listPage]
  );

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <LayoutDashboard className="text-blue-600" />
            Painel de Gestão
          </h1>
          <p className="text-gray-500 mt-1">Visão geral e relatórios detalhados do sistema</p>
        </div>
        <div className="flex flex-wrap bg-gray-100 p-1 rounded-lg">
          {[
            { key: 'dashboard', icon: BarChart2, label: 'Painel' },
            { key: 'list', icon: List, label: 'Detalhado' },
            { key: 'cadunico', icon: PieChart, label: 'CadÚnico' },
            { key: 'mapa', icon: MapPin, label: 'Mapa' },
            { key: 'analises', icon: TrendingUp, label: 'Análises' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live stats — DADOS EM TEMPO REAL DO DIA */}
      {liveStats && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Ao vivo · Hoje</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <button
              type="button"
              onClick={() => setLiveModalType('andamento')}
              className="bg-blue-600 text-white p-6 rounded-xl shadow-sm flex items-start justify-between text-left cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-transform"
            >
              <div>
                <p className="text-sm font-medium opacity-80">Em atendimento agora</p>
                <h3 className="text-3xl font-bold mt-2">{liveStats.emAndamento}</h3>
                <p className="text-xs opacity-80 mt-1">Chamados + em atendimento</p>
              </div>
              <div className="p-3 bg-white/10 rounded-lg"><Clock size={24} /></div>
            </button>

            <button
              type="button"
              onClick={() => setLiveModalType('aguardando')}
              className="bg-yellow-500 text-white p-6 rounded-xl shadow-sm flex items-start justify-between text-left cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-transform"
            >
              <div>
                <p className="text-sm font-medium opacity-80">Aguardando na recepção</p>
                <h3 className="text-3xl font-bold mt-2">{liveStats.aguardando}</h3>
                <p className="text-xs opacity-80 mt-1">Fila atual de espera</p>
              </div>
              <div className="p-3 bg-white/10 rounded-lg"><Hourglass size={24} /></div>
            </button>

            <div className="bg-emerald-600 text-white p-6 rounded-xl shadow-sm flex items-start justify-between">
              <div>
                <p className="text-sm font-medium opacity-80">Concluídos hoje</p>
                <h3 className="text-3xl font-bold mt-2">{liveStats.finalizado}</h3>
                <p className="text-xs opacity-80 mt-1">Somente finalizados no dia</p>
              </div>
              <div className="p-3 bg-white/10 rounded-lg"><Users size={24} /></div>
            </div>

            <div className="bg-gray-800 text-white p-6 rounded-xl shadow-sm flex items-start justify-between">
              <div>
                <p className="text-sm font-medium opacity-80">Total movimentado hoje</p>
                <h3 className="text-3xl font-bold mt-2">{liveStats.totalHoje}</h3>
                <p className="text-xs opacity-80 mt-1">Todos os registros do dia</p>
              </div>
              <div className="p-3 bg-white/10 rounded-lg"><Calendar size={24} /></div>
            </div>
          </div>
        </>
      )}

      {/* Filtros */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <Filter size={20} />
            <h2>Filtros do Relatório</h2>
          </div>
          {reportMeta.lastFetch && (
            <span className="text-xs text-gray-500">
              Atualizado em {reportMeta.lastFetch.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">De</label>
            <input
              type="text" name="dataInicio" value={filters.dataInicio}
              onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: formatBRDateTyping(e.target.value) }))}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              inputMode="numeric" placeholder="dd/mm/aaaa"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Até</label>
            <input
              type="text" name="dataFim" value={filters.dataFim}
              onChange={(e) => setFilters(prev => ({ ...prev, dataFim: formatBRDateTyping(e.target.value) }))}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              inputMode="numeric" placeholder="dd/mm/aaaa"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Unidade</label>
            <select
              name="cras_id"
              value={crasRestrito ? crasRestrito : filters.cras_id}
              onChange={handleChange} disabled={!!crasRestrito}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-600"
            >
              <option value={crasRestrito ? crasRestrito : 'todos'}>{crasRestrito ? 'Somente sua unidade' : 'Todas as Unidades'}</option>
              {crasUnidades.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Tipo</label>
            <select
              name="tipo_atendimento_id" value={filters.tipo_atendimento_id} onChange={handleChange}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="todos">Todos os Tipos</option>
              {tiposAtendimento.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Status</label>
            <select
              name="status" value={filters.status} onChange={handleChange}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="aguardando">Aguardando</option>
              <option value="chamando">Chamando</option>
              <option value="em_atendimento">Em atendimento</option>
              <option value="finalizado">Finalizado</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleSearch} disabled={loading}
              className="flex-1 p-2.5 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              title="Buscar dados conforme filtros"
            >
              {loading ? <Loader className="animate-spin" size={18} /> : <><RefreshCw size={16} /> Buscar</>}
            </button>
          </div>
        </div>
        {reportMeta.limitReached && (
          <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              <strong>Limite de {REPORT_DOC_LIMIT} registros atingido.</strong> Refine os filtros (período menor, unidade específica) para garantir que todos os dados sejam considerados.
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <AlertCircle size={18} />
          <span><strong>Erro:</strong> {error}</span>
        </div>
      )}

      {/* MAPA */}
      {activeTab === 'mapa' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div ref={mapContainerRef} style={{ width: '100%', height: '520px', borderRadius: '0.75rem' }} />
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Top cidades</h3>
            <ul className="space-y-2">
              {cityPoints.slice(0, 20).map((p) => (
                <li key={`${p.label}-${p.uf}`} className="flex items-center justify-between text-sm text-gray-700">
                  <span>{p.label}</span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">{p.count}</span>
                </li>
              ))}
              {cityPoints.length === 0 && (
                <li className="text-sm text-gray-500">Sem dados de cidade para o período/seleção.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* MODAL LIVE (aguardando / em andamento) */}
      {liveModalType && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setLiveModalType(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {liveModalType === 'aguardando' ? 'Usuários aguardando na recepção' : 'Usuários em atendimento ao vivo'}
                </h2>
                <p className="text-xs text-gray-500 mt-1">Clique em remover para excluir manualmente um registro.</p>
              </div>
              <button type="button" onClick={() => setLiveModalType(null)} className="text-sm text-gray-500 hover:text-gray-800">Fechar</button>
            </div>
            <div className="p-4 overflow-auto">
              {(() => {
                const list = liveModalType === 'aguardando' ? aguardandoList : emAndamentoList;
                if (!list.length) {
                  return <div className="py-10 text-center text-gray-500 text-sm">Nenhum registro encontrado para este grupo.</div>;
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-sm text-left text-gray-600">
                      <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                        <tr>
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">Chegada</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {list.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2">{item.cidadao?.nome || 'Sem nome'}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {item.hora_chegada?.toDate ? formatDateTime(item.hora_chegada.toDate()) : '-'}
                            </td>
                            <td className="px-3 py-2">{getTipoNome(item.tipo_atendimento_id)}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${getStatusClass(item.status)}`}>
                                {getStatusLabel(item.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button" onClick={() => handleDeleteLive(item.id)}
                                className="px-3 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700"
                              >
                                Remover
                              </button>
                              {isGestor && (
                                <span className="inline-flex items-center gap-2 ml-2">
                                  {remanejarTarget?.id === item.id ? (
                                    <>
                                      <button type="button" onClick={() => handleRemanejar(item, 'psicologo')} className="px-3 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700">Psicologia</button>
                                      <button type="button" onClick={() => handleRemanejar(item, 'cadunico')} className="px-3 py-1 text-xs rounded-md bg-cyan-600 text-white hover:bg-cyan-700">CadÚnico</button>
                                      <button type="button" onClick={() => setRemanejarTarget(null)} className="px-2 py-1 text-xs rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300">Cancelar</button>
                                    </>
                                  ) : (
                                    <button type="button" onClick={() => setRemanejarTarget(item)} className="px-3 py-1 text-xs rounded-md bg-orange-600 text-white hover:bg-orange-700">Remanejar</button>
                                  )}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD */}
      {activeTab === 'dashboard' && stats && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Atendimentos</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-2">{stats.total}</h3>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><TrendingUp size={12} /> No período selecionado</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><Users size={24} /></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Tempo Médio Espera</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-2">{stats.avgWait} <span className="text-sm font-normal text-gray-500">min</span></h3>
                <p className="text-xs text-gray-400 mt-1">Da chegada até chamada</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600"><Hourglass size={24} /></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Tempo Médio Atendimento</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-2">{stats.avgService} <span className="text-sm font-normal text-gray-500">min</span></h3>
                <p className="text-xs text-gray-400 mt-1">Duração na sala</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-green-600"><Clock size={24} /></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Dias com Atividade</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-2">{Object.keys(stats.timeline).length}</h3>
                <p className="text-xs text-gray-400 mt-1">Dias operacionais no filtro</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg text-purple-600"><Calendar size={24} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Evolução dos Atendimentos</h3>
              <div className="h-64"><canvas id="chart-timeline"></canvas></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Perfil por Gênero</h3>
              <div className="h-64"><canvas id="chart-genero"></canvas></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Faixa Etária</h3>
              <div className="h-64"><canvas id="chart-faixa-etaria"></canvas></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Atendimentos por Tipo</h3>
              <div className="h-80"><canvas id="chart-tipo"></canvas></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Cidade Natal (Top 10)</h3>
              <div className="h-80"><canvas id="chart-naturalidade"></canvas></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Orientação Sexual</h3>
              <div className="h-64"><canvas id="chart-orientacao"></canvas></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Religião Declarada</h3>
              <div className="h-64"><canvas id="chart-religiao"></canvas></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Tempo de Espera (Distribuição)</h3>
              <div className="h-64"><canvas id="chart-wait-dist"></canvas></div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Horários de Pico (Chegada)</h3>
              <div className="h-64"><canvas id="chart-peak-hours"></canvas></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-2">CadÚnico – Visão geral</h3>
              <p className="text-sm text-gray-500 mb-4">Atendimentos do CadÚnico com ações registradas no período selecionado.</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total de atendimentos CadÚnico</p>
                  <h3 className="text-3xl font-bold text-gray-800 mt-2">{stats.cadunico?.total || 0}</h3>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><Users size={24} /></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">CadÚnico – Ações realizadas</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex flex-col"><span className="text-gray-500">Consulta</span><span className="text-2xl font-bold text-gray-800">{stats.cadunico?.acoes?.consulta || 0}</span></div>
                <div className="flex flex-col"><span className="text-gray-500">Inclusão</span><span className="text-2xl font-bold text-gray-800">{stats.cadunico?.acoes?.inclusao || 0}</span></div>
                <div className="flex flex-col"><span className="text-gray-500">Recadastro</span><span className="text-2xl font-bold text-gray-800">{stats.cadunico?.acoes?.recadastro || 0}</span></div>
                <div className="flex flex-col"><span className="text-gray-500">Transferência</span><span className="text-2xl font-bold text-gray-800">{stats.cadunico?.acoes?.transferencia || 0}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RELATÓRIO DETALHADO COM PAGINAÇÃO */}
      {activeTab === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn">
          <div className="p-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2 bg-gray-50">
            <span className="font-semibold text-gray-700">{reportData.length} registros encontrados</span>
            <div className="flex gap-2">
              <button onClick={handleExportPDF} disabled={!reportData.length} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors">
                <Download size={16} /> PDF
              </button>
              <button onClick={handleExportCSV} disabled={!reportData.length} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors">
                <Download size={16} /> CSV
              </button>
            </div>
          </div>

          {reportData.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Nenhum dado encontrado para os filtros selecionados.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Cidadão</th>
                      <th className="px-4 py-3">Idade</th>
                      <th className="px-4 py-3">Cidade natal</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Espera</th>
                      <th className="px-4 py-3">Duração</th>
                      <th className="px-4 py-3">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportDataPaged.map(item => {
                      const waitMin = getEsperaEmMinutos(item);
                      const idade = getAgeFromBRDate(item.cidadao?.dataNascimento);
                      const nat = String(item.cidadao?.naturalidade || '').trim();
                      const uf = String(item.cidadao?.uf || '').trim().toUpperCase();
                      const key = nat ? `${uf}|${simplify(nat)}` : '';
                      const ibge = key ? ibgeNaturalidadeMap[key] : null;
                      const cidadeNatal = !nat && !uf ? '-' : !uf ? (nat || '-') : `${ibge?.nome || nat || '-'}/${uf}${ibge?.id ? ` (${ibge.id})` : ''}`;

                      return (
                        <tr key={item.id} className="bg-white hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{formatDateTime(item.hora_chegada)}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{item.cidadao?.nome || 'Anônimo'}</div>
                            <div className="text-xs text-gray-400">{item.cidadao?.cpf ? `CPF: ${item.cidadao.cpf}` : ''}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{idade === null ? '-' : idade}</td>
                          <td className="px-4 py-3 text-gray-700">{cidadeNatal}</td>
                          <td className="px-4 py-3">{getTipoNome(item.tipo_atendimento_id)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              item.status === 'finalizado' ? 'bg-green-100 text-green-800' :
                              item.status === 'cancelado' ? 'bg-red-100 text-red-800' :
                              item.status === 'em_atendimento' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {waitMin > 0 ? `${waitMin} min` : calculateWaitTime(item.hora_chegada)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{getDuracaoFormatada(item)}</td>
                          <td className="px-4 py-3">
                            {item.observacoes && (
                              <div className="group relative">
                                <span className="cursor-help text-blue-500 underline decoration-dotted">Obs</span>
                                <div className="hidden group-hover:block absolute right-0 z-10 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg">
                                  {item.observacoes}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalListPages > 1 && (
                <div className="p-3 border-t bg-gray-50 flex items-center justify-between">
                  <button
                    onClick={() => setListPage(p => Math.max(1, p - 1))}
                    disabled={listPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border rounded text-xs font-medium text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <span className="text-xs text-gray-600">
                    Página {listPage} de {totalListPages} <span className="text-gray-400">· mostrando {reportDataPaged.length} de {reportData.length}</span>
                  </span>
                  <button
                    onClick={() => setListPage(p => Math.min(totalListPages, p + 1))}
                    disabled={listPage >= totalListPages}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border rounded text-xs font-medium text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                  >
                    Próxima <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CADÚNICO */}
      {activeTab === 'cadunico' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Relatório CadÚnico</h2>
                <p className="text-sm text-gray-500">Consolida ações (Consulta, Inclusão, Recadastro, Transferência) e servidores responsáveis.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleExportCadunicoPDF} disabled={!cadunicoFiltrado.length} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium transition-colors">
                  <Download size={16} /> PDF
                </button>
                <button onClick={handleExportCadunicoCSV} disabled={!cadunicoFiltrado.length} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors">
                  <Download size={16} /> CSV
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase font-semibold">Registros</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{cadunicoResumo.totalRegistros}</div>
                <div className="text-xs text-gray-500 mt-1">No período filtrado</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase font-semibold">Usuários únicos</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">{cadunicoResumo.usuariosUnicos}</div>
                <div className="text-xs text-gray-500 mt-1">Por CPF</div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="text-xs text-blue-700 uppercase font-semibold">Ações registradas</div>
                <div className="text-sm text-blue-900 mt-2 grid grid-cols-2 gap-2">
                  <div><span className="font-semibold">Consulta:</span> {cadunicoResumo.countsAcoes.consulta}</div>
                  <div><span className="font-semibold">Inclusão:</span> {cadunicoResumo.countsAcoes.inclusao}</div>
                  <div><span className="font-semibold">Recadastro:</span> {cadunicoResumo.countsAcoes.recadastro}</div>
                  <div><span className="font-semibold">Transferência:</span> {cadunicoResumo.countsAcoes.transferencia}</div>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
                <div className="text-xs text-yellow-800 uppercase font-semibold">Qualidade do registro</div>
                <div className="text-sm text-yellow-900 mt-2">
                  <div><span className="font-semibold">Sem ação:</span> {cadunicoResumo.semAcaoRegistrada}</div>
                  <div><span className="font-semibold">Sem CPF:</span> {cadunicoResumo.semCpf}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Ação</label>
                <select name="acao" value={cadFilters.acao} onChange={handleCadFilterChange} className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="todos">Todas</option>
                  <option value="consulta">Consulta</option>
                  <option value="inclusao">Inclusão</option>
                  <option value="recadastro">Recadastro</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Servidor</label>
                <select name="servidor" value={cadFilters.servidor} onChange={handleCadFilterChange} className="w-full p-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="todos">Todos</option>
                  {(cadunicoResumo.servidores || []).filter((s) => s.id !== 'nao_informado').map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-gray-600">
                <div className="font-semibold text-gray-800">{cadunicoFiltrado.length} registros</div>
                <div className="text-xs text-gray-500">Aplicando filtros sobre o período selecionado</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 font-semibold text-gray-700">Servidores (CadÚnico)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-600">
                  <thead className="text-xs uppercase text-gray-500 bg-white">
                    <tr>
                      <th className="px-4 py-3">Servidor</th>
                      <th className="px-4 py-3 text-right">Registros</th>
                      <th className="px-4 py-3 text-right">Consulta</th>
                      <th className="px-4 py-3 text-right">Inclusão</th>
                      <th className="px-4 py-3 text-right">Recadastro</th>
                      <th className="px-4 py-3 text-right">Transferência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(cadunicoResumo.servidores || []).map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{s.nome}</div>
                          {s.cargo && <div className="text-xs text-gray-400">{s.cargo}</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{s.totalRegistros}</td>
                        <td className="px-4 py-3 text-right">{s.acoes.consulta}</td>
                        <td className="px-4 py-3 text-right">{s.acoes.inclusao}</td>
                        <td className="px-4 py-3 text-right">{s.acoes.recadastro}</td>
                        <td className="px-4 py-3 text-right">{s.acoes.transferencia}</td>
                      </tr>
                    ))}
                    {(!cadunicoResumo.servidores || cadunicoResumo.servidores.length === 0) && (
                      <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={6}>Nenhum registro CadÚnico encontrado no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 font-semibold text-gray-700 flex justify-between items-center">
                <span>Registros (CadÚnico)</span>
                <span className="text-xs text-gray-500 font-normal">{cadunicoFiltrado.length} registros</span>
              </div>
              {!cadunicoFiltrado.length ? (
                <div className="p-10 text-center text-gray-500 text-sm">Nenhum registro CadÚnico encontrado para os filtros selecionados.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-600">
                    <thead className="text-xs uppercase text-gray-500 bg-white">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Cidadão</th>
                        <th className="px-4 py-3">Ação</th>
                        <th className="px-4 py-3">Servidor</th>
                        <th className="px-4 py-3">Local</th>
                        <th className="px-4 py-3">Duração</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cadunicoFiltrado
                        .slice((cadPage - 1) * CAD_PAGE_SIZE, cadPage * CAD_PAGE_SIZE)
                        .map((item) => {
                          const labelAcao = (a) => cadAcoesInfo.actionLabels[a] || a;
                          const acoesTxt = item.acoes_known?.length ? item.acoes_known.map(labelAcao).join(', ') : 'Sem ação registrada';
                          return (
                            <tr key={item.id}>
                              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(item.hora_chegada)}</td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{item.cidadao?.nome || item.nome_exibicao || 'Não informado'}</div>
                                <div className="text-xs text-gray-400">{item.cpfDigits ? `CPF: ${maskCPF(item.cpfDigits)}` : ''}</div>
                              </td>
                              <td className="px-4 py-3">{acoesTxt}</td>
                              <td className="px-4 py-3">{item.atendente_nome}</td>
                              <td className="px-4 py-3">{item.atendente_guiche || '-'}</td>
                              <td className="px-4 py-3 text-gray-600">{getDuracaoFormatada(item)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>

                  {cadunicoFiltrado.length > CAD_PAGE_SIZE && (
                    <div className="p-3 border-t bg-gray-50 flex items-center justify-between">
                      <button onClick={() => setCadPage(p => Math.max(1, p - 1))} disabled={cadPage === 1} className="px-3 py-1 bg-white border rounded text-xs font-medium text-gray-600 disabled:opacity-50 hover:bg-gray-50">
                        Anterior
                      </button>
                      <span className="text-xs text-gray-600">
                        Página {cadPage} de {Math.ceil(cadunicoFiltrado.length / CAD_PAGE_SIZE)}
                      </span>
                      <button onClick={() => setCadPage(p => Math.min(Math.ceil(cadunicoFiltrado.length / CAD_PAGE_SIZE), p + 1))} disabled={cadPage >= Math.ceil(cadunicoFiltrado.length / CAD_PAGE_SIZE)} className="px-3 py-1 bg-white border rounded text-xs font-medium text-gray-600 disabled:opacity-50 hover:bg-gray-50">
                        Próxima
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ANÁLISES AVANÇADAS */}
      {activeTab === 'analises' && (
        <RelatoriosAvancados
          reportData={reportData}
          crasUnidades={crasUnidades}
          atendentesList={atendentesList}
          tiposAtendimento={tiposAtendimento}
        />
      )}
    </div>
  );
};

export default RelatoriosPage;

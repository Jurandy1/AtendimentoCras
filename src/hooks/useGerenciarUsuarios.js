import { useMemo, useState, useEffect } from 'react';
import { 
  collection, query, where, orderBy, limit, startAfter,
  onSnapshot, deleteDoc, doc, addDoc, setDoc, updateDoc, getDoc, getDocs, documentId,
  writeBatch, deleteField, serverTimestamp, Timestamp, getCountFromServer
} from 'firebase/firestore';
import { logAdminAction } from '../utils/logger';
import { getFriendlyFirebaseError, getIBGEMunicipiosByUF, normalizeDate, normalizeName, simplify, isStrictlyBrazilian, inferNationalityFromNaturalidade, formatCpf } from '../utils/helpers';
import { GOOGLE_SHEETS_TOKEN, GOOGLE_SHEETS_WEBAPP_URL } from '../constants';

const BUSCA_LOTE = 500;
const BUSCA_MAX_DOCS = 5000;

const temConteudoValor = (v) => {
  if (v == null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') {
    if (typeof v.toDate === 'function' || v instanceof Date) return true;
    if (typeof v.toMillis === 'function') return true;
    return Object.values(v).some((x) => temConteudoValor(x));
  }
  if (typeof v === 'boolean') return v === true;
  const s = String(v).trim();
  return s !== '' && s !== 'nao';
};

const INDICADORES_FICHA = [
  ['Ficha social atualizada', (u) => u.ficha_atualizada_em || u.ultima_atualizacao_em || u.ultimaAtualizacaoFicha],
  ['Resumo do último atendimento', (u) => u.ultimoAtendimentoResumo],
  ['Tipo de acompanhamento', (u) => u.tipoAcompanhamento],
  ['Doenças / transtornos', (u) => u.doencas_mentais],
  ['Substâncias psicoativas', (u) => u.substancias_psicoativas],
  ['Violações de direitos', (u) => u.violacoes],
  ['Encaminhamentos realizados', (u) => u.encaminhamentos_externos],
  ['Encaminhamento recebido', (u) => u.encaminhamento_recebido],
  ['Avaliação de moradia', (u) => u.moradia_rua || u.moradia_amigos || u.moradia_acolhimento],
  ['Benefícios sociais', (u) => u.beneficio_bolsa_familia || u.beneficio_bpc || (Array.isArray(u.beneficios_eventuais) && u.beneficios_eventuais.length > 0)],
  ['Visita esporádica registrada', (u) => u.ultima_visita_esporadica],
  ['Habilidades / cursos', (u) => u.habilidadesProfissionais || u.interesseCursoQual],
];

const getMillisValor = (v) => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  const n = new Date(v).getTime();
  return Number.isNaN(n) ? 0 : n;
};

const montarInfoRegistro = (u, atendInfo = {}) => {
  const indicadores = INDICADORES_FICHA
    .filter(([, fn]) => temConteudoValor(fn(u)))
    .map(([label]) => label);
  const obsCidadao = String(u.ultima_visita_esporadica?.obs || '').trim();
  const qtdAtendimentos = atendInfo.total || 0;
  const qtdComObs = atendInfo.comObs || 0;
  const temDadosTecnicos = indicadores.length > 0 || qtdComObs > 0 || !!obsCidadao;
  const pontuacao = indicadores.length * 2 + qtdComObs * 4 + qtdAtendimentos + (obsCidadao ? 2 : 0);

  return {
    indicadores,
    qtdAtendimentos,
    qtdComObs,
    ultimaObs: atendInfo.ultimaObs || obsCidadao || '',
    ultimaObsData: atendInfo.ultimaObsData || '',
    ultimoAtendente: u.ultimoAtendimentoResumo?.atendenteNome || u.ultima_visita_esporadica?.atendente_nome || '',
    temDadosTecnicos,
    pontuacao,
    seguroExcluir: !temDadosTecnicos && qtdAtendimentos === 0,
  };
};

const variantesCpfBusca = (registro) => {
  const set = new Set();
  const cpfLimpo = String(registro?.cpf || '').replace(/\D/g, '');
  const idLimpo = String(registro?.id || '').replace(/\D/g, '');
  if (registro?.cpf) set.add(String(registro.cpf).trim());
  if (cpfLimpo.length === 11) {
    set.add(cpfLimpo);
    set.add(formatCpf(cpfLimpo));
  }
  if (idLimpo.length === 11) {
    set.add(idLimpo);
    set.add(formatCpf(idLimpo));
  }
  if (registro?.id) set.add(String(registro.id).trim());
  return [...set].filter(Boolean);
};

const usuarioMatchesBusca = (u, termo) => {
  const raw = String(termo || '').trim();
  if (!raw) return true;

  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 3) {
    const cpfDoc = String(u.cpf || u.id || '').replace(/\D/g, '');
    if (cpfDoc.includes(digits)) return true;
  }

  const termoNorm = simplify(raw);
  if (!termoNorm || termoNorm.length < 2) return true;

  const campos = [u.nome, u.nomeSocial, u.nomeMae, u.nomePai].filter(Boolean);
  return campos.some((campo) => {
    const campoNorm = simplify(String(campo));
    if (campoNorm.includes(termoNorm)) return true;
    return campoNorm.split(/\s+/).some((palavra) => palavra.startsWith(termoNorm));
  });
};

export const useGerenciarUsuarios = ({ db, appId, userProfile }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [termoBusca, setTermoBusca] = useState('');
  const [ordem, setOrdem] = useState('recentes'); // 'alfabetica' | 'recentes'
  const [lastDocs, setLastDocs] = useState([]); // Stack of doc snapshots for pagination
  const [lastVisible, setLastVisible] = useState(null); // Last doc of current page
  const [paginaBusca, setPaginaBusca] = useState(0);
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({ nome: '', cpf: '', telefone: '', nomeMae: '', cras_id_principal: '' });
  
  // Estado para criação
  const [creating, setCreating] = useState(false);
  const [createData, setCreateData] = useState({
    nome: '', cpf: '', nomeSocial: '', dataNascimento: '',
    nomeMae: '', nomePai: '', telefone: '', nis: '', rg: '',
    sexo: '', cor: '', escolaridade: '', religiao: '',
    orientacaoSexual: '', naturalidade: '', uf: '',
    nacionalidade: 'Brasileira', conjuge: '', tecnicoResponsavel: '',
    origemDemanda: '', dataCadastro: new Date().toLocaleDateString('pt-BR'),
    cras_id_principal: ''
  });

  // Bulk actions state
  const [fixingNames, setFixingNames] = useState(false);
  const [fixingDates, setFixingDates] = useState(false);
  const [fixingCPFs, setFixingCPFs] = useState(false);
  const [fixResult, setFixResult] = useState(null);
  const [fixResultCPF, setFixResultCPF] = useState(null);
  const [fixingNaturalidade, setFixingNaturalidade] = useState(false);
  const [fixResultNaturalidade, setFixResultNaturalidade] = useState(null);
  const [revertingNaturalidade, setRevertingNaturalidade] = useState(false);
  const [lastNatFixRunId, setLastNatFixRunId] = useState('');
  
  // Estado local para filtro de alertas (apenas visual)
  const [filtroAlerta, setFiltroAlerta] = useState(false);
  const [filtroEstrangeiros, setFiltroEstrangeiros] = useState(false);
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [obsNaturalidadeById, setObsNaturalidadeById] = useState({});
  const [deletingImportados, setDeletingImportados] = useState(false);
  const [deletingIds, setDeletingIds] = useState(() => new Set());
  const [scanningDuplicados, setScanningDuplicados] = useState(false);
  const [unificandoGrupo, setUnificandoGrupo] = useState(false);
  const [resultadoDuplicados, setResultadoDuplicados] = useState(null);
  
  // Totais (Estatísticas)
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalImportados, setTotalImportados] = useState(0);

  const ITENS_POR_PAGINA = 50;
  const [crasMap, setCrasMap] = useState({});
  const collectionPath = `artifacts/${appId}/public/data/cidadaos`;
  const lastRunKey = `admin_natfix_last_run_${appId || 'app'}`;

  useEffect(() => {
    if (!db || !appId) return;
    const fetchCras = async () => {
      try {
        const snap = await getDocs(collection(db, `artifacts/${appId}/public/data/cras_unidades`));
        const map = {};
        snap.docs.forEach((d) => {
          map[d.id] = d.data()?.nome || d.id;
        });
        setCrasMap(map);
      } catch (e) {
        console.warn('Erro ao carregar unidades CRAS:', e);
      }
    };
    fetchCras();
  }, [db, appId]);

  // Atualizar totais (Server Aggregation - Otimizado para custo)
  const updateTotals = async () => {
    if (!db) return;
    try {
        const coll = collection(db, collectionPath);
        
        // Total Geral
        const snapshotTotal = await getCountFromServer(coll);
        setTotalUsuarios(snapshotTotal.data().count);
        
        // Total Importados (origemImportacao existe)
        const qImportados = query(coll, where("origemImportacao", "!=", null));
        // Nota: "!=" null pode não funcionar bem dependendo do índice ou valor. 
        // Melhor verificar se o campo existe, mas Firestore só tem "orderBy" hack para isso.
        // Ou assumir que quem é importado tem origemImportacao = true ou string.
        // Vamos tentar where('origemImportacao', '>=', '') se for string.
        // Mas o hook usa `u.origemImportacao` como booleano ou string.
        // Vamos tentar contar por `origemImportacao` != null (requer índice).
        // Se falhar, tentamos apenas o total geral para não quebrar.
        
        try {
            // Assumindo que origemImportacao é salvo como string ou boolean true
            // A query mais segura para "campo existe e não é nulo/false" sem saber o tipo exato é complexa.
            // Vamos tentar orderBy se tiver índice, ou where >= '' se for string.
            // O código de importação salva: `origemImportacao: 'Planilha X'`
            const qImp = query(coll, where("origemImportacao", ">=", "")); 
            const snapshotImp = await getCountFromServer(qImp);
            setTotalImportados(snapshotImp.data().count);
        } catch (e) {
            console.warn("Não foi possível contar importados (falta de índice?):", e);
        }
        
    } catch (err) {
        console.error("Erro ao buscar totais:", err);
    }
  };

  useEffect(() => {
    updateTotals();
  }, [db, appId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(lastRunKey) || '';
      setLastNatFixRunId(stored);
    } catch {}
  }, [lastRunKey]);

  const isBrasileiro = (nacionalidade) => {
    return isStrictlyBrazilian(nacionalidade);
  };

  const normalizeNacionalidadePadrao = (nacionalidade) => {
    return isBrasileiro(nacionalidade) ? "Brasileira" : (nacionalidade || "");
  };

  const levenshtein = (a, b) => {
    if (a === b) return 0;
    const la = a.length;
    const lb = b.length;
    if (la === 0) return lb;
    if (lb === 0) return la;
    const v0 = new Array(lb + 1);
    const v1 = new Array(lb + 1);
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

  // EFFECT 1: Busca Especial (Alertas ou Estrangeiros)
  useEffect(() => {
    if (!db) return;
    
    // Se nenhum filtro especial estiver ativo, retorna
    if (!filtroAlerta && !filtroEstrangeiros) return;
    
    let isMounted = true;
    const fetchEspeciais = async () => {
        setLoading(true);
        try {
            let resultado = [];

            if (filtroAlerta) {
                // ... Lógica de Alertas (mantida) ...
                try {
                    const q1 = query(collection(db, collectionPath), orderBy('_alertaCPF'), limit(50));
                    const q2 = query(collection(db, collectionPath), orderBy('_alertaDataNascimento'), limit(50));
                    const q3 = query(collection(db, collectionPath), orderBy('_obsNaturalidade'), limit(50));
                    
                    const [s1, s2, s3] = await Promise.all([getDocs(q1), getDocs(q2), getDocs(q3)]);
                    
                    if (!isMounted) return;

                    const map = new Map();
                    s1.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
                    s2.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
                    s3.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
                    
                    resultado = Array.from(map.values());
                } catch (idxError) {
                    // Fallback Alertas
                    const qFallback = query(collection(db, collectionPath), limit(500));
                    const snap = await getDocs(qFallback);
                    resultado = snap.docs
                        .map(d => ({ id: d.id, ...d.data() }))
                        .filter(u => u._alertaCPF || u._alertaDataNascimento || u._obsNaturalidade);
                }
            } 
            else if (filtroEstrangeiros) {
                // Lógica de Estrangeiros (Scan amplo)
                // Aumentado para 10.000 para garantir que pegue toda a base
                
                const qScan = query(collection(db, collectionPath), limit(10000));
                const snap = await getDocs(qScan);
                
                if (!isMounted) return;

                resultado = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(u => {
                        // Critério ROBUSTO de estrangeiro:
                        // 1. Nacionalidade explicitamente estrangeira
                        if (!isStrictlyBrazilian(u.nacionalidade)) return true;
                        
                        // 2. Nacionalidade vazia ou "Brasileira" (mas contraditória com naturalidade/UF)
                        const nat = u.naturalidade;
                        const uf = u.uf;
                        const inferida = inferNationalityFromNaturalidade(nat, uf);
                        
                        // Se detectou país estrangeiro na naturalidade ou UF, considera estrangeiro
                        if (inferida) return true;
                        
                        return false;
                    });
            }
            
            if (isMounted) {
                setUsuarios(resultado);
                setLastDocs([]); // Paginação desabilitada nos modos especiais
            }
        } catch (err) {
            console.error("Erro ao buscar dados especiais:", err);
        } finally {
            if (isMounted) setLoading(false);
        }
    };
    
    fetchEspeciais();
    return () => { isMounted = false; };
  }, [db, appId, filtroAlerta, filtroEstrangeiros]);

  // EFFECT 2a: Busca por texto — varre a base e filtra no cliente (nome, social, mãe, CPF)
  useEffect(() => {
    if (!db || filtroAlerta || filtroEstrangeiros || termoBusca.trim().length < 2) return;

    let cancelled = false;
    const buscar = async () => {
      setLoading(true);
      try {
        const qBase = collection(db, collectionPath);
        const todos = [];
        let lastDoc = null;

        while (todos.length < BUSCA_MAX_DOCS) {
          let qLote = query(qBase, orderBy('nome'), limit(BUSCA_LOTE));
          if (lastDoc) qLote = query(qLote, startAfter(lastDoc));
          const snap = await getDocs(qLote);
          if (snap.empty) break;
          snap.docs.forEach((d) => todos.push({ id: d.id, ...d.data() }));
          lastDoc = snap.docs[snap.docs.length - 1];
          if (snap.docs.length < BUSCA_LOTE) break;
        }

        if (cancelled) return;

        const filtrados = todos
          .filter((u) => usuarioMatchesBusca(u, termoBusca))
          .sort((a, b) => simplify(a.nome || '').localeCompare(simplify(b.nome || ''), 'pt-BR'));

        setUsuarios(filtrados);
        setLastVisible(null);
        setPaginaBusca(0);
      } catch (err) {
        console.error('Erro busca usuarios:', err);
        if (!cancelled) setUsuarios([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    buscar();
    return () => { cancelled = true; };
  }, [db, appId, termoBusca, filtroAlerta, filtroEstrangeiros]);

  // EFFECT 2b: Listagem padrão (sem termo de busca)
  useEffect(() => {
    if (!db || filtroAlerta || filtroEstrangeiros || termoBusca.trim().length >= 2) return;

    setLoading(true);
    const qBase = collection(db, collectionPath);
    let qFinal;

    if (ordem === 'recentes') {
      qFinal = query(qBase, orderBy('createdAt', 'desc'), limit(ITENS_POR_PAGINA));
    } else {
      qFinal = query(qBase, orderBy('nome'), limit(ITENS_POR_PAGINA));
    }

    if (lastDocs.length > 0) {
      const lastDoc = lastDocs[lastDocs.length - 1];
      qFinal = query(qFinal, startAfter(lastDoc));
    }

    const unsub = onSnapshot(qFinal, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsuarios(list);
      setLastVisible(snap.docs[snap.docs.length - 1] || null);
      setLoading(false);
    }, (err) => {
      console.error('Erro listagem usuarios:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [db, appId, termoBusca, lastDocs, ordem, filtroAlerta, filtroEstrangeiros]);

  // Debounce: busca enquanto digita (mínimo 2 caracteres)
  useEffect(() => {
    const trimmed = busca.trim();
    const effective = trimmed.length >= 2 ? trimmed : '';
    const timer = setTimeout(() => {
      if (effective !== termoBusca.trim()) {
        setTermoBusca(effective);
        setLastDocs([]);
        setPaginaBusca(0);
        setLastVisible(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [busca, termoBusca]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const pairs = [];
      usuarios.forEach((u) => {
        const nacionalidade = u.nacionalidade || "";
        if (!isBrasileiro(nacionalidade)) return;
        const uf = String(u.uf || "").trim().toUpperCase();
        const nat = String(u.naturalidade || "").trim();
        if (!uf || uf.length !== 2 || !nat) return;
        pairs.push({ id: u.id, uf, nat, ibgeId: u.naturalidadeIbgeId || "" });
      });
      if (!pairs.length) {
        if (!cancelled) setObsNaturalidadeById({});
        return;
      }
      const ufs = Array.from(new Set(pairs.map((p) => p.uf)));
      const municipiosByUf = new Map();
      for (const uf of ufs) {
        const list = await getIBGEMunicipiosByUF(uf);
        municipiosByUf.set(uf, list);
      }
      const next = {};
      pairs.forEach((p) => {
        const list = municipiosByUf.get(p.uf) || [];
        const simp = simplify(p.nat);
        const bySimp = new Map(list.map((m) => [simplify(m.nome), m]));
        let found = bySimp.get(simp) || null;
        let matchType = 'exact';
        if (!found && list.length > 0) {
          const keys = Array.from(bySimp.keys());
          const maxDist = maxDistFor(simp);
          if (maxDist > 0) {
            let best = null;
            let bestDist = Infinity;
            for (const k of keys) {
              const d = levenshtein(simp, k);
              if (d < bestDist) {
                bestDist = d;
                best = k;
                if (bestDist === 1) break;
              }
            }
            if (best && bestDist <= maxDist) {
              found = bySimp.get(best) || null;
              matchType = 'fuzzy';
            }
          }
        }
        if (!found) return;
        const needsName = matchType === 'exact' && String(p.nat).trim() !== String(found.nome).trim();
        const needsIbge = !p.ibgeId || String(p.ibgeId) !== String(found.id);
        if (matchType === 'exact' && (needsName || needsIbge)) {
          next[p.id] = { tipo: 'auto', texto: `Padronizar para ${found.nome}/${p.uf} (${found.id})` };
          return;
        }
        if (matchType === 'fuzzy') {
          next[p.id] = { tipo: 'manual', texto: `Sugestão: ${found.nome}/${p.uf} (${found.id})` };
        }
      });
      if (!cancelled) setObsNaturalidadeById(next);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [usuarios]);

  // Handle Search Submit
  const handleSearchSubmit = () => {
      const trimmed = busca.trim();
      setTermoBusca(trimmed);
      setLastDocs([]);
      setPaginaBusca(0);
      setLastVisible(null);
  };

  const limparBusca = () => {
      setBusca('');
      setTermoBusca('');
      setLastDocs([]);
      setPaginaBusca(0);
      setLastVisible(null);
  };

  const handleOrdemChange = (novaOrdem) => {
    setOrdem(novaOrdem);
    setLastDocs([]);
    setPaginaBusca(0);
    setLastVisible(null);
  };

  const emModoBusca = termoBusca.trim().length >= 2 && !filtroAlerta && !filtroEstrangeiros;
  const totalResultadosBusca = emModoBusca ? usuarios.length : null;
  const totalPaginasBusca = emModoBusca
    ? Math.max(1, Math.ceil(usuarios.length / ITENS_POR_PAGINA))
    : 1;

  const handleNextPage = () => {
      if (emModoBusca) {
        if ((paginaBusca + 1) * ITENS_POR_PAGINA < usuarios.length) {
          setPaginaBusca((p) => p + 1);
        }
        return;
      }
      if (lastVisible) {
          setLastDocs(prev => [...prev, lastVisible]);
      }
  };

  const handlePrevPage = () => {
      if (emModoBusca) {
        setPaginaBusca((p) => Math.max(0, p - 1));
        return;
      }
      setLastDocs(prev => {
          const newStack = [...prev];
          newStack.pop();
          return newStack;
      });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const usuariosView = useMemo(() => {
    let list = usuarios;
    if (filtroAlerta) {
      list = list.filter((u) => u._alertaCPF || u._alertaDataNascimento || u._obsNaturalidade);
    }
    if (filtroEstrangeiros) {
      list = list.filter((u) => !isBrasileiro(u.nacionalidade));
    }
    if (filtroUnidade) {
      list = list.filter((u) => String(u.cras_id_principal || '') === String(filtroUnidade));
    }
    if (emModoBusca) {
      const start = paginaBusca * ITENS_POR_PAGINA;
      list = list.slice(start, start + ITENS_POR_PAGINA);
    }
    return list.map((u) => {
      const obs = obsNaturalidadeById[u.id] || null;
      const nacionalidadeNorm = normalizeNacionalidadePadrao(u.nacionalidade);
      const nomeUnidade = u.cras_id_principal
        ? (crasMap[u.cras_id_principal] || 'Unidade desconhecida')
        : 'Sem unidade';
      return {
        ...u,
        nacionalidade: nacionalidadeNorm || u.nacionalidade,
        _obsNaturalidade: obs?.texto || '',
        _obsNaturalidadeTipo: obs?.tipo || '',
        _nomeUnidade: nomeUnidade,
      };
    });
  }, [usuarios, filtroAlerta, filtroEstrangeiros, filtroUnidade, obsNaturalidadeById, crasMap, emModoBusca, paginaBusca, ITENS_POR_PAGINA]);

  const toggleSelectAllView = () => {
    const ids = usuariosView.map((u) => u.id);
    const all = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(all ? selectedIds.filter((id) => !ids.includes(id)) : Array.from(new Set([...selectedIds, ...ids])));
  };

  const handleCorrigirNaturalidadeUsuarios = async () => {
    if (!db) return;
    if (!window.confirm("Esta ação irá:\n1. Identificar e padronizar Nacionalidade Brasileira.\n2. Corrigir Naturalidade/UF SOMENTE quando houver correspondência EXATA (100% de certeza) com a base do IBGE.\n3. Gerar sugestões de correção manual para casos incertos.\n\nNenhum usuário será excluído ou ocultado.\n\nDeseja continuar?")) return;
    
    setFixingNaturalidade(true);
    setFixResultNaturalidade(null);
    const colRef = collection(db, collectionPath);
    const runId = `NATFIX_${Date.now()}`;
    let corrigidos = 0;
    let revisao = 0;
    let nacionalidadeCorrigida = 0;
    let naturalidadeCorrigida = 0;
    let ibgeIdPreenchido = 0;
    let backupsCriados = 0;
    
    try {
      let last = null;
      const municipiosCache = new Map();
      const getMunicipios = async (uf) => {
        if (municipiosCache.has(uf)) return municipiosCache.get(uf);
        const list = await getIBGEMunicipiosByUF(uf);
        municipiosCache.set(uf, list);
        return list;
      };

      while (true) {
        let q = query(colRef, orderBy(documentId()), limit(400));
        if (last) q = query(colRef, orderBy(documentId()), startAfter(last), limit(400));
        const snap = await getDocs(q);
        if (snap.empty) break;
        last = snap.docs[snap.docs.length - 1];

        let batch = writeBatch(db);
        let ops = 0;

        for (const d of snap.docs) {
          const u = d.data() || {};
          const id = d.id;
          const nacionalidade = u.nacionalidade || "";
          const brasil = isBrasileiro(nacionalidade);
          const updates = {};
          let obsManual = null;

          if (brasil) {
            // Padroniza Nacionalidade Brasileira se necessário
            if (u.nacionalidade !== "Brasileira") {
              updates.nacionalidade = "Brasileira";
              nacionalidadeCorrigida += 1;
            }
            
            const uf = String(u.uf || "").trim().toUpperCase();
            const nat = String(u.naturalidade || "").trim();
            
            if (uf && uf.length === 2 && nat) {
              if (u.uf !== uf) updates.uf = uf;
              
              const municipios = await getMunicipios(uf);
              if (municipios.length) {
                const simp = simplify(nat);
                // Mapa exato normalizado
                const bySimp = new Map(municipios.map((m) => [simplify(m.nome), m]));
                const found = bySimp.get(simp) || null;
                
                if (found) {
                  // MATCH EXATO (100% de certeza na normalização)
                  if (String(u.naturalidade || "").trim() !== String(found.nome).trim()) {
                    updates.naturalidade = found.nome;
                    naturalidadeCorrigida += 1;
                  }
                  if (!u.naturalidadeIbgeId || String(u.naturalidadeIbgeId) !== String(found.id)) {
                    updates.naturalidadeIbgeId = String(found.id);
                    ibgeIdPreenchido += 1;
                  }
                  // Remove observação antiga se corrigiu
                  if (u._obsNaturalidade) {
                      updates._obsNaturalidade = deleteField();
                      updates._obsNaturalidadeTipo = deleteField();
                  }
                } else {
                  // SEM MATCH EXATO -> Tentar Fuzzy para sugestão manual (SEM ALTERAR DADOS)
                  revisao += 1;
                  const keys = Array.from(bySimp.keys());
                  const maxDist = maxDistFor(simp);
                  let best = null;
                  let bestDist = Infinity;
                  
                  if (maxDist > 0) {
                      for (const k of keys) {
                          const d = levenshtein(simp, k);
                          if (d < bestDist) {
                              bestDist = d;
                              best = k;
                              if (bestDist === 1) break;
                          }
                      }
                  }
                  
                  if (best && bestDist <= maxDist) {
                      const sugerido = bySimp.get(best);
                      obsManual = `Sugestão: ${sugerido.nome}/${uf}`;
                  } else {
                      obsManual = `Cidade não encontrada no IBGE para UF: ${uf}`;
                  }
                  
                  // Salva apenas a observação para revisão manual, não altera dados do cadastro
                  if (u._obsNaturalidade !== obsManual) {
                      updates._obsNaturalidade = obsManual;
                      updates._obsNaturalidadeTipo = 'manual';
                  }
                }
              }
            }
          } else {
              // Estrangeiro
              // Tenta inferir nacionalidade se estiver vazia ou genérica, mas a naturalidade for um país conhecido
              // Isso ajuda a corrigir casos antigos onde a Nacionalidade não foi preenchida mas a naturalidade diz "Venezuela"
              const nat = String(u.naturalidade || "").trim();
              const ufVal = String(u.uf || "").trim();
              
              if (nat || ufVal) {
                  const inferida = inferNationalityFromNaturalidade(nat, ufVal);
                  if (inferida && inferida !== u.nacionalidade) {
                      // Se inferiu algo como "Venezuelana" e o atual é diferente (ou vazio)
                      // Mas cuidado para não sobrescrever algo que já esteja correto de outra forma
                      // Se o atual for vazio ou não for estritamente brasileiro (já estamos no else, então ok)
                      // Vamos aplicar se o campo estiver vazio ou muito diferente
                      if (!u.nacionalidade || u.nacionalidade.length < 3) {
                          updates.nacionalidade = inferida;
                          nacionalidadeCorrigida += 1;
                      }
                  }
              }
              
              // NOVIDADE: Normalização da PRÓPRIA Nacionalidade (se já estiver preenchida mas sem padrão)
              // Ex: "URUGUAI" -> "Uruguaia"
              const nacAtual = String(u.nacionalidade || "").trim();
              if (nacAtual && nacAtual.length >= 3) {
                  const normalizada = inferNationalityFromNaturalidade(nacAtual, "");
                  if (normalizada && normalizada !== nacAtual) {
                      // Se a própria nacionalidade é um país conhecido (ex: "Uruguai")
                      // e a forma normalizada é diferente (ex: "Uruguaia")
                      updates.nacionalidade = normalizada;
                      nacionalidadeCorrigida += 1;
                  }
              }

              // Se tiver algo anotado como "Brasileira" por engano, remove? Não, respeita isBrasileiro.
              // Apenas garante que não tem obs de naturalidade pendente se for estrangeiro confirmado
              if (u._obsNaturalidade) {
                  updates._obsNaturalidade = deleteField();
                  updates._obsNaturalidadeTipo = deleteField();
              }
          }

          const keys = Object.keys(updates);
          if (keys.length > 0) {
            // Backup apenas se estiver alterando dados reais (nacionalidade, uf, naturalidade, ibge)
            // Se for só obs, não precisa de backup complexo, mas por segurança mantemos o padrão
            const isDataChange = keys.some(k => !k.startsWith('_obs'));
            
            if (isDataChange) {
                const backupOriginal = {
                  nacionalidade: Object.prototype.hasOwnProperty.call(u, "nacionalidade") ? (u.nacionalidade ?? "") : null,
                  uf: Object.prototype.hasOwnProperty.call(u, "uf") ? (u.uf ?? "") : null,
                  naturalidade: Object.prototype.hasOwnProperty.call(u, "naturalidade") ? (u.naturalidade ?? "") : null,
                  naturalidadeIbgeId: Object.prototype.hasOwnProperty.call(u, "naturalidadeIbgeId") ? (u.naturalidadeIbgeId ?? "") : null,
                };
                updates._natFixBackup = {
                  runId,
                  ts: serverTimestamp(),
                  by: {
                    uid: userProfile?.uid || "",
                    email: userProfile?.email || "",
                    nome: userProfile?.nome || "",
                  },
                  original: backupOriginal
                };
                updates._natFixRunId = runId;
                backupsCriados += 1;
            }
            
            batch.update(doc(db, collectionPath, id), updates);
            ops += 1;
            corrigidos += 1;
          }

          if (ops >= 380) {
            await batch.commit();
            batch = writeBatch(db);
            ops = 0;
          }
        }
        if (ops > 0) await batch.commit();
      }

      try {
        await logAdminAction(
          db,
          appId,
          { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome },
          "CORRIGIR_NATURALIDADE_USUARIOS",
          "Correção segura de naturalidade (IBGE) aplicada",
          { runId, corrigidos, nacionalidadeCorrigida, naturalidadeCorrigida, ibgeIdPreenchido, revisao, backupsCriados }
        );
      } catch (e) {
        console.error("Erro ao registrar log de correção naturalidade:", e);
      }

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(lastRunKey, runId);
        } catch {}
      }
      setLastNatFixRunId(runId);
      setFixResultNaturalidade({
        runId,
        corrigidos,
        nacionalidadeCorrigida,
        naturalidadeCorrigida,
        ibgeIdPreenchido,
        revisao,
        backupsCriados,
        msg: `Concluído. ${corrigidos} registros atualizados. ${revisao} marcados para revisão manual (ver alertas).`
      });
      
      alert(`Correção finalizada!\n\nRegistros atualizados: ${corrigidos}\nRevisão Manual necessária: ${revisao}\n\nOs casos incertos receberam uma observação 'Sugestão: ...' na coluna Obs. Naturalidade.`);
      
    } catch (e) {
      console.error(e);
      setFixResultNaturalidade({ msg: e.message || "Erro ao corrigir naturalidade" });
    } finally {
      setFixingNaturalidade(false);
    }
  };

  const handleReverterUltimaCorrecaoNaturalidade = async () => {
    if (!db) return;
    const runId = lastNatFixRunId;
    if (!runId) {
      alert("Não há correção registrada para reverter neste navegador.");
      return;
    }
    if (!window.confirm(`Reverter a última correção de naturalidade? (Run: ${runId})`)) return;
    setRevertingNaturalidade(true);
    const colRef = collection(db, collectionPath);
    let revertidos = 0;
    try {
      let last = null;
      while (true) {
        let q = query(colRef, where("_natFixRunId", "==", runId), orderBy(documentId()), limit(400));
        if (last) q = query(colRef, where("_natFixRunId", "==", runId), orderBy(documentId()), startAfter(last), limit(400));
        const snap = await getDocs(q);
        if (snap.empty) break;
        last = snap.docs[snap.docs.length - 1];

        let batch = writeBatch(db);
        let ops = 0;
        for (const d of snap.docs) {
          const u = d.data() || {};
          const b = u?._natFixBackup?.original || null;
          if (!b) continue;

          const updates = {
            _natFixBackup: deleteField(),
            _natFixRunId: deleteField(),
          };

          if (b.nacionalidade === null) updates.nacionalidade = deleteField();
          else updates.nacionalidade = b.nacionalidade;

          if (b.uf === null) updates.uf = deleteField();
          else updates.uf = b.uf;

          if (b.naturalidade === null) updates.naturalidade = deleteField();
          else updates.naturalidade = b.naturalidade;

          if (b.naturalidadeIbgeId === null) updates.naturalidadeIbgeId = deleteField();
          else updates.naturalidadeIbgeId = b.naturalidadeIbgeId;

          batch.update(d.ref, updates);
          ops += 1;
          revertidos += 1;

          if (ops >= 380) {
            await batch.commit();
            batch = writeBatch(db);
            ops = 0;
          }
        }
        if (ops > 0) await batch.commit();
      }

      try {
        await logAdminAction(
          db,
          appId,
          { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome },
          "REVERTER_CORRECAO_NATURALIDADE_USUARIOS",
          "Reversão de correção de naturalidade aplicada",
          { runId, revertidos }
        );
      } catch (e) {
        console.error("Erro ao registrar log de reversão naturalidade:", e);
      }

      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(lastRunKey);
        } catch {}
      }
      setLastNatFixRunId('');
      alert(`Reversão concluída. Registros revertidos: ${revertidos}`);
    } catch (e) {
      console.error(e);
      alert("Erro ao reverter: " + (e.message || e));
    } finally {
      setRevertingNaturalidade(false);
    }
  };

  const removerUsuariosDaLista = (ids) => {
    const idSet = new Set(ids);
    setUsuarios((prev) => prev.filter((u) => !idSet.has(u.id)));
    setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    setResultadoDuplicados((prev) => {
      if (!prev) return prev;
      const filtrarGrupos = (grupos) =>
        grupos
          .map((g) => ({ ...g, registros: g.registros.filter((r) => !idSet.has(r.id)) }))
          .filter((g) => g.registros.length > 1);
      return {
        ...prev,
        porCpf: filtrarGrupos(prev.porCpf),
        porNome: filtrarGrupos(prev.porNome),
        porNomeNasc: filtrarGrupos(prev.porNomeNasc),
      };
    });
  };

  const excluirDocumentoCidadao = async (id) => {
    const ref = doc(db, collectionPath, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error('Este cadastro já não existe no banco (pode ter sido excluído em outra sessão).');
    }
    await deleteDoc(ref);
    return snap.data();
  };

  const handleDeleteSelected = async () => {
    if (!db || selectedIds.length === 0) return;
    if (!window.confirm(`Deseja realmente excluir ${selectedIds.length} usuário(s)?`)) return;

    const idsParaExcluir = [...selectedIds];
    setDeletingIds((prev) => {
      const next = new Set(prev);
      idsParaExcluir.forEach((id) => next.add(id));
      return next;
    });

    const excluidos = [];
    const erros = [];

    try {
      for (const id of idsParaExcluir) {
        try {
          await excluirDocumentoCidadao(id);
          excluidos.push(id);
        } catch (err) {
          console.error(`Erro ao excluir ${id}:`, err);
          erros.push({ id, msg: getFriendlyFirebaseError(err, err?.message || 'Erro desconhecido') });
        }
      }

      if (excluidos.length > 0) {
        removerUsuariosDaLista(excluidos);
        updateTotals();
        await logAdminAction(
          db, appId,
          { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome, role: userProfile?.role },
          'DELETE_CIDADAOS_MASS',
          `Exclusão em massa: ${excluidos.length} usuários`,
          { count: excluidos.length, ids: excluidos }
        );
      }

      if (erros.length === 0) {
        alert(`${excluidos.length} usuário(s) excluído(s) com sucesso.`);
      } else if (excluidos.length > 0) {
        alert(`${excluidos.length} excluído(s). ${erros.length} falhou(aram):\n${erros.map((e) => e.id).join(', ')}`);
      } else {
        alert(`Nenhum usuário foi excluído.\n${erros[0]?.msg || 'Verifique suas permissões de administrador.'}`);
      }
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        idsParaExcluir.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const handleDeleteOne = async (id, nomeExibicao = '') => {
    if (!db || !id) return;
    const rotulo = nomeExibicao || id;
    if (!window.confirm(`Deseja realmente excluir o usuário "${rotulo}"?`)) return;

    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await excluirDocumentoCidadao(id);
      removerUsuariosDaLista([id]);
      updateTotals();

      await logAdminAction(
        db, appId,
        { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome, role: userProfile?.role },
        'DELETE_CIDADAO',
        `Usuário excluído: ${rotulo}`,
        { id, nome: nomeExibicao || null }
      );
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      const msg = getFriendlyFirebaseError(
        err,
        'Não foi possível excluir. Verifique se você tem perfil de Coordenador ou Superintendente.'
      );
      alert(msg);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const buscarInfoAtendimentosRegistro = async (registro) => {
    const atendPath = `artifacts/${appId}/public/data/atendimentos`;
    const variants = variantesCpfBusca(registro);
    const idsVistos = new Set();
    let total = 0;
    let comObs = 0;
    let ultimaObs = '';
    let ultimaObsMs = 0;

    for (const variant of variants) {
      try {
        const snap = await getDocs(
          query(collection(db, atendPath), where('cidadao.cpf', '==', variant), limit(40))
        );
        snap.docs.forEach((d) => {
          if (idsVistos.has(d.id)) return;
          idsVistos.add(d.id);
          const data = d.data() || {};
          total += 1;
          const obs = String(data.observacoes || '').trim();
          if (obs) {
            comObs += 1;
            const ms = getMillisValor(data.hora_fim || data.hora_chegada);
            if (ms >= ultimaObsMs) {
              ultimaObsMs = ms;
              ultimaObs = obs.length > 180 ? `${obs.slice(0, 180)}…` : obs;
            }
          }
        });
      } catch (e) {
        console.warn('[duplicados] atendimentos', variant, e);
      }
    }

    return { total, comObs, ultimaObs, ultimaObsData: ultimaObsMs ? new Date(ultimaObsMs).toLocaleString('pt-BR') : '' };
  };

  const enriquecerGruposDuplicados = async (grupos) => {
    const cacheAtend = new Map();
    const enriquecerRegistro = async (reg) => {
      const cacheKey = reg.id;
      if (!cacheAtend.has(cacheKey)) {
        cacheAtend.set(cacheKey, await buscarInfoAtendimentosRegistro(reg));
      }
      const atendInfo = cacheAtend.get(cacheKey);
      return { ...reg, _info: montarInfoRegistro(reg, atendInfo) };
    };

    const out = [];
    for (const grupo of grupos) {
      const registros = [];
      for (const reg of grupo.registros) {
        registros.push(await enriquecerRegistro(reg));
      }
      registros.sort((a, b) => (b._info?.pontuacao || 0) - (a._info?.pontuacao || 0));
      const principalSugerido = registros[0]?.id || '';
      out.push({ ...grupo, registros, principalSugerido });
    }
    return out;
  };

  const vasculharDuplicados = async () => {
    if (!db) return;
    setScanningDuplicados(true);
    setResultadoDuplicados(null);
    try {
      const todos = [];
      let lastDoc = null;
      while (todos.length < BUSCA_MAX_DOCS) {
        let qLote = query(collection(db, collectionPath), orderBy('nome'), limit(BUSCA_LOTE));
        if (lastDoc) qLote = query(qLote, startAfter(lastDoc));
        const snap = await getDocs(qLote);
        if (snap.empty) break;
        snap.docs.forEach((d) => todos.push({ id: d.id, ...d.data() }));
        lastDoc = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < BUSCA_LOTE) break;
      }

      const mapCpf = new Map();
      const mapNome = new Map();
      const mapNomeNasc = new Map();

      todos.forEach((u) => {
        const cpf = String(u.cpf || '').replace(/\D/g, '');
        const cpfId = String(u.id || '').replace(/\D/g, '');
        const cpfFinal = cpf.length === 11 ? cpf : (cpfId.length === 11 ? cpfId : '');
        if (cpfFinal) {
          if (!mapCpf.has(cpfFinal)) mapCpf.set(cpfFinal, []);
          mapCpf.get(cpfFinal).push(u);
        }

        const nomeKey = simplify(String(u.nome || '').trim());
        if (nomeKey.length >= 3) {
          if (!mapNome.has(nomeKey)) mapNome.set(nomeKey, []);
          mapNome.get(nomeKey).push(u);
        }

        const nasc = normalizeDate(String(u.dataNascimento || '').trim());
        if (nomeKey.length >= 3 && nasc) {
          const combo = `${nomeKey}|${nasc}`;
          if (!mapNomeNasc.has(combo)) mapNomeNasc.set(combo, []);
          mapNomeNasc.get(combo).push(u);
        }
      });

      const mapGrupos = (mapa, tipo) =>
        [...mapa.entries()]
          .filter(([, arr]) => arr.length > 1)
          .map(([chave, registros]) => ({ tipo, chave, registros }))
          .sort((a, b) => b.registros.length - a.registros.length);

      const porCpfRaw = mapGrupos(mapCpf, 'cpf');
      const porNomeRaw = mapGrupos(mapNome, 'nome');
      const porNomeNascRaw = mapGrupos(mapNomeNasc, 'nome_nasc');

      const [porCpf, porNome, porNomeNasc] = await Promise.all([
        enriquecerGruposDuplicados(porCpfRaw),
        enriquecerGruposDuplicados(porNomeRaw),
        enriquecerGruposDuplicados(porNomeNascRaw),
      ]);

      setResultadoDuplicados({
        totalAnalisados: todos.length,
        porCpf,
        porNome,
        porNomeNasc,
      });
    } catch (err) {
      console.error('Erro ao vasculhar duplicados:', err);
      alert(getFriendlyFirebaseError(err, 'Erro ao analisar duplicados.'));
    } finally {
      setScanningDuplicados(false);
    }
  };

  const mesclarDadosCidadao = (principal, secundarios) => {
    const merged = { ...principal };
    const chavesIgnorar = new Set(['id', 'createdAt', 'importadoEm', 'origemImportacao']);

    secundarios.forEach((sec) => {
      Object.entries(sec).forEach(([key, val]) => {
        if (chavesIgnorar.has(key) || key.startsWith('_')) return;
        const atual = merged[key];

        if (!temConteudoValor(atual) && temConteudoValor(val)) {
          merged[key] = val;
          return;
        }

        if (Array.isArray(atual) && Array.isArray(val)) {
          merged[key] = [...new Set([...atual, ...val])];
          return;
        }

        if (temConteudoValor(val) && temConteudoValor(atual)) {
          if (getMillisValor(val) > getMillisValor(atual)) {
            merged[key] = val;
          } else if (typeof val === 'string' && typeof atual === 'string' && val.length > atual.length) {
            merged[key] = val;
          }
        }
      });
    });

    const cpfLimpo = String(merged.cpf || merged.id || '').replace(/\D/g, '');
    if (cpfLimpo.length === 11) merged.cpf = formatCpf(cpfLimpo);
    if (merged.nome) merged.nome = normalizeName(merged.nome);
    if (merged.nomeSocial) merged.nomeSocial = normalizeName(merged.nomeSocial);
    merged.unificado_em = serverTimestamp();
    merged.unificado_de_ids = secundarios.map((s) => s.id);

    return merged;
  };

  const migrarAtendimentosParaCpf = async (registrosOrigem, registroDestino) => {
    const atendPath = `artifacts/${appId}/public/data/atendimentos`;
    const cpfDestino = String(registroDestino.cpf || '').replace(/\D/g, '');
    const cpfDestinoFmt = cpfDestino.length === 11 ? formatCpf(cpfDestino) : String(registroDestino.cpf || registroDestino.id || '');
    const idsAtendAtualizados = new Set();

    for (const origem of registrosOrigem) {
      const variants = variantesCpfBusca(origem);
      for (const variant of variants) {
        try {
          const snap = await getDocs(
            query(collection(db, atendPath), where('cidadao.cpf', '==', variant), limit(100))
          );
          let batch = writeBatch(db);
          let ops = 0;

          for (const d of snap.docs) {
            if (idsAtendAtualizados.has(d.id)) continue;
            idsAtendAtualizados.add(d.id);
            const data = d.data() || {};
            const cid = { ...(data.cidadao || {}) };
            cid.cpf = cpfDestinoFmt;
            if (!cid.nome && registroDestino.nome) cid.nome = registroDestino.nome;
            if (!cid.nomeSocial && registroDestino.nomeSocial) cid.nomeSocial = registroDestino.nomeSocial;
            batch.update(d.ref, {
              cidadao: cid,
              nome_exibicao: normalizeName(registroDestino.nomeSocial || registroDestino.nome || data.nome_exibicao || ''),
            });
            ops += 1;
            if (ops >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              ops = 0;
            }
          }
          if (ops > 0) await batch.commit();
        } catch (e) {
          console.warn('[unificar] migrar atendimentos', variant, e);
        }
      }
    }

    return idsAtendAtualizados.size;
  };

  const unificarCadastros = async (idPrincipal, idsSecundarios, rotuloGrupo = '') => {
    if (!db || !idPrincipal || !idsSecundarios?.length) return;
    const secundarios = idsSecundarios.filter((id) => id && id !== idPrincipal);
    if (!secundarios.length) {
      alert('Selecione ao menos um cadastro secundário diferente do principal.');
      return;
    }

    if (!window.confirm(
      `Unificar ${secundarios.length} cadastro(s) no principal?\n\n` +
      `• Os dados (ficha, observações, encaminhamentos) serão mesclados no cadastro mantido.\n` +
      `• Atendimentos antigos serão vinculados ao CPF principal.\n` +
      `• Os cadastros duplicados serão excluídos.\n\n` +
      (rotuloGrupo ? `Grupo: ${rotuloGrupo}` : '')
    )) return;

    setUnificandoGrupo(true);
    try {
      const snapPrincipal = await getDoc(doc(db, collectionPath, idPrincipal));
      if (!snapPrincipal.exists()) throw new Error('Cadastro principal não encontrado.');

      const principal = { id: snapPrincipal.id, ...snapPrincipal.data() };
      const docsSecundarios = [];
      for (const id of secundarios) {
        const snap = await getDoc(doc(db, collectionPath, id));
        if (snap.exists()) docsSecundarios.push({ id: snap.id, ...snap.data() });
      }
      if (!docsSecundarios.length) throw new Error('Nenhum cadastro secundário encontrado.');

      const cpfLimpo = String(principal.cpf || principal.id || '').replace(/\D/g, '');
      const idDestino = cpfLimpo.length === 11 ? cpfLimpo : idPrincipal;
      const payload = mesclarDadosCidadao(principal, docsSecundarios);
      delete payload.id;

      const atendMigrados = await migrarAtendimentosParaCpf(docsSecundarios, payload);

      await setDoc(doc(db, collectionPath, idDestino), payload, { merge: true });

      for (const sec of docsSecundarios) {
        if (sec.id !== idDestino) {
          await deleteDoc(doc(db, collectionPath, sec.id));
        }
      }
      if (idPrincipal !== idDestino) {
        await deleteDoc(doc(db, collectionPath, idPrincipal));
      }

      removerUsuariosDaLista([...secundarios, ...(idPrincipal !== idDestino ? [idPrincipal] : [])]);
      updateTotals();

      await logAdminAction(
        db, appId,
        { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome, role: userProfile?.role },
        'UNIFICAR_CIDADAOS',
        `Cadastros unificados em ${idDestino}`,
        { idDestino, idPrincipal, secundarios, atendMigrados }
      );

      alert(`Unificação concluída.\nCadastro mantido: ${idDestino}\nAtendimentos reassociados: ${atendMigrados}`);
    } catch (err) {
      console.error('Erro ao unificar cadastros:', err);
      alert(getFriendlyFirebaseError(err, 'Erro ao unificar cadastros.'));
    } finally {
      setUnificandoGrupo(false);
    }
  };

  // Funções de Criação
  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setCreateData(prev => ({ ...prev, [name]: value }));
  };

  const cancelCreate = () => {
    setCreating(false);
    setCreateData({
        nome: '', cpf: '', nomeSocial: '', dataNascimento: '',
        nomeMae: '', nomePai: '', telefone: '', nis: '', rg: '',
        sexo: '', cor: '', escolaridade: '', religiao: '',
        orientacaoSexual: '', naturalidade: '', uf: '',
        nacionalidade: 'Brasileira', conjuge: '', tecnicoResponsavel: '',
        origemDemanda: '', dataCadastro: new Date().toLocaleDateString('pt-BR'),
        cras_id_principal: ''
      });
  };

  const saveCreate = async (e) => {
    e.preventDefault();
    if (!db) return;
    
    // Validações básicas
    if (!createData.nome) {
      alert("Nome é obrigatório");
      return;
    }

    setLoading(true);
    try {
        const dataNascNormalizada = normalizeDate(createData.dataNascimento);
        const cpfLimpo = (createData.cpf || '').replace(/\D/g, '');

        let crasIdFinal = createData.cras_id_principal || '';
        if (!crasIdFinal) {
          crasIdFinal = userProfile?.cras_id || '';
          if (!crasIdFinal) {
            const crasSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/cras_unidades`));
            const centroPop = crasSnap.docs.find((d) => {
              const nome = simplify(d.data()?.nome || '');
              return nome.includes('centro') && nome.includes('pop') && !nome.includes('cohab') && !nome.includes('anil');
            });
            crasIdFinal = centroPop?.id || '';
          }
        }
        
        const payload = {
            ...createData,
            cras_id_principal: crasIdFinal,
            nome: normalizeName(createData.nome),
            nomeSocial: createData.nomeSocial ? createData.nomeSocial : '',
            nomeMae: normalizeName(createData.nomeMae),
            nomePai: normalizeName(createData.nomePai),
            conjuge: normalizeName(createData.conjuge),
            dataNascimento: dataNascNormalizada,
            cpf: cpfLimpo,
            dataCadastro: createData.dataCadastro || new Date().toLocaleDateString('pt-BR'),
            origemCadastro: 'Manual (Admin)',
            createdAt: serverTimestamp()
        };

        // Verifica se CPF já existe
        if (cpfLimpo && cpfLimpo.length === 11) {
             const docRef = doc(db, collectionPath, cpfLimpo);
             const docSnap = await getDoc(docRef);
             if (docSnap.exists()) {
                 alert("Já existe um usuário cadastrado com este CPF (ID do documento).");
                 setLoading(false);
                 return;
             }
             // Verifica também se existe algum documento com esse campo cpf, caso o ID não seja o CPF
             const q = query(collection(db, collectionPath), where("cpf", "==", cpfLimpo));
             const qSnap = await getDocs(q);
             if (!qSnap.empty) {
                 alert("Já existe um usuário cadastrado com este CPF.");
                 setLoading(false);
                 return;
             }
             
             await setDoc(docRef, payload);
        } else {
             await addDoc(collection(db, collectionPath), payload);
        }

        if (cpfLimpo && cpfLimpo.length === 11 && payload.nome) {
          try {
            await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: GOOGLE_SHEETS_TOKEN,
                action: "upsert_user",
                cpf: cpfLimpo,
                nome: payload.nome
              })
            });
          } catch {}
        }

        await logAdminAction(
          db, appId, 
          { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome }, 
          "CREATE_CIDADAO", 
          `Novo Usuário Cadastrado: ${payload.nome}`, 
          { ...payload }
        );

        alert("Usuário criado com sucesso!");
        cancelCreate(); // Reseta e fecha
    } catch (err) {
        console.error("Erro ao criar usuário:", err);
        alert(getFriendlyFirebaseError(err, "Erro ao criar usuário."));
    } finally {
        setLoading(false);
    }
  };

  const openEdit = (u) => {
    setEditing(u.id);
    setEditData({
      nome: u.nome || '',
      cpf: u.cpf || '',
      telefone: u.telefone || '',
      nomeMae: u.nomeMae || '',
      nomeSocial: u.nomeSocial || '',
      dataNascimento: u.dataNascimento || '',
      nomePai: u.nomePai || '',
      nis: u.nis || '',
      rg: u.rg || '',
      dataCadastro: u.dataCadastro || '',
      origemDemanda: u.origemDemanda || '',
      tecnicoResponsavel: u.tecnicoResponsavel || '',
      conjuge: u.conjuge || '',
      cor: u.cor || '',
      sexo: u.sexo || '',
      religiao: u.religiao || '',
      orientacaoSexual: u.orientacaoSexual || '',
      naturalidade: u.naturalidade || '',
      uf: u.uf || '',
      nacionalidade: u.nacionalidade || '',
      escolaridade: u.escolaridade || '',
      cras_id_principal: u.cras_id_principal || ''
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!db || !editing) return;
    
    // Normalizar data de nascimento antes de salvar
    const dataNascNormalizada = normalizeDate(editData.dataNascimento);
    
    const payload = {
      ...editData,
      dataNascimento: dataNascNormalizada,
      cpf: (editData.cpf || '').replace(/\D/g, '')
    };
    try {
      await updateDoc(doc(db, collectionPath, editing), payload);
      
      await logAdminAction(
        db, appId, 
        { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome }, 
        "UPDATE_CIDADAO", 
        `Usuário Atualizado: ${payload.nome}`, 
        { id: editing, ...payload }
      );

      setEditing(null);
    } catch (err) {
      console.error('Erro ao atualizar usuário', err);
    }
  };

  const cancelarEdicao = () => {
    setEditing(null);
  };

  const getTipoCadastro = (u) => {
    if (u.origemImportacao) return 'Importado';
    if (u.origemCadastro) return 'Manual';
    return 'Manual';
  };

  const safeVal = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        // Se for Timestamp do Firestore
        if (val.toDate && typeof val.toDate === 'function') {
            return val.toDate().toLocaleDateString('pt-BR');
        }
        // Se for Date do JS
        if (val instanceof Date) {
            return val.toLocaleDateString('pt-BR');
        }
        return ''; // Objeto desconhecido, melhor não renderizar para evitar crash
    }
    return String(val);
  };

  const handleCorrigirNomesAtendimentos = async () => {
    if (!db) return;
    if (!window.confirm('Esta ação vai tentar corrigir atendimentos sem nome usando a tabela de usuários (CPF). Deseja continuar?')) return;
    setFixingNames(true);
    setFixResult(null);
    try {
      const atendimentosPath = `artifacts/${appId}/public/data/atendimentos`;

      const mapaCidadaos = new Map();
      let lastCid = null;
      while (true) {
        let q = query(collection(db, collectionPath), orderBy(documentId()), limit(400));
        if (lastCid) q = query(collection(db, collectionPath), orderBy(documentId()), startAfter(lastCid), limit(400));
        const snap = await getDocs(q);
        if (snap.empty) break;
        lastCid = snap.docs[snap.docs.length - 1];
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          const cpf = (data.cpf || '').toString().replace(/\D/g, '');
          if (cpf) mapaCidadaos.set(cpf, { nome: data.nome || '', nomeSocial: data.nomeSocial || '' });
        });
        if (snap.size < 400) break;
      }

      let lastAtend = null;
      let total = 0;
      let semNome = 0;
      let corrigidos = 0;
      while (true) {
        let q = query(collection(db, atendimentosPath), orderBy(documentId()), limit(400));
        if (lastAtend) q = query(collection(db, atendimentosPath), orderBy(documentId()), startAfter(lastAtend), limit(400));
        const snap = await getDocs(q);
        if (snap.empty) break;
        lastAtend = snap.docs[snap.docs.length - 1];

        let batch = writeBatch(db);
        let ops = 0;

        for (const docSnap of snap.docs) {
          total += 1;
          const data = docSnap.data() || {};
          const cid = data.cidadao || {};
          const nomeAtual = (cid.nome || '').trim();
          const nomeSocialAtual = (cid.nomeSocial || '').trim();
          if (nomeAtual || nomeSocialAtual) continue;
          semNome += 1;
          const cpf = (cid.cpf || '').toString().replace(/\D/g, '');
          if (!cpf) continue;
          const base = mapaCidadaos.get(cpf);
          if (!base || (!base.nome && !base.nomeSocial)) continue;
          batch.update(doc(db, atendimentosPath, docSnap.id), {
            cidadao: { ...cid, nome: base.nome || '', nomeSocial: base.nomeSocial || '' }
          });
          ops++;
          corrigidos++;
          if (ops >= 380) {
            await batch.commit();
            batch = writeBatch(db);
            ops = 0;
          }
        }
        if (ops > 0) await batch.commit();
        if (snap.size < 400) break;
      }

      setFixResult({
        totalAtendimentos: total,
        atendimentosSemNome: semNome,
        corrigidos,
      });
      alert(
        `Correção concluída.\nTotal de atendimentos: ${total}\nSem nome: ${semNome}\nCorrigidos: ${corrigidos}`
      );
    } catch (err) {
      console.error('Erro ao corrigir nomes de atendimentos:', err);
      alert('Erro ao corrigir nomes de atendimentos. Veja o console para detalhes.');
    } finally {
      setFixingNames(false);
    }
  };

  const handlePadronizarDatas = async () => {
    if (!db) return;
    if (!window.confirm('Esta ação irá analisar todos os usuários e tentar padronizar as datas de nascimento para o formato DD/MM/YYYY. \n\nAlém de corrigir, o sistema irá buscar inconsistências como:\n- Datas futuras\n- Datas muito antigas\n- Datas iguais ao cadastro (possível erro de preenchimento)\n\nDeseja continuar?')) return;
    
    setFixingDates(true);
    setFixResult(null);
    
    try {
        const batchSize = 400;
        let batch = writeBatch(db);
        let ops = 0;
        let totalCorrigidos = 0;
        let totalAnalisados = 0;
        let totalAlertas = 0;
        
        // Data de hoje para comparação
        const hoje = new Date();
        hoje.setHours(0,0,0,0);

        // Fetch ALL docs in batches
        let lastDoc = null;
        let hasMore = true;
        
        while (hasMore) {
            let q = query(collection(db, collectionPath), orderBy(documentId()), limit(500));
            if (lastDoc) {
                q = query(collection(db, collectionPath), orderBy(documentId()), startAfter(lastDoc), limit(500));
            }
            
            const snap = await getDocs(q);
            if (snap.empty) {
                hasMore = false;
                break;
            }
            
            lastDoc = snap.docs[snap.docs.length - 1];
            const todosUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            for (const u of todosUsuarios) {
                totalAnalisados++;
                
                // Busca data em vários campos possíveis
                let raw = u.dataNascimento;
                let mudouCampo = false;
                
                if (!raw) {
                    if (u.data_nascimento) { raw = u.data_nascimento; mudouCampo = true; }
                    else if (u.nascimento) { raw = u.nascimento; mudouCampo = true; }
                    else if (u.dtNasc) { raw = u.dtNasc; mudouCampo = true; }
                }

                // Normaliza usando a função aprimorada
                let normalized = raw ? normalizeDate(raw) : '';
                
                // Análise de inconsistências
                let alerta = null;
                const isDatePattern = /^\d{2}\/\d{2}\/\d{4}$/.test(normalized);

                if (raw && !isDatePattern) {
                    alerta = "Formato inválido ou não reconhecido";
                } else if (isDatePattern) {
                    const [d, m, y] = normalized.split('/').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    
                    if (dateObj > hoje) {
                        alerta = "Data futura";
                    } else if (y < 1900) {
                        alerta = "Data muito antiga (antes de 1900)";
                    } else {
                        // Verifica se é igual a data de cadastro (se houver e for válida)
                        if (u.dataCadastro) {
                            const normCadastro = normalizeDate(u.dataCadastro);
                            if (normCadastro === normalized) {
                                alerta = "Data igual ao cadastro (possível erro)";
                            }
                        }
                    }
                }
                
                // Se tiver alerta, adiciona ao update
                const temAlerta = !!alerta;
                if (temAlerta) totalAlertas++;

                // Só atualiza se mudou o valor OU se tem alerta novo OU se o alerta mudou
                const alertaAntigo = u._alertaDataNascimento || null;
                
                // Garantir que não removemos usuários, apenas atualizamos o alerta
                if (normalized !== u.dataNascimento || mudouCampo || alerta !== alertaAntigo) {
                    const ref = doc(db, collectionPath, u.id);
                    const updateData = {};
                    
                    // Se normalizou e é diferente, atualiza a data
                    if (normalized !== u.dataNascimento || mudouCampo) {
                        updateData.dataNascimento = normalized;
                    }

                    // Atualiza ou remove o alerta
                    if (alerta) {
                        updateData._alertaDataNascimento = alerta;
                    } else {
                        updateData._alertaDataNascimento = deleteField();
                    }
                    
                    batch.update(ref, updateData);
                    ops++;
                    if (normalized !== u.dataNascimento || mudouCampo) {
                        totalCorrigidos++;
                    }
                    
                    if (ops >= batchSize) {
                        await batch.commit();
                        batch = writeBatch(db);
                        ops = 0;
                    }
                }
            }
        }
        
        if (ops > 0) {
            await batch.commit();
        }
        
        const msg = `Análise e Padronização concluídas.\n\n` +
                    `- Usuários analisados: ${totalAnalisados}\n` +
                    `- Datas corrigidas/migradas: ${totalCorrigidos}\n` +
                    `- Alertas gerados: ${totalAlertas}\n\n` +
                    `Os usuários com inconsistências foram marcados com um ícone de alerta na tabela.`;
        
        setFixResult({ msg });
        alert(msg);
        
    } catch (err) {
        console.error("Erro ao padronizar datas:", err);
        alert('Erro ao padronizar datas. Veja o console.');
    } finally {
        setFixingDates(false);
    }
  };

  const handlePadronizarCPFs = async () => {
    if (!db) return;
    if (!window.confirm('Esta ação irá analisar todos os usuários para:\n\n1. Identificar CPFs com tamanho incorreto (diferente de 11 dígitos).\n2. Formatar CPFs corretos para o padrão 000.000.000-00.\n\nDeseja continuar?')) return;
    
    setFixingCPFs(true);
    setFixResultCPF(null);
    
    try {
        const batchSize = 400;
        let batch = writeBatch(db);
        let ops = 0;
        let totalCorrigidos = 0;
        let totalAnalisados = 0;
        let totalAlertas = 0;
        
        // Fetch ALL docs in batches
        let lastDoc = null;
        let hasMore = true;
        
        while (hasMore) {
            let q = query(collection(db, collectionPath), orderBy(documentId()), limit(500));
            if (lastDoc) {
                q = query(collection(db, collectionPath), orderBy(documentId()), startAfter(lastDoc), limit(500));
            }
            
            const snap = await getDocs(q);
            if (snap.empty) {
                hasMore = false;
                break;
            }
            
            lastDoc = snap.docs[snap.docs.length - 1];
            const todosUsuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            for (const u of todosUsuarios) {
                totalAnalisados++;
                
                const raw = u.cpf || '';
                const apenasNumeros = raw.replace(/\D/g, '');
                
                let novoCpf = raw;
                let alerta = null;
                
                if (apenasNumeros.length > 0) {
                    if (apenasNumeros.length !== 11) {
                        alerta = `CPF Inválido: ${apenasNumeros.length} dígitos`;
                    } else {
                        // Formatar se tiver 11 dígitos
                        novoCpf = apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                    }
                }
                
                // Se tiver alerta, adiciona ao update
                const temAlerta = !!alerta;
                if (temAlerta) totalAlertas++;
    
                // Só atualiza se mudou o valor OU se tem alerta novo OU se o alerta mudou
                const alertaAntigo = u._alertaCPF || null;
                const cpfMudou = novoCpf !== raw;
                const alertaMudou = alerta !== alertaAntigo;
                
                if (cpfMudou || alertaMudou) {
                    const ref = doc(db, collectionPath, u.id);
                    const updateData = {};
                    
                    if (cpfMudou) updateData.cpf = novoCpf;
                    
                    // Atualiza ou remove alerta
                    if (alerta) {
                        updateData._alertaCPF = alerta;
                    } else {
                        updateData._alertaCPF = deleteField();
                    }
                    
                    batch.update(ref, updateData);
                    ops++;
                    
                    if (cpfMudou) totalCorrigidos++;
                    // Contabiliza alertas novos
                    if (alerta && !alertaAntigo) { 
                       // já incrementado acima
                    }
                    
                    if (ops >= batchSize) {
                        await batch.commit();
                        batch = writeBatch(db);
                        ops = 0;
                    }
                }
            }
        }
        
        if (ops > 0) {
            await batch.commit();
        }
        
        const msg = `Análise de CPF concluída.\n\n` +
                    `- Analisados: ${totalAnalisados}\n` +
                    `- Formatados (pontuação adicionada): ${totalCorrigidos}\n` +
                    `- Alertas de tamanho incorreto: ${totalAlertas}`;
        
        setFixResultCPF({ msg });
        alert(msg);
        
    } catch (err) {
        console.error("Erro ao padronizar CPFs:", err);
        alert('Erro ao padronizar CPFs. Veja o console.');
    } finally {
        setFixingCPFs(false);
    }
  };

  const handleMigrarOrdenacao = async () => {
      if (!db) return;
      if (!window.confirm("Esta ação irá definir uma data de criação aproximada para todos os usuários antigos que não possuem o campo 'createdAt'. Isso permitirá que eles apareçam na ordenação por 'Mais Recentes'. Deseja continuar?")) return;
      
      setLoading(true);
      try {
          // Processa em lotes grandes pois é uma leitura total
          // Atenção: Isso pode ler muitos documentos.
          const q = query(collection(db, collectionPath));
          const snapshot = await getDocs(q);
          
          let batch = writeBatch(db);
          let ops = 0;
          let updated = 0;
          
          // Data padrão para antigos (01/01/2000)
          // Se tiver dataCadastro string, tentamos parsear
          const defaultDate = new Date(2000, 0, 1);
          
          for (const docSnap of snapshot.docs) {
              const data = docSnap.data();
              if (!data.createdAt) {
                  let timestamp = Timestamp.fromDate(defaultDate);
                  
                  // Prioridade para cadastradoEm (Recepção)
                  if (data.cadastradoEm && data.cadastradoEm.toDate) {
                      timestamp = data.cadastradoEm;
                  } else if (data.dataCadastro) {
                      // Tenta parsear dd/mm/yyyy
                      const parts = data.dataCadastro.split('/');
                      if (parts.length === 3) {
                          const d = parseInt(parts[0]);
                          const m = parseInt(parts[1]) - 1;
                          const y = parseInt(parts[2]);
                          if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                              timestamp = Timestamp.fromDate(new Date(y, m, d));
                          }
                      }
                  }
                  
                  batch.update(docSnap.ref, { createdAt: timestamp });
                  ops++;
                  updated++;
                  
                  if (ops >= 400) {
                      await batch.commit();
                      batch = writeBatch(db);
                      ops = 0;
                  }
              }
          }
          
          if (ops > 0) {
              await batch.commit();
          }
          
          alert(`Migração concluída! ${updated} usuários atualizados.`);
          
      } catch (err) {
          console.error("Erro na migração:", err);
          alert(getFriendlyFirebaseError(err, "Erro ao migrar ordenação."));
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteImportados = async () => {
    if (!db) return;
    if (!window.confirm("ATENÇÃO: Deseja EXCLUIR TODOS os usuários importados?\n\nUsuários cadastrados manualmente serão preservados.\n\nEsta ação é irreversível e excluirá permanentemente os registros importados.")) return;
    if (!window.confirm("Confirmação final: Tem certeza que deseja apagar os usuários importados?")) return;
    
    setDeletingImportados(true);
    try {
      const colRef = collection(db, collectionPath);
      let totalDeleted = 0;
      let totalSkipped = 0;
      
      let last = null;
      while (true) {
        let q = query(colRef, orderBy(documentId()), limit(400));
        if (last) q = query(colRef, orderBy(documentId()), startAfter(last), limit(400));
        
        const snap = await getDocs(q);
        if (snap.empty) break;
        last = snap.docs[snap.docs.length - 1];

        let batch = writeBatch(db);
        let ops = 0;

        for (const d of snap.docs) {
           const u = d.data() || {};
           const isImportado = !!u.origemImportacao;
           const isManual = (u.origemCadastro && String(u.origemCadastro).toLowerCase().includes('manual'));

           // Deleta se for importado E NÃO for manual explicitamente
           if (isImportado && !isManual) {
              batch.delete(d.ref);
              ops++;
              totalDeleted++;
           } else {
              totalSkipped++;
           }

           if (ops >= 380) {
              await batch.commit();
              batch = writeBatch(db);
              ops = 0;
           }
        }
        if (ops > 0) await batch.commit();
      }
      
      await logAdminAction(
          db, appId, 
          { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome }, 
          "DELETE_IMPORTADOS_MASS", 
          `Exclusão em massa de importados`, 
          { totalDeleted, totalSkipped }
      );
      
      alert(`Operação concluída.\n\n- Excluídos: ${totalDeleted}\n- Mantidos (Manuais/Outros): ${totalSkipped}`);

    } catch (e) {
      console.error(e);
      alert(getFriendlyFirebaseError(e, "Erro ao excluir importados."));
    } finally {
      setDeletingImportados(false);
    }
  };

  const handleMigrarUnidadePrincipal = async () => {
    if (!db || !appId) return;
    if (!window.confirm(
      'Esta ação irá definir "Centro Pop Centro" como unidade principal de todos os usuários ' +
      'que ainda não têm unidade definida.\n\n' +
      'Usuários com unidade já definida não serão afetados.\n\n' +
      'Deseja continuar?'
    )) return;

    setLoading(true);
    try {
      const crasSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/cras_unidades`));
      const todasUnidades = crasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const centroPop = todasUnidades.find(u => {
        const nome = simplify(u.nome || '');
        return nome.includes('centro') && nome.includes('pop')
          && !nome.includes('cohab') && !nome.includes('anil');
      });

      if (!centroPop) {
        alert(
          'Unidade "Centro Pop Centro" não encontrada.\n\n' +
          'Certifique-se de que ela existe em Administração → Unidades.'
        );
        return;
      }

      const cidadaosRef = collection(db, collectionPath);
      let batch = writeBatch(db);
      let ops = 0;
      let migrados = 0;
      let last = null;

      while (true) {
        let q = query(cidadaosRef, orderBy(documentId()), limit(400));
        if (last) q = query(cidadaosRef, orderBy(documentId()), startAfter(last), limit(400));
        const snap = await getDocs(q);
        if (snap.empty) break;
        last = snap.docs[snap.docs.length - 1];

        for (const d of snap.docs) {
          const data = d.data() || {};
          if (!data.cras_id_principal) {
            batch.update(d.ref, { cras_id_principal: centroPop.id });
            ops++;
            migrados++;
          }
          if (ops >= 380) {
            await batch.commit();
            batch = writeBatch(db);
            ops = 0;
          }
        }
        if (snap.size < 400) break;
      }
      if (ops > 0) await batch.commit();

      alert(`Migração concluída!\n\n${migrados} usuários agora têm "Centro Pop Centro" como unidade principal.`);
    } catch (err) {
      console.error('Erro na migração de unidade:', err);
      alert(getFriendlyFirebaseError(err, 'Erro ao migrar unidades.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCorrigirUnidadeIncorreta = async () => {
    if (!db || !appId) return;

    const crasSnap = await getDocs(collection(db, `artifacts/${appId}/public/data/cras_unidades`));
    const todasUnidades = crasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const centroPop = todasUnidades.find((u) => {
      const nome = simplify(u.nome || '');
      return nome.includes('centro') && nome.includes('pop') && !nome.includes('cohab') && !nome.includes('anil');
    });

    const cohabAnil = todasUnidades.find((u) => {
      const nome = simplify(u.nome || '');
      return nome.includes('cohab') || nome.includes('anil');
    });

    if (!centroPop) {
      alert('Unidade "Centro Pop Centro" não encontrada no Firestore.\nVerifique em Administração → Unidades.');
      return;
    }

    if (!cohabAnil) {
      alert('Unidade Cohab/Anil não encontrada. Nenhuma correção necessária.');
      return;
    }

    const qContagem = query(
      collection(db, collectionPath),
      where('cras_id_principal', '==', cohabAnil.id)
    );
    const snapContagem = await getDocs(qContagem);
    const qtd = snapContagem.size;

    if (qtd === 0) {
      alert('Nenhum usuário encontrado com a unidade Cohab/Anil. Nada a corrigir.');
      return;
    }

    if (
      !window.confirm(
        `Foram encontrados ${qtd} usuário(s) associados a "${cohabAnil.nome}" incorretamente.\n\n` +
          `Eles serão reassociados para "${centroPop.nome}".\n\n` +
          `Esta ação pode ser desfeita manualmente se necessário.\n\nDeseja continuar?`
      )
    )
      return;

    setLoading(true);
    try {
      let batch = writeBatch(db);
      let ops = 0;
      let corrigidos = 0;

      for (const d of snapContagem.docs) {
        batch.update(d.ref, { cras_id_principal: centroPop.id });
        ops++;
        corrigidos++;
        if (ops >= 380) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();

      await logAdminAction(
        db,
        appId,
        { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome },
        'CORRIGIR_UNIDADE_PRINCIPAL',
        `Corrigidos ${corrigidos} usuários de "${cohabAnil.nome}" → "${centroPop.nome}"`,
        { corrigidos, deId: cohabAnil.id, paraId: centroPop.id }
      );

      alert(`✅ Correção concluída!\n${corrigidos} usuários agora estão associados a "${centroPop.nome}".`);
    } catch (err) {
      console.error('Erro ao corrigir unidade:', err);
      alert(getFriendlyFirebaseError(err, 'Erro ao corrigir unidade dos usuários.'));
    } finally {
      setLoading(false);
    }
  };

  // ==== SINCRONIZAR PLANILHA "USUARIOS" A PARTIR DO FIREBASE ====
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ added: 0, processed: 0 });

  const syncPlanilhaUsuarios = async () => {
    if (!db || !appId) return;
    setSyncingSheet(true);
    setSyncProgress({ added: 0, processed: 0 });
    try {
      const cidPath = `artifacts/${appId}/public/data/cidadaos`;
      const pageSize = 300;
      let lastDocSnap = null;
      let totalAdded = 0;
      let totalProcessed = 0;

      while (true) {
        let qBase = query(collection(db, cidPath), orderBy(documentId()), limit(pageSize));
        if (lastDocSnap) {
          qBase = query(collection(db, cidPath), orderBy(documentId()), startAfter(lastDocSnap), limit(pageSize));
        }
        const snap = await getDocs(qBase);
        if (snap.empty) break;
        lastDocSnap = snap.docs[snap.docs.length - 1];

        const items = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          const cpf = String(data.cpf || d.id || "").replace(/\D/g, "");
          const nome = String(data.nome || data.nomeSocial || "").trim();
          if (cpf.length === 11 && nome) {
            items.push({ cpf, nome });
          }
        });
        totalProcessed += items.length;

        for (let i = 0; i < items.length; i += 200) {
          const chunk = items.slice(i, i + 200);
          try {
            const res = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: GOOGLE_SHEETS_TOKEN,
                action: "upsert_users",
                items: chunk
              })
            });
            const json = await res.json().catch(() => ({}));
            if (json?.ok) {
              totalAdded += Number(json.added || 0);
            }
          } catch (e) {
            console.warn("Falha ao sincronizar lote:", e);
          }
          setSyncProgress({ added: totalAdded, processed: totalProcessed });
          await new Promise((r) => setTimeout(r, 150));
        }

        if (snap.size < pageSize) break;
      }
      alert(`Sincronização concluída.\nAdicionados na planilha: ${totalAdded}\nProcessados: ${totalProcessed}`);
    } catch (err) {
      console.error("Erro ao sincronizar planilha:", err);
      alert("Erro ao sincronizar planilha. Veja o console.");
    } finally {
      setSyncingSheet(false);
    }
  };

  return {
    usuarios,
    usuariosView,
    loading,
    syncingSheet,
    syncProgress,
    syncPlanilhaUsuarios,
    busca,
    setBusca,
    lastDocs,
    lastVisible,
    selectedIds,
    editing,
    editData,
    creating,
    setCreating,
    createData,
    fixingNames,
    fixingDates,
    fixingCPFs,
    fixingNaturalidade,
    revertingNaturalidade,
    fixResult,
    fixResultCPF,
    fixResultNaturalidade,
    lastNatFixRunId,
    filtroAlerta,
    filtroEstrangeiros,
    filtroUnidade,
    ordem,
    crasMap,
    setFiltroAlerta,
    setFiltroEstrangeiros,
    setFiltroUnidade,
    handleSearchSubmit,
    limparBusca,
    emModoBusca,
    totalResultadosBusca,
    totalPaginasBusca,
    paginaBusca,
    handleOrdemChange,
    handleNextPage,
    handlePrevPage,
    toggleSelect,
    toggleSelectAllView,
    handleDeleteSelected,
    handleDeleteOne,
    deletingIds,
    scanningDuplicados,
    unificandoGrupo,
    resultadoDuplicados,
    setResultadoDuplicados,
    vasculharDuplicados,
    unificarCadastros,
    handleCreateChange,
    cancelCreate,
    saveCreate,
    openEdit,
    handleEditChange,
    saveEdit,
    cancelarEdicao,
    getTipoCadastro,
    safeVal,
    handleCorrigirNomesAtendimentos,
    handlePadronizarDatas,
    handlePadronizarCPFs,
    handleCorrigirNaturalidadeUsuarios,
    handleReverterUltimaCorrecaoNaturalidade,
    handleMigrarOrdenacao,
    handleMigrarUnidadePrincipal,
    handleCorrigirUnidadeIncorreta,
    handleDeleteImportados,
    deletingImportados,
    totalUsuarios,
    totalImportados,
    ITENS_POR_PAGINA
  };
};

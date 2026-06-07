import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  doc, 
  getDoc,
  getCountFromServer
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { isTestUser, getFriendlyFirebaseError } from '../utils';

export const useFichaUsuarios = () => {
  const { db, appId, userProfile } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loadingLista, setLoadingLista] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const cache = useRef(new Map());
  const usuariosRef = useRef([]);
  const isMounted = useRef(true);
  
  useEffect(() => { 
    usuariosRef.current = usuarios; 
  }, [usuarios]);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const collectionPath = `artifacts/${appId}/public/data/atendimentos`;
  const cidadaosPath = `artifacts/${appId}/public/data/cidadaos`;

  const cleanCpf = (value) => String(value || "").replace(/\D/g, "");

  const getTotalAtendimentos = async (atendenteId, cpf) => {
    const cpfLimpo = cleanCpf(cpf);
    if (!atendenteId || cpfLimpo.length !== 11) return 0;
    const key = `totalAtendimentos:${atendenteId}:${cpfLimpo}`;
    if (cache.current.has(key)) return cache.current.get(key);

    try {
      const qCount = query(
        collection(db, collectionPath),
        where('atendente_id', '==', atendenteId),
        where('cidadao.cpf', '==', cpfLimpo)
      );
      const snap = await getCountFromServer(qCount);
      const total = snap?.data()?.count ?? 0;
      cache.current.set(key, total);
      return total;
    } catch (err) {
      try {
        const qFallback = query(
          collection(db, collectionPath),
          where('cidadao.cpf', '==', cpfLimpo),
          limit(2000)
        );
        const snap = await getDocs(qFallback);
        const total = snap.docs.reduce((acc, d) => (d.data()?.atendente_id === atendenteId ? acc + 1 : acc), 0);
        cache.current.set(key, total);
        return total;
      } catch {
        cache.current.set(key, 0);
        return 0;
      }
    }
  };

  const applyTotaisAtendimentos = async (listaFinal, atendenteId) => {
    if (!isMounted.current) return;
    const pendentes = (listaFinal || [])
      .map((u) => ({ cpf: u?.cpf, cpfLimpo: cleanCpf(u?.cpf) }))
      .filter((u) => u.cpfLimpo.length === 11);

    const chunkSize = 8;
    for (let i = 0; i < pendentes.length; i += chunkSize) {
      if (!isMounted.current) return;
      const slice = pendentes.slice(i, i + chunkSize);
      const results = await Promise.all(
        slice.map(async ({ cpf }) => {
          const total = await getTotalAtendimentos(atendenteId, cpf);
          return { cpf, total };
        })
      );
      if (!isMounted.current) return;
      setUsuarios((prev) =>
        prev.map((u) => {
          const hit = results.find((r) => cleanCpf(r.cpf) === cleanCpf(u.cpf));
          if (!hit) return u;
          return { ...u, totalAtendimentos: hit.total };
        })
      );
    }
  };

  // Função para buscar os usuários atendidos pelo psicólogo logado
  const carregarUsuarios = async (isNextPage = false) => {
    if (!db || !userProfile) return;
    
    // Se for busca nova, reseta tudo
    if (!isNextPage) {
      setLoadingLista(true);
      setUsuarios([]);
      setLastDoc(null);
      setHasMore(true);
    } else {
      if (!hasMore || loadingLista || loadingMore) return;
      setLoadingMore(true);
    }

    try {
      // Estratégia de Otimização:
      // Em vez de ler TODOS os atendimentos (caro), vamos buscar atendimentos agrupados por CPF
      // Como o Firestore não tem GROUP BY nativo eficiente para isso sem ler muito,
      // vamos usar uma abordagem híbrida:
      // 1. Buscar atendimentos realizados por ESTE técnico (quem atendeu)
      // 2. Filtrar CPFs únicos - usuários só aparecem para quem já fez atendimento com eles
      const atendenteId = userProfile?.id || userProfile?.uid;
      if (!atendenteId) {
        setUsuarios([]);
        setLoadingLista(false);
        return;
      }

      const PAGE_SIZE = 20;
      let constraints = [
        where('atendente_id', '==', atendenteId),
        orderBy('hora_fim', 'desc')
      ];

      if (isNextPage && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      // Injeta o limite no final
      constraints.push(limit(PAGE_SIZE));

      // Se tiver termo de busca, a estratégia muda um pouco
      // Busca por nome é complexa no Firestore sem índice full-text (Algolia/Elastic)
      // Vamos assumir busca por CPF exato ou filtragem em memória dos carregados por enquanto
      // Para escalar, idealmente teríamos uma coleção 'atendimentos_por_usuario' ou similar.
      
      const q = query(collection(db, collectionPath), ...constraints);
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setHasMore(false);
        if (isNextPage) setLoadingMore(false); else setLoadingLista(false);
        if (!isNextPage) setUsuarios([]);
        return;
      }

      const novosAtendimentos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length >= PAGE_SIZE);

      // Processamento em memória para dedalicar por CPF e montar a "Ficha"
      // Usamos um Map para garantir que pegamos sempre o atendimento mais recente de cada CPF
      const mapaUsuarios = new Map();

      if (isNextPage) {
        (usuariosRef.current || []).forEach(u => mapaUsuarios.set(u.cpf, u));
      }

      novosAtendimentos.forEach(atendimento => {
        if (!atendimento.cidadao || !atendimento.cidadao.cpf) return;
        if (isTestUser(atendimento)) return; // Usuário de teste: não aparece na ficha

        const cpf = cleanCpf(atendimento.cidadao.cpf);
        
        // Se já temos esse CPF, verificamos se este atendimento é mais recente (pela ordenação da query já deve ser, mas garantimos)
        if (!mapaUsuarios.has(cpf)) {
          const dadosCidadao = { ...(atendimento.cidadao || {}) };
          if (atendimento.tipo_acompanhamento) {
            dadosCidadao.tipoAcompanhamento = atendimento.tipo_acompanhamento;
          }
          mapaUsuarios.set(cpf, {
            cpf: cpf,
            nome: atendimento.cidadao.nome,
            fotoUrl: atendimento.cidadao.fotoUrl || null,
            ultimoAtendimento: atendimento.hora_fim,
            ultimoTipo: atendimento.tipo_nome,
            totalAtendimentos: 0,
            tipoAcompanhamento: atendimento.tipo_acompanhamento || null,
            dadosCidadao
          });
        }
      });

      // Converte mapa de volta para array (armazena lista completa; filtro por busca é em memória)
      const listaFinal = Array.from(mapaUsuarios.values());
      setUsuarios(listaFinal);
      applyTotaisAtendimentos(listaFinal, atendenteId);

      const semFoto = listaFinal.filter(u => !(u.fotoUrl || u.dadosCidadao?.fotoUrl));
      if (semFoto.length > 0 && semFoto.length <= 15) {
        Promise.all(semFoto.map(async (u) => {
          try {
            const ref = doc(db, cidadaosPath, cleanCpf(u.cpf));
            const snap = await getDoc(ref);
            if (snap.exists()) {
              const foto = snap.data()?.fotoUrl || snap.data()?.foto;
              if (foto) return { cpf: u.cpf, fotoUrl: foto };
            }
          } catch (_) {}
          return null;
        })).then((results) => {
          if (!isMounted.current) return;
          
          const updates = results.filter(Boolean);
          if (updates.length > 0) {
            setUsuarios(prev => prev.map(u => {
              const up = updates.find(r => cleanCpf(r.cpf) === cleanCpf(u.cpf));
              if (!up) return u;
              return {
                ...u,
                fotoUrl: up.fotoUrl,
                dadosCidadao: { ...(u.dadosCidadao || {}), fotoUrl: up.fotoUrl }
              };
            }));
          }
        }).catch((err) => {
          // Tratamento de erro adequado para carregamento de fotos
          console.error("Erro ao carregar fotos dos usuários:", err);
          setError(getFriendlyFirebaseError(err, "Algumas fotos não puderam ser carregadas devido a problemas de rede ou permissão."));
        });
      }
      
    } catch (err) {
      console.error("Erro ao carregar fichas:", err);
      setError(getFriendlyFirebaseError(err, "Não foi possível carregar o histórico de usuários."));
    } finally {
      setLoadingLista(false);
      setLoadingMore(false);
    }
  };

  // Função para carregar detalhes completos de um usuário específico
  const carregarDetalhesUsuario = async (cpf, opts = {}) => {
    const maxDocs = typeof opts?.maxDocs === "number" ? opts.maxDocs : 300;
    if (!db || !cpf) return [];
    try {
      // Busca TODOS os atendimentos deste CPF para este profissional (ou geral, dependendo da regra)
      // Regra: Psicólogo vê histórico completo ou só o dele? 
      // Geralmente ficha técnica é pessoal, mas histórico de atendimentos pode ser geral.
      // Vamos restringir ao atendente_id para garantir privacidade da "Ficha Pessoal do Psicólogo"
      
      const cpfLimpo = cleanCpf(cpf);
      if (cpfLimpo.length !== 11) return [];

      const q = query(
        collection(db, `artifacts/${appId}/public/data/atendimentos`),
        where('cidadao.cpf', '==', cpfLimpo),
        limit(maxDocs)
        // REMOVIDO: where('atendente_id', '==', userProfile.uid), 
        // AGORA BUSCA TUDO: Psicólogo deve ver histórico completo (multidisciplinar)
        // REMOVIDO: orderBy('hora_fim', 'desc') para evitar erro de índice composto
        // Faremos a ordenação no cliente
      );
      
      const snapshot = await getDocs(q);
      const historico = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(at => !isTestUser(at)); // Usuário de teste: não aparece no histórico da ficha

      return historico;
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
      return [];
    }
  };

  const carregarFichaEconomica = async (cpf) => {
    if (!db || !appId || !cpf) return null;
    const cpfLimpo = cleanCpf(cpf);
    if (cpfLimpo.length !== 11) return null;

    const key = `cidadao:${cpfLimpo}`;
    if (cache.current.has(key)) return cache.current.get(key);

    try {
      const ref = doc(db, cidadaosPath, cpfLimpo);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        cache.current.set(key, null);
        return null;
      }
      const data = snap.data() || {};
      const payload = {
        dadosCidadao: data,
        tipoAcompanhamento: data.tipoAcompanhamento || null,
        ultimoAtendimentoResumo: data.ultimoAtendimentoResumo || null,
      };
      cache.current.set(key, payload);
      return payload;
    } catch (err) {
      console.error("Erro ao carregar ficha econômica:", err);
      return null;
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, [userProfile]); // Recarrega só ao mudar perfil; busca é filtro em memória

  const invalidateFichaCache = (cpf) => {
    if (cpf) cache.current.delete(`cidadao:${cleanCpf(cpf)}`);
  };

  const usuariosFiltrados = useMemo(() => {
    if (!searchTerm?.trim()) return usuarios;
    const term = searchTerm.toLowerCase().trim();
    return usuarios.filter(u => (u.nome || "").toLowerCase().includes(term));
  }, [usuarios, searchTerm]);

  return {
    usuarios: usuariosFiltrados,
    loading: loadingLista,
    loadingMore,
    error,
    hasMore,
    searchTerm,
    setSearchTerm,
    carregarMais: () => carregarUsuarios(true),
    carregarDetalhesUsuario,
    carregarFichaEconomica,
    invalidateFichaCache
  };
};

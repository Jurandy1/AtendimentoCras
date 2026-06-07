import { useState, useEffect } from 'react';
import { 
  collection, query, onSnapshot, orderBy, limit, getDocs 
} from 'firebase/firestore';

export const useGerenciarLogs = ({ db, appId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limitLogs, setLimitLogs] = useState(50);

  useEffect(() => {
    if (!db || !appId) return;
    
    // Consulta OTIMIZADA com limit e orderBy
    // Se der erro de índice, o console vai mostrar o link para criar.
    // Isso evita baixar TODOS os logs (o que mata a cota).
    const q = query(
      collection(db, `artifacts/${appId}/public/data/audit_logs`),
      orderBy("timestamp", "desc"),
      limit(limitLogs) // Usa estado dinâmico para "infinite scroll"
    );

    const unsub = onSnapshot(q, (snap) => {
      // Verifica se houve mudanças reais para evitar re-render desnecessário
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(data);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar logs (provavelmente falta indice):", err);
      // Fallback: Tenta sem orderBy se falhar (pelo menos não baixa tudo)
      if (err.code === 'failed-precondition' || err.message.includes('index')) {
          const qFallback = query(
            collection(db, `artifacts/${appId}/public/data/audit_logs`),
            limit(limitLogs)
          );
          getDocs(qFallback).then(snap => {
             const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
             setLogs(data); 
             setLoading(false);
          });
      }
    });

    return () => unsub();
  }, [db, appId, limitLogs]);

  const loadMore = () => {
      setLimitLogs(prev => prev + 50);
  };

  const formatDate = (ts) => {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('pt-BR');
  };

  return {
    logs,
    loading,
    limitLogs,
    setLimitLogs,
    loadMore,
    formatDate
  };
};

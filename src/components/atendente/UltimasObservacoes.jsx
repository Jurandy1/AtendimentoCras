import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  History, User, Calendar, ChevronDown, ChevronUp, AlertCircle,
  ArrowRightLeft, CheckCircle2, MapPin, AlertTriangle
} from 'lucide-react';

/**
 * Componente que mostra as 3 últimas observações do cidadão.
 */
const UltimasObservacoes = ({ cpf, currentAtendimentoId, atendentesList = [], crasUnidades = [] }) => {
  const { db, appId } = useAuth();
  const [observacoes, setObservacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [error, setError] = useState(null);

  // Refs de segurança
  const atendentesRef = useRef(atendentesList);
  useEffect(() => { atendentesRef.current = atendentesList; }, [atendentesList]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setExpandedIdx(null);
  }, [cpf]);

  useEffect(() => {
    if (!db || !appId || !cpf) {
      setObservacoes([]);
      return;
    }

    const cpfLimpo = cpf.replace(/\D/g, '');
    if (!cpfLimpo || cpfLimpo.length !== 11) return;

    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    setObservacoes([]);

    const fetchObservacoes = async () => {
      try {
        const q = query(
          collection(db, `artifacts/${appId}/public/data/atendimentos`),
          where('cidadao.cpf', '==', cpf),
          orderBy('hora_chegada', 'desc'),
          limit(20)
        );

        const snap = await getDocs(q);
        let docs = snap.docs;

        // Fallback CPF sem formatação
        if (docs.length === 0 && cpf !== cpfLimpo) {
          const qLimpo = query(
            collection(db, `artifacts/${appId}/public/data/atendimentos`),
            where('cidadao.cpf', '==', cpfLimpo),
            orderBy('hora_chegada', 'desc'),
            limit(20)
          );
          const snapLimpo = await getDocs(qLimpo);
          docs = snapLimpo.docs;
        }

        const toDate = (val) => {
          if (!val) return null;
          if (val.toDate) return val.toDate();
          if (val instanceof Date) return val;
          if (typeof val === 'string' || typeof val === 'number') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
          }
          if (val.seconds) return new Date(val.seconds * 1000);
          return null;
        };

        const todasEvolucoes = [];

        docs.forEach((docSnap) => {
          const d = docSnap.data();

          if (Array.isArray(d.evolucoes) && d.evolucoes.length > 0) {
            d.evolucoes.forEach((ev) => {
              const texto = String(ev?.texto || '').trim();
              if (!texto) return;

              todasEvolucoes.push({
                key: `${docSnap.id}:${ev.timestamp?.seconds || ev.timestamp || todasEvolucoes.length}`,
                atendimentoId: docSnap.id,
                texto,
                data: toDate(ev.timestamp),
                nomeAtendente: ev.autor_nome || 'Não identificado',
                cargo: ev.autor_cargo || '',
                contexto: ev.contexto || 'finalizado',
                tipoNome: d.tipo_nome || '',
                fonte: 'evolucao',
                crasId: d.cras_id || null,
                crasNome: crasUnidades.find(c => c.id === d.cras_id)?.nome || null,
              });
            });
          } else if (d.status === 'finalizado' && (d.observacoes || '').trim()) {
            const atendente = atendentesRef.current.find(
              (a) => a.id === d.atendente_id || a.uid === d.atendente_id
            );
            todasEvolucoes.push({
              key: `${docSnap.id}:legado`,
              atendimentoId: docSnap.id,
              texto: d.observacoes.trim(),
              data: toDate(d.hora_fim),
              nomeAtendente: atendente?.nome || d.nome_exibicao || 'Não identificado',
              cargo: atendente?.cargo || d.cargo_atendente || '',
              contexto: 'finalizado',
              tipoNome: d.tipo_nome || '',
              fonte: 'legado',
              crasId: d.cras_id || null,
              crasNome: crasUnidades.find(c => c.id === d.cras_id)?.nome || null,
            });
          } else if (
            docSnap.id === currentAtendimentoId &&
            (d.observacoes || '').trim() &&
            Array.isArray(d.eventos) &&
            d.eventos.some((e) => e?.tipo === 'transferencia')
          ) {
            const idAutor = d.atendente_id_anterior || null;
            const atendente = idAutor
              ? atendentesRef.current.find((a) => a.id === idAutor || a.uid === idAutor)
              : null;
            const ultimoEvento = [...d.eventos].reverse().find((e) => e?.tipo === 'transferencia');
            todasEvolucoes.push({
              key: `${docSnap.id}:transf-legacy`,
              atendimentoId: docSnap.id,
              texto: d.observacoes.trim(),
              data: toDate(ultimoEvento?.criado_em) || toDate(d.hora_inicio) || toDate(d.hora_chegada),
              nomeAtendente: atendente?.nome || ultimoEvento?.atendente_nome || 'Atendente anterior',
              cargo: atendente?.cargo || '',
              contexto: 'transferencia',
              tipoNome: d.tipo_nome || '',
              fonte: 'transferencia-legacy',
              crasId: d.cras_id || null,
              crasNome: crasUnidades.find(c => c.id === d.cras_id)?.nome || null,
            });
          }
        });

        todasEvolucoes.sort((a, b) => {
          if (!a.data) return 1;
          if (!b.data) return -1;
          return b.data.getTime() - a.data.getTime();
        });

        const top3 = todasEvolucoes.slice(0, 3);

        if (mountedRef.current) {
          setObservacoes(top3);
        }
      } catch (e) {
        console.error('[UltimasObservacoes] Erro ao buscar histórico:', e);
        if (mountedRef.current && !e?.message?.includes('index')) {
          setError('Não foi possível carregar o histórico.');
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchObservacoes();
  }, [db, appId, cpf, currentAtendimentoId]);

  if (!cpf) return null;
  if (!loading && observacoes.length === 0 && !error) return null;

  return (
    <div className="rounded-xl overflow-hidden border border-amber-200 bg-white shadow-sm">
      <div className="px-3 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 flex items-center gap-2">
        <div className="p-1 bg-amber-100 rounded">
          <History size={12} className="text-amber-600" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 flex-1">
          Histórico de Observações
        </span>
        {!loading && observacoes.length > 0 && (
          <span className="text-[9px] text-amber-600 font-bold bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
            {observacoes.length} de 3
          </span>
        )}
      </div>

      {loading && (
        <div className="p-4 flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500" />
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">
            Buscando histórico...
          </span>
        </div>
      )}

      {error && !loading && (
        <div className="p-3 flex items-center gap-2 text-red-600 bg-red-50">
          <AlertCircle size={12} />
          <span className="text-[10px] font-medium">{error}</span>
        </div>
      )}

      {!loading && observacoes.length > 0 && (
        <div className="divide-y divide-gray-100">
          {observacoes.map((obs, idx) => {
            const isExpanded = expandedIdx === idx;
            const isFirst = idx === 0;
            const isTransferencia = obs.contexto === 'transferencia';
            const isEsporadico = obs.contexto === 'esporadico';

            return (
              <div
                key={obs.key}
                className={`p-3 transition-colors ${
                  isTransferencia
                    ? 'bg-blue-50/40 border-l-4 border-l-blue-400'
                    : isFirst
                      ? 'bg-amber-50/40'
                      : 'bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Calendar size={10} className="text-gray-400 shrink-0" />
                      <span className="text-[9px] text-gray-500 font-medium">
                        {obs.data
                          ? format(obs.data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : '—'}
                      </span>
                      {isTransferencia ? (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-px rounded-full">
                          <ArrowRightLeft size={8} />
                          Transferência
                        </span>
                      ) : isEsporadico ? (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-px rounded-full">
                          <AlertTriangle size={8} />
                          Esporádico
                        </span>
                      ) : (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider text-green-700 bg-green-100 border border-green-200 px-1.5 py-px rounded-full">
                          <CheckCircle2 size={8} />
                          Finalizado
                        </span>
                      )}
                      {isFirst && !isTransferencia && (
                        <span className="ml-1 text-[8px] font-black uppercase tracking-wider text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-px rounded-full">
                          Mais recente
                        </span>
                      )}
                      {obs.crasNome && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-px rounded-full">
                          <MapPin size={8} />
                          {obs.crasNome}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 min-w-0">
                      <User size={10} className="text-blue-400 shrink-0" />
                      <span className="text-[9px] font-black text-blue-700 truncate">
                        {obs.nomeAtendente}
                      </span>
                      {obs.cargo && (
                        <>
                          <span className="text-gray-300 text-[9px]">•</span>
                          <span className="text-[9px] text-gray-500 truncate">
                            {obs.cargo}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    className="shrink-0 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>

                {isTransferencia && (
                  <p className="text-[9px] text-blue-700 italic mb-1.5 font-medium">
                    Escrita por este atendente antes de transferir o usuário
                  </p>
                )}

                <div
                  className={`text-[11px] text-gray-700 leading-relaxed bg-gray-50 border border-gray-100 rounded p-2 ${
                    isExpanded ? '' : 'line-clamp-2'
                  }`}
                >
                  {obs.texto}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UltimasObservacoes;

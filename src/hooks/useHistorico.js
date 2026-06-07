import { useState, useEffect, useMemo } from 'react';
import { usePermission } from './usePermission';
import { 
  query, collection, where, getDocs, orderBy, limit, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import { maskCPF, formatDateTime, parseFlexibleDate, safeRemoveChild, isTestUser } from '../utils';

export const useHistorico = ({ 
  db, 
  appId, 
  userProfile, 
  crasUnidades = [], 
  tiposAtendimento = [], 
  atendentesList = [] 
}) => {
  const [modo, setModo] = useState('lista');
  const [cpfBusca, setCpfBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [listaRegistros, setListaRegistros] = useState([]);
  const [loadingLista, setLoadingLista] = useState(false);
  const [erroLista, setErroLista] = useState(null);
  
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  
  const [excluindo, setExcluindo] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  
  const collectionPath = `artifacts/${appId}/public/data/atendimentos`;
  const { hasPermission } = usePermission();
  const canExcluirCidadao = hasPermission('delete_records');
  const crasRestrito = userProfile?.role === 'coordenador' && userProfile?.cras_id ? userProfile.cras_id : null;
  
  const safeTipos = Array.isArray(tiposAtendimento) ? tiposAtendimento : [];

  // Helper functions
  const getCrasNome = (id) => crasUnidades.find(c => c.id === id)?.nome || 'N/A';
  const getTipoNome = (id) => tiposAtendimento.find(t => t.id === id)?.nome || 'N/A';
  const getAtendenteNome = (id) => atendentesList?.find(a => a.id === id)?.nome || '';

  useEffect(() => {
    if (!db) return;
    const carregarLista = async () => {
      setLoadingLista(true);
      setErroLista(null);
      try {
        let data = [];
        try {
          const constraints = [];
          if (crasRestrito) constraints.push(where('cras_id', '==', crasRestrito));
          constraints.push(orderBy('hora_chegada', 'desc'));
          constraints.push(limit(50));
          const q = query(collection(db, collectionPath), ...constraints);
          const snap = await getDocs(q);
          data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(d => !isTestUser(d));
        } catch (err) {
          console.error("Erro ao buscar lista (verifique índices):", err);
          throw err;
        }
        setListaRegistros(data);
      } catch (e) {
        console.error('Erro ao carregar lista de usuários:', e);
        setErroLista('Erro ao carregar lista de usuários. Tente novamente.');
      } finally {
        setLoadingLista(false);
      }
    };
    carregarLista().catch(err => {
        console.error("Unhandled error in carregarLista:", err);
    });
  }, [db, collectionPath, crasRestrito]);
  
  useEffect(() => {
    if (crasRestrito) setFiltroUnidade(crasRestrito);
  }, [crasRestrito]);

  const handleCpfChange = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 11);
    const masked = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})?/, (m, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : `${a}.${b}.${c}`);
    setCpfBusca(masked);
  };

  const handleBuscar = async (cpfForcado) => {
    if (!db) return;
    const digits = (cpfForcado || cpfBusca.replace(/\D/g, ''));
    if (digits.length !== 11) {
      setError('Informe um CPF válido com 11 dígitos.');
      setRegistros([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let data = [];
      try {
        const constraints = [where('cidadao.cpf', '==', digits)];
        if (crasRestrito) constraints.push(where('cras_id', '==', crasRestrito));
        constraints.push(limit(500));
        const q = query(collection(db, collectionPath), ...constraints);
        const snap = await getDocs(q);
        data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(d => !isTestUser(d));
        data.sort((a, b) => {
          const A = a?.hora_chegada?.toMillis ? a.hora_chegada.toMillis() : (a?.hora_chegada ? new Date(a.hora_chegada).getTime() : 0);
          const B = b?.hora_chegada?.toMillis ? b.hora_chegada.toMillis() : (b?.hora_chegada ? new Date(b.hora_chegada).getTime() : 0);
          return B - A;
        });
      } catch (err) {
        console.error("Erro ao buscar histórico por CPF (verifique índices):", err);
        console.error("Detalhes do erro:", {
          code: err.code,
          message: err.message,
          details: err.details,
          cpf: digits,
          crasRestrito: crasRestrito
        });
        throw err;
      }
      setRegistros(data);
      if (data.length === 0) {
        setError('Nenhum atendimento encontrado para este CPF.');
      }
    } catch (e) {
      console.error('Erro ao buscar histórico do usuário:', e);
      let errorMessage = 'Erro ao buscar histórico. Tente novamente.';
      
      // Provide more specific error messages based on error type
      if (e.code === 'failed-precondition') {
        errorMessage = 'Erro: Índice de banco de dados não configurado. Verifique os índices do Firestore.';
      } else if (e.code === 'permission-denied') {
        errorMessage = 'Erro: Permissão negada. Verifique as regras de segurança do Firestore.';
      } else if (e.code === 'unavailable') {
        errorMessage = 'Erro: Banco de dados indisponível. Tente novamente em alguns instantes.';
      } else if (e.message?.includes('index')) {
        errorMessage = 'Erro: Índice de banco de dados necessário. Verifique os índices do Firestore.';
      }
      
      setError(errorMessage);
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  };

  const infoCidadao = useMemo(() => (registros.length > 0 ? registros[0].cidadao : null), [registros]);

  const cidadaosFiltrados = useMemo(() => {
    if (!listaRegistros || listaRegistros.length === 0) return [];
    const texto = filtroTexto.trim().toLowerCase();
    const textoDigits = texto.replace(/\D/g, '');
    const unidade = filtroUnidade;
    const tipo = filtroTipo;
    const inicio = filtroDataInicio ? parseFlexibleDate(filtroDataInicio) : null;
    const fim = filtroDataFim ? parseFlexibleDate(filtroDataFim) : null;
    if (inicio) inicio.setHours(0, 0, 0, 0);
    if (fim) fim.setHours(23, 59, 59, 999);

    const mapa = new Map();

    for (const reg of listaRegistros) {
      const cid = reg.cidadao;
      const cpf = cid?.cpf;
      if (!cid || !cpf) continue;

      let item = mapa.get(cpf);
      if (!item) {
        item = {
          cpf,
          nome: cid.nome || '',
          sexo: cid.sexo || '',
          totalAtendimentos: 0,
          ultimaData: null,
          ultimaCrasId: null,
          unidades: new Set(),
          tipos: new Set(),
          registros: []
        };
        mapa.set(cpf, item);
      }

      item.totalAtendimentos += 1;
      const hora = reg.hora_chegada;
      const horaMillis = hora?.toMillis?.() || 0;
      const atualMillis = item.ultimaData?.toMillis?.() || 0;
      if (horaMillis && horaMillis > atualMillis) {
        item.ultimaData = hora;
        item.ultimaCrasId = reg.cras_id || null;
      }
      if (reg.cras_id) item.unidades.add(reg.cras_id);
      if (reg.tipo_atendimento_id) item.tipos.add(reg.tipo_atendimento_id);
      item.registros.push(reg);
    }

    let arr = Array.from(mapa.values());

    arr = arr.filter(item => {
      if (texto) {
        const nomeOk = item.nome.toLowerCase().includes(texto);
        const cpfOk = textoDigits && item.cpf.includes(textoDigits);
        if (!nomeOk && !cpfOk) return false;
      }
      if (unidade && !item.unidades.has(unidade)) return false;
      if (tipo && !item.tipos.has(tipo)) return false;
      if (inicio || fim) {
        const temNoPeriodo = item.registros.some(reg => {
          const d = reg.hora_chegada?.toDate ? reg.hora_chegada.toDate() : null;
          if (!d) return false;
          if (inicio && d < inicio) return false;
          if (fim && d > fim) return false;
          return true;
        });
        if (!temNoPeriodo) return false;
      }
      return true;
    });

    arr.sort((a, b) => {
      const ta = a.ultimaData?.toMillis?.() || 0;
      const tb = b.ultimaData?.toMillis?.() || 0;
      return tb - ta;
    });

    return arr;
  }, [listaRegistros, filtroTexto, filtroUnidade, filtroTipo, filtroDataInicio, filtroDataFim]);
  
  const resumoLista = useMemo(() => {
    const totalUsuarios = cidadaosFiltrados.length;
    const totalAtendimentos = cidadaosFiltrados.reduce((acc, item) => acc + (item.totalAtendimentos || 0), 0);
    const ultima = cidadaosFiltrados.reduce((best, item) => {
      const t = item.ultimaData?.toMillis?.() || 0;
      const b = best?.toMillis?.() || 0;
      return t > b ? item.ultimaData : best;
    }, null);
    return { totalUsuarios, totalAtendimentos, ultima };
  }, [cidadaosFiltrados]);

  const downloadCsv = (filename, headers, rows) => {
    const escapeField = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(r => r.map(escapeField).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    safeRemoveChild(document.body, link);
  };
  
  const handleExportListaCSV = () => {
    if (!cidadaosFiltrados || cidadaosFiltrados.length === 0) return;
    const headers = ['CPF', 'Nome', 'Sexo', 'TotalAtendimentos', 'UltimoAtendimento', 'UnidadeUltimoAtendimento', 'Unidades', 'TiposAtendimento'];
    const rows = cidadaosFiltrados.map(item => {
      const unidades = Array.from(item.unidades || []).map(id => getCrasNome(id)).join(' | ');
      const tipos = Array.from(item.tipos || []).map(id => getTipoNome(id)).join(' | ');
      return [
        maskCPF(item.cpf),
        item.nome || '',
        item.sexo || '',
        item.totalAtendimentos || 0,
        item.ultimaData ? formatDateTime(item.ultimaData) : '',
        item.ultimaCrasId ? getCrasNome(item.ultimaCrasId) : '',
        unidades,
        tipos
      ];
    });
    downloadCsv(`relatorio_usuarios_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };
  
  const handleExportHistoricoCSV = () => {
    if (!registros || registros.length === 0) return;
    const headers = ['DataHoraChegada', 'Unidade', 'TipoAtendimento', 'Atendente', 'Status', 'AcoesCadUnico', 'Observacoes'];
    const rows = registros.map(item => {
      const acoes = Array.isArray(item.cadunico_acoes) && item.cadunico_acoes.length > 0
        ? item.cadunico_acoes
            .map((acao) => {
              if (acao === "consulta") return "Consulta";
              if (acao === "inclusao") return "Inclusão";
              if (acao === "recadastro") return "Recadastro";
              if (acao === "transferencia") return "Transferência";
              return acao;
            })
            .join(', ')
        : '';
      const obs = `${item.observacoes || ''}${item.cadunico_observacao ? `${item.observacoes ? ' ' : ''}[CadÚnico] ${item.cadunico_observacao}` : ''}`;
      
      const getStatusLabel = (status) => {
        if (status === 'aguardando') return 'Aguardando';
        if (status === 'chamando') return 'Chamando';
        if (status === 'em_atendimento') return 'Em atendimento';
        if (status === 'finalizado') return 'Finalizado';
        if (status === 'cancelado') return 'Cancelado';
        if (status === 'ausente') return 'Ausente';
        return status || '-';
      };

      return [
        formatDateTime(item.hora_chegada),
        getCrasNome(item.cras_id),
        getTipoNome(item.tipo_atendimento_id),
        getAtendenteNome(item.atendente_id || ''),
        getStatusLabel(item.status),
        acoes,
        obs
      ];
    });
    const nome = infoCidadao?.cpf ? `historico_${infoCidadao.cpf.replace(/\D/g, '')}_${new Date().toISOString().slice(0, 10)}.csv` : `historico_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(nome, headers, rows);
  };

  const handleSelecionarCidadao = (cpf) => {
    const digits = (cpf || '').toString().replace(/\D/g, '');
    if (digits.length !== 11) return;
    setModo('cpf');
    setCpfBusca(maskCPF(digits));
    handleBuscar(digits);
  };

  const excluirPorCpf = async (digits) => {
    const q = query(
      collection(db, collectionPath),
      where('cidadao.cpf', '==', digits)
    );
    const snap = await getDocs(q);
    const docsAlvo = snap.docs;

    const batchSize = 400;
    for (let i = 0; i < docsAlvo.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = docsAlvo.slice(i, i + batchSize);
      chunk.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }

    // Tentar excluir também da coleção de cidadãos (cadastro geral)
    try {
      // 1. Tenta excluir assumindo que ID == CPF
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/cidadaos`, digits));
      
      // 2. Garante buscando por campo cpf, caso o ID seja diferente
      const cidRef = collection(db, `artifacts/${appId}/public/data/cidadaos`);
      const qCid = query(cidRef, where('cpf', '==', digits));
      const snapCid = await getDocs(qCid);
      for (const d of snapCid.docs) {
        if (d.id !== digits) { // Evita tentar deletar de novo se for o mesmo ID
           await deleteDoc(doc(cidRef, d.id));
        }
      }
    } catch (e2) {
      console.error("Erro ao excluir cadastro do cidadão (pode não existir ou erro de permissão):", e2);
    }
  };

  const handleExcluirAtendimento = async (id) => {
    if (!db) return;
    
    // Verificação de permissão redundante para segurança
    const isCoord = userProfile?.role === 'coordenador' || userProfile?.role === 'admin' || userProfile?.role === 'master' || userProfile?.cargo?.toLowerCase().includes('coordenador');
    if (!canExcluirCidadao && !isCoord) {
       alert("Sem permissão para excluir.");
       return;
    }

    if (!window.confirm('ATENÇÃO: Tem certeza que deseja excluir este registro de atendimento permanentemente?')) return;
    
    try {
      console.log(`Tentando excluir atendimento ID: ${id}`);
      await deleteDoc(doc(db, `artifacts/${appId}/public/data/atendimentos`, id));
      
      // Atualiza estados locais
      setRegistros(prev => prev.filter(r => r.id !== id));
      setListaRegistros(prev => prev.filter(r => r.id !== id));
      
      alert('Atendimento excluído com sucesso.');
    } catch (e) {
      console.error('Erro ao excluir atendimento:', e);
      let msg = 'Erro ao excluir atendimento.';
      if (e.code === 'permission-denied') msg += ' Permissão negada no banco de dados.';
      alert(msg);
    }
  };

  const handleExcluirCidadao = async () => {
    if (!db || !infoCidadao?.cpf || !canExcluirCidadao) return;
    const digits = infoCidadao.cpf.replace(/\D/g, '');
    if (digits.length !== 11) return;
    if (!window.confirm('Tem certeza que deseja excluir todos os atendimentos deste usuário? Esta ação não poderá ser desfeita.')) return;
    setExcluindo(true);
    setError(null);
    try {
      await excluirPorCpf(digits);
      setRegistros([]);
      setListaRegistros(prev => prev.filter(r => r.cidadao?.cpf !== digits));
      setCpfBusca('');
      alert('Usuário e seus atendimentos foram excluídos.');
    } catch (e) {
      console.error('Erro ao excluir usuário:', e);
      setError('Erro ao excluir usuário. Tente novamente.');
    } finally {
      setExcluindo(false);
    }
  };

  const toggleSelecionado = (cpf) => {
    setSelecionados(prev =>
      prev.includes(cpf) ? prev.filter(c => c !== cpf) : [...prev, cpf]
    );
  };

  const handleExcluirSelecionados = async () => {
    if (!db || !canExcluirCidadao || selecionados.length === 0) return;
    if (!window.confirm('Tem certeza que deseja excluir todos os atendimentos dos usuários selecionados? Esta ação não poderá ser desfeita.')) return;
    setExcluindo(true);
    setError(null);
    try {
      const idsParaExcluir = new Set();
      for (const cpf of selecionados) {
        const item = cidadaosFiltrados.find(x => x.cpf === cpf);
        if (item && Array.isArray(item.registros)) {
          item.registros.forEach(reg => {
            if (reg.id) idsParaExcluir.add(reg.id);
          });
        }
      }

      const idsArray = Array.from(idsParaExcluir);
      const batchSize = 400;
      for (let i = 0; i < idsArray.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = idsArray.slice(i, i + batchSize);
        chunk.forEach((id) => batch.delete(doc(db, collectionPath, id)));
        await batch.commit();
      }

      setListaRegistros(prev =>
        prev.filter(r => !idsParaExcluir.has(r.id))
      );
      setSelecionados([]);
      setRegistros([]);
      setCpfBusca('');
      alert('Usuários selecionados e seus atendimentos foram excluídos.');
    } catch (e) {
      console.error('Erro ao excluir usuários selecionados:', e);
      setError('Erro ao excluir usuários selecionados. Tente novamente.');
    } finally {
      setExcluindo(false);
    }
  };

  return {
    modo, setModo,
    cpfBusca, handleCpfChange,
    loading, error,
    registros,
    listaRegistros, loadingLista, erroLista,
    filtroTexto, setFiltroTexto,
    filtroUnidade, setFiltroUnidade,
    filtroTipo, setFiltroTipo,
    filtroDataInicio, setFiltroDataInicio,
    filtroDataFim, setFiltroDataFim,
    excluindo, selecionados, toggleSelecionado,
    canExcluirCidadao, crasRestrito,
    handleBuscar,
    handleSelecionarCidadao,
    handleExportListaCSV,
    handleExportHistoricoCSV,
    handleExcluirCidadao,
    handleExcluirAtendimento,
    handleExcluirSelecionados,
    cidadaosFiltrados,
    resumoLista,
    infoCidadao,
    safeTipos,
    getCrasNome,
    getTipoNome,
    getAtendenteNome
  };
};

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  Clock, 
  User, 
  Search, 
  Filter, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  RefreshCw,
  Trash2,
  X 
} from 'lucide-react';
import { deleteDoc, doc } from 'firebase/firestore';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Badge from './ui/Badge';
import { formatBRDateTyping } from '../utils';

const HistoricoObservacoesPage = ({ 
  db, 
  appId, 
  userProfile, 
  crasUnidades = [], 
  tiposAtendimento = [], 
  atendentesList = [] 
}) => {
  const [observacoes, setObservacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [sortBy, setSortBy] = useState('data_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // 10 observações por página

  // Corrigir lógica de permissão
  const isCoordenador = useMemo(() => {
    const roleNorm = userProfile?.roleNorm || (userProfile?.role || '').toLowerCase();
    const cargo = (userProfile?.cargo || '').toLowerCase();
    
    return ['coordenador', 'admin', 'master', 'super_admin', 'superintendente'].includes(roleNorm) ||
           cargo.includes('coordenador') || 
           cargo.includes('admin');
  }, [userProfile]);

  const atendenteId = userProfile?.uid;

  // Função para excluir observação
  const handleExcluirObservacao = async (id) => {
    if (!isCoordenador) return;
    
    if (window.confirm('Tem certeza que deseja excluir este registro do histórico? Esta ação não pode ser desfeita.')) {
      try {
        await deleteDoc(doc(db, `artifacts/${appId}/public/data/atendimentos`, id));
        // Atualiza a lista localmente para feedback imediato
        setObservacoes(prev => prev.filter(item => item.id !== id));
        alert('Registro excluído com sucesso.');
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert('Erro ao excluir registro. Verifique se você tem permissão.');
      }
    }
  };

  // Buscar observações
  useEffect(() => {
    if (!db || !appId) {
      return;
    }

    let active = true;
    setLoading(true);

    const atendimentosRef = collection(db, `artifacts/${appId}/public/data/atendimentos`);
    let q;

    if (isCoordenador) {
      q = query(
        atendimentosRef,
        orderBy('hora_fim', 'desc'),
        limit(500)
      );
    } else {
      if (!atendenteId) {
        setLoading(false);
        return;
      }
      q = query(
        atendimentosRef,
        where('atendente_id', '==', atendenteId),
        orderBy('hora_fim', 'desc'),
        limit(500)
      );
    }

    const buildObservacaoRow = (docSnap) => {
      const d = docSnap.data();
      const fim = d.hora_fim?.toDate?.() || null;
      const ini = d.hora_inicio?.toDate?.() || null;
      const cid = d.cidadao || {};
      const atendente = (atendentesList || []).find(a => a.id === d.atendente_id);
      return {
        id: docSnap.id,
        tipo_atendimento_id: d.tipo_atendimento_id || '',
        cras_id: d.cras_id || '',
        cras_nome: (crasUnidades || []).find(c => c.id === d.cras_id)?.nome || '',
        nome_usuario: d.nome_exibicao || cid.nome || cid.nomeSocial || '',
        cpf_usuario: cid.cpf || '',
        usuario_id: cid.cpf || d.cidadao_id || docSnap.id,
        observacao: d.observacoes || '',
        data_observacao: fim ? fim.toISOString() : (ini ? ini.toISOString() : ''),
        nome_atendente: atendente?.nome || userProfile?.nome || 'Não identificado',
        duracao_atendimento: ini && fim ? `${Math.max(1, Math.round((fim - ini) / 60000))} min` : null
      };
    };

    const applyRows = (docs) => {
      const dados = docs
        .map(buildObservacaoRow)
        .filter(item => !!item.observacao && item.observacao.trim().length > 0);
      if (!active) return;
      setObservacoes(dados);
      setLoading(false);
    };

    const runFallback = async () => {
      try {
        let qFallback;
        if (isCoordenador) {
          qFallback = query(atendimentosRef);
        } else {
          if (!atendenteId) {
            if (active) setLoading(false);
            return;
          }
          qFallback = query(atendimentosRef, where('atendente_id', '==', atendenteId));
        }
        const snapshot = await getDocs(qFallback);
        const dados = snapshot.docs
          .map(buildObservacaoRow)
          .filter(item => !!item.observacao && item.observacao.trim().length > 0);
        dados.sort((a, b) => new Date(b.data_observacao) - new Date(a.data_observacao));
        if (!active) return;
        setObservacoes(dados);
        setLoading(false);
      } catch (err) {
        console.error('Fallback sem orderBy falhou:', err);
        if (active) setLoading(false);
      }
    };

    let unsubscribe = null;
    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        applyRows(snapshot.docs);
      },
      (error) => {
        if (!active) return;
        const isIndexError = error?.code === 'failed-precondition' || String(error?.message || '').includes('index');
        if (isIndexError) {
          if (unsubscribe) {
            try { unsubscribe(); } catch {}
            unsubscribe = null;
          }
          runFallback();
          return;
        }
        setLoading(false);
      }
    );

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [db, appId, crasUnidades, userProfile, isCoordenador, atendentesList, atendenteId]);

  // Filtrar e ordenar observações
  const observacoesFiltradas = useMemo(() => {
    let filtradas = [...observacoes];

    // Filtro por termo de busca
    if (searchTerm) {
      const termo = searchTerm.toLowerCase();
      filtradas = filtradas.filter(obs => 
        obs.observacao?.toLowerCase().includes(termo) ||
        obs.nome_usuario?.toLowerCase().includes(termo) ||
        obs.cpf_usuario?.includes(termo)
      );
    }

    // Filtro por data
    if (dateFilter) {
      const target = dateFilter.trim();
      filtradas = filtradas.filter((obs) => {
        if (!obs?.data_observacao) return false;
        try {
          return format(parseISO(obs.data_observacao), 'dd/MM/yyyy', { locale: ptBR }) === target;
        } catch {
          return false;
        }
      });
    }

    // Filtro por tipo de atendimento
    if (tipoFilter) {
      filtradas = filtradas.filter(obs => 
        obs.tipo_atendimento_id === tipoFilter
      );
    }

    // Ordenação
    filtradas.sort((a, b) => {
      switch (sortBy) {
        case 'data_desc':
          return new Date(b.data_observacao) - new Date(a.data_observacao);
        case 'data_asc':
          return new Date(a.data_observacao) - new Date(b.data_observacao);
        case 'nome_asc':
          return (a.nome_usuario || '').localeCompare(b.nome_usuario || '');
        case 'nome_desc':
          return (b.nome_usuario || '').localeCompare(a.nome_usuario || '');
        default:
          return 0;
      }
    });

    return filtradas;
  }, [observacoes, searchTerm, dateFilter, tipoFilter, sortBy]);

  // Resetar para página 1 quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, tipoFilter, sortBy]);

  // Alternar expansão de item
  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Formatar data e hora
  const formatarDataHora = (dataString) => {
    try {
      const data = parseISO(dataString);
      return {
        data: format(data, 'dd/MM/yyyy', { locale: ptBR }),
        hora: format(data, 'HH:mm', { locale: ptBR }),
        diaSemana: format(data, 'EEEE', { locale: ptBR })
      };
    } catch {
      return { data: dataString, hora: '', diaSemana: '' };
    }
  };

  // Limpar filtros
  const limparFiltros = () => {
    setSearchTerm('');
    setDateFilter('');
    setTipoFilter('');
    setSortBy('data_desc');
  };

  // Exportar observações
  const exportarObservacoes = () => {
    const dadosExport = observacoesFiltradas.map(obs => ({
      'Data da Observação': formatarDataHora(obs.data_observacao).data,
      'Horário': formatarDataHora(obs.data_observacao).hora,
      'Nome do Usuário': obs.nome_usuario || '',
      'CPF do Usuário': obs.cpf_usuario || '',
      'Tipo de Atendimento': tiposAtendimento.find(t => t.id === obs.tipo_atendimento_id)?.nome || '',
      'Observação': obs.observacao || '',
      'Atendente': obs.nome_atendente || ''
    }));

    const csvContent = [
      Object.keys(dadosExport[0]).join(','),
      ...dadosExport.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historico_observacoes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Paginação (Estados já declarados no topo do componente, usando-os aqui)
  const paginatedObservacoes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return observacoesFiltradas.slice(startIndex, startIndex + itemsPerPage);
  }, [observacoesFiltradas, currentPage, itemsPerPage]);

  const totalPagesCalculated = Math.ceil(observacoesFiltradas.length / itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isCoordenador ? 'Histórico Geral de Observações' : 'Minhas Observações'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isCoordenador 
              ? 'Visualize as observações de todos os atendentes' 
              : 'Visualize todas as observações que você registrou nos atendimentos'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={() => window.location.reload()}
            title="Atualizar"
          >
            Atualizar
          </Button>
          <Button
            variant="secondary"
            icon={Download}
            onClick={exportarObservacoes}
            disabled={observacoesFiltradas.length === 0}
            title="Exportar CSV"
          >
            Exportar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="inline w-4 h-4 mr-1" />
              Buscar
            </label>
            <Input
              type="text"
              placeholder="Nome, CPF ou observação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Data
            </label>
            <Input
              type="text"
              value={dateFilter}
              onChange={(e) => setDateFilter(formatBRDateTyping(e.target.value))}
              className="w-full"
              inputMode="numeric"
              placeholder="dd/mm/aaaa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="inline w-4 h-4 mr-1" />
              Tipo de Atendimento
            </label>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os tipos</option>
              {tiposAtendimento.map(tipo => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ordenar por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="data_desc">Data (mais recente)</option>
              <option value="data_asc">Data (mais antiga)</option>
              <option value="nome_asc">Nome (A-Z)</option>
              <option value="nome_desc">Nome (Z-A)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <Badge variant="info">
            {observacoesFiltradas.length} observação{observacoesFiltradas.length !== 1 ? 'ões' : ''}
            {observacoesFiltradas.length > itemsPerPage && (
              <span className="ml-1">• Página {currentPage} de {totalPagesCalculated}</span>
            )}
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={limparFiltros}
            disabled={!searchTerm && !dateFilter && !tipoFilter}
          >
            Limpar Filtros
          </Button>
        </div>
      </Card>

      {/* Lista de Observações */}
      <div className="space-y-4">
        {paginatedObservacoes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nenhuma observação encontrada</h3>
            <p className="text-gray-500 mt-1">
              Tente ajustar os filtros ou realizar uma nova busca
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={limparFiltros}
            >
              Limpar Filtros
            </Button>
          </div>
        ) : (
          paginatedObservacoes.map((obs) => {
            const isExpanded = expandedItems.has(obs.id);
            const { data, hora, diaSemana } = formatarDataHora(obs.data_observacao);
            
            return (
              <Card key={obs.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpanded(obs.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="blue" className="text-xs">
                          {obs.cras_nome || 'CRAS'}
                        </Badge>
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar size={14} />
                          {data} <span className="capitalize">({diaSemana})</span>
                        </span>
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock size={14} />
                          {hora}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {obs.nome_usuario}
                      </h3>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          CPF: {obs.cpf_usuario || 'Não informado'}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          Atendente: {obs.nome_atendente}
                        </span>
                      </div>

                      <div className={`text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                        {obs.observacao}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-blue-600"
                        onClick={(e) => {
                           e.stopPropagation();
                           toggleExpanded(obs.id);
                        }}
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </Button>
                      
                      {isCoordenador && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExcluirObservacao(obs.id);
                          }}
                          title="Excluir Histórico"
                        >
                          <Trash2 size={18} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Paginação */}
      {paginatedObservacoes.length > 0 && (
        <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <span className="text-sm text-gray-600">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, observacoesFiltradas.length)} de {observacoesFiltradas.length} resultados
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft size={16} />
              Anterior
            </Button>
            <div className="flex items-center px-4 font-medium text-gray-700">
              Página {currentPage} de {totalPagesCalculated}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPagesCalculated}
              onClick={() => setCurrentPage(prev => Math.min(totalPagesCalculated, prev + 1))}
            >
              Próxima
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoObservacoesPage;

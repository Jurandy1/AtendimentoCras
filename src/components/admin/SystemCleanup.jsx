import React, { useState } from 'react';
import { collection, getDocs, doc, writeBatch, query, where, limit, updateDoc } from 'firebase/firestore';
import { Trash2, AlertTriangle, CheckCircle, RefreshCcw, Tv, XCircle } from 'lucide-react';
import Button from '../ui/Button';
import { isTestUser } from '../../utils/helpers';

const formatTs = (ts) => {
  if (!ts) return '—';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleString('pt-BR');
  } catch {
    return '—';
  }
};

const SystemCleanup = ({ db, appId, userProfile }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [filaChamando, setFilaChamando] = useState([]);
  const [loadingFila, setLoadingFila] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({
    atendimentos: false,
    abordagens_social: false,
    logs: false
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const options = [
    { 
      id: 'atendimentos', 
      label: 'Histórico de Atendimentos, Fila e Relatórios RMA', 
      description: 'Exclui todos os registros de atendimentos (finalizados e em andamento) e dados do RMA gerados a partir deles.',
      collection: `artifacts/${appId}/public/data/atendimentos`
    },
    { 
      id: 'abordagens_social', 
      label: 'Abordagens Sociais', 
      description: 'Exclui todos os registros do módulo de Abordagem Social.',
      collection: `artifacts/${appId}/public/data/abordagens_social`
    },
    { 
      id: 'logs', 
      label: 'Logs de Auditoria e Sistema', 
      description: 'Exclui o histórico de ações administrativas e logs do sistema.',
      collection: `artifacts/${appId}/public/data/audit_logs`
    }
  ];

  const handleToggle = (id) => {
    setSelectedOptions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAll = () => {
    const allSelected = Object.values(selectedOptions).every(v => v);
    const newState = {};
    Object.keys(selectedOptions).forEach(k => newState[k] = !allSelected);
    setSelectedOptions(newState);
  };

  const deleteCollection = async (collectionPath, name) => {
    setProgress(`Buscando dados de ${name}...`);
    const colRef = collection(db, collectionPath);
    const snapshot = await getDocs(colRef);
    
    if (snapshot.empty) {
      setProgress(`Nenhum dado encontrado em ${name}.`);
      return 0;
    }

    const total = snapshot.size;
    let deleted = 0;
    const batchSize = 400; // Safe limit under 500
    const chunks = [];
    
    // Split into chunks
    for (let i = 0; i < total; i += batchSize) {
      chunks.push(snapshot.docs.slice(i, i + batchSize));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(docSnap => {
        batch.delete(doc(db, collectionPath, docSnap.id));
      });
      await batch.commit();
      deleted += chunk.length;
      setProgress(`Excluindo ${name}: ${deleted}/${total}...`);
    }

    return deleted;
  };

  const atendimentosPath = `artifacts/${appId}/public/data/atendimentos`;

  const buscarFilaChamando = async () => {
    if (!db) return;
    setLoadingFila(true);
    try {
      const snap = await getDocs(
        query(collection(db, atendimentosPath), where('status', '==', 'chamando'), limit(50))
      );
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.hora_chamada?.toMillis?.() || 0;
          const tb = b.hora_chamada?.toMillis?.() || 0;
          return tb - ta;
        });
      setFilaChamando(lista);
    } catch (e) {
      console.error(e);
      alert('Erro ao buscar fila chamando. Veja o console.');
    } finally {
      setLoadingFila(false);
    }
  };

  const liberarChamada = async (item) => {
    if (!db || !item?.id) return;
    const nome = item.nome_exibicao || item.cidadao?.nome || item.id;
    if (!window.confirm(`Liberar "${nome}" da fila chamando?\n\nO painel da TV para de exibir esta chamada.`)) return;
    try {
      await updateDoc(doc(db, atendimentosPath, item.id), {
        status: 'ausente',
        hora_chamada: null,
      });
      setFilaChamando((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      console.error(e);
      alert('Erro ao liberar chamada.');
    }
  };

  const handleCleanup = async () => {
    setLoading(true);
    setShowConfirmModal(false);
    setProgress('Iniciando limpeza...');

    try {
      let totalDeleted = 0;

      for (const opt of options) {
        if (selectedOptions[opt.id]) {
          const count = await deleteCollection(opt.collection, opt.label);
          totalDeleted += count;
        }
      }

      setProgress(`Concluído! ${totalDeleted} registros excluídos.`);
      alert(`Limpeza concluída com sucesso! Total de registros removidos: ${totalDeleted}`);
      
      // Reset selection
      setSelectedOptions({
        atendimentos: false,
        abordagens_social: false,
        logs: false
      });

    } catch (error) {
      console.error("Erro na limpeza:", error);
      setProgress('Erro ao realizar limpeza.');
      alert("Ocorreu um erro durante a limpeza. Verifique o console para mais detalhes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
    <div className="bg-white p-6 rounded-lg shadow-sm border border-blue-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-blue-100 p-3 rounded-full">
          <Tv className="text-blue-600" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Fila &quot;Chamando&quot; na TV</h2>
          <p className="text-gray-500 text-sm">
            Lista <strong>todos</strong> os atendimentos com status chamando — inclusive contas de teste, que não aparecem nos relatórios.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-sm text-blue-900">
        Usuários de teste (ex.: Jurandy) funcionam na TV quando são cadastrados na recepção e chamados normalmente.
        Aqui aparecem registros com status <strong>chamando</strong> travados — inclusive teste, que some dos relatórios mas ainda pode afetar a TV.
      </div>

      <button
        type="button"
        onClick={buscarFilaChamando}
        disabled={loadingFila}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
      >
        <RefreshCcw size={16} className={loadingFila ? 'animate-spin' : ''} />
        {loadingFila ? 'Buscando...' : 'Verificar fila chamando agora'}
      </button>

      {filaChamando.length === 0 && !loadingFila && (
        <p className="text-sm text-gray-500 italic">Clique em verificar para listar registros travados.</p>
      )}

      {filaChamando.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filaChamando.map((item) => {
            const nome = item.nome_exibicao || item.cidadao?.nomeSocial || item.cidadao?.nome || 'Sem nome';
            const teste = isTestUser(item);
            return (
              <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg bg-gray-50 text-sm">
                <div>
                  <p className="font-semibold text-gray-800">
                    {nome}
                    {teste && (
                      <span className="ml-2 text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        Teste — oculto nos relatórios
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    ID: {item.id} · Chamado: {formatTs(item.hora_chamada)} · Unidade: {item.cras_id || '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => liberarChamada(item)}
                  className="shrink-0 px-3 py-1.5 bg-white border border-red-200 text-red-700 rounded-lg text-xs hover:bg-red-50 flex items-center gap-1"
                >
                  <XCircle size={14} /> Liberar da TV
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>

    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-red-100 p-3 rounded-full">
          <Trash2 className="text-red-600" size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Limpeza do Sistema</h2>
          <p className="text-gray-500 text-sm">Ferramenta para excluir dados em massa (útil para ambientes de teste).</p>
        </div>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex items-start">
          <AlertTriangle className="text-yellow-600 mr-3 mt-0.5" size={20} />
          <div>
            <h3 className="text-sm font-bold text-yellow-800">Atenção! Ação Irreversível</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Os dados excluídos não poderão ser recuperados. 
              Esta ferramenta <strong>NÃO</strong> exclui: Usuários Cadastrados (Cidadãos), Atendentes ou Usuários Desligados.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex justify-end mb-2">
            <button 
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:underline font-medium"
            >
                {Object.values(selectedOptions).every(v => v) ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
        </div>

        {options.map(opt => (
          <label 
            key={opt.id} 
            className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedOptions[opt.id] ? 'bg-red-50 border-red-200' : 'hover:bg-gray-50 border-gray-200'
            }`}
          >
            <input 
              type="checkbox"
              checked={selectedOptions[opt.id]}
              onChange={() => handleToggle(opt.id)}
              className="mt-1 w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300"
            />
            <div>
              <span className="block font-semibold text-gray-800">{opt.label}</span>
              <span className="block text-sm text-gray-500">{opt.description}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="text-sm text-gray-500 font-mono">
            {loading && <span className="flex items-center gap-2"><RefreshCcw className="animate-spin" size={14}/> {progress}</span>}
        </div>
        <Button 
          onClick={() => setShowConfirmModal(true)}
          disabled={loading || !Object.values(selectedOptions).some(v => v)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 flex items-center gap-2"
        >
          <Trash2 size={20} />
          LIMPAR DADOS SELECIONADOS
        </Button>
      </div>

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="text-red-600" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Tem certeza absoluta?</h3>
              <p className="text-gray-600 mt-2">
                Você está prestes a excluir permanentemente os dados selecionados. Esta ação não pode ser desfeita.
              </p>
            </div>

            <div className="bg-gray-100 p-4 rounded-lg mb-6 text-sm">
              <p className="font-bold text-gray-700 mb-2">Serão excluídos:</p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                {options.filter(o => selectedOptions[o.id]).map(o => (
                  <li key={o.id}>{o.label}</li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCleanup}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition-colors"
              >
                SIM, EXCLUIR TUDO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default SystemCleanup;

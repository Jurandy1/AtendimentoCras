import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, updateDoc, doc, query } from 'firebase/firestore';
import { Unlock, Search, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { getFriendlyFirebaseError } from '../../utils';

const LiberarAtendente = () => {
  const { db, appId } = useAuth();
  const [atendentes, setAtendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [msg, setMsg] = useState(null);

  const fetchAtendentes = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, `artifacts/${appId}/public/data/atendentes`));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAtendentes(list);
    } catch (err) {
      console.error("Erro ao buscar atendentes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAtendentes();
  }, [db, appId]);

  const handleLiberar = async (atendenteId, nome) => {
    if (!window.confirm(`Tem certeza que deseja liberar o expediente de "${nome}"?`)) return;
    
    setProcessingId(atendenteId);
    try {
      const ref = doc(db, `artifacts/${appId}/public/data/atendentes`, atendenteId);
      // Remove o campo expedienteEncerradoEm para liberar o login imediato
      await updateDoc(ref, {
        expedienteEncerradoEm: null,
        status: 'offline' // Reseta status para offline para permitir novo login limpo
      });
      setMsg({ type: 'success', text: `Expediente de ${nome} liberado com sucesso!` });
      fetchAtendentes(); // Recarrega lista
    } catch (err) {
      console.error("Erro ao liberar:", err);
      setMsg({ type: 'error', text: getFriendlyFirebaseError(err, "Erro ao liberar expediente.") });
    } finally {
      setProcessingId(null);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const handleLiberarForaHorario = async (atendenteId, nome, estadoAtual) => {
    const novoEstado = !estadoAtual;
    const acao = novoEstado ? "HABILITAR" : "DESABILITAR";
    
    if (!window.confirm(`Deseja ${acao} o trabalho fora de horário para "${nome}"?`)) return;

    setProcessingId(atendenteId);
    try {
      const ref = doc(db, `artifacts/${appId}/public/data/atendentes`, atendenteId);
      await updateDoc(ref, {
        podeTrabalharForaHorario: novoEstado
      });
      setMsg({ type: 'success', text: `Permissão de ${nome} atualizada com sucesso!` });
      fetchAtendentes();
    } catch (err) {
      console.error("Erro ao atualizar permissão:", err);
      setMsg({ type: 'error', text: getFriendlyFirebaseError(err, "Erro ao atualizar permissão.") });
    } finally {
      setProcessingId(null);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const filteredList = atendentes.filter(a => 
    (a.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
             <Unlock className="text-blue-600" />
             Liberar Atendente
           </h1>
           <p className="text-slate-500 text-sm mt-1">
             Desbloqueie atendentes que encerraram o expediente acidentalmente.
           </p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={fetchAtendentes}>
          Atualizar Lista
        </Button>
      </div>

      {msg && (
        <div className={`p-4 mb-6 rounded-lg flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {msg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm">{msg.text}</span>
        </div>
      )}

      <Card className="mb-6">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Search size={18} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou email..." 
            className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none text-gray-700 font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-xs">
              <tr>
                <th className="px-6 py-3">Atendente</th>
                <th className="px-6 py-3">Cargo</th>
                <th className="px-6 py-3">Status Atual</th>
                <th className="px-6 py-3">Bloqueio de Expediente</th>
                <th className="px-6 py-3 text-center">Fora de Horário</th>
                <th className="px-6 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-600 rounded-full border-t-transparent"></div>
                      Carregando...
                    </div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500 italic">
                    Nenhum atendente encontrado.
                  </td>
                </tr>
              ) : (
                filteredList.map(at => {
                  const isBlocked = !!at.expedienteEncerradoEm;
                  let blockedTime = null;
                  if (isBlocked && at.expedienteEncerradoEm?.toDate) {
                    blockedTime = at.expedienteEncerradoEm.toDate().toLocaleString('pt-BR');
                  }

                  return (
                    <tr key={at.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-700">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                            {at.nome?.charAt(0)}
                          </div>
                          <div>
                            <div>{at.nome}</div>
                            <div className="text-[10px] text-gray-400 font-normal">{at.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{at.cargo || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          at.status === 'online' ? 'bg-green-100 text-green-700' :
                          at.status === 'ocupado' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {at.status || 'Offline'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isBlocked ? (
                          <div className="text-red-600 font-bold flex flex-col">
                            <span className="flex items-center gap-1"><AlertCircle size={12} /> Bloqueado</span>
                            <span className="text-[10px] font-normal text-gray-500">Encerrado em: {blockedTime}</span>
                          </div>
                        ) : (
                          <span className="text-green-600 font-bold text-xs flex items-center gap-1">
                            <CheckCircle2 size={12} /> Liberado
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={!!at.podeTrabalharForaHorario}
                            onChange={() => handleLiberarForaHorario(at.id, at.nome, !!at.podeTrabalharForaHorario)}
                            disabled={processingId === at.id}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        <span className="block text-[10px] font-bold text-gray-400 mt-1">
                          {at.podeTrabalharForaHorario ? 'Permitido' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isBlocked && (
                          <Button 
                            variant="primary" 
                            size="sm" 
                            icon={Unlock} 
                            onClick={() => handleLiberar(at.id, at.nome)}
                            disabled={processingId === at.id}
                          >
                            {processingId === at.id ? 'Liberando...' : 'Liberar Acesso'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default LiberarAtendente;

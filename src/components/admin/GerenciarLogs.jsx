import React from 'react';
import { useGerenciarLogs } from '../../hooks/useGerenciarLogs';

const GerenciarLogs = ({ db, appId }) => {
  const {
    logs,
    loading,
    limitLogs,
    setLimitLogs,
    loadMore,
    formatDate
  } = useGerenciarLogs({ db, appId });

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold">Histórico de Ações Administrativas</h3>
        {/* Select de limite removido em favor do botão Carregar Mais para otimização */}
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto border border-gray-200 mb-4">
        <table className="w-full min-w-[800px] text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
            <tr>
              <th className="p-3">Data/Hora</th>
              <th className="p-3">Usuário (Admin)</th>
              <th className="p-3">Ação</th>
              <th className="p-3">Alvo</th>
              <th className="p-3">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && logs.length === 0 && (
               <tr><td colSpan="5" className="p-4 text-center text-gray-500">Carregando logs...</td></tr>
            )}
            {!loading && logs.length === 0 && (
               <tr><td colSpan="5" className="p-4 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
            )}
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap text-gray-600">{formatDate(log.timestamp)}</td>
                <td className="p-3">
                  <div className="font-medium text-gray-800">{log.performedBy?.name || 'Desconhecido'}</div>
                  <div className="text-xs text-gray-500">{log.performedBy?.email}</div>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold 
                    ${log.action.includes('DELETE') ? 'bg-red-100 text-red-800' : 
                      log.action.includes('CREATE') ? 'bg-green-100 text-green-800' : 
                      log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="p-3 text-gray-700">{log.target}</td>
                <td className="p-3 text-gray-500 text-xs max-w-xs truncate" title={JSON.stringify(log.details, null, 2)}>
                  {JSON.stringify(log.details)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {logs.length > 0 && (
          <div className="flex justify-center py-2">
            <button 
                onClick={loadMore}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium transition-colors"
            >
                {loading ? 'Carregando...' : `Carregar Mais (Exibindo ${logs.length})`}
            </button>
          </div>
      )}
    </div>
  );
};

export default GerenciarLogs;

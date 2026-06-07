import React from 'react';
import { Download, Loader } from 'lucide-react';
import { maskCPF, formatDateTime } from '../../utils';

const HistoricoLista = ({
  loadingLista,
  cidadaosFiltrados,
  resumoLista,
  selecionados,
  toggleSelecionado,
  handleSelecionarCidadao,
  handleExportListaCSV,
  handleExcluirSelecionados,
  canExcluirCidadao,
  excluindo,
  getCrasNome
}) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow overflow-x-auto">
      {loadingLista ? (
        <div className="py-10 flex justify-center">
          <Loader className="text-blue-600 w-8 h-8 animate-spin" />
        </div>
      ) : cidadaosFiltrados.length === 0 ? (
        <p className="text-gray-500 text-sm">Nenhum usuário encontrado com os filtros informados.</p>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <div className="flex flex-wrap gap-2">
              <div className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                Usuários: <span className="font-semibold">{resumoLista.totalUsuarios}</span>
              </div>
              <div className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                Atendimentos (na amostra): <span className="font-semibold">{resumoLista.totalAtendimentos}</span>
              </div>
              <div className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                Último registro: <span className="font-semibold">{resumoLista.ultima ? formatDateTime(resumoLista.ultima) : '-'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportListaCSV}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-green-600 rounded-lg shadow hover:bg-green-700"
              >
                <Download size={16} /> Exportar CSV
              </button>
              {canExcluirCidadao && (
                <>
                  <span className="text-sm text-gray-600">
                    Selecionados: {selecionados.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleExcluirSelecionados}
                    disabled={excluindo || selecionados.length === 0}
                    className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg shadow disabled:bg-gray-400"
                  >
                    {excluindo ? 'Excluindo...' : 'Excluir selecionados'}
                  </button>
                </>
              )}
            </div>
          </div>
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                {canExcluirCidadao && (
                  <th className="p-2 text-left text-sm font-semibold text-gray-600">Sel.</th>
                )}
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Nome</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">CPF</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Total de atendimentos</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Último atendimento</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Unidade</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cidadaosFiltrados.map(item => {
                const marcado = selecionados.includes(item.cpf);
                return (
                  <tr key={item.cpf}>
                    {canExcluirCidadao && (
                      <td className="p-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => toggleSelecionado(item.cpf)}
                          className="rounded"
                        />
                      </td>
                    )}
                    <td className="p-2 text-sm text-gray-700">{item.nome}</td>
                    <td className="p-2 text-sm text-gray-700">{maskCPF(item.cpf)}</td>
                    <td className="p-2 text-sm text-gray-700">{item.totalAtendimentos}</td>
                    <td className="p-2 text-sm text-gray-700">{item.ultimaData ? formatDateTime(item.ultimaData) : '-'}</td>
                    <td className="p-2 text-sm text-gray-700">{item.ultimaCrasId ? getCrasNome(item.ultimaCrasId) : '-'}</td>
                    <td className="p-2 text-sm text-right">
                      <button
                        type="button"
                        onClick={() => handleSelecionarCidadao(item.cpf)}
                        className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                      >
                        Ver histórico
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default HistoricoLista;

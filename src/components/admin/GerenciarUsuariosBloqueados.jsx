import React from 'react';
import { useGerenciarUsuariosBloqueados } from '../../hooks/useGerenciarUsuariosBloqueados';
import ImportacaoUsuariosBloqueados from './ImportacaoUsuariosBloqueados';

const GerenciarUsuariosBloqueados = ({ db, appId, userProfile }) => {
  const {
    usuarios,
    loading,
    busca,
    setBusca,
    handleSearchSubmit,
    handleNextPage,
    handlePrevPage,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    handleDeleteSelected,
    cpfImportar,
    setCpfImportar,
    motivoImportar,
    setMotivoImportar,
    handleImportarDaLista,
    safeVal,
    lastDocs,
    lastVisible,
    ITENS_POR_PAGINA,
    termoBusca
  } = useGerenciarUsuariosBloqueados({ db, appId, userProfile });

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold">Usuários Desligados</h3>
          <p className="text-sm text-gray-600">
            Lista de pessoas que foram desligadas do serviço.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[360px]">
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF ou motivo"
              className="px-3 py-2 border rounded-lg text-sm min-w-[220px]"
            />
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0 || loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:bg-gray-400"
            >
              Excluir selecionados ({selectedIds.length})
            </button>
          </div>
          <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
            <h4 className="text-xs font-semibold uppercase text-gray-500">Adicionar Desligamento Manual</h4>
            <div className="flex flex-col md:flex-row gap-2">
               <input
                 value={cpfImportar}
                 onChange={e => setCpfImportar(e.target.value)}
                 placeholder="CPF do Usuário (apenas números)"
                 className="px-3 py-1 border rounded text-sm flex-1"
               />
               <input
                 value={motivoImportar}
                 onChange={e => setMotivoImportar(e.target.value)}
                 placeholder="Motivo do desligamento"
                 className="px-3 py-1 border rounded text-sm flex-1"
               />
               <button
                 onClick={handleImportarDaLista}
                 disabled={loading || !cpfImportar || !motivoImportar}
                 className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:bg-gray-400"
               >
                 Bloquear
               </button>
            </div>
            <p className="text-xs text-gray-500">
              Isso copiará os dados do cadastro principal para esta lista de bloqueados.
            </p>
          </div>
        </div>
      </div>
      
      {termoBusca !== busca && (
        <div className="text-right">
           <button onClick={handleSearchSubmit} className="text-sm text-blue-600 hover:underline">
             Clique para buscar: "{busca}"
           </button>
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 uppercase font-bold text-xs">
            <tr>
              <th className="p-2 text-center w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === usuarios.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-2 text-left font-semibold text-gray-600">Nome</th>
              <th className="p-2 text-left font-semibold text-gray-600">CPF</th>
              <th className="p-2 text-left font-semibold text-gray-600">Motivo Desligamento</th>
              <th className="p-2 text-left font-semibold text-gray-600">Data Desligamento</th>
              <th className="p-2 text-left font-semibold text-gray-600">Técnico</th>
              <th className="p-2 text-left font-semibold text-gray-600">Demanda / Origem</th>
              <th className="p-2 text-left font-semibold text-gray-600">Data atendimento inicial</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && (
              <tr>
                <td colSpan="8" className="p-4 text-center text-gray-500">
                  Carregando usuários desligados...
                </td>
              </tr>
            )}
            {!loading && usuarios.length === 0 && (
              <tr>
                <td colSpan="8" className="p-4 text-center text-gray-500">
                  Nenhum usuário desligado encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(u.id)}
                      onChange={() => toggleSelect(u.id)}
                    />
                  </td>
                  <td className="p-2 font-medium text-gray-900">{safeVal(u.nome)}</td>
                  <td className="p-2 text-gray-500">{safeVal(u.cpf)}</td>
                  <td className="p-2 text-gray-500">{safeVal(u.motivoDesligamento)}</td>
                  <td className="p-2 text-gray-500">{safeVal(u.dataDesligamento)}</td>
                  <td className="p-2 text-gray-500">{safeVal(u.tecnicoDesligou)}</td>
                  <td className="p-2 text-gray-500">{safeVal(u.demandaOrigem)}</td>
                  <td className="p-2 text-gray-500">{safeVal(u.dataAtendimentoInicial)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-2 mt-3 text-xs text-gray-600">
          <div>
            {usuarios.length > 0 ? `Mostrando ${usuarios.length} resultados nesta página` : ''}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevPage}
              disabled={lastDocs.length === 0}
              className={`px-2 py-1 rounded border ${lastDocs.length === 0 ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white hover:bg-gray-100'}`}
            >
              Anterior
            </button>
            <span className="px-2">
              Página {lastDocs.length + 1}
            </span>
            <button
              onClick={handleNextPage}
              disabled={!lastVisible || usuarios.length < ITENS_POR_PAGINA}
              className={`px-2 py-1 rounded border ${(!lastVisible || usuarios.length < ITENS_POR_PAGINA) ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white hover:bg-gray-100'}`}
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      <div className="pt-4 border-t">
        <ImportacaoUsuariosBloqueados db={db} appId={appId} />
      </div>
    </div>
  );
};

export default GerenciarUsuariosBloqueados;

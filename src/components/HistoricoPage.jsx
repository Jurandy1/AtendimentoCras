import React from 'react';
import { Users } from 'lucide-react';
import { useHistorico } from '../hooks/useHistorico';

// Sub-components
import HistoricoFiltros from './historico/HistoricoFiltros';
import HistoricoLista from './historico/HistoricoLista';
import HistoricoBuscaCPF from './historico/HistoricoBuscaCPF';
import HistoricoDetalhes from './historico/HistoricoDetalhes';

const HistoricoPage = ({ db, appId, crasUnidades, tiposAtendimento, atendentesList, userProfile }) => {
  const {
    modo, setModo,
    cpfBusca, handleCpfChange,
    loading, error,
    registros,
    loadingLista, erroLista,
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
  } = useHistorico({ 
    db, appId, userProfile, crasUnidades, tiposAtendimento, atendentesList 
  });

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
        <Users className="mr-3" /> Histórico de Usuário
      </h2>

      <div className="bg-white p-2 rounded-lg shadow mb-6 flex space-x-2">
        <button
          type="button"
          onClick={() => setModo('lista')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border ${
            modo === 'lista'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300'
          }`}
        >
          Listar usuários
        </button>
        <button
          type="button"
          onClick={() => setModo('cpf')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border ${
            modo === 'cpf'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300'
          }`}
        >
          Buscar por CPF
        </button>
      </div>

      {modo === 'lista' && (
        <>
          <HistoricoFiltros
            filtroTexto={filtroTexto}
            setFiltroTexto={setFiltroTexto}
            filtroUnidade={filtroUnidade}
            setFiltroUnidade={setFiltroUnidade}
            filtroTipo={filtroTipo}
            setFiltroTipo={setFiltroTipo}
            filtroDataInicio={filtroDataInicio}
            setFiltroDataInicio={setFiltroDataInicio}
            filtroDataFim={filtroDataFim}
            setFiltroDataFim={setFiltroDataFim}
            crasUnidades={crasUnidades}
            tiposAtendimento={safeTipos}
            crasRestrito={crasRestrito}
            erroLista={erroLista}
          />

          <HistoricoLista
            loadingLista={loadingLista}
            cidadaosFiltrados={cidadaosFiltrados}
            resumoLista={resumoLista}
            selecionados={selecionados}
            toggleSelecionado={toggleSelecionado}
            handleSelecionarCidadao={handleSelecionarCidadao}
            handleExportListaCSV={handleExportListaCSV}
            handleExcluirSelecionados={handleExcluirSelecionados}
            canExcluirCidadao={canExcluirCidadao}
            excluindo={excluindo}
            getCrasNome={getCrasNome}
          />
        </>
      )}

      {modo === 'cpf' && (
        <>
          <HistoricoBuscaCPF
            cpfBusca={cpfBusca}
            handleCpfChange={handleCpfChange}
            handleBuscar={handleBuscar}
            loading={loading}
            error={error}
          />

          <HistoricoDetalhes
            db={db}
            appId={appId}
            userProfile={userProfile}
            infoCidadao={infoCidadao}
            registros={registros}
            handleExportHistoricoCSV={handleExportHistoricoCSV}
            handleExcluirCidadao={handleExcluirCidadao}
            handleExcluirAtendimento={handleExcluirAtendimento}
            canExcluirCidadao={canExcluirCidadao}
            excluindo={excluindo}
            getCrasNome={getCrasNome}
            getTipoNome={getTipoNome}
            getAtendenteNome={getAtendenteNome}
          />
        </>
      )}
    </div>
  );
};

export default HistoricoPage;

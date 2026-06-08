import React, { useState } from 'react';
import { AlertTriangle, Edit, Trash2, Plus, Settings, ChevronDown, Filter, RefreshCw, UserCheck, ShieldAlert, Columns, UploadCloud, Building, Search, X, Copy, FileText, Merge, Shield } from 'lucide-react';
import { normalizeDate } from '../../utils/helpers';
import { useGerenciarUsuarios } from '../../hooks/useGerenciarUsuarios';

const grupoKey = (titulo, grupo) => `${titulo}::${grupo.chave}`;

const GerenciarUsuarios = ({ db, appId, userProfile }) => {
  const [showTools, setShowTools] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [principalPorGrupo, setPrincipalPorGrupo] = useState({});

  const {
    usuarios,
    usuariosView,
    loading,
    busca,
    setBusca,
    lastDocs,
    lastVisible,
    selectedIds,
    editing,
    editData,
    creating,
    setCreating,
    createData,
    fixingNames,
    fixingDates,
    fixingCPFs,
    fixResult,
    fixResultCPF,
    fixingNaturalidade,
    revertingNaturalidade,
    fixResultNaturalidade,
    lastNatFixRunId,
    filtroAlerta,
    filtroEstrangeiros,
    filtroUnidade,
    ordem,
    crasMap,
    setFiltroAlerta,
    setFiltroEstrangeiros,
    setFiltroUnidade,
    handleSearchSubmit,
    limparBusca,
    emModoBusca,
    totalResultadosBusca,
    totalPaginasBusca,
    paginaBusca,
    handleOrdemChange,
    handleNextPage,
    handlePrevPage,
    toggleSelect,
    toggleSelectAllView,
    handleDeleteSelected,
    handleDeleteOne,
    deletingIds,
    scanningDuplicados,
    unificandoGrupo,
    resultadoDuplicados,
    setResultadoDuplicados,
    vasculharDuplicados,
    unificarCadastros,
    handleCreateChange,
    cancelCreate,
    saveCreate,
    openEdit,
    handleEditChange,
    saveEdit,
    cancelarEdicao,
    getTipoCadastro,
    safeVal,
    handleCorrigirNomesAtendimentos,
    handlePadronizarDatas,
    handlePadronizarCPFs,
    handleCorrigirNaturalidadeUsuarios,
    handleReverterUltimaCorrecaoNaturalidade,
    handleMigrarOrdenacao,
    handleMigrarUnidadePrincipal,
    handleCorrigirUnidadeIncorreta,
    handleDeleteImportados,
    deletingImportados,
    totalUsuarios,
    totalImportados,
    ITENS_POR_PAGINA,
    syncingSheet,
    syncProgress,
    syncPlanilhaUsuarios
  } = useGerenciarUsuarios({ db, appId, userProfile });

  const [visibleColumns, setVisibleColumns] = useState({
    nome: true, cpf: true, nomeSocial: false, dataNascimento: true, nomeMae: true, nomePai: false,
    telefone: true, nis: false, rg: false, dataCadastro: true, origemDemanda: false, tecnicoResponsavel: false,
    conjuge: false, cor: false, sexo: false, religiao: false, orientacaoSexual: false, naturalidade: false,
    _obsNaturalidade: false, uf: false, nacionalidade: false, escolaridade: false, tipoCadastro: true,
    _nomeUnidade: true
  });

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const columns = [
    { label: 'Nome', key: 'nome', width: 'min-w-[150px]', sticky: true, left: 'left-[40px]' },
    { label: 'CPF', key: 'cpf', width: 'min-w-[120px]' },
    { label: 'Nome Social', key: 'nomeSocial', width: 'min-w-[120px]' },
    { label: 'Data Nasc.', key: 'dataNascimento', width: 'min-w-[100px]' },
    { label: 'Mãe', key: 'nomeMae', width: 'min-w-[150px]' },
    { label: 'Pai', key: 'nomePai', width: 'min-w-[150px]' },
    { label: 'Telefone', key: 'telefone', width: 'min-w-[100px]' },
    { label: 'NIS', key: 'nis', width: 'min-w-[100px]' },
    { label: 'RG', key: 'rg', width: 'min-w-[80px]' },
    { label: 'Data Cadastro', key: 'dataCadastro', width: 'min-w-[100px]' },
    { label: 'Origem Demanda', key: 'origemDemanda', width: 'min-w-[120px]' },
    { label: 'Técnico Resp.', key: 'tecnicoResponsavel', width: 'min-w-[120px]' },
    { label: 'Cônjuge', key: 'conjuge', width: 'min-w-[120px]' },
    { label: 'Cor', key: 'cor', width: 'min-w-[80px]' },
    { label: 'Sexo', key: 'sexo', width: 'min-w-[60px]' },
    { label: 'Religião', key: 'religiao', width: 'min-w-[100px]' },
    { label: 'Orient. Sexual', key: 'orientacaoSexual', width: 'min-w-[100px]' },
    { label: 'Naturalidade', key: 'naturalidade', width: 'min-w-[100px]' },
    { label: 'Obs. Naturalidade', key: '_obsNaturalidade', width: 'min-w-[180px]' },
    { label: 'UF', key: 'uf', width: 'min-w-[40px]' },
    { label: 'Nacionalidade', key: 'nacionalidade', width: 'min-w-[100px]' },
    { label: 'Escolaridade', key: 'escolaridade', width: 'min-w-[120px]' },
    { label: 'Tipo cadastro', key: 'tipoCadastro', width: 'min-w-[80px]' },
    { label: 'Unidade', key: '_nomeUnidade', width: 'min-w-[160px]' },
  ];

  const visibleColumnsList = columns.filter(c => visibleColumns[c.key]);

  const renderCellContent = (u, key) => {
    switch (key) {
      case 'nome':
        return <span className="font-medium text-gray-900">{safeVal(u.nome)}</span>;
      case 'cpf':
        return (
          <div className="flex items-center gap-1">
            {safeVal(u.cpf)}
            {u._alertaCPF && (
              <div className="group relative">
                <AlertTriangle size={14} className="text-red-500 cursor-help" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity">
                  {u._alertaCPF}
                </span>
              </div>
            )}
          </div>
        );
      case 'dataNascimento':
        return (
          <div className="flex items-center gap-1">
            {normalizeDate(safeVal(u.dataNascimento))}
            {u._alertaDataNascimento && (
              <div className="group relative">
                <AlertTriangle size={14} className="text-amber-500 cursor-help" />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity">
                  {u._alertaDataNascimento}
                </span>
              </div>
            )}
          </div>
        );
      case '_obsNaturalidade':
        return u._obsNaturalidade ? (
          <span className={`${u._obsNaturalidadeTipo === 'auto' ? 'text-emerald-700' : 'text-amber-700'}`}>
            {u._obsNaturalidade}
          </span>
        ) : '';
      case 'tipoCadastro':
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            getTipoCadastro(u) === 'Importado' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
          }`}>
            {getTipoCadastro(u)}
          </span>
        );
      case '_nomeUnidade':
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              u._nomeUnidade === 'Sem unidade'
                ? 'bg-gray-100 text-gray-500 border border-gray-200'
                : String(u._nomeUnidade || '').toLowerCase().includes('cohab') ||
                  String(u._nomeUnidade || '').toLowerCase().includes('anil')
                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}
          >
            <Building size={10} />
            {u._nomeUnidade}
          </span>
        );
      default:
        return safeVal(u[key]);
    }
  };


  const allSelectedOnView =
    usuariosView.length > 0 && usuariosView.every((u) => selectedIds.includes(u.id));

  const podeAvancarPagina = emModoBusca
    ? (paginaBusca + 1) * ITENS_POR_PAGINA < (totalResultadosBusca || 0)
    : !!(lastVisible && usuarios.length >= ITENS_POR_PAGINA);
  const podeVoltarPagina = emModoBusca ? paginaBusca > 0 : lastDocs.length > 0;
  const paginaAtual = emModoBusca ? paginaBusca + 1 : lastDocs.length + 1;

  const getPrincipalGrupo = (titulo, grupo) => {
    const key = grupoKey(titulo, grupo);
    return principalPorGrupo[key] || grupo.principalSugerido || grupo.registros[0]?.id || '';
  };

  const setPrincipalGrupo = (titulo, grupo, id) => {
    const key = grupoKey(titulo, grupo);
    setPrincipalPorGrupo((prev) => ({ ...prev, [key]: id }));
  };

  const renderInfoTecnica = (reg) => {
    const info = reg._info;
    if (!info) return null;
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {info.temDadosTecnicos ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              <FileText size={10} /> Com ficha / dados técnicos
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
              Sem ficha técnica
            </span>
          )}
          {info.qtdComObs > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              {info.qtdComObs} atend. com observação
            </span>
          )}
          {info.qtdAtendimentos > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {info.qtdAtendimentos} atendimento(s) no histórico
            </span>
          )}
          {info.seguroExcluir && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
              <Shield size={10} /> Pode excluir com mais segurança
            </span>
          )}
        </div>
        {info.indicadores?.length > 0 && (
          <p className="text-[11px] text-amber-800">
            <span className="font-semibold">Ficha:</span> {info.indicadores.join(' · ')}
          </p>
        )}
        {info.ultimaObs && (
          <p className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1">
            <span className="font-semibold text-gray-700">Última observação{info.ultimaObsData ? ` (${info.ultimaObsData})` : ''}:</span>{' '}
            {info.ultimaObs}
            {info.ultimoAtendente ? ` — ${info.ultimoAtendente}` : ''}
          </p>
        )}
      </div>
    );
  };

  const renderGrupoDuplicados = (titulo, grupos, fmtChave) => (
    <section key={titulo}>
      <h5 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">{titulo}</h5>
      {grupos.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Nenhum duplicado neste critério.</p>
      ) : (
        <div className="space-y-3">
          {grupos.slice(0, 30).map((grupo) => {
            const key = grupoKey(titulo, grupo);
            const principalId = getPrincipalGrupo(titulo, grupo);
            const secundarios = grupo.registros.map((r) => r.id).filter((id) => id !== principalId);
            return (
              <div key={key} className="border border-violet-200 rounded-lg bg-violet-50/40 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-violet-900">
                    {fmtChave(grupo)} <span className="text-violet-600 font-normal">({grupo.registros.length} registros)</span>
                  </p>
                  <button
                    type="button"
                    disabled={unificandoGrupo || secundarios.length === 0}
                    onClick={() => unificarCadastros(principalId, secundarios, fmtChave(grupo))}
                    className="shrink-0 px-3 py-1.5 bg-violet-700 text-white rounded-lg text-xs hover:bg-violet-800 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Merge size={12} />
                    {unificandoGrupo ? 'Unificando...' : 'Unificar neste principal'}
                  </button>
                </div>
                <p className="text-[11px] text-violet-800 mb-2">
                  Marque qual cadastro <strong>manter</strong>. O sugerido (⭐) tem mais ficha técnica e observações.
                </p>
                <div className="space-y-2">
                  {grupo.registros.map((reg) => {
                    const isPrincipal = reg.id === principalId;
                    const isSugerido = reg.id === grupo.principalSugerido;
                    return (
                      <div
                        key={reg.id}
                        className={`rounded-lg border p-2 text-sm ${isPrincipal ? 'bg-violet-100 border-violet-400 ring-1 ring-violet-300' : 'bg-white border-gray-200'}`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-2">
                          <div className="flex gap-2 min-w-0 flex-1">
                            <input
                              type="radio"
                              name={`principal-${key}`}
                              checked={isPrincipal}
                              onChange={() => setPrincipalGrupo(titulo, grupo, reg.id)}
                              className="mt-1 shrink-0"
                              title="Manter este cadastro"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-800 break-words">
                                {safeVal(reg.nome)}
                                {isSugerido && <span className="ml-1 text-amber-600" title="Sugerido pelo sistema">⭐</span>}
                                {isPrincipal && <span className="ml-2 text-[10px] font-bold uppercase text-violet-700">Principal</span>}
                              </p>
                              <p className="text-xs text-gray-500">
                                ID: {reg.id} · CPF: {safeVal(reg.cpf) || '—'} · Nasc.: {normalizeDate(safeVal(reg.dataNascimento)) || '—'}
                              </p>
                              <p className="text-xs text-gray-500">
                                Mãe: {safeVal(reg.nomeMae) || '—'} · {getTipoCadastro(reg)}
                                {reg._info?.pontuacao != null && ` · Pontuação: ${reg._info.pontuacao}`}
                              </p>
                              {renderInfoTecnica(reg)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!reg._info?.seguroExcluir) {
                                if (!window.confirm(
                                  'Este cadastro tem ficha técnica e/ou observações de atendimento.\n\nTem certeza que deseja EXCLUIR em vez de unificar?'
                                )) return;
                              }
                              handleDeleteOne(reg.id, reg.nome);
                            }}
                            disabled={deletingIds.has(reg.id) || isPrincipal}
                            className="shrink-0 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs hover:bg-red-100 disabled:opacity-50"
                            title={isPrincipal ? 'Não exclua o principal — unifique os outros nele' : 'Excluir só este registro'}
                          >
                            {deletingIds.has(reg.id) ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {grupos.length > 30 && (
            <p className="text-xs text-gray-500">Mostrando os 30 primeiros grupos de {grupos.length}.</p>
          )}
        </div>
      )}
    </section>
  );

  return (
    <div className="p-3 sm:p-4 max-w-full overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl sm:text-2xl font-semibold">Usuários cadastrados</h3>
          <p className="text-sm text-gray-600 mb-2">
            Inclui usuários importados de planilha e cadastrados manualmente na recepção.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
             <div className="px-3 py-1 bg-gray-100 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
                <span className="font-semibold text-gray-700">Total:</span> 
                <span className="text-gray-900 font-bold text-sm">{totalUsuarios}</span>
             </div>
             <div className="px-3 py-1 bg-blue-50 rounded-lg border border-blue-100 shadow-sm flex items-center gap-2">
                <span className="font-semibold text-blue-800">Importados:</span> 
                <span className="text-blue-900 font-bold text-sm">{totalImportados}</span>
             </div>
             <div className="px-3 py-1 bg-green-50 rounded-lg border border-green-100 shadow-sm flex items-center gap-2">
                <span className="font-semibold text-green-800">Manuais:</span> 
                <span className="text-green-900 font-bold text-sm">{totalUsuarios - totalImportados}</span>
             </div>
             <div className="px-3 py-1 bg-orange-50 rounded-lg border border-orange-100 shadow-sm flex items-center gap-2">
                <span className="font-semibold text-orange-800">Sem unidade:</span>
                <span className="text-orange-900 font-bold text-sm">
                  {usuariosView.filter(u => u._nomeUnidade === 'Sem unidade').length}
                </span>
             </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full lg:max-w-3xl">
          
          {/* Barra Superior: Busca e Ações Principais */}
          <div className="flex flex-col gap-3 bg-white p-3 sm:p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex flex-col gap-2 w-full">
              <div className="relative flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                    placeholder="Nome, nome social, CPF ou nome da mãe..."
                    className="w-full pl-9 pr-9 py-2.5 border rounded-lg text-sm"
                  />
                  {busca && (
                    <button
                      type="button"
                      onClick={limparBusca}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
                      title="Limpar busca"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 shrink-0"
                >
                  Buscar
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                Digite ao menos 2 caracteres. Busca em nome, nome social, mãe ou CPF — sem acento e sem diferenciar maiúsculas.
              </p>
              {emModoBusca && !loading && (
                <p className="text-xs font-medium text-blue-700">
                  {totalResultadosBusca === 0
                    ? 'Nenhum usuário encontrado para essa busca.'
                    : `${totalResultadosBusca} usuário(s) encontrado(s)`}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
              <select 
                 value={ordem} 
                 onChange={(e) => handleOrdemChange(e.target.value)}
                 disabled={emModoBusca}
                 className="px-3 py-2 border rounded-lg text-sm bg-gray-50 w-full disabled:opacity-60"
                 title="Ordem de exibição"
              >
                 <option value="alfabetica">Ordem: A-Z</option>
                 <option value="recentes">Ordem: Recentes</option>
              </select>
              <select
                value={filtroUnidade}
                onChange={(e) => setFiltroUnidade(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-gray-50 w-full"
              >
                <option value="">Todas as unidades</option>
                {Object.entries(crasMap || {}).map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2 w-full justify-start sm:justify-end">
               <button
                onClick={() => setCreating(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-2 shadow-sm whitespace-nowrap"
              >
                <Plus size={16} />
                Novo Usuário
              </button>
              <button
                onClick={syncPlanilhaUsuarios}
                disabled={loading || syncingSheet}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2 shadow-sm whitespace-nowrap disabled:opacity-50"
                title="Sincronizar a aba 'Usuarios' da planilha com o Firebase"
              >
                <UploadCloud size={16} />
                {syncingSheet ? `Sincronizando (${syncProgress.added}/${syncProgress.processed})` : 'Sincronizar planilha'}
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2 shadow-sm whitespace-nowrap"
                  title="Selecionar colunas"
                >
                  <Columns size={16} />
                  <span className="hidden sm:inline">Colunas</span>
                  <ChevronDown size={14} className={`transition-transform ${showColumnSelector ? 'rotate-180' : ''}`} />
                </button>

                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in slide-in-from-top-2 max-h-[400px] overflow-y-auto">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Exibir Colunas</div>
                    <div className="space-y-1">
                      {columns.map(col => (
                        <label key={col.key} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleColumns[col.key]}
                            onChange={() => toggleColumn(col.key)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-gray-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowTools(!showTools)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2 shadow-sm whitespace-nowrap"
                >
                  <Settings size={16} />
                  <span className="hidden sm:inline">Ferramentas</span>
                  <ChevronDown size={14} className={`transition-transform ${showTools ? 'rotate-180' : ''}`} />
                </button>
                
                {showTools && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in slide-in-from-top-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Filtros & Análises</div>
                    <div className="space-y-1 mb-3">
                      <button
                        onClick={() => setFiltroAlerta(!filtroAlerta)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${filtroAlerta ? 'bg-amber-100 text-amber-800 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}
                      >
                        <AlertTriangle size={14} />
                        {filtroAlerta ? 'Ocultar Alertas' : 'Ver Usuários com Alertas'}
                      </button>
                      <button
                        onClick={() => setFiltroEstrangeiros(!filtroEstrangeiros)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${filtroEstrangeiros ? 'bg-sky-100 text-sky-800 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}
                      >
                        <Filter size={14} />
                        {filtroEstrangeiros ? 'Mostrar Todos' : 'Filtrar Estrangeiros'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowTools(false); vasculharDuplicados(); }}
                        disabled={scanningDuplicados || loading}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-violet-50 text-violet-800 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Copy size={14} />
                        {scanningDuplicados ? 'Analisando duplicados...' : 'Vasculhar duplicados'}
                      </button>
                    </div>

                    <div className="border-t border-gray-100 my-2"></div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Manutenção</div>
                    <div className="space-y-1">
                      <button
                        onClick={handleCorrigirNaturalidadeUsuarios}
                        disabled={fixingNaturalidade || loading}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 text-gray-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <UserCheck size={14} className="text-emerald-600" />
                        Corrigir Naturalidade (IBGE)
                      </button>
                      <button
                        onClick={handlePadronizarDatas}
                        disabled={fixingDates || loading}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 text-gray-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw size={14} className="text-teal-600" />
                        Padronizar Datas
                      </button>
                      <button
                        onClick={handlePadronizarCPFs}
                        disabled={fixingCPFs || loading}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 text-gray-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <ShieldAlert size={14} className="text-blue-600" />
                        Padronizar CPFs
                      </button>
                      <button
                        onClick={handleCorrigirNomesAtendimentos}
                        disabled={fixingNames || loading}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 text-gray-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Edit size={14} className="text-indigo-600" />
                        Corrigir Nomes Atendimentos
                      </button>
                      <button
                        onClick={handleMigrarOrdenacao}
                        disabled={loading}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 text-gray-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Settings size={14} className="text-gray-600" />
                        Reparar Ordenação
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowTools(false); handleMigrarUnidadePrincipal(); }}
                        disabled={loading}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 text-gray-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Building size={14} className="text-purple-600" />
                        Definir unidade padrão (Centro Pop Centro)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowTools(false); handleCorrigirUnidadeIncorreta(); }}
                        disabled={loading}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-amber-50 text-amber-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Building size={14} className="text-amber-600" />
                        Corrigir unidade incorreta (Cohab→Centro)
                      </button>
                    </div>

                    <div className="border-t border-gray-100 my-2"></div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Ações de Risco</div>
                    <div className="space-y-1">
                       <button
                        onClick={handleDeleteImportados}
                        disabled={deletingImportados || loading}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-red-50 text-red-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        Excluir Todos Importados
                      </button>
                      {lastNatFixRunId && (
                        <button
                          onClick={handleReverterUltimaCorrecaoNaturalidade}
                          disabled={revertingNaturalidade || loading}
                          className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-rose-50 text-rose-700 flex items-center gap-2 disabled:opacity-50"
                        >
                          <RefreshCw size={14} />
                          Reverter Correção Nat.
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedIds.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-right-2"
                >
                  <Trash2 size={16} />
                  Excluir ({selectedIds.length})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {fixResult && (
        <div className="mb-3 text-xs text-gray-600 bg-teal-50 p-2 rounded border border-teal-100">
          <strong>Relatório de Datas:</strong> {fixResult.msg ? fixResult.msg : `Última correção: ${fixResult.corrigidos} atendimentos atualizados de ${fixResult.atendimentosSemNome} sem nome.`}
        </div>
      )}
      
      {fixResultCPF && (
        <div className="mb-3 text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-100">
          <strong>Relatório de CPFs:</strong> {fixResultCPF.msg}
        </div>
      )}

      {fixResultNaturalidade && (
        <div className="mb-3 text-xs text-gray-700 bg-emerald-50 p-2 rounded border border-emerald-100">
          <strong>Relatório de Naturalidade:</strong>{' '}
          {fixResultNaturalidade.msg
            ? fixResultNaturalidade.msg
            : `Run: ${fixResultNaturalidade.runId} | Docs atualizados: ${fixResultNaturalidade.corrigidos} | Backups: ${fixResultNaturalidade.backupsCriados} | Nacionalidade: ${fixResultNaturalidade.nacionalidadeCorrigida} | Cidade natal: ${fixResultNaturalidade.naturalidadeCorrigida} | IBGE preenchido: ${fixResultNaturalidade.ibgeIdPreenchido} | Para revisão manual: ${fixResultNaturalidade.revisao}`}
        </div>
      )}

      {/* Mobile / Tablet View (Cards) */}
      <div className="xl:hidden space-y-3 mb-4">
        {loading && (
          <div className="text-center text-gray-500 animate-pulse py-8">Carregando usuários...</div>
        )}
        {!loading && usuariosView.length === 0 && (
          <div className="text-center text-gray-500 py-8">Nenhum usuário encontrado.</div>
        )}
        {!loading && usuariosView.map((u) => (
          <div key={u.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-2 items-start">
                 <input
                    type="checkbox"
                    checked={selectedIds.includes(u.id)}
                    onChange={() => toggleSelect(u.id)}
                    className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <h4 className="font-bold text-gray-800 break-words">{safeVal(u.nome)}</h4>
                    {u.nomeSocial && (
                      <p className="text-xs text-blue-600 break-words">Social: {safeVal(u.nomeSocial)}</p>
                    )}
                    <div className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
                       <span>CPF: {safeVal(u.cpf)}</span>
                       {u._alertaCPF && <AlertTriangle size={12} className="text-red-500" />}
                    </div>
                  </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                getTipoCadastro(u) === 'Importado' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
              }`}>
                {getTipoCadastro(u)}
              </span>
            </div>
            
            <div className="space-y-1 text-sm text-gray-600 mb-3 pl-6">
              <p><span className="font-medium">Mãe:</span> {safeVal(u.nomeMae)}</p>
              <p><span className="font-medium">Nasc:</span> {normalizeDate(safeVal(u.dataNascimento))}</p>
              {u.nis && <p><span className="font-medium">NIS:</span> {u.nis}</p>}
              <p>
                <span className="font-medium">Unidade:</span>{' '}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  u._nomeUnidade === 'Sem unidade' ? 'bg-gray-100 text-gray-500' :
                  String(u._nomeUnidade || '').toLowerCase().includes('cohab') ? 'bg-purple-100 text-purple-800' :
                  'bg-blue-100 text-blue-800'
                }`}>{u._nomeUnidade}</span>
              </p>
            </div>

            <div className="flex justify-end gap-2 pl-6">
               <button 
                  onClick={() => openEdit(u)} 
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm font-medium flex items-center gap-1"
                >
                  <Edit size={14} /> Editar
               </button>
               <button 
                  onClick={() => handleDeleteOne(u.id, u.nome)} 
                  disabled={deletingIds.has(u.id)}
                  className="px-3 py-1.5 bg-red-50 text-red-700 rounded hover:bg-red-100 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 size={14} /> {deletingIds.has(u.id) ? 'Excluindo...' : 'Excluir'}
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View (Table) */}
      <div className="hidden xl:block bg-white shadow rounded-lg overflow-x-auto border border-gray-200 max-w-full">
        <table className="w-full min-w-[1100px] text-xs divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {/* Linha de Cabeçalhos */}
            <tr>
              <th className="p-2 text-center w-8 sticky left-0 top-0 bg-gray-50 z-50 border-b border-gray-200 shadow-[0_2px_5px_-2px_rgba(0,0,0,0.1)]" rowSpan="2">
                <input
                  type="checkbox"
                  checked={allSelectedOnView}
                  onChange={toggleSelectAllView}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              {visibleColumnsList.map(col => (
                <th 
                  key={col.key} 
                  className={`p-2 text-left font-semibold text-gray-700 uppercase tracking-wider text-xs border-b border-gray-200 sticky top-0 ${col.width} ${
                    col.sticky 
                      ? `${col.left} z-50 bg-gray-50 shadow-[2px_2px_5px_-2px_rgba(0,0,0,0.1)]` 
                      : 'z-40 bg-gray-50 shadow-[0_2px_5px_-2px_rgba(0,0,0,0.1)]'
                  }`}
                >
                  {col.label}
                </th>
              ))}
              <th className="p-2 text-center font-semibold text-gray-700 w-[80px] sticky right-0 top-0 bg-gray-50 z-50 border-b border-gray-200 shadow-[-2px_2px_5px_-2px_rgba(0,0,0,0.1)]" rowSpan="2">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && (
              <tr>
                <td colSpan={visibleColumnsList.length + 2} className="p-8 text-center text-gray-500 animate-pulse">
                  Carregando usuários...
                </td>
              </tr>
            )}
            {!loading && usuariosView.length === 0 && (
              <tr>
                <td colSpan={visibleColumnsList.length + 2} className="p-8 text-center text-gray-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              usuariosView.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-2 text-center sticky left-0 bg-white z-30 border-r border-gray-100 shadow-[2px_0_0_0_rgba(0,0,0,0.02)]">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(u.id)}
                    onChange={() => toggleSelect(u.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </td>
                
                {visibleColumnsList.map(col => (
                  <td 
                    key={col.key} 
                    className={`p-2 text-gray-600 text-xs ${
                      col.sticky 
                        ? `sticky ${col.left} bg-white z-30 shadow-[2px_0_0_0_rgba(0,0,0,0.02)] border-r border-gray-100` 
                        : ''
                    }`}
                  >
                    {renderCellContent(u, col.key)}
                  </td>
                ))}

                <td className="p-2 text-center sticky right-0 bg-white z-30 border-l border-gray-100 shadow-[-2px_0_0_0_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-center gap-1">
                    <button
                        onClick={() => openEdit(u)}
                        className="text-indigo-600 hover:text-indigo-900 transition-colors"
                        title="Editar"
                    >
                        <Edit size={14} />
                    </button>
                    <button
                        onClick={() => handleDeleteOne(u.id, u.nome)}
                        disabled={deletingIds.has(u.id)}
                        className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-40"
                        title="Excluir"
                    >
                        <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 text-xs text-gray-600">
          <div className="text-center sm:text-left">
            {usuariosView.length > 0 ? (
              emModoBusca
                ? `Exibindo ${usuariosView.length} de ${totalResultadosBusca} encontrado(s)`
                : `Mostrando ${usuariosView.length} nesta página`
            ) : emModoBusca ? 'Nenhum resultado para esta busca.' : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={!podeVoltarPagina}
              className={`px-3 py-1.5 rounded-lg border text-sm ${!podeVoltarPagina ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white hover:bg-gray-100'}`}
            >
              Anterior
            </button>
            <span className="px-2 font-medium">
               Página {paginaAtual}{emModoBusca ? ` de ${totalPaginasBusca}` : ''}
            </span>
            <button
              onClick={handleNextPage}
              disabled={!podeAvancarPagina}
              className={`px-3 py-1.5 rounded-lg border text-sm ${!podeAvancarPagina ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white hover:bg-gray-100'}`}
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <h4 className="text-xl font-semibold mb-4">Novo Usuário (Cidadão)</h4>
            <p className="text-sm text-gray-500 mb-4">Preencha os dados do cidadão. O CPF é recomendado para evitar duplicidade.</p>
            <form onSubmit={saveCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                  <input name="nome" value={createData.nome} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" required />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                   <input name="cpf" value={createData.cpf} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" placeholder="Apenas números" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nome Social</label>
                   <input name="nomeSocial" value={createData.nomeSocial} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Data Nasc.</label>
                   <input name="dataNascimento" value={createData.dataNascimento} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" placeholder="DD/MM/AAAA" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                   <input name="rg" value={createData.rg} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">NIS</label>
                   <input name="nis" value={createData.nis} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                   <input name="telefone" value={createData.telefone} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div className="col-span-1 md:col-span-2">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Mãe</label>
                   <input name="nomeMae" value={createData.nomeMae} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div className="col-span-1 md:col-span-2">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Pai</label>
                   <input name="nomePai" value={createData.nomePai} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Cônjuge</label>
                   <input name="conjuge" value={createData.conjuge} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Data Cadastro</label>
                   <input name="dataCadastro" value={createData.dataCadastro} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   {/* <label className="block text-sm font-medium text-gray-700 mb-1">Origem Demanda</label>
                   <input name="origemDemanda" value={createData.origemDemanda} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" /> */}
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Técnico Resp.</label>
                   <input name="tecnicoResponsavel" value={createData.tecnicoResponsavel} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                   <select name="cor" value={createData.cor} onChange={handleCreateChange} className="w-full p-2 border rounded-lg bg-white">
                      <option value="">Selecione</option>
                      <option value="Branca">Branca</option>
                      <option value="Preta">Preta</option>
                      <option value="Parda">Parda</option>
                      <option value="Amarela">Amarela</option>
                      <option value="Indigena">Indígena</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                   <select name="sexo" value={createData.sexo} onChange={handleCreateChange} className="w-full p-2 border rounded-lg bg-white">
                      <option value="">Selecione</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="Outro">Outro</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Religião</label>
                   <select name="religiao" value={createData.religiao} onChange={handleCreateChange} className="w-full p-2 border rounded-lg bg-white">
                      <option value="">Selecione</option>
                      <option value="Catolica">Católica</option>
                      <option value="Evangelica">Evangélica</option>
                      <option value="Espirita">Espírita</option>
                      <option value="Matriz Africana">Matriz Africana</option>
                      <option value="Sem Religiao">Sem Religião</option>
                      <option value="Outras">Outras</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Orient. Sexual</label>
                   <select name="orientacaoSexual" value={createData.orientacaoSexual} onChange={handleCreateChange} className="w-full p-2 border rounded-lg bg-white">
                      <option value="">Selecione</option>
                      <option value="Heterossexual">Heterossexual</option>
                      <option value="Homossexual">Homossexual</option>
                      <option value="Bissexual">Bissexual</option>
                      <option value="Prefiro nao dizer">Prefiro não dizer</option>
                      <option value="Outros">Outros</option>
                   </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Naturalidade</label>
                   <input name="naturalidade" value={createData.naturalidade} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" placeholder="Ex: São Luís" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                   <input name="uf" value={createData.uf} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" maxLength={2} />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nacionalidade</label>
                   <input name="nacionalidade" value={createData.nacionalidade} onChange={handleCreateChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Escolaridade</label>
                   <select name="escolaridade" value={createData.escolaridade} onChange={handleCreateChange} className="w-full p-2 border rounded-lg bg-white">
                      <option value="">Selecione</option>
                      <option value="Analfabeto">Analfabeto</option>
                      <option value="Fundamental Incompleto">Fundamental Incompleto</option>
                      <option value="Fundamental Completo">Fundamental Completo</option>
                      <option value="Medio Incompleto">Médio Incompleto</option>
                      <option value="Medio Completo">Médio Completo</option>
                      <option value="Superior Incompleto">Superior Incompleto</option>
                      <option value="Superior Completo">Superior Completo</option>
                      <option value="Pos Graduacao">Pós Graduação</option>
                   </select>
                </div>
                <div className="col-span-1 md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Principal</label>
                  <select
                    name="cras_id_principal"
                    value={createData.cras_id_principal}
                    onChange={handleCreateChange}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    <option value="">Selecionar automaticamente</option>
                    {Object.entries(crasMap || {}).map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button type="button" onClick={cancelCreate} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">Cadastrar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <h4 className="text-xl font-semibold mb-4">Editar usuário</h4>
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input name="nome" value={editData.nome} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                   <input name="cpf" value={editData.cpf} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nome Social</label>
                   <input name="nomeSocial" value={editData.nomeSocial} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Data Nasc.</label>
                   <input name="dataNascimento" value={editData.dataNascimento} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                   <input name="rg" value={editData.rg} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">NIS</label>
                   <input name="nis" value={editData.nis} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                   <input name="telefone" value={editData.telefone} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div className="col-span-1 md:col-span-2">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Mãe</label>
                   <input name="nomeMae" value={editData.nomeMae} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div className="col-span-1 md:col-span-2">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Pai</label>
                   <input name="nomePai" value={editData.nomePai} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Cônjuge</label>
                   <input name="conjuge" value={editData.conjuge} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Data Cadastro</label>
                   <input name="dataCadastro" value={editData.dataCadastro} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   {/* <label className="block text-sm font-medium text-gray-700 mb-1">Origem Demanda</label>
                   <input name="origemDemanda" value={editData.origemDemanda} onChange={handleEditChange} className="w-full p-2 border rounded-lg" /> */}
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Técnico Resp.</label>
                   <input name="tecnicoResponsavel" value={editData.tecnicoResponsavel} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                   <input name="cor" value={editData.cor} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                   <input name="sexo" value={editData.sexo} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Religião</label>
                   <input name="religiao" value={editData.religiao} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Orient. Sexual</label>
                   <input name="orientacaoSexual" value={editData.orientacaoSexual} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Naturalidade</label>
                   <input name="naturalidade" value={editData.naturalidade} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                   <input name="uf" value={editData.uf} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Nacionalidade</label>
                   <input name="nacionalidade" value={editData.nacionalidade} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Escolaridade</label>
                   <input name="escolaridade" value={editData.escolaridade} onChange={handleEditChange} className="w-full p-2 border rounded-lg" />
                </div>
                <div className="col-span-1 md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Principal</label>
                  <select
                    name="cras_id_principal"
                    value={editData.cras_id_principal}
                    onChange={handleEditChange}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    <option value="">Sem unidade</option>
                    {Object.entries(crasMap || {}).map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <button type="button" onClick={cancelarEdicao} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white">Salvar alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resultadoDuplicados && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-start gap-3">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Duplicados encontrados</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Analisados {resultadoDuplicados.totalAnalisados} cadastros.
                  {' '}{resultadoDuplicados.porCpf.length} grupo(s) por CPF,{' '}
                  {resultadoDuplicados.porNome.length} por nome,{' '}
                  {resultadoDuplicados.porNomeNasc.length} por nome + nascimento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResultadoDuplicados(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Cadastros com <strong>ficha técnica</strong> ou <strong>observações de atendimento</strong> estão destacados.
                Prefira <strong>unificar</strong> em vez de excluir para não perder histórico do técnico.
              </p>
              {renderGrupoDuplicados(
                'Mesmo CPF',
                resultadoDuplicados.porCpf,
                (g) => g.chave.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
              )}
              {renderGrupoDuplicados(
                'Mesmo nome',
                resultadoDuplicados.porNome,
                (g) => g.registros[0]?.nome || g.chave
              )}
              {renderGrupoDuplicados(
                'Mesmo nome + data de nascimento',
                resultadoDuplicados.porNomeNasc,
                (g) => {
                  const [nome, nasc] = g.chave.split('|');
                  return `${g.registros[0]?.nome || nome} — ${nasc}`;
                }
              )}
            </div>

            <div className="p-4 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setResultadoDuplicados(null)}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GerenciarUsuarios;

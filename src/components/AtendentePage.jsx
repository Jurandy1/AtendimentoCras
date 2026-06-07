import React from "react";
import { useAtendente } from "../hooks/useAtendente";
import { useAuth } from "../contexts/AuthContext";
import { getNomeCidadao, normalizeRole } from "../utils";
import InlineAlert from "./ui/InlineAlert";
import { MonitorPlay } from "lucide-react";

// Sub-components
import SelectAtendente from "./atendente/SelectAtendente";
import PainelAtendimento from "./atendente/PainelAtendimento";
import MigrationErrorDialog from "./atendente/dialogs/MigrationErrorDialog";
import PreviewDialog from "./atendente/dialogs/PreviewDialog";

function AtendentePage({
  crasUnidades,
  tiposAtendimento,
  atendentesList,
  salasAtendimento,
}) {
  const { isTestMode, toggleTestMode, userProfile } = useAuth();
  const roleNorm = userProfile?.roleNorm || normalizeRole(userProfile?.role || userProfile?.cargo || "");
  const isSuperAdmin = ["super_admin", "superintendente", "master", "admin"].includes(roleNorm);

  const [superAdminCrasFilter, setSuperAdminCrasFilter] = React.useState("");

  const atendentesFiltrados = React.useMemo(() => {
    const list = Array.isArray(atendentesList) ? atendentesList : [];
    if (isSuperAdmin) {
      if (superAdminCrasFilter) {
        return list.filter((a) => String(a?.cras_id || "") === String(superAdminCrasFilter));
      }
      return list;
    }
    const myCrasId = userProfile?.cras_id || "";
    if (roleNorm === "coordenador" && myCrasId) {
      return list.filter((a) => String(a?.cras_id || "") === String(myCrasId));
    }
    return list;
  }, [atendentesList, isSuperAdmin, roleNorm, userProfile?.cras_id, superAdminCrasFilter]);
  
  const {
    selectedAtendente,
    setSelectedAtendente,
    salaAtualId,
    statusExpediente,
    filaAguardando,
    filaResumo,
    atendimentoAtual,
    observacoes,
    setObservacoes,
    cadunicoAcoes,
    setCadunicoAcoes,
    cadunicoObs,
    setCadunicoObs,
    rmaData,
    setRmaData,
    loadingFila,
    loadingAtual,
    showTransfer,
    setShowTransfer,
    lastHeartbeat,
    busyAction,
    uiError,
    migrationError,
    filaBusca,
    setFilaBusca,
    previewFilaItem,
    setPreviewFilaItem,
    draftSavedAt,
    draftRecovered,
    draftServerSaving,
    draftServerError,
    showBlockModal,
    setShowBlockModal,
    blockReason,
    setBlockReason,
    blockDate,
    setBlockDate,
    blockTecnico,
    setBlockTecnico,
    isBlocking,
    isGestor,
    isCoordenador,
    isViewOnly,
    getWaitMinutes,
    filaFiltrada,
    isCadUnicoAtual,
    isAtendentePsicologo,
    isAtendenteTecnico,
    isAtendenteAssistenteSocial,
    isAtendenteCadUnico,
    isObservacaoOnly,
    handleStatusChange,
    handleTrocarSala,
    getSalaNome,
    handleChamarProximo,
    handleIniciarAtendimento,
    handleFinalizarAtendimento,
    handleMarcarAusente,
    handleRechamar,
    handleBlockUser,
    openBlockModal,
    handleTransferir,
    handleVincularUnidade,
    handleRegistrarVisitaOutraUnidade,
    handleReligarETransferir,
    handleReceberNaUnidade,
    getStatusInfo,
    unidade,
    salasParaSelecao,
    templatesObservacao,
    inserirTemplate,
    salvarRascunhoNoSistema,
    clearLocalDraft,
    formatEventoTime,
    tipoAcompanhamento,
    setTipoAcompanhamento,
    tipoAcompanhamentoLocked,
    visitaEsporadicaAlerta,
  } = useAtendente({
    crasUnidades,
    tiposAtendimento,
    atendentesList: atendentesFiltrados,
    salasAtendimento,
  });

  // Bug 5: Scroll para o topo quando houver erro de validação/uiError
  React.useEffect(() => {
    if (uiError) {
      const container = document.getElementById("atendente-page-container");
      if (container) {
        container.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [uiError]);

  if (migrationError) {
    return <MigrationErrorDialog migrationError={migrationError} />;
  }

  if (!selectedAtendente) {
    return (
      <SelectAtendente
        atendentesList={atendentesFiltrados}
        setSelectedAtendente={setSelectedAtendente}
        crasUnidades={crasUnidades}
        getStatusInfo={getStatusInfo}
        currentUserCrasId={userProfile?.cras_id || null}
        isSuperAdmin={isSuperAdmin}
      />
    );
  }

  // NOTE: StartExpediente logic is now handled inside PainelAtendimento

  return (
    <div className="h-full w-full bg-gray-50 p-4 overflow-y-auto" id="atendente-page-container">
      {uiError && (
        <InlineAlert 
          variant={String(uiError).startsWith("SUCCESS:") ? "success" : "error"} 
          className="mb-4"
        >
          {String(uiError).replace("SUCCESS: ", "")}
        </InlineAlert>
      )}

      {isSuperAdmin && (
        <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="font-bold text-indigo-800 mb-2 flex items-center gap-2">
            <MonitorPlay size={16} />
            Filtro de Unidade (Super Admin)
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { setSuperAdminCrasFilter(""); setSelectedAtendente(null); }}
              className={`px-4 py-2 text-sm font-medium rounded border transition-colors ${
                !superAdminCrasFilter
                  ? "bg-indigo-600 text-white border-indigo-700"
                  : "border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50"
              }`}
            >
              Todas as unidades
            </button>
            {(crasUnidades || []).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => { setSuperAdminCrasFilter(u.id); setSelectedAtendente(null); }}
                className={`px-4 py-2 text-sm font-medium rounded border transition-colors ${
                  superAdminCrasFilter === u.id
                    ? "bg-indigo-600 text-white border-indigo-700"
                    : "border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-50"
                }`}
              >
                {u.nome}
              </button>
            ))}
          </div>
          {selectedAtendente && (
            <p className="mt-2 text-xs text-indigo-700 font-medium">
              Monitorando: <strong>{selectedAtendente.nome}</strong> —{" "}
              {crasUnidades?.find((c) => c.id === selectedAtendente.cras_id)?.nome || "Unidade desconhecida"}
            </p>
          )}
        </div>
      )}

      <PainelAtendimento
        atendimentoAtual={atendimentoAtual}
        loadingAtual={loadingAtual}
        getNomeCidadao={getNomeCidadao}
        getWaitMinutes={getWaitMinutes}
        currentUserCrasId={userProfile?.cras_id || null}
        salaAtualId={salaAtualId}
        getSalaNome={getSalaNome}
        draftRecovered={draftRecovered}
        draftSavedAt={draftSavedAt}
        draftServerError={draftServerError}
        isCadUnicoAtual={isCadUnicoAtual}
        isAtendenteCadUnico={isAtendenteCadUnico}
        isObservacaoOnly={isObservacaoOnly}
        cadunicoAcoes={cadunicoAcoes}
        setCadunicoAcoes={setCadunicoAcoes}
        cadunicoObs={cadunicoObs}
        setCadunicoObs={setCadunicoObs}
        rmaData={rmaData}
        setRmaData={setRmaData}
        isAtendentePsicologo={isAtendentePsicologo}
        isAtendenteTecnico={isAtendenteTecnico}
        isAtendenteAssistenteSocial={isAtendenteAssistenteSocial}
        observacoes={observacoes}
        setObservacoes={setObservacoes}
        templatesObservacao={templatesObservacao}
        inserirTemplate={inserirTemplate}
        salvarRascunhoNoSistema={salvarRascunhoNoSistema}
        clearLocalDraft={clearLocalDraft}
        draftServerSaving={draftServerSaving}
        formatEventoTime={formatEventoTime}
        tipoAcompanhamento={tipoAcompanhamento}
        setTipoAcompanhamento={setTipoAcompanhamento}
        tipoAcompanhamentoLocked={tipoAcompanhamentoLocked}
        // Props do painel
        statusExpediente={statusExpediente}
        handleStatusChange={handleStatusChange}
        filaAguardando={filaAguardando}
        filaResumo={filaResumo}
        handleChamarProximo={handleChamarProximo}
        handleIniciarAtendimento={handleIniciarAtendimento}
        handleFinalizarAtendimento={handleFinalizarAtendimento}
        handleMarcarAusente={handleMarcarAusente}
        handleRechamar={handleRechamar}
        handleTransferir={handleTransferir}
        handleBlockUser={handleBlockUser}
        handleVincularUnidade={handleVincularUnidade}
        handleRegistrarVisitaOutraUnidade={handleRegistrarVisitaOutraUnidade}
        handleReligarETransferir={handleReligarETransferir}
        handleReceberNaUnidade={handleReceberNaUnidade}
        visitaEsporadicaAlerta={visitaEsporadicaAlerta}
        // Props para modal de bloqueio
        blockReason={blockReason}
        setBlockReason={setBlockReason}
        blockDate={blockDate}
        setBlockDate={setBlockDate}
        blockTecnico={blockTecnico}
        setBlockTecnico={setBlockTecnico}
        isGestor={isGestor}
        isViewOnly={isViewOnly}
        setSelectedAtendente={setSelectedAtendente}
        // Props para Abertura de Expediente
        salasParaSelecao={salasParaSelecao}
        handleTrocarSala={handleTrocarSala}
        selectedAtendente={selectedAtendente}
        busyAction={busyAction}
        isCoordenador={isCoordenador}
        atendentesList={atendentesFiltrados}
        crasUnidades={crasUnidades}
        isTestMode={isTestMode}
        toggleTestMode={toggleTestMode}
      />

      <PreviewDialog
        previewFilaItem={previewFilaItem}
        setPreviewFilaItem={setPreviewFilaItem}
        getNomeCidadao={getNomeCidadao}
        getWaitMinutes={getWaitMinutes}
      />
    </div>
  );
}

export default AtendentePage;

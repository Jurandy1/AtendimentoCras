import React, { useState } from "react";
import { UserX, ArrowRightLeft, AlertTriangle, Save, X, MapPin, CheckCircle2, Info } from "lucide-react";

const DesfechoEspecialPanel = ({
  atendimentoAtual,
  selectedAtendente,
  crasUnidades,
  outraUnidadeInfo,
  onReligarETransferir,
  onReceberNaUnidade,
  canReligar = false,
  busyAction,
  isViewOnly,
}) => {
  const isDesligado = atendimentoAtual?.usuario_desligado === true;
  const infoDesligamento = atendimentoAtual?.info_desligamento || null;
  const isOutraUnidade = !!outraUnidadeInfo && !isDesligado;

  const jaReligado =
    atendimentoAtual?.usuario_desligado === false &&
    !!atendimentoAtual?.eventos?.some?.((e) => e?.tipo === "religacao");
  const jaRecebido =
    atendimentoAtual?.usuario_de_outra_unidade === false &&
    !!atendimentoAtual?.eventos?.some?.((e) => e?.tipo === "recebimento_unidade");

  const [modo, setModo] = useState(null);
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);
  const [concluido, setConcluido] = useState(null);

  if (!isDesligado && !isOutraUnidade) return null;

  const unidadeAtualNome =
    crasUnidades?.find((c) => c.id === selectedAtendente?.cras_id)?.nome || "esta unidade";

  const handleConfirm = async () => {
    if (!justificativa.trim() || loading || isViewOnly) return;
    setLoading(true);
    try {
      let ok = false;
      if (modo === "religar") {
        ok = await onReligarETransferir?.(justificativa.trim());
        if (ok) setConcluido(`Usuário religado e transferido para ${unidadeAtualNome}.`);
      } else if (modo === "receber") {
        ok = await onReceberNaUnidade?.(justificativa.trim());
        if (ok) setConcluido(`Usuário recebido e transferido para ${unidadeAtualNome}.`);
      }
      if (ok) {
        setModo(null);
        setJustificativa("");
      }
    } finally {
      setLoading(false);
    }
  };

  const corBorda = isDesligado ? "border-red-300" : "border-blue-300";
  const corFundo = isDesligado ? "bg-red-50" : "bg-blue-50";
  const corIconeBg = isDesligado ? "bg-red-100" : "bg-blue-100";
  const corIcone = isDesligado ? "text-red-700" : "text-blue-700";
  const corTitulo = isDesligado ? "text-red-900" : "text-blue-900";

  if (concluido || jaReligado || jaRecebido) {
    return (
      <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} className="text-emerald-700 shrink-0" />
          <p className="text-sm font-bold text-emerald-900">
            {concluido ||
              (jaReligado
                ? "Usuário religado e transferido neste atendimento."
                : "Usuário recebido e transferido neste atendimento.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 ${corBorda} ${corFundo} p-4 animate-in fade-in duration-200`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${corIconeBg}`}>
          {isDesligado ? <UserX size={18} className={corIcone} /> : <MapPin size={18} className={corIcone} />}
        </div>

        <div className="flex-1">
          <p className={`font-black text-sm uppercase tracking-wide ${corTitulo}`}>
            {isDesligado ? "Usuário Desligado" : "Usuário de Outra Unidade"}
          </p>

          {isDesligado && infoDesligamento && (
            <div className="mt-1 text-xs text-red-800 space-y-0.5">
              <p>
                <span className="font-bold">Motivo do desligamento:</span>{" "}
                {infoDesligamento.motivo || "Não informado"}
              </p>
              {infoDesligamento.tecnico && (
                <p className="text-red-700">
                  Desligado por: <strong>{infoDesligamento.tecnico}</strong>
                </p>
              )}
            </div>
          )}

          {isOutraUnidade && outraUnidadeInfo && (
            <p className="text-xs text-blue-800 mt-1">
              Vinculado: <strong>{outraUnidadeInfo.origemNome}</strong> • Unidade atual:{" "}
              <strong>{outraUnidadeInfo.destinoNome}</strong>
            </p>
          )}

          {!modo && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isDesligado && canReligar && (
                <button
                  type="button"
                  onClick={() => setModo("religar")}
                  disabled={!!busyAction || isViewOnly}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  A) Religar e Transferir
                </button>
              )}
              {isOutraUnidade && (
                <button
                  type="button"
                  onClick={() => setModo("receber")}
                  disabled={!!busyAction || isViewOnly}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  <ArrowRightLeft size={14} />
                  B) Receber na Unidade
                </button>
              )}
              <div className="flex items-center gap-1 text-xs text-gray-500 italic ml-1 pl-1 border-l border-gray-300">
                <Info size={11} />
                <span>C) Para atendimento esporádico, apenas finalize normalmente.</span>
              </div>
            </div>
          )}

          {modo && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
              <p className="text-xs font-bold text-gray-700 mb-2">
                {modo === "religar" ? (
                  <>
                    Motivo da religação e transferência para <strong>{unidadeAtualNome}</strong>:{" "}
                    <span className="text-red-500">*</span>
                  </>
                ) : (
                  <>
                    Motivo do recebimento em <strong>{unidadeAtualNome}</strong>:{" "}
                    <span className="text-red-500">*</span>
                  </>
                )}
              </p>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder={
                  modo === "religar"
                    ? "Ex: Usuário retomou vínculo com o serviço após período de distanciamento e deseja continuar o acompanhamento nesta unidade..."
                    : "Ex: Usuário informou que mudou de residência para esta região e deseja ser transferido para esta unidade de referência..."
                }
                className="w-full h-20 p-2 text-xs border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                autoFocus
                disabled={loading}
              />
              {!justificativa.trim() && (
                <p className="text-[10px] text-amber-700 flex items-center gap-1 mt-1">
                  <AlertTriangle size={10} /> Justificativa obrigatória para concluir a ação.
                </p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!justificativa.trim() || loading || isViewOnly}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full inline-block" />{" "}
                      Processando...
                    </>
                  ) : (
                    <>
                      <Save size={12} /> Confirmar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModo(null);
                    setJustificativa("");
                  }}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                >
                  <X size={12} /> Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DesfechoEspecialPanel;

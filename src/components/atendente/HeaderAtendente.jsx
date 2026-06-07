import React from 'react';
import Select from '../ui/Select';

const HeaderAtendente = ({
  isGestor,
  selectedAtendente,
  unidade,
  salaAtualId,
  getSalaNome,
  statusExpediente,
  getStatusInfo,
  salasParaSelecao,
  handleTrocarSala,
  busyAction,
  setSelectedAtendente
}) => {
  const formatCargo = (cargo) => {
    if (!cargo) return "Cargo não definido";
    return cargo.replace(/Coordenadora/gi, "Coordenador");
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
      <div className="flex items-start gap-3">
        {isGestor && (
          <button
            type="button"
            onClick={() => setSelectedAtendente(null)}
            className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Voltar
          </button>
        )}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Painel do Atendente
            {isGestor && (
              <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full uppercase border border-yellow-200">
                Modo Gestão
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-600">
            {selectedAtendente.nome} – {unidade}
            {getSalaNome(salaAtualId)
              ? ` (${getSalaNome(salaAtualId)})`
              : ""}
          </p>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
            <span>{formatCargo(selectedAtendente.cargo)}</span>
            <span className="text-gray-300">•</span>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full font-semibold ${
                getStatusInfo(statusExpediente).classes
              }`}
            >
              {getStatusInfo(statusExpediente).label}
            </span>
          </p>
        </div>
      </div>
      {salasParaSelecao && salasParaSelecao.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Sala atual:</span>
          <Select
            value={salaAtualId}
            onChange={(e) => handleTrocarSala(e.target.value)}
            disabled={busyAction === "sala"}
            className="text-xs py-2"
          >
            <option value="">Selecione</option>
            {salasParaSelecao.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
};

export default HeaderAtendente;

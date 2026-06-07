import React from 'react';
import { UserCheck, Users, CheckCircle, Play, Pause, Square } from 'lucide-react';

const ExpedienteManager = ({
  statusExpediente,
  handleStatusChange,
  busyAction,
  getStatusInfo,
  lastHeartbeat,
  filaAguardando,
  atendimentoAtual
}) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">
              Status do expediente
            </p>
            <p className="text-sm font-semibold text-blue-950 mt-1">
              {getStatusInfo(statusExpediente).label}
            </p>
            {lastHeartbeat && (
              <p className="text-[11px] text-blue-900/70 mt-1">
                Última atividade há{" "}
                {Math.max(
                  1,
                  Math.round((Date.now() - lastHeartbeat.getTime()) / 60000)
                )}{" "}
                min
              </p>
            )}
          </div>
          <div className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center text-blue-700">
            <UserCheck size={18} />
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
              Pessoas na fila
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {filaAguardando.length}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Somente atendimentos compatíveis com seu perfil
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-700 border border-gray-200">
            <Users size={18} />
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
              Atendimento atual
            </p>
            <p className="text-sm font-semibold text-emerald-900 mt-1">
              {atendimentoAtual
                ? atendimentoAtual.status === "chamando"
                  ? "Chamando usuário"
                  : "Em atendimento"
                : "Nenhum atendimento em andamento"}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-emerald-700 border border-emerald-100">
            <CheckCircle size={18} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <button
          type="button"
          onClick={() => handleStatusChange("online")}
          disabled={busyAction === "status" || busyAction === "sala"}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all shadow-sm ${
            statusExpediente === "online"
              ? "bg-green-600 text-white ring-2 ring-green-600 ring-offset-2 scale-105"
              : "bg-white text-green-700 border border-green-200 hover:bg-green-50 opacity-80 hover:opacity-100"
          }`}
        >
          <Play size={18} />
          {statusExpediente === "pausa" ? "Retomar Expediente" : "Iniciar Expediente"}
        </button>
        <button
          type="button"
          onClick={() => handleStatusChange("pausa")}
          disabled={busyAction === "status"}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all shadow-sm ${
            statusExpediente === "pausa"
              ? "bg-yellow-500 text-white ring-2 ring-yellow-500 ring-offset-2 scale-105"
              : "bg-white text-yellow-700 border border-yellow-200 hover:bg-yellow-50 opacity-80 hover:opacity-100"
          }`}
        >
          <Pause size={18} />
          PAUSAR
        </button>
        <button
          type="button"
          onClick={() => handleStatusChange("offline")}
          disabled={busyAction === "status"}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all shadow-sm ${
            statusExpediente === "offline"
              ? "bg-red-600 text-white ring-2 ring-red-600 ring-offset-2 scale-105"
              : "bg-white text-red-700 border border-red-200 hover:bg-red-50 opacity-80 hover:opacity-100"
          }`}
        >
          <Square size={18} />
          Encerrar Expediente
        </button>
      </div>
    </>
  );
};

export default ExpedienteManager;

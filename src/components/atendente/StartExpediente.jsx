import React, { useEffect, useState } from 'react';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Field } from '../ui/Field';
import { LayoutDashboard, UserCircle } from 'lucide-react';

const StartExpediente = ({
  selectedAtendente,
  salaAtualId,
  handleTrocarSala,
  busyAction,
  salasParaSelecao,
  handleStatusChange,
  setSelectedAtendente,
  statusExpediente,
  onStart
}) => {
  const [salaSelecionada, setSalaSelecionada] = useState(salaAtualId || "");
  const isOnline = statusExpediente === "online" || statusExpediente === "ocupado" || statusExpediente === "pausa";

  useEffect(() => {
    setSalaSelecionada(salaAtualId || "");
  }, [salaAtualId]);

  return (
    <div className="h-full flex items-center justify-center bg-gray-50 p-4">
        <Card className="p-8 max-w-md w-full bg-white shadow-xl rounded-2xl border-t-4 border-blue-600 animate-fadeIn">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4">
              <UserCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">
              {isOnline ? "Confirmar Sala" : "Iniciar Expediente"}
            </h2>
            <p className="text-gray-500 text-center mt-2">
              {isOnline 
                ? "Sessão ativa detectada. Confirme sua sala para continuar." 
                : "Selecione sua sala de atendimento para começar."}
            </p>
          </div>

          <div className="space-y-4">
            <Field label="Sala de Atendimento">
              <Select
                value={salaSelecionada}
                onChange={(e) => setSalaSelecionada(e.target.value)}
                className="w-full text-lg py-3"
              >
                <option value="">Selecione...</option>
                {salasParaSelecao.map((sala) => (
                  <option key={sala.id} value={sala.id}>
                    {sala.nome}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Button
            variant="primary"
            onClick={() => {
                if (onStart) {
                  onStart(salaSelecionada);
                  return;
                }

                if (handleTrocarSala) {
                  handleTrocarSala(salaSelecionada);
                }

                if (handleStatusChange && !isOnline) {
                  handleStatusChange("online");
                }
            }}
            disabled={!salaSelecionada || busyAction === "status" || busyAction === "sala"}
            className="w-full mt-6 py-3 text-lg font-bold uppercase tracking-wider shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
          >
            {isOnline ? "Confirmar e Acessar" : "Iniciar Atendimentos"}
          </Button>

          <div className="mt-6 pt-6 border-t border-gray-100 flex justify-center">
            <button
              onClick={() => setSelectedAtendente(null)}
              className="text-sm text-gray-500 hover:text-gray-700 underline flex items-center gap-1"
            >
              <span>←</span> Voltar para seleção de atendente
            </button>
          </div>
        </Card>
      </div>
    );
  };
  
  export default StartExpediente;

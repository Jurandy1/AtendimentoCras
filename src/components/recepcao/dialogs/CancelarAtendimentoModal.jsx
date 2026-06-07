import React from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import Button from '../../ui/Button';

const CancelarAtendimentoModal = ({ isOpen, onClose, onConfirm, atendimentoNome }) => {
  const [isProcessing, setIsProcessing] = React.useState(false);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-red-100 animate-scaleIn">
        {/* Header */}
        <div className="bg-red-50 px-6 py-4 flex items-center justify-between border-b border-red-100">
          <div className="flex items-center gap-3 text-red-700">
            <div className="bg-red-100 p-2 rounded-lg">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-lg font-bold">Cancelar Atendimento</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-red-400 hover:text-red-600 transition-colors p-1 hover:bg-red-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          <p className="text-gray-600 leading-relaxed">
            Deseja realmente cancelar o atendimento de <span className="font-bold text-gray-800">{atendimentoNome}</span>?
          </p>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-start gap-3">
            <div className="text-gray-400 mt-0.5">
              <CheckCircle2 size={16} />
            </div>
            <p className="text-xs text-gray-500 italic">
              O motivo registrado será: "Desistência informada na recepção". Esta ação não pode ser desfeita diretamente.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex flex-col sm:flex-row gap-3 sm:justify-end border-t border-gray-100">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto order-2 sm:order-1"
          >
            Voltar
          </Button>
          <Button
            variant="danger"
            disabled={isProcessing}
            onClick={async () => {
              setIsProcessing(true);
              try {
                await onConfirm?.();
                onClose?.();
              } catch (err) {
                console.error("Erro ao cancelar:", err);
                alert("Erro ao cancelar atendimento. Tente novamente.");
              } finally {
                setIsProcessing(false);
              }
            }}
            className="w-full sm:w-auto order-1 sm:order-2"
          >
            {isProcessing ? "Cancelando..." : "Confirmar Cancelamento"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CancelarAtendimentoModal;

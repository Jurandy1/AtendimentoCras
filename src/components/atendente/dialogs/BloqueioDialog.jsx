import React from 'react';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Textarea from '../../ui/Textarea';
import { UserX, Power, AlertTriangle } from 'lucide-react';
import { formatBRDateTyping } from '../../../utils';

const BloqueioDialog = ({ 
  showBlockModal, 
  setShowBlockModal, 
  blockReason, 
  setBlockReason, 
  blockDate, 
  setBlockDate, 
  blockTecnico, 
  setBlockTecnico, 
  handleBlockUser, 
  isBlocking 
}) => {
  if (!showBlockModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-white shadow-2xl rounded-lg border-t-8 border-red-600 animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-red-100 rounded-full text-red-600 shrink-0">
              <UserX size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Realizar Desligamento</h2>
              <p className="text-xs text-gray-500 font-medium">Esta ação encerrará o acompanhamento deste usuário no CRAS.</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded p-3 mb-5 flex items-start gap-2">
            <AlertTriangle size={16} className="text-red-600 mt-0.5" />
            <p className="text-[10px] text-red-800 font-bold uppercase leading-tight">
              Alerta de Impacto: O registro de desligamento é permanente e ficará salvo no histórico do cidadão conforme norma técnica.
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                Motivo Detalhado *
              </label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Descreva o motivo do desligamento técnico..."
                rows={4}
                className="w-full shadow-inner border-gray-300 focus:ring-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                  Data Efetiva
                </label>
                <Input
                  type="text"
                  value={blockDate}
                  onChange={(e) => setBlockDate(formatBRDateTyping(e.target.value))}
                  className="w-full"
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                  Responsável
                </label>
                <Input
                  type="text"
                  value={blockTecnico}
                  onChange={(e) => setBlockTecnico(e.target.value)}
                  className="w-full bg-gray-50"
                  readOnly // O usuário pediu pré-preenchido, vou deixar readonly por segurança ou editável? Vou deixar editável mas com style de readonly se quiser
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
            <Button
              variant="secondary"
              onClick={() => setShowBlockModal(false)}
              disabled={isBlocking}
              className="text-[10px] font-black text-gray-500 uppercase hover:text-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBlockUser}
              disabled={isBlocking || !blockReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-wide border-0"
            >
              <Power size={14} className="mr-2" />
              {isBlocking ? "Processando..." : "Confirmar Desligamento"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BloqueioDialog;

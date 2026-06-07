import React, { useState } from 'react';
import { X, Save, Edit, Eye } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import RMAForm from '../atendente/RMAForm';
import Button from '../ui/Button';

const RMADetailsModal = ({ atendimento, onClose, db, appId, canEdit, initialEditMode = false }) => {
  const [isEditing, setIsEditing] = useState(initialEditMode && canEdit);
  const [formData, setFormData] = useState(atendimento.rma || {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!db || !appId) return;
    setSaving(true);
    try {
      const ref = doc(db, `artifacts/${appId}/public/data/atendimentos`, atendimento.id);
      await updateDoc(ref, {
        rma: formData
      });
      setIsEditing(false);
      onClose();
      // Idealmente, a lista pai atualizaria, mas como é snapshot, deve atualizar sozinho
    } catch (e) {
      console.error("Erro ao salvar RMA:", e);
      alert("Erro ao salvar alterações do RMA.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-purple-100 text-purple-700 p-1 rounded">RMA</span>
            Detalhes do Registro
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full p-1"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
          <div className={!isEditing ? "pointer-events-none" : ""}>
            <RMAForm 
              atendimentoAtual={atendimento} 
              rmaData={formData} 
              setRmaData={setFormData} 
              crasId={atendimento?.cras_id || null}
            />
          </div>
          
          {!isEditing && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-100 rounded text-sm text-yellow-800">
              Modo de visualização. Para alterar os dados, clique em Editar.
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-white rounded-b-xl flex justify-end gap-3">
          {canEdit && !isEditing && (
            <Button 
              onClick={() => setIsEditing(true)} 
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Edit size={16} /> Editar Dados
            </Button>
          )}

          {isEditing && (
            <>
              <Button 
                onClick={() => {
                  setFormData(atendimento.rma || {}); // Reverte mudanças
                  setIsEditing(false);
                }} 
                className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                disabled={saving}
              >
                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={16} />}
                Salvar Alterações
              </Button>
            </>
          )}

          {!isEditing && (
            <Button 
              onClick={onClose} 
              className="bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Fechar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RMADetailsModal;

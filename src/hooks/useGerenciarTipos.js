import { useState, useEffect } from 'react';
import { doc, updateDoc, addDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { CORES_TIPO_PADRAO, logAdminAction, normalizeName } from '../utils';

export const useGerenciarTipos = ({ db, appId, userProfile }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ nome: '', cor: CORES_TIPO_PADRAO[0], ordem: 0 });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const collectionPath = `artifacts/${appId}/public/data/tipos_atendimento`;

  // Função para garantir que os tipos padrão existam
  const ensureDefaultTipos = async () => {
    if (!db) return;
    
    const tiposPadrao = [
      { nome: 'Assistente Social', cor: '#4F46E5', ordem: 1 },
      { nome: 'Coordenador', cor: '#DC2626', ordem: 2 }
    ];

    try {
      const tiposRef = collection(db, collectionPath);
      
      for (const tipo of tiposPadrao) {
        const q = query(tiposRef, where('nome', '==', tipo.nome));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          await addDoc(tiposRef, {
            nome: tipo.nome,
            cor: tipo.cor,
            ordem: tipo.ordem
          });
          console.log(`Tipo de atendimento "${tipo.nome}" criado com sucesso.`);
        }
      }
    } catch (error) {
      console.error('Erro ao garantir tipos padrão:', error);
    }
  };

  // Executar a função quando o hook for inicializado
  useEffect(() => {
    ensureDefaultTipos();
  }, [db, appId]);

  const handleChange = (e) => { 
    const { name, value, type } = e.target; 
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) : value })); 
  };
  
  const resetForm = () => { 
    setFormData({ nome: '', cor: CORES_TIPO_PADRAO[0], ordem: 0 }); 
    setEditingId(null); 
    setShowModal(false); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db) return;
    try {
      setLoading(true);
      
      const dataToSave = {
        ...formData,
        nome: normalizeName(formData.nome)
      };

      if (editingId) {
        await updateDoc(doc(db, collectionPath, editingId), dataToSave);
        await logAdminAction(db, appId, userProfile, "UPDATE_TIPO_ATENDIMENTO", dataToSave.nome, { id: editingId, ...dataToSave });
      } else {
        const ref = await addDoc(collection(db, collectionPath), dataToSave);
        await logAdminAction(db, appId, userProfile, "CREATE_TIPO_ATENDIMENTO", dataToSave.nome, { id: ref.id, ...dataToSave });
      }
      resetForm();
    } catch (error) { 
      console.error("Erro ao salvar Tipo:", error); 
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tipo) => { 
    setFormData({ nome: tipo.nome, cor: tipo.cor, ordem: tipo.ordem || 0 }); 
    setEditingId(tipo.id); 
    setShowModal(true); 
  };

  const handleDelete = async (id) => { 
    try { 
      setLoading(true);
      await deleteDoc(doc(db, collectionPath, id)); 
      await logAdminAction(db, appId, userProfile, "DELETE_TIPO_ATENDIMENTO", id);
    } catch (error) { 
      console.error("Erro ao deletar Tipo:", error); 
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    formData,
    editingId,
    showModal,
    setShowModal,
    setFormData,
    handleChange,
    resetForm,
    handleSubmit,
    handleEdit,
    handleDelete,
    CORES_TIPO_PADRAO
  };
};

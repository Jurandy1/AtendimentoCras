import { useState } from 'react';
import { doc, updateDoc, addDoc, deleteDoc, collection } from 'firebase/firestore';
import { logAdminAction } from '../utils';

export const useGerenciarCras = ({ db, appId, userProfile }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ nome: '' });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const collectionPath = `artifacts/${appId}/public/data/cras_unidades`;

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  
  const resetForm = () => { 
    setFormData({ nome: '' }); 
    setEditingId(null); 
    setShowModal(false); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db) return;
    try {
      setLoading(true);
      if (editingId) {
        await updateDoc(doc(db, collectionPath, editingId), formData);
        await logAdminAction(db, appId, userProfile, "UPDATE_CRAS", formData.nome, { id: editingId, ...formData });
      } else {
        const docRef = await addDoc(collection(db, collectionPath), formData);
        await logAdminAction(db, appId, userProfile, "CREATE_CRAS", formData.nome, { id: docRef.id, ...formData });
      }
      resetForm();
    } catch (error) { 
      console.error("Erro ao salvar unidade:", error); 
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (unidade) => { 
    setFormData({ nome: unidade.nome }); 
    setEditingId(unidade.id); 
    setShowModal(true); 
  };

  const handleDelete = async (id) => { 
    try { 
      setLoading(true);
      await deleteDoc(doc(db, collectionPath, id)); 
      await logAdminAction(db, appId, userProfile, "DELETE_CRAS", id);
    } catch (error) { 
      console.error("Erro ao deletar unidade:", error); 
    } finally {
      setLoading(false);
    }
  };

  const getPanelUrl = (id) => `${window.location.origin}${window.location.pathname}?page=PainelTV&cras_id=${id}`;
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Feedback visual opcional
    }).catch(err => console.error('Erro ao copiar', err));
  };

  return {
    loading,
    formData,
    editingId,
    showModal,
    setShowModal,
    handleChange,
    resetForm,
    handleSubmit,
    handleEdit,
    handleDelete,
    getPanelUrl,
    copyToClipboard
  };
};

import React from 'react';
import { Plus, Edit, Trash2, Copy, ExternalLink } from 'lucide-react';
import { useGerenciarCras } from '../../hooks/useGerenciarCras';

const GerenciarCRAS = ({ db, appId, crasUnidades, userProfile }) => {
  const {
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
  } = useGerenciarCras({ db, appId, userProfile });

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold">Gerenciar Unidades Centro Pop</h3>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors">
          <Plus size={18} className="mr-2" /> Nova Unidade
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h4 className="text-xl font-semibold mb-4">{editingId ? 'Editar Unidade' : 'Nova Unidade'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input name="nome" value={formData.nome} onChange={handleChange} placeholder="Nome da Unidade" required className="w-full p-2 border rounded-lg" />
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Salvando...' : (editingId ? 'Atualizar' : 'Salvar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Nome</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Link do Painel</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {crasUnidades.map(unidade => (
              <tr key={unidade.id}>
                <td className="p-3">{unidade.nome}</td>
                <td className="p-3">
                  <div className="flex items-center space-x-2">
                    <button onClick={() => copyToClipboard(getPanelUrl(unidade.id))} title="Copiar Link" className="text-blue-600 hover:text-blue-800"><Copy size={16} /></button>
                    <a href={getPanelUrl(unidade.id)} target="_blank" rel="noopener noreferrer" title="Abrir Painel" className="text-blue-600 hover:text-blue-800"><ExternalLink size={16} /></a>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex space-x-2">
                    <button onClick={() => handleEdit(unidade)} className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(unidade.id)} disabled={loading} className="text-red-600 hover:text-red-800 disabled:opacity-50"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GerenciarCRAS;

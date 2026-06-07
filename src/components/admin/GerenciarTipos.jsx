import React from 'react';
import { Palette, Plus, Edit, Trash2 } from 'lucide-react';
import { useGerenciarTipos } from '../../hooks/useGerenciarTipos';

const GerenciarTipos = ({ db, appId, tiposAtendimento, userProfile }) => {
  const {
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
  } = useGerenciarTipos({ db, appId, userProfile });

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold">Gerenciar Tipos de Atendimento</h3>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} className="mr-2" /> Novo Tipo
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h4 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Palette size={20} className="text-blue-600" />
              {editingId ? 'Editar Tipo' : 'Novo Tipo'}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                <input
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  placeholder="Ex: Atendimento Psicológico"
                  required
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ordem de Exibição <span className="text-red-500">*</span></label>
                <input
                  name="ordem"
                  type="number"
                  value={formData.ordem}
                  onChange={handleChange}
                  placeholder="Ex: 1"
                  required
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Determina a ordem em que aparecerá nas listagens.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor de Identificação</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {CORES_TIPO_PADRAO.map(cor => (
                    <button
                      type="button"
                      key={cor}
                      onClick={() => setFormData(prev => ({ ...prev, cor }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.cor === cor
                          ? 'border-blue-600 ring-2 ring-blue-300 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: cor }}
                      title={cor}
                    />
                  ))}
                  <input
                    type="color"
                    name="cor"
                    value={formData.cor}
                    onChange={handleChange}
                    className="w-10 h-8 p-0 border-none rounded-lg cursor-pointer"
                    title="Cor personalizada"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Salvando...' : (editingId ? 'Atualizar' : 'Salvar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Cor</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Nome</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Ordem</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tiposAtendimento.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  Nenhum tipo de atendimento cadastrado.
                </td>
              </tr>
            )}
            {tiposAtendimento.map(tipo => (
              <tr key={tipo.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-3">
                  <div
                    className="w-6 h-6 rounded-md border border-gray-200"
                    style={{ backgroundColor: tipo.cor }}
                    title={tipo.cor}
                  />
                </td>
                <td className="p-3 font-medium text-gray-900">{tipo.nome}</td>
                <td className="p-3 text-gray-600">{tipo.ordem}</td>
                <td className="p-3">
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleEdit(tipo)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                      title="Editar tipo"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(tipo.id)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                      title="Excluir tipo"
                    >
                      <Trash2 size={18} />
                    </button>
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

export default GerenciarTipos;

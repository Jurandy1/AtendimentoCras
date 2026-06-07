import React from 'react';

const HistoricoBuscaCPF = ({
  cpfBusca,
  handleCpfChange,
  handleBuscar,
  loading,
  error
}) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="flex flex-col md:flex-row md:items-end md:space-x-4 space-y-4 md:space-y-0">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">CPF do usuário</label>
          <input
            value={cpfBusca}
            onChange={handleCpfChange}
            placeholder="Digite o CPF para buscar"
            className="w-full p-2 border rounded-lg"
          />
        </div>
        <button
          type="button"
          onClick={() => handleBuscar()}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
    </div>
  );
};

export default HistoricoBuscaCPF;

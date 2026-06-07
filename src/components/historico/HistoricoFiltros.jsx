import React from 'react';
import { formatBRDateTyping } from '../../utils';

const HistoricoFiltros = ({
  filtroTexto,
  setFiltroTexto,
  filtroUnidade,
  setFiltroUnidade,
  filtroTipo,
  setFiltroTipo,
  filtroDataInicio,
  setFiltroDataInicio,
  filtroDataFim,
  setFiltroDataFim,
  crasUnidades,
  tiposAtendimento,
  crasRestrito,
  erroLista
}) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome ou CPF</label>
          <input
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
            placeholder="Digite parte do nome ou CPF"
            className="w-full p-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidade Centro Pop</label>
          <select
            value={crasRestrito ? crasRestrito : filtroUnidade}
            onChange={e => setFiltroUnidade(e.target.value)}
            disabled={!!crasRestrito}
            className="w-full p-2 border rounded-lg bg-white disabled:bg-gray-100 disabled:text-gray-600"
          >
            <option value="">{crasRestrito ? 'Somente sua unidade' : 'Todas'}</option>
            {crasUnidades.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de atendimento</label>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            className="w-full p-2 border rounded-lg bg-white"
          >
            <option value="">Todos</option>
            {tiposAtendimento.map(t => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data início</label>
            <input
              type="text"
              value={filtroDataInicio}
              onChange={e => setFiltroDataInicio(formatBRDateTyping(e.target.value))}
              className="w-full p-2 border rounded-lg"
              inputMode="numeric"
              placeholder="dd/mm/aaaa"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data fim</label>
            <input
              type="text"
              value={filtroDataFim}
              onChange={e => setFiltroDataFim(formatBRDateTyping(e.target.value))}
              className="w-full p-2 border rounded-lg"
              inputMode="numeric"
              placeholder="dd/mm/aaaa"
            />
          </div>
        </div>
      </div>
      {erroLista && <p className="text-red-600 text-sm mt-3">{erroLista}</p>}
    </div>
  );
};

export default HistoricoFiltros;

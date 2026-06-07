import React from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { getNomeCidadao } from '../../utils';

const FilaAusentes = ({
  filaAusentes,
  filaBusy,
  handleReativarAusente,
  tipoById
}) => {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold text-gray-800 mb-3">
        Ausentes
      </h3>
      {filaAusentes.length === 0 ? (
        <p className="text-xs text-gray-500">
          Nenhum usuário marcado como ausente.
        </p>
      ) : (
        <div className="max-h-52 overflow-y-auto overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-600">
            <thead className="bg-gray-50 text-[11px] uppercase">
              <tr>
                <th className="px-2 py-1">Nome</th>
                <th className="px-2 py-1">Tipo</th>
                <th className="px-2 py-1 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filaAusentes.map((item) => {
                const tipo = tipoById.get(item.tipo_atendimento_id);
                const isBusy = filaBusy && filaBusy.id === item.id;
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-2 py-1">
                      <div className="font-semibold truncate max-w-[140px]">
                        {getNomeCidadao(item)}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <span className="text-[11px]">
                        {tipo?.nome || "Atendimento"}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Button
                        type="button"
                        onClick={() => handleReativarAusente(item.id)}
                        disabled={!!isBusy}
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {isBusy ? "Aguarde..." : "Reativar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default FilaAusentes;

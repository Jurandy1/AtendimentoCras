import React from 'react';

const BloqueioNomeDialog = ({ 
  isOpen, 
  possiveisBloqueadosNome, 
  confirmarBloqueioPorNome, 
  cancelarBloqueioPorNome 
}) => {
  if (!isOpen || !possiveisBloqueadosNome || possiveisBloqueadosNome.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <h4 className="text-lg font-semibold mb-2">
          Possível usuário desligado com este nome
        </h4>
        <p className="text-sm text-gray-700 mb-4">
          Encontramos registro(s) na lista de Usuários Desligados com o mesmo nome.
          Confirme se é a mesma pessoa antes de continuar o atendimento.
        </p>
        <div className="space-y-3 mb-4">
          {possiveisBloqueadosNome.map((u) => (
            <div
              key={u.id}
              className="border rounded-md p-3 text-sm bg-gray-50 space-y-1"
            >
              <div className="font-semibold text-gray-900">{u.nome}</div>
              <div className="text-gray-700">
                CPF: {(u.cpf || "").replace(
                  /(\d{3})(\d{3})(\d{3})(\d{2})/,
                  "$1.$2.$3-$4"
                )}
              </div>
              <div className="text-gray-700">
                Motivo do desligamento:{" "}
                {u.motivoDesligamento || "-"}
              </div>
              {u.dataDesligamento && (
                <div className="text-gray-700">
                  Data do desligamento: {u.dataDesligamento}
                </div>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => confirmarBloqueioPorNome(u)}
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                >
                  Desligar este usuário
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={cancelarBloqueioPorNome}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm"
          >
            Não é a mesma pessoa
          </button>
        </div>
      </div>
    </div>
  );
};

export default BloqueioNomeDialog;

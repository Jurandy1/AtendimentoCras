import React, { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import InlineAlert from '../ui/InlineAlert';
import { getNomeCidadao, fixFirebaseStorageUrl } from '../../utils';
import { ArrowRightLeft, Trash2, User } from 'lucide-react';

const AvatarCell = ({ fotoUrl }) => {
  const [imgError, setImgError] = useState(false);

  if (!fotoUrl || imgError) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border border-gray-300 text-gray-400">
        <User size={16} />
      </div>
    );
  }

  const url = fixFirebaseStorageUrl(fotoUrl);
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-300">
      <img
        src={url}
        alt="Foto"
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
};

const FilaRecepcao = ({
  filaRecepcao,
  filaBusy,
  filaError,
  crasId,
  crasNome,
  handleCancelarAtendimento,
  handleRemanejarAtendimento,
  tipoById
}) => {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold text-gray-800 mb-3">
        Fila de espera – {crasNome || "Selecione uma unidade"}
      </h3>
      {filaError && (
        <InlineAlert variant="error" className="mb-3 text-xs">
          {filaError}
        </InlineAlert>
      )}
      {(!crasId || filaRecepcao.length === 0) ? (
        <div className="py-4">
          <p className="text-xs text-gray-500">
            {crasId ? "Nenhum atendimento aguardando." : (
              <span className="text-amber-700 font-medium">
                Selecione uma unidade (CRAS) no formulário acima para exibir a fila. Usuários cadastrados só aparecem quando a unidade está selecionada.
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-600">
            <thead className="bg-gray-50 text-[11px] uppercase sticky top-0 bg-white z-10 border-b">
              <tr>
                <th className="px-2 py-2 font-bold text-gray-500">Foto</th>
                <th className="px-2 py-2 font-bold text-gray-500">Nome</th>
                <th className="px-2 py-2 font-bold text-gray-500">Tipo</th>
                <th className="px-2 py-2 font-bold text-gray-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filaRecepcao.map((item) => {
                const tipo = tipoById.get(item.tipo_atendimento_id);
                const isBusy = filaBusy && filaBusy.id === item.id;

                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-2 w-10">
                      <AvatarCell fotoUrl={item.cidadao?.fotoUrl || item.cidadao?.foto} />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold truncate max-w-[140px] text-gray-800" title={getNomeCidadao(item)}>
                        {getNomeCidadao(item)}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-[11px] inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100" title={tipo?.nome || "Atendimento"}>
                        {tipo?.nome ? (tipo.nome.length > 15 ? tipo.nome.substring(0, 15) + '...' : tipo.nome) : "Atendimento"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-2">
                          {/* Botão de Remanejar */}
                          {handleRemanejarAtendimento && (
                             <Button
                                type="button"
                                onClick={() => handleRemanejarAtendimento(item)}
                                disabled={!!isBusy}
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1.5 rounded transition-colors flex items-center gap-1.5"
                                title="Remanejar para outro tipo de atendimento"
                                aria-label="Remanejar atendimento"
                             >
                                <ArrowRightLeft size={14} />
                                <span className="hidden sm:inline text-xs font-bold">Remanejar</span>
                             </Button>
                          )}
                          
                          {/* Botão de Remover da fila */}
                          <Button
                            type="button"
                            onClick={() => handleCancelarAtendimento(item)}
                            disabled={!!isBusy}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1.5 rounded transition-colors flex items-center gap-1.5"
                            title="Remover da fila (cancelar atendimento)"
                            aria-label="Remover da fila"
                          >
                             {isBusy ? <span className="text-xs">...</span> : <><Trash2 size={14} /><span className="hidden sm:inline text-xs font-bold">Remover</span></>}
                          </Button>
                      </div>
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

export default FilaRecepcao;

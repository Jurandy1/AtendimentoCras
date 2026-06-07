import React from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import Button from '../ui/Button';

const FilaAtendimento = ({
  filaResumo,
  filaBusca,
  setFilaBusca,
  loadingFila,
  filaFiltrada,
  getNomeCidadao,
  getWaitMinutes,
  setPreviewFilaItem
}) => {
  return (
    <Card className="p-4 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Fila de espera</h3>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="gray">{filaResumo.total} total</Badge>
            <Badge variant="red">{filaResumo.prioridade} prioridade</Badge>
            <Badge variant="blue">{filaResumo.normal} normal</Badge>
          </div>
        </div>
      </div>

      <div className="mb-3">
        <Input
          value={filaBusca}
          onChange={(e) => setFilaBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou tipo..."
        />
      </div>

      {loadingFila ? (
        <p className="text-sm text-gray-500">Carregando fila...</p>
      ) : filaFiltrada.length === 0 ? (
        <p className="text-sm text-gray-500">
          {filaBusca
            ? `Nenhum resultado para "${filaBusca}".`
            : "Nenhum usuário aguardando no momento."}
        </p>
      ) : (
        <div className="overflow-y-auto overflow-x-auto max-h-[520px] rounded-md border border-gray-100">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pl-3 pr-2 font-medium">Nome</th>
                <th className="py-2 pr-2 font-medium">Tipo</th>
                <th className="py-2 pr-2 font-medium">Espera</th>
                <th className="py-2 pr-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filaFiltrada.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b last:border-b-0 text-gray-700 ${
                    item.cidadao?.prioridade &&
                    item.cidadao.prioridade !== "Nenhuma"
                      ? "bg-red-50/80"
                      : "bg-white"
                  }`}
                >
                  <td className="py-2 pl-3 pr-2">
                    <div className="font-semibold">{getNomeCidadao(item)}</div>
                    <div className="text-[11px] text-gray-400">
                      {item.cidadao?.cpf ? `CPF: ${item.cidadao.cpf}` : ""}
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <Badge variant="blue">{item.tipo_nome}</Badge>
                  </td>
                  <td className="py-2 pr-2 text-gray-600">
                    {getWaitMinutes(item.hora_chegada)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewFilaItem(item)}
                    >
                      Ver
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default FilaAtendimento;

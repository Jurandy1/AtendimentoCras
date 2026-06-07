import React from 'react';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';

const PreviewDialog = ({ previewFilaItem, setPreviewFilaItem, getNomeCidadao, getWaitMinutes }) => {
  if (!previewFilaItem) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={() => setPreviewFilaItem(null)}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold">
              Pré-visualização
            </div>
            <div className="text-lg font-bold text-gray-900">
              {getNomeCidadao(previewFilaItem)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="blue">{previewFilaItem.tipo_nome}</Badge>
              {previewFilaItem.cidadao?.prioridade &&
              previewFilaItem.cidadao.prioridade !== "Nenhuma" ? (
                <Badge variant="red">{previewFilaItem.cidadao.prioridade}</Badge>
              ) : (
                <Badge variant="gray">Normal</Badge>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPreviewFilaItem(null)}
          >
            Fechar
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
          <div>
            <div className="text-xs text-gray-500">CPF</div>
            <div className="font-semibold">{previewFilaItem.cidadao?.cpf || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Tempo aguardando</div>
            <div className="font-semibold">{getWaitMinutes(previewFilaItem.hora_chegada)}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs text-gray-500">Observação (Recepção)</div>
            <div className="font-medium text-gray-800">
              {previewFilaItem.observacoes || "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewDialog;

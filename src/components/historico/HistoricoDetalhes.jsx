import React, { useState } from 'react';
import { Download, Trash2, FileText, Edit } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import { maskCPF, formatDateTime } from '../../utils';
import RMADetailsModal from './RMADetailsModal';

const HistoricoDetalhes = ({
  db,
  appId,
  userProfile,
  infoCidadao,
  registros,
  handleExportHistoricoCSV,
  handleExcluirCidadao,
  handleExcluirAtendimento,
  canExcluirCidadao,
  excluindo,
  getCrasNome,
  getTipoNome,
  getAtendenteNome
}) => {
  const [selectedRmaAtendimento, setSelectedRmaAtendimento] = useState(null);
  const [isRmaEditMode, setIsRmaEditMode] = useState(false);
  
  const { hasPermission } = usePermission();
  const canEditRma = hasPermission('edit_rma');
  
  // Forçar permissão de exclusão para coordenadores/superintendentes
  const isCoordenador = React.useMemo(() => {
    const role = (userProfile?.role || '').toLowerCase();
    const roleNorm = (userProfile?.roleNorm || '').toLowerCase();
    const cargo = (userProfile?.cargo || '').toLowerCase();
    
    // Lista de roles permitidos
    const allowedRoles = ['coordenador', 'coordenadora', 'superintendente', 'admin', 'master', 'super_admin'];
    
    return allowedRoles.includes(role) || 
           allowedRoles.includes(roleNorm) || 
           cargo.includes('coordenador') || 
           cargo.includes('admin') ||
           cargo.includes('superintendente');
  }, [userProfile]);

  const canDelete = canExcluirCidadao || isCoordenador;

  const getStatusLabel = (status) => {
    if (status === 'aguardando') return 'Aguardando';
    if (status === 'chamando') return 'Chamando';
    if (status === 'em_atendimento') return 'Em atendimento';
    if (status === 'finalizado') return 'Finalizado';
    if (status === 'cancelado') return 'Cancelado';
    if (status === 'ausente') return 'Ausente';
    return status || '-';
  };
  
  const getStatusClass = (status) => {
    if (status === 'finalizado') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'em_atendimento') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (status === 'chamando') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (status === 'aguardando') return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    if (status === 'ausente') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (status === 'cancelado') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <>
      {infoCidadao && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Dados do usuário</h3>
            <button
              type="button"
              onClick={handleExportHistoricoCSV}
              disabled={registros.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-green-600 rounded-lg shadow hover:bg-green-700 disabled:bg-gray-400"
            >
              <Download size={16} /> Exportar histórico CSV
            </button>
          </div>
          <p className="text-gray-700"><span className="font-semibold">Nome:</span> {infoCidadao.nome}</p>
          <p className="text-gray-700"><span className="font-semibold">CPF:</span> {maskCPF(infoCidadao.cpf)}</p>
          <p className="text-gray-700"><span className="font-semibold">Sexo:</span> {infoCidadao.sexo || '-'}</p>
          <p className="text-gray-700"><span className="font-semibold">Total de atendimentos:</span> {registros.length}</p>
          {canExcluirCidadao && (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleExcluirCidadao}
                disabled={excluindo}
                className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 disabled:bg-gray-400 text-sm"
              >
                {excluindo ? 'Excluindo...' : 'Excluir usuário'}
              </button>
            </div>
          )}
        </div>
      )}

      {registros.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Histórico de atendimentos</h3>
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Data/Hora chegada</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Unidade</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Tipo de atendimento</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Atendente</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Status</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">RMA</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Ações CadÚnico</th>
                <th className="p-2 text-left text-sm font-semibold text-gray-600">Observações</th>
                {canDelete && (
                  <th className="p-2 text-left text-sm font-semibold text-gray-600">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {registros.map(item => (
                <tr key={item.id}>
                  <td className="p-2 text-sm text-gray-700">{formatDateTime(item.hora_chegada)}</td>
                  <td className="p-2 text-sm text-gray-700">{getCrasNome(item.cras_id)}</td>
                  <td className="p-2 text-sm text-gray-700">{getTipoNome(item.tipo_atendimento_id)}</td>
                  <td className="p-2 text-sm text-gray-700">{getAtendenteNome(item.atendente_id || '')}</td>
                  <td className="p-2 text-sm text-gray-700">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${getStatusClass(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="p-2 text-sm text-gray-700">
                    {item.rma ? (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setSelectedRmaAtendimento(item);
                            setIsRmaEditMode(false);
                          }}
                          className={`flex items-center gap-1 font-medium px-2 py-1 rounded ${
                            item.rma.c_status === 'confirmado'
                              ? 'text-green-700 bg-green-50 hover:bg-green-100'
                              : 'text-purple-600 hover:bg-purple-50 hover:text-purple-800'
                          }`}
                          title={item.rma.c_status === 'confirmado' ? 'RMA Validado pelo CadÚnico' : 'RMA Pendente/Não Validado'}
                        >
                          <FileText size={16} /> 
                          {item.rma.c_status === 'confirmado' ? 'Validado' : 'Ver'}
                        </button>
                        {canEditRma && (
                          <button
                            onClick={() => {
                              setSelectedRmaAtendimento(item);
                              setIsRmaEditMode(true);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="Editar dados do RMA"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-2 text-sm text-gray-700">
                    {Array.isArray(item.cadunico_acoes) && item.cadunico_acoes.length > 0
                      ? item.cadunico_acoes
                          .map((acao) => {
                            if (acao === "consulta") return "Consulta";
                            if (acao === "inclusao") return "Inclusão";
                            if (acao === "recadastro") return "Recadastro";
                            if (acao === "transferencia") return "Transferência";
                            return acao;
                          })
                          .join(", ")
                      : "-"}
                  </td>
                  <td className="p-2 text-sm text-gray-700">
                    {item.observacoes || ""}
                    {item.cadunico_observacao
                      ? `${item.observacoes ? " " : ""}[CadÚnico] ${item.cadunico_observacao}`
                      : ""}
                  </td>
                  {canDelete && (
                    <td className="p-2 text-sm text-gray-700">
                      <button
                        onClick={() => handleExcluirAtendimento(item.id)}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded flex items-center gap-1"
                        title="Excluir este registro"
                      >
                        <Trash2 size={16} />
                        <span className="text-xs font-semibold">Excluir</span>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRmaAtendimento && (
        <RMADetailsModal 
          atendimento={selectedRmaAtendimento} 
          onClose={() => setSelectedRmaAtendimento(null)} 
          db={db}
          appId={appId}
          canEdit={canEditRma}
          initialEditMode={isRmaEditMode}
        />
      )}
    </>
  );
};

export default HistoricoDetalhes;

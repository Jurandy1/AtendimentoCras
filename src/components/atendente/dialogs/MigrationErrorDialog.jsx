import React from 'react';
import { ArrowRightLeft, XCircle } from 'lucide-react';
import Button from '../../ui/Button';
import Card from '../../ui/Card';

const MigrationErrorDialog = ({ migrationError }) => {
  if (!migrationError) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <Card className="max-w-lg w-full p-6 bg-white shadow-2xl rounded-xl border-2 border-red-100">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <XCircle size={32} />
          <h2 className="text-xl font-bold">Erro de Vínculo de Perfil</h2>
        </div>
        
        <p className="text-gray-700 mb-4">
          O sistema detectou que seu usuário está desconectado do perfil de atendente.
          A correção automática falhou devido a permissões de segurança.
        </p>

        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
          <p className="text-sm text-yellow-800 font-semibold mb-2">
            Envie este código para o Coordenador:
          </p>
          <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-300">
            <code className="flex-1 font-mono text-lg font-bold text-gray-800 select-all">
              {migrationError.uid}
            </code>
            <button 
              onClick={() => navigator.clipboard.writeText(migrationError.uid)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
              title="Copiar"
            >
               <ArrowRightLeft size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Email: {migrationError.email}
          </p>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          A administração deve usar a ferramenta <strong>Diagnóstico</strong> e colar este código no campo "Forçar UID".
        </p>

        <Button onClick={() => window.location.reload()} className="w-full">
          Tentar Novamente
        </Button>
      </Card>
    </div>
  );
};

export default MigrationErrorDialog;

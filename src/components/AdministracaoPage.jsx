import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { 
  Building, UserCog, Users, Palette, 
  Settings, UploadCloud, FileText, Activity, Trash2, Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { normalizeRole } from '../utils/helpers';

import GerenciarCRAS from './admin/GerenciarCRAS';
import GerenciarAtendentes from './admin/GerenciarAtendentes';
import GerenciarUsuarios from './admin/GerenciarUsuarios';
import GerenciarTipos from './admin/GerenciarTipos';
import ConfiguracoesAtendente from './admin/ConfiguracoesAtendente';
import ImportacaoUsuarios from './admin/ImportacaoUsuarios';
import GerenciarUsuariosBloqueados from './admin/GerenciarUsuariosBloqueados';
import GerenciarLogs from './admin/GerenciarLogs';
import SystemCleanup from './admin/SystemCleanup';

const AdministracaoPage = (initialProps) => {
  const { userProfile, db, appId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const props = {
    ...initialProps,
    userProfile: userProfile || initialProps.userProfile,
    db: db || initialProps.db,
    appId: appId || initialProps.appId
  };

  const role = props.userProfile?.roleNorm || normalizeRole(props.userProfile?.role);
  
  const tabsAll = [
    { id: 'cras', label: 'Unidades Centro Pop', icon: Building },
    { id: 'atendentes', label: 'Atendentes', icon: UserCog },
    { id: 'usuarios', label: 'Usuários cadastrados', icon: Users },
    { id: 'tipos', label: 'Tipos de Atendimento', icon: Palette },
    { id: 'config_atendente', label: 'Configurações de Atendente', icon: Settings },
    { id: 'importacao', label: 'Importação de Usuários', icon: UploadCloud },
    { id: 'bloqueados', label: 'Usuários Desligados', icon: FileText },
    { id: 'logs', label: 'Logs do Sistema', icon: Activity },
    { id: 'cleanup', label: 'Limpeza do Sistema', icon: Trash2 }
  ];
  
  const tabs = role === 'superintendente' || role === 'admin' || role === 'master' || role === 'super_admin'
    ? tabsAll
    : role === 'coordenador'
      ? tabsAll.filter(t => ['cras', 'atendentes', 'usuarios', 'tipos', 'config_atendente', 'importacao', 'bloqueados', 'logs', 'cleanup'].includes(t.id))
      : [];

  if (tabs.length === 0) {
      return (
        <div className="flex items-center justify-center min-h-[400px] text-gray-500">
          <div className="text-center">
            <Lock size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Acesso Restrito</p>
            <p className="text-sm">Você não tem permissão para acessar o painel administrativo.</p>
          </div>
        </div>
      );
  }

  const currentPath = location.pathname.split('/').pop();
  const currentTab = tabs.find(t => t.id === currentPath) || tabs[0];
  const navigateToTab = (tabId) => {
    navigate(`/administracao/${tabId}`);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="p-5 md:p-8 border-b border-gray-100 bg-white">
         <div className="flex items-center gap-3">
           <div className={`p-3 rounded-lg bg-blue-50 text-blue-600`}>
              {currentTab?.icon && React.createElement(currentTab.icon, { size: 28 })}
           </div>
           <div>
             <h3 className="text-xl md:text-2xl font-bold text-gray-800">
               {currentTab?.label}
             </h3>
             <p className="text-sm text-gray-500">Gerencie as configurações desta seção</p>
           </div>
         </div>
      </div>
      
      <main className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px]">
          <Routes>
            <Route index element={<Navigate to="cras" replace />} />
            <Route path="cras" element={<GerenciarCRAS {...props} />} />
            <Route path="atendentes" element={<GerenciarAtendentes {...props} navigateToTab={navigateToTab} />} />
            <Route path="usuarios" element={<GerenciarUsuarios {...props} />} />
            <Route path="tipos" element={<GerenciarTipos {...props} />} />
            <Route path="config_atendente" element={<ConfiguracoesAtendente {...props} />} />
            <Route path="importacao" element={<ImportacaoUsuarios {...props} />} />
            <Route path="bloqueados" element={<GerenciarUsuariosBloqueados {...props} />} />
            <Route path="logs" element={<GerenciarLogs {...props} />} />
            <Route path="cleanup" element={<SystemCleanup {...props} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default AdministracaoPage;

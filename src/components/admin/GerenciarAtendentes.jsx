import React from 'react';
import { 
  UserCog, Lock, UploadCloud, Plus, Eye, EyeOff, Edit, Trash2, AlertTriangle, Shield, RefreshCw, Crown, X, ShieldCheck
} from 'lucide-react';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useGerenciarAtendentes } from '../../hooks/useGerenciarAtendentes';
import { getFriendlyFirebaseError } from '../../utils';
 
const GerenciarAtendentes = ({ db, appId, crasUnidades, tiposAtendimento, atendentesList, userProfile, navigateToTab }) => {
  const {
    loading,
    formData,
    editingId,
    showModal,
    showPassword,
    cargos,
    salas,
    showDiagnostico,
    diagEmail,
    diagResult,
    forceUid,
    listFiltered,
    setShowModal,
    setShowPassword,
    setShowDiagnostico,
    setDiagEmail,
    setForceUid,
    handleChange,
    handleTipoToggle,
    handleSalaToggle,
    resetForm,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleReabrirExpediente,
    handleImportarLista,
    handleRegularizarAntigos,
    handleForceUid,
    handleDiagnostico,
    handleFixAuthSync,
    getTipoNome,
    getTipoCor,
    getCrasNome,
    resetPassword,
    handleFixTypes,
    handleCorrigirVinculosAtendentes,
    refreshUserProfile,
    limparAtendentesProblematicos,
    handleResetarStatus,
    handlePromoverASuperCoordenador
  } = useGerenciarAtendentes({  
    db, 
    appId, 
    crasUnidades, 
    tiposAtendimento, 
    atendentesList, 
    userProfile 
  });

  const [atendimentosAtivosByAtendenteId, setAtendimentosAtivosByAtendenteId] = React.useState(new Map());
  const [showPromoverModal, setShowPromoverModal] = React.useState(false);
  const [selectedCoordenadorId, setSelectedCoordenadorId] = React.useState('');
  const [promovendo, setPromovendo] = React.useState(false);

  React.useEffect(() => {
    if (!db || !appId) {
      setAtendimentosAtivosByAtendenteId(new Map());
      return;
    }

    const q = query(
      collection(db, `artifacts/${appId}/public/data/atendimentos`),
      where("status", "in", ["chamando", "em_atendimento"])
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next = new Map();
        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const atendenteId = data.atendente_id || null;
          if (atendenteId) {
            next.set(String(atendenteId), { id: docSnap.id, status: data.status || null });
          }
        });
        setAtendimentosAtivosByAtendenteId(next);
      },
      () => setAtendimentosAtivosByAtendenteId(new Map())
    );

    return () => unsubscribe();
  }, [db, appId]);

  const podePromover = React.useMemo(() => {
    const role = String(userProfile?.role || userProfile?.roleNorm || userProfile?.cargo || '').toLowerCase();
    return ['master', 'superintendente', 'super_admin', 'admin', 'coordenador'].includes(role);
  }, [userProfile]);

  const coordenadoresCentro = React.useMemo(() => {
    if (!listFiltered || !crasUnidades) return [];

    const centroPop = crasUnidades.find(u => {
      const nome = String(u?.nome || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return nome.includes('centro') && nome.includes('pop')
        && !nome.includes('cohab') && !nome.includes('anil');
    });
    if (!centroPop) return [];

    return listFiltered.filter(a => {
      const role = String(a?.role || a?.roleNorm || '').toLowerCase();
      return role === 'coordenador' && String(a?.cras_id || '') === String(centroPop.id || '');
    });
  }, [listFiltered, crasUnidades]);

  const confirmarPromocao = async () => {
    if (!selectedCoordenadorId) {
      alert('Selecione um coordenador antes de confirmar.');
      return;
    }
    const alvo = coordenadoresCentro.find(c => c.id === selectedCoordenadorId);
    if (!alvo) return;

    setPromovendo(true);
    const ok = await handlePromoverASuperCoordenador(alvo);
    setPromovendo(false);
    if (ok) {
      setShowPromoverModal(false);
      setSelectedCoordenadorId('');
    }
  };

  const getAtendenteStatusLabel = React.useCallback(
    (a) => {
      const status = a?.status || "offline";
      const encField = a?.expedienteEncerradoEm;

      if (encField && encField.toDate) {
        const liberacao = new Date(encField.toDate());
        liberacao.setDate(liberacao.getDate() + 1);
        liberacao.setHours(8, 0, 0, 0);
        if (new Date() < liberacao) return "Encerrado até amanhã 08h";
      }

      if (a?.id && atendimentosAtivosByAtendenteId.has(String(a.id))) {
        return "Em atendimento";
      }

      if (status === "pausa") return "Pausado";
      if (status === "online") return "Online";
      return "Offline";
    },
    [atendimentosAtivosByAtendenteId]
  );

  const getAtendenteStatusClass = React.useCallback(
    (a) => {
      const label = getAtendenteStatusLabel(a);
      if (label === "Em atendimento") return "bg-purple-100 text-purple-700";
      if (label === "Online") return "bg-green-100 text-green-700";
      if (label === "Pausado") return "bg-yellow-100 text-yellow-700";
      if (label.startsWith("Encerrado")) return "bg-red-100 text-red-700";
      return "bg-gray-100 text-gray-700";
    },
    [getAtendenteStatusLabel]
  );
 
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold">Gerenciar Atendentes</h3>
        <div className="flex gap-2">
          {navigateToTab && (
             <button onClick={() => navigateToTab('config_atendente')} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors" title="Definir permissões por cargo">
               <Shield size={18} className="mr-2" /> Cargos e Permissões
             </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!podePromover) {
                alert('Acesso restrito: apenas master/superintendente/admin/super_admin pode promover.');
                return;
              }
              setShowPromoverModal(true);
            }}
            disabled={!podePromover}
            className={`flex items-center px-4 py-2 rounded-lg shadow transition-colors ${
              podePromover
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            title={
              podePromover
                ? 'Promover um coordenador do Centro Pop Centro a Super Coordenador'
                : 'Sem permissão para promover'
            }
          >
            <Crown size={18} className="mr-2" /> Promover Super Coordenador
          </button>
          <button onClick={() => setShowDiagnostico(true)} className="flex items-center bg-slate-700 text-white px-4 py-2 rounded-lg shadow hover:bg-slate-800 transition-colors" title="Diagnóstico e manutenção de vínculos">
            <UserCog size={18} className="mr-2" /> Diagnóstico
          </button>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors">
            <Plus size={18} className="mr-2" /> Novo Atendente
          </button>
          <button onClick={() => limparAtendentesProblematicos()} className="flex items-center bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition-colors" title="Remove atendentes com dados incompletos">
            <Trash2 size={18} className="mr-2" /> Limpar Problemáticos
          </button>
        </div>
      </div>
 
      {showDiagnostico && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-4">
               <h4 className="text-xl font-semibold flex items-center gap-2"><UserCog size={24} /> Diagnóstico de Usuários</h4>
               <button onClick={() => setShowDiagnostico(false)} className="text-gray-500 hover:text-gray-700">X</button>
             </div>
             
             <div className="mb-6">
               <p className="text-sm text-gray-600 mb-2">Verifique se um e-mail já está cadastrado no sistema (Auth, Users ou Lista de Atendentes) e corrija inconsistências.</p>
               <div className="flex gap-2">
                 <input 
                   type="email" 
                   value={diagEmail} 
                   onChange={(e) => setDiagEmail(e.target.value)} 
                   placeholder="Digite o e-mail para verificar..." 
                   className="flex-1 p-2 border rounded"
                 />
                 <button 
                   onClick={handleDiagnostico} 
                   disabled={loading || !diagEmail}
                   className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                 >
                   {loading ? 'Verificando...' : 'Verificar'}
                 </button>
               </div>
             </div>
 
             {diagResult && (
               <div className="space-y-4 border-t pt-4">
                 <h5 className="font-semibold text-lg">Resultados para: <span className="text-blue-600">{diagResult.email}</span></h5>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className={`p-3 rounded border ${diagResult.authExists ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                     <strong>Autenticação (Login):</strong>
                     <p>{diagResult.authStatus}</p>
                   </div>
                   
                   <div className={`p-3 rounded border ${diagResult.naLista ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                     <strong>Lista de Atendentes:</strong>
                     {diagResult.naLista ? (
                       <div>
                         <p className="text-green-700 font-semibold">Encontrado ({diagResult.naLista.length} registro(s))</p>
                         <ul className="text-xs mt-1 list-disc pl-4">
                           {diagResult.naLista.map(a => <li key={a.id}>Nome: {a.nome} (ID: {a.id})</li>)}
                         </ul>
                       </div>
                     ) : (
                       <p className="text-yellow-700">Não encontrado na lista visível.</p>
                     )}
                   </div>
 
                   <div className={`p-3 rounded border ${diagResult.noUsers ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                     <strong>Perfil Interno (Users):</strong>
                     {diagResult.noUsers ? (
                       <div>
                         <p className="text-green-700 font-semibold">Encontrado</p>
                         <ul className="text-xs mt-1 list-disc pl-4">
                           {diagResult.noUsers.map(u => <li key={u.id}>ID (UID): {u.id} | Role: {u.role}</li>)}
                         </ul>
                       </div>
                     ) : (
                       <p className="text-gray-600">Não encontrado.</p>
                     )}
                   </div>
                 </div>
 
                 <div className="mt-4 p-4 bg-gray-50 rounded border">
                   <h6 className="font-semibold mb-2">Ações Recomendadas:</h6>
                   {diagResult.authExists && !diagResult.naLista && diagResult.noUsers ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">O usuário existe no sistema (Auth e Users) mas sumiu da lista de atendentes.</span>
                        <button onClick={handleFixAuthSync} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm">
                          Restaurar para Lista
                        </button>
                      </div>
                   ) : diagResult.authExists && !diagResult.naLista && !diagResult.noUsers ? (
                      <div className="text-sm text-red-600">
                        O e-mail existe no Auth mas não tem perfil nenhum. <br/>
                        <strong>Solução:</strong> Use o botão "Novo Atendente" e cadastre novamente usando ESSE MESMO E-MAIL e a SENHA CORRETA. O sistema irá recuperar o vínculo automaticamente.
                      </div>
                   ) : diagResult.naLista ? (
                      <div className="text-sm text-green-700">Tudo parece correto. O usuário já está na lista.</div>
                   ) : (
                      <div className="text-sm text-gray-600">Nenhum conflito grave encontrado. Pode cadastrar normalmente.</div>
                   )}
                 </div>
 
                 <div className="mt-6 p-4 bg-red-50 rounded border border-red-200">
                    <h6 className="font-bold text-red-800 mb-2 flex items-center gap-2">
                        <AlertTriangle size={16} /> Corrigir Vínculo Manualmente (Forçar UID)
                    </h6>
                    <p className="text-xs text-red-700 mb-3">
                        Use esta opção se o atendente ver a tela de "Erro de Vínculo de Perfil". Copie o código exibido na tela dele e cole abaixo.
                    </p>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={forceUid}
                            onChange={(e) => setForceUid(e.target.value)}
                            placeholder="Cole o UID aqui (Ex: 7s8d6f87s6df...)"
                            className="flex-1 p-2 border rounded border-red-300 font-mono text-sm"
                        />
                        <button 
                            onClick={handleForceUid}
                            disabled={!forceUid || loading}
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 font-semibold text-sm"
                        >
                            Corrigir Agora
                        </button>
                    </div>
                 </div>
 
               </div>
             )}
 
             <div className="mt-6 border-t pt-4">
                <h5 className="font-semibold text-lg mb-2 flex items-center gap-2"><AlertTriangle size={20} className="text-orange-500"/> Manutenção do Sistema</h5>
                <div className="p-4 bg-orange-50 rounded border border-orange-200">
                    <h6 className="font-bold text-orange-800 mb-2">Tipos de Atendimento</h6>
                    <p className="text-sm text-orange-700 mb-3">
                        Detectar e remover duplicatas, restaurar padrões: CadÚnico, Psicólogo e Serviços do Dia.
                    </p>
                    <button 
                        onClick={handleFixTypes}
                        className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 font-semibold text-sm w-full md:w-auto"
                    >
                        Verificar e Corrigir Tipos
                    </button>
                 </div>
                 <div className="p-4 bg-blue-50 rounded border border-blue-200 mt-4">
                    <h6 className="font-bold text-blue-800 mb-2">Vínculos de Atendentes</h6>
                    <p className="text-sm text-blue-700 mb-3">
                      Corrige atendentes antigos que foram salvos como “perfil fantasma” e remove duplicados por e-mail.
                    </p>
                    <button
                      onClick={handleCorrigirVinculosAtendentes}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold text-sm w-full md:w-auto"
                    >
                      Corrigir Vínculos (UID)
                    </button>
                 </div>
             </div>
          </div>
        </div>
      )}
 
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h4 className="text-xl font-semibold mb-4">{editingId ? 'Editar Atendente' : 'Novo Atendente'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input name="nome" value={formData.nome} onChange={handleChange} placeholder="Nome Completo" required className="w-full p-2 border rounded-lg" />
              <input name="matricula" value={formData.matricula} onChange={handleChange} placeholder="Matrícula (Opcional)" className="w-full p-2 border rounded-lg uppercase" />
              <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Email" required className="w-full p-2 border rounded-lg" />
              <select name="cargo" value={formData.cargo} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white">
                <option value="">Selecione o Cargo</option>
                {cargos.map(c => (<option key={c.id} value={c.nome}>{c.nome}</option>))}
              </select>
              <select name="role" value={formData.role || 'atendente'} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white border-blue-300">
                <option value="atendente">Perfil: Atendente (Padrão)</option>
                <option value="recepcionista">Perfil: Recepcionista (Apenas Recepção)</option>
                <option value="coordenador">Perfil: Coordenador (Acesso Total)</option>
                {podePromover && (
                  <option value="super_admin">⭐ Super Coordenador (todas as unidades)</option>
                )}
              </select>
              {!editingId && (
                <div className="relative">
                  <input name="senha" type={showPassword ? 'text' : 'password'} value={formData.senha} onChange={handleChange} placeholder="Senha inicial" required className="w-full p-2 border rounded-lg pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}
              <select
                name="cras_id"
                value={formData.cras_id}
                onChange={handleChange}
                required={String(formData.role || '').toLowerCase() !== 'super_admin'}
                className="w-full p-2 border rounded-lg bg-white"
              >
                <option value="">
                  {String(formData.role || '').toLowerCase() === 'super_admin'
                    ? 'Todas as unidades (sem unidade padrão)'
                    : 'Selecione a Unidade'}
                </option>
                {crasUnidades.map(cras => (<option key={cras.id} value={cras.id}>{cras.nome}</option>))}
              </select>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Salas Permitidas:</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border p-2 rounded-lg">
                  {salas.map(s => (
                    <label key={s.id} className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={(formData.salas_permitidas || []).includes(s.id)} onChange={() => handleSalaToggle(s.id)} className="rounded" />
                      <span className="text-sm">{s.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipos de Atendimento:</label>
                <p className="text-xs text-gray-500 mb-2">
                  Marque “Serviços do Dia” para liberar o menu “Serviços do Dia” para este servidor.
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto border p-2 rounded-lg">
                  {tiposAtendimento.map(tipo => (
                    <label key={tipo.id} className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={formData.tipos_atende.includes(tipo.id)} onChange={() => handleTipoToggle(tipo.id)} className="rounded" />
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getTipoCor(tipo.id), color: '#fff' }}>{getTipoNome(tipo.id)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPromoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <Crown size={22} />
                <h3 className="text-lg font-bold">Promover Super Coordenador</h3>
              </div>
              <button
                onClick={() => { setShowPromoverModal(false); setSelectedCoordenadorId(''); }}
                className="text-white/80 hover:text-white"
                disabled={promovendo}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                <p className="font-bold mb-1">⭐ O que é um Super Coordenador?</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Acesso a TODAS as unidades do sistema</li>
                  <li>Vê atendentes, fichas e relatórios de qualquer unidade</li>
                  <li>O campo "unidade" dele fica vazio (sem vínculo específico)</li>
                </ul>
              </div>

              <p className="text-sm font-bold text-gray-700 mb-3">
                Escolha UM coordenador do Centro Pop Centro:
              </p>

              {coordenadoresCentro.length === 0 ? (
                <div className="text-center py-6 px-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-medium">
                    Nenhum coordenador do Centro Pop Centro foi encontrado.
                  </p>
                  <p className="text-xs text-yellow-700 mt-2">
                    Para promover alguém, primeiro cadastre um atendente com perfil "Coordenador" vinculado ao Centro Pop Centro.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {coordenadoresCentro.map(coord => (
                    <label
                      key={coord.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedCoordenadorId === coord.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="coordenador_alvo"
                        value={coord.id}
                        checked={selectedCoordenadorId === coord.id}
                        onChange={(e) => setSelectedCoordenadorId(e.target.value)}
                        disabled={promovendo}
                        className="w-4 h-4 text-purple-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">
                          {coord.nome || '(sem nome)'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {coord.email || '(sem email)'}
                        </p>
                      </div>
                      {selectedCoordenadorId === coord.id && (
                        <ShieldCheck size={18} className="text-purple-600 shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => { setShowPromoverModal(false); setSelectedCoordenadorId(''); }}
                  disabled={promovendo}
                  className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarPromocao}
                  disabled={!selectedCoordenadorId || promovendo || coordenadoresCentro.length === 0}
                  className="flex-1 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {promovendo ? 'Promovendo...' : (
                    <>
                      <Crown size={16} />
                      Confirmar Promoção
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
 
      {/* Mobile View (Cards) */}
      <div className="md:hidden space-y-4">
        {listFiltered.map(a => (
          <div key={a.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-bold text-gray-800">{a.nome}</h4>
                <p className="text-sm text-gray-500">{a.email}</p>
                {a.matricula && <p className="text-xs text-blue-600 font-medium">Mat: {a.matricula}</p>}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${getAtendenteStatusClass(a)}`}>
                {getAtendenteStatusLabel(a)}
              </span>
            </div>
            
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <div className="flex justify-between">
                <span className="font-medium">Cargo:</span>
                <span>{a.cargo || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Unidade:</span>
                <span>{getCrasNome(a.cras_id)}</span>
              </div>
              
            </div>
 
            <div className="flex justify-end gap-3 border-t pt-3">
               {(a.status === 'pausa' || a.status === 'online') && !atendimentosAtivosByAtendenteId.has(String(a.id)) && (
                  <button
                    onClick={() => {
                      if (!window.confirm(`Resetar o status de "${a.nome}" para Offline?\n\nUse isso se o atendente estiver preso em "Pausa" e não conseguir retomar o atendimento.`)) return;
                      handleResetarStatus(a.id, a.nome);
                    }}
                    className="p-2 text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100"
                    title="Resetar Status (tirar da pausa forçadamente)"
                  >
                    <RefreshCw size={18} />
                  </button>
                )}
               <button 
                  onClick={async () => {
                    if(!window.confirm(`Deseja enviar um e-mail para ${a.nome} redefinir a senha?\n\nO usuário receberá um link no e-mail ${a.email} para criar uma nova senha.`)) return;
                    try {
                        await resetPassword(a.email);
                        alert(`E-mail de redefinição enviado para ${a.email}.`);
                    } catch (err) {
                        console.error(err);
                        alert(getFriendlyFirebaseError(err, 'Erro ao enviar e-mail.'));
                    }
                  }} 
                  className="p-2 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100" 
                  title="Enviar E-mail de Redefinição de Senha"
                >
                    <Lock size={18} />
                </button>
                <button onClick={() => handleEdit(a)} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDelete(a.id)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                  <Trash2 size={18} />
                </button>
            </div>
          </div>
        ))}
      </div>
 
      {/* Desktop View (Table) */}
      <div className="hidden md:block bg-white shadow rounded-lg overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Nome</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Cargo</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Unidade</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Sala</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Tipos</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Expediente</th>
              <th className="p-3 text-left text-sm font-semibold text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {listFiltered.map(a => (
              <tr key={a.id}>
                <td className="p-3">
                  <div>{a.nome}</div>
                  <div className="text-xs text-gray-500">{a.email}</div>
                  {a.matricula && <div className="text-xs text-blue-600 font-medium">Mat: {a.matricula}</div>}
                </td>
                <td className="p-3">{a.cargo || '-'}</td>
                <td className="p-3">{getCrasNome(a.cras_id)}</td>
                <td className="p-3">{a.salas_permitidas && a.salas_permitidas.length > 0 ? a.salas_permitidas.map(sid => salas.find(s => s.id === sid)?.nome).filter(Boolean).join(', ') : (salas.find(s => s.id === a.sala_id)?.nome || '-')}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{(a.tipos_atende || []).map(id => (<span key={id} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getTipoCor(id), color: '#fff' }}>{getTipoNome(id)}</span>))}</div></td>
                <td className="p-3">
                  {(() => {
                    const encField = a.expedienteEncerradoEm;
                    let bloqueado = false;
                    if (encField && encField.toDate) {
                      const liberacao = new Date(encField.toDate());
                      liberacao.setDate(liberacao.getDate() + 1);
                      liberacao.setHours(8, 0, 0, 0);
                      if (new Date() < liberacao) bloqueado = true;
                    }

                    const label = getAtendenteStatusLabel(a);

                    return (
                      <div className="flex flex-col space-y-1">
                        <span className={bloqueado ? "text-red-600 font-semibold" : "text-gray-700"}>
                          {label}
                        </span>
                        {bloqueado && (
                          <button
                            onClick={() => handleReabrirExpediente(a.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Reabrir para hoje
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td className="p-3">
                  <div className="flex space-x-2">
                    {(a.status === 'pausa' || a.status === 'online') && !atendimentosAtivosByAtendenteId.has(String(a.id)) && (
                      <button
                        onClick={() => {
                          if (!window.confirm(`Resetar o status de "${a.nome}" para Offline?\n\nUse isso se o atendente estiver preso em "Pausa" e não conseguir retomar o atendimento.`)) return;
                          handleResetarStatus(a.id, a.nome);
                        }}
                        className="text-orange-500 hover:text-orange-700"
                        title={`Resetar Status (${a.status === 'pausa' ? 'preso em Pausa' : 'forçar Offline'})`}
                      >
                        <RefreshCw size={18} />
                      </button>
                    )}
                    <button 
                      onClick={async () => {
                        if(!window.confirm(`Deseja enviar um e-mail para ${a.nome} redefinir a senha?\n\nO usuário receberá um link no e-mail ${a.email} para criar uma nova senha.`)) return;
                        try {
                            await resetPassword(a.email);
                            alert(`E-mail de redefinição enviado para ${a.email}.`);
                        } catch (err) {
                            console.error(err);
                            alert(getFriendlyFirebaseError(err, 'Erro ao enviar e-mail.'));
                        }
                      }} 
                      className="text-amber-600 hover:text-amber-800" 
                      title="Enviar E-mail de Redefinição de Senha"
                    >
                        <Lock size={18} />
                    </button>
                    <button onClick={() => handleEdit(a)} className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
 
export default GerenciarAtendentes;

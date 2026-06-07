import React, { useState } from 'react';
import { Trash2, Shield, X, Save, AlertTriangle, CheckCircle2, Wand2, AlertCircle } from 'lucide-react';
import { useConfiguracoesAtendente, PERMISSIONS_LIST } from '../../hooks/useConfiguracoesAtendente';

const ConfiguracoesAtendente = ({ db, appId, userProfile }) => {
  const {
    cargos,
    salas,
    novoCargo,
    novaSala,
    salvandoCargo,
    salvandoSala,
    setNovoCargo,
    setNovaSala,
    handleAddCargo,
    handleAddSala,
    handleDeleteCargo,
    handleDeleteSala,
    handlePadronizarCargos,
    handleLiberarChamando,
    handleUpdateCargoPermissions
  } = useConfiguracoesAtendente({ db, appId, userProfile });

  const [editingPermissions, setEditingPermissions] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', msg: string }
  const [confirmAction, setConfirmAction] = useState(null); // { title, message, onConfirm, danger }
  const [permFilter, setPermFilter] = useState('');

  // Toast feedback (some sozinho após 4s)
  React.useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const openPermissionsModal = (cargo) => {
    setEditingPermissions({
      id: cargo.id,
      nome: cargo.nome,
      permissions: cargo.permissions || []
    });
    setPermFilter('');
  };

  const togglePermission = (permId) => {
    if (!editingPermissions) return;
    setEditingPermissions(prev => {
      const exists = prev.permissions.includes(permId);
      return {
        ...prev,
        permissions: exists ? prev.permissions.filter(p => p !== permId) : [...prev.permissions, permId]
      };
    });
  };

  const savePermissions = async () => {
    if (!editingPermissions) return;
    try {
      await handleUpdateCargoPermissions(editingPermissions.id, editingPermissions.permissions);
      setFeedback({ type: 'success', msg: `Permissões de "${editingPermissions.nome}" atualizadas.` });
      setEditingPermissions(null);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', msg: 'Erro ao salvar permissões. Tente novamente.' });
    }
  };

  // ──────────────────────────────────────────────────────────────────
  // Ações perigosas — agora com confirmação
  // ──────────────────────────────────────────────────────────────────
  const askConfirmPadronizar = () => {
    setConfirmAction({
      title: 'Padronizar Cargos',
      message: 'Esta ação vai unificar variações de cargos (Coordenador/Coordenadora, Assistente/Assistenta etc.) em uma única forma padrão. Atendentes existentes serão atualizados em massa. Deseja continuar?',
      danger: false,
      icon: Wand2,
      confirmLabel: 'Padronizar',
      onConfirm: async () => {
        try {
          await handlePadronizarCargos();
          setFeedback({ type: 'success', msg: 'Cargos padronizados com sucesso.' });
        } catch (err) {
          console.error(err);
          setFeedback({ type: 'error', msg: 'Erro ao padronizar cargos.' });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  const askConfirmLiberar = () => {
    setConfirmAction({
      title: 'Liberar Atendimentos Presos',
      message: 'Esta ação irá DEVOLVER para a fila TODOS os atendimentos que estão travados no status "Chamando" há mais de tempo razoável. Use APENAS se notou que a fila travou. A operação não pode ser desfeita. Deseja continuar?',
      danger: true,
      icon: AlertTriangle,
      confirmLabel: 'Sim, liberar',
      onConfirm: async () => {
        try {
          await handleLiberarChamando();
          setFeedback({ type: 'success', msg: 'Atendimentos travados foram liberados de volta para a fila.' });
        } catch (err) {
          console.error(err);
          setFeedback({ type: 'error', msg: 'Erro ao liberar atendimentos.' });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  const askConfirmDeleteCargo = (cargo) => {
    setConfirmAction({
      title: 'Excluir Cargo',
      message: `Tem certeza que deseja excluir o cargo "${cargo.nome}"? Atendentes que possuem esse cargo continuarão registrados, mas o cargo deixará de existir como opção.`,
      danger: true,
      icon: Trash2,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        try {
          await handleDeleteCargo(cargo.id);
          setFeedback({ type: 'success', msg: `Cargo "${cargo.nome}" excluído.` });
        } catch (err) {
          setFeedback({ type: 'error', msg: 'Erro ao excluir cargo.' });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  const askConfirmDeleteSala = (sala) => {
    setConfirmAction({
      title: 'Excluir Sala',
      message: `Tem certeza que deseja excluir a sala "${sala.nome}"?`,
      danger: true,
      icon: Trash2,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        try {
          await handleDeleteSala(sala.id);
          setFeedback({ type: 'success', msg: `Sala "${sala.nome}" excluída.` });
        } catch (err) {
          setFeedback({ type: 'error', msg: 'Erro ao excluir sala.' });
        } finally {
          setConfirmAction(null);
        }
      }
    });
  };

  const filteredPermissions = permFilter
    ? PERMISSIONS_LIST.filter(p =>
        (p.label || '').toLowerCase().includes(permFilter.toLowerCase()) ||
        (p.id || '').toLowerCase().includes(permFilter.toLowerCase())
      )
    : PERMISSIONS_LIST;

  return (
    <>
      {/* Toast de feedback */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border animate-fadeIn ${
          feedback.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.type === 'success'
            ? <CheckCircle2 size={18} className="text-green-600" />
            : <AlertCircle size={18} className="text-red-600" />}
          <span className="text-sm font-medium">{feedback.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
        {/* CARGOS */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Cargos de Atendente</h3>
            <button
              onClick={askConfirmPadronizar}
              disabled={salvandoCargo}
              className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50 flex items-center gap-1"
              title="Unificar variações de cargos (ex: Coordenador/Coordenadora)"
            >
              <Wand2 size={14} />
              Padronizar
            </button>
          </div>
          <form onSubmit={handleAddCargo} className="flex space-x-2 mb-4">
            <input
              value={novoCargo}
              onChange={e => setNovoCargo(e.target.value)}
              placeholder="Ex: Psicólogo"
              className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              type="submit"
              disabled={salvandoCargo || !novoCargo.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {salvandoCargo ? '...' : 'Adicionar'}
            </button>
          </form>
          <div className="border rounded-lg max-h-72 overflow-y-auto">
            {cargos.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">Nenhum cargo cadastrado.</div>
            ) : (
              <ul>
                {cargos.map(c => (
                  <li key={c.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-800">{c.nome}</span>
                      {Array.isArray(c.permissions) && c.permissions.length > 0 && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                          {c.permissions.length} permissão{c.permissions.length > 1 ? 'ões' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => openPermissionsModal(c)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Editar Permissões"
                      >
                        <Shield size={16} />
                      </button>
                      <button
                        onClick={() => askConfirmDeleteCargo(c)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Excluir cargo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* SALAS */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">Salas de Atendimento</h3>
          <form onSubmit={handleAddSala} className="flex space-x-2 mb-4">
            <input
              value={novaSala}
              onChange={e => setNovaSala(e.target.value)}
              placeholder="Ex: Sala 1"
              className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              type="submit"
              disabled={salvandoSala || !novaSala.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {salvandoSala ? '...' : 'Adicionar'}
            </button>
          </form>
          <div className="border rounded-lg max-h-72 overflow-y-auto">
            {salas.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">Nenhuma sala cadastrada.</div>
            ) : (
              <ul>
                {salas.map(s => (
                  <li key={s.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                    <span className="text-gray-800">{s.nome}</span>
                    <button
                      onClick={() => askConfirmDeleteSala(s)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                      title="Excluir sala"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* MANUTENÇÃO DE EMERGÊNCIA */}
        <div className="bg-white p-6 rounded-lg shadow col-span-1 lg:col-span-2 mt-6 border-2 border-red-100">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-red-600" />
            <h3 className="text-xl font-semibold text-red-700">Manutenção de Emergência</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Use estas opções APENAS se notar que a fila travou ou existem atendimentos presos.
            Toda ação aqui exige confirmação explícita e <strong>não pode ser desfeita</strong>.
          </p>
          <button
            onClick={askConfirmLiberar}
            className="bg-red-100 text-red-800 px-4 py-2 rounded-lg border border-red-300 hover:bg-red-200 transition-colors flex items-center gap-2 font-medium"
          >
            <AlertTriangle size={16} />
            Liberar Atendimentos Presos em "Chamando"
          </button>
        </div>
      </div>

      {/* MODAL DE PERMISSÕES */}
      {editingPermissions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div>
                <h4 className="text-lg font-bold">Permissões: {editingPermissions.nome}</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingPermissions.permissions.length} de {PERMISSIONS_LIST.length} ativas
                </p>
              </div>
              <button onClick={() => setEditingPermissions(null)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            {/* Filtro de permissões */}
            {PERMISSIONS_LIST.length > 6 && (
              <input
                type="text"
                placeholder="Filtrar permissões..."
                value={permFilter}
                onChange={(e) => setPermFilter(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm mb-3 shrink-0"
              />
            )}

            <div className="space-y-1 mb-4 overflow-y-auto flex-1">
              {filteredPermissions.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-4">Nenhuma permissão encontrada.</div>
              ) : (
                filteredPermissions.map(perm => (
                  <label
                    key={perm.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer border border-transparent hover:border-gray-200"
                  >
                    <input
                      type="checkbox"
                      checked={editingPermissions.permissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 flex-1">{perm.label}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2 shrink-0 pt-3 border-t">
              <button
                onClick={() => setEditingPermissions(null)}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={savePermissions}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Save size={16} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO GENÉRICO (substitui window.confirm) */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="text-center mb-5">
              <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                confirmAction.danger ? 'bg-red-100' : 'bg-indigo-100'
              }`}>
                {confirmAction.icon ? (
                  React.createElement(confirmAction.icon, {
                    size: 28,
                    className: confirmAction.danger ? 'text-red-600' : 'text-indigo-600'
                  })
                ) : (
                  <AlertTriangle size={28} className={confirmAction.danger ? 'text-red-600' : 'text-indigo-600'} />
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900">{confirmAction.title}</h3>
              <p className="text-gray-600 text-sm mt-2">{confirmAction.message}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className={`flex-1 px-4 py-2.5 text-white rounded-lg font-bold shadow-md transition-colors ${
                  confirmAction.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {confirmAction.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConfiguracoesAtendente;

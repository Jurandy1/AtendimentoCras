import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { User, Save, AlertCircle, CheckCircle, CreditCard } from 'lucide-react';
import { logAdminAction } from '../utils/logger';
import { getFriendlyFirebaseError } from '../utils';

const PerfilPage = () => {
  const { user, userProfile, db, appId, profileChecked, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    nome: '',
    matricula: '',
    email: '',
    cargo: ''
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        nome: userProfile.nome || '',
        matricula: userProfile.matricula || '',
        email: userProfile.email || '',
        cargo: userProfile.cargo || ''
      });
    }
  }, [userProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Limpa mensagens ao digitar
    if (success) setSuccess(false);
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !db || !userProfile?.id) return;
    
    setLoading(true);
    setSuccess(false);
    setError('');

    try {
      const nomeLimpo = formData.nome.trim();
      const matriculaLimpa = formData.matricula.trim();

      if (nomeLimpo.length < 3) {
        throw new Error("O nome deve ter pelo menos 3 caracteres.");
      }

      // Identificar coleção correta (atendentes ou users)
      // O userProfile geralmente vem de 'atendentes' ou 'users'
      // Vamos tentar encontrar onde o documento está
      
      const collectionsToCheck = ['atendentes', 'users'];
      let targetCollection = null;
      let targetDocId = userProfile.id;

      // Se já soubermos de onde veio (alguns sistemas salvam 'source' no profile), ótimo.
      // Se não, tentamos update direto na coleção que faz sentido.
      // Geralmente o ID do userProfile é o ID do documento.
      
      // Tentativa 1: Tentar atualizar na coleção 'atendentes' se o ID bater
      // Para garantir, vamos checar qual coleção tem esse ID.
      // Mas como não podemos ler tudo, vamos tentar update direto se soubermos a origem.
      // O AuthContext faz uma busca. Vamos assumir 'atendentes' primeiro, que é o padrão do sistema novo.
      
      // Update data
      const updateData = {
        nome: nomeLimpo,
        matricula: matriculaLimpa,
        updatedAt: new Date()
      };

      // Tentar descobrir coleção de origem pelo AuthContext logic ou tentativa e erro
      // O AuthContext busca em 'users' (por email) e 'atendentes' (por email ou uid)
      // Vamos tentar encontrar o doc pelo ID em 'atendentes'
      
      let docRef = doc(db, `artifacts/${appId}/public/data/atendentes`, targetDocId);
      
      // Tentar update. Se falhar (ex: doc não existe), tentar 'users'
      // O Firestore updateDoc falha se o doc não existe? Sim.
      
      try {
        await updateDoc(docRef, updateData);
        targetCollection = 'atendentes';
      } catch (err) {
        // Se falhar, tenta users
        console.warn("Update em atendentes falhou, tentando users...", err);
        docRef = doc(db, `artifacts/${appId}/public/data/users`, targetDocId);
        await updateDoc(docRef, updateData);
        targetCollection = 'users';
      }

      await logAdminAction(
        db, appId, 
        { ...userProfile, uid: user.uid, email: user.email, name: nomeLimpo }, 
        "UPDATE_OWN_PROFILE", 
        "Usuário atualizou o próprio perfil", 
        { nome: nomeLimpo, matricula: matriculaLimpa, collection: targetCollection }
      );

      setSuccess(true);
      
      // Forçar atualização do perfil no contexto
      if (refreshUserProfile) {
        await refreshUserProfile();
      }
      
    } catch (err) {
      console.error("Erro ao atualizar perfil:", err);
      setError(getFriendlyFirebaseError(err, "Erro ao atualizar perfil."));
    } finally {
      setLoading(false);
    }
  };

  if (!profileChecked) return <div className="p-8 text-center">Carregando...</div>;

  const formatCargo = (cargo) => {
    if (!cargo) return "";
    return cargo.replace(/Coordenadora/gi, "Coordenador");
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <User className="text-blue-600" size={32} />
          Meu Perfil
        </h1>
        <p className="text-gray-500 mt-2">
          Mantenha seus dados atualizados para correta identificação no sistema e em relatórios.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center gap-2">
                <CheckCircle size={20} />
                <span>Perfil atualizado com sucesso!</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-2">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    className="pl-10 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    placeholder="Seu nome completo"
                    required
                    minLength={3}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Este nome será exibido em todos os relatórios e atendimentos.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block">
                  Matrícula
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CreditCard size={18} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="matricula"
                    value={formData.matricula}
                    onChange={handleChange}
                    className="pl-10 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all uppercase"
                    placeholder="Sua matrícula (Opcional)"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Identificação funcional para documentos oficiais.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block">
                  E-mail (Login)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400">
                  O e-mail não pode ser alterado por aqui. Contate o administrador.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 block">
                  Cargo / Função
                </label>
                <input
                  type="text"
                  value={formatCargo(formData.cargo)}
                  disabled
                  className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400">
                  Definido pelo administrador.
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end border-t border-gray-100 mt-6">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PerfilPage;

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { normalizeRole } from "./helpers";

/**
 * Registra uma ação administrativa no sistema para fins de auditoria.
 * 
 * @param {Object} db - Instância do Firestore
 * @param {String} appId - ID da aplicação (tenant)
 * @param {Object} user - Objeto do usuário logado (admin)
 * @param {String} action - Tipo da ação (ex: "CREATE_USER", "DELETE_USER", "UPDATE_SETTINGS")
 * @param {String} target - Alvo da ação (ex: "CPF 12345678900", "Configurações Gerais")
 * @param {Object} details - Detalhes adicionais (opcional)
 */
export const logAdminAction = async (db, appId, user, action, target, details = {}) => {
  if (!db || !appId) {
    console.warn("Log de auditoria falhou: DB ou AppID não fornecidos.");
    return;
  }

  // Verificar permissão para logar (apenas Coordenadores e Superintendentes/Admins)
  // Se o usuário não tiver role definida ou não for dos tipos permitidos, ignoramos o log.
  const role = normalizeRole(user?.role);
  const allowedRoles = ['coordenador', 'superintendente', 'admin', 'master', 'super_admin'];
  // Também permite se tiver a flag de permissão total explícita (caso exista no futuro)
  const hasFullAccess = allowedRoles.includes(role) || user?.permissions?.includes('super_admin');

  if (!hasFullAccess) {
    // Silenciosamente ignora o log para usuários comuns, conforme solicitado
    // "Logs do Sistema são apenas para edições feitas pelo Coordenador..."
    return;
  }

  try {
    const logsRef = collection(db, `artifacts/${appId}/public/data/audit_logs`);
    await addDoc(logsRef, {
      action,
      target,
      details,
      performedBy: {
        uid: user?.uid || "unknown",
        email: user?.email || "unknown",
        name: user?.name || user?.email || "Admin",
        role: role // Útil salvar o cargo de quem fez
      },
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    });
  } catch (error) {
    console.error("Erro ao registrar log de auditoria:", error);
  }
};

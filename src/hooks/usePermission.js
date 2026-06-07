import { useAuth } from '../contexts/AuthContext';

export const usePermission = () => {
  const { userProfile } = useAuth();

  const hasPermission = (permissionId) => {
    if (!userProfile) return false;

    // Superusers always have access
    const role = (userProfile.role || '').toLowerCase();
    const roleNorm = (userProfile.roleNorm || '').toLowerCase();
    
    const adminRoles = ['superintendente', 'coordenador', 'master', 'super_admin', 'admin'];
    
    if (adminRoles.includes(role) || adminRoles.includes(roleNorm)) {
      return true;
    }

    // Check granular permissions
    const perms = userProfile.permissions || [];
    return perms.includes(permissionId);
  };

  return { hasPermission };
};

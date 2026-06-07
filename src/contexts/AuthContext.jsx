import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { APP_ID } from "../constants";
import { normalizeRole } from "../utils/helpers";
import { auth, db, firebaseConfig } from "../firebase";

// Validar se as chaves existem
const isConfigValid = firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId;

const appId = APP_ID;

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  if (!isConfigValid) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50 p-4 text-center font-sans">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full border-l-4 border-red-500">
          <h1 className="text-2xl font-bold text-red-600 mb-4 flex items-center justify-center gap-2">
            ⚠️ Configuração Firebase Ausente
          </h1>
          <p className="mb-6 text-gray-700">
            O arquivo <code className="bg-gray-100 px-2 py-1 rounded text-red-500 font-mono">.env</code> não foi configurado corretamente ou está faltando.
          </p>
          
          <div className="text-left bg-gray-900 text-gray-300 p-4 rounded-md overflow-x-auto mb-6 font-mono text-sm shadow-inner">
            <p className="text-gray-500 mb-2"># Exemplo de configuração necessária:</p>
            <p>VITE_FIREBASE_API_KEY=sua_api_key_aqui</p>
            <p>VITE_FIREBASE_AUTH_DOMAIN=crasatendimento-35796.firebaseapp.com</p>
            <p>VITE_FIREBASE_PROJECT_ID=crasatendimento-35796</p>
            <p>...</p>
          </div>

          <div className="text-sm text-gray-600 bg-yellow-50 p-4 rounded border border-yellow-200">
            <p><strong>Ação Necessária:</strong> Crie um arquivo <code>.env</code> na raiz do projeto e adicione as chaves do Firebase.</p>
          </div>
        </div>
      </div>
    );
  }

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false); // Novo estado para Modo Teste
  const fetchingProfileRef = useRef(false);
  const userProfileRef = useRef(null);
  const authInitTimeoutRef = useRef(null);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    let mounted = true;
    if (authInitTimeoutRef.current) {
      clearTimeout(authInitTimeoutRef.current);
    }
    authInitTimeoutRef.current = setTimeout(() => {
      if (!mounted) return;
      setLoading(false);
      setProfileLoading(false);
      setProfileChecked(true);
      fetchingProfileRef.current = false;
    }, 15000);
    
    // Timeout removido para evitar conflitos de estado. 
    // O onAuthStateChanged é confiável e disparará eventualmente (seja null ou user).
    // Se a rede estiver offline, o Firebase usa cache ou dispara erro/null.
    
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      
      if (!mounted) return;

      try {
        setUser(u);
        if (u) {
          // Verifica se o perfil já foi carregado para evitar reload desnecessário
          const currentProfile = userProfileRef.current;
          if (!currentProfile || currentProfile.uid !== u.uid) {
            await fetchUserProfile(u);
          }
        } else {
          setUserProfile(null);
          setProfileChecked(false);
        }
      } catch (err) {
        console.error("AuthContext: Erro durante onAuthStateChanged", err);
        // Reset do estado de carregamento se fetchUserProfile falhar
        setProfileLoading(false);
        setProfileChecked(true);
        fetchingProfileRef.current = false;
      } finally {
        if (mounted) {
           if (authInitTimeoutRef.current) {
             clearTimeout(authInitTimeoutRef.current);
             authInitTimeoutRef.current = null;
           }
           setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      if (authInitTimeoutRef.current) {
        clearTimeout(authInitTimeoutRef.current);
        authInitTimeoutRef.current = null;
      }
      unsubscribe();
    };
  }, [auth]);

  const fetchUserProfile = async (firebaseUser) => {
    if (fetchingProfileRef.current) return;
    fetchingProfileRef.current = true;
    
    const email = firebaseUser.email;
    const uid = firebaseUser.uid;
    const emailNorm = (email || "").toString().trim().toLowerCase();
    
    if (!emailNorm) {
      setUserProfile(null);
      setProfileChecked(true);
      setProfileLoading(false);
      fetchingProfileRef.current = false;
      return;
    }

    setProfileLoading(true);
    setProfileChecked(false);
    try {
      const withTimeout = (promise, ms) => {
        return new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error("TIMEOUT")), ms);
          Promise.resolve(promise)
            .then((v) => {
              clearTimeout(t);
              resolve(v);
            })
            .catch((e) => {
              clearTimeout(t);
              reject(e);
            });
        });
      };

      const FIRESTORE_TIMEOUT_MS = 8000;
      const WRITE_TIMEOUT_MS = 5000;

      const syncProfileDocs = async (data) => {
        if (!uid || !emailNorm) return;
        const roleRaw =
          data?.role ||
          (data?.cargo && data.cargo.toLowerCase().includes("coordenad") ? "coordenador" : null) ||
          "atendente";
        const roleNormalized = normalizeRole(roleRaw);

        const perfilBase = {
          email: emailNorm,
          nome: data?.nome || emailNorm,
          role: roleNormalized,
          roleNorm: roleNormalized,
          cras_id: data?.cras_id || "",
          cargo: data?.cargo || "",
        };

        if (data && Object.prototype.hasOwnProperty.call(data, "permissions") && Array.isArray(data.permissions)) {
          perfilBase.permissions = data.permissions;
        }

        try {
          await withTimeout(
            setDoc(
              doc(db, `artifacts/${appId}/public/data/users`, uid),
              perfilBase,
              { merge: true }
            ),
            WRITE_TIMEOUT_MS
          );
        } catch (err) {
          console.warn("AuthContext: Falha ao sincronizar perfil em /users:", err?.message || err);
        }

        try {
          await withTimeout(
            setDoc(
              doc(db, `artifacts/${appId}/public/data/users_by_email`, emailNorm),
              perfilBase,
              { merge: true }
            ),
            WRITE_TIMEOUT_MS
          );
        } catch (err) {
          console.warn("AuthContext: Falha ao sincronizar perfil em /users_by_email:", err?.message || err);
        }
      };

      const trySyncAtendenteUid = async (atendenteDocId, atendenteData) => {
        if (!uid || !atendenteDocId) return;
        const currentUid = atendenteData?.uid || null;
        if (currentUid === uid) return;
        try {
          await withTimeout(
            updateDoc(
              doc(db, `artifacts/${appId}/public/data/atendentes`, atendenteDocId),
              { uid }
            ),
            WRITE_TIMEOUT_MS
          );
        } catch (err) {
          console.warn("AuthContext: Falha ao gravar uid em /atendentes:", err?.message || err);
        }
      };

      // 1. Tentar buscar por UID (Mais seguro e compatível com regras estritas)
      if (uid) {
        try {
          const qUid = query(
            collection(db, `artifacts/${appId}/public/data/atendentes`),
            where("uid", "==", uid)
          );
          const snapUid = await withTimeout(getDocs(qUid), FIRESTORE_TIMEOUT_MS);
          if (!snapUid.empty) {
            const data = snapUid.docs[0].data();
            await syncProfileDocs(data);
            setUserProfile({
              id: snapUid.docs[0].id,
              ...data,
              uid,
              emailNorm,
              roleNorm: normalizeRole(data?.roleNorm || data?.role || data?.cargo),
            });
            return; // Encontrou pelo UID, retorna
          }
        } catch (errUid) {
          console.warn("Erro ao buscar perfil por UID (tentando por email):", errUid);
        }
      }

      // 2. Fallback: Buscar por Email (Para usuários antigos ou admins em 'users')
      const q = query(
        collection(db, `artifacts/${appId}/public/data/users`),
        where("email", "==", emailNorm)
      );
      const snap = await withTimeout(getDocs(q), FIRESTORE_TIMEOUT_MS);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        await syncProfileDocs(data);
        setUserProfile({
          id: snap.docs[0].id,
          ...data,
          uid,
          emailNorm,
          roleNorm: normalizeRole(data?.roleNorm || data?.role || data?.cargo),
        });
      } else {
        const q2 = query(
          collection(db, `artifacts/${appId}/public/data/atendentes`),
          where("email", "==", emailNorm)
        );
        const snap2 = await withTimeout(getDocs(q2), FIRESTORE_TIMEOUT_MS);
        if (!snap2.empty) {
          const docId = snap2.docs[0].id;
          const data = snap2.docs[0].data();
          await trySyncAtendenteUid(docId, data);
          await syncProfileDocs(data);
          setUserProfile({
            id: docId,
            ...data,
            uid,
            emailNorm,
            roleNorm: normalizeRole(data?.roleNorm || data?.role || data?.cargo),
          });
        } else {
          console.warn("Perfil não encontrado para o email:", emailNorm);
          setUserProfile(null);
        }
      }
    } catch (e) {
      console.error("Error fetching profile", e);
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
      setProfileChecked(true);
      fetchingProfileRef.current = false;
    }
  };

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const updateUserPassword = async (currentPassword, newPassword) => {
    if (!user) throw new Error("Usuário não autenticado");
    
    // 1. Reautenticar para garantir permissão
    const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import("firebase/auth");
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    
    await reauthenticateWithCredential(user, credential);
    
    // 2. Atualizar senha
    await updatePassword(user, newPassword);
  };

  const refreshUserProfile = async () => {
    if (user) {
      setProfileChecked(false);
      await fetchUserProfile(user);
    }
  };

  const toggleTestMode = () => setIsTestMode(prev => !prev);

  const value = {
    user,
    userProfile,
    loading,
    profileLoading,
    profileChecked,
    isTestMode, // Expondo estado de teste
    toggleTestMode, // Função para alternar
    login,
    logout,
    resetPassword,
    updateUserPassword,
    refreshUserProfile,
    auth,
    db,
    appId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import { Tv } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import SaoLuisLogo from "../assets/SaoLuis.png";
import Input from "./ui/Input";
import Button from "./ui/Button";
import { normalizeRole } from "../utils/helpers";

import RuaDoGiz from "../assets/rua-do-giz.jpg";

function LoginPage() {
  const { auth, db, appId } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth || !db) return;
    setLoading(true);
    setError(null);
    try {
      const emailNorm = (email || "").trim().toLowerCase();

      try {
        await signInWithEmailAndPassword(auth, emailNorm, senha);

        const atendentesRef = collection(
          db,
          `artifacts/${appId}/public/data/atendentes`
        );
        const qAt = query(atendentesRef, where("email", "==", emailNorm));
        const snapAt = await getDocs(qAt);

        let snapWl = { empty: true };
        try {
          const whitelistRef = collection(
            db,
            `artifacts/${appId}/public/data/users_whitelist`
          );
          const qWl = query(whitelistRef, where("email", "==", emailNorm));
          snapWl = await getDocs(qWl);
        } catch (err) {
          console.error("Erro ao consultar users_whitelist (email/senha):", err);
        }

        if (snapAt.empty && snapWl.empty) {
          await signOut(auth);
          throw new Error(
            "Acesso negado. Usuário não cadastrado pelo administrador."
          );
        }

        if (!snapWl.empty && auth.currentUser) {
          const wl = snapWl.docs[0].data() || {};
          const perfil = {
            email: emailNorm,
            nome: wl.nome || emailNorm,
            role: normalizeRole(wl.role || "atendente"),
            cras_id: wl.cras_id || "",
          };
          try {
            await setDoc(
              doc(db, `artifacts/${appId}/public/data/users_by_email`, emailNorm),
              perfil,
              { merge: true }
            );
          } catch (err) {
            console.error("Erro ao salvar perfil no users_by_email (whitelist):", err);
          }
          try {
            await setDoc(
              doc(db, `artifacts/${appId}/public/data/users`, auth.currentUser.uid),
              perfil,
              { merge: true }
            );
          } catch (err) {
            console.error("Erro ao salvar perfil no users (whitelist):", err);
          }
        } else if (!snapAt.empty && auth.currentUser) {
          // Se não está na whitelist, mas está na lista de atendentes
          const atData = snapAt.docs[0].data() || {};
          const perfil = {
            email: emailNorm,
            nome: atData.nome || emailNorm,
            role: "atendente", // Força papel de atendente
            cras_id: atData.cras_id || "",
          };
          try {
            await setDoc(
              doc(db, `artifacts/${appId}/public/data/users`, auth.currentUser.uid),
              perfil,
              { merge: true }
            );
          } catch (err) {
            console.error("Erro ao criar perfil de usuário (atendente):", err);
          }
        }
        navigate("/");
      } catch (loginError) {
        // Códigos que indicam que o usuário não existe ou a senha está errada
        const codesParaCriar = [
          "auth/user-not-found",
          "auth/invalid-credential",
          "auth/invalid-login-credentials",
        ];
        
        // Se for erro de credencial inválida, tenta criar conta APENAS se o usuário está na lista de atendentes
        if (codesParaCriar.includes(loginError.code)) {
          const atendentesRef = collection(
            db,
            `artifacts/${appId}/public/data/atendentes`
          );
          const q = query(atendentesRef, where("email", "==", emailNorm));
          const snap = await getDocs(q);

          // Só cria conta se o email está na lista de atendentes
          if (!snap.empty) {
            const atData = snap.docs[0].data();

            try {
              const cred = await createUserWithEmailAndPassword(
                auth,
                emailNorm,
                senha
              );
              const userRef = doc(
                db,
                `artifacts/${appId}/public/data/users`,
                cred.user.uid
              );
              const perfil = {
                email: emailNorm,
                nome: atData.nome,
                role:
                  atData.role ||
                  (atData.cargo &&
                  atData.cargo.toLowerCase().includes("coordenad")
                    ? "coordenador"
                    : "atendente"),
                cras_id: atData.cras_id || "",
              };
              await setDoc(userRef, perfil, { merge: true });
              navigate("/");
              return;
            } catch (createErr) {
               // Se o email já existe no Firebase Auth, significa que a senha anterior estava errada
               if (createErr.code === 'auth/email-already-in-use') {
                 throw new Error("Senha incorreta. Verifique e tente novamente.");
               }
               throw createErr;
            }
          } else {
            // Email não está na lista de atendentes - acesso negado
            throw new Error(
              "Acesso negado. Seu email não está cadastrado no sistema. Solicite acesso ao administrador."
            );
          }
        }
        
        // Se não for erro de credencial, passa o erro original
        throw loginError;
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Erro de autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex items-center justify-center min-h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${RuaDoGiz})` }}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-6">
          <img
            src={SaoLuisLogo}
            alt="Logo"
            className="h-24 md:h-28 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-blue-900">Acesso ao Sistema</h1>
          <p className="text-gray-500">Acesso Restrito</p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">
          Entrar no Sistema
        </h2>

        <div className="space-y-6">
          <button
            type="button"
            onClick={() => navigate(`/painel?unidade=${encodeURIComponent("Centro Pop Centro")}`)}
            className="w-full flex items-center justify-center bg-blue-50 border border-blue-200 text-blue-800 font-medium py-3 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
          >
            <Tv size={20} className="mr-2" />
            Painel TV — Centro Pop Centro
          </button>

          <button
            type="button"
            onClick={() => navigate(`/painel?unidade=${encodeURIComponent("Centro Pop Cohab/Anil")}`)}
            className="w-full flex items-center justify-center bg-blue-50 border border-blue-200 text-blue-800 font-medium py-3 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
          >
            <Tv size={20} className="mr-2" />
            Painel TV — Centro Pop Cohab/Anil
          </button>

          <button
            type="button"
            onClick={() => navigate("/painel")}
            className="w-full flex items-center justify-center bg-white border border-gray-200 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Tv size={20} className="mr-2" />
            Painel TV — escolher unidade
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-300" />
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">
              use email e senha
            </span>
            <div className="flex-grow border-t border-gray-300" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha segura"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md p-2">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

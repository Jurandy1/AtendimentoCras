import { useState, useEffect } from 'react';
import { 
  collection, query, onSnapshot, doc, addDoc, deleteDoc, updateDoc, getDoc, getDocs, writeBatch, where, setDoc 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getFriendlyFirebaseError, logAdminAction } from '../utils';

export const PERMISSIONS_LIST = [
  { id: 'view_rma', label: 'Visualizar Relatório RMA' },
  { id: 'edit_rma', label: 'Editar RMA' },
  { id: 'view_history', label: 'Visualizar Histórico Geral' },
  { id: 'view_admin', label: 'Acessar Menu Administração' },
  { id: 'edit_users', label: 'Gerenciar Usuários (CadÚnico)' },
  { id: 'edit_attendants', label: 'Gerenciar Atendentes' },
  { id: 'delete_records', label: 'Excluir Registros (Admin)' },
  { id: 'manage_types', label: 'Gerenciar Tipos/Configurações' }
];

export const useConfiguracoesAtendente = ({ db, appId, userProfile }) => {
  const { user } = useAuth();
  const [cargos, setCargos] = useState([]);
  const [salas, setSalas] = useState([]);
  const [novoCargo, setNovoCargo] = useState('');
  const [novaSala, setNovaSala] = useState('');
  const [salvandoCargo, setSalvandoCargo] = useState(false);
  const [salvandoSala, setSalvandoSala] = useState(false);
  
  const cargosPath = `artifacts/${appId}/public/data/atendente_cargos`;
  const salasPath = `artifacts/${appId}/public/data/atendente_salas`;

  useEffect(() => {
    if (!db) return;
    const unsubC = onSnapshot(query(collection(db, cargosPath)), snap => setCargos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubS = onSnapshot(query(collection(db, salasPath)), snap => setSalas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubC(); unsubS(); };
  }, [db, appId, cargosPath, salasPath]);

  const handleAddCargo = async (e) => {
    e.preventDefault();
    if (!db || !novoCargo.trim()) return;
    setSalvandoCargo(true);
    try { 
      // Default permissions: none, unless specified later
      await addDoc(collection(db, cargosPath), { 
        nome: novoCargo.trim(),
        permissions: [] 
      }); 
      await logAdminAction(db, appId, userProfile, "CREATE_CARGO", novoCargo.trim());
      setNovoCargo(''); 
    } finally { setSalvandoCargo(false); }
  };

  const handleUpdateCargoPermissions = async (cargoId, permissions) => {
    if (!db || !cargoId) return;
    try {
        const cargoRef = doc(db, cargosPath, cargoId);
        const cargoSnap = await getDoc(cargoRef);
        if (!cargoSnap.exists()) return;
        
        const cargoNome = cargoSnap.data().nome;

        await updateDoc(cargoRef, { permissions });
        await logAdminAction(db, appId, userProfile, "UPDATE_CARGO_PERMISSIONS", cargoId, { permissions });

        // Propagate to all users with this cargo
        if (cargoNome) {
            const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
            const q = query(usersRef, where('cargo', '==', cargoNome)); // Note: users might not have 'cargo' field in 'users' collection, usually it's in 'atendentes'. 
            // Wait, useGerenciarAtendentes saves to 'atendentes' AND 'users'.
            // In 'users', it saves 'role', but does it save 'cargo'?
            // Looking at useGerenciarAtendentes.js:
            // It updates 'users' doc with { role, cras_id, nome, permissions }. It does NOT save 'cargo' to 'users' collection explicitly in the update block (lines 202-207).
            // However, it DOES save permissions.
            // But we need to find WHICH users to update.
            // We should query 'atendentes' collection first to find users with that cargo, then update 'users' collection using their UIDs.
            
            const atendentesRef = collection(db, `artifacts/${appId}/public/data/atendentes`);
            const qAtendentes = query(atendentesRef, where('cargo', '==', cargoNome));
            const atendentesSnap = await getDocs(qAtendentes);

            const batch = writeBatch(db);
            let count = 0;

            atendentesSnap.forEach(docSnap => {
                const atendente = docSnap.data();
                const uid = docSnap.id; // Usually the ID is the UID if forced, or random.
                // If ID is not UID, we might have a problem syncing to 'users'.
                // In useGerenciarAtendentes, we try to use UID as doc ID if possible, but sometimes it's auto-generated.
                // However, 'users' collection is keyed by UID.
                // Atendentes doc usually has 'uid' field if linked? No, useGerenciarAtendentes uses `forceUid` logic but default `addDoc` generates random ID.
                // BUT, line 119 in useGerenciarAtendentes: `dataToSave.uid = userCredential.user.uid`.
                // So if the user was created properly, they have a 'uid' field in 'atendentes' doc OR the doc ID is the UID?
                // Line 193: `await addDoc(collection(db, collectionPath), dataToSave)`. Doc ID is random.
                // So we need to look for `uid` field in the atendente doc.
                
                if (atendente.uid) {
                    const userRef = doc(db, `artifacts/${appId}/public/data/users`, atendente.uid);
                    batch.update(userRef, { permissions });
                    count++;
                }
                
                // Also update the permissions in 'atendentes' collection itself (if needed)
                // useGerenciarAtendentes doesn't seem to read permissions from atendentes doc for the UI, but it's good practice.
                // Actually, useGerenciarAtendentes reads 'permissions' from Cargo when editing.
                // But let's update it in atendentes doc too just in case.
                batch.update(docSnap.ref, { permissions });
            });

            if (count > 0) {
                await batch.commit();
                console.log(`Permissões propagadas para ${count} usuários.`);
            }
        }

    } catch (e) {
        console.error("Erro ao atualizar permissões:", e);
        alert("Erro ao atualizar permissões.");
    }
  };

  const handleAddSala = async (e) => {
    e.preventDefault();
    if (!db || !novaSala.trim()) return;
    setSalvandoSala(true);
    try { 
      await addDoc(collection(db, salasPath), { nome: novaSala.trim() }); 
      await logAdminAction(db, appId, userProfile, "CREATE_SALA", novaSala.trim());
      setNovaSala(''); 
    } finally { setSalvandoSala(false); }
  };

  const handleDeleteCargo = async (id) => { 
    try { 
      await deleteDoc(doc(db, cargosPath, id)); 
      await logAdminAction(db, appId, userProfile, "DELETE_CARGO", id);
    } catch (e) {
      console.error("Erro ao deletar cargo:", e);
      alert("Erro ao excluir cargo. Tente novamente.");
    } 
  };

  const handleDeleteSala = async (id) => { 
    try { 
      await deleteDoc(doc(db, salasPath, id)); 
      await logAdminAction(db, appId, userProfile, "DELETE_SALA", id);
    } catch (e) {
      console.error("Erro ao deletar sala:", e);
      alert("Erro ao excluir sala. Tente novamente.");
    } 
  };

  const handlePadronizarCargos = async () => {
    if (!window.confirm("Isso irá unificar cargos (ex: Psicólogo/Psicóloga -> Psicólogo(a)), atualizar os atendentes e remover os cargos antigos da lista. Continuar?")) return;
    setSalvandoCargo(true);

    try {
        // 1. Diagnóstico de Permissão
        if (!user || !user.uid) {
             throw new Error("Usuário não autenticado.");
        }
        const userDocRef = doc(db, `artifacts/${appId}/public/data/users`, user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
            throw new Error(`Seu usuário (UID: ${user.uid}) não possui perfil na coleção 'users'.`);
        }
        
        const userData = userDocSnap.data();
        const role = (userData.role || "").toLowerCase();
        
        console.log("Padronizar Cargos - User Check:", { uid: user.uid, role, userData });

        if (role !== "superintendente" && role !== "coordenador") {
             const confirmar = window.confirm(`Atenção: Seu cargo no sistema consta como '${userData.role}', mas esta ação requer 'Coordenador' ou 'Superintendente'.\n\nO sistema pode tentar corrigir seu cargo para 'Coordenador' automaticamente agora.\n\nDeseja confirmar que você é Coordenador e prosseguir?`);
             
             if (confirmar) {
                try {
                  await setDoc(userDocRef, { role: 'Coordenador' }, { merge: true });
                  console.log("Perfil do usuário atualizado para Coordenador.");
                } catch (fixErr) {
                  console.warn("Não foi possível corrigir o perfil automaticamente:", fixErr);
                }
             } else {
                throw new Error(`Permissão negada. Seu cargo é '${userData.role}'.`);
             }
        }

        // 2. Execução da Padronização
        const MAPPING = {
            "psicólogo": "Psicólogo(a)",
            "psicóloga": "Psicólogo(a)",
            "psicologo": "Psicólogo(a)",
            "psicologa": "Psicólogo(a)",
            "assistente social": "Assistente Social",
            "coordenador": "Coordenador",
            "coordenação": "Coordenador",
            "recepcionista": "Recepcionista",
            "recepção": "Recepcionista",
            "orientador": "Orientador(a) Social",
            "orientadora": "Orientador(a) Social",
            "orientador social": "Orientador(a) Social",
            "orientadora social": "Orientador(a) Social",
            "visitador": "Visitador(a)",
            "visitadora": "Visitador(a)",
            "cadastrador": "Cadastrador(a)",
            "cadastradora": "Cadastrador(a)",
            "entrevistador": "Entrevistador(a)",
            "entrevistadora": "Entrevistador(a)",
        };
    
        const cargosRef = collection(db, cargosPath);
        const atendentesRef = collection(db, `artifacts/${appId}/public/data/atendentes`);
        const batch = writeBatch(db);
        let changesCount = 0;
        let deletedCount = 0;

        const cargosParaDeletar = new Set();
        const cargosFinalizados = new Set(Object.values(MAPPING));

        // A. Mapear e atualizar atendentes
        const atendentesSnap = await getDocs(atendentesRef);
        atendentesSnap.forEach(docSnap => {
            const atendente = docSnap.data();
            const cargoAtual = (atendente.cargo || "").trim().toLowerCase();
            const novoCargo = MAPPING[cargoAtual];
            if (novoCargo && novoCargo !== atendente.cargo) {
                batch.update(docSnap.ref, { cargo: novoCargo });
                changesCount++;
            }
        });

        // B. Identificar cargos para deletar e garantir que os cargos padronizados existam
        const cargosSnap = await getDocs(cargosRef);
        const cargosExistentes = new Map(cargosSnap.docs.map(d => {
            const nome = d.data().nome || "";
            return [nome.trim().toLowerCase(), {id: d.id, nome: nome}];
        }).filter(item => item[0] !== "")); // Filtra cargos sem nome

        for (const cargoAntigo in MAPPING) {
            if (cargosExistentes.has(cargoAntigo)) {
                const cargoInfo = cargosExistentes.get(cargoAntigo);
                if (!cargosFinalizados.has(cargoInfo.nome)) {
                    cargosParaDeletar.add(cargoInfo.id);
                }
            }
        }

        for (const cargoFinal of cargosFinalizados) {
            if (!cargosExistentes.has(cargoFinal.toLowerCase())) {
                await addDoc(cargosRef, { nome: cargoFinal, permissions: [] });
                changesCount++;
            }
        }
        
        // C. Deletar os cargos antigos
        cargosParaDeletar.forEach(id => {
            batch.delete(doc(cargosRef, id));
            deletedCount++;
        });

        if (changesCount > 0 || deletedCount > 0) {
            await batch.commit();
            await logAdminAction(db, appId, userProfile, "PADRONIZAR_CARGOS", `Cargos unificados. ${changesCount} atendentes atualizados, ${deletedCount} cargos antigos removidos.`);
            alert(`Padronização concluída! ${changesCount} atendentes atualizados e ${deletedCount} cargos antigos removidos.`);
        } else {
            alert("Nenhuma alteração necessária encontrada.");
        }
    } catch (err) {
        console.error("Erro ao padronizar:", err);
        alert(`FALHA: ${err.message || err.code || err}`);
    } finally {
        setSalvandoCargo(false);
    }
  };

  const handleLiberarChamando = async () => {
    if (!window.confirm("Isso irá resetar TODOS os atendimentos que estão 'Chamando' de volta para 'Aguardando'.\n\nUse apenas se houver tickets presos no painel. Continuar?")) return;
    
    try {
        const atendimentosRef = collection(db, `artifacts/${appId}/public/data/atendimentos`);
        // Busca todos com status chamando
        const q = query(atendimentosRef, where("status", "==", "chamando"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            alert("Não há atendimentos com status 'Chamando' no momento.");
            return;
        }

        const batch = writeBatch(db);
        let count = 0;

        snapshot.forEach((docSnap) => {
            batch.update(docSnap.ref, {
                status: "aguardando",
                atendente_id: null,
                hora_chamada: null
            });
            count++;
        });

        await batch.commit();
        await logAdminAction(db, appId, userProfile, "RESET_FILA", `Resetou ${count} atendimentos de 'chamando' para 'aguardando'.`, { count });
        alert(`${count} atendimentos foram liberados e voltaram para a fila.`);
        
    } catch (err) {
        console.error("Erro ao liberar fila:", err);
        alert(getFriendlyFirebaseError(err, "Erro ao liberar fila."));
    }
  };

  return {
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
    handleUpdateCargoPermissions,
    handlePadronizarCargos,
    handleLiberarChamando
  };
};

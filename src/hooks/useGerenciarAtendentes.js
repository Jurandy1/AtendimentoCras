import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { 
  collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, 
  where, getDocs, getDoc, setDoc, serverTimestamp, writeBatch, limit, orderBy, startAfter, FieldPath
} from 'firebase/firestore';
import { getFriendlyFirebaseError, logAdminAction } from '../utils';
import { firebaseConfig } from '../firebase';

export const useGerenciarAtendentes = ({ 
  db, 
  appId, 
  crasUnidades, 
  tiposAtendimento, 
  atendentesList, 
  userProfile 
}) => {
  const { resetPassword, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    nome: '', 
    email: '', 
    cargo: '', 
    role: 'atendente', 
    salas_permitidas: [], 
    senha: '', 
    cras_id: userProfile?.cras_id || '', 
    guiche: '', 
    tipos_atende: [],
    matricula: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const collectionPath = `artifacts/${appId}/public/data/atendentes`;
  const cargosPath = `artifacts/${appId}/public/data/atendente_cargos`;
  const salasPath = `artifacts/${appId}/public/data/atendente_salas`;
  
  const [cargos, setCargos] = useState([]);
  const [salas, setSalas] = useState([]);

  // Diagnostic states
  const [showDiagnostico, setShowDiagnostico] = useState(false);
  const [diagEmail, setDiagEmail] = useState('');
  const [diagResult, setDiagResult] = useState(null);
  const [forceUid, setForceUid] = useState('');

  useEffect(() => {
    if (!db) return;
    const unsubCargos = onSnapshot(query(collection(db, cargosPath)), (snap) => {
      setCargos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubSalas = onSnapshot(query(collection(db, salasPath)), (snap) => {
      setSalas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubCargos(); unsubSalas(); };
  }, [db, appId, cargosPath, salasPath]);

  const getTipoNome = (id) => tiposAtendimento.find(t => t.id === id)?.nome || 'Desconhecido';
  const getTipoCor = (id) => tiposAtendimento.find(t => t.id === id)?.cor || '#777';
  const getCrasNome = (id) => crasUnidades.find(c => c.id === id)?.nome || 'Sem Unidade';

  const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
  
  const handleTipoToggle = (tipoId) => {
    setFormData(prev => {
      const tipos = prev.tipos_atende || [];
      return { ...prev, tipos_atende: tipos.includes(tipoId) ? tipos.filter(id => id !== tipoId) : [...tipos, tipoId] };
    });
  };

  const handleSalaToggle = (salaId) => {
    setFormData(prev => {
      const atuais = prev.salas_permitidas || [];
      return { ...prev, salas_permitidas: atuais.includes(salaId) ? atuais.filter(id => id !== salaId) : [...atuais, salaId] };
    });
  };

  const resetForm = () => { 
    setFormData({ 
      nome: '', 
      email: '', 
      cargo: '', 
      role: 'atendente', 
      salas_permitidas: [], 
      senha: '', 
      cras_id: userProfile?.cras_id || '', 
      guiche: '', 
      tipos_atende: [],
      matricula: ''
    }); 
    setEditingId(null); 
    setShowModal(false); 
    setShowPassword(false); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db) return;
    const dataToSave = { ...formData, email: (formData.email || '').trim().toLowerCase() };
    const validTiposIds = (tiposAtendimento || []).map(t => t.id);
    dataToSave.tipos_atende = (dataToSave.tipos_atende || []).filter(id => validTiposIds.includes(id));
    
    // Add permissions based on cargo
    const selectedCargo = cargos.find(c => c.nome === dataToSave.cargo);
    let finalPermissions = selectedCargo ? (selectedCargo.permissions || []) : [];

    dataToSave.permissions = finalPermissions;

    if (!editingId && !dataToSave.senha) { return; }
    
    // --- LÓGICA DE CRIAÇÃO NO FIREBASE AUTH ---
    if (dataToSave.senha) {
      let secondaryApp;
      let secondaryAuth;
      let authUserCreatedOrUpdated = false;

      try {
        secondaryApp = initializeApp(firebaseConfig, `SecondaryApp-${Date.now()}`);
        secondaryAuth = getAuth(secondaryApp);
        
        if (editingId) {
          try {
            await resetPassword(dataToSave.email);
            alert(`E-mail de redefinição de senha enviado para ${dataToSave.email}.`);
          } catch (authError) {
            alert(`Erro ao enviar e-mail de redefinição: ${authError.message}`);
            return;
          }
        } else {
          try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, dataToSave.email, dataToSave.senha);
            if (userCredential?.user) {
              dataToSave.uid = userCredential.user.uid;
              authUserCreatedOrUpdated = true;
            }
          } catch (authError) {
            if (authError.code === 'auth/email-already-in-use') {
              try {
                const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
                const qUser = query(usersRef, where("email", "==", dataToSave.email));
                const snapUser = await getDocs(qUser);
                if (!snapUser.empty) {
                  dataToSave.uid = snapUser.docs[0].id;
                  authUserCreatedOrUpdated = true;
                }
              } catch {}

              if (!dataToSave.uid) {
                const confirm = window.confirm(`O e-mail "${dataToSave.email}" já está em uso. Deseja criar/atualizar o perfil no banco de dados mesmo assim?`);
                if (!confirm) return;
              }
            } else {
              alert(`Erro ao criar login do usuário: ${authError.message}`);
              return;
            }
          }
        }

        // Se conseguiu logar/criar/atualizar no Auth, garante que o perfil no /users esteja atualizado
        if (dataToSave.uid && authUserCreatedOrUpdated) {
             try {
               const userRef = doc(db, `artifacts/${appId}/public/data/users`, dataToSave.uid);
               await setDoc(userRef, {
                 email: dataToSave.email,
                 nome: dataToSave.nome,
                 role: dataToSave.role,
                 cras_id: dataToSave.cras_id || '',
                 tipos_atende: dataToSave.tipos_atende || [],
                 permissions: dataToSave.permissions || []
               }, { merge: true });
             } catch (profileErr) {
               console.error("Erro ao criar/atualizar perfil em users via secondaryApp:", profileErr);
             }
        }

      } finally {
        if (secondaryApp) {
          try { await deleteApp(secondaryApp); } catch(e) { console.error("Erro cleanup app", e); }
        }
      }
    }

    delete dataToSave.senha;
    delete dataToSave.sala_id;

    try {
      let savedAtendenteId = editingId;
      if (editingId) {
        await updateDoc(doc(db, collectionPath, editingId), dataToSave);
      } else {
        const uid = String(dataToSave.uid || "").trim();
        if (uid) {
          savedAtendenteId = uid;
          const atendenteRef = doc(db, collectionPath, uid);
          const existing = await getDoc(atendenteRef);

          const payload = { ...dataToSave, uid };

          if (!existing.exists()) {
            payload.createdAt = serverTimestamp();
            if (!payload.status) payload.status = "offline";
          } else {
            if (payload.status == null) delete payload.status;
            if (payload.createdAt == null) delete payload.createdAt;
          }

          await setDoc(atendenteRef, payload, { merge: true });

          const emailNorm = String(payload.email || "").trim().toLowerCase();
          if (emailNorm) {
            const duplicates = (Array.isArray(atendentesList) ? atendentesList : [])
              .filter((a) => String(a?.email || "").trim().toLowerCase() === emailNorm)
              .filter((a) => String(a?.id || "").trim() && String(a?.id || "").trim() !== uid);

            if (duplicates.length > 0) {
              const batch = writeBatch(db);
              duplicates.forEach((dup) => {
                batch.delete(doc(db, collectionPath, dup.id));
              });
              await batch.commit();
            }
          }
        } else {
          // Fallback: sem UID disponível (deve ser raro). Mantém o comportamento antigo.
          dataToSave.createdAt = serverTimestamp();
          if (!dataToSave.status) dataToSave.status = "offline";
          const createdRef = await addDoc(collection(db, collectionPath), dataToSave);
          savedAtendenteId = createdRef.id;
        }
      }
      
      try {
        const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
        const qUser = query(usersRef, where("email", "==", dataToSave.email));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
          const userDoc = snapUser.docs[0];
          await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, userDoc.id), {
            role: dataToSave.role,
            cras_id: dataToSave.cras_id || '',
            nome: dataToSave.nome,
            permissions: dataToSave.permissions || []
          });
        }
        
        const byEmailRef = doc(db, `artifacts/${appId}/public/data/users_by_email`, dataToSave.email);
        await setDoc(byEmailRef, {
          email: dataToSave.email,
          nome: dataToSave.nome,
          role: dataToSave.role,
          cras_id: dataToSave.cras_id || '',
          permissions: dataToSave.permissions || []
        }, { merge: true });

      } catch (syncErr) { console.error("Erro ao sincronizar usuario:", syncErr); }

      await logAdminAction(
        db, appId, { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome },
        editingId ? "UPDATE_ATENDENTE" : "CREATE_ATENDENTE",
        `Atendente: ${dataToSave.nome} (${dataToSave.email})`,
        { ...dataToSave, id: savedAtendenteId }
      );

      // Se o usuário editado for o próprio usuário logado, força atualização do perfil
      if (editingId === userProfile?.id || dataToSave.email === userProfile?.email) {
        if (refreshUserProfile) await refreshUserProfile();
      }

      resetForm();
    } catch (error) { console.error("Erro ao salvar Atendente:", error); }
  };

  const handleEdit = (atendente) => {
    let salasIniciais = atendente.salas_permitidas || [];
    if (salasIniciais.length === 0 && atendente.sala_id) {
        salasIniciais = [atendente.sala_id];
    }
    setFormData({
      nome: atendente.nome,
      email: atendente.email || '',
      cargo: atendente.cargo || '',
      role: atendente.role || (atendente.cargo?.toLowerCase().includes('coordenad') ? 'coordenador' : 'atendente'),
      salas_permitidas: salasIniciais,
      senha: '',
      cras_id: atendente.cras_id,
      guiche: atendente.guiche,
      tipos_atende: (atendente.tipos_atende || []).filter(id => (tiposAtendimento || []).some(t => t.id === id)),
      matricula: atendente.matricula || ''
    });
    setEditingId(atendente.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => { 
    try { 
      const atendente = atendentesList.find(a => a.id === id);
      await deleteDoc(doc(db, collectionPath, id)); 
      
      await logAdminAction(
        db, appId, { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome },
        "DELETE_ATENDENTE",
        `Atendente ID: ${id}`,
        { nome: atendente?.nome, email: atendente?.email }
      );
    } catch (error) { console.error("Erro ao deletar Atendente:", error); } 
  };

  const limparAtendentesProblematicos = async () => {
    try {
      // Identificar atendentes com dados incompletos
      const atendentesProblematicos = atendentesList.filter(at => {
        const nome = at.nome || "";
        const cargo = at.cargo || "";
        const cras_id = at.cras_id || "";
        const nomeLower = String(nome || "").trim().toLowerCase();
        const cargoOk = String(cargo || "").trim().length > 0;
        const crasOk = String(cras_id || "").trim().length > 0;
        
        const isNomeTeste =
          nomeLower === "teste" ||
          nomeLower === "teste2" ||
          nomeLower.startsWith("teste");

        if (!nomeLower) return true;
        if (isNomeTeste && !cargoOk) return true;
        if (!cargoOk && !crasOk) return true;
        
        return false;
      });
      
      if (atendentesProblematicos.length === 0) {
        alert("✅ Nenhum atendente problemático encontrado!");
        return;
      }
      
      // Confirmar com o usuário
      const confirmacao = confirm(`Deseja remover ${atendentesProblematicos.length} atendentes problemáticos?\n\n${atendentesProblematicos.map(at => `- ${at.nome} (${at.email || "sem email"})`).join('\n')}`);
      
      if (!confirmacao) {
        console.log("❌ Operação cancelada pelo usuário");
        return;
      }
      
      // Remover atendentes
      for (const atendente of atendentesProblematicos) {
        try {
          console.log(`🗑️ Removendo: ${atendente.nome} (ID: ${atendente.id})`);
          await deleteDoc(doc(db, collectionPath, atendente.id));
          console.log(`✅ Removido com sucesso: ${atendente.nome}`);
          
          await logAdminAction(
            db, appId, { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome },
            "DELETE_ATENDENTE_PROBLEMATICO",
            `Atendente problemático removido: ${atendente.nome}`,
            { nome: atendente?.nome, email: atendente?.email, id: atendente.id }
          );
          
          // Pequena pausa entre exclusões para não sobrecarregar o banco
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`❌ Erro ao remover ${atendente.nome}:`, error);
        }
      }
      
      alert(`🎉 ${atendentesProblematicos.length} atendentes problemáticos removidos com sucesso!`);
      
    } catch (error) {
      console.error("❌ Erro geral:", error);
      alert(getFriendlyFirebaseError(error, "Erro ao limpar atendentes problemáticos."));
    }
  };
  
  const handleReabrirExpediente = async (id) => {
    if (!db || !id) return;
    try { await updateDoc(doc(db, collectionPath, id), { expedienteEncerradoEm: null, status: 'offline', encerradoAutomatico: false }); } catch (error) { console.error("Erro ao reabrir expediente:", error); }
  };

  const handleResetarStatus = async (id, nome) => {
    if (!db || !id) return;
    try {
      await updateDoc(doc(db, collectionPath, id), {
        status: 'offline',
        pausaInicio: null,
        pausaMotivo: null,
        emAtendimento: false,
        atendimentoAtualId: null,
      });
      await logAdminAction(
        db, appId, { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome },
        "RESET_STATUS_ATENDENTE",
        `Status de "${nome}" (ID: ${id}) resetado para offline pelo administrador.`,
        { id, nome }
      );
      alert(`✅ Status de "${nome}" resetado para Offline com sucesso!`);
    } catch (error) {
      console.error("Erro ao resetar status:", error);
      alert(getFriendlyFirebaseError(error, "Erro ao resetar status do atendente."));
    }
  };

  const handlePromoverASuperCoordenador = async (atendenteAlvo) => {
    if (!db || !appId) return false;
    const uid = String(atendenteAlvo?.uid || atendenteAlvo?.id || '').trim();
    if (!uid) return false;

    const nome = atendenteAlvo.nome || atendenteAlvo.email || 'este coordenador';
    if (!window.confirm(
      `Confirma promover "${nome}" a Super Coordenador?\n\n` +
      'Esse usuário passará a ter acesso a TODAS as unidades.\n' +
      'A unidade atual dele será desvinculada (cras_id ficará vazio).\n\n' +
      'Esta ação pode ser revertida editando o atendente depois.'
    )) return false;

    try {
      const batch = writeBatch(db);

      const userRef = doc(db, `artifacts/${appId}/public/data/users`, uid);
      batch.set(userRef, {
        email: atendenteAlvo.email || '',
        nome: atendenteAlvo.nome || atendenteAlvo.email || '',
        role: 'super_admin',
        roleNorm: 'super_admin',
        cras_id: '',
        permissions: atendenteAlvo.permissions || [],
      }, { merge: true });

      const atendenteRef = doc(db, collectionPath, uid);
      batch.set(atendenteRef, {
        role: 'super_admin',
        roleNorm: 'super_admin',
        cras_id: '',
      }, { merge: true });

      if (atendenteAlvo.email) {
        const emailKey = atendenteAlvo.email.toLowerCase().trim();
        const byEmailRef = doc(db, `artifacts/${appId}/public/data/users_by_email`, emailKey);
        batch.set(byEmailRef, {
          email: atendenteAlvo.email,
          nome: atendenteAlvo.nome || '',
          role: 'super_admin',
          roleNorm: 'super_admin',
          cras_id: '',
          permissions: atendenteAlvo.permissions || [],
        }, { merge: true });
      }

      await batch.commit();
      alert(`✅ "${nome}" agora é Super Coordenador.\n\nPeça que ele(a) faça logout e login novamente para o novo perfil ser aplicado.`);
      return true;
    } catch (err) {
      console.error('Erro ao promover a Super Coordenador:', err);
      alert(getFriendlyFirebaseError(err, 'Erro ao promover.'));
      return false;
    }
  };

  const handleImportarLista = async () => {
    const lista = [
      { nome: "Anna Gomide", email: "anna_mochel@hotmail.com", cargo: "Psicóloga" },
      { nome: "Heloise Elaine", email: "heloisemedina@hotmail.com", cargo: "Psicóloga" },
      { nome: "Jaime Sousa", email: "jaimesilvajunior@hotmail.com", cargo: "Psicólogo" },
      { nome: "Rosilêde Garros", email: "rosegarros@gmail.com", cargo: "Psicóloga" },
      { nome: "Selma Regina", email: "selmareginacm@gmail.com", cargo: "Educadora Social Recepção" },
      { nome: "Eline Oliveira Neres", email: "elineoliveiraneres@gmail.com", cargo: "Administrativo" },
      { nome: "Enilson Santos dias", email: "enilsondias64@gmail.com", cargo: "Coordenador" },
      { nome: "Raybi Ferreira", email: "Raybiferreira@gmail.com", cargo: "Oficineiro, operador cadunico" },
      { nome: "Jucyara Santana", email: "Jucyara_santana@yahoo.com.br", cargo: "Operador cadunico" }
    ];
    if (!window.confirm(`Deseja importar ${lista.length} usuários da lista padrão? (Senha padrão: 123456)`)) return;
    setLoading(true);
    try {
        const cargosAtuais = cargos.map(c => c.nome.toLowerCase());
        const novosCargos = [...new Set(lista.map(u => u.cargo))];
        for (const cargo of novosCargos) {
            if (!cargosAtuais.includes(cargo.toLowerCase())) {
                await addDoc(collection(db, cargosPath), { nome: cargo });
            }
        }
        const emailsAtuais = atendentesList.map(a => (a.email || '').toLowerCase());
        let count = 0;
        for (const user of lista) {
            if (!emailsAtuais.includes(user.email.toLowerCase())) {
                await addDoc(collection(db, collectionPath), {
                    nome: user.nome,
                    email: user.email.toLowerCase(),
                    cargo: user.cargo,
                    role: user.cargo.toLowerCase().includes('recep') ? 'recepcionista' : (user.cargo.toLowerCase().includes('coordenad') ? 'coordenador' : 'atendente'),
                    salas_permitidas: [],
                    cras_id: userProfile?.cras_id || '',
                    guiche: '',
                    tipos_atende: [],
                    status: 'offline'
                });
                count++;
            }
        }
        await logAdminAction(db, appId, userProfile, "IMPORT_ATENDENTES_DEFAULT", `Importados ${count} usuários padrão`, { count });
        alert(`${count} usuários importados com sucesso!`);
    } catch (err) { console.error("Erro na importação:", err); alert('Erro ao importar. Veja o console.'); } finally { setLoading(false); }
  };

  const handleRegularizarAntigos = async () => {
    if (!db) return;
    if (!window.confirm("Deseja regularizar usuários antigos criando contas no Auth e enviando e-mail de redefinição de senha?")) return;
    setLoading(true);
    let created = 0;
    let resetSent = 0;
    let secondaryApp;
    try {
      secondaryApp = initializeApp(firebaseConfig, `SecondaryApp-Regulariza-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const emails = atendentesList.map(a => (a.email || "").trim().toLowerCase()).filter(e => !!e);
      for (const email of emails) {
        let createdThis = false;
        try {
          const temp = Math.random().toString(36).slice(2) + "A1!";
          await createUserWithEmailAndPassword(secondaryAuth, email, temp);
          created++;
          createdThis = true;
        } catch (err) {
          if (err.code !== "auth/email-already-in-use") {
            continue;
          }
        }
        try {
          await resetPassword(email);
          resetSent++;
        } catch {}
      }
      await logAdminAction(db, appId, userProfile, "REGULARIZE_USERS", `Regularização de usuários: ${created} criados, ${resetSent} resets`, { created, resetSent });
      alert(`Regularização concluída. Contas criadas: ${created}. E-mails enviados: ${resetSent}.`);
    } catch (err) {
      console.error("Erro na regularização:", err);
      alert("Erro ao regularizar usuários. Veja o console.");
    } finally {
      setLoading(false);
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch(e) { console.warn("Erro ao limpar app secundário", e); }
      }
    }
  };

  const handleForceUid = async () => {
    if (!forceUid || !diagEmail) return;
    if (!window.confirm(`ATENÇÃO: Isso irá criar/sobrescrever o perfil do atendente com o UID: ${forceUid}. Certifique-se que este UID veio da tela de erro do usuário.`)) return;
    
    try {
        setLoading(true);
        let dataToSave = {
            email: diagEmail,
            uid: forceUid,
            status: 'offline',
            migrated_at: serverTimestamp()
        };
        
        if (diagResult?.naLista?.[0]) {
            const ghost = diagResult.naLista[0];
            dataToSave = { ...ghost, ...dataToSave };
            delete dataToSave.id; 
        } else if (diagResult?.noUsers?.[0]) {
             const u = diagResult.noUsers[0];
             dataToSave = {
                ...dataToSave,
                nome: u.nome || '',
                role: u.role || 'atendente',
                cras_id: u.cras_id || '',
                tipos_atende: u.tipos_atende || []
             };
        }
        
        await setDoc(doc(db, collectionPath, forceUid), dataToSave, { merge: true });
        
        if (diagResult?.naLista) {
            for (const ghost of diagResult.naLista) {
                if (ghost.id !== forceUid) {
                    await deleteDoc(doc(db, collectionPath, ghost.id));
                }
            }
        }
        
        await logAdminAction(db, appId, userProfile, "FORCE_UID", `Forçado UID ${forceUid} para ${diagEmail}`, { forceUid, email: diagEmail });
        alert("Vínculo corrigido com sucesso!");
        handleDiagnostico(); 
        setForceUid('');
    } catch (err) {
        console.error(err);
        alert(getFriendlyFirebaseError(err, "Erro ao forçar UID."));
    } finally {
        setLoading(false);
    }
  };

  const handleDiagnostico = async () => {
    if (!diagEmail) return;
    setLoading(true);
    setDiagResult(null);
    try {
      const email = diagEmail.trim().toLowerCase();
      
      const naLista = atendentesList.filter(a => (a.email || '').toLowerCase() === email);
      
      const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
      const qUser = query(usersRef, where("email", "==", email));
      const snapUser = await getDocs(qUser);
      
      let authStatus = "Desconhecido (requer teste de criação/login)";
      let authExists = false;

      let secondaryApp = initializeApp(firebaseConfig, `DiagApp-${Date.now()}`);
      try {
        const secondaryAuth = getAuth(secondaryApp);
        await createUserWithEmailAndPassword(secondaryAuth, email, "TesteDiag123!");
        authStatus = "Não existe no Auth (livre para cadastro)";
        
        const user = secondaryAuth.currentUser;
        if (user) await user.delete();
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          authStatus = "E-mail JÁ EXISTE no Authentication";
          authExists = true;
        } else {
          authStatus = `Erro ao verificar Auth: ${err.message}`;
        }
      } finally {
        await deleteApp(secondaryApp);
      }

      setDiagResult({
        email,
        naLista: naLista.length > 0 ? naLista : null,
        noUsers: !snapUser.empty ? snapUser.docs.map(d => ({id: d.id, ...d.data()})) : null,
        authStatus,
        authExists
      });

    } catch (error) {
      console.error("Erro no diagnóstico:", error);
      alert("Erro ao executar diagnóstico.");
    } finally {
      setLoading(false);
    }
  };

  const handleFixAuthSync = async () => {
     if (!diagResult || !diagResult.authExists) return;
     
     if (diagResult.noUsers && diagResult.noUsers.length > 0) {
        const restoredUser = diagResult.noUsers[0]; 
        const uid = restoredUser.id; 
        
        if (window.confirm(`Encontrado perfil em 'users' com ID: ${uid}. Deseja restaurar este usuário para a lista de Atendentes?`)) {
           try {
             await setDoc(doc(db, collectionPath, uid), { 
                nome: restoredUser.nome || 'Recuperado',
                email: diagResult.email,
                role: restoredUser.role || 'atendente',
                cras_id: restoredUser.cras_id || '',
                status: 'offline',
                tipos_atende: restoredUser.tipos_atende || []
             }, { merge: true });
             alert("Usuário restaurado para a lista de atendentes!");
             await logAdminAction(db, appId, userProfile, "RESTORE_ATENDENTE", `Restaurado ${diagResult.email}`, { uid, email: diagResult.email, restoredUser });
             setShowDiagnostico(false);
           } catch (e) {
             console.error(e);
             alert("Erro ao restaurar.");
           }
        }
     } else {
        alert("Não foi encontrado registro em 'users' para recuperar o UID. O usuário precisará ser recriado com a senha correta (usando a opção de Novo Atendente, que agora suporta recuperação).");
     }
  };
  
  const handleFixTypes = async () => {
    if (!window.confirm("Deseja verificar e corrigir duplicatas nos Tipos de Atendimento e restaurar os padrões se necessário?")) return;
    setLoading(true);
    try {
        const tiposRef = collection(db, `artifacts/${appId}/public/data/tipos_atendimento`);
        const snap = await getDocs(tiposRef);
        const tipos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const batch = writeBatch(db);
        const seen = {};
        let deleted = 0;
        
        // 1. Deduplicate
        for (const t of tipos) {
            const name = (t.nome || '').trim().toLowerCase();
            if (seen[name]) {
                batch.delete(doc(db, `artifacts/${appId}/public/data/tipos_atendimento`, t.id));
                deleted++;
            } else {
                seen[name] = t;
            }
        }
        
        // 2. Ensure Defaults and update existing orders
        const defaults = [
            { nome: 'CadÚnico', cor: '#4F46E5', ordem: 1 },
            { nome: 'Psicólogo', cor: '#2563EB', ordem: 2 },
            { nome: 'Serviços do Dia', cor: '#9333EA', ordem: 3 }
        ];
        
        let created = 0;
        let updated = 0;
        for (const def of defaults) {
            const existing = seen[def.nome.toLowerCase()];
            if (!existing) {
                const newRef = doc(collection(db, `artifacts/${appId}/public/data/tipos_atendimento`));
                batch.set(newRef, def);
                created++;
            } else if (existing.ordem !== def.ordem || existing.cor !== def.cor) {
                // Update existing type if order or color is different
                batch.update(doc(db, `artifacts/${appId}/public/data/tipos_atendimento`, existing.id), {
                    ordem: def.ordem,
                    cor: def.cor
                });
                updated++;
            }
        }
        
        if (deleted > 0 || created > 0 || updated > 0) {
            await batch.commit();
            await logAdminAction(db, appId, userProfile, "FIX_TIPOS_ATENDIMENTO", `Corrigidos tipos: ${deleted} deletados, ${created} criados, ${updated} atualizados.`);
            alert(`Correção concluída!\n- Duplicatas removidas: ${deleted}\n- Padrões criados: ${created}\n- Tipos atualizados: ${updated}`);
        } else {
            alert("Nenhuma correção necessária encontrada.");
        }
        
    } catch (err) {
        console.error("Erro ao corrigir tipos:", err);
        alert(getFriendlyFirebaseError(err, "Erro ao corrigir tipos."));
    } finally {
        setLoading(false);
    }
  };

  const handleCorrigirVinculosAtendentes = async () => {
    if (!db || !appId) return;
    if (!window.confirm("Isso irá corrigir vínculos antigos (perfil fantasma), migrar atendimentos para o UID correto e remover duplicados por e-mail.\n\nRecomendado executar fora do horário de atendimento.\n\nContinuar?")) return;

    const list = Array.isArray(atendentesList) ? atendentesList : [];
    const byEmail = new Map();
    list.forEach((a) => {
      const email = String(a?.email || "").trim().toLowerCase();
      if (!email) return;
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(a);
    });

    const usersRef = collection(db, `artifacts/${appId}/public/data/users`);
    const atendimentosRef = collection(db, `artifacts/${appId}/public/data/atendimentos`);
    const uidCache = new Map();
    const refCache = new Map();

    const getUidByEmail = async (email) => {
      if (!email) return "";
      if (uidCache.has(email)) return uidCache.get(email);
      try {
        const qUser = query(usersRef, where("email", "==", email));
        const snap = await getDocs(qUser);
        const uid = snap.empty ? "" : String(snap.docs[0].id || "");
        uidCache.set(email, uid);
        return uid;
      } catch {
        uidCache.set(email, "");
        return "";
      }
    };

    const simplify = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    const migrateAtendimentosField = async ({ field, fromId, toId }) => {
      const from = String(fromId || "").trim();
      const to = String(toId || "").trim();
      if (!from || !to || from === to) return 0;

      let migrated = 0;
      let last = null;

      while (true) {
        const constraints = [
          where(field, "==", from),
          orderBy(FieldPath.documentId()),
          limit(450),
        ];
        if (last) constraints.push(startAfter(last));
        const snap = await getDocs(query(atendimentosRef, ...constraints));
        if (snap.empty) break;

        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          batch.update(d.ref, { [field]: to });
        });
        await batch.commit();

        migrated += snap.size;
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < 450) break;
      }

      return migrated;
    };

    const isAtendenteIdReferenced = async (atendenteId) => {
      const id = String(atendenteId || "").trim();
      if (!id) return false;
      if (refCache.has(id)) return refCache.get(id);
      try {
        const q1 = query(atendimentosRef, where("atendente_id", "==", id), limit(1));
        const s1 = await getDocs(q1);
        if (!s1.empty) {
          refCache.set(id, true);
          return true;
        }
      } catch {}
      try {
        const q2 = query(atendimentosRef, where("atendente_preferencial_id", "==", id), limit(1));
        const s2 = await getDocs(q2);
        if (!s2.empty) {
          refCache.set(id, true);
          return true;
        }
      } catch {}
      refCache.set(id, false);
      return false;
    };

    const scoreAtendente = (a) => {
      let score = 0;
      const nome = String(a?.nome || "").trim();
      const cargo = String(a?.cargo || "").trim();
      const cras = String(a?.cras_id || "").trim();
      const tipos = Array.isArray(a?.tipos_atende) ? a.tipos_atende.length : 0;
      const salas = Array.isArray(a?.salas_permitidas) ? a.salas_permitidas.length : 0;
      const perms = Array.isArray(a?.permissions) ? a.permissions.length : 0;
      const guiche = String(a?.guiche || "").trim();
      const matricula = String(a?.matricula || "").trim();
      const status = simplify(a?.status);

      if (nome) score += 5;
      if (cargo) score += 4;
      if (cras) score += 4;
      score += Math.min(tipos, 5);
      score += Math.min(salas, 5);
      score += Math.min(perms, 5);
      if (guiche) score += 2;
      if (matricula) score += 1;
      if (status === "online") score += 6;
      else if (status === "ocupado") score += 5;
      else if (status === "pausa") score += 4;
      else if (status === "offline") score += 1;

      if (a?.createdAt) score += 1;
      return score;
    };

    setLoading(true);
    let fixed = 0;
    let deleted = 0;
    let skipped = 0;
    let migratedAtendimentos = 0;
    const errors = [];

    try {
      for (const [email, group] of byEmail.entries()) {
        try {
          const uidFromDoc = String(group.find((a) => a?.uid)?.uid || "").trim();
          const uid = uidFromDoc || (await getUidByEmail(email));
          if (!uid) {
            skipped++;
            continue;
          }

          const best = [...group].sort((a, b) => scoreAtendente(b) - scoreAtendente(a))[0] || {};
          const payload = { ...best };
          delete payload.id;
          payload.email = email;
          payload.uid = uid;
          payload.migrated_at = serverTimestamp();
          if (!payload.status) payload.status = "offline";

          await setDoc(doc(db, collectionPath, uid), payload, { merge: true });

          for (const ghost of group) {
            const ghostId = String(ghost?.id || "").trim();
            if (ghostId && ghostId !== uid) {
              const referenced = await isAtendenteIdReferenced(ghostId);
              if (referenced) {
                migratedAtendimentos += await migrateAtendimentosField({
                  field: "atendente_id",
                  fromId: ghostId,
                  toId: uid,
                });
                migratedAtendimentos += await migrateAtendimentosField({
                  field: "atendente_preferencial_id",
                  fromId: ghostId,
                  toId: uid,
                });

                await setDoc(
                  doc(db, collectionPath, ghostId),
                  { migrated_to_uid: uid, migrated_at: serverTimestamp() },
                  { merge: true }
                );
              } else {
                await deleteDoc(doc(db, collectionPath, ghostId));
                deleted++;
              }
            }
          }

          fixed++;
        } catch (e) {
          errors.push({ email, error: String(e?.message || e) });
        }
      }

      await logAdminAction(
        db,
        appId,
        userProfile,
        "FIX_ATENDENTE_UIDS",
        `Corrigiu vínculos: ${fixed}; migrados em atendimentos: ${migratedAtendimentos}; removidos: ${deleted}; ignorados: ${skipped}`,
        { fixed, migratedAtendimentos, deleted, skipped, errorsCount: errors.length }
      );

      const msg =
        `✅ Concluído.\n\n` +
        `Corrigidos: ${fixed}\n` +
        `Migrações em atendimentos: ${migratedAtendimentos}\n` +
        `Removidos (duplicados): ${deleted}\n` +
        `Ignorados (sem UID): ${skipped}\n` +
        (errors.length ? `\n⚠️ Erros: ${errors.length} (veja o console).` : "");
      if (errors.length) console.warn("Erros ao corrigir vínculos:", errors);
      alert(msg);
    } catch (e) {
      console.error(e);
      alert(getFriendlyFirebaseError(e, "Erro ao corrigir vínculos."));
    } finally {
      setLoading(false);
    }
  };

  const filteredBase = (userProfile?.role === 'coordenador' && userProfile?.cras_id) 
    ? atendentesList.filter(a => a.cras_id === userProfile.cras_id) 
    : atendentesList;

  // Ordena: Recentes (com createdAt) primeiro, depois por nome
  const listFiltered = [...filteredBase].sort((a, b) => {
      const getSeconds = (obj) => {
          if (!obj?.createdAt) return 0;
          if (obj.createdAt.seconds) return obj.createdAt.seconds; // Firestore Timestamp
          if (obj.createdAt instanceof Date) return obj.createdAt.getTime() / 1000;
          return 0;
      };

      const timeA = getSeconds(a);
      const timeB = getSeconds(b);

      if (timeA !== timeB) {
          return timeB - timeA; // Mais recente primeiro
      }
      
      return (a.nome || '').localeCompare(b.nome || '');
  });

  return {
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
    setLoading,
    setFormData,
    setEditingId,
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
    handleResetarStatus,
    handlePromoverASuperCoordenador,
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
    limparAtendentesProblematicos
  };
};

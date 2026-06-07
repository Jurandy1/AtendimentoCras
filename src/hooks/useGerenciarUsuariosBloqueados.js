import { useState, useEffect } from 'react';
import { 
  collection, query, where, orderBy, limit, startAfter, startAt, endAt, 
  onSnapshot, deleteDoc, doc, getDoc, getDocs, setDoc 
} from 'firebase/firestore';
import { logAdminAction } from '../utils/logger';
import { normalizeName } from '../utils/helpers';

export const useGerenciarUsuariosBloqueados = ({ db, appId, userProfile }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [termoBusca, setTermoBusca] = useState('');
  const [lastDocs, setLastDocs] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [cpfImportar, setCpfImportar] = useState('');
  const [motivoImportar, setMotivoImportar] = useState('');
  const ITENS_POR_PAGINA = 50;
  const collectionPath = `artifacts/${appId}/public/data/usuarios_bloqueados`;

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    
    let q = collection(db, collectionPath);
    
    if (termoBusca) {
        const isCpf = /^\d+$/.test(termoBusca.replace(/\D/g, ''));
        if (isCpf && termoBusca.replace(/\D/g, '').length > 3) {
             const cpfL = termoBusca.replace(/\D/g, '');
             q = query(q, where('cpf', '>=', cpfL), where('cpf', '<=', cpfL + '\uf8ff'), orderBy('cpf'), limit(ITENS_POR_PAGINA));
        } else {
             const termo = normalizeName(termoBusca);
             q = query(q, orderBy('nome'), startAt(termo), endAt(termo + '\uf8ff'), limit(ITENS_POR_PAGINA));
        }
    } else {
        q = query(q, orderBy('nome'), limit(ITENS_POR_PAGINA));
    }

    if (lastDocs.length > 0) {
        const lastDoc = lastDocs[lastDocs.length - 1];
        if (lastDoc) {
            q = query(q, startAfter(lastDoc));
        }
    }

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsuarios(list);
      setLastVisible(snap.docs[snap.docs.length - 1] || null);
      setLoading(false);
    }, (err) => {
        console.error("Erro busca usuarios bloqueados:", err);
        setLoading(false);
    });
    return () => unsub();
  }, [db, appId, termoBusca, lastDocs]);

  const handleSearchSubmit = () => {
      setTermoBusca(busca);
      setLastDocs([]);
  };

  const handleNextPage = () => {
      if (lastVisible) {
          setLastDocs(prev => [...prev, lastVisible]);
      }
  };

  const handlePrevPage = () => {
      setLastDocs(prev => {
          const newStack = [...prev];
          newStack.pop();
          return newStack;
      });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === usuarios.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(usuarios.map(u => u.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (!db || selectedIds.length === 0) return;
    if (!window.confirm(`Deseja realmente excluir ${selectedIds.length} usuário(s) bloqueado(s)?`)) return;
    setLoading(true);
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, collectionPath, id));
      }
      
      await logAdminAction(
        db, appId, 
        { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome }, 
        "DELETE_BLOCKED_USERS_MASS", 
        `Exclusão em massa: ${selectedIds.length} usuários bloqueados`, 
        { count: selectedIds.length, ids: selectedIds }
      );

      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  };

  const safeVal = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        if (val.toDate && typeof val.toDate === 'function') {
            return val.toDate().toLocaleDateString('pt-BR');
        }
        if (val instanceof Date) {
            return val.toLocaleDateString('pt-BR');
        }
        return '';
    }
    return String(val);
  };

  const handleImportarDaLista = async () => {
    if (!db) return;
    const cpfLimpo = (cpfImportar || '').replace(/\D/g, '');
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      alert('Informe um CPF válido com 11 dígitos para importar da lista de usuários.');
      return;
    }
    if (!motivoImportar.trim()) {
      alert('Informe o Motivo do desligamento.');
      return;
    }
    try {
      setLoading(true);
      const cidCollectionPath = `artifacts/${appId}/public/data/cidadaos`;
      let base = null;

      const docRef = doc(collection(db, cidCollectionPath), cpfLimpo);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        base = snap.data();
      } else {
        const q = query(
          collection(db, cidCollectionPath),
          where('cpf', '==', cpfLimpo)
        );
        const qsnap = await getDocs(q);
        if (!qsnap.empty) {
          base = qsnap.docs[0].data();
        }
      }

      if (!base) {
        alert('Usuário não encontrado na lista normal (cidadaos) para este CPF.');
        return;
      }

      const nomeBruto = base.nome || '';
      const nomeNorm = nomeBruto
        ? nomeBruto
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
        : '';

      const hoje = new Date();
      const dataDesligamento = hoje.toLocaleDateString('pt-BR');

      const docData = {
        nome: nomeBruto,
        cpf: cpfLimpo,
        nomeNormalizado: nomeNorm,
        motivoDesligamento: motivoImportar.trim(),
        dataDesligamento,
        demandaOrigem: base.origemDemanda || '',
        tecnicoDesligou: userProfile?.nome || userProfile?.email || '',
        dataAtendimentoInicial: base.dataCadastro || '',
        sexo: base.sexo || '',
        etnia: base.cor || '',
        orientacaoSexual: base.orientacaoSexual || '',
        religiao: base.religiao || '',
        dataNascimento: base.dataNascimento || '',
        nacionalidade: base.nacionalidade || '',
        naturalidade: base.naturalidade || '',
        identidade: base.rg || '',
        escolaridade: base.escolaridade || '',
        nomePai: base.nomePai || '',
        nomeMae: base.nomeMae || '',
        importadoEm: new Date(),
        origemImportacao: 'cidadaos_marcado_bloqueado'
      };

      const bloqueadoRef = doc(collection(db, collectionPath), cpfLimpo);
      await setDoc(bloqueadoRef, docData, { merge: true });

      await logAdminAction(
        db, appId,
        { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome },
        "IMPORT_BLOCKED_USER_FROM_LIST",
        `Importou usuário da lista principal para bloqueados: ${docData.nome}`,
        { cpf: cpfLimpo, motivo: docData.motivoDesligamento }
      );

      setCpfImportar('');
      setMotivoImportar('');
      alert('Usuário importado da lista normal e marcado como desligado com sucesso.');
    } catch (err) {
      console.error('Erro ao importar usuário da lista normal para desligados:', err);
      alert('Erro ao importar usuário. Verifique o console para detalhes.');
    } finally {
      setLoading(false);
    }
  };

  return {
    usuarios,
    loading,
    busca,
    setBusca,
    handleSearchSubmit,
    handleNextPage,
    handlePrevPage,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    handleDeleteSelected,
    cpfImportar,
    setCpfImportar,
    motivoImportar,
    setMotivoImportar,
    handleImportarDaLista,
    safeVal,
    lastDocs,
    lastVisible,
    ITENS_POR_PAGINA,
    termoBusca
  };
};

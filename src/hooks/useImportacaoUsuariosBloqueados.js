import { useState } from 'react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { logAdminAction } from '../utils/logger';

export const useImportacaoUsuariosBloqueados = ({ db, appId, userProfile }) => {
  const [texto, setTexto] = useState('');
  const [dadosPreview, setDadosPreview] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [importando, setImportando] = useState(false);
  const [logErro, setLogErro] = useState([]);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [filtro, setFiltro] = useState('');
  const [linhasIgnoradasDetalhe, setLinhasIgnoradasDetalhe] = useState([]);

  const processarTexto = () => {
    if (!texto.trim()) {
      alert('Cole o conteúdo da planilha primeiro.');
      return;
    }

    setResumo(null);
    setLinhasIgnoradasDetalhe([]);

    const linhas = texto.trim().split('\n');
    const dados = [];
    const detalhesIgnorados = [];
    let totalLinhasValidas = 0;
    let linhasIgnoradas = 0;

    let inicio = 0;
    const primeiraLinha = linhas[0].toLowerCase();
    if (primeiraLinha.includes('data do desligamento') || primeiraLinha.includes('nome do usuário')) {
      inicio = 1;
    }

    for (let i = inicio; i < linhas.length; i++) {
      const linhaLimpa = linhas[i].replace(/\r/g, '');
      const numeroLinhaPlanilha = i + 1;
      if (!linhaLimpa.trim()) {
        linhasIgnoradas += 1;
        detalhesIgnorados.push({
          linha: numeroLinhaPlanilha,
          motivo: 'Linha em branco',
          preview: ''
        });
        continue;
      }

      const colunas = linhaLimpa.split('\t');
      totalLinhasValidas += 1;

      const nomeBruto = colunas[6]?.trim() || '';
      const dado = {
        dataDesligamento: colunas[0]?.trim() || '',
        motivoDesligamento: colunas[1]?.trim() || '',
        demandaOrigem: colunas[2]?.trim() || '',
        tecnicoDesligou: colunas[3]?.trim() || '',
        dataAtendimentoInicial: colunas[4]?.trim() || '',
        sexo: colunas[5]?.trim() || '',
        nome: nomeBruto,
        etnia: colunas[7]?.trim() || '',
        orientacaoSexual: colunas[8]?.trim() || '',
        religiao: colunas[9]?.trim() || '',
        dataNascimento: colunas[10]?.trim() || '',
        nacionalidade: colunas[11]?.trim() || '',
        naturalidade: colunas[12]?.trim() || '',
        identidade: colunas[13]?.trim() || '',
        cpf: (colunas[14]?.trim() || '').replace(/\D/g, ''),
        escolaridade: colunas[15]?.trim() || '',
        nomePai: colunas[16]?.trim() || '',
        nomeMae: colunas[17]?.trim() || '',
        nomeNormalizado: nomeBruto
          ? nomeBruto
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
          : '',
        importadoEm: new Date(),
        origemImportacao: 'planilha_usuarios_bloqueados'
      };

      if (dado.nome || dado.cpf) {
        dados.push(dado);
      } else {
        linhasIgnoradas += 1;
        let motivo = 'Sem nome e sem CPF';
        if (!linhaLimpa.includes('\t')) {
          if (linhaLimpa.includes(';')) {
            motivo = 'Possível uso de ponto e vírgula (;) em vez de TAB';
          } else {
            motivo = 'Formato inesperado (sem colunas separadas por TAB)';
          }
        }
        detalhesIgnorados.push({
          linha: numeroLinhaPlanilha,
          motivo,
          preview: linhaLimpa.slice(0, 120)
        });
      }
    }

    setDadosPreview(dados);
    setResumo({
      totalLinhas: totalLinhasValidas,
      validos: dados.length,
      ignorados: linhasIgnoradas
    });
    setLinhasIgnoradasDetalhe(detalhesIgnorados);
    if (dados.length === 0) {
      alert('Nenhum dado válido encontrado. Verifique se o texto está separado por tabulações (copiado do Excel).');
    }
  };

  const handleImportar = async () => {
    if (dadosPreview.length === 0) return;
    if (!window.confirm(`Confirma a importação de ${dadosPreview.length} usuários bloqueados?`)) return;

    setImportando(true);
    setLogErro([]);
    setProgresso({ atual: 0, total: dadosPreview.length });

    const collectionRef = collection(db, `artifacts/${appId}/public/data/usuarios_bloqueados`);
    const BATCH_SIZE = 400;
    const erros = [];
    let count = 0;

    const chunks = [];
    for (let i = 0; i < dadosPreview.length; i += BATCH_SIZE) {
      chunks.push(dadosPreview.slice(i, i + BATCH_SIZE));
    }

    try {
      for (const chunk of chunks) {
        const batch = writeBatch(db);

        chunk.forEach(dado => {
          if (dado.cpf && dado.cpf.length === 11) {
            const docRef = doc(collectionRef, dado.cpf);
            batch.set(docRef, dado, { merge: true });
          } else {
            const docRef = doc(collectionRef);
            batch.set(docRef, dado);
          }
        });

        await batch.commit();
        count += chunk.length;
        setProgresso(prev => ({ ...prev, atual: count }));
      }

      await logAdminAction(
          db, appId, 
          { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome }, 
          "IMPORT_BLOCKED_USERS_MASS", 
          `Importação em massa (Bloqueados): ${count} usuários`, 
          { total: count }
      );

      alert('Importação de usuários bloqueados concluída com sucesso!');
      setTexto('');
      setDadosPreview([]);
    } catch (error) {
      console.error('Erro na importação de bloqueados:', error);
      erros.push(error.message);
      setLogErro(erros);
      alert('Ocorreu um erro durante a importação. Verifique o console.');
    } finally {
      setImportando(false);
    }
  };

  return {
    texto,
    setTexto,
    dadosPreview,
    resumo,
    importando,
    logErro,
    progresso,
    filtro,
    setFiltro,
    linhasIgnoradasDetalhe,
    processarTexto,
    handleImportar
  };
};

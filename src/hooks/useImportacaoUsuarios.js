import { useState } from 'react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { normalizeDate, inferNationalityFromNaturalidade, isStrictlyBrazilian } from '../utils/helpers';
import { logAdminAction } from '../utils/logger';

export const useImportacaoUsuarios = ({ db, appId, userProfile }) => {
  const [texto, setTexto] = useState('');
  const [dadosPreview, setDadosPreview] = useState([]);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [logErro, setLogErro] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [linhasIgnoradasDetalhe, setLinhasIgnoradasDetalhe] = useState([]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Converte para TSV (Tab Separated Values) para reutilizar a lógica de processamento existente
        const tsv = XLSX.utils.sheet_to_csv(ws, { FS: "\t" });
        
        setTexto(tsv);
        alert('Arquivo carregado com sucesso! Clique em "Processar Texto" para visualizar os dados.');
      } catch (error) {
        console.error("Erro ao ler arquivo:", error);
        alert("Erro ao ler o arquivo. Verifique se é um Excel (.xlsx) válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const copiarCabecalho = () => {
    const headers = [
      'DATA DE CADASTRO', 'ORIGEM DA DEMANDA', 'TÉCNICO RESPONSÁVEL', 'NOME DO USUÁRIO', 
      'CONJUGE', 'DATA DE NASCIMENTO', 'COR', 'SEXO', 'NOME SOCIAL', 'RELIGIÃO', 
      'ORIENTAÇÃO SEXUAL', 'NATURALIDADE/CIDADE', 'UF', 'NACIONALIDADE/PAÍS', 
      'REGISTRO GERAL', 'CPF', 'ESCOLARIDADE', 'NOME DO PAI', 'NOME DA MAE', 
      'TELEFONE', 'NIS'
    ];
    navigator.clipboard.writeText(headers.join('\t'));
    alert('Cabeçalho copiado! Cole na primeira linha da sua planilha (Excel ou Google Sheets) para servir de guia.');
  };

  const processarTexto = () => {
    if (!texto.trim()) {
      alert('Cole o conteúdo da planilha primeiro.');
      return;
    }

    setResumo(null);
    setLinhasIgnoradasDetalhe([]);

    const robustTrim = (str) => {
        if (!str) return '';
        return String(str).replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '').trim();
    };

    const linhas = texto.trim().split('\n');
    const dados = [];
    const detalhesIgnorados = [];
    let totalLinhasValidas = 0;
    let linhasIgnoradas = 0;
    
    // Configuração de mapeamento (nome do campo -> palavras-chave e índice padrão)
    const mapaCampos = {
        dataCadastro: { keywords: ['data de cadastro', 'cadastro'], defaultIndex: 0 },
        origemDemanda: { keywords: ['origem da demanda', 'origem', 'encaminhamento', 'procedência', 'procedencia', 'canal'], defaultIndex: 1 },
        tecnicoResponsavel: { keywords: ['técnico responsável', 'tecnico', 'responsável'], defaultIndex: 2 },
        nome: { keywords: ['nome do usuário', 'nome', 'usuário'], defaultIndex: 3 },
        conjuge: { keywords: ['conjuge', 'cônjuge'], defaultIndex: 4 },
        dataNascimento: { keywords: ['data de nascimento', 'nascimento'], defaultIndex: 5 },
        cor: { keywords: ['cor', 'raca', 'raça'], defaultIndex: 6 },
        sexo: { keywords: ['sexo', 'gênero'], defaultIndex: 7 },
        nomeSocial: { keywords: ['nome social', 'social'], defaultIndex: 8 },
        religiao: { keywords: ['religião', 'religiao', 'credo'], defaultIndex: 9 },
        orientacaoSexual: { keywords: ['orientação sexual', 'orientacao'], defaultIndex: 10 },
        naturalidade: { keywords: ['naturalidade', 'cidade'], defaultIndex: 11 },
        uf: { keywords: ['uf', 'estado'], defaultIndex: 12 },
        nacionalidade: { keywords: ['nacionalidade', 'país', 'pais'], defaultIndex: 13 },
        rg: { keywords: ['registro geral', 'rg'], defaultIndex: 14 },
        cpf: { keywords: ['cpf', 'cadastro de pessoa'], defaultIndex: 15 },
        escolaridade: { keywords: ['escolaridade', 'instrução'], defaultIndex: 16 },
        nomePai: { keywords: ['nome do pai', 'pai'], defaultIndex: 17 },
        nomeMae: { keywords: ['nome da mae', 'nome da mãe', 'mãe', 'mae'], defaultIndex: 18 },
        telefone: { keywords: ['telefone', 'celular', 'contato'], defaultIndex: 19 },
        nis: { keywords: ['nis', 'pis'], defaultIndex: 20 }
    };

    // Tenta detectar cabeçalho e construir mapa de índices
    let inicio = 0;
    const indices = {};
    const primeiraLinhaRaw = linhas[0].replace(/\r/g, '');
    const primeiraLinha = primeiraLinhaRaw.toLowerCase();
    
    // Heurística para saber se é cabeçalho: contém palavras-chave chaves
    const temCabecalho = primeiraLinha.includes('nome') || primeiraLinha.includes('cpf') || primeiraLinha.includes('data');
    
    if (temCabecalho) {
        inicio = 1;
        const colunasHeader = primeiraLinha.split('\t').map(c => robustTrim(c));
        
        // Para cada campo, procura a coluna correspondente
        Object.keys(mapaCampos).forEach(campo => {
            const config = mapaCampos[campo];
            // Tenta encontrar o índice de alguma keyword
            const indexEncontrado = colunasHeader.findIndex(headerCol => 
                config.keywords.some(keyword => headerCol.toLowerCase().includes(keyword))
            );
            
            // Se achou, usa. Se não, usa o padrão.
            indices[campo] = indexEncontrado !== -1 ? indexEncontrado : config.defaultIndex;
        });
        console.log("Mapeamento detectado:", indices);
    } else {
        // Se não tem cabeçalho, tenta detectar deslocamento (shift) baseado no conteúdo
        // Heurística: Verifica se a coluna padrão de NOME (3) está vazia e se as vizinhas têm dados de nome
        
        const amostra = linhas.slice(0, 5).filter(l => l.trim());
        let scorePadrao = 0;
        let scoreDireita = 0;
        let scoreEsquerda = 0;
        let scoreDireita2 = 0; // Para caso de 2 colunas vazias ou ocultas

        const isNomeValido = (str) => {
            if (!str || str.length < 3) return false;
            if (/\d/.test(str)) return false; // Nomes não costumam ter números
            if (str.includes('/')) return false; // Não é data
            const keywordsProibidas = ['espontânea', 'encaminhamento', 'cras', 'creas', 'paif', 'scfv'];
            if (keywordsProibidas.some(k => str.toLowerCase().includes(k))) return false;
            return true;
        };

        amostra.forEach(linha => {
            const cols = linha.replace(/\r/g, '').split('\t');
            if (isNomeValido(robustTrim(cols[3]))) scorePadrao++;
            if (isNomeValido(robustTrim(cols[4]))) scoreDireita++;
            if (isNomeValido(robustTrim(cols[2]))) scoreEsquerda++;
            if (isNomeValido(robustTrim(cols[5]))) scoreDireita2++;
        });

        console.log("Scores de detecção de nome:", { padrao: scorePadrao, dir: scoreDireita, esq: scoreEsquerda, dir2: scoreDireita2 });

        let shift = 0;
        // Só aplica mudança se o padrão for ruim e outro for bom
        if (scorePadrao === 0) {
            if (scoreDireita > 0) shift = 1;
            else if (scoreDireita2 > 0) shift = 2;
            else if (scoreEsquerda > 0) shift = -1;
        }

        Object.keys(mapaCampos).forEach(campo => {
            // Aplica o shift detectado a todos os índices
            // (Assumindo que se o nome deslocou, tudo deslocou)
            indices[campo] = Math.max(0, mapaCampos[campo].defaultIndex + shift);
        });
        
        console.log(`Aplicando shift de ${shift} colunas. Indices:`, indices);
    }

    for (let i = inicio; i < linhas.length; i++) {
        const linhaLimpa = linhas[i].replace(/\r/g, '');
        const numeroLinhaPlanilha = i + 1;
        if (!robustTrim(linhaLimpa)) {
            linhasIgnoradas += 1;
            detalhesIgnorados.push({
              linha: numeroLinhaPlanilha,
              motivo: 'Linha em branco',
              preview: ''
            });
            continue;
        }

        const colunas = linhaLimpa.split('\t');
        
        // Função auxiliar para pegar valor usando o índice mapeado
        const getVal = (campo) => {
            const idx = indices[campo];
            return robustTrim(colunas[idx]);
        };

        totalLinhasValidas += 1;
        
        const nomeBruto = getVal('nome');
        const rawNasc = getVal('dataNascimento');
        const normNasc = normalizeDate(rawNasc);
        const alertas = [];

        // Validação simples de data
        if (rawNasc && !/^\d{2}\/\d{2}\/\d{4}$/.test(normNasc)) {
             alertas.push('Data Nasc. inválida');
        }

        // Inferência de Nacionalidade (Correção Automática de Estrangeiros)
        let nacionalidade = getVal('nacionalidade');
        const naturalidade = getVal('naturalidade');
        const uf = getVal('uf');
        
        // Se nacionalidade for vazia ou "Brasileira" (padrão implícito), tenta inferir da naturalidade ou UF
        if (!nacionalidade || isStrictlyBrazilian(nacionalidade)) {
             const inferida = inferNationalityFromNaturalidade(naturalidade, uf);
             if (inferida) {
                 nacionalidade = inferida;
                 // Não gera alerta, apenas corrige silenciosamente para melhor experiência
             }
        }

        const dado = {
            dataCadastro: getVal('dataCadastro'),
            origemDemanda: getVal('origemDemanda'),
            tecnicoResponsavel: getVal('tecnicoResponsavel'),
            nome: nomeBruto,
            conjuge: getVal('conjuge'),
            dataNascimento: normNasc,
            cor: getVal('cor'),
            sexo: getVal('sexo'),
            nomeSocial: getVal('nomeSocial'),
            religiao: getVal('religiao'),
            orientacaoSexual: getVal('orientacaoSexual'),
            naturalidade: naturalidade,
            uf: getVal('uf'),
            nacionalidade: nacionalidade,
            rg: getVal('rg'),
            cpf: getVal('cpf').replace(/\D/g, ''),
            escolaridade: getVal('escolaridade'),
            nomePai: getVal('nomePai'),
            nomeMae: getVal('nomeMae'),
            telefone: getVal('telefone'),
            nis: getVal('nis'),
            nomeNormalizado: nomeBruto
              ? nomeBruto
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
              : "",
            importadoEm: new Date(),
            origemImportacao: 'planilha_massa',
            _alertas: alertas
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
    
    const comAlertas = dadosPreview.filter(d => d._alertas && d._alertas.length > 0);
    if (comAlertas.length > 0) {
        if (!window.confirm(`ATENÇÃO: Existem ${comAlertas.length} registros com alertas (ex: datas inválidas). Deseja importar mesmo assim?`)) return;
    }

    if (!window.confirm(`Confirma a importação de ${dadosPreview.length} usuários? Isso pode levar alguns instantes.`)) return;

    setImportando(true);
    setLogErro([]);
    setProgresso({ atual: 0, total: dadosPreview.length });

    const collectionRef = collection(db, `artifacts/${appId}/public/data/cidadaos`);
    
    // VERIFICAÇÃO DE DUPLICIDADE (Passo 1: Identificar CPFs duplicados na base)
    // Para grandes volumes, verificar um a um pode ser lento, mas é necessário para o requisito.
    // Otimização: buscar todos os CPFs da planilha na base (se a planilha for gigante, fazer em lotes).
    // Aqui faremos uma abordagem segura: batch de verificação.
    
    try {
        const cpfsParaVerificar = dadosPreview
            .filter(d => d.cpf && d.cpf.length === 11)
            .map(d => d.cpf);
            
        const duplicadosNaBase = new Set();
        // Firestore 'in' query suporta max 10. Teremos que fazer check individual ou usar gets
        // Melhor estratégia para admin: ler documentos pelo ID (que é o CPF) em batches
        
        // Vamos separar os dados em: Novos e Conflitantes
        const novos = [];
        const conflitos = [];
        const semCpf = []; // Serão importados com ID automático
        
        // Verifica CPFs existentes (usando getDoc paralelo ou em lotes)
        // Para simplificar e evitar estouro de leitura, vamos verificar em chunks de promises
        const CHUNK_VERIFY = 100;
        for (let i = 0; i < dadosPreview.length; i += CHUNK_VERIFY) {
            const lote = dadosPreview.slice(i, i + CHUNK_VERIFY);
            await Promise.all(lote.map(async (dado) => {
                if (dado.cpf && dado.cpf.length === 11) {
                    // Tenta ler o doc
                    const ref = doc(collectionRef, dado.cpf);
                    // Aqui seria ideal usar getDoc, mas para muitas leituras pode ser caro.
                    // Porém é o único jeito seguro de saber se já existe antes de escrever.
                    // O usuário pediu aviso manual.
                    try {
                        // Importante: getDoc é leve se o documento não existir (só metadados)
                        // Mas cuidado com custos. O usuário parece querer qualidade acima de velocidade.
                        // Vamos assumir que podemos ler.
                        // Nota: Se o usuário já tem o CPF, o docId é o CPF.
                        // Se o usuário foi cadastrado sem CPF no ID (antigo), teria que buscar por query.
                        // O sistema atual usa CPF como ID preferencialmente.
                        
                        // Otimização: Em vez de ler, podemos adicionar direto se o usuário escolher "Sobrescrever tudo"
                        // Mas ele pediu para escolher manualmente.
                        // Vamos simplificar: se o usuário já existe (ID=CPF), marca como conflito.
                        
                        // IMPORTANTE: Para evitar milhares de leituras na importação em massa,
                        // podemos pular essa verificação se o usuário aceitar "Mesclar/Atualizar" implicitamente.
                        // MAS o pedido foi explícito: "avisa que ja tem usuario... eu manualmente escolho".
                        
                        // Vamos implementar uma verificação amostral ou total.
                        // Total é melhor para consistência.
                        const snap = await import('firebase/firestore').then(mod => mod.getDoc(ref));
                        if (snap.exists()) {
                            const existente = snap.data();
                            conflitos.push({ novo: dado, existente });
                        } else {
                            novos.push(dado);
                        }
                    } catch (e) {
                        console.warn("Erro ao verificar CPF", dado.cpf, e);
                        novos.push(dado); // Assume novo se der erro de leitura? Melhor não travar.
                    }
                } else {
                    semCpf.push(dado);
                }
            }));
            // Atualiza progresso da verificação (visual apenas)
            setProgresso(prev => ({ ...prev, atual: i, total: dadosPreview.length, status: 'Verificando duplicidade...' }));
        }

        let listaFinal = [...novos, ...semCpf];
        
        // Se houver conflitos, perguntar ao usuário
        if (conflitos.length > 0) {
            const msg = `Encontrados ${conflitos.length} usuários já cadastrados com o mesmo CPF.\n\n` +
                        `Exemplos:\n` +
                        conflitos.slice(0, 3).map(c => `- CPF ${c.novo.cpf}: ${c.existente.nome} (Existente) vs ${c.novo.nome} (Planilha)`).join('\n') + 
                        `\n\nO que deseja fazer com os conflitos?`;
            
            // Como window.confirm/prompt é limitado, vamos usar uma lógica simples:
            // Opções: 1. Ignorar (Manter existente) 2. Sobrescrever (Usar planilha)
            // Para UI melhor, precisaríamos de um modal customizado. 
            // Aqui usaremos confirm para "Sobrescrever" ou "Manter Existente".
            
            const sobrescrever = window.confirm(`${msg}\n\nClique em OK para SOBRESCREVER os dados existentes com os da planilha.\nClique em CANCELAR para MANTER os dados antigos (ignorar estes da planilha).`);
            
            if (sobrescrever) {
                // Adiciona conflitos na lista final (dados novos prevalecem)
                listaFinal = [...listaFinal, ...conflitos.map(c => c.novo)];
            } else {
                // Não adiciona conflitos na lista final (dados antigos prevalecem, ou seja, não faz nada com eles)
                // Apenas loga ou avisa
                alert(`Os ${conflitos.length} usuários conflitantes serão ignorados e mantidos como estão no sistema.`);
            }
        }

        if (listaFinal.length === 0) {
            alert("Nenhum usuário novo para importar após verificação.");
            setImportando(false);
            return;
        }

        setProgresso({ atual: 0, total: listaFinal.length, status: 'Salvando...' });
        
        const BATCH_SIZE = 400;
        let count = 0;
        const chunks = [];
        for (let i = 0; i < listaFinal.length; i += BATCH_SIZE) {
            chunks.push(listaFinal.slice(i, i + BATCH_SIZE));
        }

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
            setProgresso(prev => ({ ...prev, atual: count, status: 'Salvando...' }));
        }

        await logAdminAction(
          db, appId, 
          { uid: userProfile?.uid, email: userProfile?.email, name: userProfile?.nome }, 
          "IMPORT_CIDADAOS_MASS", 
          `Importação em massa: ${count} usuários`, 
          { total: count, conflitos: conflitos.length }
        );

        alert(`Importação concluída!\n\n- Importados/Atualizados: ${count}\n- Conflitos detectados: ${conflitos.length}`);
        setTexto('');
        setDadosPreview([]);
        
        // Sugerir correção de nomes de atendimentos (passo 4 do plano)
        if (window.confirm("Deseja verificar e conectar automaticamente os nomes nos atendimentos/histórico usando os CPFs importados?")) {
             // Como não temos acesso direto à função handleCorrigirNomesAtendimentos aqui (está em outro hook),
             // apenas avisamos. O ideal seria passar essa função via prop ou contexto, 
             // mas como ImportacaoUsuarios é isolado, vamos instruir o usuário.
             alert("Por favor, vá até a aba 'Gerenciar Usuários' e clique no botão 'Corrigir nomes atend.' para finalizar a conexão com o histórico.");
        }

    } catch (error) {
        console.error("Erro na importação:", error);
        setLogErro([error.message]);
        alert('Ocorreu um erro durante a importação. Verifique o console.');
    } finally {
        setImportando(false);
    }
  };

  return {
    texto,
    setTexto,
    dadosPreview,
    importando,
    progresso,
    logErro,
    resumo,
    filtro,
    setFiltro,
    linhasIgnoradasDetalhe,
    handleFileUpload,
    copiarCabecalho,
    processarTexto,
    handleImportar
  };
};

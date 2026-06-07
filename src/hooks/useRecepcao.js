import { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  getDoc,
  deleteDoc,
  limit,
  orderBy,
  runTransaction
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
// Bug C1: Importação do storage tratada como opcional para evitar quebra do módulo
import * as firebaseExports from "../firebase";
const storage = firebaseExports.storage || null;

import { 
  getFriendlyFirebaseError,
  normalizeName, 
  getNomeCidadao,
  simplify, 
  normalizeDate, 
  normalizeDateForInput, 
  validateCPF,
  logAdminAction
} from "../utils";
import { normalizeRole } from "../utils";

export const useRecepcao = ({ db, appId, userProfile, crasUnidades, tiposAtendimento, atendentesList, isTestMode }) => {
  const [formData, setFormData] = useState({
    nome: "",
    nomeSocial: "",
    cpf: "",
    rg: "",
    nis: "",
    tituloEleitor: "",
    tituloEleitorZona: "",
    tituloEleitorSecao: "",
    telefone: "",
    dataNascimento: "",
    sexo: "",
    nomeMae: "",
    nomePai: "",
    conjuge: "",
    nacionalidade: "Brasileira",
    naturalidade: "São Luís",
    naturalidadeIbgeId: "",
    uf: "MA",
    cor: "",
    escolaridade: "",
    tecnicoResponsavel: "",
    religiao: "",
    orientacaoSexual: "",
    cras_id: "",
    tipo_atendimento_id: "",
    prioridade: false,
    foto: null,
  });
  const [registrandoAtendimento, setRegistrandoAtendimento] = useState(false); // Renomeado N2
  const [nomeRegistrado, setNomeRegistrado] = useState(null); // Renomeado N1
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null); // M3b Fix: Sucesso não bloqueante
  const [buscandoCidadao, setBuscandoCidadao] = useState(false);
  const [filaRecepcao, setFilaRecepcao] = useState([]);
  const [filaAusentes, setFilaAusentes] = useState([]);
  const [filaError, setFilaError] = useState(null);
  const [filaBusy, setFilaBusy] = useState(null);
  const [cpfBloqueadoInfo, setCpfBloqueadoInfo] = useState(null);
  const [cidadaoOutraUnidadeInfo, setCidadaoOutraUnidadeInfo] = useState(null);
  const [cidadaoOutraUnidadePending, setCidadaoOutraUnidadePending] = useState(null);
  const [crossUnitConfirmado, setCrossUnitConfirmado] = useState(false);
  const [admitirDesligadoConfirmado, setAdmitirDesligadoConfirmado] = useState(false);
  const [possiveisBloqueadosNome, setPossiveisBloqueadosNome] = useState([]);
  const [mostrarModalBloqueioNome, setMostrarModalBloqueioNome] = useState(false);
  const [dadosOriginais, setDadosOriginais] = useState(null);
  const [expedienteIniciado, setExpedienteIniciado] = useState(false);
  const [loadingExpediente, setLoadingExpediente] = useState(true);
  const userUid = userProfile?.uid || userProfile?.id || null;

  // Cache para evitar leituras repetidas na mesma sessão
  // M9 Fix: TTL de 5 minutos para o cache
  const searchCache = useRef(new Map());
  const CACHE_TTL = 5 * 60 * 1000; 

  const getFromCache = (cpf) => {
      const entry = searchCache.current.get(cpf);
      if (entry && (Date.now() - entry.ts < CACHE_TTL)) {
          return entry.data;
      }
      return null;
  };

  const setInCache = (cpf, data) => {
      searchCache.current.set(cpf, { ts: Date.now(), data });
  };
  const profileSyncedRef = useRef(false);

  const defaultCentroPopCentroId = useMemo(() => {
    const list = Array.isArray(crasUnidades) ? crasUnidades : [];
    const alvo = simplify("Centro Pop Centro");
    return (
      list.find((c) => simplify(c?.nome) === alvo)?.id ||
      list.find((c) => simplify(c?.nome).includes(alvo))?.id ||
      null
    );
  }, [crasUnidades]);

  const inferirCrasPrincipalPorHistorico = async (cpf) => {
    if (!db || !appId || !cpf || cpf.length !== 11) return null;
    try {
      const collectionPath = `artifacts/${appId}/public/data/atendimentos`;
      const q = query(
        collection(db, collectionPath),
        where("cidadao.cpf", "==", cpf),
        orderBy("hora_chegada", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0]?.data() || {};
      return d.cras_id || null;
    } catch {
      return null;
    }
  };

  // Verificar status inicial do expediente
    useEffect(() => {
      // Se for admin, coordenador ou superintendente, não precisa de expediente
      // Considera iniciado automaticamente para não bloquear a tela
      const roleNorm = normalizeRole(userProfile?.role);
      if (["admin", "coordenador", "superintendente", "master", "super_admin"].includes(roleNorm)) {
          setExpedienteIniciado(true);
          setLoadingExpediente(false);
          return;
      }

      if (!db || !appId || !userUid) {
        setExpedienteIniciado(false);
        setLoadingExpediente(false);
        return;
      }
  
      const checkStatus = async () => {
        try {
            const atendenteRef = doc(db, `artifacts/${appId}/public/data/atendentes`, userUid);
            const snap = await getDoc(atendenteRef);
            
            if (snap.exists() && snap.data().status === 'online') {
                setExpedienteIniciado(true);
            } else {
                setExpedienteIniciado(false);
            }
        } catch (e) {
            console.error("Erro ao verificar status do expediente:", e);
        } finally {
            setLoadingExpediente(false);
        }
    };

    checkStatus();
  }, [db, appId, userProfile, userUid]);

  const iniciandoExpedienteRef = useRef(false);
  const iniciarExpediente = async () => {
     if (!db || !appId) return;
     if (!userUid) {
       alert("Aguarde o carregamento do perfil e tente novamente.");
       return;
     }
     if (iniciandoExpedienteRef.current) return; // Evita cliques duplos
     iniciandoExpedienteRef.current = true;
     try {
         setLoadingExpediente(true);
         const atendenteRef = doc(db, `artifacts/${appId}/public/data/atendentes`, userUid);
         
         const roleCandidate = userProfile?.role || userProfile?.roleNorm || userProfile?.cargo || 'recepcionista';
         const roleNormalized = normalizeRole(roleCandidate) || 'recepcionista';
         const emailNorm = (userProfile?.email || "").toString().trim().toLowerCase();

         const data = {
             status: 'online',
             ultimo_login: serverTimestamp(),
             nome: userProfile.nome || userProfile.email,
             email: emailNorm,
             role: roleNormalized,
             uid: userUid
         };

         await setDoc(atendenteRef, data, { merge: true });

         // Sincroniza perfil do recepcionista uma vez por sessão
         if (!profileSyncedRef.current && emailNorm) {
           const perfilBase = {
             email: emailNorm,
             nome: userProfile.nome || emailNorm,
             role: roleNormalized,
             roleNorm: roleNormalized,
             cras_id: userProfile?.cras_id || "",
             cargo: userProfile?.cargo || "",
             permissions: Array.isArray(userProfile?.permissions) ? userProfile.permissions : [],
           };
           try {
             await setDoc(
               doc(db, `artifacts/${appId}/public/data/users`, userUid),
               perfilBase,
               { merge: true }
             );
           } catch {}
           try {
             await setDoc(
               doc(db, `artifacts/${appId}/public/data/users_by_email`, emailNorm),
               perfilBase,
               { merge: true }
             );
           } catch {}
           profileSyncedRef.current = true;
         }

         setExpedienteIniciado(true);
         await logAdminAction(db, appId, userProfile, "INICIO_EXPEDIENTE", "Iniciou expediente na recepção");
     } catch (e) {
         console.error("Erro ao iniciar expediente:", e);
         const msg = getFriendlyFirebaseError(e, "Erro ao iniciar expediente. Tente novamente ou contate o suporte.");
         setError(msg);
     } finally {
         setLoadingExpediente(false);
         iniciandoExpedienteRef.current = false;
     }
  };

  const encerrarExpediente = async () => {
      if (!db || !appId || !userUid) return;

      try {
          setLoadingExpediente(true);
          const atendenteRef = doc(db, `artifacts/${appId}/public/data/atendentes`, userUid);
          await setDoc(
            atendenteRef,
            {
              status: "offline",
              ultimo_logout: serverTimestamp(),
            },
            { merge: true }
          );
          
          setExpedienteIniciado(false);
          await logAdminAction(db, appId, userProfile, "FIM_EXPEDIENTE", "Encerrou expediente na recepção");
      } catch (e) {
          console.error("Erro ao encerrar expediente:", e);
          setError(getFriendlyFirebaseError(e, "Erro ao encerrar expediente."));
      } finally {
          setLoadingExpediente(false);
      }
  };

  const tipoById = useMemo(() => {
    const m = new Map();
    (tiposAtendimento || []).forEach((t) => {
      if (t && t.id) m.set(t.id, t);
    });
    return m;
  }, [tiposAtendimento]);

  // Inicialização do cras_id: prioriza userProfile, depois localStorage, depois unidade única
  useEffect(() => {
    if (typeof window === "undefined") return;
    setFormData((prev) => {
      // 1. Se userProfile tem cras_id (recepcionista vinculado a unidade), prioriza
      const crasDoPerfil = userProfile?.cras_id;
      if (crasDoPerfil && crasUnidades?.some((c) => c.id === crasDoPerfil)) {
        try {
          window.localStorage.setItem("recepcao_last_cras_id", crasDoPerfil);
        } catch {}
        return { ...prev, cras_id: crasDoPerfil };
      }
      // 2. Tenta localStorage (última unidade usada)
      try {
        const stored = window.localStorage.getItem("recepcao_last_cras_id");
        if (stored && crasUnidades?.some((c) => c.id === stored)) {
          return { ...prev, cras_id: stored };
        }
      } catch {}
      // 3. Se há apenas uma unidade, usa ela
      if (crasUnidades?.length === 1 && crasUnidades[0]?.id) {
        try {
          window.localStorage.setItem("recepcao_last_cras_id", crasUnidades[0].id);
        } catch {}
        return { ...prev, cras_id: crasUnidades[0].id };
      }
      return prev;
    });
  }, [userProfile?.cras_id, crasUnidades]);

  const normalizeSexo = (val, prev) => {
    const raw = (val || prev || "").toString().trim();
    if (!raw) return prev;
    if (raw === "M" || raw === "F" || raw === "Outro") return raw;
    const l = raw.toLowerCase();
    if (l.startsWith("m")) return "M";
    if (l.startsWith("f")) return "F";
    if (l.includes("outro")) return "Outro";
    return prev || "";
  };

  const normalizeNacionalidade = (val, prev) => {
    const raw = (val || prev || "").toString().trim();
    if (!raw) return prev;
    const l = simplify(raw);
    if (l === "brasileira" || l === "brasil") return "Brasileira";
    return raw; // Mantém o que foi digitado se não for o padrão
  };

  const isBrasileiro = (nacionalidade) => {
    const l = simplify((nacionalidade || "").toString().trim());
    if (!l) return true;
    return l === "brasil" || l.startsWith("brasileir");
  };

  const normalizeCor = (val, prev) => {
    const raw = (val || prev || "").toString().trim();
    if (!raw) return prev;
    const l = simplify(raw);
    if (l.includes("branc")) return "Branca";
    if (l.includes("pret") || l.includes("negr")) return "Preta";
    if (l.includes("pard")) return "Parda";
    if (l.includes("amar")) return "Amarela";
    if (l.includes("indig")) return "Indigena";
    return prev || "";
  };

  const normalizeEscolaridade = (val, prev) => {
    const raw = (val || prev || "").toString().trim();
    if (!raw) return prev;
    const l = simplify(raw);
    const isIncompleto =
      l.includes("incompl") || l.includes("incomplet") || l.includes("incompleto");
    if (l.includes("analf")) return "Analfabeto";
    if (l.includes("fund")) {
      if (isIncompleto) return "Fundamental Incompleto";
      return "Fundamental Completo";
    }
    if (l.includes("medio")) {
      if (isIncompleto) return "Medio Incompleto";
      return "Medio Completo";
    }
    if (l.includes("superior")) {
      if (isIncompleto) return "Superior Incompleto";
      return "Superior Completo";
    }
    if (l.includes("pos")) return "Pos Graduacao";
    return prev || "";
  };

  const normalizeReligiao = (val, prev) => {
    const raw = (val || prev || "").toString().trim();
    if (!raw) return prev;
    const l = simplify(raw);
    if (l.includes("catol")) return "Catolica";
    if (l.includes("evang")) return "Evangelica";
    if (l.includes("espir")) return "Espirita";
    if (l.includes("matriz")) return "Matriz Africana";
    if (l.includes("sem relig") || l.startsWith("s/") || l.startsWith("s /")) return "Sem Religiao";
    if (l.includes("testemunha") || l.includes("jeova")) return "Outras";
    if (l.includes("outr")) return "Outras";
    return prev || "";
  };

  const normalizeOrientacao = (val, prev) => {
    const raw = (val || prev || "").toString().trim();
    if (!raw) return prev;
    const l = simplify(raw);
    if (l.includes("hetero")) return "Heterossexual";
    if (l.includes("homo")) return "Homossexual";
    if (l.includes("bi")) return "Bissexual";
    if (l.includes("prefiro")) return "Prefiro nao dizer";
    if (l.includes("outro")) return "Outros";
    return prev || "";
  };

  const normalizeUf = (val, prev) => {
    const raw = (val || prev || "").toString().trim();
    if (!raw) return prev;
    const up = simplify(raw).toUpperCase();
    const list = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
    if (list.includes(up)) return up;
    return prev || "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "cpf") {
      setError(null);
      setCpfBloqueadoInfo(null);
      setCidadaoOutraUnidadeInfo(null);
      setCidadaoOutraUnidadePending(null);
      setCrossUnitConfirmado(false);
    }
    if (name === "nome") {
      setPossiveisBloqueadosNome([]);
      setMostrarModalBloqueioNome(false);
    }
    if (name === "cras_id") {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("recepcao_last_cras_id", value);
        } catch {}
      }
      setCidadaoOutraUnidadeInfo(null);
      setCidadaoOutraUnidadePending(null);
      setCrossUnitConfirmado(false);
    }
  };

  const preencherAPartirDadosCidadao = (dados, cpfOrigem, prevState) => {
    const dataNascimento = normalizeDate(dados.dataNascimento || prevState.dataNascimento);
    const sexo = normalizeSexo(dados.sexo, prevState.sexo);
    const cor = normalizeCor(dados.cor, prevState.cor);
    const escolaridade = normalizeEscolaridade(dados.escolaridade, prevState.escolaridade);
    const religiao = normalizeReligiao(dados.religiao, prevState.religiao);
    const orientacaoSexual = normalizeOrientacao(dados.orientacaoSexual, prevState.orientacaoSexual);
    const uf = normalizeUf(dados.uf, prevState.uf);

    const isValidInfo = (str) => str && String(str).trim() !== "-" && String(str).trim() !== "." && String(str).trim().length > 1;
    const nomeValido = isValidInfo(dados.nome) ? dados.nome : prevState.nome;
    const socialValido = isValidInfo(dados.nomeSocial) ? dados.nomeSocial : prevState.nomeSocial;

    return {
      ...prevState,
      nome: nomeValido,
      nomeSocial: socialValido,
      cpf: dados.cpf || prevState.cpf || cpfOrigem || "",
      rg: dados.rg || prevState.rg,
      nis: dados.nis || prevState.nis,
      tituloEleitor: dados.tituloEleitor || prevState.tituloEleitor,
      tituloEleitorZona: dados.tituloEleitorZona || prevState.tituloEleitorZona,
      tituloEleitorSecao: dados.tituloEleitorSecao || prevState.tituloEleitorSecao,
      telefone: "",
      dataNascimento: dataNascimento || prevState.dataNascimento,
      sexo,
      nomeMae: dados.nomeMae || prevState.nomeMae,
      nomePai: dados.nomePai || prevState.nomePai,
      conjuge: dados.conjuge || prevState.conjuge,
      nacionalidade: normalizeNacionalidade(dados.nacionalidade, prevState.nacionalidade),
      naturalidade: dados.naturalidade || prevState.naturalidade,
      naturalidadeIbgeId: dados.naturalidadeIbgeId || prevState.naturalidadeIbgeId || "",
      uf,
      cor,
      escolaridade,
      tecnicoResponsavel: dados.tecnicoResponsavel || prevState.tecnicoResponsavel,
      religiao,
      orientacaoSexual,
      foto: dados.fotoUrl || dados.foto || null,
    };
  };

  // Função separada para buscar imagem no Storage sem bloquear
  const buscarFotoStorage = async (cpfLimpo, dadosExistentes = null) => {
      // Bug 1: Verificação de storage para evitar quebra do módulo se não configurado
      if (!storage || !cpfLimpo) return;

      // Se o cidadão já tem uma URL de foto válida salva, não precisa buscar no Storage
      if (dadosExistentes && (dadosExistentes.fotoUrl || dadosExistentes.foto)) {
          // Já tem foto, encerra aqui
          return;
      }

      try {
           const defaultPath = `artifacts/${appId}/public/images/cidadaos/${cpfLimpo}_photo.jpg`;
           
           const fallbackPaths = [
              `artifacts/${appId}/public/images/cidadaos/${cpfLimpo}_foto.jpg`,
              `public/images/cidadaos/${cpfLimpo}_photo.jpg`
           ];

           let foundUrl = null;

           try {
               const photoRef = ref(storage, defaultPath);
               foundUrl = await getDownloadURL(photoRef);
           } catch (e) {
               // Não achou no padrão, ignora erro
           }

           if (!foundUrl) {
               for (const path of fallbackPaths) {
                  try {
                     const photoRef = ref(storage, path);
                     foundUrl = await getDownloadURL(photoRef);
                     if (foundUrl) break;
                  } catch (err) {
                     // Ignora
                  }
               }
           }

           if (foundUrl) {
               setFormData(prev => {
                  // Só atualiza se o CPF ainda for o mesmo (evita race condition)
                  if (prev.cpf.replace(/\D/g, "") === cpfLimpo && !prev.foto) {
                      return { ...prev, foto: foundUrl };
                  }
                  return prev;
               });

               // Se o cidadão já existe no banco mas não tinha foto salva, atualiza o cadastro
               if (dadosExistentes) {
                   try {
                       const docRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
                       await updateDoc(docRef, {
                           fotoUrl: foundUrl
                       });
                   } catch (errUpdate) {
                       console.error("Erro ao salvar URL da foto encontrada:", errUpdate);
                   }
               }
           }
      } catch (errFoto) {
           console.debug("Foto não encontrada no Storage para CPF:", cpfLimpo);
      }
  };

  const handleCpfBlur = async () => {
    if (!db) return;
    const cpfLimpo = (formData.cpf || "").replace(/\D/g, "");

    if (cpfLimpo && cpfLimpo.length !== 11) {
      setError("Padronizar CPF: O CPF deve conter exatamente 11 números. Verifique e corrija.");
      return;
    }

    if (!cpfLimpo) return;

    try {
      setBuscandoCidadao(true);
      setError(null);
      setCpfBloqueadoInfo(null);
      setAdmitirDesligadoConfirmado(false);
      setCidadaoOutraUnidadeInfo(null);
      setCidadaoOutraUnidadePending(null);

      const blockedRef = doc(
        db,
        `artifacts/${appId}/public/data/usuarios_bloqueados`,
        cpfLimpo
      );
      const blockedSnap = await getDoc(blockedRef);

      if (blockedSnap.exists()) {
        const blockedData = blockedSnap.data() || {};
        const motivo =
          blockedData.motivoDesligamento ||
          "Este CPF está bloqueado para atendimento.";
        setCpfBloqueadoInfo({ cpf: cpfLimpo, ...blockedData });
        setError(`CPF bloqueado. Motivo: ${motivo}`);
      } else {
        const cached = getFromCache(cpfLimpo);
        if (cached) {
          try {
            let cidCras = cached?.cras_id_principal || cached?.cras_id || null;
            if (!cidCras) {
              cidCras = (await inferirCrasPrincipalPorHistorico(cpfLimpo)) || defaultCentroPopCentroId || null;
            }
            const sel = formData.cras_id || null;
            if (cidCras && sel && cidCras !== sel) {
              const origem = crasUnidades?.find((c) => c?.id === cidCras)?.nome || cidCras;
              const destino = crasUnidades?.find((c) => c?.id === sel)?.nome || sel;
              setCidadaoOutraUnidadeInfo({
                cpf: cpfLimpo,
                cras_id_principal: cidCras,
                cras_id_selecionado: sel,
                origemNome: origem,
                destinoNome: destino,
              });
              setCidadaoOutraUnidadePending({ cpf: cpfLimpo, dados: cached });
              return;
            }
          } catch {}
          setDadosOriginais(cached);
          setFormData((prev) => preencherAPartirDadosCidadao(cached, formData.cpf, prev));
          setError(null);
          if (!cached.foto && !cached.fotoUrl) {
            buscarFotoStorage(cpfLimpo, cached).catch(err => {
              console.error("Erro ao buscar foto em background:", err);
            });
          }
          return;
        }

        let dados = null;
        const docRef = doc(
          db,
          `artifacts/${appId}/public/data/cidadaos`,
          cpfLimpo
        );
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          dados = snap.data();
        } else {
          const q = query(
            collection(db, `artifacts/${appId}/public/data/cidadaos`),
            where("cpf", "==", cpfLimpo),
            limit(1)
          );
          const qsnap = await getDocs(q);
          if (!qsnap.empty) {
            dados = qsnap.docs[0].data();
          }
        }
        
        if (dados) {
          try {
            let cidCras = dados?.cras_id_principal || dados?.cras_id || null;
            if (!cidCras) {
              cidCras = (await inferirCrasPrincipalPorHistorico(cpfLimpo)) || defaultCentroPopCentroId || null;
            }
            const sel = formData.cras_id || null;
            if (cidCras && sel && cidCras !== sel) {
              const origem = crasUnidades?.find((c) => c?.id === cidCras)?.nome || cidCras;
              const destino = crasUnidades?.find((c) => c?.id === sel)?.nome || sel;
              setCidadaoOutraUnidadeInfo({
                cpf: cpfLimpo,
                cras_id_principal: cidCras,
                cras_id_selecionado: sel,
                origemNome: origem,
                destinoNome: destino,
              });
              setCidadaoOutraUnidadePending({ cpf: cpfLimpo, dados });
              return;
            }
          } catch {}
          setInCache(cpfLimpo, dados);
          setDadosOriginais(dados);
          setFormData((prev) =>
            preencherAPartirDadosCidadao(dados, formData.cpf, prev)
          );
          setError(null);
        }

        if (dados) {
          buscarFotoStorage(cpfLimpo, dados).catch(err => {
            console.error("Erro ao buscar foto em background:", err);
          });
        }
      }
    } catch (e) {
      console.error("Erro ao buscar cidadão por CPF", e);
      setError(getFriendlyFirebaseError(e, "Erro ao buscar cidadão. Verifique sua conexão com a internet."));
    } finally {
      setBuscandoCidadao(false);
    }
  };

  const aceitarPreencherCidadaoOutraUnidade = async () => {
    const pending = cidadaoOutraUnidadePending;
    if (!pending || !pending.dados) return;
    const cpf = String(pending.cpf || "").replace(/\D/g, "");
    const dados = pending.dados;
    setCidadaoOutraUnidadeInfo(null);
    setCidadaoOutraUnidadePending(null);
    setCrossUnitConfirmado(true);
    if (cpf && cpf.length === 11) setInCache(cpf, dados);
    setDadosOriginais(dados);
    setFormData((prev) => preencherAPartirDadosCidadao(dados, cpf || formData.cpf, prev));
    setError(null);
    if (cpf && cpf.length === 11 && !dados.foto && !dados.fotoUrl) {
      buscarFotoStorage(cpf, dados).catch(err => {
        console.error("Erro ao buscar foto em background:", err);
      });
    }
  };

  const cancelarCidadaoOutraUnidade = () => {
    setCidadaoOutraUnidadeInfo(null);
    setCidadaoOutraUnidadePending(null);
    setCrossUnitConfirmado(false);
    setDadosOriginais(null);
    setCpfBloqueadoInfo(null);
    setPossiveisBloqueadosNome([]);
    setMostrarModalBloqueioNome(false);
    setFormData((prev) => ({
      nome: "",
      nomeSocial: "",
      cpf: "",
      rg: "",
      nis: "",
      tituloEleitor: "",
      tituloEleitorZona: "",
      tituloEleitorSecao: "",
      telefone: "",
      dataNascimento: "",
      sexo: "",
      nomeMae: "",
      nomePai: "",
      conjuge: "",
      nacionalidade: "Brasileira",
      naturalidade: "São Luís",
      naturalidadeIbgeId: "",
      uf: "MA",
      cor: "",
      escolaridade: "",
      tecnicoResponsavel: "",
      religiao: "",
      orientacaoSexual: "",
      cras_id: prev.cras_id,
      tipo_atendimento_id: prev.tipo_atendimento_id,
      prioridade: false,
      foto: null,
    }));
    setError(null);
    setSuccessMsg("Operação cancelada. Nenhum atendimento foi registrado.");
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleNomeBlur = async () => {
    if (!db) return;
    const nome = (formData.nome || "").trim();
    if (!nome) return;
    const cpfLimpo = (formData.cpf || "").replace(/\D/g, "");
    try {
      setBuscandoCidadao(true);
      setPossiveisBloqueadosNome([]);
      setMostrarModalBloqueioNome(false);

      const cidCollection = collection(
        db,
        `artifacts/${appId}/public/data/cidadaos`
      );
      const nomeNorm = simplify(nome);
      let dados = null;

      if (cpfLimpo.length !== 11) {
        try {
          const qNorm = query(
            cidCollection,
            where("nomeNormalizado", "==", nomeNorm),
            limit(1)
          );
          const snapNorm = await getDocs(qNorm);
          if (!snapNorm.empty) {
            dados = snapNorm.docs[0].data();
          }
        } catch (errNorm) {
            console.error("Erro na busca por nome normalizado:", errNorm);
        }
        
        if (!dados) {
          try {
            const q = query(cidCollection, where("nome", "==", nome), limit(10));
            const snap = await getDocs(q);
            if (!snap.empty) {
              dados = snap.docs[0].data();
            }
          } catch (errNome) {
             console.error("Erro na busca por nome exato:", errNome);
          }
        }
        if (dados) {
          let cidCras = dados?.cras_id_principal || dados?.cras_id || null;
          const cpfDados = String(dados?.cpf || "").replace(/\D/g, "");
          if (!cidCras && cpfDados.length === 11) {
            cidCras =
              (await inferirCrasPrincipalPorHistorico(cpfDados)) ||
              defaultCentroPopCentroId ||
              null;
          }
          const sel = formData.cras_id || null;
          if (cidCras && sel && cidCras !== sel) {
            const origem = crasUnidades?.find((c) => c?.id === cidCras)?.nome || cidCras;
            const destino = crasUnidades?.find((c) => c?.id === sel)?.nome || sel;
            setCidadaoOutraUnidadeInfo({
              cpf: cpfDados,
              cras_id_principal: cidCras,
              cras_id_selecionado: sel,
              origemNome: origem,
              destinoNome: destino,
            });
            setCidadaoOutraUnidadePending({
              cpf: cpfDados,
              dados,
            });
            return;
          }

          setDadosOriginais(dados);
          setFormData((prev) =>
            preencherAPartirDadosCidadao(dados, dados.cpf || "", prev)
          );
        }
      }

      if (!cpfBloqueadoInfo) {
        try {
          const bloqueadosRef = collection(
            db,
            `artifacts/${appId}/public/data/usuarios_bloqueados`
          );
          const qBloq = query(
            bloqueadosRef,
            where("nomeNormalizado", "==", nomeNorm)
          );
          const snapBloq = await getDocs(qBloq);
          if (!snapBloq.empty) {
            const lista = snapBloq.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            setPossiveisBloqueadosNome(lista);
            setMostrarModalBloqueioNome(true);
          }
        } catch (errBloq) {
             console.error("Erro ao verificar bloqueios por nome:", errBloq);
        }
      }
    } catch (e) {
      console.error("Erro ao buscar cidadão por nome", e);
      setError(getFriendlyFirebaseError(e, "Erro ao buscar cidadão por nome. Verifique sua conexão."));
    } finally {
      setBuscandoCidadao(false);
    }
  };

  useEffect(() => {
    if (!db || !formData.cras_id) {
      setFilaRecepcao([]);
      setFilaAusentes([]);
      setFilaError(null);
      return;
    }
    setFilaError(null);
    const baseRef = collection(db, `artifacts/${appId}/public/data/atendimentos`);
    const qAguardando = query(
      baseRef,
      where("cras_id", "==", formData.cras_id),
      where("status", "==", "aguardando"),
      limit(500)
    );
    const qAusentes = query(
      baseRef,
      where("cras_id", "==", formData.cras_id),
      where("status", "==", "ausente"),
      limit(50)
    );

    const mapDocComNome = (snap) => {
      const itens = snap.docs.map((d) => {
        const data = d.data() || {};
        const cid = data.cidadao ? { ...data.cidadao } : {};
        const nomeExiste =
          (cid.nome && String(cid.nome).trim() !== "") ||
          (cid.nomeSocial && String(cid.nomeSocial).trim() !== "");
        if (!nomeExiste && data.nome_exibicao) {
          cid.nome = data.nome_exibicao;
        }
        return { id: d.id, ...data, cidadao: cid };
      });

      itens.sort((a, b) => {
        const ta =
          a.hora_chegada && a.hora_chegada.toMillis
            ? a.hora_chegada.toMillis()
            : 0;
        const tb =
          b.hora_chegada && b.hora_chegada.toMillis
            ? b.hora_chegada.toMillis()
            : 0;
        return ta - tb;
      });
      return itens;
    };

    let isMountedLocal = true;

    const unsubAguardando = onSnapshot(
      qAguardando,
      (snap) => {
        if (isMountedLocal) {
          setFilaRecepcao(mapDocComNome(snap));
        }
      },
      (err) => {
        if (isMountedLocal) {
          console.error("Erro ao atualizar fila (aguardando):", err);
          setFilaError("Não foi possível atualizar a fila em tempo real.");
        }
      }
    );
    const unsubAusentes = onSnapshot(
      qAusentes,
      (snap) => {
        if (isMountedLocal) {
          const itens = mapDocComNome(snap).sort((a, b) => {
            const ta =
              a.hora_chamada && a.hora_chamada.toMillis
                ? a.hora_chamada.toMillis()
                : 0;
            const tb =
              b.hora_chamada && b.hora_chamada.toMillis
                ? b.hora_chamada.toMillis()
                : 0;
            return ta - tb;
          });
          setFilaAusentes(itens);
        }
      },
      (err) => {
        if (isMountedLocal) {
          console.error("Erro ao atualizar fila (ausentes):", err);
          setFilaError("Não foi possível atualizar a fila em tempo real.");
        }
      }
    );
    return () => {
      isMountedLocal = false;
      unsubAguardando();
      unsubAusentes();
    };
  }, [db, appId, formData.cras_id]);

  const handleCancelarAtendimento = async (id) => {
    if (!db || !appId || !id) return;
    if (filaBusy) return;
    
    try {
      setFilaBusy({ action: "cancelar", id });
      const ref = doc(
        db,
        `artifacts/${appId}/public/data/atendimentos`,
        id
      );
      await updateDoc(ref, {
        status: "cancelado",
        motivo_cancelamento: "Desistência informada na recepção",
        cancelado_em: serverTimestamp(),
        atendente_id: null,
        atendente_preferencial_id: null,
        hora_chamada: null,
      });

      await logAdminAction(
        db,
        appId,
        userProfile,
        "CANCELAR_ATENDIMENTO",
        `Cancelou atendimento ID: ${id}`,
        { atendimentoId: id, motivo: "Desistência informada na recepção" }
      );
    } catch (e) {
      console.error("Erro ao cancelar:", e);
      let msg = getFriendlyFirebaseError(e, "Erro ao cancelar atendimento.");
      setFilaError(msg);
    } finally {
      setFilaBusy(null);
    }
  };

  const handleReativarAusente = async (id) => {
    if (!db || !appId || !id) return;
    if (filaBusy) return;
    try {
      setFilaBusy({ action: "reativar", id });
      const ref = doc(
        db,
        `artifacts/${appId}/public/data/atendimentos`,
        id
      );
      await updateDoc(ref, {
        status: "aguardando",
        atendente_id: null,
        hora_chamada: null,
      });

      await logAdminAction(
        db,
        appId,
        userProfile,
        "REATIVAR_ATENDIMENTO",
        `Reativou atendimento ausente ID: ${id}`,
        { atendimentoId: id }
      );
    } catch (e) {
      console.error(e);
      let msg = getFriendlyFirebaseError(e, "Erro ao reativar atendimento.");
      setFilaError(msg);
    } finally {
      setFilaBusy(null);
    }
  };

  // Função para remanejar (trocar tipo) de atendimento na fila
  const handleRemanejarAtendimento = async (item, novoTipoId, atendentePreferencialId = null) => {
    if (!db || !appId || !item || !novoTipoId) return;
    if (filaBusy) return;
    
    // Se o tipo for o mesmo, não faz nada
    if (item.tipo_atendimento_id === novoTipoId) return;

    try {
      setFilaBusy({ action: "remanejar", id: item.id });
      const ref = doc(
        db,
        `artifacts/${appId}/public/data/atendimentos`,
        item.id
      );
      
      // Busca o nome do novo tipo para o log
      const novoTipo = (tiposAtendimento || []).find(t => t.id === novoTipoId);
      const novoTipoNome = novoTipo?.nome || "Novo Tipo";

      await updateDoc(ref, {
        tipo_atendimento_id: novoTipoId,
        status: "aguardando",
        atendente_id: null,
        atendente_preferencial_id: atendentePreferencialId || null,
        hora_chamada: null,
        hora_inicio: null,
        hora_fim: null
      });

      await logAdminAction(
        db,
        appId,
        userProfile,
        "REMANEJAR_ATENDIMENTO",
        `Remanejou atendimento de ${getNomeCidadao(item)} para ${novoTipoNome}`,
        { 
            atendimentoId: item.id, 
            de: item.tipo_atendimento_id, 
            para: novoTipoId 
        }
      );
      
      if (atendentePreferencialId) {
        setSuccessMsg(`Atendimento remanejado com sucesso para: ${novoTipoNome}. Direcionado para um servidor específico.`);
      } else {
        setSuccessMsg(`Atendimento remanejado com sucesso para: ${novoTipoNome}`);
      }
      
      // Limpa mensagem de sucesso após 5 segundos
      setTimeout(() => setSuccessMsg(null), 5000);

    } catch (e) {
      console.error("Erro ao remanejar:", e);
      let msg = getFriendlyFirebaseError(e, "Erro ao remanejar atendimento.");
      setError(msg);
    } finally {
      setFilaBusy(null);
    }
  };

  const confirmarBloqueioPorNome = (u) => {
    if (!u) return;
    const cpfDoc = (u.cpf || "").replace(/\D/g, "");
    const motivo =
      u.motivoDesligamento ||
      "Este usuário está desligado do serviço.";
    setCpfBloqueadoInfo({
      cpf: cpfDoc || null,
      ...u,
    });
    if (cpfDoc && cpfDoc.length === 11) {
      setFormData((prev) => ({
        ...prev,
        cpf: prev.cpf && prev.cpf.trim() ? prev.cpf : cpfDoc,
      }));
      setError(`CPF desligado. Motivo: ${motivo}`);
    } else {
      setError(`Usuário desligado. Motivo: ${motivo}`);
    }
    setMostrarModalBloqueioNome(false);
  };

  const cancelarBloqueioPorNome = () => {
    setPossiveisBloqueadosNome([]);
    setMostrarModalBloqueioNome(false);
  };

  const handleAdmitirDesligado = () => {
    setAdmitirDesligadoConfirmado(true);
    setError(null);
  };

  const handleRegistrarAtendimento = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!db || !appId || !formData.cras_id || !formData.tipo_atendimento_id) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const cpfLimpo = (formData.cpf || "").replace(/\D/g, "");

    if (cpfLimpo && cpfLimpo.length !== 11) {
      setError("Padronizar CPF: O CPF deve conter exatamente 11 números.");
      return;
    }

    if (cpfLimpo && !validateCPF(cpfLimpo)) {
      setError("CPF inválido. Verifique os números digitados.");
      return;
    }

    if (cpfLimpo.length === 11) {
      if (cpfBloqueadoInfo && cpfBloqueadoInfo.cpf === cpfLimpo && !admitirDesligadoConfirmado) {
        const motivoState =
          cpfBloqueadoInfo.motivoDesligamento ||
          "Este CPF está desligado do serviço.";
        setError(`CPF desligado. Motivo: ${motivoState}`);
        return;
      }
      try {
        const blockedRef = doc(
          db,
          `artifacts/${appId}/public/data/usuarios_bloqueados`,
          cpfLimpo
        );
        const blockedSnap = await getDoc(blockedRef);
        if (blockedSnap.exists() && !admitirDesligadoConfirmado) {
          const blockedData = blockedSnap.data() || {};
          const motivo =
            blockedData.motivoDesligamento ||
            "Este CPF está desligado do serviço.";
          setCpfBloqueadoInfo({ cpf: cpfLimpo, ...blockedData });
          setError(`CPF desligado. Motivo: ${motivo}`);
          return;
        }
      } catch (err) {
        console.error(
          "Erro ao verificar CPF bloqueado antes de registrar atendimento",
          err
        );
      }
    }

    const nomeTrim = (formData.nome || "").trim();
    const nomeSocialTrim = (formData.nomeSocial || "").trim();
    const nomeBase = nomeTrim || nomeSocialTrim;
    if (!nomeBase || nomeBase === "-" || nomeBase === "." || nomeBase.length < 2) {
      setError("ERRO: O nome informado é inválido. Digite um nome completo.");
      return;
    }

    const dataNascimentoNorm = normalizeDate(formData.dataNascimento);
    if (!dataNascimentoNorm) {
      setError("Data de nascimento é obrigatória. Preencha a data no formato correto.");
      return;
    }

    const telefoneDigits = (formData.telefone || "").replace(/\D/g, "");
    if (telefoneDigits.length > 0 && telefoneDigits.length < 10) {
      setFormData((prev) => ({ ...prev, telefone: "" }));
    }

    const duplicado = filaRecepcao.find(item => {
      const itemCpf = item.cidadao?.cpf ? item.cidadao.cpf.replace(/\D/g, "") : "";
      const formCpf = cpfLimpo;
      
      if (itemCpf && formCpf) {
        return itemCpf === formCpf;
      }
      
      // Bug 3: Detecção de duplicata na fila usando simplify para consistência (remove acentos e lowercase)
      const itemNome = simplify(item.cidadao?.nome || item.nome_exibicao || "");
      const formNome = simplify(nomeBase);
      return itemNome === formNome;
    });

    if (duplicado) {
      setError(`ATENÇÃO: Este cidadão já está na fila de espera (Posição: ${filaRecepcao.indexOf(duplicado) + 1}). Não é possível adicionar novamente.`);
      return;
    }

    const camposFaltantes = [];
    if (!cpfLimpo) camposFaltantes.push("CPF");
    
    // Validar campos geográficos se for brasileiro
    if (isBrasileiro(formData.nacionalidade)) {
      if (!formData.uf) camposFaltantes.push("UF");
      if (!formData.naturalidade) camposFaltantes.push("Cidade natal");
    }

    if (camposFaltantes.length > 0) {
      const msg = `AVISO DE CADASTRO INCOMPLETO:\n\n` +
                  `Os seguintes dados não foram preenchidos:\n` +
                  camposFaltantes.map(c => `- ${c}`).join("\n") + 
                  `\n\nDeseja continuar mesmo assim?`;
      
      if (!window.confirm(msg)) {
        return;
      }
    }

    if (dadosOriginais && cpfLimpo.length === 11 && dadosOriginais.cpf === cpfLimpo) {
      const nomeAtual = normalizeName(nomeBase);
      const nomeOriginal = normalizeName(dadosOriginais.nome || dadosOriginais.nomeSocial || "");
      
      if (nomeAtual !== nomeOriginal && nomeOriginal.length > 3) {
        const msg = `ATENÇÃO: O CPF ${cpfLimpo} já pertence a "${dadosOriginais.nome}".\n\n` +
                    `Você alterou o nome para "${nomeBase}".\n\n` +
                    `Se confirmar, o cadastro de "${dadosOriginais.nome}" será atualizado para "${nomeBase}".\n` +
                    `Deseja prosseguir com a alteração do nome?`;
        
        if (!window.confirm(msg)) {
           return;
        }
      }
    }

    try {
      const atendentesArr = Array.isArray(atendentesList) ? atendentesList : [];
      const tiposArr = Array.isArray(tiposAtendimento) ? tiposAtendimento : [];

      let tipoId = formData.tipo_atendimento_id;
      let obsExtra = "";
      let atendenteId = null;
      let atendentePreferencialId = null;

      // Bug 2: Fallback de tipoId no handleGerarSenha (prof_X)
      if (tipoId.startsWith("prof_")) {
        const profId = tipoId.replace("prof_", "");
        const prof = atendentesArr.find((a) => a.id === profId);
        
        if (prof) {
          if (simplify(prof.status) !== "online") {
            throw new Error("O profissional selecionado está offline/pausa. Selecione um profissional Online para direcionar.");
          }
          atendentePreferencialId = prof.id;
          
          if (prof.tipos_atende && prof.tipos_atende.length > 0) {
            tipoId = prof.tipos_atende[0];
          } else {
             const cargo = (prof.cargo || "").toLowerCase();
             if (cargo.includes("psic")) {
                 const psicType = tiposArr.find((t) => (t.nome || "").toLowerCase().includes("psic"));
                 if (psicType) tipoId = psicType.id;
             }
             if ((!tipoId || tipoId.startsWith("prof_")) && tiposArr.length > 0) {
                 tipoId = tiposArr[0].id;
             }
          }
        } else {
            console.warn("Atendente preferencial não encontrado na lista:", profId);
            if (tiposArr.length > 0) {
                tipoId = tiposArr[0].id;
            }
        }
      }

      const tipo = tiposArr.find((t) => t.id === tipoId);
      if (!tipo) {
          const fallbackTipo = tiposArr[0];
          if (!fallbackTipo) throw new Error("Configuração do sistema incompleta: Nenhum tipo de atendimento cadastrado.");
          tipoId = fallbackTipo.id;
      }
      const collectionPath = `artifacts/${appId}/public/data/atendimentos`;
      
      const isTest = isTestMode === true;
      
      let socialToSave = "";
      if (nomeSocialTrim) {
        const s = nomeSocialTrim.trim();
        if (s !== "-" && s !== "." && s.length > 1) {
          socialToSave = normalizeName(s);
        }
      }

      let existingCidadao = null;
      if (cpfLimpo && cpfLimpo.length === 11) {
        existingCidadao =
          dadosOriginais || getFromCache(cpfLimpo) || null;

        if (!existingCidadao) {
          try {
            const docRef = doc(
              db,
              `artifacts/${appId}/public/data/cidadaos`,
              cpfLimpo
            );
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              existingCidadao = snap.data() || null;
              if (existingCidadao) {
                setInCache(cpfLimpo, existingCidadao);
                setDadosOriginais(existingCidadao);
              }
            }
          } catch {}
        }
      }

      let cidCrasPrincipal =
        existingCidadao?.cras_id_principal || existingCidadao?.cras_id || null;
      const crasSelecionado = formData.cras_id || null;

      if (!cidCrasPrincipal && cpfLimpo && cpfLimpo.length === 11) {
        cidCrasPrincipal = await inferirCrasPrincipalPorHistorico(cpfLimpo);
      }
      if (!cidCrasPrincipal && existingCidadao) {
        cidCrasPrincipal = defaultCentroPopCentroId || null;
      }

      if (cidCrasPrincipal && crasSelecionado && cidCrasPrincipal !== crasSelecionado) {
        if (!crossUnitConfirmado) {
          const origem = crasUnidades?.find((c) => c?.id === cidCrasPrincipal)?.nome || cidCrasPrincipal;
          const destino = crasUnidades?.find((c) => c?.id === crasSelecionado)?.nome || crasSelecionado;
          const ok = window.confirm(
            `ATENÇÃO: Este CPF está cadastrado na unidade \"${origem}\".\n\nVocê selecionou \"${destino}\".\n\nDeseja registrar o atendimento nesta unidade mesmo assim?`
          );
          if (!ok) {
            try {
              if (cpfLimpo && cpfLimpo.length === 11) {
                const qCancelar = query(
                  collection(db, collectionPath),
                  where("cras_id", "==", crasSelecionado),
                  where("cidadao.cpf", "==", cpfLimpo),
                  where("status", "in", ["aguardando", "chamando", "em_atendimento"]),
                  limit(5)
                );
                const snapCancelar = await getDocs(qCancelar);
                if (!snapCancelar.empty) {
                  const agora = Date.now();
                  const candidatos = snapCancelar.docs
                    .map((d) => ({ id: d.id, ref: d.ref, data: d.data() || {} }))
                    .map((x) => {
                      const ts = x.data?.hora_chegada;
                      const ms =
                        ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;
                      return { ...x, horaChegadaMs: ms };
                    })
                    .filter((x) => x.horaChegadaMs && agora - x.horaChegadaMs <= 2 * 60 * 1000)
                    .sort((a, b) => (b.horaChegadaMs || 0) - (a.horaChegadaMs || 0));

                  const pickCrossUnit = (x) => {
                    const cu = x?.data?.cross_unit;
                    if (!cu) return false;
                    return (
                      String(cu?.origem_cras_id || "") === String(cidCrasPrincipal || "") &&
                      String(cu?.destino_cras_id || "") === String(crasSelecionado || "")
                    );
                  };

                  const candidato = candidatos.find(pickCrossUnit) || candidatos[0] || null;
                  if (candidato) {
                    await updateDoc(candidato.ref, {
                      status: "cancelado",
                      motivo_cancelamento: "Cancelado no aviso de unidade",
                      cancelado_em: serverTimestamp(),
                      atendente_id: null,
                      atendente_preferencial_id: null,
                      hora_chamada: null,
                      hora_inicio: null,
                      hora_fim: null,
                    });
                  }
                }
              }
            } catch {}
            setError(null);
            setSuccessMsg("Operação cancelada. Nenhum atendimento foi colocado na fila.");
            setTimeout(() => setSuccessMsg(null), 5000);
            return;
          }
        }
      }

      setRegistrandoAtendimento(true); // Renomeado N2
      setError(null);

      const pickTrimmed = (val, fallback) => {
        const s = val == null ? "" : String(val).trim();
        return s ? val : fallback;
      };

      const prioridadeToSave = formData.prioridade ? "Prioritário" : "Nenhuma";

      const nacionalidadeDefault = "Brasileira";
      const naturalidadeDefault = "São Luís";
      const ufDefault = "MA";

      const existingNac = existingCidadao?.nacionalidade;
      const existingNat = existingCidadao?.naturalidade;
      const existingUf = existingCidadao?.uf;

      const nacionalidadeToSave =
        existingNac &&
        simplify(formData.nacionalidade || "") === simplify(nacionalidadeDefault) &&
        simplify(existingNac || "") !== simplify(nacionalidadeDefault)
          ? existingNac
          : formData.nacionalidade;

      const naturalidadeToSave =
        existingNat &&
        simplify(formData.naturalidade || "") === simplify(naturalidadeDefault) &&
        simplify(existingNat || "") !== simplify(naturalidadeDefault)
          ? existingNat
          : formData.naturalidade;

      const ufToSave =
        existingUf &&
        simplify(formData.uf || "") === simplify(ufDefault) &&
        simplify(existingUf || "") !== simplify(ufDefault)
          ? existingUf
          : formData.uf;

      const camposMetadados = ['ultimaAtualizacaoFicha', 'ultimoAtendimentoResumo', 'tipoAcompanhamento', 'tipoAcompanhamentoDefinidoPor', 'importadoEm', 'origemImportacao'];
      const dadosHerdados = {};
      if (existingCidadao) {
        Object.keys(existingCidadao).forEach(key => {
          if (!camposMetadados.includes(key)) {
            dadosHerdados[key] = existingCidadao[key];
          }
        });
      }

      const dadosCidadao = {
        ...dadosHerdados,
        nome: normalizeName(nomeBase),
        nomeSocial: socialToSave,
        cpf: (formData.cpf || "").replace(/\D/g, ""),
        rg: pickTrimmed(formData.rg, existingCidadao?.rg || ""),
        nis: pickTrimmed(formData.nis, existingCidadao?.nis || ""),
        tituloEleitor: pickTrimmed(formData.tituloEleitor, existingCidadao?.tituloEleitor || ""),
        tituloEleitorZona: pickTrimmed(formData.tituloEleitorZona, existingCidadao?.tituloEleitorZona || ""),
        tituloEleitorSecao: pickTrimmed(formData.tituloEleitorSecao, existingCidadao?.tituloEleitorSecao || ""),
        telefone: pickTrimmed(formData.telefone, existingCidadao?.telefone || ""),
        dataNascimento: normalizeDate(pickTrimmed(formData.dataNascimento, existingCidadao?.dataNascimento || "")),
        sexo: pickTrimmed(formData.sexo, existingCidadao?.sexo || ""),
        nomeMae: normalizeName(pickTrimmed(formData.nomeMae, existingCidadao?.nomeMae || "")),
        nomePai: normalizeName(pickTrimmed(formData.nomePai, existingCidadao?.nomePai || "")),
        conjuge: normalizeName(pickTrimmed(formData.conjuge, existingCidadao?.conjuge || "")),
        nacionalidade: nacionalidadeToSave,
        naturalidade: naturalidadeToSave,
        naturalidadeIbgeId: pickTrimmed(formData.naturalidadeIbgeId, existingCidadao?.naturalidadeIbgeId || "") || "",
        uf: ufToSave,
        tecnicoResponsavel: pickTrimmed(formData.tecnicoResponsavel, existingCidadao?.tecnicoResponsavel || ""),
        cor: pickTrimmed(formData.cor, existingCidadao?.cor || ""),
        escolaridade: pickTrimmed(formData.escolaridade, existingCidadao?.escolaridade || ""),
        religiao: pickTrimmed(formData.religiao, existingCidadao?.religiao || ""),
        orientacaoSexual: pickTrimmed(formData.orientacaoSexual, existingCidadao?.orientacaoSexual || ""),
        prioridade: prioridadeToSave,
        cras_id_principal: cidCrasPrincipal || formData.cras_id || "",
      };

      // ═══ MUDANÇA 1: nome_exibicao prioriza nomeSocial ═══
      const docData = {
        cidadao: dadosCidadao,
        nome_exibicao: normalizeName(nomeSocialTrim || dadosCidadao.nome || nomeBase),
        cras_id: formData.cras_id,
        tipo_atendimento_id: tipoId,
        status: "aguardando",
        hora_chegada: serverTimestamp(),
        atendente_id: atendenteId,
        atendente_preferencial_id: atendentePreferencialId,
        hora_chamada: null,
        hora_inicio: null,
        hora_fim: null,
        observacoes: obsExtra,
        is_test: isTest,
        usuario_desligado: admitirDesligadoConfirmado,
        info_desligamento:
          admitirDesligadoConfirmado && cpfBloqueadoInfo
            ? {
                motivo: cpfBloqueadoInfo.motivoDesligamento || cpfBloqueadoInfo.motivo || "",
                tecnico: cpfBloqueadoInfo.desligadoPorNome || cpfBloqueadoInfo.desligadoPor || "",
                data: cpfBloqueadoInfo.dataDesligamento || cpfBloqueadoInfo.desligadoEm || cpfBloqueadoInfo.criadoEm || "",
                nome: cpfBloqueadoInfo.nome || cpfBloqueadoInfo.nomeSocial || "",
              }
            : null,
        cross_unit: (cidCrasPrincipal && crasSelecionado && cidCrasPrincipal !== crasSelecionado) ? {
          origem_cras_id: cidCrasPrincipal,
          origem_nome: crasUnidades?.find((c) => c?.id === cidCrasPrincipal)?.nome || cidCrasPrincipal,
          destino_cras_id: crasSelecionado,
          destino_nome: crasUnidades?.find((c) => c?.id === crasSelecionado)?.nome || crasSelecionado,
        } : null,
      };

      // 1. Upload da foto se existir
      let fotoUrl = null;
      
      if (formData.foto) {
        if (formData.foto.startsWith('data:image')) {
           if (!storage) {
             console.warn("Firebase Storage indisponível — registro continuará sem foto.");
             if (dadosOriginais?.fotoUrl) {
               fotoUrl = dadosOriginais.fotoUrl;
             }
           } else {
             try {
               const cpfSafe = cpfLimpo || `nocpf_${Date.now()}`;
               const storageRef = ref(storage, `artifacts/${appId}/public/images/cidadaos/${cpfSafe}_photo.jpg`);
               await uploadString(storageRef, formData.foto, 'data_url');
               fotoUrl = await getDownloadURL(storageRef);
             } catch (errUpload) {
               console.error("Erro ao fazer upload da foto:", errUpload);
               if (dadosOriginais?.fotoUrl) {
                  fotoUrl = dadosOriginais.fotoUrl;
               }
             }
           }
        } else {
           fotoUrl = formData.foto;
        }
      } else {
         fotoUrl = null;
      }

      // Atualiza objeto do cidadão com a URL da foto
      const dadosCidadaoFinal = {
        ...dadosCidadao,
        fotoUrl: fotoUrl
      };

      // Salvar/Atualizar cadastro do cidadão
      if (cpfLimpo && cpfLimpo.length === 11) {
        const cidRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
        await setDoc(cidRef, dadosCidadaoFinal, { merge: true });
      }
      
      // Reutiliza documento cancelado/ausente do mesmo CPF+CRAS para evitar duplicatas na fila
      let docRef = null;
      if (cpfLimpo && cpfLimpo.length === 11) {
        const qReuso = query(
          collection(db, collectionPath),
          where("cras_id", "==", formData.cras_id),
          where("cidadao.cpf", "==", cpfLimpo),
          where("status", "in", ["cancelado", "ausente"]),
          limit(1)
        );
        const snapReuso = await getDocs(qReuso);
        if (!snapReuso.empty) {
          const docExistente = snapReuso.docs[0];
          docRef = docExistente.ref;
          // ═══ MUDANÇA 2: updatePayload usa nome_chamada com prioridade social ═══
          const updatePayload = {
            cidadao: dadosCidadaoFinal,
            nome_exibicao: normalizeName(nomeSocialTrim || dadosCidadao.nome || nomeBase),
            tipo_atendimento_id: tipoId,
            status: "aguardando",
            hora_chegada: serverTimestamp(),
            atendente_id: null,
            atendente_preferencial_id: atendentePreferencialId,
            hora_chamada: null,
            hora_inicio: null,
            hora_fim: null,
            observacoes: obsExtra,
            is_test: isTest,
            usuario_desligado: admitirDesligadoConfirmado,
            info_desligamento:
              admitirDesligadoConfirmado && cpfBloqueadoInfo
                ? {
                    motivo: cpfBloqueadoInfo.motivoDesligamento || cpfBloqueadoInfo.motivo || "",
                    tecnico: cpfBloqueadoInfo.desligadoPorNome || cpfBloqueadoInfo.desligadoPor || "",
                    data: cpfBloqueadoInfo.dataDesligamento || cpfBloqueadoInfo.desligadoEm || cpfBloqueadoInfo.criadoEm || "",
                    nome: cpfBloqueadoInfo.nome || cpfBloqueadoInfo.nomeSocial || "",
                  }
                : null,
            // nomeSocial tem prioridade — é o que o painel TV exibe e narra
            nome_chamada: normalizeName(nomeSocialTrim || nomeTrim) || "S-" + Math.floor(Math.random() * 1000),
            motivo_cancelamento: null,
            cancelado_em: null,
          };
          try {
            await runTransaction(db, async (transaction) => {
              const snap = await transaction.get(docRef);
              if (!snap.exists()) throw new Error("Doc desapareceu");
              const data = snap.data();
              if (!["cancelado", "ausente"].includes(data.status || "")) {
                throw new Error("DOC_TAKEN");
              }
              transaction.update(docRef, updatePayload);
            });
          } catch (errReuso) {
            if (errReuso?.message === "DOC_TAKEN") {
              const snapAtual = await getDoc(docRef);
              const d = snapAtual.data();
              if (d?.cidadao?.cpf === cpfLimpo && ["aguardando", "chamando", "em_atendimento"].includes(d.status || "")) {
                setNomeRegistrado(nomeBase); // Refatoração N1
                handleLimparForm(true);
                return;
              }
            }
            throw errReuso;
          }
        }
      }
      
      // Se não encontrou documento para reutilizar, cria novo
      if (!docRef) {
        // Verificação de segurança: evita duplicata se outro processo registrou entre o reuso e aqui
        if (cpfLimpo && cpfLimpo.length === 11) {
          const qJaNaFila = query(
            collection(db, collectionPath),
            where("cras_id", "==", formData.cras_id),
            where("cidadao.cpf", "==", cpfLimpo),
            where("status", "in", ["aguardando", "chamando", "em_atendimento"]),
            limit(1)
          );
          const snapJa = await getDocs(qJaNaFila);
          if (!snapJa.empty) {
            const docSnap = snapJa.docs[0];
            const d = docSnap.data() || {};
            const st = String(d.status || "").toLowerCase();
            const atendenteId = d.atendente_id || null;
            const preferencialId = d.atendente_preferencial_id || null;

            const statusLabel =
              st === "aguardando"
                ? "já está aguardando na fila"
                : st === "chamando"
                  ? "já está sendo chamado"
                  : st === "em_atendimento"
                    ? "já está em atendimento"
                    : "já está com um atendimento em aberto";

            if ((st === "chamando" || st === "em_atendimento") && !atendenteId) {
              try {
                await updateDoc(doc(db, collectionPath, docSnap.id), {
                  status: "aguardando",
                  atendente_id: null,
                  atendente_preferencial_id: null,
                  hora_chamada: null,
                  hora_inicio: null,
                  hora_fim: null,
                });
                setError(null);
                setSuccessMsg(
                  "Este cidadão já tinha um atendimento em aberto (preso). O sistema corrigiu e devolveu para a fila de aguardando."
                );
                setTimeout(() => setSuccessMsg(null), 7000);
                setNomeRegistrado(nomeBase);
                handleLimparForm(true);
                return;
              } catch {}
            }

            if (st === "chamando" || st === "em_atendimento") {
              const okReset = window.confirm(
                `ATENÇÃO: Este cidadão ${statusLabel}.\n\n` +
                  `Isso impede que ele apareça na fila de espera (aguardando).\n\n` +
                  `Deseja devolver este atendimento para a fila de AGUARDANDO?`
              );
              if (okReset) {
                try {
                  await updateDoc(doc(db, collectionPath, docSnap.id), {
                    status: "aguardando",
                    atendente_id: null,
                    atendente_preferencial_id: null,
                    hora_chamada: null,
                    hora_inicio: null,
                    hora_fim: null,
                  });
                  setError(null);
                  setSuccessMsg("Atendimento devolvido para a fila de aguardando.");
                  setTimeout(() => setSuccessMsg(null), 7000);
                  setNomeRegistrado(nomeBase);
                  handleLimparForm(true);
                  return;
                } catch {}
              }
            }

            const extras = [
              atendenteId ? `Atendente: ${atendenteId}` : null,
              preferencialId ? `Direcionado: ${preferencialId}` : null,
            ]
              .filter(Boolean)
              .join(" | ");

            setError(null);
            setSuccessMsg(
              `Este cidadão ${statusLabel}.${extras ? ` (${extras})` : ""}`
            );
            setTimeout(() => setSuccessMsg(null), 7000);
            setNomeRegistrado(nomeBase);
            handleLimparForm(true);
            return;
          }
        }
        // ═══ MUDANÇA 3: addDoc usa nome_chamada com prioridade social ═══
        docRef = await addDoc(collection(db, `artifacts/${appId}/public/data/atendimentos`), {
          ...docData,
          cidadao: dadosCidadaoFinal,
          // nomeSocial tem prioridade — é o que o painel TV exibe e narra
          nome_chamada: normalizeName(nomeSocialTrim || nomeTrim) || "S-" + Math.floor(Math.random() * 1000),
        });
      }

      // Log
      await logAdminAction(db, appId, userProfile, "REGISTRAR_ATENDIMENTO", `Registrou atendimento para ${nomeBase}`, {
        atendimentoId: docRef.id,
        cpf: cpfLimpo,
      });

      try {
        const verifySnap = await getDoc(docRef);
        if (verifySnap.exists()) {
          const d = verifySnap.data() || {};
          const st = String(d.status || "").toLowerCase();
          const stLabel =
            st === "aguardando"
              ? "aguardando"
              : st === "chamando"
                ? "chamando"
                : st === "em_atendimento"
                  ? "em atendimento"
                  : st || "desconhecido";

          const extras = [
            d?.cras_id ? `Unidade: ${d.cras_id}` : null,
            d?.atendente_preferencial_id ? `Direcionado: ${d.atendente_preferencial_id}` : null,
          ]
            .filter(Boolean)
            .join(" | ");

          const aviso =
            st === "aguardando"
              ? ""
              : " Ele pode não aparecer na fila de espera (aguardando), pois já mudou de status.";

          setSuccessMsg(`Atendimento registrado. Status: ${stLabel}.${aviso}${extras ? ` (${extras})` : ""}`);
          setTimeout(() => setSuccessMsg(null), 9000);

          try {
            const qVis = query(
              collection(db, collectionPath),
              where("cras_id", "==", formData.cras_id),
              where("status", "==", "aguardando"),
              limit(500)
            );
            const snapVis = await getDocs(qVis);
            const itens = snapVis.docs
              .map((docSnap) => {
                const data = docSnap.data() || {};
                const cid = data.cidadao ? { ...data.cidadao } : {};
                const nomeExiste =
                  (cid.nome && String(cid.nome).trim() !== "") ||
                  (cid.nomeSocial && String(cid.nomeSocial).trim() !== "");
                if (!nomeExiste && data.nome_exibicao) {
                  cid.nome = data.nome_exibicao;
                }
                return { id: docSnap.id, ...data, cidadao: cid };
              })
              .sort((a, b) => {
                const ta = a.hora_chegada && a.hora_chegada.toMillis ? a.hora_chegada.toMillis() : 0;
                const tb = b.hora_chegada && b.hora_chegada.toMillis ? b.hora_chegada.toMillis() : 0;
                return ta - tb;
              });

            setFilaRecepcao(itens);
            setFilaError(null);

            const achou = itens.some((x) => x.id === docRef.id);
            if (!achou) {
              setSuccessMsg((prevMsg) => {
                const base = prevMsg || `Atendimento registrado. Status: ${stLabel}.`;
                return `${base} (Diagnóstico: não apareceu na consulta de fila aguardando da unidade selecionada)`;
              });
              setTimeout(() => setSuccessMsg(null), 12000);
            }
          } catch (errFilaPos) {
            setFilaError("Atendimento registrado, mas não foi possível atualizar a fila automaticamente. Recarregue a página.");
            console.error("Erro ao atualizar fila após registrar atendimento:", errFilaPos);
          }
        }
      } catch {}

      setNomeRegistrado(nomeBase); // Refatoração N1
      handleLimparForm(true);
    } catch (e) {
      console.error("Erro ao registrar atendimento:", e);
      if (e.code === 'resource-exhausted') {
         setError("Cota do Firebase excedida. Contate o administrador.");
      } else {
         setError(getFriendlyFirebaseError(e, "Erro ao registrar atendimento. Tente novamente."));
      }
    } finally {
      setRegistrandoAtendimento(false); // Renomeado N2
    }
  };

  const handleLimparForm = (manterSenha = false) => {
    const initialFormData = {
      nome: "",
      nomeSocial: "",
      cpf: "",
      rg: "",
      nis: "",
      tituloEleitor: "",
      tituloEleitorZona: "",
      tituloEleitorSecao: "",
      telefone: "",
      dataNascimento: "",
      sexo: "",
      nomeMae: "",
      nomePai: "",
      conjuge: "",
      nacionalidade: "Brasileira",
      naturalidade: "São Luís",
      naturalidadeIbgeId: "",
      uf: "MA",
      cor: "",
      escolaridade: "",
      tecnicoResponsavel: "",
      religiao: "",
      orientacaoSexual: "",
      cras_id: formData.cras_id, // Mantém o CRAS selecionado
      tipo_atendimento_id: "",
      prioridade: false,
      foto: null, // Limpa a foto
    };
    setFormData(initialFormData);
    setDadosOriginais(null);
    setError(null);
    if (!manterSenha) {
       setNomeRegistrado(null); // Renomeado N1
    }
    setCpfBloqueadoInfo(null);
    setCidadaoOutraUnidadeInfo(null);
    setCidadaoOutraUnidadePending(null);
    setCrossUnitConfirmado(false);
    setAdmitirDesligadoConfirmado(false);
    setPossiveisBloqueadosNome([]);
    setMostrarModalBloqueioNome(false);
  };
  
  const psicologos = (atendentesList || [])
    .filter((a) => {
      if (!formData.cras_id) return true;
      return String(a?.cras_id || "") === String(formData.cras_id || "");
    })
    .filter((a) => {
      const cargo = String(a?.cargo || "").toLowerCase();
      return (
        cargo.includes("psicólog") ||
        cargo.includes("psicolog") ||
        cargo.includes("assistente social") ||
        cargo.includes("assistente")
      );
    })
    .sort((a, b) => {
      const sa = simplify(a?.status);
      const sb = simplify(b?.status);
      const pa = sa === "online" ? 0 : sa === "pausa" ? 1 : sa === "ocupado" ? 2 : 3;
      const pb = sb === "online" ? 0 : sb === "pausa" ? 1 : sb === "ocupado" ? 2 : 3;
      if (pa !== pb) return pa - pb;
      return String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR");
    });

  return {
    formData, handleChange,
    registrandoAtendimento, nomeRegistrado, error, successMsg, setSuccessMsg, // Renomeado N1/N2 + M3b
    buscandoCidadao,
    filaRecepcao, filaAusentes, filaError, filaBusy,
    cpfBloqueadoInfo, possiveisBloqueadosNome, mostrarModalBloqueioNome,
    admitirDesligadoConfirmado,
    handleNomeBlur, handleCpfBlur, handleRegistrarAtendimento, handleLimparForm, // Renomeado N2
    handleCancelarAtendimento, handleReativarAusente,
    handleAdmitirDesligado,
    handleRemanejarAtendimento,
    confirmarBloqueioPorNome, cancelarBloqueioPorNome,
    setMostrarModalBloqueioNome,
    psicologos,
    cidadaoOutraUnidadeInfo,
    aceitarPreencherCidadaoOutraUnidade,
    cancelarCidadaoOutraUnidade,
    tipoById,
    expedienteIniciado,
    iniciarExpediente,
    encerrarExpediente,
    loadingExpediente
  };
};

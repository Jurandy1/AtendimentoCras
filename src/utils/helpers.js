/**
 * Usuários de teste: não aparecem em ficha de atendimento, relatórios ou histórico.
 * São atendidos normalmente na recepção e ficam gravados no Firebase.
 * Identificação por CPF ou nome.
 */
export const TEST_USER_IDENTIFIERS = [
  { nome: "jurandy", cpf: "06088339322" },
];

export const normalizeName = (nome) => {
  if (!nome) return "";
  return nome
    .toLowerCase()
    .split(" ")
    .filter((parte) => parte)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
};

// Função para resolver caminho de imagens no Electron
export const getImagePath = (imageName) => {
  // No Electron, usamos caminho relativo direto
  if (window.electron || window.require) {
    return `./${imageName}`;
  }
  // No navegador, usamos o BASE_URL
  return `${import.meta.env.BASE_URL}${imageName}`;
};

export const simplify = (val) => {
  return val
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export const isTestUser = (cidadaoOrAtendimento) => {
  if (!cidadaoOrAtendimento || TEST_USER_IDENTIFIERS.length === 0) return false;
  const cid = cidadaoOrAtendimento.cidadao || cidadaoOrAtendimento;
  const cpfRaw = cid?.cpf || cidadaoOrAtendimento.cidadao?.cpf || "";
  const cpf = String(cpfRaw || "").replace(/\D/g, "");
  const nome = String(cid?.nome || cid?.nomeSocial || cidadaoOrAtendimento.nome_exibicao || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return TEST_USER_IDENTIFIERS.some((t) => {
    if (t.cpf && cpf === String(t.cpf).replace(/\D/g, "")) return true;
    if (t.nome && nome.includes(String(t.nome).toLowerCase())) return true;
    return false;
  });
};

export const normalizeRole = (role) => {
  const raw = role == null ? "" : String(role);
  const s = simplify(raw).trim().replace(/\s+/g, " ");

  if (s.includes("coordenador") || s.includes("coordenacao")) return "coordenador";
  if (s.includes("superintendente") || s.includes("diretor")) return "superintendente";
  if (s.includes("master")) return "master";
  if (s.includes("super_admin")) return "super_admin";
  if (s.includes("admin")) return "admin";
  if (s.includes("psicolog") || s.includes("psi")) return "psicologo";
  if (s.includes("assistente social") || s.includes("servico social")) return "assistente_social";
  if (s.includes("recepcao") || s.includes("recepcionista")) return "recepcionista";
  if (s.includes("cad unico") || s.includes("cadunico") || s.includes("cadastro unico")) return "cadunico";
  
  return s;
};

// Verifica se um termo é estritamente brasileiro
export const isStrictlyBrazilian = (nacionalidade) => {
    const l = simplify((nacionalidade || "").toString().trim());
    if (!l) return true; // Assume brasileiro se vazio (comportamento padrão sistema)
    
    // Lista de termos que indicam "Brasileiro"
    const termosBrasil = [
        "brasil", "brasileir", "brasileira", "brasileiro", "br", "bra"
    ];
    
    return termosBrasil.some(t => l === t || l.startsWith(t));
};

// Lista de países comuns na região para inferência rápida
export const COMMON_FOREIGN_COUNTRIES = [
    "venezuela", "venezuelana", "venezuelano",
    "haiti", "haitiana", "haitiano",
    "colombia", "colombiana", "colombiano",
    "bolivia", "boliviana", "boliviano",
    "argentina", "argentino", "argentina",
    "peru", "peruana", "peruano",
    "paraguai", "paraguaia", "paraguaio",
    "uruguai", "uruguaia", "uruguaio",
    "chile", "chilena", "chileno",
    "cuba", "cubana", "cubano",
    "equador", "equatoriana", "equatoriano",
    "eua", "estados unidos", "americana", "americano",
    "paquistao", "paquistanesa", "paquistanes",
    "honduras", "hondurenha", "hondurenho"
];

export const inferNationalityFromNaturalidade = (naturalidade, uf) => {
    // Normalização para comparação (remove acentos, lowercase)
    const nat = simplify((naturalidade || "").toString().trim());
    const ufNorm = simplify((uf || "").toString().trim());
    
    const check = (text) => {
        if (!text) return null;
        // Busca parcial: 'venezuela' in 'venezuela' or 'caracas, venezuela'
        const found = COMMON_FOREIGN_COUNTRIES.find(c => text.includes(c));
        if (found) {
            if (found.includes("venezuela")) return "Venezuelana";
            if (found.includes("haiti")) return "Haitiana";
            if (found.includes("colombia")) return "Colombiana";
            if (found.includes("bolivia")) return "Boliviana";
            if (found.includes("argentina")) return "Argentina";
            if (found.includes("peru")) return "Peruana";
            if (found.includes("paraguai")) return "Paraguaia";
            if (found.includes("uruguai")) return "Uruguaia";
            if (found.includes("chile")) return "Chilena";
            if (found.includes("cuba")) return "Cubana";
            if (found.includes("equador")) return "Equador";
            if (found.includes("eua") || found.includes("estados") || found.includes("americ")) return "Americana";
            if (found.includes("paquistao")) return "Paquistanesa";
            if (found.includes("honduras")) return "Hondurenha";
            return found.charAt(0).toUpperCase() + found.slice(1);
        }
        return null;
    };

    return check(nat) || check(ufNorm);
};

export const getNomeCidadao = (registro) => {
  if (!registro) return "Nome não informado";
  const cid = registro.cidadao || {};
  
  // Helper para validar strings (ignora traço, ponto ou muito curto)
  const isValid = (str) => {
    if (!str) return false;
    const s = String(str).trim();
    return s !== "-" && s !== "." && s.length > 1;
  };

  let social = cid.nomeSocial;
  if (!isValid(social)) social = "";

  let nome = cid.nome;
  if (!isValid(nome)) nome = "";

  let exibicao = registro.nome_exibicao;
  if (!isValid(exibicao)) exibicao = "";

  // Prioridade: Nome Social Válido -> Nome Válido -> Nome Exibição Válido
  const nomeBruto =
    social ||
    nome ||
    exibicao ||
    "";
  
  if (!nomeBruto || String(nomeBruto).trim() === "") {
    return "Nome não informado";
  }
  return normalizeName(String(nomeBruto));
};

export function playBeep() {
  if (typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;
  const audioCtx = new AudioContextCtor();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    audioCtx.currentTime + 0.4
  );
  oscillator.stop(audioCtx.currentTime + 0.4);
}

export function speakChamada(chamado) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (
    !synth ||
    typeof window.SpeechSynthesisUtterance === "undefined" ||
    !chamado ||
    !chamado.cidadao
  ) {
    return;
  }

  const cid = chamado.cidadao || {};
  const isValid = (str) => {
    if (!str) return false;
    const s = String(str).trim();
    return s !== "-" && s !== "." && s.length > 1;
  };

  const nome = isValid(cid.nome) ? cid.nome : "";
  const exibicao = isValid(chamado.nome_exibicao) ? chamado.nome_exibicao : "";
  const social = isValid(cid.nomeSocial) ? cid.nomeSocial : "";

  const baseNome = nome || exibicao || social || "";
  if (!baseNome) return;
  const nomeFinal = normalizeName(baseNome);

  const rawLocal = chamado.atendente_guiche || "";
  const local = String(rawLocal || "").trim();
  const localLower = simplify(local);
  const isGuiche = localLower.startsWith("guiche");
  const isSala = localLower.startsWith("sala");
  const localFinal = local ? (isGuiche || isSala ? local : `Sala ${local}`) : "sala de atendimento";
  const preposicao = simplify(localFinal).startsWith("sala") ? "à" : "ao";
  const frase = `Atenção. ${nomeFinal}. Dirija-se ${preposicao} ${localFinal}.`;

  // Evita falar duas vezes o mesmo chamado na mesma aba
  try {
    const key = chamado.id || `${nomeFinal}-${localFinal}`;
    const now = Date.now();
    const lastKey = window.__painelLastSpokenKey;
    const lastAt = window.__painelLastSpokenAt || 0;
    if (lastKey === key && now - lastAt < 10000) {
      return;
    }
    window.__painelLastSpokenKey = key;
    window.__painelLastSpokenAt = now;
  } catch {}

  const utterance = new window.SpeechSynthesisUtterance(frase);
  utterance.lang = "pt-BR";
  utterance.rate = 0.95;
  utterance.pitch = 1;

  // Tenta fixar uma única voz em português para não alternar entre vozes
  try {
    const voices = typeof synth.getVoices === "function" ? synth.getVoices() : [];
    if (voices && voices.length) {
      const ptBr =
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("pt-br")) ||
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("pt"));
      if (ptBr) {
        utterance.voice = ptBr;
      }
    }
  } catch {}

  synth.cancel();
  synth.speak(utterance);
}

export const normalizeDate = (raw) => {
  if (!raw) return '';
  
  // 1. Se for objeto Firestore Timestamp ou Date JS
  if (typeof raw === 'object') {
      if (raw.toDate && typeof raw.toDate === 'function') {
          return raw.toDate().toLocaleDateString('pt-BR');
      }
      if (raw instanceof Date) {
          return raw.toLocaleDateString('pt-BR');
      }
      return String(raw);
  }

  let str = String(raw).trim();

  // Limpeza agressiva: remove caracteres que não sejam dígitos ou separadores comuns
  str = str.replace(/[^\d\/.\- ]/g, '');

  // 2. Remove hora
  if (str.includes(' ')) {
      const parts = str.split(' ');
      if (parts[0].match(/\d/)) {
          str = parts[0];
      }
  }

  // 3. Normaliza separadores para '/'
  str = str.replace(/[.\-]/g, '/');

  // 4. Tenta detectar formato DD/MM/YYYY ou YYYY/MM/DD
  const parts = str.split('/');
  
  if (parts.length === 3) {
      let p1 = parseInt(parts[0], 10);
      let p2 = parseInt(parts[1], 10);
      let p3 = parseInt(parts[2], 10);

      let day, month, year;

      // Heurística: Qual é o ano?
      if (p1 > 31) {
          year = p1;
          month = p2;
          day = p3;
      } else {
          day = p1;
          month = p2;
          year = p3;
      }

      // Correção de Typos comuns no Ano
      if (year > 9999) {
          const sYear = String(year);
          if (sYear.length === 5 && (sYear.startsWith('19') || sYear.startsWith('20'))) {
              year = parseInt(sYear.slice(0, 4), 10);
          }
      }

      // Ajuste ano 2 dígitos
      if (year < 100) {
          const currentYear = new Date().getFullYear();
          year = year > (currentYear % 100) + 10 ? 1900 + year : 2000 + year;
      }

      // Validação básica de limites
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year > 1800 && year < 2100) {
          return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      }
  }

  // 5. Se for apenas números (Excel Serial)
  if (/^\d{5}$/.test(str)) {
      const num = parseInt(str, 10);
      if (num > 10000 && num < 70000) {
          const date = new Date((num - 25569) * 86400 * 1000);
          date.setHours(12);
          if (!isNaN(date.getTime())) {
             return date.toLocaleDateString('pt-BR');
          }
      }
  }

  // Se falhou em tudo, retorna vazio para evitar dados corrompidos
  return ""; 
};

export const validateCPF = (cpf) => {
  if (!cpf) return false;
  const str = String(cpf).replace(/[^\d]/g, '');
  if (str.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(str)) return false; // Todos iguais

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) sum = sum + parseInt(str.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(str.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(str.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(str.substring(10, 11))) return false;

  return true;
};

export const normalizeDateForInput = (val) => {
    if (!val) return "";
    if (typeof val === 'object') {
        if (val.toDate && typeof val.toDate === "function") {
          const d = val.toDate();
          return d.toISOString().slice(0, 10);
        }
        if (val instanceof Date) {
          return val.toISOString().slice(0, 10);
        }
    }
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return "";
};

export const parseBRDateToDate = (value) => {
  const normalized = normalizeDate(value);
  if (!normalized) return null;
  const m = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  d.setHours(12, 0, 0, 0);
  return d;
};

export const formatBRDateTyping = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
};

export const parseFlexibleDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (value?.toDate && typeof value.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return parseBRDateToDate(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T12:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

export const getFriendlyFirebaseError = (err, fallback = "Erro ao processar a solicitação.") => {
  const code = String(err?.code || "").trim();
  const raw = String(err?.message || err || "").trim();
  const msg = raw.toLowerCase();

  if (code === "permission-denied") return "Permissão negada. Verifique seu acesso e tente novamente.";
  if (code === "unauthenticated") return "Sessão expirada. Entre novamente para continuar.";
  if (code === "resource-exhausted") return "Sistema sobrecarregado (limite de cota). Aguarde e tente novamente.";
  if (code === "failed-precondition" && msg.includes("index")) {
    return "Configuração do banco em andamento (índices). Aguarde alguns minutos e tente novamente.";
  }
  if (code === "unavailable" || msg.includes("service is unavailable") || msg.includes("service is currently unavailable") || msg.includes("unavaible")) {
    return "Serviço indisponível no momento. Verifique sua internet e, se estiver usando bloqueador de anúncios (uBlock/AdBlock), desative para este site.";
  }
  if (code === "deadline-exceeded" || msg.includes("deadline")) {
    return "Tempo de resposta excedido. Verifique sua internet e tente novamente.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Falha de rede. Verifique sua internet e tente novamente.";
  }

  return fallback;
};

export const getAgeFromBRDate = (birthDate, referenceDate = new Date()) => {
  const dob = parseBRDateToDate(birthDate);
  if (!dob) return null;
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  if (age < 0 || age > 130) return null;
  return age;
};

export const getAgeGroup = (age) => {
  if (typeof age !== "number" || Number.isNaN(age)) return "Não informado";
  if (age <= 5) return "0-5";
  if (age <= 12) return "6-12";
  if (age <= 17) return "13-17";
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  if (age <= 59) return "45-59";
  return "60+";
};

const IBGE_CACHE_PREFIX = "ibge_municipios_v1_";
const IBGE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const readLocalStorageJson = (key) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeLocalStorageJson = (key, value) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
};

export const getIBGEMunicipiosByUF = async (uf) => {
  const ufNorm = String(uf || "").trim().toUpperCase();
  if (!ufNorm || ufNorm.length !== 2) return [];
  const cacheKey = `${IBGE_CACHE_PREFIX}${ufNorm}`;
  const cached = readLocalStorageJson(cacheKey);
  if (cached && cached.ts && Array.isArray(cached.data) && Date.now() - cached.ts < IBGE_CACHE_TTL_MS) {
    return cached.data;
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufNorm}/municipios?orderBy=nome`;
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return [];
    const json = await res.json();
    const data = Array.isArray(json)
      ? json
          .map((m) => ({ id: m?.id, nome: m?.nome }))
          .filter((m) => m.id && m.nome)
      : [];
    writeLocalStorageJson(cacheKey, { ts: Date.now(), data });
    return data;
  } catch {
    if (cached && Array.isArray(cached.data)) return cached.data;
    return [];
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const lookupMunicipioIBGE = async (uf, municipioNome) => {
  const ufNorm = String(uf || "").trim().toUpperCase();
  const nome = String(municipioNome || "").trim();
  if (!ufNorm || ufNorm.length !== 2 || !nome) return null;
  const municipios = await getIBGEMunicipiosByUF(ufNorm);
  if (!municipios.length) return null;
  const target = simplify(nome);
  const found = municipios.find((m) => simplify(m.nome) === target) || null;
  if (!found) return null;
  return { ...found, uf: ufNorm };
};

const COUNTRIES_CACHE_KEY = "countries_v1";
const COUNTRIES_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export const getCountries = async () => {
  const cached = readLocalStorageJson(COUNTRIES_CACHE_KEY);
  if (cached && cached.ts && Array.isArray(cached.data) && Date.now() - cached.ts < COUNTRIES_CACHE_TTL_MS) {
    return cached.data;
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const url = "https://restcountries.com/v3.1/all?fields=name,translations";
    const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) throw new Error("countries_fetch_failed");
    const json = await res.json();
    const data = Array.isArray(json)
      ? json
          .map((c) => {
            const pt = c?.translations?.por?.common;
            const en = c?.name?.common;
            return String(pt || en || "").trim();
          })
          .filter(Boolean)
          .filter((v) => simplify(v) !== "brasil")
      : [];
    const uniq = Array.from(new Set(data)).sort((a, b) => a.localeCompare(b, "pt-BR"));
    writeLocalStorageJson(COUNTRIES_CACHE_KEY, { ts: Date.now(), data: uniq });
    return uniq;
  } catch {
    if (cached && Array.isArray(cached.data)) return cached.data;
    return [
      "Argentina",
      "Bolívia",
      "Chile",
      "Colômbia",
      "Cuba",
      "Estados Unidos",
      "Haiti",
      "Itália",
      "Japão",
      "Paraguai",
      "Peru",
      "Portugal",
      "Uruguai",
      "Venezuela",
      "Outros"
    ];
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const VIACEP_CACHE_PREFIX = "viacep_v1_";
const VIACEP_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

export const searchCep = async (cep) => {
  const clean = String(cep || "").replace(/\D/g, "");
  if (clean.length !== 8) return null;
  
  const cacheKey = `${VIACEP_CACHE_PREFIX}${clean}`;
  const cached = readLocalStorageJson(cacheKey);
  if (cached && cached.ts && cached.data && Date.now() - cached.ts < VIACEP_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    
    const result = {
      cep: data.cep,
      logradouro: data.logradouro,
      complemento: data.complemento,
      bairro: data.bairro,
      localidade: data.localidade,
      uf: data.uf,
      ibge: data.ibge,
      ddd: data.ddd
    };
    
    writeLocalStorageJson(cacheKey, { ts: Date.now(), data: result });
    return result;
  } catch {
    return null;
  }
};

export const getForeignStates = async (country) => {
  try {
    const response = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    });
    const data = await response.json();
    if (data.error) return [];
    return data.data.states.map((s) => s.name);
  } catch (error) {
    console.error("Error fetching states:", error);
    return [];
  }
};

export const getForeignCities = async (country, state) => {
  try {
    const response = await fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, state }),
    });
    const data = await response.json();
    if (data.error) return [];
    return data.data;
  } catch (error) {
    console.error("Error fetching cities:", error);
    return [];
  }
};

/** Corrige URLs do Firebase Storage com barras não codificadas no path */
export const fixFirebaseStorageUrl = (url) => {
  if (!url) return null;
  if (!url.includes('firebasestorage.googleapis.com')) return url;
  try {
    const matches = url.match(/(.*\/o\/)(.*?)(\?.*)/);
    if (matches && matches.length === 4) {
      const prefix = matches[1];
      const path = matches[2];
      const suffix = matches[3];
      if (path.includes('/') && !path.includes('%2F')) {
        return `${prefix}${encodeURIComponent(path)}${suffix}`;
      }
    }
  } catch {}
  return url;
};

export const safeRemoveChild = (parent, child) => {
  if (parent && child && parent.contains(child)) {
    try {
      parent.removeChild(child);
    } catch (err) {
      console.warn("Safe remove failed:", err);
    }
  }
};

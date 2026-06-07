import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { 
  collection, deleteDoc, doc, documentId, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where 
} from "firebase/firestore";
// Icons
import { 
  Search, RefreshCw, User, Check, X, 
  Coffee, Utensils, Moon, ShowerHead, Building2, 
  Calendar, ClipboardList, Clock, Loader2, AlertCircle, Info, Trash2,
  Filter, ChevronLeft, ChevronRight, TrendingUp, CheckCircle2, History
} from "lucide-react";

import { 
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis 
} from "recharts";

import { GOOGLE_SHEETS_TOKEN, GOOGLE_SHEETS_WEBAPP_URL } from "../constants";

// 3. Helpers
const simplify = (str) => {
  return str
    ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : "";
};

const normalizeName = (name) => {
  return name ? name.toUpperCase() : "";
};

// Formatação/parse de datas no padrão brasileiro
function formatIsoToPtBr(iso) {
  const v = String(iso || "");
  if (!v) return "";
  const [y, m, d] = v.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}
function parsePtBrToIso(pt) {
  const v = String(pt || "").trim();
  const parts = v.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const dd = Number(d);
  const mm = Number(m);
  const yy = Number(y);
  if (!dd || !mm || !yy) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// 4. Componentes UI Locais

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
    {children}
  </div>
);

const Button = ({ children, variant = "primary", className = "", disabled, ...props }) => {
  const base = "inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm hover:shadow",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-400",
    outline: "bg-transparent text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
  };

  return (
    <button 
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ label, icon: Icon, className = "", ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <input 
        className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none ${Icon ? 'pl-10' : ''} ${className}`}
        {...props}
      />
    </div>
  </div>
);

const Select = ({ label, children, className = "", ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
    <div className="relative">
      <select 
        className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none appearance-none ${className}`}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
    </div>
  </div>
);

const InlineAlert = ({ variant = "info", children, onClose }) => {
  const styles = {
    info: "bg-blue-50 text-blue-800 border-blue-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    error: "bg-red-50 text-red-800 border-red-200",
  };
  
  const Icons = {
    info: Info,
    success: Check,
    warning: AlertCircle,
    error: AlertCircle
  };
  
  const Icon = Icons[variant] || Info;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${styles[variant]} animate-in slide-in-from-top-2`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5 opacity-80" />
      <div className="flex-1 text-sm">{children}</div>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Input de data com máscara/parse no padrão brasileiro (DD/MM/AAAA)
const DateInputBR = ({ label, valueIso, onChangeIso }) => {
  const [text, setText] = useState(() => formatIsoToPtBr(valueIso));
  useEffect(() => {
    setText(formatIsoToPtBr(valueIso));
  }, [valueIso]);
  const handleBlur = () => {
    const iso = parsePtBrToIso(text);
    if (iso) {
      onChangeIso(iso);
    } else {
      setText(formatIsoToPtBr(valueIso));
    }
  };
  return (
    <Input
      label={label}
      icon={Calendar}
      placeholder="DD/MM/AAAA"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
    />
  );
};

// Removido hook local de auth; utiliza o contexto global de autenticação

// --- Configuração Visual dos Serviços ---
const SERVICE_CONFIG = [
  { key: "cafe", label: "Café da Manhã", icon: Coffee, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", ring: "ring-amber-500" },
  { key: "almoco", label: "Almoço", icon: Utensils, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", ring: "ring-red-500" },
  { key: "ceia", label: "Ceia / Jantar", icon: Moon, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", ring: "ring-indigo-500" },
  { key: "banho", label: "Banho", icon: ShowerHead, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200", ring: "ring-cyan-500" },
  { key: "restaurante popular", label: "Rest. Popular", icon: Building2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", ring: "ring-emerald-500" },
];

const SERVICE_LABEL_BY_KEY = SERVICE_CONFIG.reduce((acc, s) => {
  acc[s.key] = s.label;
  return acc;
}, {});

// --- Funções Auxiliares de Negócio ---

function cleanCpf(value) {
  return String(value || "").replace(/\D/g, "");
}
function toDateKey(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear());
  return `${d}/${m}/${y}`;
}

function parseDateKey(key) {
  const [d, m, y] = String(key || "").split("/");
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!day || !month || !year) return null;
  const dt = new Date(year, month - 1, day);
  dt.setHours(12, 0, 0, 0);
  return dt;
}

function startOfDay(dt) {
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(dt) {
  const d = new Date(dt);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function fetchJson(url, options) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { ...(options || {}), signal: controller.signal, cache: "no-store" });
    clearTimeout(timeoutId);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error("Resposta não é JSON:", text);
      return { ok: false, error: "resposta_invalida", raw: text };
    }
  } catch (e) {
    console.error("Erro de rede:", e);
    return { ok: false, error: "fetch_fail", details: String(e?.message || e) };
  }
}

function canonicalServiceKey(raw) {
  const s = simplify(String(raw || "")).trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (s.includes("cafe")) return "cafe";
  if (s.includes("almo")) return "almoco";
  if (s.includes("jantar") || s.includes("ceia")) return "ceia";
  if (s.includes("banho")) return "banho";
  if ((s.includes("rest") || s.includes("restaurante")) && s.includes("popular")) return "restaurante popular";
  return s;
}

function normalizeTotalsObject(obj) {
  const out = {};
  Object.entries(obj || {}).forEach(([service, count]) => {
    const key = canonicalServiceKey(service);
    if (!key) return;
    out[key] = (out[key] || 0) + Number(count || 0);
  });
  return out;
}

function normalizeSeriesObject(obj) {
  const out = {};
  Object.entries(obj || {}).forEach(([dateKey, byService]) => {
    const row = {};
    Object.entries(byService || {}).forEach(([service, count]) => {
      const key = canonicalServiceKey(service);
      if (!key) return;
      row[key] = (row[key] || 0) + Number(count || 0);
    });
    out[dateKey] = row;
  });
  return out;
}

function computeTotalsFromSeries(series, start, end) {
  const totals = {};
  const startMs = start.getTime();
  const endMs = end.getTime();
  Object.entries(series || {}).forEach(([key, byService]) => {
    const dt = parseDateKey(key);
    if (!dt) return;
    const t = dt.getTime();
    if (t < startMs || t > endMs) return;
    Object.entries(byService || {}).forEach(([service, count]) => {
      const s = canonicalServiceKey(service);
      if (!s) return;
      totals[s] = (totals[s] || 0) + Number(count || 0);
    });
  });
  return totals;
}

function formatCpf(cpf) {
  const c = cleanCpf(cpf);
  if (c.length !== 11) return cpf || "";
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

// Função que rastreia e conta TODOS os serviços automaticamente de todos os períodos
const calcularFrequenciaDeTudo = (atendimentos) => {
  let contadorGeral = {};

  atendimentos.forEach(atendimento => {
    // Pega os serviços não importa como foram salvos
    let servicosStr = atendimento.servicos || atendimento.servicosDia || atendimento.tipoServico || "";
    let listaServicos = [];

    // Converte para uma lista limpa
    if (typeof servicosStr === 'string' && servicosStr.trim()) {
      // Se for texto separado por ponto e vírgula, divide em itens
      listaServicos = servicosStr.split(';').map(s => s.trim()).filter(s => s);
    } else if (Array.isArray(servicosStr)) {
      listaServicos = servicosStr;
    }

    // Conta cada item encontrado
    listaServicos.forEach(servico => {
      if (!servico) return; // Ignora vazios
      
      // Padroniza: remove espaços sobrando e deixa a 1ª letra maiúscula
      const servicoPadronizado = servico.trim().toUpperCase();
      
      // Se já existe na lista, soma +1. Se não, cria com valor 1.
      if (contadorGeral[servicoPadronizado]) {
        contadorGeral[servicoPadronizado]++;
      } else {
        contadorGeral[servicoPadronizado] = 1;
      }
    });
  });

  return contadorGeral;
};

// Função que calcula totais dinamicamente a partir dos dados series (histórico completo)
const calcularFrequenciaDeSeries = (series, start, end) => {
  let contadorGeral = {};
  const startMs = start.getTime();
  const endMs = end.getTime();

  Object.entries(series || {}).forEach(([dateKey, byService]) => {
    const dt = parseDateKey(dateKey);
    if (!dt) return;
    const t = dt.getTime();
    if (t < startMs || t > endMs) return;
    
    // Para cada serviço nesta data
    Object.entries(byService || {}).forEach(([service, count]) => {
      const key = canonicalServiceKey(service);
      if (!key) return;
      contadorGeral[key] = (contadorGeral[key] || 0) + Number(count || 0);
    });
  });

  return contadorGeral;
};

function splitDateTimePtBr(value) {
  const v = String(value || "").replace(",", "").trim();
  const [datePart, timePart] = v.split(" ");
  return { datePart: datePart || "", timePart: timePart || "" };
}

// --- Componente Principal ---

export default function ServicosDiaPage() {
  const { db, appId, userProfile } = useAuth();

  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [cidadaoSelecionado, setCidadaoSelecionado] = useState(null);

  const [servicosMarcados, setServicosMarcados] = useState(() => new Set());
  const [salvando, setSalvando] = useState(false);

  const [sugestoes, setSugestoes] = useState([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  const [alert, setAlert] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [totals, setTotals] = useState({});
  const [series, setSeries] = useState({});
  const [recent, setRecent] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [filtroCidadao, setFiltroCidadao] = useState("");
  const [filtroHorario, setFiltroHorario] = useState("");
  
  // Estado para animação de transição
  const [isFiltering, setIsFiltering] = useState(false);

  const sugestoesDebounceRef = useRef(null);
  useEffect(() => {
    return () => {
      if (sugestoesDebounceRef.current) clearTimeout(sugestoesDebounceRef.current);
    };
  }, []);

  const matchesRecentFilters = useCallback((r) => {
    const nome = String(r?.nome || "").toLowerCase();
    const cpf = String(r?.cpf || "").replace(/\D/g, "");
    const data = String(r?.data || "");

    const matchCidadao = !filtroCidadao ||
      nome.includes(filtroCidadao.toLowerCase()) ||
      cpf.includes(filtroCidadao.replace(/\D/g, ""));

    const matchHorario = !filtroHorario || data.includes(filtroHorario);

    return matchCidadao && matchHorario;
  }, [filtroCidadao, filtroHorario]);

  const [tab, setTab] = useState("diario");
  const [dia, setDia] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [rangeStart, setRangeStart] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [rangeEnd, setRangeEnd] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const atendenteLabel = useMemo(() => {
    return String(userProfile?.nome || userProfile?.emailNorm || userProfile?.email || "").trim();
  }, [userProfile]);

  const sheetToken = GOOGLE_SHEETS_TOKEN;
  const sheetUrl = GOOGLE_SHEETS_WEBAPP_URL;

  const [filaRecepcaoServicosDia, setFilaRecepcaoServicosDia] = useState([]);
  const [servicosDiaTipoIds, setServicosDiaTipoIds] = useState(() => new Set());
  const [syncBusy, setSyncBusy] = useState(false);

  const servicosSelecionadosArray = useMemo(() => {
    return Array.from(servicosMarcados.values());
  }, [servicosMarcados]);

  useEffect(() => {
    if (!db || !appId) {
      setServicosDiaTipoIds(new Set());
      return;
    }

    (async () => {
      try {
        const tiposRef = collection(db, `artifacts/${appId}/public/data/tipos_atendimento`);
        const snap = await getDocs(tiposRef);
        const ids = snap.docs
          .map((d) => ({ id: d.id, nome: d.data()?.nome }))
          .filter((t) => simplify(String(t.nome || "")).includes("servicos do dia"))
          .map((t) => t.id);
        setServicosDiaTipoIds(new Set(ids));
      } catch {
        setServicosDiaTipoIds(new Set());
      }
    })();
  }, [db, appId]);

  useEffect(() => {
    if (!db || !appId || servicosDiaTipoIds.size === 0) {
      setFilaRecepcaoServicosDia([]);
      return;
    }

    const path = `artifacts/${appId}/public/data/atendimentos`;
    const q = query(
      collection(db, path),
      where("status", "==", "aguardando"),
      orderBy("hora_chegada", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() || {};
          if (!servicosDiaTipoIds.has(String(data.tipo_atendimento_id || ""))) return;

          const cpf = cleanCpf(data?.cidadao?.cpf || "");
          const nome = String(
            data?.cidadao?.nome || data?.cidadao?.nomeSocial || data?.nome_exibicao || ""
          ).trim();
          if (cpf.length !== 11 || !nome) return;

          list.push({
            id: docSnap.id,
            cpf,
            nome,
          });
        });
        setFilaRecepcaoServicosDia(list);
      },
      () => setFilaRecepcaoServicosDia([])
    );

    return () => unsubscribe();
  }, [db, appId, servicosDiaTipoIds]);

  // --- Lógica de Relatórios ---
  const computedPeriodTotals = useMemo(() => {
    const now = new Date();

    const parseIso = (iso) => {
      const v = String(iso || "");
      if (!v) return null;
      const [y, m, d] = v.split("-").map((x) => Number(x));
      if (!y || !m || !d) return null;
      const dt = new Date(y, m - 1, d);
      dt.setHours(12, 0, 0, 0);
      return dt;
    };

    if (tab === "diario") {
      const dt = parseIso(dia) || now;
      const start = startOfDay(dt);
      const end = endOfDay(dt);
      return calcularFrequenciaDeSeries(series, start, end);
    }

    if (tab === "semanal") {
      const end = endOfDay(now);
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      return calcularFrequenciaDeSeries(series, start, end);
    }

    if (tab === "mensal") {
      const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return calcularFrequenciaDeSeries(series, start, end);
    }

    if (tab === "anual") {
      const start = startOfDay(new Date(now.getFullYear(), 0, 1));
      const end = endOfDay(new Date(now.getFullYear(), 11, 31));
      return calcularFrequenciaDeSeries(series, start, end);
    }

    const s = parseIso(rangeStart);
    const e = parseIso(rangeEnd);
    if (!s || !e) return {};
    const start = startOfDay(s);
    const end = endOfDay(e);
    if (start.getTime() > end.getTime()) return {};
    return calcularFrequenciaDeSeries(series, start, end);
  }, [tab, dia, rangeStart, rangeEnd, series]);

  const periodTitle = useMemo(() => {
    const now = new Date();
    const prettyIso = (iso) => {
      const v = String(iso || "");
      if (!v) return "";
      const [y, m, d] = v.split("-");
      if (!y || !m || !d) return "";
      return `${d}/${m}/${y}`;
    };

    if (tab === "diario") return `Diário (${prettyIso(dia) || toDateKey(now)})`;
    if (tab === "semanal") return "Últimos 7 dias";
    if (tab === "mensal") return "Mês Atual";
    if (tab === "anual") return "Ano Atual";
    const a = prettyIso(rangeStart);
    const b = prettyIso(rangeEnd);
    return `${a} até ${b}`;
  }, [tab, dia, rangeStart, rangeEnd]);

  const orderedPeriodTotals = useMemo(() => {
    return SERVICE_CONFIG
      .map((cfg) => ({
        ...cfg,
        count: Number((computedPeriodTotals || {})[cfg.key] || 0),
      }))
      .filter((i) => i.count > 0);
  }, [computedPeriodTotals]);

  const orderedTotals = useMemo(() => {
    return SERVICE_CONFIG
      .map((cfg) => ({
        ...cfg,
        count: Number((totals || {})[cfg.key] || 0),
      }))
      .filter((i) => i.count > 0);
  }, [totals]);
  const totalGeral = useMemo(() => {
    return Object.values(totals || {}).reduce((acc, v) => acc + Number(v || 0), 0);
  }, [totals]);

  // Paginação
  const paginatedRecent = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return recent.slice(startIndex, endIndex);
  }, [recent, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(recent.length / itemsPerPage);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  

  // Filtragem com efeito de transição
  const filteredRecent = useMemo(() => {
    return recent.filter(matchesRecentFilters);
  }, [recent, matchesRecentFilters]);

  // Paginação com dados filtrados
  const paginatedFilteredRecent = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredRecent.slice(startIndex, endIndex);
  }, [filteredRecent, currentPage, itemsPerPage]);

  const totalFilteredPages = Math.ceil(filteredRecent.length / itemsPerPage);

  const visiblePages = useMemo(() => {
    const total = totalFilteredPages || totalPages;
    const max = 7;
    if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, currentPage]);
    for (let d = 1; d <= 2; d++) {
      const a = currentPage - d;
      const b = currentPage + d;
      if (a > 1) pages.add(a);
      if (b < total) pages.add(b);
    }
    const arr = Array.from(pages).sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const prev = arr[i - 1];
      const cur = arr[i];
      if (i > 0 && cur - prev > 1) out.push(-1);
      out.push(cur);
    }
    return out;
  }, [currentPage, totalFilteredPages, totalPages]);

  const loadReports = async () => {
    if (!sheetUrl || !sheetToken) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setAlert({ variant: "error", message: "Sem internet. Conecte e tente novamente." });
      return;
    }

    setReportsLoading(true);
    try {
      const buildFromFirestore = async () => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 30);
        const path = `artifacts/${appId}/public/data/atendimentos`;
        const q = query(
          collection(db, path),
          orderBy("hora_fim", "desc"),
          limit(1500)
        );
        const snap = await getDocs(q);
        const seriesAgg = {};
        const recentRows = [];
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          const ts = data.hora_fim?.toDate ? data.hora_fim.toDate() : (data.hora_fim instanceof Date ? data.hora_fim : null);
          if (!ts) return;
          if (ts < start || ts > end) return;
          const dateKey = toDateKey(ts);
          const nome = String(data?.cidadao?.nome || data?.cidadao?.nomeSocial || "").trim();
          const cpf = cleanCpf(data?.cidadao?.cpf || "");
          const hora = ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          recentRows.push({
            data: `${dateKey} ${hora}`,
            nome,
            cpf
          });
          let servicosRaw = data.servicos || data.servicosDia || data.tipoServico || [];
          if (typeof servicosRaw === "string") {
            servicosRaw = servicosRaw.split(";").map((s) => s.trim()).filter(Boolean);
          }
          if (!Array.isArray(servicosRaw)) servicosRaw = [];
          if (!seriesAgg[dateKey]) seriesAgg[dateKey] = {};
          servicosRaw.forEach((s) => {
            const k = canonicalServiceKey(s);
            if (!k) return;
            seriesAgg[dateKey][k] = (seriesAgg[dateKey][k] || 0) + 1;
          });
        });
        const totalsAgg = computeTotalsFromSeries(seriesAgg, startOfDay(start), endOfDay(end));
        setTotals(totalsAgg);
        setSeries(seriesAgg);
        setRecent(
          recentRows
            .map((r) => ({ ...r, id: getIdempotencyKey() }))
            .sort((a, b) => {
              const aDt = parseDateKey(splitDateTimePtBr(a.data).datePart);
              const bDt = parseDateKey(splitDateTimePtBr(b.data).datePart);
              if (!aDt || !bDt) return 0;
              if (aDt.getTime() !== bDt.getTime()) return bDt.getTime() - aDt.getTime();
              return splitDateTimePtBr(b.data).timePart.localeCompare(splitDateTimePtBr(a.data).timePart);
            })
        );
      };

      const makeUrl = (action, params = {}) => {
        const u = new URL(sheetUrl);
        u.searchParams.set("token", sheetToken);
        u.searchParams.set("action", action);
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            u.searchParams.set(key, value);
          }
        });
        return u.toString();
      };

      const [rTotals, rSeries, rRecent] = await Promise.all([
        fetchJson(makeUrl("totals")),
        fetchJson(makeUrl("series")),
        fetchJson(makeUrl("recent", { limit: 1000 })),
      ]);

      const anyFetchFail =
        rTotals?.error === "fetch_fail" ||
        rSeries?.error === "fetch_fail" ||
        rRecent?.error === "fetch_fail";

      if (anyFetchFail) {
        await buildFromFirestore();
        setAlert({ variant: "warning", message: "Serviço externo de relatórios indisponível. Carregando dados locais (últimos 30 dias)." });
        return;
      }

      if (!rTotals?.ok || !rSeries?.ok || !rRecent?.ok) {
        await buildFromFirestore();
        setAlert({ variant: "warning", message: "Não foi possível obter todos os dados do serviço externo. Exibindo dados locais (últimos 30 dias)." });
        return;
      }

      const totalsData = normalizeTotalsObject(rTotals.totals);
      const seriesData = normalizeSeriesObject(rSeries.series);
      setTotals(totalsData);
      setSeries(seriesData);

      const recentDataBase = (rRecent.recent || []).map(item => ({
        ...item,
        id: getIdempotencyKey()
      })).sort((a, b) => {
        const dateA = parseDateKey(splitDateTimePtBr(a.data).datePart);
        const dateB = parseDateKey(splitDateTimePtBr(b.data).datePart);
        if (!dateA || !dateB) return 0;
        if (dateA.getTime() !== dateB.getTime()) {
            return dateB.getTime() - dateA.getTime();
        }
        const timeA = splitDateTimePtBr(a.data).timePart;
        const timeB = splitDateTimePtBr(b.data).timePart;
        return timeB.localeCompare(timeA);
      });

      const missingCpfs = Array.from(
        new Set(
          recentDataBase
            .filter((r) => !String(r?.nome || "").trim())
            .map((r) => cleanCpf(r?.cpf))
            .filter((cpf) => cpf.length === 11)
        )
      );

      if (!db || !appId || missingCpfs.length === 0) {
        setRecent(recentDataBase);
        setAlert(null);
        return;
      }

      const cidPath = `artifacts/${appId}/public/data/cidadaos`;
      const col = collection(db, cidPath);
      const cpfToNome = new Map();

      const chunks = (arr, size) => {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };

      for (const part of chunks(missingCpfs, 10)) {
        const snap = await getDocs(query(col, where(documentId(), "in", part)));
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          const cpf = cleanCpf(data.cpf || d.id);
          const nome = String(data.nome || data.nomeSocial || "").trim();
          if (cpf.length === 11 && nome) cpfToNome.set(cpf, nome);
        });
      }

      const remaining = missingCpfs.filter((cpf) => !cpfToNome.has(cpf));
      for (const part of chunks(remaining, 10)) {
        const snap = await getDocs(query(col, where("cpf", "in", part)));
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          const cpf = cleanCpf(data.cpf || d.id);
          const nome = String(data.nome || data.nomeSocial || "").trim();
          if (cpf.length === 11 && nome) cpfToNome.set(cpf, nome);
        });
      }

      const recentData = recentDataBase.map((r) => {
        if (String(r?.nome || "").trim()) return r;
        const cpf = cleanCpf(r?.cpf);
        const nome = cpfToNome.get(cpf);
        if (!nome) return r;
        return { ...r, nome };
      });

      setRecent(recentData);
      setAlert(null);

    } catch (e) {
      console.error("Falha ao carregar relatórios:", e);
      setAlert({ variant: "error", message: `Erro ao buscar dados: ${e.message}. Tente recarregar.` });
    } finally {
      setReportsLoading(false);
    }
  };
  useEffect(() => {
    loadReports();
  }, []);

  // --- Lógica de Busca ---
  const buscarCidadao = async () => {
    if (!db || !appId) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setAlert({ variant: "error", message: "Sem internet. Conecte e tente novamente." });
      return;
    }

    const raw = String(busca || "").trim();
    if (!raw) {
      setAlert({ variant: "warning", message: "Digite um CPF (11 dígitos) ou o nome completo." });
      return;
    }

    setAlert(null);
    setBuscando(true);
    setCandidatos([]);
    setCidadaoSelecionado(null);
    try {
      const cidPath = `artifacts/${appId}/public/data/cidadaos`;
      const col = collection(db, cidPath);

      const cpf = cleanCpf(raw);
      if (cpf.length === 11) {
        const ref = doc(db, cidPath, cpf);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          const nome = String(data.nome || data.nomeSocial || raw || "").trim();
          const c = { cpf, nome, source: "id" };
          setCidadaoSelecionado(c);
          setCandidatos([c]);
          return;
        }

        const qCpf = query(col, where("cpf", "==", cpf), limit(5));
        const qSnap = await getDocs(qCpf);
        const res = qSnap.docs.map((d) => {
          const data = d.data() || {};
          const docIdCpf = cleanCpf(d.id);
          const realCpf = cpf || (docIdCpf.length === 11 ? docIdCpf : "");
          return {
            cpf: realCpf,
            nome: String(data.nome || data.nomeSocial || "").trim(),
            source: "cpf",
          };
        }).filter((x) => x.cpf && x.cpf.length === 11);

        if (res.length === 0) {
          setAlert({ variant: "error", message: "CPF não encontrado no cadastro de cidadãos." });
          return;
        }

        setCandidatos(res);
        setCidadaoSelecionado(res[0]);
        return;
      }

      const nomeBusca = normalizeName(raw);
      
      // Busca por parte do nome (primeiro nome, sobrenome, etc)
      const [qNome, qNomeSocial] = await Promise.all([
        getDocs(query(col, where("nome", ">=", nomeBusca), where("nome", "<=", nomeBusca + "\uf8ff"), limit(10))),
        getDocs(query(col, where("nomeSocial", ">=", nomeBusca), where("nomeSocial", "<=", nomeBusca + "\uf8ff"), limit(10))),
      ]);

      const map = new Map();
      [...qNome.docs, ...qNomeSocial.docs].forEach((d) => {
        const data = d.data() || {};
        const cpfDoc = cleanCpf(data.cpf || d.id);
        if (cpfDoc.length !== 11) return;
        const nome = String(data.nome || data.nomeSocial || nomeBusca).trim();
        map.set(cpfDoc, { cpf: cpfDoc, nome, source: "nome" });
      });

      const res = Array.from(map.values());
      if (res.length === 0) {
        setAlert({ variant: "error", message: "Nenhum cidadão encontrado com esse nome completo." });
        return;
      }

      setCandidatos(res);
      setCidadaoSelecionado(res[0]);
    } catch (e) {
      setAlert({ variant: "error", message: `Erro ao buscar cidadão: ${String(e.message || e)}` });
    } finally {
      setBuscando(false);
    }
  };

  const buscarSugestoes = async (termo) => {
    if (!db || !appId || !termo || termo.length < 2) {
      setSugestoes([]);
      setMostrarSugestoes(false);
      return;
    }

    try {
      const cidPath = `artifacts/${appId}/public/data/cidadaos`;
      const col = collection(db, cidPath);
      const nomeBusca = normalizeName(termo);

      const [qNome, qNomeSocial] = await Promise.all([
        getDocs(query(col, where("nome", ">=", nomeBusca), where("nome", "<=", nomeBusca + "\uf8ff"), limit(5))),
        getDocs(query(col, where("nomeSocial", ">=", nomeBusca), where("nomeSocial", "<=", nomeBusca + "\uf8ff"), limit(5))),
      ]);

      const map = new Map();
      [...qNome.docs, ...qNomeSocial.docs].forEach((d) => {
        const data = d.data() || {};
        const cpfDoc = cleanCpf(data.cpf || d.id);
        if (cpfDoc.length !== 11) return;
        const nome = String(data.nome || data.nomeSocial || "").trim();
        if (nome) {
          map.set(cpfDoc, { cpf: cpfDoc, nome, source: "nome" });
        }
      });

      const sugestoesArray = Array.from(map.values()).slice(0, 5);
      setSugestoes(sugestoesArray);
      setMostrarSugestoes(sugestoesArray.length > 0);
    } catch (e) {
      console.error("Erro ao buscar sugestões:", e);
      setSugestoes([]);
      setMostrarSugestoes(false);
    }
  };

  const selecionarSugestao = (sugestao) => {
    setBusca(sugestao.nome);
    setCidadaoSelecionado(sugestao);
    setCandidatos([sugestao]);
    setSugestoes([]);
    setMostrarSugestoes(false);
  };

  const handleBuscaChange = (e) => {
    const value = e.target.value;
    setBusca(value);
    if (sugestoesDebounceRef.current) clearTimeout(sugestoesDebounceRef.current);
    if (value.length < 2) {
      setSugestoes([]);
      setMostrarSugestoes(false);
      return;
    }
    sugestoesDebounceRef.current = setTimeout(() => {
      buscarSugestoes(value);
    }, 250);
  };

  const toggleServico = (s) => {
    setServicosMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const registrar = async () => {
    if (!sheetUrl || !sheetToken) {
      setAlert({ variant: "error", message: "Configuração incompleta do Google Sheets." });
      return;
    }

    const cpf = cleanCpf(cidadaoSelecionado?.cpf);
    if (cpf.length !== 11) {
      setAlert({ variant: "warning", message: "Busque e selecione um cidadão válido antes de registar." });
      return;
    }

    if (servicosSelecionadosArray.length === 0) {
      setAlert({ variant: "warning", message: "Selecione pelo menos um serviço." });
      return;
    }

    setAlert(null);
    setSalvando(true);

    const prevRecent = recent;
    const prevTotals = totals;
    const prevSeries = series;

    try {
      const primeiroServico = servicosSelecionadosArray[0] || "Serviços Gerais";
      const idempotencyKey = getIdempotencyKey();
      const payload = {
        token: sheetToken,
        cpf,
        nome: String(cidadaoSelecionado?.nome || "").trim(),
        servicos: servicosSelecionadosArray,
        unidade: primeiroServico,
        atendente: atendenteLabel,
        idempotencyKey,
      };

      const now = new Date();
      const nowStr = now.toLocaleString("pt-BR");
      const dKey = toDateKey(now);
      const optimisticRecent = {
        data: nowStr,
        cpf,
        servicos: servicosSelecionadosArray.join(";"),
        unidade: primeiroServico,
        atendente: atendenteLabel,
        nome: cidadaoSelecionado?.nome || "",
        idempotencyKey,
      };

      setRecent(prev => [optimisticRecent, ...prev.slice(0, 19)]);
      
      const nextTotals = { ...prevTotals };
      const nextSeries = { ...prevSeries };
      if (!nextSeries[dKey]) nextSeries[dKey] = {};

      servicosSelecionadosArray.forEach(s => {
        const key = canonicalServiceKey(s);
        if (!key) return;
        nextTotals[key] = (nextTotals[key] || 0) + 1;
        nextSeries[dKey][key] = (nextSeries[dKey][key] || 0) + 1;
      });
      setTotals(nextTotals);
      setSeries(nextSeries);

      if (!db || !appId) {
        throw new Error("Banco de dados indisponível.");
      }

      const firestorePath = `artifacts/${appId}/public/data/servicos_dia_registros`;
      await setDoc(doc(db, firestorePath, idempotencyKey), {
        cpf,
        nome: payload.nome,
        servicos: payload.servicos,
        unidade: payload.unidade,
        atendente: payload.atendente,
        idempotencyKey,
        createdAtClient: new Date().toISOString(),
        createdAt: serverTimestamp(),
        syncStatus: "pending",
        syncTries: 0,
        lastSyncAt: null,
        lastSyncError: null,
      });

      let sheetOk = false;
      let sheetError = null;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        sheetError = "offline";
      } else {
        const res = await fetchJson(sheetUrl, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload),
        });
        sheetOk = !!res?.ok;
        if (!sheetOk) sheetError = String(res?.error || "falha_registro");
      }

      if (sheetOk) {
        await updateDoc(doc(db, firestorePath, idempotencyKey), {
          syncStatus: "synced",
          syncedAt: serverTimestamp(),
          lastSyncAt: serverTimestamp(),
          lastSyncError: null,
        });
      } else {
        await updateDoc(doc(db, firestorePath, idempotencyKey), {
          syncStatus: "pending",
          lastSyncAt: serverTimestamp(),
          lastSyncError: sheetError,
        });
      }

      setAlert({
        variant: sheetOk ? "success" : "warning",
        message: sheetOk
          ? "Registro salvo com sucesso!"
          : "Registro salvo no sistema. Assim que a planilha voltar, o envio será feito automaticamente.",
      });
      setBusca("");
      setCandidatos([]);
      setCidadaoSelecionado(null);
      setServicosMarcados(new Set());

    } catch (e) {
      setAlert({ variant: "error", message: `Falha ao salvar: ${String(e.message || e)}` });
      // Rollback em caso de erro
      setRecent(prevRecent);
      setTotals(prevTotals);
      setSeries(prevSeries);
    } finally {
      setSalvando(false);
    }
  };

  const syncPendingToSheets = useCallback(async () => {
    if (!db || !appId || !sheetUrl || !sheetToken) return;
    if (syncBusy) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    setSyncBusy(true);
    try {
      const firestorePath = `artifacts/${appId}/public/data/servicos_dia_registros`;
      const col = collection(db, firestorePath);
      const snap = await getDocs(query(col, orderBy("createdAtClient", "asc"), limit(50)));

      for (const d of snap.docs) {
        const data = d.data() || {};
        if (String(data.syncStatus || "pending") !== "pending") continue;

        const claimed = await runTransaction(db, async (tx) => {
          const ref = doc(db, firestorePath, d.id);
          const fresh = await tx.get(ref);
          if (!fresh.exists()) return false;
          const cur = fresh.data() || {};
          if (String(cur.syncStatus || "pending") !== "pending") return false;
          const nextTries = Number(cur.syncTries || 0) + 1;
          tx.update(ref, {
            syncStatus: "syncing",
            syncTries: nextTries,
            lastSyncAt: serverTimestamp(),
            syncBy: atendenteLabel || null,
          });
          return true;
        });
        if (!claimed) continue;

        const payload = {
          token: sheetToken,
          cpf: String(data.cpf || ""),
          nome: String(data.nome || ""),
          servicos: Array.isArray(data.servicos)
            ? data.servicos
            : String(data.servicos || "").split(";").map((s) => s.trim()).filter(Boolean),
          unidade: String(data.unidade || ""),
          atendente: String(data.atendente || atendenteLabel || ""),
          idempotencyKey: String(data.idempotencyKey || d.id || ""),
        };

        const res = await fetchJson(sheetUrl, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload),
        });

        if (res?.ok) {
          await updateDoc(doc(db, firestorePath, d.id), {
            syncStatus: "synced",
            syncedAt: serverTimestamp(),
            lastSyncAt: serverTimestamp(),
            lastSyncError: null,
          });
        } else {
          await updateDoc(doc(db, firestorePath, d.id), {
            syncStatus: "pending",
            lastSyncAt: serverTimestamp(),
            lastSyncError: String(res?.error || "sheet_fail"),
          });
        }
      }
    } finally {
      setSyncBusy(false);
    }
  }, [db, appId, sheetUrl, sheetToken, syncBusy, atendenteLabel]);

  useEffect(() => {
    syncPendingToSheets();
  }, [syncPendingToSheets]);

  useEffect(() => {
    const onOnline = () => syncPendingToSheets();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncPendingToSheets]);

  useEffect(() => {
    if (!sheetUrl || !sheetToken) return;
    const id = setInterval(() => {
      syncPendingToSheets();
    }, 30000);
    return () => clearInterval(id);
  }, [sheetUrl, sheetToken, syncPendingToSheets]);

  const handleDelete = async (index) => {
    if (!confirm("Confirma exclusão?")) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setAlert({ variant: "error", message: "Sem internet. Conecte e tente novamente." });
        return;
    }

    const itemToDelete = paginatedFilteredRecent[index];
    if (!itemToDelete) return;

    const makeRowKey = (r) => {
      const cpf = String(r?.cpf || "");
      const data = String(r?.data || "");
      const servicos = Array.isArray(r?.servicos) ? r.servicos.join(";") : String(r?.servicos || "");
      return String(r?.idempotencyKey || `${cpf}-${data}-${servicos}`);
    };

    // Chave para identificar a linha a ser deletada na planilha
    const deleteKey = makeRowKey(itemToDelete);

    const originalRecent = [...recent];
    const optimisticRecent = recent.filter(r => makeRowKey(r) !== deleteKey);
    setRecent(optimisticRecent);
    const optimisticFilteredLength = optimisticRecent.filter(matchesRecentFilters).length;
    const nextTotalPages = Math.max(1, Math.ceil(optimisticFilteredLength / itemsPerPage));
    setCurrentPage((prev) => Math.min(prev, nextTotalPages));

    try {
        const payload = {
          token: sheetToken,
          action: "delete",
          idempotencyKey: deleteKey
        };
        const res = await fetchJson(sheetUrl, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload)
        });

        if (!res?.ok) {
            throw new Error(res?.error || "falha_delete");
        }

        setAlert({ variant: "success", message: "Registro excluído com sucesso!" });
        // Opcional: Recarregar os totais para refletir a exclusão
        loadReports(); 

    } catch (e) {
        setAlert({ variant: "error", message: `Falha ao excluir: ${String(e.message || e)}` });
        // Rollback em caso de erro
        setRecent(originalRecent);
    }
  };

  const resetAll = () => {
    setBusca("");
    setBuscando(false);
    setCandidatos([]);
    setCidadaoSelecionado(null);
    setServicosMarcados(new Set());
    setAlert(null);
    setSugestoes([]);
    setMostrarSugestoes(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ══════════════════════════════════════
          PAGE HEADER
          Fundo branco, separado do conteúdo por border-bottom.
          Título à esquerda, data à direita.
      ══════════════════════════════════════ */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 mb-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Serviços do Dia</h1>
            <p className="text-sm text-slate-500 mt-0.5">Registre atendimentos e visualize relatórios em tempo real</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">{toDateKey(new Date())}</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          CONTEÚDO — max-w-7xl, padding lateral,
          space-y-6 entre os blocos principais
      ══════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-6 pb-10 space-y-8">

        {filaRecepcaoServicosDia.length > 0 && (
          <Card>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Fila da Recepção</h2>
                  <p className="text-xs text-slate-500">Atendimentos aguardando em “Serviços do Dia”</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                {filaRecepcaoServicosDia.length}
              </span>
            </div>

            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500 border-b">
                  <tr>
                    <th className="text-left py-2 pr-3">CPF</th>
                    <th className="text-left py-2 pr-3">Nome</th>
                    <th className="text-right py-2 pl-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filaRecepcaoServicosDia.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2 pr-3 font-mono text-[12px] text-slate-700">{r.cpf}</td>
                      <td className="py-2 pr-3 text-slate-800">{r.nome}</td>
                      <td className="py-2 pl-3 text-right">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const selected = { cpf: r.cpf, nome: r.nome, source: "fila" };
                            setCidadaoSelecionado(selected);
                            setCandidatos([selected]);
                            setBusca(r.cpf);
                            setAlert(null);
                          }}
                        >
                          Selecionar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ══════════════════════════════════════
            CARD: NOVO ATENDIMENTO
            Cabeçalho com ícone + título.
            Grid 2 colunas: Identificar | Serviços.
            Footer separado com atendente + botão.
        ══════════════════════════════════════ */}
        <Card>
          {/* Card Header */}
          <div className="p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Novo Atendimento</h2>
          </div>

          {/* Card Body — 2 colunas */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* ── COLUNA 1: Identificar Cidadão ── */}
            <div>
              {/* Step label */}
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Identificar Cidadão</h3>
              </div>
                {/* Barra de busca + botão */}
                <div className="flex gap-2 relative">
                  <div className="relative flex-1">
                    <Input
                      icon={Search}
                      placeholder="CPF ou nome completo…"
                      value={busca}
                      onChange={handleBuscaChange}
                      onKeyDown={(e) => e.key === 'Enter' && buscarCidadao()}
                    />
                    {/* Dropdown de sugestões */}
                    {mostrarSugestoes && sugestoes.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                        {sugestoes.map((s) => (
                          <div
                            key={s.cpf}
                            className="px-4 py-3 cursor-pointer hover:bg-blue-50 border-b border-slate-100 last:border-none flex items-center gap-3"
                            onClick={() => selecionarSugestao(s)}
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{s.nome}</p>
                              <p className="text-xs text-slate-400">{formatCpf(s.cpf)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={buscarCidadao} disabled={buscando}>
                    {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {buscando ? "Buscando…" : "Buscar"}
                  </Button>
                  {(cidadaoSelecionado || busca) && (
                    <Button variant="ghost" size="sm" onClick={resetAll}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Chip do cidadão encontrado */}
                {cidadaoSelecionado && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-blue-900 truncate">{cidadaoSelecionado.nome}</p>
                      <p className="text-sm text-blue-600">{formatCpf(cidadaoSelecionado.cpf)}</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  </div>
                )}

                {/* Lista de candidatos (quando há mais de 1) */}
                {candidatos.length > 1 && (
                  <div className="mt-3 space-y-1.5">
                    {candidatos.map((c) => (
                      <button
                        key={c.cpf}
                        onClick={() => setCidadaoSelecionado(c)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm border transition-all ${
                          cidadaoSelecionado?.cpf === c.cpf
                            ? "border-blue-400 bg-blue-50 text-blue-900 font-semibold"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-medium">{c.nome}</span>
                        <span className="ml-2 text-xs opacity-60">{formatCpf(c.cpf)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── COLUNA 2: Selecionar Serviços ── */}
              <div>
                {/* Step label */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Selecionar Serviços</h3>
                </div>

                {/* Grid de botões de serviço (3 colunas) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SERVICE_CONFIG.map((s) => {
                    const isSelected = servicosMarcados.has(s.label);
                    return (
                      <button
                        key={s.key}
                        onClick={() => toggleServico(s.label)}
                        className={`relative flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border-2 transition-all duration-200 text-center group ${
                          isSelected
                            ? `${s.bg} ${s.border} ring-2 ${s.ring} ring-offset-1 scale-[1.02] shadow-sm`
                            : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm hover:scale-[1.01]"
                        }`}
                      >
                        {/* Check mark no canto quando selecionado */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm">
                            <Check className={`w-3 h-3 ${s.color}`} />
                          </div>
                        )}
                        <s.icon className={`w-7 h-7 transition-colors ${isSelected ? s.color : "text-slate-400 group-hover:text-slate-600"}`} />
                        <span className={`text-xs font-semibold transition-colors ${isSelected ? s.color : "text-slate-600"}`}>
                          {s.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
          </div>
          {/* Card Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                <User className="w-3 h-3 text-slate-500" />
              </div>
              <span className="text-sm text-slate-600">Atendente: <span className="font-semibold">{atendenteLabel}</span></span>
            </div>
            <Button
              onClick={registrar} 
              disabled={salvando || !cidadaoSelecionado || servicosSelecionadosArray.length === 0}
              className="px-4 py-2 rounded-xl"
            >
              {salvando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {salvando ? "Registrando…" : "Registrar Atendimento"}
            </Button>
          </div>
        </Card>

        {alert && (
          <div className="mb-8">
            <InlineAlert variant={alert.variant} onClose={() => setAlert(null)}>
              {alert.message}
            </InlineAlert>
          </div>
        )}

        {/* Seção de Relatórios e Últimos Registros */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna 1: Relatórios */}
          <div className="lg:col-span-1">
            <Card>
              {/* Header */}
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Relatórios
                </h3>
                <Button variant="ghost" size="sm" onClick={loadReports} disabled={reportsLoading}>
                  <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Filtros */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/70">
                <div className="space-y-3">
                  <Select value={tab} onChange={(e) => setTab(e.target.value)}>
                    <option value="diario">Diário</option>
                    <option value="semanal">Últimos 7 dias</option>
                    <option value="mensal">Mês Atual</option>
                    <option value="anual">Ano Atual</option>
                    <option value="periodo">Período Específico</option>
                  </Select>
                  {tab === "diario" && (
                    <DateInputBR valueIso={dia} onChangeIso={setDia} />
                  )}
                  {tab === "periodo" && (
                    <div className="grid grid-cols-2 gap-2">
                      <DateInputBR label="Início" valueIso={rangeStart} onChangeIso={setRangeStart} />
                      <DateInputBR label="Fim" valueIso={rangeEnd} onChangeIso={setRangeEnd} />
                    </div>
                  )}
                </div>
              </div>

              {/* Totais do Período */}
              <div className="p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">{periodTitle}</p>
                {reportsLoading ? (
                  <div className="text-center py-3">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {orderedPeriodTotals.length === 0 ? (
                      <div className="text-slate-500 text-xs col-span-full text-center py-2">Nenhum serviço neste período</div>
                    ) : (
                      orderedPeriodTotals.map((item) => (
                        <div key={item.key} className={`px-3 py-2 rounded-lg border ${item.border} ${item.bg} flex items-center justify-between`}>
                          <div className="flex items-center gap-1.5">
                            <item.icon className={`w-4 h-4 ${item.color}`} />
                            <span className="text-xs font-semibold">{item.label}</span>
                          </div>
                          <span className="text-sm font-bold">{item.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Gráfico do Período */}
              <div className="p-4 border-t border-slate-200">
                <h4 className="font-semibold text-slate-600 mb-3 text-sm">Gráfico do Período</h4>
                {reportsLoading ? (
                  <div className="text-center py-3">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                  </div>
                ) : (
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                      <BarChart data={orderedPeriodTotals} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" fontSize={10} tick={{ fill: '#64748b' }} />
                        <YAxis fontSize={10} tick={{ fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                          }}
                          labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                          itemStyle={{ color: '#475569' }}
                        />
                        <Bar dataKey="count" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Histórico Completo */}
              <div className="p-4 border-t border-slate-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-slate-600 text-sm">Histórico Completo</h4>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{totalGeral} total</span>
                </div>
                {reportsLoading ? (
                  <div className="text-center py-3">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orderedTotals.length === 0 ? (
                      <div className="text-slate-500 text-xs text-center py-2">Nenhum serviço registrado</div>
                    ) : (
                      orderedTotals.map((item) => (
                        <div key={item.key} className={`p-3 rounded-xl border ${item.border} ${item.bg} flex items-center justify-between`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg ${item.bg.replace('50', '100')} flex items-center justify-center`}>
                              <item.icon className={`w-5 h-5 ${item.color}`} />
                            </div>
                            <span className="font-bold text-sm">{item.label}</span>
                          </div>
                          <span className={`text-xl font-bold ${item.color}`}>{item.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Coluna 2: Últimos Registros */}
          <div className="lg:col-span-2">
            <Card>
              {/* Header */}
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  Últimos Registros
                </h3>
              </div>

              {/* Filtros */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/70">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome ou CPF..."
                      value={filtroCidadao}
                      onChange={(e) => { setFiltroCidadao(e.target.value); setCurrentPage(1); }}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/50 bg-white"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute top-1/2 left-3 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar por data ou hora..."
                      value={filtroHorario}
                      onChange={(e) => { setFiltroHorario(e.target.value); setCurrentPage(1); }}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/50 bg-white"
                    />
                  </div>
                </div>
                {(filtroCidadao || filtroHorario) && (
                  <div className="mt-3">
                    <button
                      onClick={() => { setFiltroCidadao(""); setFiltroHorario(""); setCurrentPage(1); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Limpar filtros ({filteredRecent.length} resultados)
                    </button>
                  </div>
                )}
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Horário</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Cidadão</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Serviços</th>
                      <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Atendente</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportsLoading ? (
                      <tr>
                        <td colSpan="5" className="text-center p-6">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                        </td>
                      </tr>
                    ) : paginatedFilteredRecent.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center p-6">
                          <p className="text-slate-500">Nenhum registro encontrado.</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedFilteredRecent.map((r, index) => {
                        const { datePart, timePart } = splitDateTimePtBr(r?.data);
                        const servicos = String(r?.servicos || "").split(";").map((s) => s.trim()).filter(Boolean);
                        return (
                          <tr key={r?.idempotencyKey || index} className="border-t border-slate-100 hover:bg-slate-50/70">
                            <td className="p-3 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-800">{timePart || "—"}</span>
                                <span className="text-xs text-slate-500">{datePart || "—"}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-slate-800">{String(r?.nome || "").trim() || "Sem nome"}</p>
                              <p className="text-xs text-slate-500">{r?.cpf ? formatCpf(r.cpf) : "CPF não informado"}</p>
                            </td>
                            <td className="p-3" style={{ minWidth: '200px', maxWidth: '350px' }}>
                              <div className="flex flex-wrap gap-1.5">
                                {servicos.map((s) => {
                                  const key = canonicalServiceKey(s);
                                  const config = SERVICE_CONFIG.find((c) => c.key === key);
                                  const label = SERVICE_LABEL_BY_KEY[key] || s;
                                  return (
                                    <div key={s} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${config ? `${config.bg} ${config.color}` : "bg-slate-100 text-slate-700"}`}>
                                      {config?.icon && <config.icon className="w-3.5 h-3.5" />}
                                      {label}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-3 text-slate-500 whitespace-nowrap">{String(r?.atendente || "").trim() || "—"}</td>
                            <td className="p-3 text-right">
                              <button
                                title="Excluir registro"
                                onClick={() => handleDelete(index)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors border-red-200 text-red-600 bg-white hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                Excluir
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {filteredRecent.length > itemsPerPage && (
                <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {filteredRecent.length > 0 && (
                      <span>
                        {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredRecent.length)} de {filteredRecent.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex gap-1">
                      {visiblePages.map((page, idx) =>
                        page === -1 ? (
                          <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-slate-500">…</span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => goToPage(page)}
                            className={`min-w-[32px] h-8 rounded-lg border text-xs font-semibold transition-colors ${
                              currentPage === page
                                ? "bg-blue-600 text-white border-blue-600"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {page}
                          </button>
                        )
                      )}
                    </div>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalFilteredPages}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

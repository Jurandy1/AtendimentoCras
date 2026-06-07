import React, { useState, useEffect, useMemo, Suspense } from "react";
import { Routes, Route, Navigate, useLocation, Link, Outlet } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { collection, onSnapshot } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import {
  Tv, LayoutDashboard, Users, Building, UserCog, Palette, Settings, LogOut,
  UserPlus, CheckCircle, ArrowRightLeft, Lock, BookOpen, Menu, X, FileText,
  UploadCloud, Activity, Trash2, FileSpreadsheet, User, ListChecks,
  ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon,
  MessageSquare, Unlock, Home, UserCheck
} from "lucide-react";
import { cn } from "./components/ui/cn";
import { normalizeRole } from "./utils/helpers";
import SaoLuisLogo from "./assets/SaoLuis.png";

// Importações Eager (Páginas Críticas)
import LoginPage from "./components/LoginPage";
import RecepcaoPage from "./components/RecepcaoPage";
import AtendentePage from "./components/AtendentePage";
import PainelTVPage from "./components/PainelTVPage";
import PerfilPage from "./components/PerfilPage";
import ChangePasswordModal from "./components/ChangePasswordModal";
import TutorialAtendente from "./components/TutorialAtendente";
import HomePage from "./components/HomePage";
import ServicosDiaPage from "./components/ServicosDiaPage";

// Importações Lazy (Páginas Pesadas/Secundárias)
const AdministracaoPage    = React.lazy(() => import("./components/AdministracaoPage"));
const RelatoriosPage       = React.lazy(() => import("./components/RelatoriosPage"));
const RelatorioRMAPage     = React.lazy(() => import("./components/RelatorioRMAPage"));
const RelatorioTecnicoPage = React.lazy(() => import("./components/RelatorioTecnicoPage"));
const HistoricoPage        = React.lazy(() => import("./components/HistoricoPage"));
const HistoricoObservacoesPage = React.lazy(() => import("./components/HistoricoObservacoesPage"));
const ChatInterno          = React.lazy(() => import("./components/chat/ChatInterno"));
const LiberarAtendente     = React.lazy(() => import("./components/admin/LiberarAtendente"));
const ExportacaoDadosPage  = React.lazy(() => import("./components/admin/ExportacaoDadosPage"));
const FichaUsuariosPage    = React.lazy(() => import("./components/FichaUsuariosPage"));

const ROLES_ADMIN = ["superintendente", "coordenador", "admin", "master", "super_admin"];
const DEFAULT_ROUTE = "/home";

// ════════════════════════════════════════════════════════════════════
// HELPERS DE PERMISSÃO — fonte única de verdade
// ════════════════════════════════════════════════════════════════════

const isOnlyTypeUser = (userProfile, typeId) => {
  const types = userProfile?.tipos_atende || [];
  if (!typeId || !Array.isArray(types) || types.length === 0) return false;
  const others = types.filter(id => id !== typeId);
  return types.includes(typeId) && others.length === 0;
};

const findTypeId = (tipos, predicate) => {
  const t = (tipos || []).find(x => predicate((x?.nome || '').toLowerCase()));
  return t?.id || null;
};

const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
  </div>
);

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("Erro global na aplicação:", error, info); }
  render() {
    if (this.state.hasError) {
      const message = (this.state.error?.message) || String(this.state.error || "");
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white/95 shadow-lg rounded-xl p-8 max-w-lg w-full text-center backdrop-blur-sm space-y-4">
            <h1 className="text-xl font-semibold text-red-700">Ocorreu um erro na aplicação</h1>
            <p className="text-sm text-gray-700">
              Tente atualizar a página. Se o problema persistir, envie a mensagem abaixo para o suporte:
            </p>
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-3 text-left break-words">
              {message}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { user, loading, db, appId, userProfile, logout, auth, profileLoading, profileChecked } = useAuth();

  const [crasUnidades, setCrasUnidades]       = useState([]);
  const [tiposAtendimento, setTiposAtendimento] = useState([]);
  const [atendentesList, setAtendentesList]   = useState([]);
  const [salasAtendimento, setSalasAtendimento] = useState([]);
  const location = useLocation();

  // Login anônimo para PainelTV
  useEffect(() => {
    if (loading || user) return;
    const isPainel =
      location.pathname === '/painel' ||
      new URLSearchParams(window.location.search).get("page") === "PainelTV";
    if (isPainel) {
      signInAnonymously(auth).catch((err) => console.error("Erro no login anônimo:", err));
    }
  }, [loading, user, auth, location]);

  // Listeners de dados globais
  useEffect(() => {
    if (!user || !db) return;
    let mounted = true;

    const unsubCras = onSnapshot(
      collection(db, `artifacts/${appId}/public/data/cras_unidades`),
      (snap) => mounted && setCrasUnidades(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => mounted && console.error("Erro ao carregar CRAS:", err)
    );

    const unsubTipos = onSnapshot(
      collection(db, `artifacts/${appId}/public/data/tipos_atendimento`),
      (snap) => {
        if (!mounted) return;
        const tipos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const seen = new Set();
        const unique = [];
        for (const t of tipos) {
          const name = (t.nome || '').trim();
          if (!seen.has(name)) {
            seen.add(name);
            unique.push(t);
          }
        }
        unique.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        setTiposAtendimento(unique);
      },
      (err) => mounted && console.error("Erro ao carregar Tipos:", err)
    );

    const unsubAtendentes = onSnapshot(
      collection(db, `artifacts/${appId}/public/data/atendentes`),
      (snap) => {
        if (!mounted) return;
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const scoreAtendente = (a) => {
          const email = String(a?.email || "").trim();
          const role = String(a?.role || "").trim().toLowerCase();
          const cargo = String(a?.cargo || "").trim();
          const crasId = String(a?.cras_id || a?.crasId || "").trim();
          const uid = String(a?.uid || "").trim();
          const status = String(a?.status || "").trim().toLowerCase();

          const knownRoles = new Set(["atendente", "recepcionista", "coordenador", "admin", "master", "super_admin", "superintendente"]);
          const hasKnownRole = role && knownRoles.has(role);

          const tsMs = (ts) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0);
          const updatedMs = tsMs(a?.updatedAt) || tsMs(a?.updated_at) || tsMs(a?.modificado_em) || 0;
          const createdMs = tsMs(a?.createdAt) || tsMs(a?.created_at) || 0;

          let score = 0;
          if (email) score += 5;
          if (cargo) score += 5;
          if (crasId) score += 25;
          if (role) score += 10;
          if (hasKnownRole) score += 20;
          if (uid) score += 15;
          if (uid && String(a?.id || "").trim() === uid) score += 15;
          if (Array.isArray(a?.permissions) && a.permissions.length > 0) score += 5;
          if (status === "online") score += 3;
          if (status === "offline") score += 1;
          score += Math.min(10, Math.floor((updatedMs || createdMs) / 1_000_000_000_000));
          return score;
        };

        const byEmail = new Map();
        const order = [];
        for (const a of raw) {
          const emailNorm = String(a?.email || "").trim().toLowerCase();
          if (!emailNorm) continue;
          if (!byEmail.has(emailNorm)) order.push(emailNorm);
          const current = byEmail.get(emailNorm);
          if (!current) {
            byEmail.set(emailNorm, a);
          } else if (scoreAtendente(a) > scoreAtendente(current)) {
            byEmail.set(emailNorm, a);
          }
        }

        const semEmail = raw.filter((a) => !String(a?.email || "").trim());
        const deduped = [...order.map((k) => byEmail.get(k)).filter(Boolean), ...semEmail];
        setAtendentesList(deduped);
      },
      (err) => mounted && console.error("Erro ao carregar Atendentes:", err)
    );

    const unsubSalas = onSnapshot(
      collection(db, `artifacts/${appId}/public/data/atendente_salas`),
      (snap) => mounted && setSalasAtendimento(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => mounted && console.error("Erro ao carregar Salas:", err)
    );

    return () => {
      mounted = false;
      unsubCras();
      unsubTipos();
      unsubAtendentes();
      unsubSalas();
    };
  }, [user, db, appId]);

  const isAppUser = !!user && !user.isAnonymous;
  const roleNorm  = userProfile?.roleNorm || normalizeRole(userProfile?.role || userProfile?.cargo);
  const isAdmin   = !!userProfile && ROLES_ADMIN.includes(roleNorm);

  const recepcaoTypeId = useMemo(
    () => findTypeId(tiposAtendimento, n => n.includes("recep")),
    [tiposAtendimento]
  );

  const servicosDiaTypeId = useMemo(
    () => findTypeId(tiposAtendimento, n =>
      (n.includes("servi") && n.includes("dia")) ||
      n.includes("serviços do dia") ||
      n.includes("servicos do dia")
    ),
    [tiposAtendimento]
  );

  const isServicosDiaOnlyUser = useMemo(() => {
    if (ROLES_ADMIN.includes(roleNorm)) return false;
    return isOnlyTypeUser(userProfile, servicosDiaTypeId);
  }, [userProfile, servicosDiaTypeId, roleNorm]);

  const isRecepcaoOnlyUser = useMemo(() => {
    if (ROLES_ADMIN.includes(roleNorm)) return false;
    return isOnlyTypeUser(userProfile, recepcaoTypeId);
  }, [userProfile, recepcaoTypeId, roleNorm]);

  const canAccessRecepcao =
    isAdmin ||
    roleNorm === "recepcionista" ||
    (userProfile?.tipos_atende?.includes(recepcaoTypeId));

  const canAccessAtendente =
    ROLES_ADMIN.includes(roleNorm) ||
    (roleNorm === "atendente" && !isServicosDiaOnlyUser);

  const canAccessGestao      = isAdmin;
  const canViewRMA           = isAdmin;
  const canViewHistory       = isAdmin;
  const canViewRelatorioTecnico = isAdmin; // ← nova permissão
  const canAccessServicosDia =
    isAdmin ||
    (userProfile?.tipos_atende?.includes(servicosDiaTypeId));

  const [showTimeoutError, setShowTimeoutError] = useState(false);

  // Safety timeout: 15s
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setShowTimeoutError(true), 15000);
    } else {
      setShowTimeoutError(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white/95 shadow-lg rounded-xl p-8 max-w-md w-full text-center backdrop-blur-sm">
          {!showTimeoutError ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Conectando ao sistema...</p>
              <p className="text-xs text-gray-400 mt-2">Aguarde um momento</p>
            </>
          ) : (
            <>
              <div className="text-yellow-500 mb-4 flex justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">A conexão está lenta</h2>
              <p className="text-gray-600 mb-6 text-sm">
                O carregamento está demorando mais que o normal. Isso pode ser causado por uma conexão de internet instável.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-brand hover:bg-brand-hover text-white font-bold py-2 px-6 rounded-lg transition-colors w-full"
              >
                Tentar Novamente
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <RootErrorBoundary>
      <Routes>
        <Route
          path="/painel"
          element={
            <PainelTVPage
              crasUnidades={crasUnidades}
              tiposAtendimento={tiposAtendimento}
              atendentesList={atendentesList}
              salasAtendimento={salasAtendimento}
            />
          }
        />

        {!isAppUser ? (
          <Route path="*" element={<LoginPage />} />
        ) : profileLoading || !profileChecked ? (
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white/95 shadow-lg rounded-xl p-8 max-w-md w-full text-center backdrop-blur-sm">
                  <p className="text-gray-600">Carregando perfil...</p>
                </div>
              </div>
            }
          />
        ) : !userProfile ? (
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white/95 shadow-lg rounded-xl p-8 max-w-md w-full text-center backdrop-blur-sm space-y-4">
                  <p className="text-gray-800 font-semibold">Acesso não autorizado</p>
                  <p className="text-gray-600 text-sm">
                    Seu usuário está autenticado, mas não possui perfil cadastrado no sistema.
                  </p>
                  <button
                    onClick={logout}
                    className="w-full px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium"
                  >
                    Sair
                  </button>
                </div>
              </div>
            }
          />
        ) : (
          <Route
            path="/*"
            element={
              <Layout
                userProfile={userProfile}
                logout={logout}
                roleNorm={roleNorm}
                isAdmin={isAdmin}
                isRecepcaoOnlyUser={isRecepcaoOnlyUser}
                isServicosDiaOnlyUser={isServicosDiaOnlyUser}
                canAccessRecepcao={canAccessRecepcao}
                canAccessAtendente={canAccessAtendente}
                canAccessServicosDia={canAccessServicosDia}
                canViewRMA={canViewRMA}
                canViewHistory={canViewHistory}
                canViewRelatorioTecnico={canViewRelatorioTecnico}
              />
            }
          >
            <Route index element={<Navigate to={DEFAULT_ROUTE} replace />} />
            <Route path="home" element={<HomePage />} />
            <Route
              path="recepcao"
              element={canAccessRecepcao ? (
                <RecepcaoPage
                  db={db} appId={appId}
                  crasUnidades={crasUnidades}
                  tiposAtendimento={tiposAtendimento}
                  atendentesList={atendentesList}
                  userProfile={userProfile}
                />
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route
              path="atendente"
              element={canAccessAtendente ? (
                <AtendentePage
                  crasUnidades={crasUnidades}
                  tiposAtendimento={tiposAtendimento}
                  atendentesList={atendentesList}
                  salasAtendimento={salasAtendimento}
                />
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route
              path="fichas-usuarios"
              element={canAccessAtendente ? (
                <Suspense fallback={<PageLoader />}>
                  <FichaUsuariosPage />
                </Suspense>
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route
              path="servicos-dia"
              element={canAccessServicosDia ? <ServicosDiaPage /> : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route
              path="tutorial"
              element={canAccessAtendente ? <TutorialAtendente /> : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route
              path="administracao/liberar-atendente"
              element={canAccessGestao ? (
                <Suspense fallback={<PageLoader />}>
                  <LiberarAtendente />
                </Suspense>
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route
              path="administracao/*"
              element={canAccessGestao ? (
                <Suspense fallback={<PageLoader />}>
                  <AdministracaoPage
                    crasUnidades={crasUnidades}
                    tiposAtendimento={tiposAtendimento}
                    atendentesList={atendentesList}
                  />
                </Suspense>
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route
              path="relatorios"
              element={canAccessGestao ? (
                <Suspense fallback={<PageLoader />}>
                  <RelatoriosPage
                    crasUnidades={crasUnidades}
                    tiposAtendimento={tiposAtendimento}
                    atendentesList={atendentesList}
                  />
                </Suspense>
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route
              path="relatorio-rma"
              element={canViewRMA ? (
                <Suspense fallback={<PageLoader />}>
                  <RelatorioRMAPage crasUnidades={crasUnidades} />
                </Suspense>
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />

            {/* ── NOVA ROTA: Relatório Técnico ─────────────────── */}
            <Route
              path="relatorio-tecnico"
              element={canViewRelatorioTecnico ? (
                <Suspense fallback={<PageLoader />}>
                  <RelatorioTecnicoPage atendentesList={atendentesList} />
                </Suspense>
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            {/* ─────────────────────────────────────────────────── */}

            <Route
              path="historico"
              element={canViewHistory ? (
                <Suspense fallback={<PageLoader />}>
                  <HistoricoPage
                    db={db} appId={appId} userProfile={userProfile}
                    crasUnidades={crasUnidades}
                    tiposAtendimento={tiposAtendimento}
                    atendentesList={atendentesList}
                  />
                </Suspense>
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route
              path="historico-observacoes"
              element={canAccessAtendente ? (
                <Suspense fallback={<PageLoader />}>
                  <HistoricoObservacoesPage
                    db={db} appId={appId} userProfile={userProfile}
                    crasUnidades={crasUnidades}
                    tiposAtendimento={tiposAtendimento}
                    atendentesList={atendentesList}
                  />
                </Suspense>
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route
              path="exportacao"
              element={canAccessGestao ? (
                <Suspense fallback={<PageLoader />}>
                  <ExportacaoDadosPage />
                </Suspense>
              ) : <Navigate to={DEFAULT_ROUTE} replace />}
            />
            <Route path="perfil" element={<PerfilPage />} />
          </Route>
        )}

        {isAppUser && userProfile && !profileLoading && profileChecked && (
          <Route path="*" element={<Navigate to={DEFAULT_ROUTE} replace />} />
        )}
      </Routes>
    </RootErrorBoundary>
  );
}

// ════════════════════════════════════════════════════════════════════
// LAYOUT — agora recebe permissões já calculadas (sem duplicar lógica)
// ════════════════════════════════════════════════════════════════════

function Layout({
  userProfile, logout, roleNorm, isAdmin,
  isServicosDiaOnlyUser, canAccessRecepcao, canAccessAtendente,
  canAccessServicosDia, canViewRMA, canViewHistory, canViewRelatorioTecnico
}) {
  const location = useLocation();
  const [showPasswordModal, setShowPasswordModal]   = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen]         = useState(false);
  const [isSidebarOpen, setIsSidebarOpen]           = useState(true);
  const [isGestaoMenuOpen, setIsGestaoMenuOpen]     = useState(false);

  const navItems = useMemo(() => {
    const isPsicologo = userProfile?.cargo?.toLowerCase().includes("psic") || roleNorm === "psicologo";

    const items = [
      { to: "/home",                    icon: Home,         label: "Início",                     show: true },
      { to: "/recepcao",                icon: UserPlus,     label: "Recepção",                   show: canAccessRecepcao },
      { to: "/atendente",               icon: LayoutDashboard, label: "Painel do Atendente",     show: canAccessAtendente },
      { to: "/fichas-usuarios",         icon: FileText,     label: "Ficha dos Usuários",         show: canAccessAtendente && isPsicologo },
      { to: "/historico-observacoes",   icon: MessageSquare, label: "Histórico de Observações",  show: canAccessAtendente },
      { to: "/servicos-dia",            icon: ListChecks,   label: "Serviços do Dia",            show: canAccessServicosDia },
      { to: "/tutorial",                icon: BookOpen,     label: "Tutorial",                   show: canAccessAtendente },
      { to: "/painel",                  icon: Tv,           label: "Painel TV",                  show: roleNorm !== "atendente" && roleNorm !== "atendente padrao" },
      { to: "/perfil",                  icon: User,         label: "Meu Perfil",                 show: true },
    ];

    if (isServicosDiaOnlyUser) {
      return {
        main: items.filter(i => i.to === "/servicos-dia"),
        gestao: [],
        administracao: []
      };
    }

    const gestaoItems = [
      { to: "/relatorios",          icon: CheckCircle,   label: "Relatórios",            show: isAdmin },
      { to: "/relatorio-rma",       icon: FileText,      label: "Relatório RMA",         show: canViewRMA },
      { to: "/relatorio-tecnico",   icon: UserCheck,     label: "Relatório Técnico",     show: canViewRelatorioTecnico }, // ← novo
      { to: "/historico",           icon: ArrowRightLeft, label: "Histórico",            show: canViewHistory },
      { to: "/exportacao",          icon: FileSpreadsheet, label: "Exportação de Dados", show: isAdmin },
    ];

    const adminItems = [
      { to: "/administracao/cras",               icon: Building,   label: "Unidades Centro Pop",        show: isAdmin },
      { to: "/administracao/atendentes",          icon: UserCog,    label: "Atendentes",                 show: isAdmin },
      { to: "/administracao/liberar-atendente",   icon: Unlock,     label: "Liberar Atendente",          show: isAdmin },
      { to: "/administracao/usuarios",            icon: Users,      label: "Usuários cadastrados",       show: isAdmin },
      { to: "/administracao/tipos",               icon: Palette,    label: "Tipos de Atendimento",       show: isAdmin },
      { to: "/administracao/config_atendente",    icon: Settings,   label: "Configurações de Atendente", show: isAdmin },
      { to: "/administracao/importacao",          icon: UploadCloud, label: "Importação de Usuários",   show: isAdmin },
      { to: "/administracao/bloqueados",          icon: FileText,   label: "Usuários Desligados",        show: isAdmin },
      { to: "/administracao/logs",                icon: Activity,   label: "Logs do Sistema",            show: isAdmin },
      { to: "/administracao/cleanup",             icon: Trash2,     label: "Limpeza do Sistema",         show: isAdmin },
    ];

    return {
      main: items.filter(i => i.show),
      gestao: gestaoItems.filter(i => i.show),
      administracao: adminItems.filter(i => i.show)
    };
  }, [
    canAccessRecepcao, canAccessAtendente, canAccessServicosDia,
    isAdmin, canViewRMA, canViewHistory, canViewRelatorioTecnico,
    roleNorm, userProfile, isServicosDiaOnlyUser
  ]);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  const NavLink = ({ to, icon: Icon, label, onClick }) => (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
        isActive(to) ? "bg-brand text-white shadow-md" : "text-white/90 hover:bg-white/10 hover:text-white",
        !isSidebarOpen && "justify-center px-2"
      )}
      title={!isSidebarOpen ? label : undefined}
    >
      <Icon size={20} className={cn("min-w-[20px]", isActive(to) ? "text-white" : "text-white/80 group-hover:text-white")} />
      {isSidebarOpen && (
        <span className="text-sm font-medium truncate origin-left animate-fadeIn">{label}</span>
      )}
      {!isSidebarOpen && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-govbr-azul-escuro text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
          {label}
        </div>
      )}
    </Link>
  );

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const formatRoleDisplay = (role) => {
    if (!role) return "Visitante";
    const labels = {
      super_admin: "Super Coordenador",
      superintendente: "Superintendente",
      coordenador: "Coordenador",
      coordenadora: "Coordenador",
      recepcionista: "Recepcionista",
      atendente: "Atendente",
      psicologo: "Psicólogo(a)",
      assistente_social: "Assistente Social",
      cadunico: "CadÚnico",
      admin: "Administrador",
      master: "Administrador",
    };
    const key = String(role).toLowerCase().trim().replace(/[\s-]+/g, "_");
    return labels[key] || String(role).replace(/Coordenadora/gi, "Coordenador");
  };

  return (
    <div className="flex h-screen bg-govbr-fundo overflow-hidden font-sans">
      {/* Sidebar Desktop */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-govbr-azul-escuro text-white shadow-xl z-20 transition-all duration-300 ease-in-out relative",
          isSidebarOpen ? "w-72" : "w-20"
        )}
      >
        <div className={cn(
          "flex items-center justify-center bg-[#0A3D7A] border-b border-white/10 transition-all duration-300 overflow-hidden shrink-0",
          isSidebarOpen ? "h-40" : "h-20"
        )}>
          {isSidebarOpen ? (
            <div className="flex flex-col items-center justify-center w-full px-4 animate-fadeIn">
              <img src={SaoLuisLogo} alt="Semcas" className="h-28 w-auto object-contain mb-2" />
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <img src={SaoLuisLogo} alt="Semcas" className="h-16 w-16 object-contain drop-shadow-md" />
            </div>
          )}
        </div>

        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-24 z-30 p-1.5 rounded-full bg-brand text-white hover:bg-brand-hover shadow-lg border border-white/20 transition-transform hover:scale-110"
          title={isSidebarOpen ? "Recolher menu" : "Expandir menu"}
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {navItems.main.map((item) => (
            <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
          ))}

          {(navItems.gestao.length > 0 || navItems.administracao.length > 0) && (
            <>
              <div className={cn("transition-all duration-300 overflow-hidden", isSidebarOpen ? "pt-6 pb-2 px-2" : "py-4 flex justify-center")}>
                {isSidebarOpen ? (
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest border-b border-white/10 pb-1 truncate">Gestão</p>
                ) : (
                  <div className="w-8 h-[1px] bg-white/10" />
                )}
              </div>

              {navItems.gestao.map((item) => (
                <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
              ))}

              {navItems.administracao.length > 0 && (
                <div className="space-y-1">
                  <button
                    onClick={() => setIsGestaoMenuOpen(!isGestaoMenuOpen)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative w-full",
                      "text-white/90 hover:bg-white/10 hover:text-white",
                      !isSidebarOpen && "justify-center px-2"
                    )}
                  >
                    <Settings size={20} className="min-w-[20px] text-white/80 group-hover:text-white" />
                    {isSidebarOpen && (
                      <>
                        <span className="text-sm font-medium truncate origin-left animate-fadeIn">Administração</span>
                        <div className="ml-auto">
                          {isGestaoMenuOpen ? (
                            <ChevronDown size={16} className={cn("transition-transform", isGestaoMenuOpen && "rotate-180")} />
                          ) : (
                            <ChevronRightIcon size={16} />
                          )}
                        </div>
                      </>
                    )}
                    {!isSidebarOpen && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-govbr-azul-escuro text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                        Administração
                      </div>
                    )}
                  </button>

                  {isGestaoMenuOpen && isSidebarOpen && (
                    <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
                      {navItems.administracao.map((item) => (
                        <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-white/10 bg-[#0A3D7A] shrink-0">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-white/5 border border-white/10">
              <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0">
                {userProfile?.nome ? userProfile.nome.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 overflow-hidden min-w-0">
                <p className="text-sm font-bold truncate text-white">{userProfile?.nome || 'Usuário'}</p>
                <p className="text-[10px] text-white/70 truncate uppercase tracking-wider">{formatRoleDisplay(userProfile?.role || 'Atendente')}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-bold text-white shadow-sm" title={userProfile?.nome}>
                {userProfile?.nome ? userProfile.nome.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
          )}

          <div className={cn("grid gap-2", isSidebarOpen ? "grid-cols-2" : "grid-cols-1")}>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center justify-center gap-2 p-2 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
              title="Alterar Senha"
            >
              <Lock size={16} />
              {isSidebarOpen && "Senha"}
            </button>

            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 p-2 rounded-md text-xs font-medium bg-red-900/80 hover:bg-red-700 text-red-100 border border-red-800/50 transition-colors"
              title="Sair do Sistema"
            >
              <LogOut size={16} />
              {isSidebarOpen && "Sair"}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300">
        {/* Header Desktop */}
        <header className="hidden md:flex items-center justify-between bg-white shadow-sm px-6 py-3 border-b border-govbr-borda z-10 h-16">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-govbr-texto tracking-tight leading-none">Sistema - Centro Pop</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-brand"></span>
                <p className="text-[10px] font-bold text-brand uppercase tracking-widest">Prefeitura de São Luís • SEMCAS</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden lg:block leading-tight">
              <p className="text-sm font-bold text-govbr-texto">{userProfile?.nome || 'Usuário'}</p>
              <p className="text-[10px] text-govbr-texto-secundario font-bold uppercase">
                {formatRoleDisplay(userProfile?.role || 'Visitante')}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm shadow-md border-2 border-white ring-1 ring-govbr-borda">
              {userProfile?.nome ? userProfile.nome.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        </header>

        {/* Menu Mobile */}
        <div className="md:hidden">
          <header className="bg-govbr-azul-escuro text-white p-4 flex items-center justify-between shadow-md z-20">
            <div className="flex items-center gap-3">
              <img src={SaoLuisLogo} alt="Logo" className="h-12 bg-white/90 rounded px-2 py-1 shadow-sm" />
              <div>
                <h1 className="text-sm font-bold leading-tight">Centro Pop</h1>
                <p className="text-xs text-white/80">Sistema Integrado</p>
              </div>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-md hover:bg-white/10 transition-colors">
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </header>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 flex">
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={closeMobileMenu} />

              <nav className="relative flex-1 flex flex-col max-w-xs w-full bg-govbr-azul-escuro text-white shadow-2xl animate-fade-in">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0A3D7A]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">Menu</span>
                    <span className="text-xs bg-brand px-2 py-0.5 rounded text-white/90">v1.0</span>
                  </div>
                  <button onClick={closeMobileMenu} className="p-1 rounded hover:bg-white/10 transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
                  {navItems.main.map((item) => (
                    <Link
                      key={item.to} to={item.to} onClick={closeMobileMenu}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        isActive(item.to) ? "bg-brand text-white" : "text-white/90 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <item.icon size={20} /> {item.label}
                    </Link>
                  ))}

                  {(navItems.gestao.length > 0 || navItems.administracao.length > 0) && (
                    <>
                      <div className="pt-4 pb-2 px-4 text-xs font-semibold text-white/70 uppercase tracking-widest border-b border-white/10 mb-2">
                        Gestão
                      </div>
                      {navItems.gestao.map((item) => (
                        <Link
                          key={item.to} to={item.to} onClick={closeMobileMenu}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                            isActive(item.to) ? "bg-brand text-white" : "text-white/90 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <item.icon size={20} /> {item.label}
                        </Link>
                      ))}

                      {navItems.administracao.length > 0 && (
                        <>
                          <button
                            onClick={() => setIsGestaoMenuOpen(!isGestaoMenuOpen)}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left text-white/90 hover:bg-white/10 hover:text-white"
                          >
                            <Settings size={20} />
                            <span className="font-medium">Administração</span>
                            <span className="ml-auto">
                              {isGestaoMenuOpen ? <ChevronDown size={16} /> : <ChevronRightIcon size={16} />}
                            </span>
                          </button>

                          {isGestaoMenuOpen && (
                            <div className="ml-4 border-l border-white/10 pl-3 space-y-1">
                              {navItems.administracao.map((item) => (
                                <Link
                                  key={item.to} to={item.to}
                                  onClick={() => { setIsGestaoMenuOpen(false); closeMobileMenu(); }}
                                  className={cn(
                                    "flex items-center gap-3 px-4 py-2 rounded-lg transition-colors",
                                    isActive(item.to) ? "bg-brand text-white" : "text-white/90 hover:bg-white/10 hover:text-white"
                                  )}
                                >
                                  <item.icon size={18} /> {item.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="p-4 border-t border-white/10 bg-[#0A3D7A] space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-xs font-bold ring-2 ring-white/20">
                      {userProfile?.nome ? userProfile.nome.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{userProfile?.nome || 'Usuário'}</p>
                      <p className="text-xs text-white/70">{formatRoleDisplay(userProfile?.role || 'Atendente')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { closeMobileMenu(); setShowPasswordModal(true); }} className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded bg-white/10 hover:bg-white/20 text-sm transition-colors">
                      <Lock size={16} /> Senha
                    </button>
                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded bg-red-900/80 hover:bg-red-700 text-sm transition-colors">
                      <LogOut size={16} /> Sair
                    </button>
                  </div>
                </div>
              </nav>
            </div>
          )}
        </div>

        {/* Conteúdo Principal */}
        <main className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth scrollbar-thin scrollbar-thumb-govbr-borda scrollbar-track-transparent bg-govbr-fundo">
          <div className="max-w-[1600px] mx-auto w-full flex flex-col min-h-full">
            <div className="flex-1 animate-fadeIn">
              <Outlet />
            </div>

            <footer className="mt-12 py-6 border-t border-govbr-borda text-center shrink-0">
              <div className="flex flex-col items-center justify-center opacity-60 hover:opacity-100 transition-opacity">
                <img src={SaoLuisLogo} alt="Brasão São Luís" className="h-9 mb-2 grayscale opacity-60" />
                <p className="text-xs text-govbr-texto-secundario font-medium">
                  © {new Date().getFullYear()} Prefeitura de São Luís - MA
                </p>
                <p className="text-[10px] text-govbr-texto-secundario/80 uppercase tracking-widest mt-1">
                  Secretaria Municipal da Criança e Assistência Social (SEMCAS)
                </p>
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* Chat Interno (Flutuante) */}
      <Suspense fallback={null}>
        <ChatInterno />
      </Suspense>

      {/* Modais Globais */}
      {showPasswordModal && (
        <ChangePasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
    </div>
  );
}

export default App;

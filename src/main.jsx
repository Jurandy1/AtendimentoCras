import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";

const Router = ({ children }) => (
  <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {children}
  </HashRouter>
);

const renderFatal = (title, err) => {
  const existingOverlay = document.getElementById("fatal-error-overlay");
  if (existingOverlay) return;

  const overlay = document.createElement("div");
  overlay.id = "fatal-error-overlay";
  overlay.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);";

  const message = err instanceof Error ? err.message : String(err);

  overlay.innerHTML = `
    <div style="background:#fee2e2;border:1px solid #ef4444;border-radius:12px;padding:24px;max-width:800px;width:100%;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);font-family:system-ui,-apple-system,sans-serif">
      <h1 style="color:#991b1b;margin-top:0;font-size:1.5rem;margin-bottom:1rem">Erro ao iniciar</h1>
      <p style="color:#7f1d1d;font-weight:600;margin-bottom:1rem">${title}</p>
      <div style="background:white;padding:1rem;border-radius:6px;border:1px solid #fecaca;margin-bottom:1rem;max-height:300px;overflow:auto">
        <p style="color:#ef4444;font-family:monospace;margin:0;white-space:pre-wrap">${message}</p>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="window.location.reload()" style="background:#dc2626;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600">
          Recarregar Página
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
};

window.addEventListener("error", (ev) => renderFatal("Erro Global de Script", ev.error || ev.message));
window.addEventListener("unhandledrejection", (ev) => renderFatal("Promise Rejeitada (Async)", ev.reason));

const mountApp = () => {
  try {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      renderFatal("Elemento Root Não Encontrado", "O elemento <div id='root'></div> não existe no HTML.");
      return;
    }
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <Router>
          <AuthProvider>
            <App />
          </AuthProvider>
        </Router>
      </React.StrictMode>
    );
    const loader = document.getElementById("root-loader");
    if (loader) loader.remove();
  } catch (err) {
    renderFatal("Erro na Montagem do React", err);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountApp);
} else {
  mountApp();
}

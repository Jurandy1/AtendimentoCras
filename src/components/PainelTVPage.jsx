import React, { useState, useEffect, useRef, useMemo } from "react";
import { query, collection, where, onSnapshot, limit, orderBy } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { getFriendlyFirebaseError, normalizeName, playBeep, simplify } from "../utils";
import SaoLuisLogo from "../assets/SaoLuis.png";
import Relogio from "./Relogio";
import { useLocation } from "react-router-dom";

const COR_PRINCIPAL = "#1351B4";

// ─────────────────────────────────────────────────────────────────
// MODO DIAGNÓSTICO — ativado com ?debug=1 na URL
// Mostra na tela qual estratégia de TTS está ativa, vozes, logs, etc.
// ─────────────────────────────────────────────────────────────────

const DEBUG_LOGS = [];
const DEBUG_MAX = 30;
const debugListeners = new Set();

const addDebugLog = (nivel, mensagem) => {
  const ts = new Date().toLocaleTimeString("pt-BR");
  DEBUG_LOGS.push({ ts, nivel, mensagem: String(mensagem).slice(0, 200) });
  if (DEBUG_LOGS.length > DEBUG_MAX) DEBUG_LOGS.shift();
  debugListeners.forEach((cb) => cb());
};

const dlog   = (...args) => { console.log(...args);   addDebugLog("info",  args.join(" ")); };
const dwarn  = (...args) => { console.warn(...args);  addDebugLog("warn",  args.join(" ")); };
const derror = (...args) => { console.error(...args); addDebugLog("error", args.join(" ")); };

// ─────────────────────────────────────────────────────────────────
// TTS UNIVERSAL — Samsung, TCL, HQ, LG, Android TV, PC
// ─────────────────────────────────────────────────────────────────

const ttsStatus = {
  estrategia: "indefinida",
  vozSelecionada: null,
  anunciosFeitos: 0,
  ultimoAnuncioTs: null,
  ultimoErro: null,
};
const ttsStatusListeners = new Set();
const notificarTTS = () => ttsStatusListeners.forEach((cb) => cb());

const ehSmartTV = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Tizen|SMART-TV|SamsungBrowser|webOS|NetCast|HbbTV|VIDAA|HiSilicon|Android.*TV|GoogleTV|AFTS|AFTM|AFTN|AFTB|AFTT|CrKey|MIBOX|BRAVIA|Roku|TCL/i.test(ua);
};

const isSamsungTV = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Tizen|SamsungBrowser/i.test(ua);
};

const escolherVoz = () => {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  return (
    voices.find((v) => v.lang === "pt-BR" && !v.localService) ||
    voices.find((v) => v.lang === "pt-BR") ||
    voices.find((v) => v.lang?.startsWith("pt")) ||
    voices[0] || null
  );
};

const quebrarEmChunks = (texto, maxLen = 190) => {
  const chunks = [];
  const palavras = String(texto || "").split(" ");
  let atual = "";
  for (const p of palavras) {
    if ((atual + " " + p).length > maxLen) {
      if (atual.trim()) chunks.push(atual.trim());
      atual = p;
    } else {
      atual = atual ? atual + " " + p : p;
    }
  }
  if (atual.trim()) chunks.push(atual.trim());
  return chunks;
};

const montarUrlsMp3 = (chunk) => {
  const encoded = encodeURIComponent(chunk);
  const urls = [];

  if (typeof window !== "undefined" && window.location?.origin) {
    urls.push(`${window.location.origin}/api/tts?q=${encoded}`);
  }

  urls.push(
    `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encoded}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=gtx&q=${encoded}`
  );

  return urls;
};

const tocarElementoAudio = (src) =>
  new Promise((resolve) => {
    const audio = new Audio(src);
    audio.volume = 1.0;
    audio.preload = "auto";

    let finalizado = false;
    const concluir = (ok) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(timeoutId);
      resolve(ok);
    };

    const timeoutId = setTimeout(() => concluir(false), 10000);

    audio.onended = () => concluir(true);
    audio.onerror = () => concluir(false);

    const playPromise = audio.play();
    if (playPromise?.then) {
      playPromise
        .then(() => dlog(`[TTS-MP3] Reproduzindo: ${String(src).slice(0, 72)}...`))
        .catch((e) => {
          derror(`[TTS-MP3] play() falhou: ${e?.message || e}`);
          concluir(false);
        });
    }
  });

const tocarUrlMp3 = async (url) => {
  const ehMesmaOrigem =
    typeof window !== "undefined" &&
    window.location?.origin &&
    url.startsWith(window.location.origin);

  if (ehMesmaOrigem) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        try {
          const ok = await tocarElementoAudio(blobUrl);
          if (ok) return true;
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }
    } catch (e) {
      dwarn(`[TTS-MP3] fetch blob falhou: ${e?.message || e}`);
    }
  }

  return tocarElementoAudio(url);
};

const tocarChunkComFallback = async (chunk, indice, total) => {
  const urls = montarUrlsMp3(chunk);
  for (let i = 0; i < urls.length; i++) {
    dlog(`[TTS-MP3] Chunk ${indice + 1}/${total}, tentativa ${i + 1}/${urls.length}`);
    const ok = await tocarUrlMp3(urls[i]);
    if (ok) {
      dlog(`[TTS-MP3] Chunk ${indice + 1} concluído`);
      return true;
    }
    dwarn(`[TTS-MP3] Chunk ${indice + 1} falhou na URL ${i + 1}`);
  }
  return false;
};

const falarViaAudioMP3 = async (texto) => {
  const chunks = quebrarEmChunks(texto);
  if (chunks.length === 0) return;

  let algumTocou = false;
  for (let i = 0; i < chunks.length; i++) {
    const ok = await tocarChunkComFallback(chunks[i], i, chunks.length);
    if (ok) algumTocou = true;
  }

  if (!algumTocou) {
    throw new Error("nenhum áudio MP3 foi reproduzido");
  }
};

const falarViaNativo = (texto) => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      reject(new Error("speechSynthesis indisponível"));
      return;
    }
    try { window.speechSynthesis.cancel(); } catch (_) {}

    const utt = new SpeechSynthesisUtterance(texto);
    utt.lang = "pt-BR"; 
    utt.rate = 0.85;    // ✅ Reduzido para melhor compatibilidade Samsung
    utt.pitch = 1.0; 
    utt.volume = 1.0;

    const voz = escolherVoz();
    if (voz) {
      utt.voice = voz;
      if (ttsStatus.vozSelecionada !== voz.name) {
        ttsStatus.vozSelecionada = `${voz.name} (${voz.lang})`;
        notificarTTS();
      }
    }

    let falouAlgo = false;
    let keepAliveId = null;
    let timeoutId = null;
    let inicioUtt = Date.now();

    const limparTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    utt.onstart = () => {
      falouAlgo = true;
      limparTimeout();
      dlog(`[TTS-Nativo] Iniciado com voz: ${voz?.name || "padrão"}`);
      keepAliveId = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
          dlog("[TTS-Nativo] Keep-alive acionado");
        } else {
          clearInterval(keepAliveId); 
          keepAliveId = null;
        }
      }, 8000);
    };
    
    utt.onend = () => {
      limparTimeout();
      if (keepAliveId) { clearInterval(keepAliveId); keepAliveId = null; }
      const duracao = Date.now() - inicioUtt;
      dlog(`[TTS-Nativo] Finalizado (${duracao}ms)`);
      resolve(falouAlgo);
    };
    
    utt.onerror = (evt) => {
      limparTimeout();
      if (keepAliveId) { clearInterval(keepAliveId); keepAliveId = null; }
      const duracao = Date.now() - inicioUtt;
      dlog(`[TTS-Nativo] Erro após ${duracao}ms: ${evt.error}`);
      if (evt.error === "interrupted" || evt.error === "canceled") resolve(falouAlgo);
      else reject(new Error(evt.error || "erro tts nativo"));
    };

    dlog(`[TTS-Nativo] Iniciando síntese...`);
    window.speechSynthesis.speak(utt);

    timeoutId = setTimeout(() => {
      if (!falouAlgo && !window.speechSynthesis.speaking) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
        if (keepAliveId) { clearInterval(keepAliveId); keepAliveId = null; }
        derror("[TTS-Nativo] Timeout: engine TTS não iniciou após 3s");
        reject(new Error("timeout: engine TTS não iniciou"));
      }
    }, 3000);
  });
};

const falarTextoUniversal = (() => {
  let estrategiaCacheada = null;
  return async (texto) => {
    if (!texto || typeof window === "undefined") return;

    dlog(`[TTS] Iniciando: "${texto.slice(0, 50)}..."`);

    const usarMP3 = async (motivo) => {
      try {
        dlog(`[TTS] Tentando MP3 (motivo: ${motivo})`);
        await falarViaAudioMP3(texto);
        estrategiaCacheada = "mp3";
        ttsStatus.estrategia = "mp3";
        ttsStatus.anunciosFeitos++;
        ttsStatus.ultimoAnuncioTs = new Date();
        ttsStatus.ultimoErro = null;
        notificarTTS();
        dlog("[TTS] ✅ Anunciou via MP3 (Google Translate)");
      } catch (e) {
        ttsStatus.ultimoErro = "MP3 falhou: " + (e?.message || e);
        notificarTTS();
        derror("[TTS] ❌ MP3 também falhou: " + (e?.message || e));
      }
    };

    // Se já sabe que MP3 funciona, usa direto
    if (estrategiaCacheada === "mp3") { 
      await usarMP3("usando estratégia em cache");
      return; 
    }

    // Se já sabe que nativo funciona, tenta nativo primeiro
    if (estrategiaCacheada === "nativo") {
      try {
        dlog(`[TTS] Tentando nativo (em cache)`);
        const ok = await falarViaNativo(texto);
        if (!ok) { 
          await usarMP3("nativo retornou sem falar"); 
        } else {
          ttsStatus.anunciosFeitos++;
          ttsStatus.ultimoAnuncioTs = new Date();
          ttsStatus.ultimoErro = null;
          notificarTTS();
          dlog("[TTS] ✅ Anunciou via nativo (cache)");
        }
        return;
      } catch (e) {
        await usarMP3("nativo lançou erro: " + (e?.message || e));
        return;
      }
    }

    // Primeira tentativa: detecta capacidades do device
    const ehTV = ehSmartTV();
    const temSpeech = !!window.speechSynthesis;
    const voices = temSpeech ? window.speechSynthesis.getVoices() : [];
    const temVozes = voices && voices.length > 0;
    
    dlog(`[TTS] Detecção: SmartTV=${ehTV}, SamsungTV=${isSamsungTV()}, speechSynthesis=${temSpeech}, vozes=${voices?.length || 0}`);

    // TVs não dependem de speechSynthesis — MP3 gerado no servidor/nuvem
    if (ehTV || (isSamsungTV() && !temVozes)) {
      dlog("[TTS] Smart TV — usando MP3 (não precisa de TTS nativo)");
      await usarMP3("Smart TV sem depender de speechSynthesis");
      return;
    }

    // Tenta nativo
    try {
      dlog(`[TTS] Tentando nativo...`);
      const ok = await falarViaNativo(texto);
      if (ok) {
        estrategiaCacheada = "nativo";
        ttsStatus.estrategia = "nativo";
        ttsStatus.anunciosFeitos++;
        ttsStatus.ultimoAnuncioTs = new Date();
        ttsStatus.ultimoErro = null;
        notificarTTS();
        dlog("[TTS] ✅ Estratégia decidida: NATIVO");
      } else {
        dlog("[TTS] Nativo retornou sem falar, caindo para MP3");
        await usarMP3("nativo retornou false");
      }
    } catch (e) {
      dwarn("[TTS] Nativo falhou, caindo para MP3: " + (e?.message || e));
      await usarMP3("nativo falhou: " + (e?.message || e));
    }
  };
})();

const anunciarChamada = (registro, nomePrincipal) => {
  const sala = registro.atendente_guiche || "atendimento";
  const texto = `Atenção! ${nomePrincipal}. Por favor, dirija-se à ${sala}.`;
  dlog(`[Anúncio] Anunciando: "${texto}"`);
  return falarTextoUniversal(texto);
};

const SOM_ATIVO_KEY = "painel_tv_som_desbloqueado";
const EXIBICAO_MINIMA_MS = 90 * 1000;

// ─────────────────────────────────────────────────────────────────
// PAINEL DE DIAGNÓSTICO
// ─────────────────────────────────────────────────────────────────

function DebugPanel({ online, somAtivo, selectedCrasId }) {
  const [, forceUpdate] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const cb = () => forceUpdate((n) => n + 1);
    debugListeners.add(cb);
    ttsStatusListeners.add(cb);
    const tick = setInterval(cb, 1000);
    return () => {
      debugListeners.delete(cb);
      ttsStatusListeners.delete(cb);
      clearInterval(tick);
    };
  }, []);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const uaResumido = ua.length > 80 ? ua.slice(0, 80) + "..." : ua;

  const corEstrategia =
    ttsStatus.estrategia === "nativo" ? "#10b981" :
    ttsStatus.estrategia === "mp3"    ? "#f59e0b" :
    "#6b7280";

  if (collapsed) {
    return (
      <div onClick={() => setCollapsed(false)}
        style={{
          position: "fixed", bottom: 8, left: 8, zIndex: 99999,
          background: "rgba(0,0,0,0.85)", color: "#fff",
          padding: "6px 12px", borderRadius: 6,
          fontSize: 12, cursor: "pointer", fontFamily: "monospace",
          border: `2px solid ${corEstrategia}`,
        }}>
        🐛 DEBUG ({ttsStatus.estrategia})
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 8, left: 8, zIndex: 99999,
      background: "rgba(0,0,0,0.92)", color: "#fff",
      padding: 12, borderRadius: 8, width: 460, maxWidth: "45vw",
      fontFamily: "monospace", fontSize: 11, lineHeight: 1.5,
      border: `2px solid ${corEstrategia}`,
      maxHeight: "60vh", overflowY: "auto",
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8, borderBottom: "1px solid #444", paddingBottom: 4
      }}>
        <strong style={{ fontSize: 13, color: corEstrategia }}>🐛 DIAGNÓSTICO</strong>
        <button onClick={() => setCollapsed(true)}
          style={{
            background: "transparent", color: "#fff",
            border: "1px solid #666", borderRadius: 4,
            padding: "2px 8px", cursor: "pointer", fontSize: 10
          }}>
          minimizar
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 4, marginBottom: 8 }}>
        <span style={{ color: "#888" }}>TTS:</span>
        <span style={{ color: corEstrategia, fontWeight: "bold" }}>
          {ttsStatus.estrategia.toUpperCase()}
          {ttsStatus.estrategia === "nativo" && " ✓"}
          {ttsStatus.estrategia === "mp3" && " (Google)"}
        </span>

        <span style={{ color: "#888" }}>Voz:</span>
        <span>{ttsStatus.vozSelecionada || "—"}</span>

        <span style={{ color: "#888" }}>Anúncios feitos:</span>
        <span>{ttsStatus.anunciosFeitos}</span>

        <span style={{ color: "#888" }}>Último anúncio:</span>
        <span>{ttsStatus.ultimoAnuncioTs ? ttsStatus.ultimoAnuncioTs.toLocaleTimeString("pt-BR") : "—"}</span>

        <span style={{ color: "#888" }}>Online:</span>
        <span style={{ color: online ? "#10b981" : "#ef4444" }}>{online ? "SIM" : "NÃO"}</span>

        <span style={{ color: "#888" }}>Som ativo:</span>
        <span style={{ color: somAtivo ? "#10b981" : "#ef4444" }}>{somAtivo ? "SIM" : "NÃO"}</span>

        <span style={{ color: "#888" }}>CRAS ID:</span>
        <span>{selectedCrasId || "—"}</span>

        <span style={{ color: "#888" }}>Resolução:</span>
        <span>{typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : "—"}</span>

        <span style={{ color: "#888" }}>User Agent:</span>
        <span style={{ wordBreak: "break-all", fontSize: 10 }}>{uaResumido}</span>

        {ttsStatus.ultimoErro && (
          <>
            <span style={{ color: "#888" }}>Último erro:</span>
            <span style={{ color: "#fbbf24", fontSize: 10 }}>{ttsStatus.ultimoErro}</span>
          </>
        )}
      </div>

      <div style={{ borderTop: "1px solid #444", paddingTop: 6 }}>
        <strong style={{ color: "#888", fontSize: 10 }}>LOGS RECENTES:</strong>
        <div style={{ maxHeight: 150, overflowY: "auto", marginTop: 4 }}>
          {DEBUG_LOGS.length === 0 ? (
            <div style={{ color: "#666", fontStyle: "italic" }}>Sem logs ainda...</div>
          ) : (
            [...DEBUG_LOGS].reverse().map((log, i) => (
              <div key={i} style={{
                color: log.nivel === "error" ? "#fca5a5" : log.nivel === "warn" ? "#fcd34d" : "#a7f3d0",
                fontSize: 10, marginBottom: 2,
              }}>
                <span style={{ color: "#666" }}>[{log.ts}]</span> {log.mensagem}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

function PainelTVPage({
  crasUnidades,
  tiposAtendimento,
  atendentesList,
  salasAtendimento,
}) {
  const { db, appId } = useAuth();
  const location = useLocation();

  const [selectedCrasId, setSelectedCrasId] = useState(null);
  const [chamando, setChamando] = useState(null);
  const [ultimosChamados, setUltimosChamados] = useState([]);
  const [error, setError] = useState(null);
  const [highlightKey, setHighlightKey] = useState(0);
  const [somAtivo, setSomAtivo] = useState(() => {
    try {
      if (ehSmartTV()) return false;
      return window.localStorage.getItem(SOM_ATIVO_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [anunciando, setAnunciando] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const tiposMap = useMemo(() => new Map((tiposAtendimento || []).map((t) => [t.id, t])), [tiposAtendimento]);
  const atendentesMap = useMemo(() => new Map((atendentesList || []).map((a) => [a.id, a])), [atendentesList]);
  const salasMap = useMemo(() => new Map((salasAtendimento || []).map((s) => [s.id, s])), [salasAtendimento]);

  const lastChamadoRef = useRef({ id: null, ts: null });
  const pendingTimeoutsRef = useRef(new Set());
  const somAtivoRef = useRef(somAtivo);
  const chamandoRawRef = useRef(null);
  const exibicaoDesdeRef = useRef(0);
  const montarChamadoRef = useRef(null);
  const tiposMapRef = useRef(tiposMap);
  const atendentesMapRef = useRef(atendentesMap);
  const salasMapRef = useRef(salasMap);

  useEffect(() => { tiposMapRef.current = tiposMap; }, [tiposMap]);
  useEffect(() => { atendentesMapRef.current = atendentesMap; }, [atendentesMap]);
  useEffect(() => { salasMapRef.current = salasMap; }, [salasMap]);

  useEffect(() => {
    if (!chamandoRawRef.current || !montarChamadoRef.current) return;
    setChamando(montarChamadoRef.current(chamandoRawRef.current));
  }, [tiposMap, atendentesMap, salasMap]);

  const cancelarAnunciosPendentes = () => {
    pendingTimeoutsRef.current.forEach(clearTimeout);
    pendingTimeoutsRef.current.clear();
    try { window.speechSynthesis?.cancel(); } catch (_) {}
  };

  useEffect(() => {
    somAtivoRef.current = somAtivo;
  }, [somAtivo]);

  useEffect(() => {
    lastChamadoRef.current = { id: null, ts: null };
    chamandoRawRef.current = null;
    exibicaoDesdeRef.current = 0;
    setChamando(null);
    cancelarAnunciosPendentes();
  }, [selectedCrasId]);

  // ── Ativa modo debug via ?debug=1 ────────────────────────────────
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("debug") === "1") {
        setDebugMode(true);
        dlog("[Debug] Modo diagnóstico ATIVADO");
        dlog("[Debug] UA: " + (navigator.userAgent || "desconhecido"));
      }
    } catch {}
  }, []);

  const unlockAudio = async () => {
    try {
      dlog("[Audio] Tentando desbloquear áudio...");
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor();
        await ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        setTimeout(() => { try { osc.stop(); } catch (_) {} }, 100);
        dlog("[Audio] AudioContext desbloqueado");
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        dlog("[Audio] SpeechSynthesis pronto");
      }
      try {
        const silentAudio = new Audio(
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        );
        silentAudio.volume = 0.01;
        await silentAudio.play();
        dlog("[Audio] Silent audio tocado");
      } catch (_) {}
      try {
        window.localStorage.setItem(SOM_ATIVO_KEY, "1");
      } catch (_) {}
      setSomAtivo(true);
      setAutoplayBlocked(false);
      dlog("[Audio] ✅ Som desbloqueado com sucesso");
    } catch (e) {
      derror("[Audio] Falha ao desbloquear: " + (e?.message || e));
    }
  };

  useEffect(() => {
    if (somAtivo) return;
    const handle = () => unlockAudio();
    window.addEventListener("click", handle);
    window.addEventListener("touchstart", handle);
    window.addEventListener("pointerdown", handle);
    window.addEventListener("keydown", handle);
    return () => {
      window.removeEventListener("click", handle);
      window.removeEventListener("touchstart", handle);
      window.removeEventListener("pointerdown", handle);
      window.removeEventListener("keydown", handle);
    };
  }, [somAtivo]);

  useEffect(() => {
    const on = () => { setOnline(true); dlog("[Network] Online"); };
    const off = () => { setOnline(false); dwarn("[Network] Offline"); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let lastTick = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastTick > 5 * 60 * 1000) {
        dwarn("[Watchdog] JS travou, recarregando...");
        window.location.reload();
      }
      lastTick = now;
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const isNomeValido = (str) =>
    !!str && String(str).trim() !== "-" && String(str).trim() !== "." && String(str).trim().length > 1;

  const getNomeExibicao = (registro) => {
    if (!registro) return "Nome não informado";
    if (isNomeValido(registro.nome_chamada_final)) {
      return normalizeName(String(registro.nome_chamada_final));
    }
    const cid = registro.cidadao || {};
    const isValido = isNomeValido;
    const social = isValido(cid.nomeSocial) ? cid.nomeSocial : "";
    const nome = isValido(cid.nome) ? cid.nome : "";
    const exibicao = isValido(registro.nome_exibicao) ? registro.nome_exibicao : "";
    const nomeBruto = social || nome || exibicao || "";
    if (!nomeBruto) return "Nome não informado";
    return normalizeName(String(nomeBruto));
  };

  const collectionPath = `artifacts/${appId}/public/data/atendimentos`;

  useEffect(() => {
    if (!Array.isArray(crasUnidades) || crasUnidades.length === 0) return;

    const findByUnidade = (raw) => {
      const alvo = simplify(String(raw || "").trim());
      if (!alvo) return null;
      const exato = crasUnidades.find((c) => simplify(c?.nome) === alvo);
      if (exato) return exato;
      const parcial = crasUnidades.find((c) => simplify(c?.nome).includes(alvo) || alvo.includes(simplify(c?.nome)));
      return parcial || null;
    };

    try {
      const params = new URLSearchParams(window.location.search);
      const crasFromUrl = params.get("cras_id");
      if (crasFromUrl && crasUnidades.some((c) => c?.id === crasFromUrl)) {
        setSelectedCrasId(crasFromUrl);
        return;
      }
      const unidadeFromUrl = params.get("unidade");
      const match = findByUnidade(unidadeFromUrl);
      if (match?.id) {
        setSelectedCrasId(match.id);
        return;
      }
    } catch {}

    try {
      const stored = window.localStorage.getItem("painel_tv_last_cras_id");
      if (stored && crasUnidades.some((c) => c?.id === stored)) {
        setSelectedCrasId(stored);
        return;
      }
    } catch {}

    if (crasUnidades.length === 1 && crasUnidades[0]?.id) {
      setSelectedCrasId(crasUnidades[0].id);
    }
  }, [crasUnidades, location.search]);

  useEffect(() => {
    if (!selectedCrasId) return;
    try {
      window.localStorage.setItem("painel_tv_last_cras_id", selectedCrasId);
    } catch {}
  }, [selectedCrasId]);

  useEffect(() => {
    let lastReloadDate = new Date().toDateString();
    const check = setInterval(() => {
      const now = new Date();
      const today = now.toDateString();
      if (today !== lastReloadDate && now.getHours() === 0 && now.getMinutes() < 5) {
        lastReloadDate = today;
        window.location.reload();
      }
    }, 60000);
    return () => clearInterval(check);
  }, []);

  useEffect(() => {
    if (!db || !selectedCrasId) return;

    const mapDoc = (docSnap) => {
      const data = docSnap.data() || {};
      const cid = data.cidadao ? { ...data.cidadao } : {};
      const nomeExiste =
        (cid.nome && String(cid.nome).trim() !== "") ||
        (cid.nomeSocial && String(cid.nomeSocial).trim() !== "");
      if (!nomeExiste && data.nome_exibicao) cid.nome = data.nome_exibicao;
      const nomeParaChamada = data.nome_chamada || data.senha || "";
      return { id: docSnap.id, ...data, cidadao: cid, nome_chamada_final: nomeParaChamada };
    };

    const getMillis = (ts) => {
      if (!ts) return 0;
      if (typeof ts.toMillis === "function") return ts.toMillis();
      if (ts instanceof Date) return ts.getTime();
      if (typeof ts === "number") return ts;
      return 0;
    };

    const deveIgnorarChamada = (registro) => {
      if (!registro || registro.status === "cancelado") return true;
      const tipo = tiposMapRef.current.get(registro.tipo_atendimento_id);
      return (tipo?.nome || "").toLowerCase().includes("abordagem social");
    };

    const montarChamadoExibicao = (registro) => {
      const tipo = tiposMapRef.current.get(registro.tipo_atendimento_id);
      const atendenteId = registro.atendente_id;
      const atendente =
        atendentesMapRef.current.get(atendenteId) ||
        (atendenteId
          ? Array.from(atendentesMapRef.current.values()).find(
              (a) => a?.uid === atendenteId || a?.id === atendenteId
            )
          : null);
      let localAtendimento = registro.atendente_guiche;
      if (!localAtendimento) {
        localAtendimento = atendente?.guiche || "Sala de atendimento";
        if (atendente?.sala_atual_id) {
          const sala = salasMapRef.current.get(atendente.sala_atual_id);
          if (sala?.nome) localAtendimento = sala.nome;
        }
      }
      return {
        ...registro,
        tipo_nome: tipo?.nome || "Atendimento",
        tipo_cor: tipo?.cor || "#333",
        atendente_nome: atendente?.nome || "Atendente",
        atendente_guiche: localAtendimento,
      };
    };
    montarChamadoRef.current = montarChamadoExibicao;

    const dispararAnuncio = (novoChamado, localAtendimento) => {
      if (!somAtivoRef.current) {
        dlog("[Chamada] Som inativo — exibindo na tela sem narração");
        return;
      }

      const nomePrincipal = getNomeExibicao(novoChamado);
      dlog(`[Chamada] ${nomePrincipal} → ${localAtendimento}`);

      const tocar = async () => {
        try {
          playBeep();
          const tid = setTimeout(async () => {
            pendingTimeoutsRef.current.delete(tid);
            setAnunciando(true);
            try {
              await anunciarChamada(novoChamado, nomePrincipal);
            } finally {
              setAnunciando(false);
            }
          }, 300);
          pendingTimeoutsRef.current.add(tid);
        } catch (e) {
          dwarn("[Audio] Autoplay bloqueado: " + (e?.message || e));
          setAutoplayBlocked(true);
        }
      };
      tocar();
    };

    const chamadoAtualIdRef = { current: null };

    const processarChamadaAtiva = (snapshot) => {
      const candidatos = snapshot.docs
        .map(mapDoc)
        .filter((d) => !deveIgnorarChamada(d));

      const chamandoAgora = candidatos.sort(
        (a, b) =>
          getMillis(b.hora_chamada) - getMillis(a.hora_chamada) ||
          getMillis(b.hora_chegada) - getMillis(a.hora_chegada)
      )[0];

      if (!chamandoAgora) {
        chamadoAtualIdRef.current = null;
        const tempoNaTela = Date.now() - exibicaoDesdeRef.current;
        if (!chamandoRawRef.current || tempoNaTela >= EXIBICAO_MINIMA_MS) {
          chamandoRawRef.current = null;
          setChamando(null);
        }
        return;
      }

      chamandoRawRef.current = chamandoAgora;
      const novoChamado = montarChamadoExibicao(chamandoAgora);
      const novoTs = getMillis(novoChamado.hora_chamada) || null;
      const isNovoId = lastChamadoRef.current.id !== novoChamado.id;
      const isRechamar =
        !isNovoId &&
        novoTs &&
        lastChamadoRef.current.ts &&
        novoTs !== lastChamadoRef.current.ts;

      if (isNovoId || isRechamar) {
        lastChamadoRef.current = {
          id: novoChamado.id,
          ts: novoTs ?? lastChamadoRef.current.ts,
        };
        exibicaoDesdeRef.current = Date.now();
        cancelarAnunciosPendentes();
        dispararAnuncio(novoChamado, novoChamado.atendente_guiche);
      } else if (!lastChamadoRef.current.ts && novoTs) {
        lastChamadoRef.current.ts = novoTs;
      }

      exibicaoDesdeRef.current = Date.now();
      setChamando((prev) => {
        if (prev?.id !== novoChamado.id) setHighlightKey((k) => k + 1);
        return novoChamado;
      });
      chamadoAtualIdRef.current = novoChamado.id;
    };

    const processarHistorico = (snapshot) => {
      setError(null);
      const docs = snapshot.docs.map(mapDoc);
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const docsHoje = docs.filter((d) => {
        if (d.status === "cancelado") return false;
        if (deveIgnorarChamada(d)) return false;
        const hc = d.hora_chamada;
        if (!hc || !hc.toDate) return d.status === "chamando";
        return hc.toDate() >= now;
      });

      const historico = docsHoje
        .filter((d) => d.id !== chamadoAtualIdRef.current)
        .sort((a, b) => getMillis(b.hora_chamada) - getMillis(a.hora_chamada))
        .slice(0, 5)
        .map((it) => {
          const exibicao = montarChamadoExibicao(it);
          return {
            ...it,
            tipo_nome: exibicao.tipo_nome,
            atendente_guiche: exibicao.atendente_guiche,
          };
        });
      setUltimosChamados(historico);
    };

    const qChamando = query(
      collection(db, collectionPath),
      where("cras_id", "==", selectedCrasId),
      where("status", "==", "chamando"),
      limit(5)
    );

    const qHistorico = query(
      collection(db, collectionPath),
      where("cras_id", "==", selectedCrasId),
      orderBy("hora_chamada", "desc"),
      limit(20)
    );

    let unsubscribeHistoricoFallback = null;

    const unsubscribeChamando = onSnapshot(
      qChamando,
      processarChamadaAtiva,
      (err) => {
        derror("[Firestore] Erro no listener de chamada ativa: " + (err?.message || err));
        setError(getFriendlyFirebaseError(err, "Erro ao atualizar chamada no painel."));
      }
    );

    const unsubscribeHistorico = onSnapshot(qHistorico, processarHistorico, (err) => {
      if (err.code === "failed-precondition" || err.message?.includes("index")) {
        dwarn("[Firestore] Sem índice no histórico, usando fallback");
        const qFallback = query(
          collection(db, collectionPath),
          where("cras_id", "==", selectedCrasId),
          limit(200)
        );
        unsubscribeHistoricoFallback = onSnapshot(qFallback, processarHistorico, (errFb) => {
          derror("[Firestore] Fallback do histórico falhou: " + (errFb?.message || errFb));
          setError(getFriendlyFirebaseError(errFb, "Erro no modo de compatibilidade."));
        });
      } else {
        derror("[Firestore] Erro no histórico: " + (err?.message || err));
        setError(getFriendlyFirebaseError(err, "Erro ao atualizar histórico do painel."));
      }
    });

    return () => {
      unsubscribeChamando();
      unsubscribeHistorico();
      if (unsubscribeHistoricoFallback) unsubscribeHistoricoFallback();
      pendingTimeoutsRef.current.forEach(clearTimeout);
      pendingTimeoutsRef.current.clear();
      try { window.speechSynthesis?.cancel(); } catch (_) {}
    };
  }, [db, selectedCrasId, collectionPath]);

  const testarTTS = () => {
    dlog("[Debug] Teste manual de TTS disparado");
    falarTextoUniversal("Atenção! Maria da Silva. Por favor, dirija-se ao guichê três.");
  };

  const formatTime = (ts) => {
    if (!ts || !ts.toDate) return "--:--";
    return ts.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const getCpfFinalTexto = (cidadao) => {
    if (!cidadao?.cpf) return "";
    const numeros = String(cidadao.cpf).replace(/\D/g, "");
    if (numeros.length < 3) return "";
    return `Final CPF: ${numeros.slice(-3)}`;
  };

  const getNomeFontSize = (registro) => {
    const nome = getNomeExibicao(registro);
    const len = nome.length;
    if (len <= 18) return "clamp(3rem, 7.5vw, 8rem)";
    if (len <= 26) return "clamp(2.8rem, 6.5vw, 7rem)";
    if (len <= 34) return "clamp(2.5rem, 5.5vw, 6rem)";
    if (len <= 44) return "clamp(2.2rem, 4.5vw, 5rem)";
    return "clamp(2rem, 3.8vw, 4.5rem)";
  };

  const ehNomeSocial = (registro) => {
    if (!registro?.cidadao?.nomeSocial) return false;
    const chamado = normalizeName(String(registro.nome_chamada_final || ""));
    const social = normalizeName(String(registro.cidadao.nomeSocial || ""));
    return chamado === social;
  };

  if (!selectedCrasId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-blue-800 mb-4 text-center">Configuração do Painel TV</h1>
        <p className="text-gray-600 mb-8 text-center max-w-xl">Selecione abaixo a unidade que este painel deve exibir.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
          {crasUnidades.map((cras) => (
            <button key={cras.id} type="button" onClick={() => setSelectedCrasId(cras.id)}
              className="bg-white p-6 rounded-xl shadow hover:shadow-lg hover:scale-[1.02] transition-all text-left">
              <h2 className="text-xl font-semibold text-blue-700">{cras.nome}</h2>
            </button>
          ))}
        </div>
        {debugMode && <DebugPanel online={online} somAtivo={somAtivo} selectedCrasId={null} />}
      </div>
    );
  }

  const crasAtual = crasUnidades.find((c) => c.id === selectedCrasId);

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-100 text-gray-800 overflow-hidden font-sans relative">

      {!online && (
        <div className="absolute top-0 left-0 w-full bg-orange-600 text-white text-center py-2 z-[10000] font-bold uppercase tracking-wide">
          ⚠️ Sem conexão com a internet — tentando reconectar...
        </div>
      )}

      {!somAtivo && ehSmartTV() && (
        <div
          className="fixed inset-0 z-[99998] bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={unlockAudio}
          onKeyDown={unlockAudio}
          role="button"
          tabIndex={0}
        >
          <div className="text-center text-white px-8 max-w-3xl">
            <div className="text-[clamp(4rem,12vw,8rem)] mb-6">🔊</div>
            <h2 className="text-[clamp(1.8rem,5vw,3.5rem)] font-black mb-4">Ativar Som do Painel</h2>
            <p className="text-[clamp(1.1rem,3vw,1.8rem)] opacity-90 mb-8 leading-relaxed">
              A televisão não possui narração nativa. Pressione <strong>OK</strong> no controle remoto ou toque na tela para liberar o áudio das chamadas.
            </p>
            <div className="inline-block bg-red-600 hover:bg-red-500 px-10 py-5 rounded-2xl font-bold text-[clamp(1.2rem,3vw,2rem)] uppercase tracking-wide animate-pulse shadow-2xl">
              Ativar Som Agora
            </div>
          </div>
        </div>
      )}

      {(autoplayBlocked || !somAtivo) && !ehSmartTV() && (
        <div
          className={`absolute ${!online ? "top-10" : "top-0"} left-0 w-full bg-red-600 text-white text-center py-4 z-[9999] cursor-pointer animate-pulse shadow-lg font-bold text-xl uppercase tracking-wide`}
          onClick={unlockAudio}
        >
          🔇 Clique aqui (ou pressione qualquer tecla do controle) para ativar o som
        </div>
      )}

      <header className="h-[12vh] w-full px-8 shadow-lg flex items-center justify-between z-10 relative shrink-0"
        style={{ backgroundColor: COR_PRINCIPAL }}>
        <div className="text-white font-bold truncate flex flex-col justify-center">
          <span className="text-[2vh] opacity-80 font-medium tracking-wide">PREFEITURA DE SÃO LUÍS</span>
          <span className="text-[4vh] leading-none">SEMCAS - {crasAtual?.nome || "Unidade"}</span>
        </div>
        <div className="flex items-center gap-6">
          {debugMode && (
            <button type="button" onClick={testarTTS}
              className="px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-bold transition-colors shadow-sm">
              🧪 Testar TTS
            </button>
          )}
          {!somAtivo && (
            <button type="button" onClick={unlockAudio}
              className="px-6 py-3 rounded-xl bg-white bg-opacity-10 hover:bg-opacity-20 text-white text-lg font-semibold border border-white/40 transition-colors shadow-sm uppercase tracking-wide">
              Ativar Som
            </button>
          )}
          <div className="transform scale-125 origin-right">
            <Relogio />
          </div>
        </div>
      </header>

      <style>{`
        @keyframes flashZoom {
          0%   { transform: scale(1);    opacity: 0.8; }
          20%  { transform: scale(1.05); opacity: 1;   }
          100% { transform: scale(1);    opacity: 1;   }
        }
        .highlight { animation: flashZoom 1.2s ease-in-out infinite alternate; }
        @keyframes pulse-audio {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }
        .pulse-audio { animation: pulse-audio 0.8s ease-in-out infinite; }
      `}</style>

      {anunciando && (
        <div className="absolute bottom-6 right-6 bg-green-500 text-white px-5 py-3 rounded-full shadow-2xl font-bold text-lg z-50 pulse-audio flex items-center gap-2">
          🔊 Anunciando...
        </div>
      )}

      <div className="flex-1 p-6 h-[88vh] flex gap-6 min-h-0">

        <div className="flex-[3] bg-white rounded-3xl shadow-2xl flex flex-col justify-between items-center p-8 text-center border-l-[16px] border-blue-600 relative min-h-0">

          <div className="w-full flex justify-center mt-4">
            <div className="bg-gray-100 text-gray-500 px-8 py-2 rounded-full font-bold tracking-[0.2em] text-[clamp(1rem,2.5vh,1.5rem)] uppercase shadow-inner">
              Chamando Agora
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center w-full px-4 py-8 min-h-0">
            <div key={highlightKey}
              className={`font-black leading-tight w-full break-words ${chamando ? "text-blue-700 highlight" : "text-gray-300"}`}
              style={{
                fontSize: chamando ? getNomeFontSize(chamando) : "clamp(3rem, 7.5vw, 8rem)",
                textShadow: chamando ? "0px 4px 12px rgba(0,0,0,0.1)" : "none",
              }}>
              {chamando ? getNomeExibicao(chamando) : "AGUARDANDO..."}
            </div>

            {chamando && ehNomeSocial(chamando) && (
              <div className="mt-3 text-[clamp(0.8rem,1.8vh,1.1rem)] font-bold text-blue-500 bg-blue-50 border border-blue-200 px-4 py-1.5 rounded-full">
                Nome Social
              </div>
            )}

            {chamando && getCpfFinalTexto(chamando.cidadao) && (
              <div className="mt-6 bg-yellow-100 text-yellow-800 px-8 py-3 rounded-full font-bold text-[clamp(1rem,2.6vh,1.6rem)] shadow-sm border border-yellow-200 break-words">
                {getCpfFinalTexto(chamando.cidadao)}
              </div>
            )}
          </div>

          <div className="w-full h-px bg-gray-200 my-6" />

          <div className="grid grid-cols-2 w-full gap-8 mb-4 shrink-0">
            <div className="flex flex-col items-center justify-start p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="text-gray-400 font-bold uppercase tracking-widest mb-2 text-[clamp(0.9rem,2vh,1.2rem)]">Atendente</div>
              <div className="font-bold text-gray-800 text-[clamp(1.5rem,3.5vh,2.5rem)] leading-tight break-words w-full">
                {chamando ? chamando.atendente_nome || "---" : "---"}
              </div>
            </div>
            <div className="flex flex-col items-center justify-start p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="text-blue-400 font-bold uppercase tracking-widest mb-2 text-[clamp(0.9rem,2vh,1.2rem)]">Local de Atendimento</div>
              <div className="font-bold text-blue-700 text-[clamp(1.8rem,4vh,2.8rem)] leading-tight break-words w-full">
                {chamando ? chamando.atendente_guiche || "---" : "---"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-[2] flex flex-col gap-6 h-full overflow-hidden">

          <div className="bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center justify-center shrink-0 min-h-[25vh]">
            <img src={SaoLuisLogo} alt="Logo" className="w-auto h-auto max-h-[15vh] object-contain mb-4" />
            <h2 className="text-blue-900 font-bold text-center text-[clamp(1rem,2.5vh,1.5rem)] uppercase tracking-wide">
              Atendimento Integrado
            </h2>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 flex-grow flex flex-col overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-500"></div>
            <h3 className="font-bold text-gray-700 pb-4 mb-2 flex items-center text-[clamp(1rem,2.5vh,1.5rem)] border-b border-gray-100">
              <div className="w-4 h-4 rounded-full bg-green-500 mr-3 shadow-sm animate-pulse" />
              Últimas Chamadas
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {ultimosChamados.length > 0 ? (
                ultimosChamados.map((it, idx) => (
                  <div key={it.id || idx} className="flex flex-col bg-gray-50 p-4 rounded-xl border-l-4 border-gray-300 hover:bg-gray-100 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-gray-800 text-[clamp(1rem,2.2vh,1.4rem)] leading-tight line-clamp-2">
                        {getNomeExibicao(it)}
                      </span>
                      <span className="text-gray-400 text-[clamp(0.8rem,1.8vh,1.1rem)] font-medium whitespace-nowrap ml-2 bg-white px-2 py-0.5 rounded border border-gray-200">
                        {it.hora_chamada ? formatTime(it.hora_chamada) : "--:--"}
                      </span>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <div className="flex flex-col">
                        {getCpfFinalTexto(it.cidadao) && (
                          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                            {getCpfFinalTexto(it.cidadao)}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-blue-600 text-[clamp(0.9rem,2vh,1.3rem)] bg-blue-50 px-3 py-1 rounded-lg">
                        {it.atendente_guiche}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 flex-col gap-2 opacity-60">
                  <span className="text-4xl">📭</span>
                  <span className="text-lg font-medium">Histórico vazio</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="absolute bottom-8 left-8 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center animate-bounce z-50">
          <span className="mr-3 font-bold text-2xl">⚠️</span>
          <span className="text-lg font-medium">{error}</span>
        </div>
      )}

      {debugMode && <DebugPanel online={online} somAtivo={somAtivo} selectedCrasId={selectedCrasId} />}
    </div>
  );
}

export default PainelTVPage;

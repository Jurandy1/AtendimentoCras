/**
 * Índice e resolução de nomes de atendentes para relatórios.
 * Atendimentos históricos podem guardar atendente_id como:
 * - id do documento em /atendentes
 * - uid do Auth
 * - id "fantasma" antigo (duplicata removida na deduplicação)
 */

export function buildAtendenteLookup(atendentesList = []) {
  const byKey = new Map();

  const register = (key, atendente) => {
    const k = String(key || "").trim();
    if (!k || !atendente) return;
    const current = byKey.get(k);
    if (!current) {
      byKey.set(k, atendente);
      return;
    }
    // Preferir o registro canônico (id === uid) quando houver conflito
    const preferNew =
      String(atendente.id || "") === String(atendente.uid || "") &&
      String(current.id || "") !== String(current.uid || "");
    if (preferNew) byKey.set(k, atendente);
  };

  for (const a of atendentesList || []) {
    if (!a) continue;
    register(a.id, a);
    register(a.uid, a);
    if (Array.isArray(a.aliasIds)) {
      for (const alias of a.aliasIds) register(alias, a);
    }
  }

  return byKey;
}

export function getAtendenteFromLookup(lookup, id) {
  if (!lookup || !id) return null;
  return lookup.get(String(id).trim()) || null;
}

/** Extrai nome gravado em eventos do atendimento (fonte confiável histórica). */
export function nomeFromEventos(item, atendenteId) {
  const eventos = Array.isArray(item?.eventos) ? item.eventos : [];
  const id = String(atendenteId || item?.atendente_id || "").trim();
  for (let i = eventos.length - 1; i >= 0; i--) {
    const ev = eventos[i];
    const nome = String(ev?.atendente_nome || "").trim();
    if (!nome) continue;
    if (!id || !ev?.atendente_id || String(ev.atendente_id) === id) return nome;
  }
  return "";
}

/**
 * Monta mapa id -> nome a partir dos próprios atendimentos do período
 * (eventos e campos eventualmente gravados no documento).
 */
export function buildNomeHintsFromReportData(reportData = []) {
  const hints = new Map();
  for (const item of reportData || []) {
    const id = String(item?.atendente_id || "").trim();
    if (!id) continue;
    if (hints.has(id)) continue;
    const fromEvento = nomeFromEventos(item, id);
    const fromCampo = String(item?.atendente_nome || "").trim();
    const nome = fromEvento || fromCampo;
    if (nome) hints.set(id, nome);
  }
  return hints;
}

export function resolveAtendenteNome(lookup, id, options = {}) {
  const {
    hints = null,
    item = null,
    fallback = "Não informado",
    showUnresolvedId = false,
  } = options;

  const key = String(id || "").trim();
  if (!key) return fallback;

  const atendente = getAtendenteFromLookup(lookup, key);
  if (atendente?.nome) return String(atendente.nome).trim();

  if (hints?.get?.(key)) return hints.get(key);

  if (item) {
    const fromEvento = nomeFromEventos(item, key);
    if (fromEvento) return fromEvento;
    const fromCampo = String(item?.atendente_nome || "").trim();
    if (fromCampo) return fromCampo;
  }

  if (showUnresolvedId) return `Cadastro não encontrado (${key.slice(0, 8)}…)`;
  return fallback;
}

/** Chave canônica para unificar produtividade do mesmo servidor. */
export function canonicalAtendenteKey(lookup, id) {
  const key = String(id || "").trim();
  if (!key) return "";
  const a = getAtendenteFromLookup(lookup, key);
  if (!a) return key;
  const uid = String(a.uid || "").trim();
  const docId = String(a.id || "").trim();
  if (uid) return uid;
  if (docId) return docId;
  return key;
}

export function resolveAtendenteMeta(lookup, id, options = {}) {
  const a = getAtendenteFromLookup(lookup, id);
  return {
    id: String(id || "").trim(),
    canonicalId: canonicalAtendenteKey(lookup, id),
    nome: resolveAtendenteNome(lookup, id, options),
    cargo: String(a?.cargo || a?.role || "").trim(),
    email: String(a?.email || "").trim(),
    crasId: String(a?.cras_id || a?.crasId || "").trim(),
    encontrado: !!a,
  };
}

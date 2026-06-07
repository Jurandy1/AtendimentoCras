import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import Button from '../../ui/Button';

const RemanejarModal = ({
  isOpen,
  onClose,
  onConfirm,
  atendimento,
  tiposAtendimento,
  atendentesList
}) => {
  const [selectedTipo, setSelectedTipo] = useState("");
  const [selectedAtendenteId, setSelectedAtendenteId] = useState("");

  if (!isOpen || !atendimento) return null;

  const simplify = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const cargoDisplay = (at) => {
    const cargo = simplify(at?.cargo);
    const role = simplify(at?.role);
    if (cargo.includes("psic") || role.includes("psic")) return "Psicólogo(a)";
    if (cargo.includes("cad") || cargo.includes("unico") || role.includes("cad")) return "CadÚnico";
    if (cargo.includes("coord") || role.includes("coord")) return "Coordenador(a)";
    return at?.cargo || "Servidor";
  };

  const statusOk = (at) => {
    const s = simplify(at?.status);
    return s === "online";
  };

  const atendentesAtivos = useMemo(() => {
    const list = Array.isArray(atendentesList) ? atendentesList : [];
    const crasId = atendimento?.cras_id || "";
    return list.filter((at) => {
      if (!statusOk(at)) return false;
      if (crasId) return at?.cras_id === crasId;
      return true;
    });
  }, [atendentesList, atendimento]);

  const getAtendentesParaTipo = (tipoId, tipoNomeRaw) => {
    const explicit = atendentesAtivos.filter((at) => {
      const tipos = Array.isArray(at?.tipos_atende) ? at.tipos_atende : [];
      return tipos.includes(tipoId);
    });
    if (explicit.length > 0) return explicit;

    const tipoNome = simplify(tipoNomeRaw);
    const isPsi = tipoNome.includes("psic");
    const isCad = tipoNome.includes("cad") || tipoNome.includes("unico");
    const isCoord = tipoNome.includes("coorden");

    if (!isPsi && !isCad && !isCoord) return [];

    return atendentesAtivos.filter((at) => {
      const cargo = simplify(at?.cargo);
      const role = simplify(at?.role);
      if (isPsi) return cargo.includes("psic") || role.includes("psic");
      if (isCad) return cargo.includes("cad") || cargo.includes("unico") || role.includes("cad");
      if (isCoord) return cargo.includes("coord") || role.includes("coord");
      return false;
    });
  };

  const atendentesDoTipo = useMemo(() => {
    if (!selectedTipo) return [];
    const tipo = (Array.isArray(tiposAtendimento) ? tiposAtendimento : []).find((t) => t?.id === selectedTipo);
    return getAtendentesParaTipo(selectedTipo, tipo?.nome)
      .sort((a, b) => String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR"));
  }, [selectedTipo, tiposAtendimento, atendentesAtivos]);

  const tiposComDisponibilidade = useMemo(() => {
    const tipos = Array.isArray(tiposAtendimento) ? tiposAtendimento : [];

    const isServicosDia = (nome) => {
      const n = simplify(nome);
      return (n.includes("servi") && n.includes("dia")) || n.includes("servicos do dia") || n.includes("serviços do dia");
    };

    return tipos
      .filter((t) => t?.id && !isServicosDia(t?.nome))
      .map((t) => {
        const atendentes = getAtendentesParaTipo(t.id, t?.nome).sort((a, b) =>
          String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR")
        );
        const nomes = atendentes
          .map((at) => String(at?.nome || "").trim())
          .filter(Boolean);
        const preview = nomes.slice(0, 3);
        return {
          ...t,
          disponiveis: atendentes.length,
          isAtual: t.id === atendimento.tipo_atendimento_id,
          atendentesPreview: preview,
          atendentesTotal: atendentes.length,
          atendentesTitle: nomes.join(", "),
        };
      })
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  }, [tiposAtendimento, atendimento, atendentesAtivos]);

  const handleConfirm = () => {
    if (selectedTipo) {
      if (selectedAtendenteId && !atendentesDoTipo.some((a) => a?.id === selectedAtendenteId)) {
        alert("O servidor selecionado não está disponível para este tipo. Selecione novamente.");
        return;
      }
      onConfirm(atendimento, selectedTipo, selectedAtendenteId || null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-white w-full max-w-md rounded-lg shadow-2xl overflow-hidden">
        <div className="bg-blue-600 px-4 py-3 flex justify-between items-center text-white">
          <h3 className="font-bold flex items-center gap-2">
            <ArrowRightLeft size={20} />
            Remanejar Atendimento
          </h3>
          <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Selecione o novo tipo de atendimento para <strong>{atendimento.cidadao?.nome || "Cidadão"}</strong>:
          </p>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {tiposComDisponibilidade.map((tipo) => (
              <label 
                key={tipo.id} 
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedTipo === tipo.id 
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="tipoRemanejo" 
                  value={tipo.id}
                  checked={selectedTipo === tipo.id}
                  onChange={(e) => {
                    setSelectedTipo(e.target.value);
                    setSelectedAtendenteId("");
                  }}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  disabled={tipo.isAtual || tipo.disponiveis === 0}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm font-medium ${tipo.disponiveis === 0 ? "text-gray-400" : "text-gray-700"}`}>
                      {tipo.nome}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${
                      tipo.isAtual
                        ? "bg-gray-100 text-gray-700 border-gray-200"
                        : tipo.disponiveis === 0
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-green-50 text-green-700 border-green-200"
                    }`}>
                      {tipo.isAtual ? "atual" : `${tipo.disponiveis} disponíveis`}
                    </span>
                  </div>
                  {!tipo.isAtual && (
                    <div
                      className={`mt-1 text-[11px] leading-tight ${tipo.disponiveis === 0 ? "text-gray-400" : "text-gray-600"}`}
                      title={tipo.atendentesTitle || ""}
                    >
                      {tipo.disponiveis === 0
                        ? "Nenhum servidor disponível"
                        : `Servidores: ${tipo.atendentesPreview.join(", ")}${tipo.atendentesTotal > tipo.atendentesPreview.length ? ` +${tipo.atendentesTotal - tipo.atendentesPreview.length}` : ""}`}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          {selectedTipo && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Direcionar para servidor específico (opcional)
              </p>
              {atendentesDoTipo.length === 0 ? (
                <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded p-3">
                  Não existe servidor disponível para este tipo de atendimento.
                </div>
              ) : (
                <select
                  value={selectedAtendenteId}
                  onChange={(e) => setSelectedAtendenteId(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                >
                  <option value="">Qualquer servidor disponível</option>
                  {atendentesDoTipo.map((at) => (
                    <option key={at.id} value={at.id}>
                      {at.nome} - {cargoDisplay(at)} ({at.status})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="ghost" onClick={onClose} aria-label="Cancelar remanejo">Cancelar</Button>
            <Button 
              variant="primary" 
              onClick={handleConfirm}
              disabled={!selectedTipo || (selectedTipo && atendentesDoTipo.length === 0)}
              aria-label="Confirmar alteração de tipo de atendimento"
              title={!selectedTipo ? "Selecione um tipo" : atendentesDoTipo.length === 0 ? "Nenhum servidor disponível para este tipo" : "Aplicar remanejo"}
            >
              Confirmar Remanejo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemanejarModal;

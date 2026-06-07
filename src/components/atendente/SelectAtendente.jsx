import React from 'react';

const SelectAtendente = ({ 
  atendentesList, 
  setSelectedAtendente, 
  crasUnidades, 
  getStatusInfo,
  currentUserCrasId,
  isSuperAdmin
}) => {
  const formatCargo = (cargo) => {
    if (!cargo) return "❌ Cargo não definido";
    return cargo.replace(/Coordenadora/g, "Coordenador").replace(/coordenadora/g, "coordenador");
  };

  if (!atendentesList || atendentesList.length === 0) {
    return (
      <div className="p-6 bg-white rounded-lg shadow flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
        <p className="text-gray-600">Carregando perfil de atendente...</p>
        <p className="text-xs text-gray-500 text-center">
          Se demorar, verifique sua conexão. Se seu perfil não aparecer, solicite ao administrador que cadastre você em &quot;Atendentes&quot;.
        </p>
      </div>
    );
  }

  const listaFiltrada = React.useMemo(() => {
    const list = Array.isArray(atendentesList) ? atendentesList : [];
    if (isSuperAdmin) return list;
    const crasId = currentUserCrasId || null;
    if (!crasId) return list;
    return list.filter((a) => String(a?.cras_id || "") === String(crasId));
  }, [atendentesList, currentUserCrasId, isSuperAdmin]);

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Selecione o atendente
      </h2>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
        Não encontra seu nome? Seu perfil pode não estar cadastrado. Peça ao administrador que adicione você em Administração → Atendentes.
      </p>
      <div className="space-y-3">
        {listaFiltrada.map((at) => (
          <button
            key={at.id}
            type="button"
            onClick={() => {
              // Garantir que o atendente tenha os campos necessários
              const atendenteCompleto = {
                ...at,
                id: at.id || at.uid || "", // Garantir que tenha ID
                cras_id: at.cras_id || at.crasId || "", // Garantir que tenha cras_id
                cargo: at.cargo || "Cargo não definido",
                nome: at.nome || "Nome não definido"
              };
              setSelectedAtendente(atendenteCompleto);
            }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <div className="flex flex-col text-left">
              <div className="font-semibold text-gray-800">{at.nome}</div>
              <div className="text-xs text-gray-500">
                {crasUnidades.find((c) => c.id === (at.cras_id || at.crasId))?.nome || ((at.cras_id || at.crasId) ? "Unidade" : "❌ Unidade não definida")}
              </div>
              <div className="text-xs text-gray-500">
                {formatCargo(at.cargo)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {(() => {
                const info = getStatusInfo(at);
                return (
              <div
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  info.classes
                }`}
              >
                {info.label}
              </div>
                );
              })()}
              <div className="text-xs text-gray-600">
                {at.guiche ? `Guichê ${at.guiche}` : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SelectAtendente;

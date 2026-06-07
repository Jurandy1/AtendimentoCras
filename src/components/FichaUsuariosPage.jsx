import React, { useEffect, useRef, useState } from 'react';
import { 
  Search, 
  Calendar, 
  Clock, 
  User, 
  ChevronRight, 
  FileText
} from 'lucide-react';
import { fixFirebaseStorageUrl } from '../utils';
import { useFichaUsuarios } from '../hooks/useFichaUsuarios';
import Card from './ui/Card';
import FichaDetalhesPage from './FichaDetalhesPage';

const FichaUsuariosPage = () => {
  const { 
    usuarios, 
    loading, 
    loadingMore,
    searchTerm, 
    setSearchTerm, 
    hasMore,
    carregarMais,
    carregarDetalhesUsuario,
    carregarFichaEconomica,
    invalidateFichaCache
  } = useFichaUsuarios();

  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [detalhesLoading, setDetalhesLoading] = useState(false);
  const [historicoUsuario, setHistoricoUsuario] = useState([]);
  const selectedCpfRef = useRef(null);
  const [modoEconomico, setModoEconomico] = useState(() => {
    try {
      const v = window.localStorage.getItem("fichaUsuarios:modoEconomico");
      return v !== "0";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("fichaUsuarios:modoEconomico", modoEconomico ? "1" : "0");
    } catch {}
  }, [modoEconomico]);

  const handleVerFicha = async (usuario) => {
    const cpf = usuario?.cpf || null;
    selectedCpfRef.current = cpf;
    setUsuarioSelecionado(usuario);
    setDetalhesLoading(true);
    const [extra, historico] = await Promise.all([
      carregarFichaEconomica(usuario.cpf),
      modoEconomico ? null : carregarDetalhesUsuario(usuario.cpf, { maxDocs: 200 })
    ]);
    let merged = { ...usuario };
    if (extra) {
      merged = { ...merged, ...extra };
      const foto = extra.dadosCidadao?.fotoUrl || extra.dadosCidadao?.foto;
      if (foto && !merged.fotoUrl) merged.fotoUrl = foto;
    }
    if (selectedCpfRef.current !== cpf) return;
    setUsuarioSelecionado(merged);
    setHistoricoUsuario(historico || []);
    setDetalhesLoading(false);
  };

  const handleVoltar = () => {
    selectedCpfRef.current = null;
    setUsuarioSelecionado(null);
    setHistoricoUsuario([]);
  };

  if (usuarioSelecionado) {
    return (
      <FichaDetalhesPage 
        usuario={usuarioSelecionado} 
        historico={historicoUsuario} 
        loading={detalhesLoading}
        onVoltar={handleVoltar}
        modoEconomico={modoEconomico}
        onUsuarioAtualizado={(atualizado) => {
          setUsuarioSelecionado(atualizado);
          invalidateFichaCache?.(atualizado?.cpf);
        }}
        onCarregarHistorico={async () => {
          setDetalhesLoading(true);
          const historico = await carregarDetalhesUsuario(usuarioSelecionado.cpf, { maxDocs: 500 });
          setHistoricoUsuario(historico);
          setDetalhesLoading(false);
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
            <FileText className="text-blue-600" />
            Minhas Fichas de Acompanhamento
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Gerencie o histórico dos usuários atendidos por você.
          </p>
        </div>
      </div>

      {/* Busca e Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome do usuário..." 
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setModoEconomico((v) => !v)}
          className={`flex items-center gap-2 px-4 py-3 border rounded-lg font-bold uppercase text-xs tracking-wider transition-colors ${
            modoEconomico
              ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
          title="Modo econômico reduz leituras do Firebase na ficha"
        >
          {modoEconomico ? "Modo Econômico: ON" : "Modo Econômico: OFF"}
        </button>
      </div>

      {/* Grid de Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-600">Nenhum usuário encontrado</h3>
          <p className="text-sm text-gray-400">Realize atendimentos para popular sua lista.</p>
        </div>
      ) : (
        <>
        <p className="text-sm text-gray-500 font-medium">
          Exibindo {usuarios.length} usuário(s)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {usuarios.map((user) => (
            <div 
              key={user.cpf} 
              className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
              onClick={() => handleVerFicha(user)}
            >
              <div className="p-6 flex items-start gap-4">
                <div className="relative shrink-0">
                  {(user.fotoUrl || user.dadosCidadao?.fotoUrl) ? (
                    <img 
                      src={fixFirebaseStorageUrl(user.fotoUrl || user.dadosCidadao?.fotoUrl)} 
                      alt={user.nome} 
                      className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome || 'U')}&background=0D8ABC&color=fff&size=64`;
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xl font-bold shadow-sm group-hover:scale-105 transition-transform">
                      {user.nome?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  {user.totalAtendimentos > 1 && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-100 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-blue-200">
                      {user.totalAtendimentos}x
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-gray-800 uppercase tracking-tight truncate group-hover:text-blue-700 transition-colors">
                    {user.nome}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium truncate mb-2">CPF: {user.cpf}</p>
                  
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded w-fit">
                    <Calendar size={12} />
                    Último: {user.ultimoAtendimento?.toDate ? user.ultimoAtendimento.toDate().toLocaleDateString('pt-BR') : '---'}
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-2">
                    <Clock size={12} />
                    Total atendimentos: {typeof user.totalAtendimentos === "number" ? user.totalAtendimentos : 0}
                  </div>
                </div>
              </div>

              <div className="mt-auto border-t border-gray-50 p-3 bg-gray-50/50 flex justify-between items-center group-hover:bg-blue-50/30 transition-colors">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest pl-2">
                  Ver Ficha Completa
                </span>
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 group-hover:text-blue-600 group-hover:border-blue-200 transition-all">
                  <ChevronRight size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {hasMore && (
          <div className="flex justify-center pt-6">
            <button
              type="button"
              onClick={carregarMais}
              disabled={loadingMore}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loadingMore ? 'Carregando...' : 'Carregar mais'}
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default FichaUsuariosPage;

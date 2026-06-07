import React, { useMemo, useCallback, useState } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  Pencil
} from 'lucide-react';
import FichaEdicaoModal from './FichaEdicaoModal';
import Card from './ui/Card';
import { fixFirebaseStorageUrl, normalizeRole } from '../utils';
import { useAuth } from '../contexts/AuthContext';

// Funções de formatação movidas para fora do componente
const formatDate = (timestamp) => {
  if (!timestamp) return '---';
  try {
    // Se for objeto Firestore
    if (timestamp?.toDate) {
       return timestamp.toDate().toLocaleDateString('pt-BR');
    }
    
    // Se for string
    if (typeof timestamp === 'string') {
        // Tenta formato ISO YYYY-MM-DD
        if (timestamp.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return new Date(timestamp + 'T12:00:00').toLocaleDateString('pt-BR');
        }
        // Tenta formato PT-BR DD/MM/YYYY
        if (timestamp.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            return timestamp; // Já está formatado
        }
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '---';
    
    return date.toLocaleDateString('pt-BR');
  } catch (e) {
    return '---';
  }
};

const formatTime = (timestamp) => {
  if (!timestamp) return '---';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '---';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '---';
  }
};

const FichaDetalhesPage = ({ usuario, historico, loading, onVoltar, modoEconomico, onCarregarHistorico, onUsuarioAtualizado }) => {
  const { userProfile } = useAuth();
  const roleNorm = userProfile?.roleNorm || normalizeRole(userProfile?.role || userProfile?.cargo);
  const podeEditarFicha = ["psicologo", "assistente_social", "admin", "coordenador", "superintendente", "master", "super_admin"].includes(roleNorm);
  
  // Organizar histórico por data (mais recente primeiro)
  const historicoOrdenado = useMemo(() => {
    return [...historico].sort((a, b) => {
      const dateA = a.hora_fim?.toMillis ? a.hora_fim.toMillis() : 0;
      const dateB = b.hora_fim?.toMillis ? b.hora_fim.toMillis() : 0;
      return dateB - dateA;
    });
  }, [historico]);

  // Consolidar dados completos do usuário (merge entre dadosCidadao e último RMA/Cidadão histórico)
  const dadosCompletos = useMemo(() => {
    // Começa com os dados cadastrais básicos
    let dados = { ...(usuario.dadosCidadao || {}) };
    
    if (usuario.tipoAcompanhamento) {
        dados.tipoAcompanhamento = usuario.tipoAcompanhamento;
    }
    if (!dados.tipoAcompanhamento) {
        for (const at of historicoOrdenado) {
            if (at.tipo_acompanhamento) {
                dados.tipoAcompanhamento = at.tipo_acompanhamento;
                break;
            }
        }
    }
    
    // Procura no histórico o registro mais recente que tenha dados preenchidos de cada campo
    // Isso garante que se o último atendimento não preencheu "Estudando", mas o penúltimo sim, a gente mostra.
    
    // Lista de campos que queremos "herdar" do histórico se estiverem vazios
    const camposComplementares = [
        // Dados Pessoais/Sociais
        'nomeSocial', 'rg', 'nis', 'tituloEleitor', 'tituloEleitorZona', 'tituloEleitorSecao',
        'sexo', 'cor', 'nacionalidade', 'naturalidade', 'uf',
        'nomeMae', 'nomePai', 'conjuge',
        'escolaridade', 'religiao', 'orientacaoSexual',
        'telefone', 'tecnicoResponsavel',
        // Dados Complementares
        'origemDemanda', 'origemDemandaEspecificar',
        'estudando', 'estudandoDescricao', 
        'tratamentoSaude', 'tratamentoSaudeDescricao',
        'presoOuDetido', 'processoJustica',
        'refFamiliarNome', 'refFamiliarTelefone', 'refFamiliarEndereco', 'refFamiliarCep',
        'habilidadesProfissionais', 'interesseCurso', 'interesseCursoQual',
        // RMA
        'b1_drogas_ilicitas', 'b2_migrante', 'b3_doenca_mental'
    ];

    // Percorre do mais recente para o mais antigo
    for (const at of historicoOrdenado) {
        // Verifica no objeto cidadao do atendimento (onde DadosComplementares salva)
        if (at.cidadao) {
            camposComplementares.forEach(campo => {
                // Se ainda não temos esse dado e ele existe neste atendimento histórico, pega ele
                if (!dados[campo] && at.cidadao[campo]) {
                    dados[campo] = at.cidadao[campo];
                }
            });
        }
        
        // Mantém compatibilidade caso algum dia tenha sido salvo em rma
        if (at.rma) {
            camposComplementares.forEach(campo => {
                if (!dados[campo] && at.rma[campo]) {
                    dados[campo] = at.rma[campo];
                }
            });
        }
    }
    
    return dados;
  }, [usuario, historicoOrdenado]);

  const [pdfBusy, setPdfBusy] = useState(false);

  const gerarDocPDF = useCallback(async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    const d = dadosCompletos;
    const nome = usuario.nome || 'Cidadao';

    doc.setFontSize(16);
    doc.text('Ficha Técnica do Usuário - Centro Pop', 14, 18);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 26);

    doc.setFontSize(12);
    doc.text(nome.toUpperCase(), 14, 36);
    doc.setFontSize(10);
    doc.text(`CPF: ${usuario.cpf || '---'}`, 14, 43);

    const dadosPessoais = [
      ['Nome Social', d.nomeSocial || '---'],
      ['Data Nascimento', formatDate(d.dataNascimento)],
      ['RG', d.rg || '---'],
      ['NIS', d.nis || '---'],
      ['Sexo', d.sexo || '---'],
      ['Cor/Raça', d.cor || '---'],
      ['Orient. Sexual', d.orientacaoSexual || '---'],
      ['Escolaridade', d.escolaridade || '---'],
      ['Religião', d.religiao || '---'],
      ['Nacionalidade', d.nacionalidade || '---'],
      ['Naturalidade/UF', `${d.naturalidade || '---'} / ${d.uf || '---'}`],
      ['Mãe', d.nomeMae || '---'],
      ['Pai', d.nomePai || '---'],
      ['Cônjuge', d.conjuge || '---'],
      ['Telefone', d.telefone || '---'],
      ['Téc. Responsável', d.tecnicoResponsavel || '---'],
    ];

    autoTable(doc, {
      head: [['Campo', 'Valor']],
      body: dadosPessoais,
      startY: 50,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [19, 81, 180] },
      theme: 'striped',
    });

    let yPos = doc.lastAutoTable.finalY + 10;

    const dadosCompl = [
      ['Origem Demanda', `${d.origemDemanda || '---'}${d.origemDemandaEspecificar ? ` (${d.origemDemandaEspecificar})` : ''}`],
      ['Estudando', d.estudando === 'sim' ? `Sim - ${d.estudandoDescricao || ''}` : 'Não'],
      ['Interesse em Curso', d.interesseCurso === 'sim' ? `Sim - ${d.interesseCursoQual || ''}` : 'Não'],
      ['Habilidades Prof.', d.habilidadesProfissionais || '---'],
      ['Tratamento Saúde', d.tratamentoSaude === 'sim' ? `Sim - ${d.tratamentoSaudeDescricao || ''}` : 'Não'],
      ['Já foi Preso', d.presoOuDetido === 'sim' ? 'Sim' : 'Não'],
      ['Processo Justiça', d.processoJustica === 'sim' ? 'Sim' : 'Não'],
    ];

    if (yPos + 40 > doc.internal.pageSize.height) doc.addPage();

    autoTable(doc, {
      head: [['Dados Complementares', 'Valor']],
      body: dadosCompl,
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 139, 34] },
      theme: 'striped',
    });

    yPos = doc.lastAutoTable.finalY + 10;

    const refFam = [
      ['Nome', d.refFamiliarNome || '---'],
      ['Telefone', d.refFamiliarTelefone || '---'],
      ['CEP', d.refFamiliarCep || '---'],
      ['Endereço', d.refFamiliarEndereco || '---'],
    ];

    if (yPos + 30 > doc.internal.pageSize.height) doc.addPage();

    autoTable(doc, {
      head: [['Referência Familiar', 'Valor']],
      body: refFam,
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [128, 90, 213] },
      theme: 'striped',
    });

    if (historicoOrdenado.length > 0) {
      yPos = doc.lastAutoTable.finalY + 10;
      if (yPos + 20 > doc.internal.pageSize.height) doc.addPage();

      const histRows = historicoOrdenado.slice(0, 30).map(at => [
        formatDate(at.hora_fim),
        at.tipo_nome || 'Atendimento',
        at.atendente_guiche || '---',
        (at.observacoes || '').substring(0, 80) + ((at.observacoes || '').length > 80 ? '...' : ''),
      ]);

      autoTable(doc, {
        head: [['Data', 'Tipo', 'Sala', 'Evolução']],
        body: histRows,
        startY: yPos,
        styles: { fontSize: 7, cellWidth: 'wrap' },
        headStyles: { fillColor: [19, 81, 180] },
        columnStyles: { 3: { cellWidth: 80 } },
        theme: 'striped',
      });
    }

    return doc;
  }, [dadosCompletos, usuario, historicoOrdenado]);

  const exportarFichaPDF = useCallback(async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const doc = await gerarDocPDF();
      const nome = usuario.nome || "Cidadao";
      doc.save(`ficha_${nome.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setPdfBusy(false);
    }
  }, [gerarDocPDF, usuario, pdfBusy]);

  const [edicaoAberta, setEdicaoAberta] = useState(false);

  const previewFichaPDF = useCallback(async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const doc = await gerarDocPDF();
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setPdfBusy(false);
    }
  }, [gerarDocPDF, pdfBusy]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-500">
      
      {/* Header com Botão Voltar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onVoltar}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-600"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
              Ficha Técnica do Usuário
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              {modoEconomico ? "Modo econômico: ficha carregada com baixa leitura." : "Histórico completo de atendimentos realizados."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {podeEditarFicha && (
            <button
              type="button"
              onClick={() => setEdicaoAberta(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors"
              title="Editar dados da ficha (quando esqueceu de acrescentar algo)"
            >
              <Pencil size={14} />
              Editar Ficha
            </button>
          )}
          {modoEconomico && typeof onCarregarHistorico === "function" && historicoOrdenado.length === 0 && (
            <button
              type="button"
              onClick={onCarregarHistorico}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-black uppercase text-[10px] tracking-widest disabled:opacity-60"
              title="Carrega histórico completo (consome mais leituras do Firebase)"
            >
              Carregar Histórico
            </button>
          )}
          <button
            type="button"
            onClick={previewFichaPDF}
            disabled={pdfBusy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="Visualizar PDF antes de baixar"
          >
            <Eye size={14} />
            {pdfBusy ? "Carregando..." : "Preview"}
          </button>
          <button
            type="button"
            onClick={exportarFichaPDF}
            disabled={pdfBusy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            title="Exportar ficha completa em PDF"
          >
            <Download size={14} />
            {pdfBusy ? "Gerando..." : "Exportar PDF"}
          </button>
        </div>
      </div>

      {/* Perfil do Usuário */}
      <Card className="border-l-4 border-blue-600">
        <div className="p-6 flex flex-col md:flex-row gap-8 items-center md:items-start">
          <div className="shrink-0">
            {(usuario.fotoUrl || usuario.dadosCidadao?.fotoUrl) ? (
              <img 
                src={fixFirebaseStorageUrl(usuario.fotoUrl || usuario.dadosCidadao?.fotoUrl)} 
                alt={usuario.nome} 
                className="w-32 h-32 rounded-full object-cover border-4 border-blue-100 shadow-lg"
                onError={(e) => {
                  e.target.onerror = null; 
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.nome || 'U')}&background=0D8ABC&color=fff&size=128`;
                }}
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-4xl font-bold shadow-lg border-4 border-blue-50">
                {usuario.nome?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          
          <div className="flex-1 space-y-4 w-full text-center md:text-left">
            <div>
              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">{usuario.nome}</h2>
              <p className="text-sm font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded w-fit mx-auto md:mx-0 mt-1">
                CPF: {usuario.cpf}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
              <div className="text-center md:text-left">
                <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Atendimentos</span>
                <span className="text-lg font-bold text-gray-700">{historicoOrdenado.length}</span>
              </div>
              <div className="text-center md:text-left">
                <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Recente</span>
                <span className={`text-sm font-bold uppercase ${
                    dadosCompletos.tipoAcompanhamento === 'novo' ? 'text-purple-600' : 
                    dadosCompletos.tipoAcompanhamento === 'acompanhamento' ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {dadosCompletos.tipoAcompanhamento === 'novo' ? 'Usuário Novo' : 
                   dadosCompletos.tipoAcompanhamento === 'acompanhamento' ? 'Acompanhamento' : '---'}
                </span>
              </div>
              <div className="text-center md:text-left">
                <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Primeiro Contato</span>
                <span className="text-sm font-bold text-gray-700">
                  {historicoOrdenado.length > 0 ? formatDate(historicoOrdenado[historicoOrdenado.length - 1].hora_fim) : '---'}
                </span>
              </div>
              <div className="text-center md:text-left">
                <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Último Contato</span>
                <span className="text-sm font-bold text-gray-700">
                  {historicoOrdenado.length > 0
                    ? formatDate(historicoOrdenado[0].hora_fim)
                    : (usuario?.ultimoAtendimentoResumo?.horaFimISO ? formatDate(usuario.ultimoAtendimentoResumo.horaFimISO) : '---')}
                </span>
              </div>
            </div>
            
            {/* --- IDENTIFICAÇÃO (Nome Social, RG, Mãe, Pai, Naturalidade, etc.) --- */}
            {(dadosCompletos.nomeSocial || dadosCompletos.rg || dadosCompletos.nomeMae || dadosCompletos.nomePai || dadosCompletos.naturalidade || dadosCompletos.nacionalidade) && (
              <div className="pt-6 mt-4 border-t border-gray-100">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <User size={14} className="text-blue-500" /> Identificação
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
                  {dadosCompletos.nomeSocial && (
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nome Social</span>
                      <span className="text-sm font-bold text-gray-700">{dadosCompletos.nomeSocial}</span>
                    </div>
                  )}
                  {dadosCompletos.rg && (
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">RG</span>
                      <span className="text-sm font-bold text-gray-700">{dadosCompletos.rg}</span>
                    </div>
                  )}
                  {dadosCompletos.nomeMae && (
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nome da Mãe</span>
                      <span className="text-sm font-bold text-gray-700">{dadosCompletos.nomeMae}</span>
                    </div>
                  )}
                  {dadosCompletos.nomePai && (
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nome do Pai</span>
                      <span className="text-sm font-bold text-gray-700">{dadosCompletos.nomePai}</span>
                    </div>
                  )}
                  {dadosCompletos.naturalidade && (
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Naturalidade</span>
                      <span className="text-sm font-bold text-gray-700">{dadosCompletos.naturalidade}{dadosCompletos.uf ? ` / ${dadosCompletos.uf}` : ''}</span>
                    </div>
                  )}
                  {dadosCompletos.nacionalidade && (
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nacionalidade</span>
                      <span className="text-sm font-bold text-gray-700">{dadosCompletos.nacionalidade}</span>
                    </div>
                  )}
                  {dadosCompletos.tecnicoResponsavel && (
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Téc. Responsável</span>
                      <span className="text-sm font-bold text-gray-700">{dadosCompletos.tecnicoResponsavel}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- HEADER: DADOS COMPLEMENTARES DO USUÁRIO --- */}
            <div className="pt-6 mt-4 border-t border-gray-100">
               <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <User size={14} className="text-blue-500" /> Dados Complementares do Usuário
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
                 {/* Bloco 1 */}
                 <div className="space-y-3">
                    <div>
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Título Eleitor</span>
                       <span className="text-sm font-bold text-gray-700">
                          {dadosCompletos.tituloEleitor || '---'}
                          {(dadosCompletos.tituloEleitorZona || dadosCompletos.tituloEleitorSecao) && (
                             <span className="block text-xs font-normal text-gray-500">
                                Zona: {dadosCompletos.tituloEleitorZona || '--'} / Seção: {dadosCompletos.tituloEleitorSecao || '--'}
                             </span>
                          )}
                       </span>
                    </div>
                    <div>
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Sexo / Cor</span>
                       <span className="text-sm font-bold text-gray-700">
                          {dadosCompletos.sexo || '---'} / {dadosCompletos.cor || '---'}
                       </span>
                    </div>
                    <div>
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Data Nasc.</span>
                       <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <Calendar size={14} className="text-blue-400" />
                          {formatDate(dadosCompletos.dataNascimento)}
                       </span>
                    </div>
                 </div>

                 {/* Bloco 2 */}
                 <div className="space-y-3">
                    <div>
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">NIS</span>
                       <span className="text-sm font-bold text-gray-700">{dadosCompletos.nis || '---'}</span>
                    </div>
                    <div>
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Escolaridade</span>
                       <span className="text-sm font-bold text-gray-700">{dadosCompletos.escolaridade || '---'}</span>
                    </div>
                    <div>
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Religião</span>
                       <span className="text-sm font-bold text-gray-700">{dadosCompletos.religiao || '---'}</span>
                    </div>
                 </div>

                 {/* Bloco 3 */}
                 <div className="space-y-3">
                    <div>
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Orient. Sexual</span>
                       <span className="text-sm font-bold text-gray-700">{dadosCompletos.orientacaoSexual || '---'}</span>
                    </div>
                    <div>
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Telefone</span>
                       <span className="text-sm font-bold text-gray-700">{dadosCompletos.telefone || '---'}</span>
                    </div>
                    <div>
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cônjuge</span>
                       <span className="text-sm font-bold text-gray-700">{dadosCompletos.conjuge || '---'}</span>
                    </div>
                 </div>

                 {/* Bloco 4 */}
                 <div className="space-y-3">
                    <div>
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Origem da Demanda</span>
                       <span className="text-sm font-bold text-gray-700">
                          {dadosCompletos.origemDemanda || '---'}
                          {dadosCompletos.origemDemandaEspecificar && (
                            <span className="block text-xs font-normal text-gray-600 mt-0.5">({dadosCompletos.origemDemandaEspecificar})</span>
                          )}
                       </span>
                    </div>
                 </div>
               </div>
            </div>

            {/* --- HEADER: EDUCAÇÃO E TRABALHO --- */}
            <div className="pt-6 mt-4 border-t border-gray-100 bg-blue-50/30 p-4 rounded-lg">
                 <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileText size={14} /> Educação e Trabalho
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                       <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Está Estudando?</span>
                       <span className="text-sm font-bold text-gray-800">
                          {dadosCompletos.estudando === 'sim' ? (
                             <span className="text-blue-600">Sim - {dadosCompletos.estudandoDescricao}</span>
                          ) : 'Não / Não Informado'}
                       </span>
                    </div>
                    <div>
                       <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Interesse em Curso?</span>
                       <span className="text-sm font-bold text-gray-800">
                          {dadosCompletos.interesseCurso === 'sim' ? (
                             <span className="text-green-700">Sim - {dadosCompletos.interesseCursoQual}</span>
                          ) : 'Não'}
                       </span>
                    </div>
                    <div>
                       <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Habilidades Profissionais</span>
                       <span className="text-sm font-bold text-gray-800 bg-white border border-gray-200 px-2 py-1 rounded inline-block">
                          {dadosCompletos.habilidadesProfissionais || '---'}
                       </span>
                    </div>
                 </div>
            </div>

            {/* --- HEADER: SAÚDE E JUSTIÇA --- */}
            <div className="pt-6 mt-4 border-t border-gray-100 bg-red-50/30 p-4 rounded-lg">
                 <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Activity size={14} /> Saúde e Justiça
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                       <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tratamento Saúde?</span>
                       <span className="text-sm font-bold text-gray-800">
                          {dadosCompletos.tratamentoSaude === 'sim' ? (
                             <span className="text-red-600">Sim - {dadosCompletos.tratamentoSaudeDescricao}</span>
                          ) : 'Não / Não Informado'}
                       </span>
                    </div>
                    <div>
                       <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Já foi Preso/Detido?</span>
                       <span className={dadosCompletos.presoOuDetido === 'sim' ? 'text-sm font-bold text-red-600' : 'text-sm font-bold text-gray-600'}>
                          {dadosCompletos.presoOuDetido === 'sim' ? 'Sim' : 'Não'}
                       </span>
                    </div>
                    <div>
                       <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Processo na Justiça?</span>
                       <span className={dadosCompletos.processoJustica === 'sim' ? 'text-sm font-bold text-red-600' : 'text-sm font-bold text-gray-600'}>
                          {dadosCompletos.processoJustica === 'sim' ? 'Sim' : 'Não'}
                       </span>
                    </div>
                 </div>
            </div>

            {/* --- RMA DADOS SENSÍVEIS (se houver) --- */}
            {(dadosCompletos.b1_drogas_ilicitas || dadosCompletos.b2_migrante || dadosCompletos.b3_doenca_mental) && (
              <div className="pt-6 mt-4 border-t border-gray-100 bg-amber-50/50 p-4 rounded-lg">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity size={14} /> RMA - Dados Sensíveis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  {dadosCompletos.b1_drogas_ilicitas && (
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">B1 Drogas Ilícitas</span>
                      <span className="text-sm font-bold text-gray-700">{dadosCompletos.b1_drogas_ilicitas}</span>
                    </div>
                  )}
                  {dadosCompletos.b2_migrante && (
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">B2 Migrante</span>
                      <span className="text-sm font-bold text-gray-700">{dadosCompletos.b2_migrante}</span>
                    </div>
                  )}
                  {dadosCompletos.b3_doenca_mental && (
                    <div>
                      <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">B3 Doença Mental</span>
                      <span className="text-sm font-bold text-gray-700">{dadosCompletos.b3_doenca_mental}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- HEADER: REFERÊNCIA FAMILIAR --- */}
            <div className="pt-6 mt-4 border-t border-gray-100 bg-gray-50 p-4 rounded-lg">
               <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <User size={14} /> Referência Familiar
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome da Referência</span>
                    <strong className="text-sm text-gray-900">{dadosCompletos.refFamiliarNome || '---'}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Telefone Referência</span>
                    <strong className="text-sm text-gray-900">{dadosCompletos.refFamiliarTelefone || '---'}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">CEP</span>
                    <strong className="text-sm text-gray-900">{dadosCompletos.refFamiliarCep || '---'}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Endereço Completo</span>
                    <strong className="text-sm text-gray-900">{dadosCompletos.refFamiliarEndereco || '---'}</strong>
                  </div>
               </div>
            </div>


             {/* DADOS DA RECEPÇÃO (NOVO BLOCO) */}
             {historicoOrdenado.length > 0 && (
               <div className="pt-6 mt-4 border-t border-gray-100 bg-purple-50/50 p-4 rounded-lg">
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <User size={14} /> Dados da Recepção (Triagem)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                     {historicoOrdenado[0].prioridade && (
                        <div>
                           <span className="block font-bold text-gray-400 uppercase mb-1">Prioridade</span>
                           <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">{historicoOrdenado[0].prioridade}</span>
                        </div>
                     )}
                     {historicoOrdenado[0].encaminhamento && (
                        <div className="md:col-span-2">
                           <span className="block font-bold text-gray-400 uppercase mb-1">Encaminhado Por</span>
                           <span className="font-bold text-gray-800">{historicoOrdenado[0].encaminhamento}</span>
                        </div>
                     )}
                     {historicoOrdenado[0].observacoes_iniciais && (
                        <div className="md:col-span-3">
                           <span className="block font-bold text-gray-400 uppercase mb-1">Observações da Recepção</span>
                           <p className="text-gray-700 italic bg-white p-2 rounded border border-purple-100">
                              "{historicoOrdenado[0].observacoes_iniciais}"
                           </p>
                        </div>
                     )}
                  </div>
               </div>
             )}
           </div>
         </div>
      </Card>

      {/* Linha do Tempo */}
      <div className="space-y-6">
        <h3 className="text-lg font-black text-gray-700 uppercase tracking-widest border-b border-gray-200 pb-2 flex items-center gap-2">
          <Activity size={20} className="text-blue-600" />
          Linha do Tempo
        </h3>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : historicoOrdenado.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Nenhum histórico encontrado.</div>
        ) : (
          <div className="relative border-l-2 border-blue-200 ml-4 md:ml-6 space-y-8 pb-8">
            {historicoOrdenado.map((atendimento, idx) => (
              <div key={atendimento.id} className="relative pl-8 md:pl-10">
                {/* Bolinha da Timeline */}
                <div className="absolute -left-[9px] top-0 w-5 h-5 rounded-full bg-blue-600 border-4 border-white shadow-sm z-10"></div>
                
                <Card className="group hover:shadow-md transition-all duration-300 border-l-4 border-l-blue-500">
                  <div className="p-5 space-y-4">
                    {/* Cabeçalho do Card */}
                    <div className="flex flex-wrap justify-between items-start gap-2 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">
                            {formatDate(atendimento.hora_fim)}
                          </span>
                          <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                            <Clock size={12} /> {formatTime(atendimento.hora_fim)}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-gray-800 flex items-center gap-2">
                          {atendimento.tipo_nome || 'Atendimento Social'}
                          {atendimento.tipo_acompanhamento && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              atendimento.tipo_acompanhamento === 'novo' 
                                ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                : 'bg-green-50 text-green-700 border-green-200'
                            }`}>
                              {atendimento.tipo_acompanhamento === 'novo' ? 'USUÁRIO NOVO' : 'ACOMPANHAMENTO'}
                            </span>
                          )}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        <MapPin size={12} />
                        {atendimento.atendente_guiche || 'Sala Indefinida'}
                      </div>
                    </div>

                    {/* Conteúdo: Evolução */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <FileText size={12} /> Evolução Técnica
                      </h5>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {atendimento.observacoes || <span className="italic text-gray-400">Sem observações registradas.</span>}
                      </p>
                    </div>

                    {/* Dados Complementares (Se houver RMA salvo neste atendimento) */}
                    {atendimento.rma && Object.keys(atendimento.rma).length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {atendimento.rma.estudando === 'sim' && (
                           <div className="flex items-center gap-2 text-xs text-gray-600 bg-blue-50/50 p-2 rounded">
                              <CheckCircle2 size={14} className="text-blue-500" />
                              Estudando: <strong>{atendimento.rma.estudandoDescricao}</strong>
                           </div>
                        )}
                        {atendimento.rma.tratamentoSaude === 'sim' && (
                           <div className="flex items-center gap-2 text-xs text-gray-600 bg-red-50/50 p-2 rounded">
                              <AlertCircle size={14} className="text-red-500" />
                              Saúde: <strong>{atendimento.rma.tratamentoSaudeDescricao}</strong>
                           </div>
                        )}
                        {/* Adicionar mais campos conforme necessário */}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {edicaoAberta && podeEditarFicha && (
        <FichaEdicaoModal
          usuario={usuario}
          dadosCompletos={dadosCompletos}
          onSave={(atualizado) => {
            onUsuarioAtualizado?.(atualizado);
            setEdicaoAberta(false);
          }}
          onClose={() => setEdicaoAberta(false)}
        />
      )}
    </div>
  );
};

export default FichaDetalhesPage;

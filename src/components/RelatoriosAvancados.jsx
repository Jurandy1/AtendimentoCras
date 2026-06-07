import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshCw, UserCheck, Clock, Users, Building, AlertTriangle,
  TrendingUp, Download, ChevronDown, ChevronUp, BarChart2, Eye
} from 'lucide-react';
import Card from './ui/Card';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const RelatoriosAvancados = ({ reportData, crasUnidades, atendentesList, tiposAtendimento }) => {
  const [subTab, setSubTab] = useState('retorno');
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (key) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const atendenteById = useMemo(() => {
    const m = new Map();
    (atendentesList || []).forEach((a) => { if (a?.id) m.set(a.id, a); });
    return m;
  }, [atendentesList]);

  const crasById = useMemo(() => {
    const m = new Map();
    (crasUnidades || []).forEach((c) => { if (c?.id) m.set(c.id, c); });
    return m;
  }, [crasUnidades]);

  const tipoById = useMemo(() => {
    const m = new Map();
    (tiposAtendimento || []).forEach((t) => { if (t?.id) m.set(t.id, t); });
    return m;
  }, [tiposAtendimento]);

  const getAtendenteNome = useCallback((id) => atendenteById.get(id)?.nome || id || 'N/A', [atendenteById]);
  const getCrasNome = useCallback((id) => crasById.get(id)?.nome || 'N/A', [crasById]);
  const getTipoNome = useCallback((id) => tipoById.get(id)?.nome || 'N/A', [tipoById]);

  // ─── 1. TAXA DE RETORNO ───
  const retornoStats = useMemo(() => {
    if (!reportData.length) return { cidadaos: [], resumo: { total: 0, retorno30: 0, retorno60: 0, retorno90: 0 } };

    const porCpf = {};
    reportData.forEach(item => {
      const cpf = item.cidadao?.cpf;
      if (!cpf) return;
      if (!porCpf[cpf]) porCpf[cpf] = { nome: item.cidadao?.nome || item.nome_exibicao || 'N/A', cpf, atendimentos: [] };
      const chegada = item.hora_chegada?.toDate?.();
      if (chegada) porCpf[cpf].atendimentos.push(chegada);
    });

    let retorno30 = 0, retorno60 = 0, retorno90 = 0;
    const cidadaosComRetorno = [];

    Object.values(porCpf).forEach(cid => {
      if (cid.atendimentos.length < 2) return;
      cid.atendimentos.sort((a, b) => a - b);
      let menorIntervalo = Infinity;
      for (let i = 1; i < cid.atendimentos.length; i++) {
        const diff = (cid.atendimentos[i] - cid.atendimentos[i - 1]) / (1000 * 60 * 60 * 24);
        if (diff < menorIntervalo) menorIntervalo = diff;
      }
      cid.menorIntervalo = Math.round(menorIntervalo);
      cid.totalVisitas = cid.atendimentos.length;
      cid.primeiraVisita = cid.atendimentos[0];
      cid.ultimaVisita = cid.atendimentos[cid.atendimentos.length - 1];
      cidadaosComRetorno.push(cid);

      if (menorIntervalo <= 30) retorno30++;
      if (menorIntervalo <= 60) retorno60++;
      if (menorIntervalo <= 90) retorno90++;
    });

    cidadaosComRetorno.sort((a, b) => b.totalVisitas - a.totalVisitas);

    return {
      cidadaos: cidadaosComRetorno.slice(0, 50),
      resumo: {
        total: Object.keys(porCpf).length,
        comRetorno: cidadaosComRetorno.length,
        retorno30,
        retorno60,
        retorno90
      }
    };
  }, [reportData]);

  // ─── 2. PRODUTIVIDADE POR ATENDENTE ───
  const produtividadeStats = useMemo(() => {
    if (!reportData.length) return [];

    const porAtendente = {};
    reportData.forEach(item => {
      if (!item.atendente_id) return;
      const id = item.atendente_id;
      if (!porAtendente[id]) {
        porAtendente[id] = { id, total: 0, finalizados: 0, tempoTotal: 0, countTempo: 0, dias: new Set(), ausencias: 0 };
      }
      const p = porAtendente[id];
      p.total++;
      if (item.status === 'finalizado') p.finalizados++;
      if (item.status === 'ausente') p.ausencias++;

      if (item.hora_chegada?.toDate) {
        p.dias.add(item.hora_chegada.toDate().toLocaleDateString('pt-BR'));
      }

      const inicio = item.hora_inicio || item.hora_chamada;
      const fim = item.hora_fim;
      if (inicio?.toMillis && fim?.toMillis) {
        const diffMin = (fim.toMillis() - inicio.toMillis()) / 60000;
        if (diffMin > 0 && diffMin < 480) {
          p.tempoTotal += diffMin;
          p.countTempo++;
        }
      }
    });

    return Object.values(porAtendente)
      .map(p => ({
        ...p,
        nome: getAtendenteNome(p.id),
        diasAtivos: p.dias.size,
        mediaPorDia: p.dias.size > 0 ? (p.finalizados / p.dias.size).toFixed(1) : '0',
        tempoMedio: p.countTempo > 0 ? Math.round(p.tempoTotal / p.countTempo) : 0
      }))
      .sort((a, b) => b.finalizados - a.finalizados);
  }, [reportData, getAtendenteNome]);

  // ─── 3. RELATÓRIO DE AUSÊNCIAS ───
  const ausenciaStats = useMemo(() => {
    if (!reportData.length) return { total: 0, porTipo: {}, porHora: {}, recorrentes: [] };

    const ausentes = reportData.filter(i => i.status === 'ausente');
    const porTipo = {};
    const porHora = {};
    const porCpf = {};

    ausentes.forEach(item => {
      const tipo = getTipoNome(item.tipo_atendimento_id);
      porTipo[tipo] = (porTipo[tipo] || 0) + 1;

      if (item.hora_chamada?.toDate) {
        const hora = item.hora_chamada.toDate().getHours();
        porHora[hora] = (porHora[hora] || 0) + 1;
      }

      const cpf = item.cidadao?.cpf;
      if (cpf) {
        if (!porCpf[cpf]) porCpf[cpf] = { cpf, nome: item.cidadao?.nome || item.nome_exibicao || 'N/A', count: 0 };
        porCpf[cpf].count++;
      }
    });

    const recorrentes = Object.values(porCpf).filter(c => c.count >= 2).sort((a, b) => b.count - a.count).slice(0, 20);

    return { total: ausentes.length, porTipo, porHora, recorrentes };
  }, [reportData, getTipoNome]);

  // ─── 4. COMPARATIVO ENTRE UNIDADES ───
  const comparativoStats = useMemo(() => {
    if (!reportData.length || !crasUnidades?.length) return [];

    const porUnidade = {};
    reportData.forEach(item => {
      const id = item.cras_id;
      if (!id) return;
      if (!porUnidade[id]) {
        porUnidade[id] = { id, total: 0, finalizados: 0, ausentes: 0, tempoEsperaTotal: 0, countEspera: 0, tipos: {} };
      }
      const u = porUnidade[id];
      u.total++;
      if (item.status === 'finalizado') u.finalizados++;
      if (item.status === 'ausente') u.ausentes++;

      const tipoNome = getTipoNome(item.tipo_atendimento_id);
      u.tipos[tipoNome] = (u.tipos[tipoNome] || 0) + 1;

      const chamada = item.hora_chamada || item.hora_inicio;
      if (chamada?.toMillis && item.hora_chegada?.toMillis) {
        const waitMin = (chamada.toMillis() - item.hora_chegada.toMillis()) / 60000;
        if (waitMin > 0 && waitMin < 480) {
          u.tempoEsperaTotal += waitMin;
          u.countEspera++;
        }
      }
    });

    return Object.values(porUnidade)
      .map(u => ({
        ...u,
        nome: getCrasNome(u.id),
        tempoMedioEspera: u.countEspera > 0 ? Math.round(u.tempoEsperaTotal / u.countEspera) : 0,
        taxaAusencia: u.total > 0 ? ((u.ausentes / u.total) * 100).toFixed(1) : '0',
        topTipos: Object.entries(u.tipos).sort((a, b) => b[1] - a[1]).slice(0, 3)
      }))
      .sort((a, b) => b.total - a.total);
  }, [reportData, getCrasNome, getTipoNome]);

  // ─── EXPORT / PREVIEW PDF ───
  const buildPDF = (titulo, headers, rows) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(titulo, 14, 20);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [19, 81, 180] },
      theme: 'striped',
    });

    return doc;
  };

  const exportPDF = (titulo, headers, rows) => {
    buildPDF(titulo, headers, rows).save(`${titulo.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const previewPDF = (titulo, headers, rows) => {
    const doc = buildPDF(titulo, headers, rows);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const formatDate = (d) => {
    if (!d) return '---';
    try { return d.toLocaleDateString('pt-BR'); } catch { return '---'; }
  };

  if (!reportData.length) {
    return (
      <Card className="p-8 text-center">
        <RefreshCw size={40} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 font-medium">Use os filtros acima e clique em "Buscar" para gerar as análises avançadas.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg">
        {[
          { key: 'retorno', label: 'Taxa de Retorno', icon: RefreshCw },
          { key: 'produtividade', label: 'Produtividade', icon: TrendingUp },
          { key: 'ausencias', label: 'Ausências', icon: AlertTriangle },
          { key: 'comparativo', label: 'Comparativo Unidades', icon: Building },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              subTab === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAXA DE RETORNO ─── */}
      {subTab === 'retorno' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center border-t-4 border-t-blue-500">
              <p className="text-xs text-gray-500 uppercase font-bold">Cidadãos Únicos</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{retornoStats.resumo.total}</p>
            </Card>
            <Card className="p-4 text-center border-t-4 border-t-green-500">
              <p className="text-xs text-gray-500 uppercase font-bold">Com Retorno</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{retornoStats.resumo.comRetorno}</p>
              <p className="text-xs text-gray-400 mt-1">
                {retornoStats.resumo.total > 0 ? ((retornoStats.resumo.comRetorno / retornoStats.resumo.total) * 100).toFixed(1) : 0}% do total
              </p>
            </Card>
            <Card className="p-4 text-center border-t-4 border-t-amber-500">
              <p className="text-xs text-gray-500 uppercase font-bold">Retorno em até 30 dias</p>
              <p className="text-3xl font-bold text-amber-700 mt-1">{retornoStats.resumo.retorno30}</p>
            </Card>
            <Card className="p-4 text-center border-t-4 border-t-purple-500">
              <p className="text-xs text-gray-500 uppercase font-bold">Retorno em até 90 dias</p>
              <p className="text-3xl font-bold text-purple-700 mt-1">{retornoStats.resumo.retorno90}</p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <UserCheck size={18} className="text-blue-600" />
                Cidadãos com Maior Recorrência (Top 50)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => previewPDF(
                    'Relatorio Taxa de Retorno',
                    ['Nome', 'CPF', 'Visitas', 'Menor Intervalo', 'Primeira Visita', 'Última Visita'],
                    retornoStats.cidadaos.map(c => [c.nome, c.cpf, c.totalVisitas, `${c.menorIntervalo} dias`, formatDate(c.primeiraVisita), formatDate(c.ultimaVisita)])
                  )}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                  title="Visualizar PDF"
                >
                  <Eye size={14} /> Preview
                </button>
                <button
                  onClick={() => exportPDF(
                    'Relatorio Taxa de Retorno',
                    ['Nome', 'CPF', 'Visitas', 'Menor Intervalo', 'Primeira Visita', 'Última Visita'],
                    retornoStats.cidadaos.map(c => [c.nome, c.cpf, c.totalVisitas, `${c.menorIntervalo} dias`, formatDate(c.primeiraVisita), formatDate(c.ultimaVisita)])
                  )}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                >
                  <Download size={14} /> PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left font-semibold text-gray-600">Nome</th>
                    <th className="p-3 text-left font-semibold text-gray-600">CPF</th>
                    <th className="p-3 text-center font-semibold text-gray-600">Visitas</th>
                    <th className="p-3 text-center font-semibold text-gray-600">Menor Intervalo</th>
                    <th className="p-3 text-center font-semibold text-gray-600">Primeira</th>
                    <th className="p-3 text-center font-semibold text-gray-600">Última</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {retornoStats.cidadaos.map((c, i) => (
                    <tr key={c.cpf} className="hover:bg-gray-50">
                      <td className="p-3 font-medium">{c.nome}</td>
                      <td className="p-3 text-gray-500 font-mono text-xs">{c.cpf}</td>
                      <td className="p-3 text-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">{c.totalVisitas}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          c.menorIntervalo <= 7 ? 'bg-red-100 text-red-800' :
                          c.menorIntervalo <= 30 ? 'bg-amber-100 text-amber-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {c.menorIntervalo} dias
                        </span>
                      </td>
                      <td className="p-3 text-center text-xs text-gray-500">{formatDate(c.primeiraVisita)}</td>
                      <td className="p-3 text-center text-xs text-gray-500">{formatDate(c.ultimaVisita)}</td>
                    </tr>
                  ))}
                  {retornoStats.cidadaos.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum cidadão com retorno no período selecionado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─── PRODUTIVIDADE ─── */}
      {subTab === 'produtividade' && (
        <div className="space-y-6">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <TrendingUp size={18} className="text-green-600" />
                Produtividade por Atendente
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => previewPDF(
                    'Relatorio de Produtividade',
                    ['Atendente', 'Finalizados', 'Dias Ativos', 'Média/Dia', 'Tempo Médio', 'Ausências'],
                    produtividadeStats.map(p => [p.nome, p.finalizados, p.diasAtivos, p.mediaPorDia, `${p.tempoMedio} min`, p.ausencias])
                  )}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                  title="Visualizar PDF"
                >
                  <Eye size={14} /> Preview
                </button>
                <button
                  onClick={() => exportPDF(
                    'Relatorio de Produtividade',
                    ['Atendente', 'Finalizados', 'Dias Ativos', 'Média/Dia', 'Tempo Médio', 'Ausências'],
                    produtividadeStats.map(p => [p.nome, p.finalizados, p.diasAtivos, p.mediaPorDia, `${p.tempoMedio} min`, p.ausencias])
                  )}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors"
                >
                  <Download size={14} /> PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left font-semibold text-gray-600">#</th>
                    <th className="p-3 text-left font-semibold text-gray-600">Atendente</th>
                    <th className="p-3 text-center font-semibold text-gray-600">Finalizados</th>
                    <th className="p-3 text-center font-semibold text-gray-600">Dias Ativos</th>
                    <th className="p-3 text-center font-semibold text-gray-600">Média/Dia</th>
                    <th className="p-3 text-center font-semibold text-gray-600">Tempo Médio</th>
                    <th className="p-3 text-center font-semibold text-gray-600">Ausências</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {produtividadeStats.map((p, i) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-400 font-bold">{i + 1}</td>
                      <td className="p-3 font-medium">{p.nome}</td>
                      <td className="p-3 text-center">
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-bold">{p.finalizados}</span>
                      </td>
                      <td className="p-3 text-center text-gray-600">{p.diasAtivos}</td>
                      <td className="p-3 text-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">{p.mediaPorDia}</span>
                      </td>
                      <td className="p-3 text-center text-gray-600">{p.tempoMedio > 0 ? `${p.tempoMedio} min` : '-'}</td>
                      <td className="p-3 text-center">
                        {p.ausencias > 0 ? (
                          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-bold">{p.ausencias}</span>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {produtividadeStats.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum atendente com dados no período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─── AUSÊNCIAS ─── */}
      {subTab === 'ausencias' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 text-center border-t-4 border-t-orange-500">
              <p className="text-xs text-gray-500 uppercase font-bold">Total de Ausências</p>
              <p className="text-3xl font-bold text-orange-700 mt-1">{ausenciaStats.total}</p>
              <p className="text-xs text-gray-400 mt-1">
                {reportData.length > 0 ? ((ausenciaStats.total / reportData.length) * 100).toFixed(1) : 0}% dos atendimentos
              </p>
            </Card>
            <Card className="p-4 border-t-4 border-t-blue-500">
              <p className="text-xs text-gray-500 uppercase font-bold mb-2">Ausências por Tipo</p>
              <div className="space-y-1">
                {Object.entries(ausenciaStats.porTipo).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tipo, count]) => (
                  <div key={tipo} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 truncate">{tipo}</span>
                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs font-bold">{count}</span>
                  </div>
                ))}
                {Object.keys(ausenciaStats.porTipo).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">Sem dados</p>
                )}
              </div>
            </Card>
            <Card className="p-4 border-t-4 border-t-purple-500">
              <p className="text-xs text-gray-500 uppercase font-bold mb-2">Horários com Mais Ausências</p>
              <div className="space-y-1">
                {Object.entries(ausenciaStats.porHora).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([hora, count]) => (
                  <div key={hora} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{String(hora).padStart(2, '0')}:00</span>
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">{count}</span>
                  </div>
                ))}
                {Object.keys(ausenciaStats.porHora).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">Sem dados</p>
                )}
              </div>
            </Card>
          </div>

          {ausenciaStats.recorrentes.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-orange-600" />
                  Cidadãos com Ausências Recorrentes
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => previewPDF(
                      'Relatorio de Ausencias Recorrentes',
                      ['Nome', 'CPF', 'Ausências'],
                      ausenciaStats.recorrentes.map(c => [c.nome, c.cpf, c.count])
                    )}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                    title="Visualizar PDF"
                  >
                    <Eye size={14} /> Preview
                  </button>
                  <button
                    onClick={() => exportPDF(
                      'Relatorio de Ausencias Recorrentes',
                      ['Nome', 'CPF', 'Ausências'],
                      ausenciaStats.recorrentes.map(c => [c.nome, c.cpf, c.count])
                    )}
                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors"
                  >
                    <Download size={14} /> PDF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left font-semibold text-gray-600">Nome</th>
                      <th className="p-3 text-left font-semibold text-gray-600">CPF</th>
                      <th className="p-3 text-center font-semibold text-gray-600">Ausências</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ausenciaStats.recorrentes.map(c => (
                      <tr key={c.cpf} className="hover:bg-gray-50">
                        <td className="p-3 font-medium">{c.nome}</td>
                        <td className="p-3 text-gray-500 font-mono text-xs">{c.cpf}</td>
                        <td className="p-3 text-center">
                          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-bold">{c.count}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── COMPARATIVO ENTRE UNIDADES ─── */}
      {subTab === 'comparativo' && (
        <div className="space-y-6">
          {comparativoStats.length <= 1 ? (
            <Card className="p-8 text-center">
              <Building size={40} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">
                {comparativoStats.length === 1
                  ? 'Apenas uma unidade encontrada no período. O comparativo requer ao menos 2 unidades.'
                  : 'Nenhuma unidade encontrada no período selecionado.'}
              </p>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Building size={18} className="text-indigo-600" />
                  Comparativo entre Unidades Centro Pop
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => previewPDF(
                      'Comparativo entre Unidades',
                      ['Unidade', 'Total', 'Finalizados', 'Ausentes', 'Taxa Ausência', 'Tempo Médio Espera'],
                      comparativoStats.map(u => [u.nome, u.total, u.finalizados, u.ausentes, `${u.taxaAusencia}%`, `${u.tempoMedioEspera} min`])
                    )}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                    title="Visualizar PDF"
                  >
                    <Eye size={14} /> Preview
                  </button>
                  <button
                    onClick={() => exportPDF(
                      'Comparativo entre Unidades',
                      ['Unidade', 'Total', 'Finalizados', 'Ausentes', 'Taxa Ausência', 'Tempo Médio Espera'],
                      comparativoStats.map(u => [u.nome, u.total, u.finalizados, u.ausentes, `${u.taxaAusencia}%`, `${u.tempoMedioEspera} min`])
                    )}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                  >
                    <Download size={14} /> PDF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left font-semibold text-gray-600">Unidade</th>
                      <th className="p-3 text-center font-semibold text-gray-600">Total</th>
                      <th className="p-3 text-center font-semibold text-gray-600">Finalizados</th>
                      <th className="p-3 text-center font-semibold text-gray-600">Ausentes</th>
                      <th className="p-3 text-center font-semibold text-gray-600">Taxa Ausência</th>
                      <th className="p-3 text-center font-semibold text-gray-600">Espera Média</th>
                      <th className="p-3 text-left font-semibold text-gray-600">Top Serviços</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {comparativoStats.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-indigo-700">{u.nome}</td>
                        <td className="p-3 text-center font-bold">{u.total}</td>
                        <td className="p-3 text-center">
                          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-bold">{u.finalizados}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs font-bold">{u.ausentes}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            parseFloat(u.taxaAusencia) > 20 ? 'bg-red-100 text-red-800' :
                            parseFloat(u.taxaAusencia) > 10 ? 'bg-amber-100 text-amber-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {u.taxaAusencia}%
                          </span>
                        </td>
                        <td className="p-3 text-center text-gray-600">{u.tempoMedioEspera > 0 ? `${u.tempoMedioEspera} min` : '-'}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {u.topTipos.map(([tipo, count]) => (
                              <span key={tipo} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                {tipo} ({count})
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default RelatoriosAvancados;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { collection, query, where, getDocs, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { Printer, Settings, Save, X, AlertCircle, Info } from 'lucide-react';
import Button from './ui/Button';
import { normalizeRole, isTestUser } from '../utils/helpers';

/**
 * Calcula idade em uma data de referência.
 * Aceita formato BR (DD/MM/YYYY) ou ISO.
 */
const getAge = (birthDateString, referenceDate) => {
  if (!birthDateString) return null;

  let birthDate;
  if (typeof birthDateString === 'string' && birthDateString.includes('/')) {
    const parts = birthDateString.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      birthDate = new Date(year, month, day);
    } else {
      birthDate = new Date(birthDateString);
    }
  } else {
    birthDate = new Date(birthDateString);
  }

  if (isNaN(birthDate.getTime())) return null;

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const m = referenceDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const RelatorioRMAPage = ({ crasUnidades }) => {
  const { userProfile, db, appId } = useAuth();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);

  // Header State
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [unidadeInfo, setUnidadeInfo] = useState({
    nome: 'Centro POP Centro',
    numero: '',
    endereco: '',
    municipio: 'São Luís',
    uf: 'MA'
  });

  // Métricas adicionais — atendimentos sem RMA preenchido
  const [atendimentosSemRMA, setAtendimentosSemRMA] = useState(0);

  // Config Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configData, setConfigData] = useState({
    nome: '',
    numero: '',
    endereco: '',
    municipio: '',
    uf: ''
  });

  const handleOpenConfig = () => {
    setConfigData({ ...unidadeInfo });
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!userProfile?.cras_id) {
      alert("Erro: Unidade não identificada no perfil do usuário. Apenas usuários vinculados à unidade podem salvar configurações.");
      return;
    }

    try {
      setLoading(true);
      const unidadeRef = doc(db, `artifacts/${appId}/public/data/cras_unidades`, userProfile.cras_id);

      const updatePayload = {
        nome: configData.nome,
        identificacao: configData.numero,
        endereco: configData.endereco,
        municipio: configData.municipio,
        uf: configData.uf
      };

      const cleanPayload = Object.fromEntries(
        Object.entries(updatePayload).filter(([, v]) => v !== undefined)
      );

      await updateDoc(unidadeRef, cleanPayload);

      setUnidadeInfo(configData);
      setShowConfigModal(false);
      alert("Cabeçalho atualizado e salvo para todos os usuários desta unidade!");
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert("Erro ao salvar configurações no banco de dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setConfigData(prev => ({ ...prev, [name]: value }));
  };

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Estado do formulário (calculado + editável manualmente)
  // BLOCO I APENAS — Bloco II (Abordagem Social) removido por não se aplicar ao Centro POP Centro
  const [formData, setFormData] = useState({
    // A.1 — Demografia das pessoas atendidas
    a1_total: 0,
    a1_m_0_12: 0, a1_m_13_17: 0, a1_m_18_39: 0, a1_m_40_59: 0, a1_m_60_plus: 0,
    a1_f_0_12: 0, a1_f_13_17: 0, a1_f_18_39: 0, a1_f_40_59: 0, a1_f_60_plus: 0,

    // B — Características específicas
    b1_drogas: 0,
    b2_migrantes: 0,
    b3_mental: 0,

    // C — CadÚnico
    c1_inclusao: 0,
    c2_atualizacao: 0,

    // D — Volume total
    d1_volume: 0,
  });

  // Carrega dados da unidade ao montar
  useEffect(() => {
    if (userProfile?.cras_id && crasUnidades?.length > 0) {
      const cras = crasUnidades.find(c => c.id === userProfile.cras_id);
      if (cras) {
        setUnidadeInfo(prev => ({
          ...prev,
          nome: cras.nome || 'Centro POP Centro',
          numero: cras.identificacao || '',
          endereco: cras.endereco || '',
          municipio: cras.municipio || 'São Luís',
          uf: cras.uf || 'MA'
        }));
      }
    }
  }, [userProfile, crasUnidades]);

  // Busca dos atendimentos do mês
  useEffect(() => {
    const fetchData = async () => {
      if (!db || !appId) return;
      setLoading(true);
      try {
        const start = new Date(ano, mes - 1, 1);
        const end = new Date(ano, mes, 0, 23, 59, 59);

        const q = query(
          collection(db, `artifacts/${appId}/public/data/atendimentos`),
          where('hora_chegada', '>=', Timestamp.fromDate(start)),
          where('hora_chegada', '<=', Timestamp.fromDate(end))
        );

        const snap = await getDocs(q);
        let data = snap.docs.map(d => d.data()).filter(d => !isTestUser(d));

        // Filtra por unidade (Centro POP Centro tem 1 unidade só, mas mantém safety check)
        const roleNorm = userProfile?.roleNorm || normalizeRole(userProfile?.role);
        if (roleNorm === 'coordenador' && userProfile?.cras_id) {
          data = data.filter(d => d.cras_id === userProfile.cras_id);
        }

        setReportData(data);
      } catch (err) {
        console.error("Erro ao buscar dados RMA:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [mes, ano, db, appId, userProfile]);

  // Calcula estatísticas
  useEffect(() => {
    if (reportData.length === 0) {
      setAtendimentosSemRMA(0);
      return;
    }

    const stats = {
      a1_total: 0,
      a1_m_0_12: 0, a1_m_13_17: 0, a1_m_18_39: 0, a1_m_40_59: 0, a1_m_60_plus: 0,
      a1_f_0_12: 0, a1_f_13_17: 0, a1_f_18_39: 0, a1_f_40_59: 0, a1_f_60_plus: 0,
      b1_drogas: 0,
      b2_migrantes: 0,
      b3_mental: 0,
      c1_inclusao: 0,
      c2_atualizacao: 0,
      d1_volume: 0,
    };

    const uniquePersonsA = new Set();
    const uniquePersonsB1 = new Set();
    const uniquePersonsB2 = new Set();
    const uniquePersonsB3 = new Set();
    const uniquePersonsC1 = new Set();
    const uniquePersonsC2 = new Set();

    let countSemRMA = 0;

    reportData.forEach(item => {
      const status = String(item.status || '').toLowerCase();
      // Só contam atendimentos efetivamente realizados
      if (status !== 'em_atendimento' && status !== 'finalizado') return;

      // D.1 — Volume total de atendimentos
      stats.d1_volume++;

      const cpfDigits = item.cidadao?.cpf ? String(item.cidadao.cpf).replace(/\D/g, '') : '';
      const personId = (cpfDigits && cpfDigits.length === 11 ? cpfDigits : null)
        || item.cidadao?.id
        || (item.cidadao?.nome + (item.cidadao?.dataNascimento || ''));
      if (!personId) return;

      const birthDate = item.cidadao?.dataNascimento;
      const sex = item.cidadao?.sexo;
      const age = getAge(birthDate, new Date(ano, mes - 1, 28));

      // A.1 — Demografia (pessoa única no mês)
      if (!uniquePersonsA.has(personId)) {
        uniquePersonsA.add(personId);
        stats.a1_total++;

        if (age !== null && sex) {
          const isMale = String(sex).toLowerCase().startsWith('m');
          const prefix = isMale ? 'a1_m' : 'a1_f';

          if (age <= 12) stats[`${prefix}_0_12`]++;
          else if (age <= 17) stats[`${prefix}_13_17`]++;
          else if (age <= 39) stats[`${prefix}_18_39`]++;
          else if (age <= 59) stats[`${prefix}_40_59`]++;
          else stats[`${prefix}_60_plus`]++;
        }
      }

      // Checa se tem dados de RMA preenchidos
      const rma = item.rma || {};
      const temAlgumaInfo =
        rma.b1_drogas_ilicitas || rma.b2_migrante || rma.b3_doenca_mental ||
        rma.c1_inclusao_cadunico || rma.c2_atualizacao_cadunico ||
        (Array.isArray(item.cadunico_acoes) && item.cadunico_acoes.some(a =>
          a === 'inclusao' || a === 'recadastro' || a === 'transferencia'
        ));

      // Se é atendimento técnico (psicólogo/assistente social) finalizado e SEM RMA, conta como faltante
      const tipoNome = String(item.tipo_nome || '').toLowerCase();
      const ehTecnico = tipoNome.includes('psic') || tipoNome.includes('assistente');
      if (status === 'finalizado' && ehTecnico && !temAlgumaInfo && rma.c_status !== 'rascunho') {
        countSemRMA++;
      }

      // Bloco B — Características (pessoa única)
      if (rma.b1_drogas_ilicitas && !uniquePersonsB1.has(personId)) {
        uniquePersonsB1.add(personId);
        stats.b1_drogas++;
      }
      if (rma.b2_migrante && !uniquePersonsB2.has(personId)) {
        uniquePersonsB2.add(personId);
        stats.b2_migrantes++;
      }
      if (rma.b3_doenca_mental && !uniquePersonsB3.has(personId)) {
        uniquePersonsB3.add(personId);
        stats.b3_mental++;
      }

      // Bloco C — CadÚnico
      // Lógica unificada:
      // 1. Checkboxes explícitos do RMA (preenchidos por psicólogo OU CadÚnico)
      // 2. Auto-derivado de cadunico_acoes (preenchido pelo CadÚnico ao finalizar)
      // 3. Campo legado c_acao_final (retrocompatibilidade)
      if (rma.c_status === 'confirmado' || (Array.isArray(item.cadunico_acoes) && item.cadunico_acoes.length > 0)) {
        const isC1 = rma.c1_inclusao_cadunico === true
          || (Array.isArray(item.cadunico_acoes) && item.cadunico_acoes.includes('inclusao'));

        const isC2 = rma.c2_atualizacao_cadunico === true
          || (Array.isArray(item.cadunico_acoes) && (
            item.cadunico_acoes.includes('recadastro') ||
            item.cadunico_acoes.includes('transferencia')
          ));

        // Retrocompatibilidade
        const acao = rma.c_acao_final;
        const isC1Legacy = (acao === 'inclusao' || acao === 'ambos');
        const isC2Legacy = (acao === 'atualizacao' || acao === 'ambos');

        if ((isC1 || isC1Legacy) && !uniquePersonsC1.has(personId)) {
          uniquePersonsC1.add(personId);
          stats.c1_inclusao++;
        }
        if ((isC2 || isC2Legacy) && !uniquePersonsC2.has(personId)) {
          uniquePersonsC2.add(personId);
          stats.c2_atualizacao++;
        }
      }
    });

    setAtendimentosSemRMA(countSemRMA);
    setFormData(stats);
  }, [reportData, mes, ano]);

  const handlePrint = () => {
    window.print();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUnidadeChange = (e) => {
    const { name, value } = e.target;
    setUnidadeInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const totalAtendimentos = reportData.length;

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4 print:p-0 print:bg-white print:block">

      {/* Controles — escondidos na impressão */}
      <div className="w-full max-w-[210mm] mb-6 p-4 bg-white shadow-md rounded-lg flex flex-wrap gap-4 items-end no-print">
        <div>
          <label className="block text-sm font-bold text-gray-700">Mês</label>
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="border p-1 rounded w-32"
          >
            {months.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700">Ano</label>
          <input
            type="number"
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="border p-1 rounded w-20"
          />
        </div>
        <div className="flex-1">
          {loading && <span className="text-blue-600 text-sm font-bold">Carregando dados...</span>}
        </div>
        <div className="flex gap-2">
          {hasPermission('manage_types') && (
            <Button onClick={handleOpenConfig} className="bg-blue-600 text-white flex items-center gap-2" title="Configurar cabeçalho padrão da unidade">
              <Settings size={18} /> Configurar Cabeçalho
            </Button>
          )}
          <Button onClick={handlePrint} className="bg-gray-800 text-white flex items-center gap-2">
            <Printer size={18} /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* Avisos — atendimentos sem RMA preenchido */}
      {!loading && totalAtendimentos > 0 && atendimentosSemRMA > 0 && (
        <div className="w-full max-w-[210mm] mb-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg no-print flex items-start gap-3">
          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold text-amber-800">
              {atendimentosSemRMA} atendimento(s) técnico(s) finalizado(s) sem RMA preenchido neste mês
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Os técnicos finalizaram esses atendimentos sem marcar B.1, B.2, B.3 ou solicitar CadÚnico.
              Verifique se está correto — pode haver subnotificação no relatório.
            </p>
          </div>
        </div>
      )}

      {!loading && totalAtendimentos > 0 && atendimentosSemRMA === 0 && (
        <div className="w-full max-w-[210mm] mb-4 p-3 bg-green-50 border-l-4 border-green-500 rounded-lg no-print flex items-center gap-3">
          <Info className="text-green-600 shrink-0" size={20} />
          <p className="text-sm text-green-800 font-medium">
            Todos os atendimentos técnicos finalizados neste mês têm RMA preenchido. ✓
          </p>
        </div>
      )}

      {/* Página A4 */}
      <div className="w-full overflow-x-auto flex justify-center print:block print:overflow-visible">
        <div className="bg-white shadow-2xl print:shadow-none w-[210mm] min-w-[210mm] min-h-[297mm] p-[10mm] box-border relative text-[9pt] font-sans text-black leading-snug rma-container">

          {/* CSS de impressão pixel-perfect */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page { size: A4; margin: 0; }
              body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              body * { visibility: hidden; }
              .rma-container, .rma-container * { visibility: visible; }
              .rma-container {
                position: absolute;
                left: 0; top: 0;
                width: 210mm;
                min-height: 297mm;
                margin: 0;
                padding: 10mm;
                box-shadow: none;
                background: white;
                z-index: 9999;
              }
              .no-print { display: none !important; }
            }
            .rma-table { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
            .rma-table th, .rma-table td { border: 1px solid black; padding: 3px 5px; vertical-align: middle; }
            .bg-section { background-color: #92D050 !important; font-weight: bold; }
            .bg-gray-header { background-color: #E7E6E6 !important; text-align: center; }
            .bg-dark-green { background-color: #006400 !important; color: white !important; }
            .input-cell { width: 100%; border: none; background: transparent; text-align: center; font-weight: bold; font-size: 9pt; outline: none; }
            .input-header { border: none; border-bottom: 1px solid black; background: transparent; padding: 0 5px; outline: none; }
          `}} />

          {/* Header */}
          <div className="bg-[#92D050] border border-black p-1 font-bold flex justify-between items-center mb-2 rma-header-bar-dark">
            <span>FORMULÁRIO DE REGISTRO MENSAL DE ATENDIMENTOS DO CENTRO POP</span>
            <div className="flex items-center gap-1">
              MÊS: <input className="w-24 text-center bg-white border-none h-5 font-bold" value={months[mes-1] || ''} readOnly /> / ANO 20 <input className="w-8 text-center bg-white border-none h-5 font-bold" value={String(ano).slice(-2)} readOnly />
            </div>
          </div>

          {/* Identificação da Unidade */}
          <div className="mb-2 space-y-1">
            <div className="flex gap-2">
              <span className="whitespace-nowrap">Nome da Unidade:</span>
              <input name="nome" value={unidadeInfo.nome} onChange={handleUnidadeChange} className="input-header flex-grow" />
              <span className="whitespace-nowrap ml-2">Nº da Unidade:</span>
              <input name="numero" value={unidadeInfo.numero} onChange={handleUnidadeChange} className="input-header w-32 text-center" />
            </div>
            <div className="flex gap-2">
              <span className="whitespace-nowrap">Endereço:</span>
              <input name="endereco" value={unidadeInfo.endereco} onChange={handleUnidadeChange} className="input-header flex-grow" />
            </div>
            <div className="flex gap-2">
              <span className="whitespace-nowrap">Município:</span>
              <input name="municipio" value={unidadeInfo.municipio} onChange={handleUnidadeChange} className="input-header flex-grow" />
              <span className="whitespace-nowrap ml-2">UF:</span>
              <input name="uf" value={unidadeInfo.uf} onChange={handleUnidadeChange} className="input-header w-12 text-center" />
            </div>
          </div>

          {/* BLOCO I */}
          <div className="bg-dark-green text-white font-bold px-2 py-1 border border-black mt-4 flex justify-between items-center">
            Bloco I – Serviço Especializado para Pessoas em Situação de Rua
          </div>

          {/* Tabela A.1 — Demografia */}
          <table className="rma-table mt-0">
            <thead>
              <tr>
                <th rowSpan="2" className="bg-section w-[40%] text-left">A. Pessoas em situação de rua atendidas no Serviço durante o mês de referência</th>
                <th rowSpan="2" className="bg-section w-[8%] text-center">Total</th>
                <th rowSpan="2" className="bg-gray-header w-[10%]">Sexo</th>
                <th className="bg-gray-header">0 a 12<br/>anos</th>
                <th className="bg-gray-header">13 a 17<br/>anos</th>
                <th className="bg-gray-header">18 a 39<br/>anos</th>
                <th className="bg-gray-header">40 a 59<br/>anos</th>
                <th className="bg-gray-header">60 anos<br/>ou mais</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td rowSpan="2" className="text-left align-top">
                  <div className="font-bold mb-1">A.1. Quantidade e perfil das pessoas em situação de rua atendidas no mês de referência</div>
                </td>
                <td rowSpan="2">
                  <input name="a1_total" value={formData.a1_total} onChange={handleInputChange} className="input-cell" />
                </td>
                <td className="text-center">Masculino</td>
                <td><input name="a1_m_0_12" value={formData.a1_m_0_12} onChange={handleInputChange} className="input-cell" /></td>
                <td><input name="a1_m_13_17" value={formData.a1_m_13_17} onChange={handleInputChange} className="input-cell" /></td>
                <td><input name="a1_m_18_39" value={formData.a1_m_18_39} onChange={handleInputChange} className="input-cell" /></td>
                <td><input name="a1_m_40_59" value={formData.a1_m_40_59} onChange={handleInputChange} className="input-cell" /></td>
                <td><input name="a1_m_60_plus" value={formData.a1_m_60_plus} onChange={handleInputChange} className="input-cell" /></td>
              </tr>
              <tr>
                <td className="text-center">Feminino</td>
                <td><input name="a1_f_0_12" value={formData.a1_f_0_12} onChange={handleInputChange} className="input-cell" /></td>
                <td><input name="a1_f_13_17" value={formData.a1_f_13_17} onChange={handleInputChange} className="input-cell" /></td>
                <td><input name="a1_f_18_39" value={formData.a1_f_18_39} onChange={handleInputChange} className="input-cell" /></td>
                <td><input name="a1_f_40_59" value={formData.a1_f_40_59} onChange={handleInputChange} className="input-cell" /></td>
                <td><input name="a1_f_60_plus" value={formData.a1_f_60_plus} onChange={handleInputChange} className="input-cell" /></td>
              </tr>
            </tbody>
          </table>
          <div className="text-[7pt] text-red-600 italic mb-2">
            Atenção! Em A1 cada pessoa deve ser contada uma única vez a cada mês, mesmo que tenha sido atendida várias vezes durante este mesmo mês.
          </div>

          {/* Tabela B */}
          <table className="rma-table">
            <tbody>
              <tr>
                <td className="bg-section text-left font-bold">B. Características específicas identificadas em pessoas atendidas no Serviço durante o mês de referência</td>
                <td className="bg-section w-[8%] text-center font-bold">Total</td>
              </tr>
              <tr>
                <td className="text-left">B.1. Pessoas usuárias de crack ou outras drogas ilícitas</td>
                <td><input name="b1_drogas" value={formData.b1_drogas} onChange={handleInputChange} className="input-cell" /></td>
              </tr>
              <tr>
                <td className="text-left">B.2. Migrantes</td>
                <td><input name="b2_migrantes" value={formData.b2_migrantes} onChange={handleInputChange} className="input-cell" /></td>
              </tr>
              <tr>
                <td className="text-left">B.3. Pessoas com doença ou transtorno mental</td>
                <td><input name="b3_mental" value={formData.b3_mental} onChange={handleInputChange} className="input-cell" /></td>
              </tr>
            </tbody>
          </table>

          {/* Tabela C */}
          <table className="rma-table">
            <tbody>
              <tr>
                <td className="bg-section text-left font-bold">C. Cadastramento de pessoas em situação de rua durante o mês de referência</td>
                <td className="bg-section w-[8%] text-center font-bold">Total</td>
              </tr>
              <tr>
                <td className="text-left">C.1. Pessoas que foram incluídas no Cadastro Único para Programas Sociais, no mês</td>
                <td><input name="c1_inclusao" value={formData.c1_inclusao} onChange={handleInputChange} className="input-cell" /></td>
              </tr>
              <tr>
                <td className="text-left">C.2. Pessoas que realizaram atualização do Cadastro Único para Programas Sociais, no mês</td>
                <td><input name="c2_atualizacao" value={formData.c2_atualizacao} onChange={handleInputChange} className="input-cell" /></td>
              </tr>
            </tbody>
          </table>

          {/* Tabela D */}
          <table className="rma-table">
            <tbody>
              <tr>
                <td className="bg-section text-left font-bold">D. Volume total de atendimentos realizados no mês de referência</td>
                <td className="bg-section w-[8%] text-center font-bold">Total</td>
              </tr>
              <tr>
                <td className="text-left">D.1. Quantidade total de atendimentos realizados <em>(compreendida como a soma do número de atendimentos realizados a cada dia, durante o mês de referência)</em></td>
                <td><input name="d1_volume" value={formData.d1_volume} onChange={handleInputChange} className="input-cell" /></td>
              </tr>
            </tbody>
          </table>

          {/* Bloco II REMOVIDO — Serviço de Abordagem Social não se aplica ao Centro POP Centro de São Luís */}

          {/* Assinatura */}
          <div className="mt-12">
            <p className="mb-6">Nome e cargo da pessoa responsável no Centro Pop pelas informações:</p>
            <div className="flex gap-8">
              <div className="flex-[2] border-t border-black pt-1">Assinatura:</div>
              <div className="flex-1 border-t border-black pt-1">CPF:</div>
            </div>
          </div>

        </div>
      </div>

      {/* Modal de Configuração */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Settings size={24} /> Configurar Cabeçalho da Unidade
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                As informações abaixo ficarão fixas para todos os relatórios desta unidade.
              </p>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Unidade</label>
                <input
                  name="nome"
                  value={configData.nome}
                  onChange={handleConfigChange}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: Centro POP Centro"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nº da Unidade</label>
                  <input
                    name="numero"
                    value={configData.numero}
                    onChange={handleConfigChange}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ex: 12345"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-bold text-gray-700 mb-1">UF</label>
                  <input
                    name="uf"
                    value={configData.uf}
                    onChange={handleConfigChange}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Endereço</label>
                <input
                  name="endereco"
                  value={configData.endereco}
                  onChange={handleConfigChange}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Rua, Número, Bairro..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Município</label>
                <input
                  name="municipio"
                  value={configData.municipio}
                  onChange={handleConfigChange}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RelatorioRMAPage;

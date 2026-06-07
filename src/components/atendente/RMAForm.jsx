import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Info, ListChecks, AlertCircle, CheckCircle2, Brain } from 'lucide-react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import Card from '../ui/Card';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Lista de transtornos/doenças mentais — curada para o contexto de Centro POP
 * (população em situação de rua). Cobre os quadros mais prevalentes sem virar
 * lista CID-10 completa.
 *
 * O `id` é o que vai pro Firestore (estável, não muda se mudarmos o label depois).
 */
const DOENCAS_OPCOES = [
  { id: 'depressao',          label: 'Depressão' },
  { id: 'ansiedade',          label: 'Transtorno de Ansiedade' },
  { id: 'esquizofrenia',      label: 'Esquizofrenia' },
  { id: 'bipolar',            label: 'Transtorno Bipolar' },
  { id: 'tept',               label: 'Transtorno de Estresse Pós-Traumático (TEPT)' },
  { id: 'uso_alcool',         label: 'Transtorno por uso de álcool' },
  { id: 'uso_substancias',    label: 'Transtorno por uso de outras substâncias' },
  { id: 'personalidade',      label: 'Transtorno de Personalidade' },
  { id: 'def_intelectual',    label: 'Deficiência Intelectual' },
  { id: 'demencia',           label: 'Demência / Comprometimento Cognitivo' },
  { id: 'tea',                label: 'Transtorno do Espectro Autista (TEA)' },
  { id: 'epilepsia',          label: 'Epilepsia' },
  { id: 'outro',              label: 'Outro (especificar)' },
];

/**
 * Tooltip explicativo para os critérios do RMA.
 * Acessível por hover (desktop) e clique (mobile).
 */
const InfoTooltip = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        className="text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setShow((v) => !v);
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        aria-label="Mais informações"
      >
        <Info size={14} />
      </button>
      {show && (
        <div
          className="absolute z-50 w-72 p-3 mt-1 text-[11px] leading-relaxed text-white bg-gray-800 rounded-md shadow-lg right-0 normal-case font-medium"
          style={{ wordBreak: 'normal' }}
        >
          {text}
        </div>
      )}
    </div>
  );
};

/**
 * Item individual de checkbox do RMA, com label, tooltip e indicação visual.
 */
const RMACheckItem = ({ name, checked, onChange, label, codigo, tooltip }) => {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
        checked
          ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
          : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-gray-50'
      }`}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest bg-blue-100 px-2 py-0.5 rounded">
              {codigo}
            </span>
            <span className={`text-xs font-bold ${checked ? 'text-blue-900' : 'text-gray-700'}`}>
              {label}
            </span>
          </div>
          <InfoTooltip text={tooltip} />
        </div>
      </div>
    </label>
  );
};

const RMAForm = ({ atendimentoAtual, rmaData, setRmaData, crasId }) => {
  const { db, appId } = useAuth();

  // CPF do cidadão — usado pra persistir o histórico de doenças no doc do cidadão.
  const cpfLimpo = useMemo(() => {
    const raw = atendimentoAtual?.cidadao?.cpf || '';
    return String(raw).replace(/\D/g, '');
  }, [atendimentoAtual?.cidadao?.cpf]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRmaData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Estado local da lista de doenças
  const doencasSelecionadas = useMemo(() => {
    return Array.isArray(rmaData?.b3_doencas) ? rmaData.b3_doencas : [];
  }, [rmaData?.b3_doencas]);

  const outroTexto = rmaData?.b3_doencas_outro || '';

  /**
   * Pré-carrega doenças já registradas no doc do cidadão.
   * Roda uma vez por atendimento (quando muda o cpf).
   * Só sobrescreve se o atendimento ainda NÃO tem nada marcado em b3_doencas.
   */
  const initLoadedRef = useRef(null);
  useEffect(() => {
    if (!db || !appId || !cpfLimpo || cpfLimpo.length !== 11) return;
    if (initLoadedRef.current === cpfLimpo) return;
    initLoadedRef.current = cpfLimpo;

    (async () => {
      try {
        const cidRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
        const snap = await getDoc(cidRef);
        if (!snap.exists()) return;
        const c = snap.data();
        const prevDoencas = Array.isArray(c.doencas_mentais) ? c.doencas_mentais : [];
        const prevOutro = c.doencas_mentais_outro || '';

        if (prevDoencas.length === 0 && !prevOutro) return;

        // Só hidrata se o atendimento ainda está vazio (sem doenças marcadas)
        setRmaData((prev) => {
          const jaTem =
            (Array.isArray(prev?.b3_doencas) && prev.b3_doencas.length > 0) ||
            !!prev?.b3_doencas_outro;
          if (jaTem) return prev;

          return {
            ...prev,
            b3_doencas: prevDoencas,
            b3_doencas_outro: prevOutro,
            // Se o cidadão tem histórico, sugere já marcar B.3 (técnico pode desmarcar)
            b3_doenca_mental: prev?.b3_doenca_mental ?? true,
          };
        });
      } catch (err) {
        console.warn('[RMAForm] Falha ao carregar doenças do cidadão:', err);
      }
    })();
  }, [db, appId, cpfLimpo, setRmaData]);

  /**
   * Persiste no doc do cidadão (debounced 600ms).
   * Mantém o histórico permanente independente do atendimento atual.
   */
  const persistTimerRef = useRef(null);
  const lastPersistedRef = useRef(null);
  useEffect(() => {
    if (!db || !appId || !cpfLimpo || cpfLimpo.length !== 11) return;
    // Só persiste no cidadão se B.3 estiver marcado (caso contrário, o técnico
    // pode estar só limpando o que estava antes — mantemos histórico).
    if (!rmaData?.b3_doenca_mental) return;

    const payload = {
      doencas: [...doencasSelecionadas].sort(),
      outro: (outroTexto || '').trim(),
    };
    const payloadKey = JSON.stringify(payload);
    if (lastPersistedRef.current === payloadKey) return;

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(async () => {
      try {
        const cidRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
        const crasIdFinal = crasId || atendimentoAtual?.cras_id || null;
        await setDoc(
          cidRef,
          {
            doencas_mentais: payload.doencas,
            doencas_mentais_outro: payload.outro,
            doencas_mentais_ultima_cras_id: crasIdFinal,
            doencas_mentais_atualizado_em: serverTimestamp(),
          },
          { merge: true }
        );
        lastPersistedRef.current = payloadKey;
      } catch (err) {
        console.error('[RMAForm] Erro ao salvar doenças no cidadão:', err);
      }
    }, 600);

    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [db, appId, cpfLimpo, doencasSelecionadas, outroTexto, rmaData?.b3_doenca_mental, crasId, atendimentoAtual?.cras_id]);

  const toggleDoenca = (id) => {
    setRmaData((prev) => {
      const atuais = Array.isArray(prev?.b3_doencas) ? prev.b3_doencas : [];
      const next = atuais.includes(id)
        ? atuais.filter((x) => x !== id)
        : [...atuais, id];

      // Se desmarcou "outro", limpa o texto livre
      const nextOutro = next.includes('outro') ? (prev?.b3_doencas_outro || '') : '';

      return {
        ...prev,
        b3_doencas: next,
        b3_doencas_outro: nextOutro,
      };
    });
  };

  const handleOutroChange = (e) => {
    const value = e.target.value;
    setRmaData((prev) => ({ ...prev, b3_doencas_outro: value }));
  };

  // Contador de itens marcados — feedback visual de progresso
  const totalMarcados = useMemo(() => {
    return [
      !!rmaData?.b1_drogas_ilicitas,
      !!rmaData?.b2_migrante,
      !!rmaData?.b3_doenca_mental,
    ].filter(Boolean).length;
  }, [rmaData]);

  // Validação suave: B.3 marcado mas nenhuma doença selecionada
  const b3Marcado = !!rmaData?.b3_doenca_mental;
  const semDoencaSelecionada = b3Marcado && doencasSelecionadas.length === 0;
  const outroSemTexto =
    b3Marcado && doencasSelecionadas.includes('outro') && !outroTexto.trim();

  return (
    <div className="space-y-3">
      <Card className="border-t-4 border-blue-800 shadow-sm overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks size={18} className="text-blue-800 shrink-0" />
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest leading-none">
                Bloco B — Características Específicas
              </h3>
              <p className="text-[10px] text-gray-500 mt-1 font-medium">
                Marque apenas o que for identificado neste atendimento
              </p>
            </div>
          </div>

          {/* Indicador de progresso */}
          <div
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
              totalMarcados > 0
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
          >
            {totalMarcados === 0 ? 'Nenhum marcado' : `${totalMarcados} marcado${totalMarcados > 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Banner explicativo do que esses checkboxes fazem */}
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <strong>Estes itens são contados no RMA mensal.</strong> Cada pessoa é contada{' '}
              <strong>apenas uma vez</strong> no mês, mesmo que atendida várias vezes. Se a pessoa
              precisa ir ao CadÚnico (inclusão ou atualização), use o botão <strong>"Transferir"</strong>{' '}
              — não há campo aqui para isso.
            </p>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="p-4 space-y-3 bg-gray-50/30">
          <RMACheckItem
            name="b1_drogas_ilicitas"
            checked={!!rmaData?.b1_drogas_ilicitas}
            onChange={handleChange}
            codigo="B.1"
            label="Pessoa usuária de crack ou outras drogas ilícitas"
            tooltip="Marque se a pessoa atendida é usuária de crack, cocaína, maconha ou outras drogas ilícitas. NÃO inclui álcool ou medicamentos prescritos."
          />

          <RMACheckItem
            name="b2_migrante"
            checked={!!rmaData?.b2_migrante}
            onChange={handleChange}
            codigo="B.2"
            label="Migrante"
            tooltip="Pessoa que se deslocou de seu município ou país de origem. Inclui migrantes internos (outros estados ou municípios) e estrangeiros refugiados ou em situação migratória."
          />

          <RMACheckItem
            name="b3_doenca_mental"
            checked={!!rmaData?.b3_doenca_mental}
            onChange={handleChange}
            codigo="B.3"
            label="Pessoa com doença ou transtorno mental"
            tooltip="Pessoa com diagnóstico (formal ou observado) de transtorno mental: depressão, esquizofrenia, transtorno bipolar, ansiedade severa, etc. Use seu critério técnico."
          />

          {/* === SUB-BLOCO B.3: Lista de transtornos === */}
          {b3Marcado && (
            <div className="ml-4 mt-2 border-l-4 border-blue-300 pl-4 py-3 bg-white rounded-r-lg shadow-inner animate-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={14} className="text-blue-700" />
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">
                  Especificar transtorno(s) ou doença(s)
                </span>
                {doencasSelecionadas.length > 0 && (
                  <span className="text-[9px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
                    {doencasSelecionadas.length} selecionado{doencasSelecionadas.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <p className="text-[10px] text-gray-500 italic mb-3">
                Pode marcar mais de um. O histórico fica salvo na ficha do(a) usuário(a) e
                aparece nos próximos atendimentos.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DOENCAS_OPCOES.map((d) => {
                  const checked = doencasSelecionadas.includes(d.id);
                  return (
                    <label
                      key={d.id}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${
                        checked
                          ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                          : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDoenca(d.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                      <span
                        className={`text-[11px] leading-tight ${
                          checked ? 'font-bold text-blue-900' : 'font-medium text-gray-700'
                        }`}
                      >
                        {d.label}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Campo "Outro" — só aparece se "outro" estiver marcado */}
              {doencasSelecionadas.includes('outro') && (
                <div className="mt-3 animate-in slide-in-from-top-1 duration-200">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                    Especifique qual transtorno/doença *
                  </label>
                  <input
                    type="text"
                    value={outroTexto}
                    onChange={handleOutroChange}
                    placeholder="Descreva o transtorno ou doença mental observada..."
                    className={`w-full px-3 py-2 text-sm bg-white border rounded focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${
                      outroSemTexto
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-gray-300 focus:border-blue-500'
                    }`}
                  />
                  {outroSemTexto && (
                    <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle size={11} />
                      Preencha a descrição ou desmarque "Outro"
                    </p>
                  )}
                </div>
              )}

              {/* Aviso suave: B.3 marcado sem nenhum item */}
              {semDoencaSelecionada && (
                <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800 font-medium flex items-start gap-2">
                  <AlertCircle size={12} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Você marcou B.3 mas não especificou nenhum transtorno. Selecione pelo menos um
                    item acima ou desmarque B.3 se não se aplica.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com confirmação visual */}
        {totalMarcados > 0 && (
          <div className="px-4 py-2 bg-green-50 border-t border-green-100 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-600" />
            <p className="text-[11px] text-green-800 font-medium">
              Estas informações serão salvas no RMA quando você finalizar o atendimento.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default RMAForm;

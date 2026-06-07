import React from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Section from '../ui/Section';
import Button from '../ui/Button';
import InlineAlert from '../ui/InlineAlert';
import WebcamCapture from '../ui/WebcamCapture';
import { AlertTriangle, Camera, Trash2 } from 'lucide-react';
import { formatBRDateTyping, getCountries, getForeignCities, getForeignStates, getIBGEMunicipiosByUF, normalizeDate, normalizeName, simplify } from '../../utils';

const FormularioCidadao = ({
  formData,
  handleChange,
  handleNomeBlur,
  handleCpfBlur,
  handleRegistrarAtendimento,
  handleLimparForm,
  error,
  successMsg,
  cpfBloqueadoInfo,
  cidadaoOutraUnidadeInfo,
  onCancelarOutraUnidade,
  onAceitarOutraUnidade,
  buscandoCidadao,
  registrandoAtendimento,
  nomeRegistrado,
  crasUnidades,
  tiposAtendimento,
  psicologos,
  lockCrasId
}) => {
  const [paises, setPaises] = React.useState([]);
  const [paisesLoading, setPaisesLoading] = React.useState(false);
  const [municipios, setMunicipios] = React.useState([]);
  const [municipiosLoading, setMunicipiosLoading] = React.useState(false);
  const [foreignStates, setForeignStates] = React.useState([]);
  const [foreignCities, setForeignCities] = React.useState([]);
  const [foreignStatesLoading, setForeignStatesLoading] = React.useState(false);
  const [foreignCitiesLoading, setForeignCitiesLoading] = React.useState(false);
  const [foreignApiError, setForeignApiError] = React.useState(false);
  const [showWebcam, setShowWebcam] = React.useState(false);
  const [displayUrl, setDisplayUrl] = React.useState(null);

  React.useEffect(() => {
    if (formData.foto && !formData.foto.startsWith('data:image')) {
      const separator = formData.foto.includes('?') ? '&' : '?';
      setDisplayUrl(`${formData.foto}${separator}t=${Date.now()}`);
    } else {
      setDisplayUrl(formData.foto);
    }
  }, [formData.foto]);

  const crasNomeAtual = React.useMemo(() => {
    return (crasUnidades || []).find((c) => c.id === formData.cras_id)?.nome || "";
  }, [crasUnidades, formData.cras_id]);

  const handleFotoCapture = (imgSrc) => {
    handleChange({ target: { name: 'foto', value: imgSrc } });
    setShowWebcam(false);
  };

  const handleRemoveFoto = () => {
    if (window.confirm("Tem certeza que deseja remover a foto deste cidadão?")) {
      handleChange({ target: { name: 'foto', value: null } });
    }
  };

  const isBrasileiro = React.useMemo(() => {
    const l = simplify((formData.nacionalidade || "").trim());
    if (!l) return true;
    return l === "brasil" || l.startsWith("brasileir");
  }, [formData.nacionalidade]);

  const dataNascimentoValue = React.useMemo(() => {
    return String(formData.dataNascimento || "");
  }, [formData.dataNascimento]);

  const handleDataNascimentoChange = (e) => {
    const next = formatBRDateTyping(e.target.value);
    handleChange({ target: { name: "dataNascimento", value: next } });
  };

  const handleDataNascimentoBlur = () => {
    const normalized = normalizeDate(formData.dataNascimento);
    if (normalized) {
      handleChange({ target: { name: "dataNascimento", value: normalized } });
    }
  };

  const filteredTipos = React.useMemo(() => {
    const hasPsicologos = (psicologos || []).some(p => {
      const cargo = (p.cargo || "").toLowerCase();
      return (cargo.includes("psicólog") || cargo.includes("psicolog"));
    });
    const hasAssistentes = (psicologos || []).some(p => {
      const cargo = (p.cargo || "").toLowerCase();
      return (cargo.includes("assistente")) && !(cargo.includes("psicólog") || cargo.includes("psicolog"));
    });

    return (tiposAtendimento || []).filter(t => {
      const nome = (t.nome || "").toLowerCase();
      if (nome.includes("abordagem social") || nome.includes("desconhecido") || nome.includes("servi") || nome.includes("dia")) return false;
      if ((nome.includes("psicólog") || nome.includes("psicolog")) && !hasPsicologos) return false;
      if ((nome.includes("assistente social") || nome.includes("assistente")) && !hasAssistentes) return false;
      return true;
    });
  }, [tiposAtendimento, psicologos]);

  const psicologosOnly = React.useMemo(() => {
    return (psicologos || []).filter(p => {
      const cargo = (p.cargo || "").toLowerCase();
      const nome = (p.nome || "").toLowerCase();
      return (cargo.includes("psicólog") || cargo.includes("psicolog")) && !nome.includes("desconhecido");
    });
  }, [psicologos]);

  const assistentesSociaisOnly = React.useMemo(() => {
    return (psicologos || []).filter(p => {
      const cargo = (p.cargo || "").toLowerCase();
      const nome = (p.nome || "").toLowerCase();
      return (cargo.includes("assistente")) &&
        !(cargo.includes("psicólog") || cargo.includes("psicolog")) &&
        !nome.includes("desconhecido");
    });
  }, [psicologos]);

  const getStatusLabel = React.useCallback((p) => {
    const s = simplify(p?.status);
    if (s === "online") return "Online";
    if (s === "pausa") return "Pausa";
    if (s === "ocupado") return "Ocupado";
    return "Offline";
  }, []);

  const isSelectableProf = React.useCallback((p) => simplify(p?.status) === "online", []);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPaisesLoading(true);
      try {
        const list = await getCountries();
        if (!cancelled) setPaises(list);
      } finally {
        if (!cancelled) setPaisesLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const uf = String(formData.uf || "").trim().toUpperCase();
    const run = async () => {
      if (!isBrasileiro || !uf) { setMunicipios([]); return; }
      setMunicipiosLoading(true);
      try {
        const list = await getIBGEMunicipiosByUF(uf);
        if (!cancelled) setMunicipios(list);
      } finally {
        if (!cancelled) setMunicipiosLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [formData.uf, isBrasileiro]);

  React.useEffect(() => {
    let cancelled = false;
    const country = String(formData.nacionalidade || "").trim();
    const run = async () => {
      if (isBrasileiro || !country) {
        setForeignStates([]); setForeignCities([]); setForeignApiError(false);
        setForeignStatesLoading(false); setForeignCitiesLoading(false); return;
      }
      setForeignApiError(false); setForeignStatesLoading(true);
      try {
        const list = await getForeignStates(country);
        if (!cancelled) setForeignStates(list);
      } catch {
        if (!cancelled) setForeignApiError(true);
      } finally {
        if (!cancelled) setForeignStatesLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [formData.nacionalidade, isBrasileiro]);

  React.useEffect(() => {
    let cancelled = false;
    const country = String(formData.nacionalidade || "").trim();
    const state = String(formData.uf || "").trim();
    const run = async () => {
      if (isBrasileiro || !country || foreignApiError) { setForeignCities([]); setForeignCitiesLoading(false); return; }
      setForeignCitiesLoading(true);
      try {
        const list = await getForeignCities(country, state);
        if (!cancelled) setForeignCities(list);
      } catch {
        if (!cancelled) setForeignCities([]);
      } finally {
        if (!cancelled) setForeignCitiesLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [formData.nacionalidade, formData.uf, isBrasileiro, foreignApiError]);

  const handleNacionalidadeChange = (e) => {
    handleChange(e);
    const next = e.target.value;
    const l = simplify((next || "").trim());
    const brasil = !l || l === "brasil" || l.startsWith("brasileir");
    if (!brasil) {
      handleChange({ target: { name: "naturalidadeIbgeId", value: "" } });
      handleChange({ target: { name: "uf", value: "" } });
      handleChange({ target: { name: "naturalidade", value: "" } });
    } else {
      handleChange({ target: { name: "uf", value: "" } });
      handleChange({ target: { name: "naturalidade", value: "" } });
      handleChange({ target: { name: "naturalidadeIbgeId", value: "" } });
    }
  };

  const handleUfChange = (e) => {
    handleChange(e);
    if (isBrasileiro) {
      handleChange({ target: { name: "naturalidade", value: "" } });
      handleChange({ target: { name: "naturalidadeIbgeId", value: "" } });
    }
  };

  const handleForeignStateChange = (e) => {
    handleChange(e);
    handleChange({ target: { name: "naturalidade", value: "" } });
    handleChange({ target: { name: "naturalidadeIbgeId", value: "" } });
  };

  const handleForeignCityChange = (e) => {
    handleChange(e);
    handleChange({ target: { name: "naturalidadeIbgeId", value: "" } });
  };

  const handleNaturalidadeChange = (e) => {
    handleChange(e);
    const uf = String(formData.uf || "").trim().toUpperCase();
    const nome = String(e.target.value || "").trim();
    if (!uf || !nome || !Array.isArray(municipios) || municipios.length === 0) {
      handleChange({ target: { name: "naturalidadeIbgeId", value: "" } });
      return;
    }
    const found = municipios.find((m) => String(m?.nome || "").trim() === nome) || null;
    handleChange({ target: { name: "naturalidadeIbgeId", value: found?.id ? String(found.id) : "" } });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (typeof handleRegistrarAtendimento === 'function') {
      handleRegistrarAtendimento(e);
    }
  };

  return (
    <Card className="lg:col-span-2 p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Recepção – Registrar Atendimento
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Foto */}
        <Section title="Foto do Cidadão" description="Captura de imagem para identificação">
          {showWebcam ? (
            <WebcamCapture
              onCapture={handleFotoCapture}
              onCancel={() => setShowWebcam(false)}
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden relative group">
                {displayUrl ? (
                  <>
                    <img
                      src={displayUrl}
                      alt="Foto do cidadão"
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.classList.add('image-load-error');
                      }}
                    />
                    <div className="hidden image-load-error:flex absolute inset-0 items-center justify-center text-red-400">
                      <Camera size={40} />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFoto}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                      title="Remover foto"
                    >
                      <Trash2 size={24} />
                    </button>
                  </>
                ) : (
                  <Camera size={40} className="text-gray-400" />
                )}
              </div>
              {!displayUrl && (
                <Button type="button" onClick={() => setShowWebcam(true)} variant="outline" icon={Camera} size="sm">
                  Tirar Foto
                </Button>
              )}
            </div>
          )}
        </Section>

        {/* Identificação */}
        <Section title="Identificação" description="Dados básicos do cidadão">
          {/* Nome completo */}
          <Input
            label={<span>Nome completo <span className="text-red-500">*</span></span>}
            id="campoNomeVisual"
            name="nome"
            value={formData.nome}
            onChange={handleChange}
            onBlur={handleNomeBlur}
            autoComplete="name"
            placeholder="Nome do cidadão"
            className={!formData.nome ? 'border-red-300 bg-red-50' : ''}
          />

          {/* ─── NOME SOCIAL (novo campo) ─── */}
          <div>
            <Input
              label={
                <span className="flex items-center gap-1.5">
                  Nome Social
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    Chamado na TV
                  </span>
                </span>
              }
              name="nomeSocial"
              value={formData.nomeSocial}
              onChange={handleChange}
              placeholder="Nome pelo qual prefere ser chamado(a)"
            />
            <p className="mt-1 text-[11px] text-gray-500 italic leading-tight">
              Se preenchido, este nome será exibido e anunciado no painel de TV em vez do nome completo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label={<span>CPF <span className="text-red-500">*</span></span>}
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                onBlur={handleCpfBlur}
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                className={!formData.cpf ? 'border-red-300 bg-red-50' : ''}
              />
              {buscandoCidadao && (
                <p className="mt-1 text-xs text-gray-500">Buscando cadastro pelo CPF...</p>
              )}
              {cpfBloqueadoInfo && (
                <div className="mt-2 rounded-md border border-red-300 bg-red-50 p-2">
                  <div className="text-xs font-semibold text-red-800">MOTIVO DE DESLIGAMENTO</div>
                  <div className="mt-1 text-sm text-red-700">
                    {cpfBloqueadoInfo.motivoDesligamento || "Este CPF está desligado do serviço."}
                  </div>
                  {cpfBloqueadoInfo.dataDesligamento && (
                    <div className="mt-1 text-xs text-red-600">
                      Data do desligamento: {cpfBloqueadoInfo.dataDesligamento}
                    </div>
                  )}
                </div>
              )}

              {cidadaoOutraUnidadeInfo && (
                <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4">
                  <p className="font-bold text-amber-800 text-sm flex items-center gap-2">
                    <AlertTriangle size={16} />
                    CPF cadastrado em outra unidade
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Este cidadão está registrado no{' '}
                    <strong>{cidadaoOutraUnidadeInfo.origemNome}</strong>. Você selecionou{' '}
                    <strong>{cidadaoOutraUnidadeInfo.destinoNome}</strong>.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={onCancelarOutraUnidade}
                      className="px-3 py-1.5 text-xs font-bold rounded border border-amber-400 text-amber-800 hover:bg-amber-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={onAceitarOutraUnidade}
                      className="px-3 py-1.5 text-xs font-bold rounded bg-amber-600 text-white hover:bg-amber-700"
                    >
                      Preencher mesmo assim
                    </button>
                  </div>
                </div>
              )}
            </div>
            <Input label="RG" name="rg" value={formData.rg} onChange={handleChange} placeholder="RG" />
          </div>
          <Input
            label={<span>Data de Nascimento <span className="text-red-500">*</span></span>}
            name="dataNascimento"
            value={dataNascimentoValue}
            onChange={handleDataNascimentoChange}
            onBlur={handleDataNascimentoBlur}
            inputMode="numeric"
            placeholder="DD/MM/AAAA"
            maxLength={10}
            className={!dataNascimentoValue ? 'border-red-300 bg-red-50' : ''}
          />
          <Input label="Nome da Mãe" name="nomeMae" value={formData.nomeMae} onChange={handleChange} />
          <Input label="Nome do Pai" name="nomePai" value={formData.nomePai} onChange={handleChange} />
        </Section>

        {/* Localização */}
        <Section title="Localização" description="Endereço e origem">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label={<span>Nacionalidade <span className="text-red-500">*</span></span>} name="nacionalidade" value={formData.nacionalidade} onChange={handleNacionalidadeChange} className={!formData.nacionalidade ? 'border-red-300 bg-red-50' : ''}>
              <option value="Brasileira">Brasileira</option>
              {paisesLoading && <option value="" disabled>Carregando países...</option>}
              {paises.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>

            <div className="w-full">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                UF {isBrasileiro ? "(Estado)" : "(Estado/Província)"} <span className="text-red-500">*</span>
              </label>
              {isBrasileiro ? (
                <Select name="uf" value={formData.uf} onChange={handleUfChange} className={!formData.uf ? 'border-red-300 bg-red-50' : ''}>
                  <option value="">Selecione</option>
                  {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </Select>
              ) : foreignApiError ? (
                <Input name="uf" value={formData.uf} onChange={handleUfChange} className={!formData.uf ? 'border-red-300 bg-red-50' : ''} placeholder="Digite o estado/província" />
              ) : foreignStates.length > 0 ? (
                <Select name="uf" value={formData.uf} onChange={handleForeignStateChange} disabled={foreignStatesLoading} className={!formData.uf ? 'border-red-300 bg-red-50' : ''}>
                  <option value="">{foreignStatesLoading ? "Carregando estados..." : "Selecione o estado/província"}</option>
                  {formData.uf && !foreignStates.some((s) => String(s || "").trim() === String(formData.uf || "").trim()) && (
                    <option value={formData.uf}>{formData.uf}</option>
                  )}
                  {foreignStates.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              ) : (
                <Input name="uf" value={formData.uf} onChange={handleUfChange} className={!formData.uf ? 'border-red-300 bg-red-50' : ''} placeholder={foreignStatesLoading ? "Carregando estados..." : "Digite o estado/província"} />
              )}
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Naturalidade {isBrasileiro ? "(Cidade)" : "(Cidade de Origem)"} <span className="text-red-500">*</span>
              </label>
              {isBrasileiro ? (
                <Select name="naturalidade" value={formData.naturalidade} onChange={handleNaturalidadeChange} disabled={!formData.uf} className={!formData.naturalidade ? 'border-red-300 bg-red-50' : ''}>
                  <option value="">{formData.uf ? "Selecione a cidade" : "Selecione a UF primeiro"}</option>
                  {municipiosLoading && <option value="" disabled>Carregando cidades...</option>}
                  {!municipiosLoading && formData.naturalidade && formData.uf && Array.isArray(municipios) && !municipios.some((m) => String(m?.nome || "").trim() === String(formData.naturalidade || "").trim()) && (
                    <option value={formData.naturalidade}>{formData.naturalidade}</option>
                  )}
                  {municipios.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                </Select>
              ) : foreignApiError ? (
                <Input name="naturalidade" value={formData.naturalidade} onChange={handleChange} className={!formData.naturalidade ? 'border-red-300 bg-red-50' : ''} placeholder="Digite a cidade de origem" />
              ) : foreignCities.length > 0 ? (
                <Select name="naturalidade" value={formData.naturalidade} onChange={handleForeignCityChange} disabled={foreignCitiesLoading} className={!formData.naturalidade ? 'border-red-300 bg-red-50' : ''}>
                  <option value="">{foreignCitiesLoading ? "Carregando cidades..." : "Selecione a cidade"}</option>
                  {formData.naturalidade && !foreignCities.some((c) => String(c || "").trim() === String(formData.naturalidade || "").trim()) && (
                    <option value={formData.naturalidade}>{formData.naturalidade}</option>
                  )}
                  {foreignCities.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              ) : (
                <Input name="naturalidade" value={formData.naturalidade} onChange={handleChange} className={!formData.naturalidade ? 'border-red-300 bg-red-50' : ''} placeholder={foreignCitiesLoading ? "Carregando cidades..." : "Digite a cidade de origem"} />
              )}
            </div>
          </div>

          <Input
            label="Técnico Responsável"
            name="tecnicoResponsavel"
            value={formData.tecnicoResponsavel}
            onChange={handleChange}
            placeholder="Nome do técnico responsável"
            className="mt-4"
          />
        </Section>

        {/* Atendimento */}
        <Section title="Atendimento" description="Dados do atendimento">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lockCrasId ? (
              <Input
                label="Centro Pop"
                value={crasNomeAtual || "Centro Pop"}
                disabled
              />
            ) : (
              <Select label="Centro Pop" name="cras_id" value={formData.cras_id} onChange={handleChange} required>
                <option value="">Selecione</option>
                {crasUnidades.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            )}
            <Select label="Tipo de atendimento" name="tipo_atendimento_id" value={formData.tipo_atendimento_id} onChange={handleChange} required>
              <option value="">Selecione</option>
              <optgroup label="Tipos Gerais">
                {filteredTipos.map((t) => (
                  <option key={t.id} value={t.id}>{normalizeName(t.nome)}</option>
                ))}
              </optgroup>
              {psicologosOnly.length > 0 && (
                <optgroup label="Psicólogos">
                  {psicologosOnly.map((p) => (
                    <option key={p.id} value={`prof_${p.id}`} disabled={!isSelectableProf(p)}>
                      {normalizeName(p.nome)} ({p.cargo}) — {getStatusLabel(p)}
                    </option>
                  ))}
                </optgroup>
              )}
              {assistentesSociaisOnly.length > 0 && (
                <optgroup label="Assistentes Sociais">
                  {assistentesSociaisOnly.map((p) => (
                    <option key={p.id} value={`prof_${p.id}`} disabled={!isSelectableProf(p)}>
                      {normalizeName(p.nome)} ({p.cargo}) — {getStatusLabel(p)}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </div>
          <div className="mt-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="prioridade"
                checked={formData.prioridade || false}
                onChange={(e) => handleChange({ target: { name: 'prioridade', value: e.target.checked } })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Atendimento Prioritário</span>
            </label>
          </div>
        </Section>

        {error && <InlineAlert variant="error">{error}</InlineAlert>}

        <div className="flex gap-2 pt-4">
          <Button
            type="submit"
            disabled={registrandoAtendimento || !!cpfBloqueadoInfo}
            className="flex-1 py-3 text-lg shadow-md"
            aria-label={registrandoAtendimento ? "Salvando" : "Registrar atendimento na fila"}
          >
            {registrandoAtendimento ? "Salvando..." : "Registrar atendimento"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleLimparForm}
            disabled={registrandoAtendimento}
            className="px-6"
            aria-label="Limpar formulário"
          >
            Limpar
          </Button>
        </div>
      </form>

      {nomeRegistrado && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center animate-fadeIn">
          <p className="text-sm text-green-700 mb-1">Atendimento registrado com sucesso para:</p>
          <p className="text-3xl font-bold text-green-800">{normalizeName(nomeRegistrado)}</p>
          {successMsg && <div className="mt-3 text-xs text-green-700">{successMsg}</div>}
        </div>
      )}
    </Card>
  );
};

export default FormularioCidadao;

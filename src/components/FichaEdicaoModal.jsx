import React, { useState, useEffect } from 'react';
import { X, Save, Search, User, Calendar, Hash, BookOpen, Heart, Phone, Users, ArrowRight, AlertTriangle, FileText } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { normalizeDate, validateCPF, normalizeRole } from '../utils';
import Button from './ui/Button';

const opcoesOrigem = [
  "ABORDAGEM SOCIAL", "AÇÃO MINISTÉRIO PÚBLICO", "BUSCA ATIVA", "CAPS", "CASA DA MULHER",
  "CENTRO POP COHAB", "CMAS/SL", "COMUNIDADE TERAPÊUTICA FLORESCER", "CONSULTÓRIO DE RUA",
  "CRAS", "DEFENSORIA PÚBLICA DO MARANHÃO", "ESPONTÂNEA", "GUARDA MUNICIPAL", "INSS", "OUTROS"
];

const precisaEspecificar = (val) => {
  if (!val) return false;
  const v = val.toUpperCase();
  return v === "CAPS" || v === "CRAS" || v === "OUTROS";
};

const InputField = ({ label, name, value, onChange, placeholder, type = "text", icon: Icon, className = "", ...props }) => (
  <div className={`flex flex-col ${className}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
      {Icon && <Icon size={12} className="text-blue-500" />}
      {label}
    </label>
    <input
      type={type}
      name={name}
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-medium placeholder:text-gray-400"
      {...props}
    />
  </div>
);

const SelectField = ({ label, name, value, onChange, icon: Icon, children, className = "" }) => (
  <div className={`flex flex-col ${className}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
      {Icon && <Icon size={12} className="text-blue-500" />}
      {label}
    </label>
    <select
      name={name}
      value={value ?? ""}
      onChange={onChange}
      className="w-full px-3 py-2.5 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-medium cursor-pointer"
    >
      {children}
    </select>
  </div>
);

const FichaEdicaoModal = ({ usuario, dadosCompletos, onSave, onClose }) => {
  const { db, appId, userProfile } = useAuth();
  const roleNorm = userProfile?.roleNorm || normalizeRole(userProfile?.role || userProfile?.cargo);
  const podeEditarFicha = ["psicologo", "assistente_social", "admin", "coordenador", "superintendente", "master", "super_admin"].includes(roleNorm);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);

  const normalizeDateForInput = (val) => {
    if (!val) return '';
    if (val?.toDate) {
      try {
        const d = val.toDate();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      } catch { return ''; }
    }
    if (typeof val === 'string' && val.includes('/')) return val;
    if (typeof val === 'string' && val.includes('-')) {
      const p = val.split('T')[0].split('-');
      if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    }
    return String(val || '');
  };

  useEffect(() => {
    const d = dadosCompletos || {};
    let origem = d.origemDemanda || '';
    let espec = d.origemDemandaEspecificar || '';
    if (origem && !espec) {
      for (const p of ["CAPS", "CRAS", "OUTROS"]) {
        if (origem.toUpperCase().startsWith(p) && origem.length > p.length) {
          const resto = origem.substring(p.length).replace(/^[:\s-]+/, '').trim();
          if (resto) { origem = p; espec = resto; }
        }
      }
    }
    setFormData({
      nome: usuario?.nome || '',
      nomeSocial: d.nomeSocial || '',
      rg: d.rg || '',
      tituloEleitor: d.tituloEleitor || '',
      tituloEleitorZona: d.tituloEleitorZona || '',
      tituloEleitorSecao: d.tituloEleitorSecao || '',
      sexo: d.sexo || '',
      cor: d.cor || '',
      dataNascimento: normalizeDateForInput(d.dataNascimento),
      nis: d.nis || '',
      conjuge: d.conjuge || '',
      origemDemanda: origem,
      origemDemandaEspecificar: espec,
      estudando: d.estudando || 'nao',
      estudandoDescricao: d.estudandoDescricao || '',
      tratamentoSaude: d.tratamentoSaude || 'nao',
      tratamentoSaudeDescricao: d.tratamentoSaudeDescricao || '',
      refFamiliarNome: d.refFamiliarNome || '',
      refFamiliarTelefone: d.refFamiliarTelefone || '',
      refFamiliarCep: d.refFamiliarCep || '',
      refFamiliarEndereco: d.refFamiliarEndereco || '',
      presoOuDetido: d.presoOuDetido || 'nao',
      processoJustica: d.processoJustica || 'nao',
      interesseCurso: d.interesseCurso || 'nao',
      interesseCursoQual: d.interesseCursoQual || '',
      habilidadesProfissionais: d.habilidadesProfissionais || '',
      escolaridade: d.escolaridade || '',
      religiao: d.religiao || '',
      orientacaoSexual: d.orientacaoSexual || '',
      telefone: d.telefone || '',
      tecnicoResponsavel: d.tecnicoResponsavel || '',
      nomeMae: d.nomeMae || '',
      nomePai: d.nomePai || '',
      naturalidade: d.naturalidade || '',
      uf: d.uf || '',
      nacionalidade: d.nacionalidade || '',
      b1_drogas_ilicitas: d.b1_drogas_ilicitas || '',
      b2_migrante: d.b2_migrante || '',
      b3_doenca_mental: d.b3_doenca_mental || '',
    });
  }, [usuario, dadosCompletos]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'dataNascimento') {
      let v = value.replace(/\D/g, '');
      if (v.length > 8) v = v.substring(0, 8);
      if (v.length > 4) v = v.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
      else if (v.length > 2) v = v.replace(/(\d{2})(\d{1,2})/, '$1/$2');
      setFormData(prev => ({ ...prev, [name]: v }));
      return;
    }
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'origemDemanda' && !precisaEspecificar(value)) next.origemDemandaEspecificar = '';
      return next;
    });
  };

  const consultarCep = async () => {
    const cep = (formData.refFamiliarCep || '').replace(/\D/g, '');
    if (cep.length !== 8) { alert("CEP inválido. Digite 8 números."); return; }
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) alert("CEP não encontrado.");
      else setFormData(prev => ({ ...prev, refFamiliarEndereco: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}` }));
    } catch { alert("Erro ao consultar CEP."); }
  };

  const handleSave = async () => {
    if (!db || !appId || !usuario?.cpf) return;
    if (!podeEditarFicha) {
      alert("Você não tem permissão para editar esta ficha.");
      return;
    }
    if (precisaEspecificar(formData.origemDemanda) && !formData.origemDemandaEspecificar?.trim()) {
      alert(`Preencha a especificação para: ${formData.origemDemanda}`);
      return;
    }
    
    // Validação de CPF antes de salvar
    const cpfLimpo = String(usuario.cpf || '').replace(/\D/g, '');
    if (!validateCPF(cpfLimpo)) {
      alert("CPF inválido. Verifique os números digitados.");
      return;
    }
    
    // Validação de nome (não pode estar vazio ou ser inválido)
    const nomeValido = (formData.nome || '').trim();
    if (!nomeValido || nomeValido.length < 3) {
      alert("Nome inválido. Digite um nome com pelo menos 3 caracteres.");
      return;
    }

    const normalizedDataNascimento = formData.dataNascimento
      ? normalizeDate(formData.dataNascimento)
      : null;
    if (formData.dataNascimento && !normalizedDataNascimento) {
      alert("Data de nascimento inválida. Use o formato DD/MM/AAAA.");
      return;
    }
    
    setLoading(true);
    try {
      const cidadaoUpdates = {
        nome: formData.nome?.trim() || usuario.nome,
        nomeSocial: formData.nomeSocial || null,
        rg: formData.rg || null,
        tituloEleitor: formData.tituloEleitor || null,
        tituloEleitorZona: formData.tituloEleitorZona || null,
        tituloEleitorSecao: formData.tituloEleitorSecao || null,
        sexo: formData.sexo || null,
        cor: formData.cor || null,
        dataNascimento: normalizedDataNascimento,
        nis: formData.nis || null,
        conjuge: formData.conjuge || null,
        origemDemanda: formData.origemDemanda || null,
        origemDemandaEspecificar: formData.origemDemandaEspecificar || null,
        estudando: formData.estudando || 'nao',
        estudandoDescricao: formData.estudandoDescricao || null,
        tratamentoSaude: formData.tratamentoSaude || 'nao',
        tratamentoSaudeDescricao: formData.tratamentoSaudeDescricao || null,
        refFamiliarNome: formData.refFamiliarNome || null,
        refFamiliarTelefone: formData.refFamiliarTelefone || null,
        refFamiliarCep: formData.refFamiliarCep || null,
        refFamiliarEndereco: formData.refFamiliarEndereco || null,
        presoOuDetido: formData.presoOuDetido || 'nao',
        processoJustica: formData.processoJustica || 'nao',
        interesseCurso: formData.interesseCurso || 'nao',
        interesseCursoQual: formData.interesseCursoQual || null,
        habilidadesProfissionais: formData.habilidadesProfissionais || null,
        escolaridade: formData.escolaridade || null,
        religiao: formData.religiao || null,
        orientacaoSexual: formData.orientacaoSexual || null,
        telefone: formData.telefone || null,
        tecnicoResponsavel: formData.tecnicoResponsavel || null,
        nomeMae: formData.nomeMae || null,
        nomePai: formData.nomePai || null,
        naturalidade: formData.naturalidade || null,
        uf: formData.uf || null,
        nacionalidade: formData.nacionalidade || null,
        b1_drogas_ilicitas: formData.b1_drogas_ilicitas || null,
        b2_migrante: formData.b2_migrante || null,
        b3_doenca_mental: formData.b3_doenca_mental || null,
      };
      if (precisaEspecificar(formData.origemDemanda) && formData.origemDemandaEspecificar) {
        cidadaoUpdates.origemDemandaCompleta = `${formData.origemDemanda}: ${formData.origemDemandaEspecificar}`;
      } else {
        cidadaoUpdates.origemDemandaCompleta = formData.origemDemanda;
      }
      const ref = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
      await setDoc(ref, cidadaoUpdates, { merge: true });
      onSave?.({ ...usuario, nome: cidadaoUpdates.nome, dadosCidadao: { ...(usuario.dadosCidadao || {}), ...cidadaoUpdates } });
      onClose?.();
    } catch (err) {
      console.error("Erro ao salvar ficha:", err);
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-blue-50 rounded-t-xl">
          <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
            <FileText size={20} className="text-blue-600" />
            Editar Ficha do Usuário
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full p-1">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Identificação */}
          <div>
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><User size={14} /> Identificação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InputField label="Nome" name="nome" value={formData.nome} onChange={handleChange} placeholder="Nome completo" icon={User} />
              <InputField label="Nome Social" name="nomeSocial" value={formData.nomeSocial} onChange={handleChange} placeholder="Nome social" />
              <InputField label="RG" name="rg" value={formData.rg} onChange={handleChange} placeholder="RG" icon={Hash} />
              <InputField label="Data Nasc." name="dataNascimento" value={formData.dataNascimento} onChange={handleChange} placeholder="DD/MM/AAAA" icon={Calendar} />
              <InputField label="Nome da Mãe" name="nomeMae" value={formData.nomeMae} onChange={handleChange} placeholder="Nome da mãe" />
              <InputField label="Nome do Pai" name="nomePai" value={formData.nomePai} onChange={handleChange} placeholder="Nome do pai" />
              <InputField label="Naturalidade" name="naturalidade" value={formData.naturalidade} onChange={handleChange} placeholder="Cidade" />
              <InputField label="UF" name="uf" value={formData.uf} onChange={handleChange} placeholder="UF" />
              <InputField label="Nacionalidade" name="nacionalidade" value={formData.nacionalidade} onChange={handleChange} placeholder="Nacionalidade" />
            </div>
          </div>

          {/* Documentos e Dados Pessoais */}
          <div>
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><FileText size={14} /> Documentos e Dados Pessoais</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InputField label="Título Eleitor" name="tituloEleitor" value={formData.tituloEleitor} onChange={handleChange} placeholder="Nº" />
              <InputField label="Zona" name="tituloEleitorZona" value={formData.tituloEleitorZona} onChange={handleChange} placeholder="Zona" />
              <InputField label="Seção" name="tituloEleitorSecao" value={formData.tituloEleitorSecao} onChange={handleChange} placeholder="Seção" />
              <InputField label="NIS" name="nis" value={formData.nis} onChange={handleChange} placeholder="NIS" icon={Hash} />
              <SelectField label="Sexo" name="sexo" value={formData.sexo} onChange={handleChange} icon={User}>
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="Outro">Outro</option>
              </SelectField>
              <SelectField label="Cor/Raça" name="cor" value={formData.cor} onChange={handleChange} icon={User}>
                <option value="">Selecione</option>
                <option value="Branca">Branca</option>
                <option value="Preta">Preta</option>
                <option value="Parda">Parda</option>
                <option value="Amarela">Amarela</option>
                <option value="Indigena">Indígena</option>
              </SelectField>
              <SelectField label="Escolaridade" name="escolaridade" value={formData.escolaridade} onChange={handleChange} icon={BookOpen}>
                <option value="">Selecione</option>
                <option value="Analfabeto">Analfabeto</option>
                <option value="Fundamental Incompleto">Fund. Incompleto</option>
                <option value="Fundamental Completo">Fund. Completo</option>
                <option value="Medio Incompleto">Médio Incompleto</option>
                <option value="Medio Completo">Médio Completo</option>
                <option value="Superior Incompleto">Sup. Incompleto</option>
                <option value="Superior Completo">Sup. Completo</option>
                <option value="Pos Graduacao">Pós-graduação</option>
              </SelectField>
              <SelectField label="Religião" name="religiao" value={formData.religiao} onChange={handleChange} icon={Heart}>
                <option value="">Selecione</option>
                <option value="Catolica">Católica</option>
                <option value="Evangelica">Evangélica</option>
                <option value="Espirita">Espírita</option>
                <option value="Matriz Africana">Matriz Africana</option>
                <option value="Sem Religiao">Sem Religião</option>
                <option value="Outras">Outras</option>
              </SelectField>
              <SelectField label="Orient. Sexual" name="orientacaoSexual" value={formData.orientacaoSexual} onChange={handleChange}>
                <option value="">Selecione</option>
                <option value="Heterossexual">Heterossexual</option>
                <option value="Homossexual">Homossexual</option>
                <option value="Bissexual">Bissexual</option>
                <option value="Outros">Outros</option>
              </SelectField>
              <InputField label="Telefone" name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(00) 00000-0000" icon={Phone} />
              <InputField label="Cônjuge" name="conjuge" value={formData.conjuge} onChange={handleChange} placeholder="Nome do cônjuge" icon={Users} />
              <InputField label="Téc. Responsável" name="tecnicoResponsavel" value={formData.tecnicoResponsavel} onChange={handleChange} placeholder="Técnico responsável" />
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <SelectField label="Origem da Demanda" name="origemDemanda" value={formData.origemDemanda} onChange={handleChange} icon={ArrowRight}>
                <option value="">Selecione</option>
                {opcoesOrigem.map(op => <option key={op} value={op}>{op}</option>)}
              </SelectField>
              {precisaEspecificar(formData.origemDemanda) && (
                <InputField label={`Especificar ${formData.origemDemanda}`} name="origemDemandaEspecificar" value={formData.origemDemandaEspecificar} onChange={handleChange} placeholder="Especificar..." required />
              )}
            </div>
          </div>

          {/* Educação e Trabalho */}
          <div className="bg-blue-50/50 p-4 rounded-lg">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><BookOpen size={14} /> Educação e Trabalho</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SelectField label="Está Estudando?" name="estudando" value={formData.estudando} onChange={handleChange}>
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </SelectField>
              {formData.estudando === 'sim' && <InputField label="O que estuda?" name="estudandoDescricao" value={formData.estudandoDescricao} onChange={handleChange} placeholder="Série/Curso/Escola" />}
              <SelectField label="Interesse em Curso?" name="interesseCurso" value={formData.interesseCurso} onChange={handleChange}>
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </SelectField>
              {formData.interesseCurso === 'sim' && <InputField label="Qual curso?" name="interesseCursoQual" value={formData.interesseCursoQual} onChange={handleChange} placeholder="Área de interesse" />}
              <div className="md:col-span-2">
                <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Habilidades Profissionais</label>
                <textarea name="habilidadesProfissionais" value={formData.habilidadesProfissionais} onChange={handleChange} placeholder="Ex: Pedreiro, Pintor, Costura..." className="w-full px-3 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none h-20" />
              </div>
            </div>
          </div>

          {/* Saúde e Justiça */}
          <div className="bg-red-50/30 p-4 rounded-lg">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><AlertTriangle size={14} /> Saúde e Justiça</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SelectField label="Tratamento Saúde?" name="tratamentoSaude" value={formData.tratamentoSaude} onChange={handleChange}>
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </SelectField>
              {formData.tratamentoSaude === 'sim' && <InputField label="Qual tratamento?" name="tratamentoSaudeDescricao" value={formData.tratamentoSaudeDescricao} onChange={handleChange} placeholder="Descreva..." />}
              <SelectField label="Já foi Preso/Detido?" name="presoOuDetido" value={formData.presoOuDetido} onChange={handleChange}>
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </SelectField>
              <SelectField label="Processo na Justiça?" name="processoJustica" value={formData.processoJustica} onChange={handleChange}>
                <option value="nao">Não</option>
                <option value="sim">Sim</option>
              </SelectField>
            </div>
          </div>

          {/* Referência Familiar */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14} /> Referência Familiar</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InputField label="Nome da Referência" name="refFamiliarNome" value={formData.refFamiliarNome} onChange={handleChange} placeholder="Nome completo" icon={User} />
              <InputField label="Telefone Referência" name="refFamiliarTelefone" value={formData.refFamiliarTelefone} onChange={handleChange} placeholder="(00) 00000-0000" icon={Phone} />
              <div>
                <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">CEP</label>
                <div className="flex gap-2">
                  <input type="text" name="refFamiliarCep" value={formData.refFamiliarCep} onChange={handleChange} placeholder="00000-000" className="flex-1 px-3 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none text-sm" />
                  <button type="button" onClick={consultarCep} className="px-3 py-2.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 flex items-center gap-1" title="Buscar CEP"><Search size={16} /></button>
                </div>
              </div>
              <InputField label="Endereço Completo" name="refFamiliarEndereco" value={formData.refFamiliarEndereco} onChange={handleChange} placeholder="Rua, Número, Bairro, Cidade - UF" icon={ArrowRight} />
            </div>
          </div>

          {/* RMA (opcional) */}
          <div>
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">RMA - Dados Sensíveis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InputField label="B1 Drogas Ilícitas" name="b1_drogas_ilicitas" value={formData.b1_drogas_ilicitas} onChange={handleChange} placeholder="Se aplicável" />
              <InputField label="B2 Migrante" name="b2_migrante" value={formData.b2_migrante} onChange={handleChange} placeholder="Se aplicável" />
              <InputField label="B3 Doença Mental" name="b3_doenca_mental" value={formData.b3_doenca_mental} onChange={handleChange} placeholder="Se aplicável" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <Button onClick={onClose} className="bg-gray-200 text-gray-800 hover:bg-gray-300">Cancelar</Button>
          <Button onClick={handleSave} isLoading={loading} icon={Save} className="bg-blue-600 hover:bg-blue-700 text-white">
            Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FichaEdicaoModal;

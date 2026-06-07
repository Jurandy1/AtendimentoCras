import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { validateCPF } from '../../utils/helpers';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { 
  Save, UserCog, ChevronDown, ChevronUp, FileText, User, Calendar, 
  Hash, BookOpen, Heart, Phone, Users, ArrowRight, AlertTriangle, Trash2, Search
} from 'lucide-react';

// Componentes de estilo (Inline para evitar dependência externa)
const InputField = ({ label, placeholder, required, type = "text", helperText, icon: Icon, className = "", ...props }) => (
  <div className={`flex flex-col ${className}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
      {Icon && <Icon size={12} className="text-blue-500" />}
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative group">
      <input 
        type={type} 
        className="w-full px-3 py-2.5 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-medium placeholder:text-gray-400 transition-all duration-200 shadow-sm" 
        placeholder={placeholder} 
        {...props} 
      />
    </div>
    {helperText && <span className="mt-1 text-[9px] text-blue-600 font-bold italic leading-tight">{helperText}</span>}
  </div>
);

const SelectField = ({ label, options, required, className = "", icon: Icon, children, value, ...props }) => (
  <div className={`flex flex-col ${className}`}>
    <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
      {Icon && <Icon size={12} className="text-blue-500" />}
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative group">
      <select 
        value={value ?? ""}
        className="w-full px-3 py-2.5 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-medium cursor-pointer appearance-none transition-all duration-200 shadow-sm pr-8" 
        {...props}
      >
        {children}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors"><ChevronDown size={14} /></div>
    </div>
  </div>
);

const DadosComplementares = forwardRef(({ atendimentoAtual, onSaveSuccess, onDirtyChange }, ref) => {
  const { db, appId } = useAuth();
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  const [formData, setFormData] = useState({
    tituloEleitor: '',
    tituloEleitorZona: '',
    tituloEleitorSecao: '',
    escolaridade: '',
    religiao: '',
    orientacaoSexual: '',
    telefone: '',
    sexo: '',
    cor: '',
    dataNascimento: '',
    nis: '',
    conjuge: '',
    origemDemanda: '',
    origemDemandaEspecificar: '',
    estudando: 'nao',
    estudandoDescricao: '',
    tratamentoSaude: 'nao',
    tratamentoSaudeDescricao: '',
    refFamiliarNome: '',
    refFamiliarTelefone: '',
    refFamiliarCep: '',
    refFamiliarEndereco: '',
    presoOuDetido: 'nao',
    processoJustica: 'nao',
    interesseCurso: 'nao',
    interesseCursoQual: '',
    habilidadesProfissionais: ''
  });

  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  
  const originalDataRef = useRef(null);

  const opcoesOrigem = [
    "ABORDAGEM SOCIAL",
    "AÇÃO MINISTÉRIO PÚBLICO",
    "BUSCA ATIVA",
    "CAPS",
    "CASA DA MULHER",
    "CENTRO POP COHAB",
    "CMAS/SL",
    "COMUNIDADE TERAPÊUTICA FLORESCER",
    "CONSULTÓRIO DE RUA",
    "CRAS",
    "DEFENSORIA PÚBLICA DO MARANHÃO",
    "ESPONTÂNEA",
    "GUARDA MUNICIPAL",
    "INSS",
    "OUTROS"
  ];

  const precisaEspecificar = (val) => {
      if (!val) return false;
      const v = val.toUpperCase();
      return v === "CAPS" || v === "CRAS" || v === "OUTROS";
  };

  const normalizeDateForInput = (val) => {
    if (!val) return '';
    if (val && typeof val.toDate === 'function') {
       try {
         const d = val.toDate();
         const day = String(d.getDate()).padStart(2, '0');
         const month = String(d.getMonth() + 1).padStart(2, '0');
         const year = d.getFullYear();
         return `${day}/${month}/${year}`;
       } catch (e) { return ''; }
    }
    if (typeof val === 'string' && val.includes('/')) {
       return val;
    }
    if (typeof val === 'string' && val.includes('-')) {
       const parts = val.split('T')[0].split('-');
       if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
       }
    }
    return val || '';
  };
  
  const buildInitialData = (c) => {
    let origem = c.origemDemanda || '';
    let espec = c.origemDemandaEspecificar || '';
    if (origem && !espec) {
        const prefixos = ["CAPS", "CRAS", "OUTROS"];
        for (const p of prefixos) {
            if (origem.toUpperCase().startsWith(p) && origem.length > p.length) {
                const resto = origem.substring(p.length).replace(/^[:\s-]+/, '').trim();
                if (resto) { origem = p; espec = resto; }
            }
        }
    }
    return {
      tituloEleitor: c.tituloEleitor || '',
      tituloEleitorZona: c.tituloEleitorZona || '',
      tituloEleitorSecao: c.tituloEleitorSecao || '',
      escolaridade: c.escolaridade || '',
      religiao: c.religiao || '',
      orientacaoSexual: c.orientacaoSexual || '',
      telefone: c.telefone || '',
      sexo: c.sexo || '',
      cor: c.cor || '',
      dataNascimento: normalizeDateForInput(c.dataNascimento),
      nis: c.nis || '',
      conjuge: c.conjuge || '',
      origemDemanda: origem,
      origemDemandaEspecificar: espec,
      estudando: c.estudando || 'nao',
      estudandoDescricao: c.estudandoDescricao || '',
      tratamentoSaude: c.tratamentoSaude || 'nao',
      tratamentoSaudeDescricao: c.tratamentoSaudeDescricao || '',
      refFamiliarNome: c.refFamiliarNome || '',
      refFamiliarTelefone: c.refFamiliarTelefone || '',
      refFamiliarCep: c.refFamiliarCep || '',
      refFamiliarEndereco: c.refFamiliarEndereco || '',
      presoOuDetido: c.presoOuDetido || 'nao',
      processoJustica: c.processoJustica || 'nao',
      interesseCurso: c.interesseCurso || 'nao',
      interesseCursoQual: c.interesseCursoQual || '',
      habilidadesProfissionais: c.habilidadesProfissionais || ''
    };
  };

  useEffect(() => {
    if (!atendimentoAtual?.cidadao) return;
    
    const c = atendimentoAtual.cidadao;
    const initialData = buildInitialData(c);
    
    setFormData(initialData);
    originalDataRef.current = initialData;
    setIsDirty(false);
    setIsExpanded(true);

    const cpfLimpo = c.cpf?.replace(/\D/g, '');
    if (db && appId && cpfLimpo && cpfLimpo.length === 11) {
      const cidRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
      getDoc(cidRef).then(snap => {
        if (!snap.exists()) return;
        const saved = snap.data();
        const savedData = buildInitialData({ ...c, ...saved });
        
        let hasNewData = false;
        const merged = { ...initialData };
        Object.keys(savedData).forEach(key => {
          const valorAtual = initialData[key];
          const valorSalvo = savedData[key];
          if ((!valorAtual || valorAtual === 'nao' || valorAtual === '') && valorSalvo && valorSalvo !== 'nao' && valorSalvo !== '') {
            merged[key] = valorSalvo;
            hasNewData = true;
          }
        });
        
        if (hasNewData) {
          setFormData(merged);
          originalDataRef.current = merged;
          setIsDirty(false);
        }
      }).catch(err => {
        console.error('[DadosComplementares] Erro ao buscar dados do cidadão:', err);
      });
    }
  }, [atendimentoAtual?.id]);

  useEffect(() => {
    if (typeof onDirtyChange === "function") {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'dataNascimento') {
       let v = value.replace(/\D/g, '');
       if (v.length > 8) v = v.substring(0, 8);
       
       if (v.length > 4) {
          v = v.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
       } else if (v.length > 2) {
          v = v.replace(/(\d{2})(\d{1,2})/, '$1/$2');
       }
       
       setFormData(prev => {
          const next = { ...prev, [name]: v };
          const isChanged = JSON.stringify(next) !== JSON.stringify(originalDataRef.current);
          setIsDirty(isChanged);
          return next;
       });
       return;
    }

    setFormData(prev => {
        const next = { ...prev, [name]: value };
        
        if (name === 'origemDemanda' && !precisaEspecificar(value)) {
            next.origemDemandaEspecificar = '';
        }
        
        const isChanged = JSON.stringify(next) !== JSON.stringify(originalDataRef.current);
        setIsDirty(isChanged);
        
        return next;
    });
  };

  const consultarCep = async () => {
    const cep = (formData.refFamiliarCep || '').replace(/\D/g, '');
    if (cep.length !== 8) {
      alert("CEP inválido. Digite apenas os 8 números.");
      return;
    }
    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (data.erro) {
        alert("CEP não encontrado.");
      } else {
        const enderecoCompleto = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
        setFormData(prev => {
           const next = { ...prev, refFamiliarEndereco: enderecoCompleto };
           const isChanged = JSON.stringify(next) !== JSON.stringify(originalDataRef.current);
           setIsDirty(isChanged);
           return next;
        });
      }
    } catch (error) {
      alert("Erro ao consultar CEP.");
      console.error('[DadosComplementares] Erro ao consultar CEP:', error);
    } finally {
      setLoadingCep(false);
    }
  };

  const salvar = async () => {
    if (!db || !atendimentoAtual?.id) {
      console.warn('[DadosComplementares] salvar() abortado: db ou atendimentoAtual.id ausente');
      return false;
    }
    
    if (precisaEspecificar(formData.origemDemanda) && !formData.origemDemandaEspecificar?.trim()) {
      alert(`Por favor, preencha o campo de especificação para: ${formData.origemDemanda}`);
      return false;
    }

    setLoading(true);
    try {
      const cidadaoUpdates = { ...formData };
      
      if (precisaEspecificar(formData.origemDemanda) && formData.origemDemandaEspecificar) {
          cidadaoUpdates.origemDemandaCompleta = `${formData.origemDemanda}: ${formData.origemDemandaEspecificar}`;
      } else {
          cidadaoUpdates.origemDemandaCompleta = formData.origemDemanda;
      }
      
      cidadaoUpdates.origemDemanda = formData.origemDemanda;
      cidadaoUpdates.origemDemandaEspecificar = formData.origemDemandaEspecificar;

      const cpfLimpo = atendimentoAtual.cidadao?.cpf?.replace(/\D/g, '');
      
      const batch = writeBatch(db);

      if (cpfLimpo && cpfLimpo.length === 11 && validateCPF(cpfLimpo)) {
        const cidRef = doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo);
        batch.set(cidRef, cidadaoUpdates, { merge: true });
      } else {
        console.warn('[DadosComplementares] CPF inválido — ficha NÃO salva em cidadaos');
      }

      const atdRef = doc(db, `artifacts/${appId}/public/data/atendimentos`, atendimentoAtual.id);
      const updatePayload = {};
      Object.keys(cidadaoUpdates).forEach(key => {
        updatePayload[`cidadao.${key}`] = cidadaoUpdates[key];
      });
      batch.update(atdRef, updatePayload);

      await batch.commit();
      
      setLastSaved(new Date());
      originalDataRef.current = { ...formData };
      setIsDirty(false);

      if (onSaveSuccess) onSaveSuccess();
      return true;
    } catch (error) {
      console.error('[DadosComplementares] Erro ao salvar:', error);
      alert("Erro ao salvar dados complementares. Tente novamente.");
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  const descartarAlteracoes = () => {
      if (originalDataRef.current) {
          setFormData({ ...originalDataRef.current });
          setIsDirty(false);
      }
  };

  useImperativeHandle(ref, () => ({
    salvar,
    hasUnsavedChanges: () => isDirty,
    discardChanges: descartarAlteracoes
  }));

  if (!atendimentoAtual?.cidadao) return null;

  return (
    <Card className="h-full flex flex-col overflow-hidden border-t-4 border-t-blue-500 shadow-md transition-all duration-300">
      <div 
        className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-blue-800 font-bold text-sm uppercase tracking-wide">
           <UserCog size={18} />
           <span>Dados Complementares do Usuário</span>
           {isDirty && (
              <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full border border-amber-200 flex items-center gap-1 animate-pulse">
                 <AlertTriangle size={10} /> Não salvo
              </span>
           )}
        </div>
        <button className="text-gray-400 hover:text-blue-600 transition-colors">
           {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      <div className={`transition-all duration-300 ease-in-out overflow-y-auto ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-4 space-y-4">
        
        <div className="grid grid-cols-3 gap-3">
          <InputField label="Título Eleitor" name="tituloEleitor" value={formData.tituloEleitor} onChange={handleChange} placeholder="Nº" icon={FileText} />
          <InputField label="Zona" name="tituloEleitorZona" value={formData.tituloEleitorZona} onChange={handleChange} placeholder="Zona" icon={FileText} />
          <InputField label="Seção" name="tituloEleitorSecao" value={formData.tituloEleitorSecao} onChange={handleChange} placeholder="Seção" icon={FileText} />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
        </div>

        <div className="grid grid-cols-2 gap-3">
           <InputField label="Data Nasc." type="text" name="dataNascimento" value={formData.dataNascimento} onChange={handleChange} placeholder="DD/MM/AAAA" inputMode="numeric" icon={Calendar} />
           <InputField label="NIS" name="nis" value={formData.nis} onChange={handleChange} placeholder="NIS" icon={Hash} />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
        </div>

        <div className="grid grid-cols-2 gap-3">
            <SelectField label="Orient. Sexual" name="orientacaoSexual" value={formData.orientacaoSexual} onChange={handleChange} icon={Heart}>
              <option value="">Selecione</option>
              <option value="Heterossexual">Heterossexual</option>
              <option value="Homossexual">Homossexual</option>
              <option value="Bissexual">Bissexual</option>
              <option value="Outros">Outros/Prefiro não dizer</option>
            </SelectField>
            <InputField label="Telefone" name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(00) 00000-0000" icon={Phone} />
        </div>

        <div className="grid grid-cols-2 gap-3">
           <InputField label="Cônjuge" name="conjuge" value={formData.conjuge} onChange={handleChange} placeholder="Nome do cônjuge" icon={Users} />
           <div className="flex flex-col gap-2">
             <SelectField label="Origem da Demanda" name="origemDemanda" value={formData.origemDemanda} onChange={handleChange} icon={ArrowRight}>
                <option value="">Selecione a origem</option>
                {opcoesOrigem.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
             </SelectField>
             {precisaEspecificar(formData.origemDemanda) && (
               <InputField
                  label={`Especificar ${formData.origemDemanda}`}
                  name="origemDemandaEspecificar"
                  value={formData.origemDemandaEspecificar}
                  onChange={handleChange}
                  placeholder={`Digite qual ${formData.origemDemanda}...`}
                  required
                  className="animate-in slide-in-from-top-1 duration-200"
               />
             )}
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
           <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2 flex items-center gap-2">
                 <BookOpen size={14} className="text-blue-500" /> Educação e Trabalho
              </h3>
              <div className="grid grid-cols-2 gap-3">
                 <SelectField label="Está Estudando?" name="estudando" value={formData.estudando} onChange={handleChange}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                 </SelectField>
                 {formData.estudando === 'sim' && (
                    <InputField label="O que estuda?" name="estudandoDescricao" value={formData.estudandoDescricao} onChange={handleChange} placeholder="Série/Curso/Escola" className="animate-in fade-in slide-in-from-left-2 duration-300" />
                 )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <SelectField label="Interesse em Curso?" name="interesseCurso" value={formData.interesseCurso} onChange={handleChange}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                 </SelectField>
                 {formData.interesseCurso === 'sim' && (
                    <InputField label="Qual curso?" name="interesseCursoQual" value={formData.interesseCursoQual} onChange={handleChange} placeholder="Área de interesse" className="animate-in fade-in slide-in-from-left-2 duration-300" />
                 )}
              </div>
              <div className="flex flex-col">
                  <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Habilidades Profissionais</label>
                  <textarea
                    name="habilidadesProfissionais"
                    value={formData.habilidadesProfissionais}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-medium placeholder:text-gray-400 transition-all duration-200 shadow-sm resize-none h-24"
                    placeholder="Adicione habilidades (Ex: Pedreiro, Pintor, Costura...)"
                  />
              </div>
           </div>

           <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2 flex items-center gap-2">
                 <Heart size={14} className="text-red-500" /> Saúde e Justiça
              </h3>
              <div className="grid grid-cols-2 gap-3">
                 <SelectField label="Tratamento Saúde?" name="tratamentoSaude" value={formData.tratamentoSaude} onChange={handleChange}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                 </SelectField>
                 {formData.tratamentoSaude === 'sim' && (
                    <InputField label="Qual tratamento?" name="tratamentoSaudeDescricao" value={formData.tratamentoSaudeDescricao} onChange={handleChange} placeholder="Descreva..." className="animate-in fade-in slide-in-from-left-2 duration-300" />
                 )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <SelectField label="Já foi Preso/Detido?" name="presoOuDetido" value={formData.presoOuDetido} onChange={handleChange} icon={AlertTriangle}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                 </SelectField>
                 <SelectField label="Processo na Justiça?" name="processoJustica" value={formData.processoJustica} onChange={handleChange} icon={FileText}>
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                 </SelectField>
              </div>
           </div>
        </div>

        <div className="pt-6 border-t border-gray-100 space-y-4">
           <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2 flex items-center gap-2">
              <Users size={14} className="text-green-600" /> Referência Familiar
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InputField label="Nome da Referência" name="refFamiliarNome" value={formData.refFamiliarNome} onChange={handleChange} placeholder="Nome completo do familiar" icon={User} />
              <InputField label="Telefone Referência" name="refFamiliarTelefone" value={formData.refFamiliarTelefone} onChange={handleChange} placeholder="(00) 00000-0000" icon={Phone} />
           </div>
           <div className="grid grid-cols-[140px_1fr] gap-3">
              <div className="flex flex-col">
                 <label className="mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">CEP</label>
                 <div className="flex relative group">
                    <input 
                       type="text" 
                       name="refFamiliarCep"
                       value={formData.refFamiliarCep}
                       onChange={handleChange}
                       className="w-full pl-3 pr-10 py-2.5 text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-medium placeholder:text-gray-400 transition-all duration-200 shadow-sm"
                       placeholder="00000-000"
                    />
                    <button 
                       type="button"
                       onClick={consultarCep}
                       disabled={loadingCep}
                       className="absolute right-1 top-1 bottom-1 px-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 transition-colors flex items-center justify-center disabled:opacity-50"
                       title="Buscar CEP"
                    >
                       {loadingCep ? <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div> : <Search size={16} />}
                    </button>
                 </div>
              </div>
              <InputField label="Endereço Completo" name="refFamiliarEndereco" value={formData.refFamiliarEndereco} onChange={handleChange} placeholder="Rua, Número, Bairro, Cidade - UF" icon={ArrowRight} />
           </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-2">
             <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 italic">
                  {lastSaved ? `Salvo às ${lastSaved.toLocaleTimeString()}` : 'Alterações não salvas'}
                </span>
                {isDirty && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); descartarAlteracoes(); }}
                    className="text-[10px] text-red-500 hover:text-red-700 underline flex items-center gap-1"
                    title="Descartar alterações e voltar ao original"
                  >
                    <Trash2 size={10} /> Descartar
                  </button>
                )}
             </div>
             <Button 
               variant={isDirty ? "primary" : "secondary"} 
               icon={Save} 
               onClick={salvar}
               isLoading={loading}
               className={isDirty ? "animate-pulse" : ""}
             >
               {isDirty ? "Salvar Alterações" : "Dados Salvos"}
             </Button>
          </div>
      </div>
    </div>
    </Card>
  );
});

export default DadosComplementares;

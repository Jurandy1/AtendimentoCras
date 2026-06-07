/**
 * FichaAtendimentoTecnico.jsx  — v2
 *
 * Ficha única de atendimento técnico (psicólogo / assistente social).
 * Substitui DadosComplementares + RMAForm em um único componente.
 *
 * Alimenta automaticamente todas as seções do RMA mensal:
 *   Seção 1 (A.1)  ← Sexo / Faixa etária (derivado do perfil)
 *   Seção 1 (B.1)  ← Substâncias ilícitas
 *   Seção 1 (B.2a) ← Doença / transtorno mental
 *   Seção 1 (B.2b) ← Deficiência
 *   Seção 1 (B.3)  ← Migrantes
 *   Seção 3        ← Raça/Cor, Religião, Orientação Sexual, Escolaridade
 *   Seção 4        ← Benefícios e Programas Sociais (Bolsa Família, BPC, Eventuais)
 *   Seção 5        ← Violência / Violação de Direitos (M/F/L/G/B/T derivado do perfil)
 *   Seção 7        ← Substâncias por tipo (derivado)
 *   Seção 8        ← Encaminhamentos Recebidos
 *   Seção 9        ← Encaminhamentos Realizados (com status de acolhimento)
 *   Seção F        ← Desligamento (motivo categorizado — via BloqueioDialog)
 */

import React, {
  useState, useEffect, useRef, useMemo, useImperativeHandle, forwardRef
} from 'react';
import { collection, doc, getDoc, onSnapshot, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import {
  Save, Search, Trash2, Plus, AlertTriangle, ChevronDown, User,
  FileText, Phone, Heart, BookOpen, Home, Pill, Globe, Shield,
  Briefcase, Users, ClipboardList, ArrowRightLeft, DollarSign
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { searchCep, validateCPF } from '../../utils';
import Card from '../ui/Card';
import Button from '../ui/Button';

// ─── LISTAS DE OPÇÕES ─────────────────────────────────────────────────────────

const SUBSTANCIAS_ILICITAS = [
  { id: 'crack',         label: 'Crack' },
  { id: 'cocaina',       label: 'Cocaína' },
  { id: 'maconha',       label: 'Maconha' },
  { id: 'inhalantes',    label: 'Loló / Inalantes (loló, colar, cola)' },
  { id: 'outro_ilicito', label: 'Outra droga ilícita' },
];

const SUBSTANCIAS_LICITAS = [
  { id: 'alcool',  label: 'Álcool' },
  { id: 'cigarro', label: 'Cigarro / tabaco' },
];

const DOENCAS_MENTAIS = [
  { id: 'depressao',       label: 'Depressão' },
  { id: 'ansiedade',       label: 'Transtorno de Ansiedade' },
  { id: 'esquizofrenia',   label: 'Esquizofrenia' },
  { id: 'bipolar',         label: 'Transtorno Bipolar' },
  { id: 'tept',            label: 'TEPT (Estresse Pós-Traumático)' },
  { id: 'dependencia_spa', label: 'Dependência química de substâncias psicoativas' },
  { id: 'personalidade',   label: 'Transtorno de Personalidade' },
  { id: 'def_intelectual', label: 'Deficiência Intelectual' },
  { id: 'demencia',        label: 'Demência / Comprometimento Cognitivo' },
  { id: 'tea',             label: 'Transtorno do Espectro Autista (TEA)' },
  { id: 'epilepsia',       label: 'Epilepsia' },
  { id: 'outro_mental',    label: 'Outro (especificar)' },
];

const VIOLACOES_DIREITOS = [
  { id: 'abuso_sexual',            label: 'Abuso sexual' },
  { id: 'violencia_intrafamiliar', label: 'Violência intrafamiliar (física ou psicológica)' },
  { id: 'exploracao_sexual',       label: 'Exploração sexual' },
  { id: 'negligencia_abandono',    label: 'Negligência ou abandono' },
  { id: 'dormir_na_rua',           label: 'Dormir na rua' },
  { id: 'discriminacao_sexual',    label: 'Discriminação por orientação sexual' },
  { id: 'trafico',                 label: 'Vítima de tráfico de seres humanos' },
  { id: 'violencia_patrimonial',   label: 'Violência patrimonial (idoso / pessoa com deficiência)' },
];

/**
 * Origens de encaminhamentos recebidos (Section 8 do RMA).
 * Quem encaminhou esta pessoa para o Centro POP?
 */
const ORIGENS_ENCAMINHAMENTO_RECEBIDO = [
  'Espontânea (procurou o serviço por conta própria)',
  'Abordagem Social',
  'POP RUA JUD (Programa Judiciário)',
  'CAPS / CAPS AD',
  'CRAS (especificar)',
  'CREAS',
  'Consultório na Rua',
  'Hospital / UBS / Serviço de Saúde',
  'Defensoria Pública (DPE/MA ou DPU)',
  'Guarda Municipal',
  'Delegacia / Polícia Civil',
  'Outro serviço (especificar)',
];

/**
 * Destinos de encaminhamentos externos (Section 9 do RMA).
 * Atualizado com base nos RMAs de Janeiro e Dezembro/2025.
 */
const DESTINOS_ENCAMINHAMENTO = {
  'Acolhimento': [
    'Central de Acolhimento / Semcas',
    'Abrigo para Adultos em Situação de Rua – Semcas (Cohab)',
    'UAM "Elizângela Cardoso" / Semcas',
    'CAT – Casa de Acolhida Temporário',
    'Instituto Solis',
    'Solidariedade e Vida',
    'Projeto Renascer',
    'Comunidade Terapêutica Florescer',
    'Outro serviço de acolhimento',
  ],
  'Saúde Mental': [
    'CAPS AD Estadual (Álcool e Drogas)',
    'CAPS III (Adultos)',
    'Ambulatório Saúde Mental Dom João A. Farina',
    'Ambulatório Saúde Mental Itaqui-Bacanga',
    'Consultório na Rua',
    'Hospital Nina Rodrigues',
    'Hospital Presidente Vargas',
    'Instituto Farina',
  ],
  'Saúde Geral': [
    'UBS Liberdade',
    'UBS Coroadinho',
    'UBS Paulo Ramos',
    'Clínica da Família do Centro',
    'Unidade Mista do Bequimão',
    'Hospital Genésio Rego',
    'SAMU',
    'Socorrinho',
    'Socorrinho São Francisco',
    'CTA – Centro de Testagem e Aconselhamento',
  ],
  'Documentação Civil': [
    'Instituto de Identificação (SSP/MA)',
    'Cartório de Registro Civil 1ª Zona',
    'Cartório de Registro Civil 2ª Zona',
    'Cartório de Registro Civil 3ª Zona',
    'Cartório de Registro Civil 4ª Zona',
    'Cartório de Registro Civil 5ª Zona',
    'Cartório de Registro Civil 6ª Zona',
    'Cartório de Registro Civil – Paço do Lumiar',
    'Cartório de Registro Civil – São José de Ribamar',
    'Junta Militar',
    'TRE/MA – Título Eleitoral',
    'INSS',
    'Receita Federal',
    'Ministério da Fazenda',
    'Balcão Cidadão',
    'Viva Cidadão',
    'Viva Procon',
    'DPE/MA – Defensoria Pública',
    'DPU/MA',
    'POP RUA JUD (Programa Judiciário)',
  ],
  'Assistência Social e Benefícios': [
    'Coordenação de Benefícios Socioassistenciais / Semcas',
    'Central de Habitação – SEMURH',
    'SAI / Semcas',
    'CRAS Anjo da Guarda',
    'CRAS Anil',
    'CRAS Bacanga',
    'CRAS Bairro de Fátima',
    'CRAS Bequimão',
    'CRAS Centro',
    'CRAS Cidade Olímpica',
    'CRAS Cidade Operária',
    'CRAS Cohab',
    'CRAS Coroadinho',
    'CRAS Janaína',
    'CRAS João de Deus',
    'CRAS Liberdade',
    'CRAS Maracanã',
    'CRAS Nova Terra – São José de Ribamar',
    'CRAS Paço do Lumiar',
    'CRAS São Francisco',
    'CRAS São Raimundo',
    'CRAS São Vicente de Ferrer',
    'CRAS Vila Bacanga',
    'CRAS Vila Nova',
    'CRAS Vinhais',
    'CREAS Paço do Lumiar',
    'Centro Pop Cohab',
    'Centro Pop Paço do Lumiar',
    'Centro Pop São José de Ribamar',
  ],
  'Banco e Financeiro': [
    'Banco do Brasil',
    'Caixa Econômica Federal',
    'Lotérica',
    'Terminal de Integração – Central de Gratuidade',
  ],
  'Capacitação e Emprego': [
    'FUMPH – Projeto Canteiro-Escola',
    'Curso de qualificação profissional',
    'STRE-MA',
    'Mercado de trabalho',
  ],
  'Outros': [
    'TJ/MA',
    'TRE/MA',
    'Polícia Civil',
    'Fórum Eleitoral',
    'Disk Saúde',
    'Outro (especificar)',
  ],
};

const ORIGENS_DEMANDA_BASE = [
  'ABORDAGEM SOCIAL', 'AÇÃO MINISTÉRIO PÚBLICO', 'BUSCA ATIVA', 'CAPS',
  'CASA DA MULHER', 'CMAS/SL',
  'COMUNIDADE TERAPÊUTICA FLORESCER', 'CONSULTÓRIO DE RUA', 'CRAS',
  'DEFENSORIA PÚBLICA DO MARANHÃO', 'ESPONTÂNEA', 'GUARDA MUNICIPAL', 'INSS',
  'POP RUA JUD', 'OUTROS',
];

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

const precisaEspecificar = (val) => {
  if (!val) return false;
  return ['CAPS', 'CRAS', 'OUTROS'].includes(val.toUpperCase());
};

const normalizeDateForInput = (val) => {
  if (!val) return '';
  if (val && typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    } catch { return ''; }
  }
  if (typeof val === 'string' && val.includes('/')) return val;
  if (typeof val === 'string' && val.includes('-')) {
    const p = val.split('T')[0].split('-');
    if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  }
  return val || '';
};

const normalizeTextKey = (val) =>
  String(val || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const normalizeSexo = (val) => {
  const key = normalizeTextKey(val);
  if (!key) return '';
  if (key === 'm' || key === 'masculino') return 'Masculino';
  if (key === 'f' || key === 'feminino') return 'Feminino';
  if (key.includes('outro')) return 'Outro';
  return String(val).trim();
};

const normalizeReligiao = (val) => {
  const key = normalizeTextKey(val);
  if (!key) return '';
  if (key.includes('catol')) return 'Católica';
  if (key.includes('protest') || key.includes('evang') || key.includes('pent')) return 'Protestante (Evangélica, Pentecostal e Neopentecostal)';
  if (key.includes('espirita') || key.includes('spirita')) return 'Espírita';
  if (key.includes('afro') || key.includes('matriz')) return 'Afro-Brasileira';
  if (key.includes('testemunha')) return 'Testemunha de Jeová';
  if (key.includes('oriental')) return 'Religiões Orientais';
  if (key.includes('sem religi')) return 'Sem Religião';
  return String(val).trim();
};

const normalizeCor = (val) => {
  const key = normalizeTextKey(val);
  if (!key) return '';
  if (key === 'indigena' || key === 'indigena') return 'Indígena';
  if (key === 'preta' || key === 'negra') return 'Preta / Negra';
  return String(val).trim();
};

const normalizeEscolaridade = (val) => {
  const key = normalizeTextKey(val);
  if (!key) return '';
  if (key.includes('analfab') || key.includes('nao alfab')) return 'Não alfabetizado';
  if (key.includes('medio incompl')) return 'Médio Incompleto';
  if (key.includes('medio compl')) return 'Médio Completo';
  if (key.includes('pos grad')) return 'Pós-graduação';
  return String(val).trim();
};

const BR_UF = new Set([
  'ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','sp','se','to'
]);

const extractUF = (val) => {
  const key = normalizeTextKey(val);
  if (!key) return null;
  const m1 = key.match(/\/([a-z]{2})\b/);
  const m2 = key.match(/-([a-z]{2})\b/);
  const m3 = key.match(/\b([a-z]{2})$/);
  const uf = (m1?.[1] || m2?.[1] || m3?.[1] || '').toLowerCase();
  return BR_UF.has(uf) ? uf : null;
};

const isMaranhao = (val) => {
  const uf = extractUF(val);
  if (uf === 'ma') return true;
  const key = normalizeTextKey(val);
  return !!key && key.includes('maranhao');
};

const isSaoLuis = (val) => {
  const key = normalizeTextKey(val);
  if (!key) return false;
  return key.includes('sao luis') || key.includes('saoluis');
};

const shouldAutoSetMigrante = (origem) => {
  const raw = String(origem || '').trim();
  if (!raw) return false;
  if (isSaoLuis(raw)) return false;
  if (isMaranhao(raw)) return false;
  const uf = extractUF(raw);
  if (!uf) return false;
  return uf !== 'ma';
};

// ─── COMPONENTES DE CAMPO ─────────────────────────────────────────────────────

const Label = ({ children, required }) => (
  <label style={{
    display:'block', fontSize:10, fontWeight:700, color:'var(--color-text-secondary)',
    textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4
  }}>
    {children}{required && <span style={{ color:'#dc2626', marginLeft:2 }}>*</span>}
  </label>
);

const FieldInput = ({ label, required, className='', style={}, ...props }) => (
  <div className={`flex flex-col ${className}`} style={style}>
    {label && <Label required={required}>{label}</Label>}
    <input className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all" {...props} />
  </div>
);

const FieldSelect = ({ label, required, className='', style={}, children, ...props }) => (
  <div className={`flex flex-col ${className}`} style={style}>
    {label && <Label required={required}>{label}</Label>}
    <div style={{ position:'relative' }}>
      <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none appearance-none transition-all pr-8 cursor-pointer" {...props}>
        {children}
      </select>
      <ChevronDown size={13} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--color-text-tertiary)' }} />
    </div>
  </div>
);

const FieldTextarea = ({ label, className='', ...props }) => (
  <div className={`flex flex-col ${className}`}>
    {label && <Label>{label}</Label>}
    <textarea className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none resize-none transition-all" rows={3} {...props} />
  </div>
);

const ReadOnlyField = ({ label, value }) => (
  <div>
    <Label>{label}</Label>
    <div style={{ padding:'7px 10px', background:'var(--color-background-secondary)', border:'1px solid var(--color-border-tertiary)', borderRadius:8, fontSize:13, minHeight:34, color: value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontStyle: value ? 'normal' : 'italic' }}>
      {value || 'Não informado'}
    </div>
  </div>
);

const CheckOpcao = ({ checked, onChange, label, subLabel }) => (
  <label style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'7px 10px', borderRadius:7, cursor:'pointer', transition:'all .15s', background: checked ? 'rgba(37,99,235,.07)' : 'transparent', border: checked ? '1px solid rgba(37,99,235,.3)' : '1px solid transparent' }}>
    <input type="checkbox" checked={checked} onChange={onChange} style={{ width:15, height:15, marginTop:1, flexShrink:0, accentColor:'#2563eb', cursor:'pointer' }} />
    <div>
      <span style={{ fontSize:12.5, lineHeight:1.4, fontWeight: checked ? 600 : 400, color: checked ? '#1e3a8a' : 'var(--color-text-primary)' }}>{label}</span>
      {subLabel && <p style={{ fontSize:10.5, color:'var(--color-text-tertiary)', margin:'2px 0 0' }}>{subLabel}</p>}
    </div>
  </label>
);

const SecaoFicha = ({ numero, titulo, icon: Icon, cor='#1e40af' }) => (
  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', marginBottom:12, marginTop:20, background:`${cor}12`, borderLeft:`3px solid ${cor}`, borderRadius:'0 6px 6px 0' }}>
    {Icon && <Icon size={14} style={{ color:cor, flexShrink:0 }} />}
    <span style={{ fontSize:10.5, fontWeight:700, color:cor, textTransform:'uppercase', letterSpacing:'.07em' }}>
      {numero && <span style={{ opacity:.5, marginRight:5 }}>{numero}.</span>}{titulo}
    </span>
  </div>
);

// ─── ESTADO INICIAL ───────────────────────────────────────────────────────────

const buildInitialState = (cidadao={}, rmaData={}) => {
  let origem = cidadao.origemDemanda || '';
  let espec  = cidadao.origemDemandaEspecificar || '';
  if (origem && !espec) {
    for (const p of ['CAPS','CRAS','OUTROS']) {
      if (origem.toUpperCase().startsWith(p) && origem.length > p.length) {
        const resto = origem.substring(p.length).replace(/^[:\s-]+/,'').trim();
        if (resto) { origem = p; espec = resto; }
      }
    }
  }
  return {
    // ── Perfil (preservado de DadosComplementares) ──────────────────────────
    tituloEleitor:        cidadao.tituloEleitor        || '',
    tituloEleitorZona:    cidadao.tituloEleitorZona    || '',
    tituloEleitorSecao:   cidadao.tituloEleitorSecao   || '',
    escolaridade:         normalizeEscolaridade(cidadao.escolaridade),
    religiao:             normalizeReligiao(cidadao.religiao),
    orientacaoSexual:     cidadao.orientacaoSexual     || '',
    identidadeGenero:     cidadao.identidadeGenero     || '',
    telefone:             cidadao.telefone             || '',
    sexo:                 normalizeSexo(cidadao.sexo),
    cor:                  normalizeCor(cidadao.cor),
    dataNascimento:       normalizeDateForInput(cidadao.dataNascimento),
    nis:                  cidadao.nis                  || '',
    conjuge:              cidadao.conjuge              || '',
    origemDemanda:        origem,
    origemDemandaEspecificar: espec,
    estudando:            cidadao.estudando            || 'nao',
    estudandoDescricao:   cidadao.estudandoDescricao   || '',
    tratamentoSaude:      cidadao.tratamentoSaude      || 'nao',
    tratamentoSaudeDescricao: cidadao.tratamentoSaudeDescricao || '',
    refFamiliarNome:      cidadao.refFamiliarNome      || '',
    refFamiliarTelefone:  cidadao.refFamiliarTelefone  || '',
    refFamiliarCep:       cidadao.refFamiliarCep       || '',
    refFamiliarEndereco:  cidadao.refFamiliarEndereco  || '',
    presoOuDetido:        cidadao.presoOuDetido        || 'nao',
    processoJustica:      cidadao.processoJustica      || 'nao',
    interesseCurso:       cidadao.interesseCurso       || 'nao',
    interesseCursoQual:   cidadao.interesseCursoQual   || '',
    habilidadesProfissionais: cidadao.habilidadesProfissionais || '',
    // ── Avaliação clínico-social ─────────────────────────────────────────────
    moradia_rua:         rmaData.moradia_rua         ?? cidadao.moradia_rua         ?? false,
    moradia_amigos:      rmaData.moradia_amigos      ?? cidadao.moradia_amigos      ?? false,
    moradia_acolhimento: rmaData.moradia_acolhimento ?? cidadao.moradia_acolhimento ?? false,
    substancias:
      Array.isArray(rmaData.substancias)               ? rmaData.substancias
      : Array.isArray(cidadao.substancias_psicoativas) ? cidadao.substancias_psicoativas
      : [],
    substancias_ilicito_outro: rmaData.substancias_ilicito_outro || cidadao.substancias_ilicito_outro || '',
    b3_doencas:
      Array.isArray(rmaData.b3_doencas)          ? rmaData.b3_doencas
      : Array.isArray(cidadao.doencas_mentais)   ? cidadao.doencas_mentais
      : [],
    b3_doencas_outro:    rmaData.b3_doencas_outro || cidadao.doencas_mentais_outro || '',
    b2_deficiencia:      rmaData.b2_deficiencia   ?? cidadao.deficiencia            ?? false,
    b2_deficiencia_qual: rmaData.b2_deficiencia_qual || cidadao.deficiencia_qual    || '',
    b3_migrante:
      rmaData.b3_migrante ?? rmaData.b2_migrante ?? cidadao.b3_migrante ?? cidadao.b2_migrante ??
      shouldAutoSetMigrante(rmaData.b3_origem || cidadao.b3_origem),
    b3_origem: (() => {
      const nat = String(cidadao.naturalidade || '').trim();
      const uf = String(cidadao.uf || '').trim();
      const composed = [nat, uf].filter(Boolean).join('/');
      const raw = String(rmaData.b3_origem || cidadao.b3_origem || '').trim();
      if (!raw) return composed || nat || '';
      if (nat && uf && normalizeTextKey(raw) === normalizeTextKey(nat)) return composed || raw;
      return raw;
    })(),
    b3_tipo_migracao:  rmaData.b3_tipo_migracao || cidadao.b3_tipo_migracao || '',
    violacoes:
      Array.isArray(rmaData.violacoes)  ? rmaData.violacoes
      : Array.isArray(cidadao.violacoes) ? cidadao.violacoes
      : [],
    // ── Encaminhamentos recebidos (Section 8) ────────────────────────────────
    encaminhamento_recebido:          rmaData.encaminhamento_recebido          || cidadao.encaminhamento_recebido          || '',
    encaminhamento_recebido_resultado: rmaData.encaminhamento_recebido_resultado || cidadao.encaminhamento_recebido_resultado || '',
    // ── Encaminhamentos realizados (Section 9) ───────────────────────────────
    encaminhamentos_externos:
      Array.isArray(rmaData.encaminhamentos_externos)  ? rmaData.encaminhamentos_externos
      : Array.isArray(cidadao.encaminhamentos_externos) ? cidadao.encaminhamentos_externos
      : [],
    // ── Benefícios e programas sociais (Section 4) ──────────────────────────
    beneficio_bolsa_familia:  rmaData.beneficio_bolsa_familia  ?? cidadao.beneficio_bolsa_familia  ?? false,
    beneficio_bpc:            rmaData.beneficio_bpc            ?? cidadao.beneficio_bpc            ?? false,
    beneficios_eventuais:
      Array.isArray(rmaData.beneficios_eventuais)  ? rmaData.beneficios_eventuais
      : Array.isArray(cidadao.beneficios_eventuais) ? cidadao.beneficios_eventuais
      : [],
    beneficio_outro_qual: rmaData.beneficio_outro_qual || cidadao.beneficio_outro_qual || '',
    // ── Ações técnicas (Section 2) ───────────────────────────────────────────
    acao_estudo_caso:            rmaData.acao_estudo_caso            ?? cidadao.acao_estudo_caso            ?? false,
    acao_plano_individual:       rmaData.acao_plano_individual       ?? cidadao.acao_plano_individual       ?? false,
    acao_familia_mobilizada:     rmaData.acao_familia_mobilizada     ?? cidadao.acao_familia_mobilizada     ?? false,
    acao_endereco_institucional: rmaData.acao_endereco_institucional ?? cidadao.acao_endereco_institucional ?? false,
    acao_capacitacao:            rmaData.acao_capacitacao            ?? cidadao.acao_capacitacao            ?? false,
  };
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

const FichaAtendimentoTecnico = forwardRef(
  ({ atendimentoAtual, rmaData, setRmaData, crasUnidades = [], onSaveSuccess, onDirtyChange }, ref) => {
    const { db, appId } = useAuth();
    const [fs, setFs]             = useState({});
    const [isDirty, setIsDirty]   = useState(false);
    const [loading, setLoading]   = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);
    const [lastSaved, setLastSaved]   = useState(null);
    const originalRef     = useRef(null);
    const initLoadedRef   = useRef(null);
    const migranteTouched = useRef(false);
    const [encOpcoesExtras, setEncOpcoesExtras] = useState([]);
    const opcoesOrigem = useMemo(() => {
      const base = ORIGENS_DEMANDA_BASE;
      const unidades = (crasUnidades || [])
        .map((u) => String(u?.nome || "").trim())
        .filter(Boolean)
        .map((n) => n.toUpperCase());
      return [...new Set([...base, ...unidades])].sort();
    }, [crasUnidades]);

    // Carrega estado inicial quando muda o atendimento
    useEffect(() => {
      if (!atendimentoAtual?.cidadao) return;
      const init = buildInitialState(atendimentoAtual.cidadao, rmaData || {});
      setFs(init);
      originalRef.current = init;
      setIsDirty(false);
      migranteTouched.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [atendimentoAtual?.id]);

    // Hidrata dados persistentes do cidadão no Firestore
    useEffect(() => {
      const cpf = atendimentoAtual?.cidadao?.cpf?.replace(/\D/g,'');
      if (!db || !appId || !cpf || cpf.length !== 11) return;
      if (initLoadedRef.current === cpf) return;
      initLoadedRef.current = cpf;
      (async () => {
        try {
          const snap = await getDoc(doc(db, `artifacts/${appId}/public/data/cidadaos`, cpf));
          if (!snap.exists()) return;
          const saved = snap.data();
          const merged = buildInitialState({ ...atendimentoAtual.cidadao, ...saved }, rmaData || {});
          setFs(prev => {
            const result = { ...prev };
            Object.keys(merged).forEach(k => {
              const cur = prev[k]; const mrg = merged[k];
              const isEmpty = Array.isArray(cur) ? cur.length === 0 : cur === '' || cur === 'nao' || cur === null || cur === undefined || cur === false;
              const hasMerge = Array.isArray(mrg) ? mrg.length > 0 : mrg && mrg !== 'nao' && mrg !== '' && mrg !== false;
              if (isEmpty && hasMerge) result[k] = mrg;
            });
            originalRef.current = result;
            return result;
          });
        } catch (e) { console.warn('[FichaAtendimentoTecnico] hidratação:', e); }
      })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [atendimentoAtual?.id, db, appId]);

    useEffect(() => {
      if (!db || !appId) return;
      const ref = collection(db, `artifacts/${appId}/public/data/encaminhamentos_opcoes`);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setEncOpcoesExtras(rows);
        },
        (e) => {
          console.error('[FichaAtendimentoTecnico] encaminhamentos_opcoes:', e);
        }
      );
      return () => {
        try { unsub(); } catch {}
      };
    }, [db, appId]);

    useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

    // Auto-marca migrante quando a origem indica fora do MA
    useEffect(() => {
      if (migranteTouched.current) return;
      const origem = (fs.b3_origem || '').trim();
      if (!origem || !shouldAutoSetMigrante(origem) || !!fs.b3_migrante) return;
      setFs(prev => {
        const next = { ...prev, b3_migrante: true };
        setIsDirty(JSON.stringify(next) !== JSON.stringify(originalRef.current));
        return next;
      });
    }, [fs.b3_origem, fs.b3_migrante]);

    const handleChange = (field, value) => {
      setFs(prev => {
        let v = value;
        if (field === 'dataNascimento') {
          v = value.replace(/\D/g,'').substring(0,8);
          if (v.length > 4) v = `${v.slice(0,2)}/${v.slice(2,4)}/${v.slice(4)}`;
          else if (v.length > 2) v = `${v.slice(0,2)}/${v.slice(2)}`;
        }
        const next = { ...prev, [field]: v };
        if (field === 'origemDemanda' && !precisaEspecificar(v)) next.origemDemandaEspecificar = '';
        setIsDirty(JSON.stringify(next) !== JSON.stringify(originalRef.current));
        return next;
      });
    };

    const toggleArr = (field, id) => {
      setFs(prev => {
        const arr = Array.isArray(prev[field]) ? prev[field] : [];
        const next = { ...prev, [field]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] };
        setIsDirty(JSON.stringify(next) !== JSON.stringify(originalRef.current));
        return next;
      });
    };

    const inArr = (field, id) => Array.isArray(fs[field]) && fs[field].includes(id);
    const get   = field => fs[field];

    // CEP
    const consultarCep = async () => {
      const cep = (fs.refFamiliarCep || '').replace(/\D/g,'');
      if (cep.length !== 8) { alert('CEP inválido.'); return; }
      setLoadingCep(true);
      try {
        const d = await searchCep(cep);
        if (!d) alert('CEP não encontrado.');
        else handleChange('refFamiliarEndereco', `${d.logradouro}, ${d.bairro}, ${d.localidade} - ${d.uf}`);
      } catch { alert('Erro ao consultar CEP.'); }
      finally { setLoadingCep(false); }
    };

    // Encaminhamentos realizados
    const tiposEncaminhamento = useMemo(() => {
      const set = new Set();
      Object.keys(DESTINOS_ENCAMINHAMENTO || {}).forEach((k) => set.add(String(k)));
      (encOpcoesExtras || []).forEach((row) => {
        const tipo = String(row?.tipo || row?.categoria || '').trim();
        if (tipo) set.add(tipo);
      });
      return Array.from(set).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    }, [encOpcoesExtras]);

    const unidadesPorTipo = useMemo(() => {
      const out = {};
      Object.entries(DESTINOS_ENCAMINHAMENTO || {}).forEach(([tipo, list]) => {
        out[tipo] = Array.isArray(list) ? [...list] : [];
      });
      (encOpcoesExtras || []).forEach((row) => {
        const tipo = String(row?.tipo || row?.categoria || '').trim() || 'Outros';
        const unidade = String(row?.unidade || row?.label || row?.destino || '').trim();
        if (!unidade) return;
        if (!out[tipo]) out[tipo] = [];
        const exists = out[tipo].some((x) => normalizeTextKey(x) === normalizeTextKey(unidade));
        if (!exists) out[tipo].push(unidade);
      });
      Object.keys(out).forEach((tipo) => {
        out[tipo] = (out[tipo] || []).slice().sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
      });
      return out;
    }, [encOpcoesExtras]);

    const [novoEnc, setNovoEnc] = useState({
      tipoSel: '',
      unidadeSel: '',
      resultado: '',
      status_acolhimento: '',
      novo_tipo: '',
      nova_unidade: '',
      salvar_opcao: true,
    });
    const [addingEnc, setAddingEnc] = useState(false);
    const encList = useMemo(() => Array.isArray(fs.encaminhamentos_externos) ? fs.encaminhamentos_externos : [], [fs.encaminhamentos_externos]);
    const isAcolhimento = (destino) => (destino || '').toLowerCase().includes('acolhimento') || (destino || '').toLowerCase().includes('abrigo');

    const isNovoTipo = novoEnc.tipoSel === '__novo_tipo__';
    const isNovaUnidade = novoEnc.unidadeSel === '__nova_unidade__' || isNovoTipo;
    const tipoFinal = String(isNovoTipo ? novoEnc.novo_tipo : novoEnc.tipoSel).trim();
    const unidadeFinal = String(isNovaUnidade ? novoEnc.nova_unidade : novoEnc.unidadeSel).trim();
    const destinoParaAcolhimento = unidadeFinal;

    const canAddEnc = !!tipoFinal && !!unidadeFinal;

    const saveEncOpcao = async (tipo, unidade) => {
      if (!db || !appId) return;
      const t = String(tipo || '').trim();
      const u = String(unidade || '').trim();
      if (!t || !u) return;
      const docId = `${normalizeTextKey(t)}__${normalizeTextKey(u)}`.slice(0, 240) || `${Date.now()}`;
      try {
        await setDoc(
          doc(db, `artifacts/${appId}/public/data/encaminhamentos_opcoes`, docId),
          { tipo: t, unidade: u, atualizado_em: serverTimestamp() },
          { merge: true }
        );
        return true;
      } catch (e) {
        console.error('[FichaAtendimentoTecnico] saveEncOpcao:', e);
        return false;
      }
    };

    const addEnc = async () => {
      if (!canAddEnc || addingEnc) return;
      setAddingEnc(true);
      try {
        const statusAcolhimento = isAcolhimento(unidadeFinal) ? (novoEnc.status_acolhimento || '') : '';
        const tKey = normalizeTextKey(tipoFinal);
        const uKey = normalizeTextKey(unidadeFinal);
        const alreadyExists = encList.some((e) =>
          normalizeTextKey(e?.tipo) === tKey &&
          normalizeTextKey(e?.destino) === uKey &&
          String(e?.resultado || '') === String(novoEnc.resultado || '') &&
          String(e?.status_acolhimento || '') === String(statusAcolhimento || '')
        );
        if (alreadyExists) {
          alert('Encaminhamento já adicionado.');
          return;
        }

        const payload = {
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          tipo: tipoFinal,
          destino: unidadeFinal,
          resultado: novoEnc.resultado || '',
          status_acolhimento: statusAcolhimento,
        };
        if (novoEnc.salvar_opcao && (isNovoTipo || isNovaUnidade)) {
          const ok = await saveEncOpcao(tipoFinal, unidadeFinal);
          if (!ok) {
            alert('Falha ao salvar a opção deste encaminhamento. Tente novamente.');
            return;
          }
        }
        handleChange('encaminhamentos_externos', [...encList, payload]);
        setNovoEnc({
          tipoSel: '',
          unidadeSel: '',
          resultado: '',
          status_acolhimento: '',
          novo_tipo: '',
          nova_unidade: '',
          salvar_opcao: true,
        });
      } finally {
        setAddingEnc(false);
      }
    };
    const removeEnc = (id) => handleChange('encaminhamentos_externos', encList.filter(e => e.id !== id));

    // Salvar
    const salvar = async () => {
      if (!db || !atendimentoAtual?.id) return false;
      const cpfLimpo = atendimentoAtual.cidadao?.cpf?.replace(/\D/g,'');
      if (precisaEspecificar(fs.origemDemanda) && !fs.origemDemandaEspecificar?.trim()) {
        alert(`Preencha a especificação para: ${fs.origemDemanda}`); return false;
      }
      setLoading(true);
      try {
        const cidPayload = {
          tituloEleitor:fs.tituloEleitor, tituloEleitorZona:fs.tituloEleitorZona,
          tituloEleitorSecao:fs.tituloEleitorSecao, escolaridade:fs.escolaridade,
          religiao:fs.religiao, orientacaoSexual:fs.orientacaoSexual,
          identidadeGenero:fs.identidadeGenero, telefone:fs.telefone,
          sexo:fs.sexo, cor:fs.cor, dataNascimento:fs.dataNascimento, nis:fs.nis,
          conjuge:fs.conjuge, origemDemanda:fs.origemDemanda,
          origemDemandaEspecificar:fs.origemDemandaEspecificar,
          origemDemandaCompleta: precisaEspecificar(fs.origemDemanda) && fs.origemDemandaEspecificar
            ? `${fs.origemDemanda}: ${fs.origemDemandaEspecificar}` : fs.origemDemanda,
          estudando:fs.estudando, estudandoDescricao:fs.estudandoDescricao,
          tratamentoSaude:fs.tratamentoSaude, tratamentoSaudeDescricao:fs.tratamentoSaudeDescricao,
          presoOuDetido:fs.presoOuDetido, processoJustica:fs.processoJustica,
          interesseCurso:fs.interesseCurso, interesseCursoQual:fs.interesseCursoQual,
          habilidadesProfissionais:fs.habilidadesProfissionais,
          refFamiliarNome:fs.refFamiliarNome, refFamiliarTelefone:fs.refFamiliarTelefone,
          refFamiliarCep:fs.refFamiliarCep, refFamiliarEndereco:fs.refFamiliarEndereco,
          // avaliação persistente
          doencas_mentais:fs.b3_doencas, doencas_mentais_outro:fs.b3_doencas_outro,
          doencas_mentais_ultima_cras_id: atendimentoAtual?.cras_id || null,
          deficiencia:fs.b2_deficiencia, deficiencia_qual:fs.b2_deficiencia_qual,
          substancias_psicoativas:fs.substancias, substancias_ilicito_outro:fs.substancias_ilicito_outro,
          moradia_rua:fs.moradia_rua, moradia_amigos:fs.moradia_amigos, moradia_acolhimento:fs.moradia_acolhimento,
          b3_migrante:fs.b3_migrante, b3_origem:fs.b3_origem, b3_tipo_migracao:fs.b3_tipo_migracao,
          violacoes:fs.violacoes, encaminhamentos_externos:fs.encaminhamentos_externos,
          encaminhamento_recebido:fs.encaminhamento_recebido, encaminhamento_recebido_resultado:fs.encaminhamento_recebido_resultado,
          beneficio_bolsa_familia:fs.beneficio_bolsa_familia, beneficio_bpc:fs.beneficio_bpc,
          beneficios_eventuais:fs.beneficios_eventuais, beneficio_outro_qual:fs.beneficio_outro_qual,
          acao_estudo_caso:fs.acao_estudo_caso, acao_plano_individual:fs.acao_plano_individual,
          acao_familia_mobilizada:fs.acao_familia_mobilizada, acao_endereco_institucional:fs.acao_endereco_institucional,
          acao_capacitacao:fs.acao_capacitacao,
          ultima_atualizacao_cras_id: atendimentoAtual?.cras_id || null,
          ultima_atualizacao_atendente_id: atendimentoAtual?.atendente_id || null,
          ultima_atualizacao_em: serverTimestamp(),
          ficha_atualizada_em: serverTimestamp(),
        };

        const batch = writeBatch(db);
        if (cpfLimpo && cpfLimpo.length === 11 && validateCPF(cpfLimpo))
          batch.set(doc(db, `artifacts/${appId}/public/data/cidadaos`, cpfLimpo), cidPayload, { merge: true });

        const atdUpdate = {};
        const CIDADAO_KEYS = [
          'tituloEleitor','tituloEleitorZona','tituloEleitorSecao','escolaridade','religiao',
          'orientacaoSexual','identidadeGenero','telefone','sexo','cor','dataNascimento','nis',
          'conjuge','origemDemanda','origemDemandaEspecificar','origemDemandaCompleta',
          'estudando','estudandoDescricao','tratamentoSaude','tratamentoSaudeDescricao',
          'presoOuDetido','processoJustica','interesseCurso','interesseCursoQual',
          'habilidadesProfissionais','refFamiliarNome','refFamiliarTelefone','refFamiliarCep','refFamiliarEndereco',
          'doencas_mentais','doencas_mentais_outro','deficiencia','deficiencia_qual',
          'substancias_psicoativas','substancias_ilicito_outro',
        ];
        CIDADAO_KEYS.forEach(k => { if (k in cidPayload) atdUpdate[`cidadao.${k}`] = cidPayload[k]; });
        batch.update(doc(db, `artifacts/${appId}/public/data/atendimentos`, atendimentoAtual.id), atdUpdate);
        await batch.commit();

        const ilicitasIds = SUBSTANCIAS_ILICITAS.map(s => s.id);
        setRmaData(prev => ({
          ...prev,
          moradia_rua:fs.moradia_rua, moradia_amigos:fs.moradia_amigos, moradia_acolhimento:fs.moradia_acolhimento,
          substancias:fs.substancias, substancias_ilicito_outro:fs.substancias_ilicito_outro,
          b1_drogas_ilicitas: (fs.substancias || []).some(s => ilicitasIds.includes(s)),
          b3_doencas:fs.b3_doencas, b3_doencas_outro:fs.b3_doencas_outro,
          b3_doenca_mental: (fs.b3_doencas || []).length > 0,
          b2_deficiencia:fs.b2_deficiencia, b2_deficiencia_qual:fs.b2_deficiencia_qual,
          b3_migrante:fs.b3_migrante, b2_migrante:fs.b3_migrante,
          b3_origem:fs.b3_origem, b3_tipo_migracao:fs.b3_tipo_migracao,
          violacoes:fs.violacoes, encaminhamentos_externos:fs.encaminhamentos_externos,
          encaminhamento_recebido:fs.encaminhamento_recebido, encaminhamento_recebido_resultado:fs.encaminhamento_recebido_resultado,
          beneficio_bolsa_familia:fs.beneficio_bolsa_familia, beneficio_bpc:fs.beneficio_bpc,
          beneficios_eventuais:fs.beneficios_eventuais, beneficio_outro_qual:fs.beneficio_outro_qual,
          acao_estudo_caso:fs.acao_estudo_caso, acao_plano_individual:fs.acao_plano_individual,
          acao_familia_mobilizada:fs.acao_familia_mobilizada,
          acao_endereco_institucional:fs.acao_endereco_institucional, acao_capacitacao:fs.acao_capacitacao,
        }));

        originalRef.current = { ...fs };
        setIsDirty(false);
        setLastSaved(new Date());
        onSaveSuccess?.();
        return true;
      } catch (err) {
        console.error('[FichaAtendimentoTecnico] salvar():', err);
        alert('Erro ao salvar ficha. Tente novamente.');
        return false;
      } finally { setLoading(false); }
    };

    const descartarAlteracoes = () => {
      if (originalRef.current) { setFs({ ...originalRef.current }); setIsDirty(false); }
    };

    useImperativeHandle(ref, () => ({ salvar, hasUnsavedChanges: () => isDirty, discardChanges: descartarAlteracoes }));

    if (!atendimentoAtual?.cidadao) return null;
    const c = atendimentoAtual.cidadao;

    return (
      <Card className="overflow-hidden border-t-4 border-t-blue-700 shadow-md">
        {/* Topo */}
        <div style={{ padding:'10px 16px', background:'var(--color-background-secondary)', borderBottom:'1px solid var(--color-border-tertiary)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <div>
            <p style={{ fontSize:12, fontWeight:700, margin:0, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--color-text-primary)' }}>Ficha de Atendimento Social</p>
            <p style={{ fontSize:11, color:'var(--color-text-secondary)', margin:'2px 0 0' }}>Centro POP Centro — {atendimentoAtual.tipo_nome || 'Atendimento Técnico'}</p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {isDirty && <span style={{ fontSize:10.5, fontWeight:700, color:'#92400e', background:'#fef3c7', border:'1px solid #fcd34d', padding:'2px 10px', borderRadius:99, display:'flex', alignItems:'center', gap:4 }}><AlertTriangle size={11} /> Alterações não salvas</span>}
            {lastSaved && !isDirty && <span style={{ fontSize:10.5, color:'var(--color-text-tertiary)' }}>Salvo às {lastSaved.toLocaleTimeString()}</span>}
          </div>
        </div>

        {/* Corpo */}
        <div style={{ padding:16, overflowY:'auto', maxHeight:'80vh' }}>

          {/* 1. IDENTIFICAÇÃO */}
          <SecaoFicha numero={1} titulo="Identificação" icon={User} cor="#1e40af" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <ReadOnlyField label="Nome completo" value={c.nome} />
            <ReadOnlyField label="CPF" value={c.cpf} />
            <ReadOnlyField label="Data de nascimento" value={normalizeDateForInput(c.dataNascimento)} />
            <ReadOnlyField label="Naturalidade / UF" value={[c.naturalidade, c.uf].filter(Boolean).join(' – ')} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FieldSelect label="Sexo" value={get('sexo')||''} onChange={e=>handleChange('sexo',e.target.value)}>
              <option value="">Selecione</option>
              {['Masculino','Feminino','Outro'].map(o=><option key={o}>{o}</option>)}
            </FieldSelect>
            <FieldSelect label="Cor / Raça" value={get('cor')||''} onChange={e=>handleChange('cor',e.target.value)}>
              <option value="">Selecione</option>
              {['Branca','Preta / Negra','Parda','Amarela','Indígena'].map(o=><option key={o}>{o}</option>)}
            </FieldSelect>
            <FieldSelect label="Identidade de gênero" value={get('identidadeGenero')||''} onChange={e=>handleChange('identidadeGenero',e.target.value)}>
              <option value="">Selecione</option>
              {['Homem cisgênero','Mulher cisgênero','Homem transgênero','Mulher transgênera','Não binário','Travesti','Prefiro não informar'].map(o=><option key={o}>{o}</option>)}
            </FieldSelect>
            {/* ATUALIZADO — conforme Seção 3 e colunas L/G/B/T da Seção 5 do RMA */}
            <FieldSelect label="Orientação sexual" value={get('orientacaoSexual')||''} onChange={e=>handleChange('orientacaoSexual',e.target.value)}>
              <option value="">Selecione</option>
              <option value="Heterossexual">Heterossexual</option>
              <option value="Lésbica">Lésbica</option>
              <option value="Gay">Gay</option>
              <option value="Homossexual">Homossexual (não especificado)</option>
              <option value="Bissexual">Bissexual</option>
              <option value="Travesti">Travesti</option>
              <option value="Transexual">Transexual</option>
              <option value="Prefiro não informar">Prefiro não informar</option>
            </FieldSelect>
          </div>

          {/* 2. DOCUMENTAÇÃO */}
          <SecaoFicha numero={2} titulo="Documentação" icon={FileText} cor="#0f766e" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FieldInput label="NIS" value={get('nis')||''} onChange={e=>handleChange('nis',e.target.value)} placeholder="Nº NIS" />
            <FieldInput label="Título de eleitor" value={get('tituloEleitor')||''} onChange={e=>handleChange('tituloEleitor',e.target.value)} placeholder="Nº" />
            <FieldInput label="Zona" value={get('tituloEleitorZona')||''} onChange={e=>handleChange('tituloEleitorZona',e.target.value)} placeholder="Zona" />
            <FieldInput label="Seção" value={get('tituloEleitorSecao')||''} onChange={e=>handleChange('tituloEleitorSecao',e.target.value)} placeholder="Seção" />
          </div>

          {/* 3. CONTATO E ORIGEM */}
          <SecaoFicha numero={3} titulo="Contato e Origem da Demanda" icon={Phone} cor="#7c3aed" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <FieldInput label="Telefone" value={get('telefone')||''} onChange={e=>handleChange('telefone',e.target.value)} placeholder="(00) 00000-0000" />
            <FieldInput label="Cônjuge / Companheiro(a)" value={get('conjuge')||''} onChange={e=>handleChange('conjuge',e.target.value)} placeholder="Nome" />
            <FieldSelect label="Origem da demanda" value={get('origemDemanda')||''} onChange={e=>handleChange('origemDemanda',e.target.value)}>
              <option value="">Selecione</option>
              {opcoesOrigem.map(o=><option key={o}>{o}</option>)}
            </FieldSelect>
          </div>
          {precisaEspecificar(get('origemDemanda')) && (
            <FieldInput className="mt-2" label={`Especificar: ${get('origemDemanda')}`} value={get('origemDemandaEspecificar')||''} required onChange={e=>handleChange('origemDemandaEspecificar',e.target.value)} placeholder={`Qual ${get('origemDemanda')}...`} />
          )}

          {/* 3.5 ENCAMINHAMENTO RECEBIDO — Section 8 do RMA */}
          <div style={{ marginTop:12, background:'#E6F1FB20', border:'1px solid #B5D4F4', borderRadius:8, padding:'10px 12px' }}>
            <p style={{ fontSize:10, fontWeight:700, color:'#0C447C', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
              Esta visita foi motivada por encaminhamento externo?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldSelect label="Serviço que encaminhou para o Centro POP" value={get('encaminhamento_recebido')||''} onChange={e=>handleChange('encaminhamento_recebido',e.target.value)}>
                <option value="">Não — veio espontaneamente</option>
                {ORIGENS_ENCAMINHAMENTO_RECEBIDO.map(o=><option key={o} value={o}>{o}</option>)}
              </FieldSelect>
              {get('encaminhamento_recebido') && get('encaminhamento_recebido') !== '' && (
                <FieldInput label="O que foi feito / resultado" value={get('encaminhamento_recebido_resultado')||''} onChange={e=>handleChange('encaminhamento_recebido_resultado',e.target.value)} placeholder="Ex: Acolhida, escuta, inclusão no CadÚnico..." />
              )}
            </div>
          </div>

          {/* 4. PERFIL SOCIAL */}
          <SecaoFicha numero={4} titulo="Perfil Social" icon={BookOpen} cor="#b45309" />
          <div className="grid grid-cols-2 gap-3">
            <FieldSelect label="Escolaridade" value={get('escolaridade')||''} onChange={e=>handleChange('escolaridade',e.target.value)}>
              <option value="">Selecione</option>
              {['Não alfabetizado','Fundamental Incompleto','Fundamental Completo','Médio Incompleto','Médio Completo','Superior Incompleto','Superior Completo','Pós-graduação'].map(o=><option key={o}>{o}</option>)}
            </FieldSelect>
            {/* ATUALIZADO — conforme Seção 3 do RMA Dezembro 2025 */}
            <FieldSelect label="Religião" value={get('religiao')||''} onChange={e=>handleChange('religiao',e.target.value)}>
              <option value="">Selecione</option>
              <option value="Católica">Católica</option>
              <option value="Protestante (Evangélica, Pentecostal e Neopentecostal)">Protestante (Evangélica, Pentecostal e Neopentecostal)</option>
              <option value="Espírita">Espírita</option>
              <option value="Afro-Brasileira">Afro-Brasileira</option>
              <option value="Testemunha de Jeová">Testemunha de Jeová</option>
              <option value="Religiões Orientais">Religiões Orientais</option>
              <option value="Sem Religião">Sem Religião</option>
              <option value="Outras">Outras</option>
            </FieldSelect>
          </div>

          {/* 5. SITUAÇÃO DE MORADIA */}
          <SecaoFicha numero={5} titulo="Situação de Moradia" icon={Home} cor="#15803d" />
          <p style={{ fontSize:11.5, color:'var(--color-text-secondary)', marginBottom:8 }}>Onde está pernoitando atualmente? (pode marcar mais de um)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <CheckOpcao checked={!!get('moradia_rua')} onChange={()=>handleChange('moradia_rua',!get('moradia_rua'))} label="Logradouros públicos / rua" subLabel="Praças, viadutos, embaixo de pontes" />
            <CheckOpcao checked={!!get('moradia_amigos')} onChange={()=>handleChange('moradia_amigos',!get('moradia_amigos'))} label="Casa de amigos, parentes ou conhecidos" />
            <CheckOpcao checked={!!get('moradia_acolhimento')} onChange={()=>handleChange('moradia_acolhimento',!get('moradia_acolhimento'))} label="Serviço de acolhimento institucional" />
          </div>

          {/* 6. SAÚDE */}
          <SecaoFicha numero={6} titulo="Condição de Saúde" icon={Heart} cor="#dc2626" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <FieldSelect label="Em acompanhamento por serviço de saúde?" value={get('tratamentoSaude')||'nao'} onChange={e=>handleChange('tratamentoSaude',e.target.value)}>
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </FieldSelect>
            {get('tratamentoSaude')==='sim' && (
              <FieldInput label="Qual serviço de saúde?" value={get('tratamentoSaudeDescricao')||''} onChange={e=>handleChange('tratamentoSaudeDescricao',e.target.value)} placeholder="Ex: CAPS AD, UBS Liberdade, Hospital..." />
            )}
          </div>
          <Label>Doença ou transtorno mental identificado</Label>
          <p style={{ fontSize:11, color:'var(--color-text-secondary)', marginBottom:6 }}>Use critério técnico. Histórico salvo na ficha permanente do usuário.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2">
            {DOENCAS_MENTAIS.map(d=>(
              <CheckOpcao key={d.id} checked={inArr('b3_doencas',d.id)} onChange={()=>toggleArr('b3_doencas',d.id)} label={d.label} />
            ))}
          </div>
          {inArr('b3_doencas','outro_mental') && (
            <FieldInput className="mb-2 ml-5" label="Especificar diagnóstico" value={get('b3_doencas_outro')||''} onChange={e=>handleChange('b3_doencas_outro',e.target.value)} placeholder="Descreva..." />
          )}
          <div className="mt-2">
            <CheckOpcao checked={!!get('b2_deficiencia')} onChange={()=>handleChange('b2_deficiencia',!get('b2_deficiencia'))} label="Pessoa com deficiência (física, auditiva, visual, intelectual ou múltipla)" />
            {get('b2_deficiencia') && (
              <FieldInput className="mt-1 ml-5" label="Tipo de deficiência" value={get('b2_deficiencia_qual')||''} onChange={e=>handleChange('b2_deficiencia_qual',e.target.value)} placeholder="Ex: deficiência visual, amputação..." />
            )}
          </div>

          {/* 7. SUBSTÂNCIAS */}
          <SecaoFicha numero={7} titulo="Uso de Substâncias Psicoativas" icon={Pill} cor="#ea580c" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Drogas ilícitas</Label>
              <div className="space-y-1">
                {SUBSTANCIAS_ILICITAS.map(s=>(
                  <CheckOpcao key={s.id} checked={inArr('substancias',s.id)} onChange={()=>toggleArr('substancias',s.id)} label={s.label} />
                ))}
              </div>
              {inArr('substancias','outro_ilicito') && (
                <FieldInput className="mt-1" label="Qual droga ilícita?" value={get('substancias_ilicito_outro')||''} onChange={e=>handleChange('substancias_ilicito_outro',e.target.value)} placeholder="Especifique..." />
              )}
            </div>
            <div>
              <Label>Substâncias lícitas</Label>
              <div className="space-y-1">
                {SUBSTANCIAS_LICITAS.map(s=>(
                  <CheckOpcao key={s.id} checked={inArr('substancias',s.id)} onChange={()=>toggleArr('substancias',s.id)} label={s.label} />
                ))}
              </div>
            </div>
          </div>

          {/* 8. MIGRAÇÃO */}
          <SecaoFicha numero={8} titulo="Situação Migratória" icon={Globe} cor="#6d28d9" />
          <CheckOpcao
            checked={!!get('b3_migrante')}
            onChange={()=>{ migranteTouched.current=true; handleChange('b3_migrante',!get('b3_migrante')); }}
            label="Pessoa migrante (em mobilidade)"
            subLabel="No Centro POP de São Luís/MA: em passagem ou recém-chegada de outro município, estado ou país." />
          {get('b3_migrante') && (
            <div className="grid grid-cols-2 gap-3 mt-2 ml-5">
              <FieldInput label="Cidade / Estado / País de origem" value={get('b3_origem')||''} onChange={e=>handleChange('b3_origem',e.target.value)} placeholder="Ex: Codó/MA, Fortaleza/CE ou Venezuela" />
              <FieldSelect label="Tipo de migração" value={get('b3_tipo_migracao')||''} onChange={e=>handleChange('b3_tipo_migracao',e.target.value)}>
                <option value="">Selecione</option>
                {[['nacional','Nacional (outro município / estado)'],['internacional','Internacional'],['refugio','Solicitante de refúgio'],['refugiado','Refugiado reconhecido'],['apatrida','Apátrida'],['indocumentado','Indocumentado']].map(([v,l])=>
                  <option key={v} value={v}>{l}</option>)}
              </FieldSelect>
            </div>
          )}

          {/* 9. SITUAÇÃO JURÍDICA */}
          <SecaoFicha numero={9} titulo="Situação Jurídica" icon={Shield} cor="#374151" />
          <div className="grid grid-cols-2 gap-3">
            <FieldSelect label="Já foi preso ou detido?" value={get('presoOuDetido')||'nao'} onChange={e=>handleChange('presoOuDetido',e.target.value)}>
              <option value="nao">Não</option><option value="sim">Sim</option>
            </FieldSelect>
            <FieldSelect label="Possui processo na Justiça?" value={get('processoJustica')||'nao'} onChange={e=>handleChange('processoJustica',e.target.value)}>
              <option value="nao">Não</option><option value="sim">Sim</option>
            </FieldSelect>
          </div>

          {/* 10. EDUCAÇÃO E CAPACITAÇÃO */}
          <SecaoFicha numero={10} titulo="Educação e Capacitação" icon={Briefcase} cor="#0369a1" />
          <div className="grid grid-cols-2 gap-3 mb-2">
            <FieldSelect label="Está estudando?" value={get('estudando')||'nao'} onChange={e=>handleChange('estudando',e.target.value)}>
              <option value="nao">Não</option><option value="sim">Sim</option>
            </FieldSelect>
            {get('estudando')==='sim' && <FieldInput label="Série / Curso / Escola" value={get('estudandoDescricao')||''} onChange={e=>handleChange('estudandoDescricao',e.target.value)} placeholder="Descreva..." />}
            <FieldSelect label="Interesse em curso profissionalizante?" value={get('interesseCurso')||'nao'} onChange={e=>handleChange('interesseCurso',e.target.value)}>
              <option value="nao">Não</option><option value="sim">Sim</option>
            </FieldSelect>
            {get('interesseCurso')==='sim' && <FieldInput label="Área de interesse" value={get('interesseCursoQual')||''} onChange={e=>handleChange('interesseCursoQual',e.target.value)} placeholder="Ex: Informática, Pintura..." />}
          </div>
          <FieldTextarea label="Habilidades e experiências profissionais" value={get('habilidadesProfissionais')||''} onChange={e=>handleChange('habilidadesProfissionais',e.target.value)} placeholder="Relate experiências anteriores, habilidades manuais, artísticas..." />

          {/* 11. REFERÊNCIA FAMILIAR */}
          <SecaoFicha numero={11} titulo="Referência Familiar" icon={Users} cor="#065f46" />
          <div className="grid grid-cols-2 gap-3 mb-2">
            <FieldInput label="Nome da referência" value={get('refFamiliarNome')||''} onChange={e=>handleChange('refFamiliarNome',e.target.value)} placeholder="Nome completo" />
            <FieldInput label="Telefone" value={get('refFamiliarTelefone')||''} onChange={e=>handleChange('refFamiliarTelefone',e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div>
              <Label>CEP</Label>
              <div style={{ position:'relative' }}>
                <input type="text" value={get('refFamiliarCep')||''} onChange={e=>handleChange('refFamiliarCep',e.target.value)} placeholder="00000-000" className="w-full pl-3 pr-9 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" />
                <button type="button" onClick={consultarCep} disabled={loadingCep} style={{ position:'absolute', right:4, top:'50%', transform:'translateY(-50%)', padding:'3px 6px', background:'#dbeafe', color:'#1e40af', border:'none', borderRadius:5, cursor:'pointer' }}>
                  {loadingCep ? <div style={{ width:14, height:14, border:'2px solid #1e40af', borderTop:'2px solid transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }} /> : <Search size={14} />}
                </button>
              </div>
            </div>
            <FieldInput label="Endereço completo" value={get('refFamiliarEndereco')||''} onChange={e=>handleChange('refFamiliarEndereco',e.target.value)} placeholder="Rua, Número, Bairro, Cidade – UF" />
          </div>

          {/* 12. BENEFÍCIOS EVENTUAIS — Section 4 do RMA (parte do Psi/AS) */}
          {/* Bolsa Família e BPC são preenchidos pelo atendente CadÚnico em PainelAtendimento.jsx. */}
          {/* Os benefícios eventuais (aluguel social, recâmbio, etc) exigem parecer técnico — Psi/AS. */}
          <SecaoFicha numero={12} titulo="Benefícios Eventuais Concedidos" icon={DollarSign} cor="#0891b2" />
          <p style={{ fontSize:11.5, color:'var(--color-text-secondary)', marginBottom:8 }}>
            Registre os benefícios eventuais concedidos neste atendimento (concessão depende de avaliação técnica).
            <strong> Bolsa Família e BPC ficam a cargo do atendente do CadÚnico.</strong>
          </p>

          {/* Visualização read-only — informa ao Psi/AS o que o CadÚnico já marcou */}
          {(get('beneficio_bolsa_familia') || get('beneficio_bpc')) && (
            <div style={{ background:'#ecfeff', border:'1px solid #a5f3fc', borderRadius:8, padding:'8px 12px', marginBottom:10 }}>
              <p style={{ fontSize:10, fontWeight:700, color:'#0e7490', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>
                Benefícios cadastrais já registrados (preenchidos pelo CadÚnico)
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {get('beneficio_bolsa_familia') && (
                  <span style={{ fontSize:11, padding:'2px 10px', background:'#06b6d4', color:'#fff', borderRadius:99, fontWeight:600 }}>Bolsa Família</span>
                )}
                {get('beneficio_bpc') && (
                  <span style={{ fontSize:11, padding:'2px 10px', background:'#06b6d4', color:'#fff', borderRadius:99, fontWeight:600 }}>BPC</span>
                )}
              </div>
            </div>
          )}

          <Label>Benefício eventual acessado neste mês</Label>
          <div className="space-y-1">
            {[
              ['aluguel_social',  'Aluguel Social (Auxílio Moradia)'],
              ['recambio',        'Recâmbio (Benefício Auxílio Passagem)'],
              ['documentacao',    'Documentação Civil Básica'],
              ['auxilio_funeral', 'Auxílio Funeral'],
              ['outro_eventual',  'Outro benefício eventual'],
            ].map(([id, label]) => (
              <CheckOpcao key={id} checked={inArr('beneficios_eventuais',id)} onChange={()=>toggleArr('beneficios_eventuais',id)} label={label} />
            ))}
          </div>
          {inArr('beneficios_eventuais','outro_eventual') && (
            <FieldInput className="mt-1" label="Qual outro benefício?" value={get('beneficio_outro_qual')||''} onChange={e=>handleChange('beneficio_outro_qual',e.target.value)} placeholder="Especifique..." />
          )}

          {/* 13. VIOLAÇÃO DE DIREITOS */}
          <SecaoFicha numero={13} titulo="Violência e Violação de Direitos" icon={Shield} cor="#b91c1c" />
          <p style={{ fontSize:11.5, color:'var(--color-text-secondary)', marginBottom:8 }}>
            Marque as situações identificadas neste atendimento. Uso abusivo de SPA é derivado automaticamente da seção 7.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {VIOLACOES_DIREITOS.map(v=>(
              <CheckOpcao key={v.id} checked={inArr('violacoes',v.id)} onChange={()=>toggleArr('violacoes',v.id)} label={v.label} />
            ))}
          </div>

          {/* 14. ENCAMINHAMENTOS REALIZADOS */}
          <SecaoFicha numero={14} titulo="Encaminhamentos Realizados" icon={ArrowRightLeft} cor="#d97706" />
          <p style={{ fontSize:11.5, color:'var(--color-text-secondary)', marginBottom:8 }}>
            Registre encaminhamentos para serviços externos. Para acolhimento, indique o status.
          </p>
          {encList.length > 0 && (
            <div className="space-y-2 mb-3">
              {encList.map(enc=>(
                <div key={enc.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, padding:'8px 10px', background:'var(--color-background-secondary)', border:'1px solid var(--color-border-tertiary)', borderRadius:7 }}>
                  <div>
                    <p style={{ fontSize:12.5, fontWeight:600, margin:0 }}>{enc.destino}</p>
                    {enc.tipo && (
                      <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99, marginTop:2, display:'inline-block', background:'#FFF7ED', color:'#9A3412', border:'1px solid #FED7AA' }}>
                        {enc.tipo}
                      </span>
                    )}
                    {enc.status_acolhimento && (
                      <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99, marginTop:2, display:'inline-block', background: enc.status_acolhimento==='Acolhido' ? '#EAF3DE' : enc.status_acolhimento==='Indeferido' ? '#FCEBEB' : '#E6F1FB', color: enc.status_acolhimento==='Acolhido' ? '#3B6D11' : enc.status_acolhimento==='Indeferido' ? '#791F1F' : '#0C447C' }}>
                        {enc.status_acolhimento}
                      </span>
                    )}
                    {enc.resultado && <p style={{ fontSize:11, color:'var(--color-text-secondary)', margin:'2px 0 0' }}>{enc.resultado}</p>}
                  </div>
                  <button type="button" onClick={()=>removeEnc(enc.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', padding:2 }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ background:'var(--color-background-secondary)', border:'1px solid var(--color-border-tertiary)', borderRadius:8, padding:'10px 12px' }}>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2 mb-2">
              <div>
                <Label>Tipo</Label>
                <select
                  value={novoEnc.tipoSel}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNovoEnc((p) => ({
                      ...p,
                      tipoSel: value,
                      unidadeSel: '',
                      status_acolhimento: '',
                      novo_tipo: value === '__novo_tipo__' ? p.novo_tipo : '',
                      nova_unidade: '',
                    }));
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none"
                >
                  <option value="">Selecione</option>
                  {tiposEncaminhamento.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="__novo_tipo__">Outro (novo tipo)</option>
                </select>
                {novoEnc.tipoSel === '__novo_tipo__' && (
                  <FieldInput
                    className="mt-1"
                    label="Novo tipo"
                    value={novoEnc.novo_tipo}
                    onChange={(e) => setNovoEnc((p) => ({ ...p, novo_tipo: e.target.value }))}
                    placeholder="Ex: Assistência Social e Benefícios"
                  />
                )}
              </div>
              <div>
                <Label>Unidade</Label>
                {novoEnc.tipoSel && novoEnc.tipoSel !== '__novo_tipo__' ? (
                  <select
                    value={novoEnc.unidadeSel}
                    onChange={(e) => setNovoEnc((p) => ({ ...p, unidadeSel: e.target.value, status_acolhimento: '' }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none"
                  >
                    <option value="">Selecione</option>
                    {(unidadesPorTipo?.[novoEnc.tipoSel] || []).map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="__nova_unidade__">Outro (nova unidade)</option>
                  </select>
                ) : (
                  <FieldInput
                    label="Unidade"
                    value={novoEnc.nova_unidade}
                    onChange={(e) => setNovoEnc((p) => ({ ...p, nova_unidade: e.target.value }))}
                    placeholder="Ex: CRAS Coroadinho"
                  />
                )}
                {novoEnc.tipoSel && novoEnc.tipoSel !== '__novo_tipo__' && novoEnc.unidadeSel === '__nova_unidade__' && (
                  <FieldInput
                    className="mt-1"
                    label="Nova unidade"
                    value={novoEnc.nova_unidade}
                    onChange={(e) => setNovoEnc((p) => ({ ...p, nova_unidade: e.target.value }))}
                    placeholder="Ex: CRAS Coroadinho"
                  />
                )}
              </div>
            </div>
            <div className="mb-2">
              <CheckOpcao checked={!!novoEnc.salvar_opcao} onChange={() => setNovoEnc(p=>({...p, salvar_opcao: !p.salvar_opcao}))} label="Salvar esta unidade como opção para outros técnicos" />
            </div>
            {isAcolhimento(destinoParaAcolhimento) && (
              <div className="mb-2">
                <Label>Status do pedido de acolhimento</Label>
                <div className="flex gap-2 flex-wrap">
                  {['Solicitado','Deferido','Indeferido','Acolhido'].map(s=>(
                    <label key={s} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:99, cursor:'pointer', fontSize:11, fontWeight:600, border:`1px solid ${novoEnc.status_acolhimento===s ? '#2563eb' : 'var(--color-border-tertiary)'}`, background: novoEnc.status_acolhimento===s ? '#E6F1FB' : 'var(--color-background-primary)', color: novoEnc.status_acolhimento===s ? '#1e40af' : 'var(--color-text-secondary)' }}>
                      <input type="radio" name="status_enc" value={s} checked={novoEnc.status_acolhimento===s} onChange={()=>setNovoEnc(p=>({...p, status_acolhimento:s}))} style={{ display:'none' }} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <FieldInput label="Resultado / observação" value={novoEnc.resultado} onChange={e=>setNovoEnc(p=>({...p, resultado:e.target.value}))} placeholder="Ex: Usuário acolhido, certidão emitida..." />
            <button type="button" onClick={addEnc} disabled={!canAddEnc || addingEnc} style={{ display:'flex', alignItems:'center', gap:4, padding:'7px 14px', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', background: (canAddEnc && !addingEnc) ? '#d97706' : '#9ca3af', color:'#fff', border:'none', borderRadius:7, cursor: (canAddEnc && !addingEnc) ? 'pointer' : 'not-allowed' }}>
              <Plus size={14} /> Adicionar
            </button>
          </div>

          {/* 15. AÇÕES TÉCNICAS */}
          <SecaoFicha numero={15} titulo="Ações Técnicas Complementares" icon={ClipboardList} cor="#4b5563" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-4">
            {[
              ['acao_estudo_caso',           'Estudo de caso realizado'],
              ['acao_plano_individual',       'Plano de acompanhamento individual elaborado ou monitorado'],
              ['acao_familia_mobilizada',     'Família extensa / ampliada localizada ou mobilizada'],
              ['acao_endereco_institucional', 'Endereço institucional fornecido como referência'],
              ['acao_capacitacao',            'Encaminhado para capacitação profissional ou mercado de trabalho'],
            ].map(([field,label])=>(
              <CheckOpcao key={field} checked={!!get(field)} onChange={()=>handleChange(field,!get(field))} label={label} />
            ))}
          </div>

          {/* Rodapé */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:12, borderTop:'1px solid var(--color-border-tertiary)', marginTop:4 }}>
            <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>
              {lastSaved ? `Salvo às ${lastSaved.toLocaleTimeString()}` : isDirty ? 'Alterações pendentes' : ''}
            </span>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {isDirty && <button type="button" onClick={descartarAlteracoes} style={{ fontSize:11, color:'#dc2626', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Descartar</button>}
              <Button variant={isDirty?'primary':'secondary'} icon={Save} onClick={salvar} isLoading={loading} className={isDirty?'animate-pulse':''}>
                {isDirty ? 'Salvar Ficha' : 'Ficha Salva'}
              </Button>
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </Card>
    );
  }
);

export default FichaAtendimentoTecnico;

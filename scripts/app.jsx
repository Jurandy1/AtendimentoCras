// CORREÇÃO: Removido o 'import' do react.
// Agora pegamos o React do objeto global 'window.React'.
const { useState, useEffect, useMemo, useCallback } = React;

// Importação de módulos Firebase (assumidos como globais/disponíveis)
const {
  initializeApp: _ia, getAuth: _ga, getFirestore, setLogLevel, onAuthStateChanged, signInWithCustomToken, signInAnonymously,
  query, collection, limit, getDocs, onSnapshot, where, doc, updateDoc, addDoc, deleteDoc,
  serverTimestamp, Timestamp, getDoc, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} = window.firebaseModules || {};

// --- UTILS (Funções Auxiliares) ---
const COR_PRINCIPAL = "#1351B4";
const COR_PRINCIPAL_HOVER = "#104191";
const CORES_STATUS = { aguardando: "bg-yellow-100 text-yellow-800 border-yellow-300", chamando: "bg-blue-100 text-blue-800 border-blue-300", em_atendimento: "bg-green-100 text-green-800 border-green-300", finalizado: "bg-gray-100 text-gray-700 border-gray-300" };
const CORES_TIPO_PADRAO = ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#8E24AA', '#D81B60', '#00ACC1', '#FB8C00'];
const LOGO_URL = window.__logo_url || 'https://placehold.co/200x60/FFFFFF/1351B4?text=SEMCAS';

const maskCPF = (cpf) => { if (!cpf) return "Não informado"; const cleaned = cpf.replace(/\D/g, ''); if (cleaned.length !== 11) return "CPF inválido"; return `${cleaned.substring(0, 3)}.***.***-${cleaned.substring(9, 11)}`; };
const formatTime = (timestamp) => { if (!timestamp || !timestamp.toDate) return "--:--"; return timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const formatDateTime = (timestamp) => { if (!timestamp || !timestamp.toDate) return "-"; return timestamp.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const calculateWaitTime = (horaChegada) => { if (!horaChegada || !horaChegada.toDate) return "0 min"; const now = new Date(); const arrived = horaChegada.toDate(); const diffMs = now.getTime() - arrived.getTime(); const diffMin = Math.round(diffMs / (1000 * 60)); return `${diffMin} min`; };
const calculateDuration = (horaInicio, horaFim) => { if (!horaInicio || !horaFim || !horaInicio.toDate || !horaFim.toDate) return "-"; const start = horaInicio.toDate(); const end = horaFim.toDate(); const diffMs = end.getTime() - start.getTime(); const diffMin = Math.max(1, Math.round(diffMs / (1000 * 60))); return `${diffMin} min`; };
const getStartOfToday = () => { const today = new Date(); today.setHours(0, 0, 0, 0); return today; };


// --- ICONS (Ícones Simples com Emoji) ---
const Icon = ({ children, size = 20, className = '' }) => (
  <span className={className} style={{ fontSize: `${size}px`, display: 'inline-block', lineHeight: 1 }}>
    {children}
  </span>
);

const Home = (p) => <Icon {...p}>🏠</Icon>;
const Tv = (p) => <Icon {...p}>📺</Icon>;
const Users = (p) => <Icon {...p}>👥</Icon>;
const LayoutDashboard = (p) => <Icon {...p}>📊</Icon>;
const FileText = (p) => <Icon {...p}>🧾</Icon>;
const Settings = (p) => <Icon {...p}>⚙️</Icon>;
const LogOut = (p) => <Icon {...p}>↩️</Icon>;
const Menu = (p) => <Icon {...p} size={28}>☰</Icon>;
const X = (p) => <Icon {...p}>✖️</Icon>;
const Printer = (p) => <Icon {...p}>🖨️</Icon>;
const Plus = (p) => <Icon {...p}>＋</Icon>;
const Edit = (p) => <Icon {...p}>✏️</Icon>;
const Trash2 = (p) => <Icon {...p}>🗑️</Icon>;
const ChevronRight = (p) => <Icon {...p}>›</Icon>;
const Clock = (p) => <Icon {...p}>⏰</Icon>;
const CheckCircle = (p) => <Icon {...p}>✅</Icon>;
const AlertCircle = (p) => <Icon {...p}>⚠️</Icon>;
const UserPlus = (p) => <Icon {...p}>➕👤</Icon>;
const Building = (p) => <Icon {...p}>🏢</Icon>;
const UserCog = (p) => <Icon {...p}>🧑‍💼</Icon>;
const Palette = (p) => <Icon {...p}>🎨</Icon>;
const Copy = (p) => <Icon {...p}>📋</Icon>;
const ExternalLink = (p) => <Icon {...p}>🔗</Icon>;
const Eye = (p) => <Icon {...p}>👁️</Icon>;
const EyeOff = (p) => <Icon {...p}>🙈</Icon>;
const Download = (p) => <Icon {...p}>⬇️</Icon>;
const Calendar = (p) => <Icon {...p}>📅</Icon>;
const Filter = (p) => <Icon {...p}>🔍</Icon>;
const PieChart = (p) => <Icon {...p}>🥧</Icon>;
const BarChart2 = (p) => <Icon {...p}>📉</Icon>;
const Loader = ({ className = '', style }) => <div className={`animate-spin ${className}`} style={style}>⏳</div>;


// --- COMPONENTES FILHOS ---

const GerenciarCRAS = ({ db, appId, crasUnidades, setCrasUnidades }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ nome: '' });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const collectionPath = `artifacts/${appId}/public/data/cras_unidades`;

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const resetForm = () => { setFormData({ nome: '' }); setEditingId(null); setShowModal(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, collectionPath, editingId), formData);
      } else {
        await addDoc(collection(db, collectionPath), formData);
      }
      resetForm();
    } catch (error) { console.error("Erro ao salvar CRAS:", error); }
  };

  const handleEdit = (unidade) => { setFormData({ nome: unidade.nome }); setEditingId(unidade.id); setShowModal(true); };
  const handleDelete = async (id) => { try { await deleteDoc(doc(db, collectionPath, id)); } catch (error) { console.error("Erro ao deletar CRAS:", error); } };

  const getPanelUrl = (id) => `${window.location.origin}${window.location.pathname}?page=PainelTV&cras_id=${id}`;
  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); } catch { }
    document.body.removeChild(textArea);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold">Gerenciar Unidades CRAS</h3>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors">
          <Plus size={18} className="mr-2" /> Nova Unidade
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h4 className="text-xl font-semibold mb-4">{editingId ? 'Editar Unidade' : 'Nova Unidade'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input name="nome" value={formData.nome} onChange={handleChange} placeholder="Nome da Unidade" required className="w-full p-2 border rounded-lg" />
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (<p>Carregando unidades...</p>) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Nome</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Link do Painel</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {crasUnidades.map(unidade => (
                <tr key={unidade.id}>
                  <td className="p-3">{unidade.nome}</td>
                  <td className="p-3">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => copyToClipboard(getPanelUrl(unidade.id))} title="Copiar Link" className="text-blue-600 hover:text-blue-800"><Copy size={16} /></button>
                      <a href={getPanelUrl(unidade.id)} target="_blank" rel="noopener noreferrer" title="Abrir Painel" className="text-blue-600 hover:text-blue-800"><ExternalLink size={16} /></a>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex space-x-2">
                      <button onClick={() => handleEdit(unidade)} className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
                      <button onClick={() => handleDelete(unidade.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const GerenciarAtendentes = ({ db, appId, crasUnidades, tiposAtendimento, atendentesList, userProfile }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ nome: '', email: '', senha: '', cras_id: '', guiche: '', tipos_atende: [] });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const collectionPath = `artifacts/${appId}/public/data/atendentes`;

  const getTipoNome = (id) => tiposAtendimento.find(t => t.id === id)?.nome || 'Desconhecido';
  const getTipoCor = (id) => tiposAtendimento.find(t => t.id === id)?.cor || '#777';
  const getCrasNome = (id) => crasUnidades.find(c => c.id === id)?.nome || 'Sem CRAS';

  const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
  const handleTipoToggle = (tipoId) => {
    setFormData(prev => {
      const tipos = prev.tipos_atende || [];
      return { ...prev, tipos_atende: tipos.includes(tipoId) ? tipos.filter(id => id !== tipoId) : [...tipos, tipoId] };
    });
  };

  const resetForm = () => { setFormData({ nome: '', email: '', senha: '', cras_id: userProfile?.cras_id || '', guiche: '', tipos_atende: [] }); setEditingId(null); setShowModal(false); setShowPassword(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db) return;
    const dataToSave = { ...formData };
    if (!editingId && !dataToSave.senha) { return; }
    if (editingId && !dataToSave.senha) { delete dataToSave.senha; }

    try {
      if (editingId) {
        await updateDoc(doc(db, collectionPath, editingId), dataToSave);
      } else {
        await addDoc(collection(db, collectionPath), dataToSave);
      }
      resetForm();
    } catch (error) { console.error("Erro ao salvar Atendente:", error); }
  };

  const handleEdit = (atendente) => {
    setFormData({ nome: atendente.nome, email: atendente.email, senha: '', cras_id: atendente.cras_id, guiche: atendente.guiche, tipos_atende: atendente.tipos_atende || [] });
    setEditingId(atendente.id);
    setShowModal(true);
  };
  const handleDelete = async (id) => { try { await deleteDoc(doc(db, collectionPath, id)); } catch (error) { console.error("Erro ao deletar Atendente:", error); } };

  const listFiltered = (userProfile?.role === 'coordenadora' && userProfile?.cras_id) ? atendentesList.filter(a => a.cras_id === userProfile.cras_id) : atendentesList;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold">Gerenciar Atendentes</h3>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors">
          <UserCog size={18} className="mr-2" /> Novo Atendente
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h4 className="text-xl font-semibold mb-4">{editingId ? 'Editar Atendente' : 'Novo Atendente'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input name="nome" value={formData.nome} onChange={handleChange} placeholder="Nome Completo" required className="w-full p-2 border rounded-lg" />
              <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Email" required className="w-full p-2 border rounded-lg" />
              <div className="relative">
                <input name="senha" type={showPassword ? 'text' : 'password'} value={formData.senha} onChange={handleChange} placeholder={editingId ? 'Deixe em branco para não alterar' : 'Senha'} required={!editingId} className="w-full p-2 border rounded-lg pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <select name="cras_id" value={formData.cras_id} onChange={handleChange} required className="w-full p-2 border rounded-lg bg-white" disabled={userProfile?.role !== 'superintendente'}>
                <option value="">Selecione a Unidade CRAS</option>
                {crasUnidades.map(cras => (<option key={cras.id} value={cras.id}>{cras.nome}</option>))}
              </select>
              <input name="guiche" value={formData.guiche} onChange={handleChange} placeholder="Nº do Guichê" required className="w-full p-2 border rounded-lg" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipos de Atendimento:</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border p-2 rounded-lg">
                  {tiposAtendimento.map(tipo => (
                    <label key={tipo.id} className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={formData.tipos_atende.includes(tipo.id)} onChange={() => handleTipoToggle(tipo.id)} className="rounded" />
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getTipoCor(tipo.id), color: '#fff' }}>{getTipoNome(tipo.id)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (<p>Carregando atendentes...</p>) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Nome</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">CRAS</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Guichê</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Tipos</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {listFiltered.map(a => (
                <tr key={a.id}>
                  <td className="p-3">{a.nome}</td>
                  <td className="p-3">{getCrasNome(a.cras_id)}</td>
                  <td className="p-3">{a.guiche}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {(a.tipos_atende || []).map(id => (<span key={id} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getTipoCor(id), color: '#fff' }}>{getTipoNome(id)}</span>))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex space-x-2">
                      <button onClick={() => handleEdit(a)} className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
                      <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const GerenciarTipos = ({ db, appId, tiposAtendimento, setTiposAtendimento }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ nome: '', cor: CORES_TIPO_PADRAO[0], ordem: 0 });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const collectionPath = `artifacts/${appId}/public/data/tipos_atendimento`;

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseInt(value) : value }));
  };
  const resetForm = () => { setFormData({ nome: '', cor: CORES_TIPO_PADRAO[0], ordem: 0 }); setEditingId(null); setShowModal(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, collectionPath, editingId), formData);
      } else {
        await addDoc(collection(db, collectionPath), formData);
      }
      resetForm();
    } catch (error) { console.error("Erro ao salvar Tipo de Atendimento:", error); }
  };

  const handleEdit = (tipo) => { setFormData({ nome: tipo.nome, cor: tipo.cor, ordem: tipo.ordem || 0 }); setEditingId(tipo.id); setShowModal(true); };
  const handleDelete = async (id) => { try { await deleteDoc(doc(db, collectionPath, id)); } catch (error) { console.error("Erro ao deletar Tipo de Atendimento:", error); } };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold">Gerenciar Tipos de Atendimento</h3>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors">
          <Palette size={18} className="mr-2" /> Novo Tipo
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h4 className="text-xl font-semibold mb-4">{editingId ? 'Editar Tipo' : 'Novo Tipo'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input name="nome" value={formData.nome} onChange={handleChange} placeholder="Nome" required className="w-full p-2 border rounded-lg" />
              <input name="ordem" type="number" value={formData.ordem} onChange={handleChange} placeholder="Ordem" required className="w-full p-2 border rounded-lg" />
              <div>
                <div className="flex flex-wrap gap-2">
                  {CORES_TIPO_PADRAO.map(cor => (
                    <button type="button" key={cor} onClick={() => setFormData(prev => ({ ...prev, cor }))} className={`w-8 h-8 rounded-full border-2 ${formData.cor === cor ? 'border-blue-600 ring-2 ring-blue-300' : 'border-transparent'}`} style={{ backgroundColor: cor }}></button>
                  ))}
                  <input type="color" name="cor" value={formData.cor} onChange={handleChange} className="w-10 h-8 p-0 border-none rounded-lg cursor-pointer" />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingId ? 'Atualizar' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (<p>Carregando tipos de atendimento...</p>) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Cor</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Nome</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Ordem</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tiposAtendimento.map(tipo => (
                <tr key={tipo.id}>
                  <td className="p-3"><div className="w-6 h-6 rounded-md" style={{ backgroundColor: tipo.cor }}></div></td>
                  <td className="p-3">{tipo.nome}</td>
                  <td className="p-3">{tipo.ordem}</td>
                  <td className="p-3">
                    <div className="flex space-x-2">
                      <button onClick={() => handleEdit(tipo)} className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
                      <button onClick={() => handleDelete(tipo.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

function GerenciarUsuarios({ db, appId, crasUnidades, userProfile, auth }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ email: '', nome: '', role: 'recepcionista', cras_id: '', senha: '' });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const collectionPath = `artifacts/${appId}/public/data/users_by_email`;

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, collectionPath));
    const unsub = onSnapshot(q, (snap) => {
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (userProfile?.role === 'coordenadora' && userProfile?.cras_id) {
        list = list.filter(u => u.cras_id === userProfile.cras_id);
      }
      setUsuarios(list);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [db, appId]);

  const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
  const resetForm = () => { setFormData({ email: '', nome: '', role: 'recepcionista', cras_id: userProfile?.role === 'coordenadora' ? (userProfile.cras_id || '') : '', senha: '' }); setEditingId(null); setShowModal(false); setSaving(false); setError(null); setSuccess(null); };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db || !formData.email) return;
    if (userProfile?.role === 'coordenadora' && !['recepcionista','atendente'].includes(formData.role)) { setError('Coordenadora só pode criar Recepcionista ou Atendente.'); return; }
    const ref = doc(db, collectionPath, formData.email);
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      // Tenta criar via Cloud Function primeiro
      let cfOk = false; let genPwd = null;
      if (auth) {
        try {
          const token = await auth.currentUser.getIdToken();
          const cfUrl = (window.__cf_url) || `https://us-central1-crasatendimento-35796.cloudfunctions.net/createUser?appId=${appId}`;
          const resp = await fetch(cfUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ email: formData.email, password: formData.senha || '', nome: formData.nome || '', role: formData.role, cras_id: formData.cras_id || '' }) });
          const data = await resp.json().catch(() => ({}));
          if (resp.ok) { cfOk = true; genPwd = data.passwordGenerated || null; }
        } catch (_) {}
      }
      // Criar usuário no Firebase Authentication usando uma instância secundária
      if (!cfOk && auth && formData.email) {
        try {
          const cfg = auth.app.options || {};
          const secName = `secondary-${Date.now()}`;
          const secApp = _ia(cfg, secName);
          const secAuth = _ga(secApp);
          const pwd = formData.senha && formData.senha.length >= 6 ? formData.senha : Math.random().toString(36).slice(-10);
          let uidCreated = null;
          try {
            const cred = await createUserWithEmailAndPassword(secAuth, formData.email, pwd);
            uidCreated = cred?.user?.uid || null;
          } catch (eAuth) {
            if (!(eAuth && eAuth.code === 'auth/email-already-in-use')) throw eAuth;
          }
          if (uidCreated) {
            try {
              const uref = doc(db, `artifacts/${appId}/public/data/users`, uidCreated);
              await setDoc(uref, { email: formData.email, nome: formData.nome || '', role: formData.role, cras_id: formData.cras_id || '' });
            } catch (_) {}
          }
        } catch (eInit) {
          // ignora falha de criação no Auth para não bloquear perfil
        }
      }
      if (editingId) { await updateDoc(ref, formData); } else { await setDoc(ref, formData); }
      if (cfOk && genPwd) { setSuccess(`Usuário criado. Senha: ${genPwd}`); }
      resetForm();
    } catch (e2) { setSaving(false); setError('Permissão insuficiente ou erro ao salvar.'); }
  };
  const handleEdit = (u) => { setFormData({ email: u.email, nome: u.nome || '', role: u.role || 'recepcionista', cras_id: u.cras_id || '' }); setEditingId(u.id); setShowModal(true); setError(null); };
  const handleDelete = async (id) => { try { await deleteDoc(doc(db, collectionPath, id)); } catch (e3) { setError('Permissão insuficiente ou erro ao deletar.'); } };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold">Gerenciar Usuários</h3>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700">Novo Usuário</button>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h4 className="text-xl font-semibold mb-4">{editingId ? 'Editar Usuário' : 'Novo Usuário'}</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Email" required className="w-full p-2 border rounded" />
              <input name="nome" value={formData.nome} onChange={handleChange} placeholder="Nome" className="w-full p-2 border rounded" />
              <input name="senha" type="password" value={formData.senha} onChange={handleChange} placeholder="Senha inicial (mín. 6, opcional)" className="w-full p-2 border rounded" />
              <select name="role" value={formData.role} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                <option value="recepcionista">Recepcionista</option>
                <option value="atendente">Atendente</option>
                {userProfile?.role === 'superintendente' && (<>
                  <option value="coordenadora">Coordenadora</option>
                  <option value="superintendente">Superintendente</option>
                </>)}
              </select>
              <select name="cras_id" value={formData.cras_id} onChange={handleChange} className="w-full p-2 border rounded bg-white" disabled={userProfile?.role === 'coordenadora'}>
                <option value="">Sem CRAS</option>
                {crasUnidades.map(cras => (<option key={cras.id} value={cras.id}>{cras.nome}</option>))}
              </select>
              {success && <p className="text-green-600 text-sm">{success}</p>}
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded">{saving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Salvar')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {loading ? (<p>Carregando usuários...</p>) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Email</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Nome</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Papel</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">CRAS</th>
                <th className="p-3 text-left text-sm font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.nome}</td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">{crasUnidades.find(c => c.id === u.cras_id)?.nome || '-'}</td>
                  <td className="p-3">
                    <div className="flex space-x-2">
                      <button onClick={() => handleEdit(u)} className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
                      <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Administracao = (props) => {
  const [activeTab, setActiveTab] = useState('cras');
  const role = props.userProfile?.role || '';
  const tabsAll = [
    { id: 'cras', label: 'Unidades CRAS', icon: Building },
    { id: 'atendentes', label: 'Atendentes', icon: UserCog },
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'tipos', label: 'Tipos de Atendimento', icon: Palette }
  ];
  const tabs = role === 'superintendente' ? tabsAll : role === 'coordenadora' ? tabsAll.filter(t => ['atendentes','usuarios'].includes(t.id)) : [];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'cras': return <GerenciarCRAS {...props} />;
      case 'atendentes': return <GerenciarAtendentes {...props} />;
      case 'usuarios': return <GerenciarUsuarios {...props} />;
      case 'tipos': return <GerenciarTipos {...props} />;
      default: return null;
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Administração do Sistema</h2>
      {tabs.length === 0 && (<p className="text-gray-600">Você não tem acesso a esta área.</p>)}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          {tabs.map(tab => {
            const IconC = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                <IconC size={18} className="mr-2" />{tab.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div>{renderTabContent()}</div>
    </div>
  );
};

const Recepcao = ({ db, appId, tiposAtendimento, crasUnidades, userProfile }) => {
  const [formData, setFormData] = useState({ nome: '', cpf: '', telefone: '', dataNascimento: '', sexo: '', cras_id: '', tipo_atendimento_id: '' });
  const [gerandoSenha, setGerandoSenha] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState(null);
  const [error, setError] = useState(null);
  const collectionPath = `artifacts/${appId}/public/data/atendimentos`;

  useEffect(() => {
    if (userProfile?.cras_id) {
      setFormData(prev => ({ ...prev, cras_id: userProfile.cras_id }));
    }
  }, [userProfile]);

  const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };

  const handleGerarSenha = async (e) => {
    e.preventDefault();
    if (!db || !formData.cras_id || !formData.tipo_atendimento_id) { setError("Por favor, preencha todos os campos obrigatórios."); return; }

    setGerandoSenha(true);
    setError(null);

    try {
      const tipo = tiposAtendimento.find(t => t.id === formData.tipo_atendimento_id);
      if (!tipo) throw new Error("Tipo de atendimento não encontrado.");
      const prefixo = (tipo.nome[0] || 'A').toUpperCase();

      // --- CORREÇÃO ---
      // Removida a consulta (query) que causava o erro do índice.
      // Agora, a "senha" será o Prefixo + últimos 4 dígitos do CPF.
      const cpfLimpo = formData.cpf.replace(/\D/g, '');
      const ultimosDigitos = cpfLimpo.length > 4 ? cpfLimpo.slice(-4) : cpfLimpo.padStart(4, '0');
      const senha = `${prefixo}${ultimosDigitos}`;
      // --- FIM DA CORREÇÃO ---

      const dadosCidadao = { nome: formData.nome, cpf: formData.cpf.replace(/\D/g, ''), telefone: formData.telefone, dataNascimento: formData.dataNascimento, sexo: formData.sexo };
      const docData = {
        cidadao: dadosCidadao, senha: senha, cras_id: formData.cras_id, tipo_atendimento_id: formData.tipo_atendimento_id,
        status: "aguardando", hora_chegada: serverTimestamp(), atendente_id: null, hora_chamada: null, hora_inicio: null, hora_fim: null, observacoes: ""
      };

      const docRef = await addDoc(collection(db, collectionPath), docData);

      setSenhaGerada({
        ...docData,
        id: docRef.id,
        tipo_nome: tipo.nome,
        tipo_cor: tipo.cor,
        hora_chegada: Timestamp.now()
      });

    } catch (err) {
      console.error(err);
      setError(`Erro ao gerar senha: ${err.message}`);
    } finally {
      setGerandoSenha(false);
    }
  };

  const handleNovoAtendimento = () => {
    setFormData({ nome: '', cpf: '', telefone: '', dataNascimento: '', sexo: '', cras_id: formData.cras_id, tipo_atendimento_id: '' });
    setSenhaGerada(null);
    setError(null);
  };

  if (senhaGerada) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-4 md:p-10">
        <div className="bg-white shadow-2xl rounded-lg p-8 w-full max-w-md text-center border-t-8" style={{ borderColor: senhaGerada.tipo_cor || COR_PRINCIPAL }}>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Senha Gerada com Sucesso!</h2>
          <p className="text-gray-600 mb-6">Aguarde ser chamado no painel.</p>
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <span className="text-lg font-semibold text-gray-500">Sua Senha</span>
            <h3 className="text-8xl font-bold text-gray-900 my-2">{senhaGerada.senha}</h3>
            <span className="text-xl font-semibold px-4 py-1 rounded-full text-white" style={{ backgroundColor: senhaGerada.tipo_cor || COR_PRINCIPAL }}>{senhaGerada.tipo_nome}</span>
            <div className="mt-4 text-gray-600">
              <p>CRAS: <span className="font-semibold">{crasUnidades.find(c => c.id === senhaGerada.cras_id)?.nome}</span></p>
              <p>Chegada: <span className="font-semibold">{senhaGerada.hora_chegada.toDate().toLocaleString('pt-BR')}</span></p>
            </div>
          </div>
          <div className="space-x-2">
            <button onClick={handleNovoAtendimento} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700">Novo Atendimento</button>
            <a href={`${window.location.pathname}?page=PainelTV&cras_id=${senhaGerada.cras_id}`} target="_blank" rel="noopener noreferrer" className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg shadow hover:bg-gray-300">Abrir Painel</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Recepção</h2>
      <form onSubmit={handleGerarSenha} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg shadow">
        <input name="nome" value={formData.nome} onChange={handleChange} placeholder="Nome Completo" required className="p-2 border rounded-lg" />
        <input name="cpf" value={formData.cpf} onChange={handleChange} placeholder="CPF" required className="p-2 border rounded-lg" />
        <input name="telefone" value={formData.telefone} onChange={handleChange} placeholder="Telefone" className="p-2 border rounded-lg" />
        <input name="dataNascimento" type="date" value={formData.dataNascimento} onChange={handleChange} className="p-2 border rounded-lg" />
        <select name="sexo" value={formData.sexo} onChange={handleChange} className="p-2 border rounded-lg bg-white">
          <option value="">Sexo</option>
          <option value="F">Feminino</option>
          <option value="M">Masculino</option>
        </select>
        <select name="cras_id" value={formData.cras_id} onChange={handleChange} required className="p-2 border rounded-lg bg-white" disabled={userProfile?.role !== 'superintendente'}>
          <option value="">Unidade CRAS</option>
          {crasUnidades.map(cras => (<option key={cras.id} value={cras.id}>{cras.nome}</option>))}
        </select>
        <select name="tipo_atendimento_id" value={formData.tipo_atendimento_id} onChange={handleChange} required className="p-2 border rounded-lg bg-white">
          <option value="">Tipo de Atendimento</option>
          {tiposAtendimento.map(tipo => (<option key={tipo.id} value={tipo.id}>{tipo.nome}</option>))}
        </select>

        <div className="md:col-span-2 flex justify-end">
          <button type="submit" disabled={gerandoSenha} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 disabled:bg-gray-400">
            {gerandoSenha ? <Loader className="animate-spin mr-2" /> : <Plus size={18} className="mr-2" />} Gerar Senha
          </button>
        </div>
        {error && <p className="md:col-span-2 text-red-600">{error}</p>}
      </form>
    </div>
  );
};

const PainelTV = ({ db, appId, crasUnidades, tiposAtendimento, atendentesList }) => {
  const [selectedCrasId, setSelectedCrasId] = useState(null);
  const [chamando, setChamando] = useState(null);
  const [ultimosChamados, setUltimosChamados] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState(null);
  const [highlightKey, setHighlightKey] = useState(0);
  const collectionPath = `artifacts/${appId}/public/data/atendimentos`;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const crasIdFromUrl = params.get('cras_id');
      if (crasIdFromUrl) { setSelectedCrasId(crasIdFromUrl); }
    } catch { }
  }, []);

  useEffect(() => {
    if (!db || !selectedCrasId) return;

    // Chamando
    const qChamando = query(collection(db, collectionPath), where("cras_id", "==", selectedCrasId), where("status", "==", "chamando"), limit(1));
    const unsubscribeChamando = onSnapshot(qChamando, (snapshot) => {
      if (snapshot.empty) {
        setChamando(null);
      } else {
        const docData = snapshot.docs[0].data();
        const tipo = tiposAtendimento.find(t => t.id === docData.tipo_atendimento_id);
        const atendente = atendentesList.find(a => a.id === docData.atendente_id);
        setChamando({
          ...docData,
          tipo_nome: tipo?.nome || 'Atendimento',
          tipo_cor: tipo?.cor || '#333',
          atendente_nome: atendente?.nome || 'Atendente',
          atendente_guiche: atendente?.guiche || '?'
        });
        setHighlightKey(k => k + 1);
      }
    }, (err) => { setError("Erro ao buscar chamada principal."); console.error(err); });

    // Últimos Chamados (Em Atendimento)
    const qUltimos = query(collection(db, collectionPath), where("cras_id", "==", selectedCrasId), where("status", "==", "em_atendimento"));
    const unsubscribeUltimos = onSnapshot(qUltimos, (snapshot) => {
      const chamadosList = snapshot.docs.map(doc => {
        const docData = doc.data();
        const tipo = tiposAtendimento.find(t => t.id === docData.tipo_atendimento_id);
        const atendente = atendentesList.find(a => a.id === docData.atendente_id);
        return {
          ...docData,
          tipo_nome: tipo?.nome || 'Atendimento',
          atendente_guiche: atendente?.guiche || '?'
        };
      }).sort((a,b) => {
        const ta = a.hora_chamada?.toMillis?.() || 0;
        const tb = b.hora_chamada?.toMillis?.() || 0;
        return tb - ta;
      }).slice(0,4);
      setUltimosChamados(chamadosList);
    }, (err) => { setError("Erro ao buscar últimos chamados."); console.error(err); });

    return () => { unsubscribeChamando(); unsubscribeUltimos(); };
  }, [db, selectedCrasId, appId, collectionPath, tiposAtendimento, atendentesList]);

  useEffect(() => {
    if (chamando) {
      const audio = document.getElementById('somChamada');
      if (audio) { try { audio.play(); } catch (_) {} }
    }
  }, [chamando]);

  if (!selectedCrasId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 p-8">
        <img src="https://placehold.co/300x100/1351B4/FFFFFF?text=Logo+Prefeitura" alt="Logo Prefeitura" className="mb-8" />
        <h1 className="text-4xl font-bold text-gray-800 mb-6">Selecione a Unidade CRAS</h1>
        <p className="text-lg text-gray-600 mb-8">Este painel precisa ser configurado para uma unidade específica.</p>
        {crasUnidades.length === 0 && <p>Carregando unidades...</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {crasUnidades.map(cras => (
            <button key={cras.id} onClick={() => { setSelectedCrasId(cras.id); window.history.pushState(null, '', `${window.location.pathname}?page=PainelTV&cras_id=${cras.id}`); }} className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all text-left">
              <h2 className="text-2xl font-semibold text-blue-700">{cras.nome}</h2>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const crasAtual = crasUnidades.find(c => c.id === selectedCrasId);
  return (
    <div className="flex flex-col h-screen w-screen bg-gray-100 text-gray-800">
      <header className="h-16 w-full px-6" style={{ backgroundColor: COR_PRINCIPAL }}>
        <div className="h-full grid" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
          <div></div>
          <div className="self-center text-white font-bold text-center" style={{ fontSize: '42px' }}>CRAS — {crasAtual?.nome || 'Nome da Unidade'}</div>
          <div className="self-center justify-self-end text-white font-semibold" style={{ fontSize: '34px' }}>{currentTime.toLocaleTimeString('pt-BR', { hour12: false })}</div>
        </div>
      </header>
      <style>{`@keyframes flashZoom { 0% { transform: scale(1); opacity: 0.2; } 20% { transform: scale(1.18); opacity: 1; } 50% { transform: scale(1.08); } 100% { transform: scale(1); } } .highlight { animation: flashZoom 900ms ease-in-out; }`}</style>
      <div className="flex-1 flex p-6 gap-6">
        <div className="basis-[65%] bg-white rounded-lg shadow p-8">
          <div className="text-lg font-semibold text-gray-700 mb-4" style={{ fontSize: '28px' }}>Chamando Agora</div>
          <div className="text-gray-600 mb-2" style={{ fontSize: '26px' }}>USUÁRIO CHAMADO</div>
          <div key={highlightKey} className={`${chamando ? 'text-blue-700 highlight' : 'text-gray-400'}`} style={{ fontSize: '60px', fontWeight: 800 }}>{chamando ? chamando.cidadao.nome : 'AGUARDANDO...'}</div>
          <div className="mt-8">
            <div className="text-sm text-gray-600 mb-1">ATENDENTE</div>
            <div className="font-semibold text-blue-700" style={{ fontSize: '52px' }}>{chamando ? (chamando.atendente_nome || '---') : '---'}</div>
          </div>
          <div className="mt-6">
            <div className="text-sm text-gray-600 mb-1">LOCAL DE ATENDIMENTO</div>
            <div className="font-semibold text-blue-700" style={{ fontSize: '52px' }}>{chamando ? (`Guichê ${chamando.atendente_guiche || '---'}`) : '---'}</div>
          </div>
        </div>
        <div className="basis-[35%] bg-white rounded-lg shadow p-8">
          <div className="flex flex-col items-center">
            <img src={LOGO_URL} alt="Logo SEMCAS" className="mb-4" style={{ width: '240px', height: 'auto', maxWidth: '100%' }} />
            <h3 className="font-semibold mb-3" style={{ fontSize: '28px' }}>Últimas Chamadas</h3>
          </div>
          <div className="border-t pt-3">
            <table className="w-full">
              <tbody>
                {ultimosChamados.map((it, idx) => (
                  <tr key={`${it.senha}-${idx}`} className="border-b">
                    <td className="py-2 text-gray-700 truncate" style={{ fontSize: '22px' }}>{it.cidadao.nome || '---'}</td>
                    <td className="py-2 text-right font-semibold text-blue-700" style={{ fontSize: '22px' }}>{`Guichê ${it.atendente_guiche || '---'}`}</td>
                  </tr>
                ))}
                {ultimosChamados.length === 0 && (
                  [0,1,2,3].map(i => (
                    <tr key={i} className="border-b"><td className="py-2 text-gray-400" style={{ fontSize: '22px' }}>---</td><td className="py-2 text-right text-gray-400" style={{ fontSize: '22px' }}>---</td></tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <audio id="somChamada" src="./chamada.wav" preload="auto"></audio>
        </div>
      </div>
      {error && (<div className="absolute bottom-4 left-4 bg-red-600 text-white p-4 rounded-lg flex items-center"><AlertCircle size={24} className="mr-2" /> {error}</div>)}
    </div>
  );
};

const Atendente = ({ db, auth, appId, crasUnidades, tiposAtendimento, atendentesList, user, userProfile }) => {
  const [selectedAtendente, setSelectedAtendente] = useState(null);
  const [filaAguardando, setFilaAguardando] = useState([]);
  const [atendimentoAtual, setAtendimentoAtual] = useState(null);
  const [loadingFila, setLoadingFila] = useState(false);
  const [loadingAtual, setLoadingAtual] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const collectionPath = `artifacts/${appId}/public/data/atendimentos`;

  useEffect(() => {
    if (!selectedAtendente && userProfile?.role === 'atendente' && user && atendentesList && atendentesList.length > 0) {
      const match = atendentesList.find(a => (a.email || '').toLowerCase() === (user.email || '').toLowerCase());
      if (match) setSelectedAtendente(match);
    }
  }, [user, userProfile, atendentesList, selectedAtendente]);

  // Listener da Fila
  useEffect(() => {
    if (!db || !selectedAtendente) { setFilaAguardando([]); return; }
    setLoadingFila(true);

    const q = query(collection(db, collectionPath), where("cras_id", "==", selectedAtendente.cras_id), where("status", "==", "aguardando"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fila = snapshot.docs.map(doc => {
        const data = doc.data();
        const tipo = tiposAtendimento.find(t => t.id === data.tipo_atendimento_id);
        return { id: doc.id, ...data, tipo_nome: tipo?.nome || 'Atendimento', tipo_cor: tipo?.cor || '#777' };
      });
      fila.sort((a, b) => a.hora_chegada.toMillis() - b.hora_chegada.toMillis());
      const tiposPermitidos = selectedAtendente.tipos_atende || [];

      if (tiposPermitidos.length > 0) {
        setFilaAguardando(fila.filter(item => tiposPermitidos.includes(item.tipo_atendimento_id)));
      } else {
        setFilaAguardando(fila);
      }
      setLoadingFila(false);
    }, (err) => { setLoadingFila(false); console.error("Erro ao carregar fila:", err); });

    return () => unsubscribe();
  }, [db, selectedAtendente, collectionPath, tiposAtendimento]);

  // Listener do Atendimento Atual
  useEffect(() => {
    if (!db || !selectedAtendente) { setAtendimentoAtual(null); return; }
    setLoadingAtual(true);

    const q = query(collection(db, collectionPath), where("atendente_id", "==", selectedAtendente.id), where("status", "in", ["chamando", "em_atendimento"]), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setAtendimentoAtual(null);
        setObservacoes("");
      } else {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        const tipo = tiposAtendimento.find(t => t.id === data.tipo_atendimento_id);
        setAtendimentoAtual({ id: docSnap.id, ...data, tipo_nome: tipo?.nome || 'Atendimento', tipo_cor: tipo?.cor || '#777' });
        setObservacoes(data.observacoes || "");
      }
      setLoadingAtual(false);
    }, (err) => { setLoadingAtual(false); console.error("Erro ao carregar atendimento atual:", err); });

    return () => unsubscribe();
  }, [db, selectedAtendente, collectionPath, tiposAtendimento]);

  const handleChamarProximo = async () => {
    if (!db || !selectedAtendente || filaAguardando.length === 0 || atendimentoAtual) return;
    const proximo = filaAguardando[0];

    try {
      const docRef = doc(db, collectionPath, proximo.id);
      await updateDoc(docRef, { status: "chamando", atendente_id: selectedAtendente.id, hora_chamada: serverTimestamp() });

      // Transição automática de "chamando" para "em_atendimento"
      setTimeout(async () => {
        try {
          const ds = await getDoc(docRef);
          if (ds.exists() && ds.data().status === "chamando") {
            await updateDoc(docRef, { status: "em_atendimento", hora_inicio: serverTimestamp() });
          }
        } catch (e) { console.error("Erro na transição automática:", e); }
      }, 5000); // 5 segundos para a transição
    } catch (e) { console.error("Erro ao chamar próximo:", e); }
  };

  const handleFinalizarAtendimento = async () => {
    if (!db || !atendimentoAtual) return;
    try {
      const docRef = doc(db, collectionPath, atendimentoAtual.id);
      await updateDoc(docRef, { status: "finalizado", hora_fim: serverTimestamp(), observacoes: observacoes });
    } catch (e) { console.error("Erro ao finalizar atendimento:", e); }
  };

  if (!selectedAtendente) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-gray-50 p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Identificação do Atendente</h1>
        <p className="text-lg text-gray-600 mb-8">Selecione seu perfil para iniciar.</p>
        {atendentesList.length === 0 && <p>Carregando perfis...</p>}
        <div className="w-full max-w-lg space-y-4">
          {atendentesList.map(atendente => (
            <button key={atendente.id} onClick={() => setSelectedAtendente(atendente)} className="w-full flex items-center justify-between bg-white p-6 rounded-lg shadow-md hover:shadow-lg hover:border-blue-500 border-2 border-transparent transition-all">
              <div>
                <h2 className="text-2xl font-semibold text-blue-700">{atendente.nome}</h2>
                <p className="text-gray-600">{crasUnidades.find(c => c.id === atendente.cras_id)?.nome}</p>
              </div>
              <span className="text-xl font-bold text-gray-700">{`Guichê ${atendente.guiche}`}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full max-h-full overflow-hidden">
      <div className="flex-1 h-full p-6 overflow-y-auto">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Painel do Atendente</h2>
            <p className="text-xl text-gray-600">{selectedAtendente.nome} - <span className="font-semibold">{crasUnidades.find(c => c.id === selectedAtendente.cras_id)?.nome} (Guichê {selectedAtendente.guiche})</span></p>
          </div>
          <button onClick={() => setSelectedAtendente(null)} className="text-sm text-blue-600 hover:underline">Trocar de Perfil</button>
        </header>

        {loadingAtual ? (<div className="h-64 flex items-center justify-center"><Loader className="animate-spin" /></div>) : atendimentoAtual ? (
          <div className="bg-white shadow-lg rounded-lg border-l-8 p-6" style={{ borderColor: atendimentoAtual.tipo_cor }}>
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-sm font-bold uppercase ${atendimentoAtual.status === 'chamando' ? 'text-blue-600 animate-pulse' : 'text-green-600'}`}>
                  {atendimentoAtual.status === 'chamando' ? 'CHAMANDO...' : 'EM ATENDIMENTO'}
                </span>
                <h3 className="text-2xl font-bold text-gray-800">{atendimentoAtual.cidadao.nome}</h3>
                <p className="text-gray-600">CPF: {maskCPF(atendimentoAtual.cidadao.cpf)}</p>
                <p className="text-gray-600">Tipo: <span className="font-semibold" style={{ color: atendimentoAtual.tipo_cor }}>{atendimentoAtual.tipo_nome}</span></p>
                <p className="text-gray-600">Chegada: {formatDateTime(atendimentoAtual.hora_chegada)}</p>
                <p className="text-gray-600">Espera: {calculateWaitTime(atendimentoAtual.hora_chegada)}</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold bg-gray-100 px-3 py-1 rounded">Guichê {selectedAtendente.guiche}</span>
              </div>
            </div>
            <div className="mt-4">
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações do atendimento" className="w-full p-3 border rounded-lg" />
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={handleFinalizarAtendimento} className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700">
                <CheckCircle size={18} className="mr-2" /> Finalizar Atendimento
              </button>
            </div>
          </div>
        ) : (<p className="text-gray-600">Nenhum atendimento em andamento.</p>)}

        <section className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xl font-semibold">Fila de Aguardando</h4>
            <button disabled={loadingFila || filaAguardando.length === 0 || !!atendimentoAtual} onClick={handleChamarProximo} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
              <ChevronRight size={18} className="mr-2" /> Chamar Próximo
            </button>
          </div>

          {loadingFila ? (<div className="h-32 flex items-center justify-center"><Loader className="animate-spin" /></div>) : filaAguardando.length === 0 ? (<p className="text-gray-500">Nenhum cidadão aguardando.</p>) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left text-sm font-semibold text-gray-600">Senha</th>
                    <th className="p-2 text-left text-sm font-semibold text-gray-600">Nome</th>
                    <th className="p-2 text-left text-sm font-semibold text-gray-600">Tipo</th>
                    <th className="p-2 text-left text-sm font-semibold text-gray-600">Chegada</th>
                    <th className="p-2 text-left text-sm font-semibold text-gray-600">Espera</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filaAguardando.map(item => (
                    <tr key={item.id}>
                      <td className="p-2 font-bold">{item.senha}</td>
                      <td className="p-2">{item.cidadao.nome}</td>
                      <td className="p-2"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: item.tipo_cor, color: '#fff' }}>{item.tipo_nome}</span></td>
                      <td className="p-2">{formatTime(item.hora_chegada)}</td>
                      <td className="p-2">{calculateWaitTime(item.hora_chegada)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const Dashboard = ({ db, appId, crasUnidades, tiposAtendimento, atendentesList }) => {
  const [allAtendimentos, setAllAtendimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const collectionPath = `artifacts/${appId}/public/data/atendimentos`;

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const q = query(collection(db, collectionPath), where("hora_chegada", ">=", Timestamp.fromDate(getStartOfToday())));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dataList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllAtendimentos(dataList);
      setLoading(false);
    }, (err) => { setLoading(false); console.error("Erro ao carregar dashboard:", err); });
    return () => unsubscribe();
  }, [db, appId, collectionPath]);

  const stats = useMemo(() => {
    const total = allAtendimentos.length;
    const finalizados = allAtendimentos.filter(a => a.status === 'finalizado');
    const emAtendimento = allAtendimentos.filter(a => a.status === 'em_atendimento');
    const aguardando = allAtendimentos.filter(a => a.status === 'aguardando');

    let tempoMedio = 0;
    if (finalizados.length > 0) {
      const duracoes = finalizados.map(a => {
        if (a.hora_inicio && a.hora_fim) {
          const start = a.hora_inicio.toDate();
          const end = a.hora_fim.toDate();
          // Calcula a duração em minutos, mínimo de 1 minuto
          return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
        }
        return 0;
      });
      tempoMedio = Math.round(duracoes.reduce((acc, v) => acc + v, 0) / finalizados.length);
    }

    return { total, finalizados: finalizados.length, emAtendimento: emAtendimento.length, aguardando: aguardando.length, tempoMedio };
  }, [allAtendimentos]);

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h2>
      {loading ? (<div className="h-64 flex items-center justify-center"><Loader className="animate-spin h-12 w-12" /></div>) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-sm font-medium text-gray-600">Total de Atendimentos</h3><p className="text-3xl font-bold">{stats.total}</p></div>
          <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-sm font-medium text-gray-600">Finalizados</h3><p className="text-3xl font-bold">{stats.finalizados}</p></div>
          <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-sm font-medium text-gray-600">Em Atendimento</h3><p className="text-3xl font-bold">{stats.emAtendimento}</p></div>
          <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-sm font-medium text-gray-600">Aguardando</h3><p className="text-3xl font-bold">{stats.aguardando}</p></div>
          <div className="bg-white p-6 rounded-lg shadow md:col-span-2"><h3 className="text-sm font-medium text-gray-600">Tempo Médio (min)</h3><p className="text-3xl font-bold">{stats.tempoMedio}</p></div>
        </div>
      )}
    </div>
  );
};

const Relatorios = ({ db, appId, crasUnidades, tiposAtendimento, userProfile }) => {
  const [filters, setFilters] = useState({ dataInicio: '', dataFim: '', cras_id: 'todos', tipo_atendimento_id: 'todos', status: 'todos' });
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const collectionPath = `artifacts/${appId}/public/data/atendimentos`;

  useEffect(() => {
    if (userProfile?.role === 'coordenadora' && userProfile?.cras_id) {
      setFilters(prev => ({ ...prev, cras_id: userProfile.cras_id }));
    }
  }, [userProfile]);

  const handleChange = (e) => { const { name, value } = e.target; setFilters(prev => ({ ...prev, [name]: value })); };

  const getTipoNome = (id) => tiposAtendimento.find(t => t.id === id)?.nome || 'N/A';
  const getCrasNome = (id) => crasUnidades.find(c => c.id === id)?.nome || 'N/A';

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      let baseQuery = query(collection(db, collectionPath));
      let data = [];

      // A filtragem por data usando `where` é restrita. Vamos filtrar por data no cliente.
      const snapshot = await getDocs(baseQuery);
      data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filtragem por Data (Cliente-side para evitar erros de índice)
      if (filters.dataInicio || filters.dataFim) {
        const dataInicio = filters.dataInicio ? new Date(filters.dataInicio) : null;
        if (dataInicio) dataInicio.setHours(0, 0, 0, 0);
        const dataFim = filters.dataFim ? new Date(filters.dataFim) : null;
        if (dataFim) dataFim.setHours(23, 59, 59, 999);

        data = data.filter(item => {
          if (!item.hora_chegada || !item.hora_chegada.toDate) return false;
          const chegada = item.hora_chegada.toDate();
          const isAfterStart = !dataInicio || chegada >= dataInicio;
          const isBeforeEnd = !dataFim || chegada <= dataFim;
          return isAfterStart && isBeforeEnd;
        });
      }

      // Filtragem por CRAS, Tipo e Status
      if (filters.cras_id !== 'todos') { data = data.filter(item => item.cras_id === filters.cras_id); }
      if (filters.tipo_atendimento_id !== 'todos') { data = data.filter(item => item.tipo_atendimento_id === filters.tipo_atendimento_id); }
      if (filters.status !== 'todos') { data = data.filter(item => item.status === filters.status); }

      setReportData(data);
    } catch (err) {
      console.error("Erro ao gerar relatório:", err);
      setError("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    const headers = ["ID", "DataHoraChegada", "Senha", "NomeCidadao", "CPFCidadao", "Sexo", "CRAS", "TipoAtendimento", "Status", "TempoAtendimentoMin", "Observacoes"];
    const rows = reportData.map(item => {
      const duration = calculateDuration(item.hora_inicio, item.hora_fim).replace(' min', '');
      const data = [
        item.id,
        formatDateTime(item.hora_chegada),
        item.senha,
        item.cidadao.nome,
        item.cidadao.cpf,
        item.cidadao.sexo,
        getCrasNome(item.cras_id),
        getTipoNome(item.tipo_atendimento_id),
        item.status,
        duration.includes('-') ? '' : duration, // Só exporta a duração se for um número válido
        (item.observacoes || '').replace(/"/g, '""')
      ];
      return `"${data.join('","')}"`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + `"${headers.join('","')}"\n` + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    link.setAttribute("download", `relatorio_atendimentos_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const GraficoPorTipo = () => {
    const counts = useMemo(() => {
      const map = new Map();
      reportData.forEach(item => { const nome = getTipoNome(item.tipo_atendimento_id); map.set(nome, (map.get(nome) || 0) + 1); });
      return Array.from(map.entries());
    }, [reportData]);
    return (<div className="bg-white p-6 rounded-lg shadow"><h4 className="text-lg font-semibold mb-4">Por Tipo de Atendimento</h4><ul className="space-y-2">{counts.map(([nome, total]) => (<li key={nome} className="flex justify-between"><span className="font-medium">{nome}</span><span>{total}</span></li>))}</ul></div>);
  };

  const GraficoPorSexo = () => {
    const counts = useMemo(() => {
      const map = new Map();
      reportData.forEach(item => { const sexo = item.cidadao.sexo || 'N/A'; map.set(sexo, (map.get(sexo) || 0) + 1); });
      return Array.from(map.entries());
    }, [reportData]);
    return (<div className="bg-white p-6 rounded-lg shadow"><h4 className="text-lg font-semibold mb-4">Por Sexo</h4><ul className="space-y-2">{counts.map(([sexo, total]) => (<li key={sexo} className="flex justify-between"><span className="font-medium">{sexo}</span><span>{total}</span></li>))}</ul></div>);
  };

  const TabelaRelatorio = () => {
    return (
      <div className="bg-white p-6 rounded-lg shadow mt-6 overflow-x-auto">
        <table className="min-w-[900px] w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left text-sm font-semibold text-gray-600">ID</th>
              <th className="p-2 text-left text-sm font-semibold text-gray-600">Chegada</th>
              <th className="p-2 text-left text-sm font-semibold text-gray-600">Senha</th>
              <th className="p-2 text-left text-sm font-semibold text-gray-600">Cidadão</th>
              <th className="p-2 text-left text-sm font-semibold text-gray-600">CPF</th>
              <th className="p-2 text-left text-sm font-semibold text-gray-600">CRAS</th>
              <th className="p-2 text-left text-sm font-semibold text-gray-600">Tipo</th>
              <th className="p-2 text-left text-sm font-semibold text-gray-600">Status</th>
              <th className="p-2 text-left text-sm font-semibold text-gray-600">Tempo (min)</th>
              <th className="p-2 text-left text-sm font-semibold text-gray-600">Obs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {reportData.map(item => (
              <tr key={item.id}>
                <td className="p-2 text-xs text-gray-500">{item.id}</td>
                <td className="p-2">{formatDateTime(item.hora_chegada)}</td>
                <td className="p-2 font-bold">{item.senha}</td>
                <td className="p-2">{item.cidadao.nome}</td>
                <td className="p-2">{item.cidadao.cpf}</td>
                <td className="p-2">{getCrasNome(item.cras_id)}</td>
                <td className="p-2">{getTipoNome(item.tipo_atendimento_id)}</td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">{calculateDuration(item.hora_inicio, item.hora_fim).replace(' min', '')}</td>
                <td className="p-2">{item.observacoes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-semibold">Relatórios</h3>
        <button onClick={handleExportCSV} disabled={reportData.length === 0} className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors disabled:bg-gray-400">
          <Download size={18} className="mr-2" /> Exportar CSV ({reportData.length})
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <input name="dataInicio" type="date" value={filters.dataInicio} onChange={handleChange} className="w-full p-2 border rounded-lg text-gray-600" title="Data Início" />
          <input name="dataFim" type="date" value={filters.dataFim} onChange={handleChange} className="w-full p-2 border rounded-lg text-gray-600" title="Data Fim" />
          <select name="cras_id" value={filters.cras_id} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white" disabled={userProfile?.role === 'coordenadora'}>
            <option value="todos">Todas Unidades CRAS</option>
            {crasUnidades.map(cras => <option key={cras.id} value={cras.id}>{cras.nome}</option>)}
          </select>
          <select name="tipo_atendimento_id" value={filters.tipo_atendimento_id} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white">
            <option value="todos">Todos Tipos</option>
            {tiposAtendimento.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
          </select>
          <select name="status" value={filters.status} onChange={handleChange} className="w-full p-2 border rounded-lg bg-white">
            <option value="todos">Todos Status</option>
            <option value="aguardando">Aguardando</option>
            <option value="em_atendimento">Em Atendimento</option>
            <option value="finalizado">Finalizado</option>
          </select>
          <button onClick={handleSearch} disabled={loading} className="flex items-center justify-center bg-blue-600 text-white p-2 rounded-lg shadow hover:bg-blue-700 disabled:bg-gray-400">
            {loading ? <Loader size={18} className="animate-spin" /> : <Filter size={18} className="mr-2" />}Filtrar
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
      </div>

      {loading ? (<div className="flex items-center justify-center p-20"><Loader className="animate-spin h-12 w-12 text-blue-600" /></div>) : reportData.length === 0 ? (<p className="text-gray-500 text-center p-20">Nenhum dado encontrado para os filtros selecionados.</p>) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <GraficoPorTipo />
            <GraficoPorSexo />
          </div>
          <TabelaRelatorio />
        </>
      )}
    </div>
  );
};

const Layout = ({ children, currentPage, setPage, user, userProfile, auth }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuItems = [
    { id: 'Recepcao', label: 'Recepção', icon: Home },
    { id: 'PainelTV', label: 'Painel TV', icon: Tv },
    { id: 'Atendente', label: 'Atendente', icon: Users },
    { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'Relatorios', label: 'Relatórios', icon: FileText },
    { id: 'Administracao', label: 'Administração', icon: Settings }
  ];
  const role = userProfile?.role || '';
  const allowed = {
    recepcionista: ['Recepcao', 'PainelTV'],
    atendente: ['Atendente', 'PainelTV'],
    coordenadora: ['Recepcao', 'Atendente', 'PainelTV', 'Administracao'],
    superintendente: ['Recepcao', 'PainelTV', 'Atendente', 'Dashboard', 'Relatorios', 'Administracao']
  };
  const visibleItems = menuItems.filter(m => (allowed[role] || []).includes(m.id));

  const NavLink = ({ item }) => {
    const isActive = currentPage === item.id;
    const IconC = item.icon;
    const href = `${window.location.pathname}?page=${item.id}`;
    const handleClick = (e) => {
      if (e.button === 0 && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) {
        e.preventDefault();
        window.history.pushState({}, '', href);
        setPage(item.id);
        setIsMobileMenuOpen(false);
      }
    };
    return (
      <a
        href={href}
        onClick={handleClick}
        aria-current={isActive ? 'page' : undefined}
        title={item.label}
        className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-700 text-white shadow-inner' : 'text-blue-100 hover:bg-blue-600 hover:text-white'}`}
        style={{ backgroundColor: isActive ? COR_PRINCIPAL_HOVER : '' }}
      >
        <IconC size={22} className="mr-3" /><span className="font-medium">{item.label}</span>
      </a>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-6 flex items-center">
        <img src={LOGO_URL} alt="Logo SEMCAS" className="h-10 w-auto mr-3" />
        <span className="text-white text-xl font-bold">SEMCAS<br />Atendimento</span>
      </div>
      <nav className="flex-1 px-3 space-y-2">
        {visibleItems.map(item => <NavLink key={item.id} item={item} />)}
      </nav>
      <div className="p-4 border-t border-blue-600">
        <p className="text-white font-semibold truncate">{user?.email || 'Usuário Anônimo'}</p>
        <p className="text-sm text-blue-200 truncate">{user?.uid}</p>
        <button onClick={() => auth && signOut(auth)} className="flex items-center w-full mt-3 px-3 py-2 rounded-lg text-blue-100 hover:bg-blue-600 hover:text-white transition-colors">
          <LogOut size={18} className="mr-2" />Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="hidden lg:block w-64 h-full shadow-lg z-20" style={{ backgroundColor: COR_PRINCIPAL }}>
        <SidebarContent />
      </aside>
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black opacity-50" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="absolute left-0 top-0 h-full w-64 shadow-lg z-40" style={{ backgroundColor: COR_PRINCIPAL }}>
            <SidebarContent />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="lg:hidden h-16 bg-white shadow-md flex items-center justify-between px-4 z-10">
          <img src={LOGO_URL} alt="Logo SEMCAS" className="h-10" />
          <button onClick={() => setIsMobileMenuOpen(true)}><Menu size={28} className="text-gray-700" /></button>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};


// --- APP PRINCIPAL ---

// CORREÇÃO: Removido 'export default'
// Isso torna a 'App' uma função global que o script do index.html pode encontrar.
function App() {
  let firebaseConfig;
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) { firebaseConfig = JSON.parse(__firebase_config); }
    else {
      // Configuração de fallback do seu arquivo app.jsx
      firebaseConfig = { apiKey: "AIzaSyA7NcglEdJwmT5rDEL40s_RupMbjYQoCQ8", authDomain: "crasatendimento-35796.firebaseapp.com", projectId: "crasatendimento-35796", storageBucket: "crasatendimento-35796.firebasestorage.app", messagingSenderId: "441213432664", appId: "1:441213432664:web:151552f03416dc0e3eab2d" };
    }
  } catch (e) {
    return <div className='text-red-500 p-8'>Erro crítico: A configuração do Firebase é inválida.</div>;
  }

  const appId = typeof __app_id !== 'undefined' ? __app_id : 'cras-atendimento-default';
  const [page, setPage] = useState('Recepcao');
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [crasUnidades, setCrasUnidades] = useState([]);
  const [tiposAtendimento, setTiposAtendimento] = useState([]);
  const [atendentesList, setAtendentesList] = useState([]);
  const [isLoadingGlobalData, setIsLoadingGlobalData] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const SUPER_UID = 'bgdgNn2iwJNU9kV0LJ2hntokCWm2';

  // 1. Inicialização e Autenticação Firebase
  useEffect(() => {
    if (!_ia || !_ga || !getFirestore || !setLogLevel || !onAuthStateChanged || !signInWithCustomToken || !signInAnonymously) {
        setAuthError('Módulos Firebase não carregados. Verifique o index.html.');
        setIsAuthReady(false);
        return;
    }

    try {
      const app = _ia(firebaseConfig);
      const authInstance = _ga(app);
      const dbInstance = getFirestore(app);
      setLogLevel('debug');
      setDb(dbInstance);
      setAuth(authInstance);

      const unsubscribe = onAuthStateChanged(authInstance, async (u) => {
        setUser(u || null);
        setAuthError(null);
        setIsAuthReady(true);
        if (u) {
          try {
            const baseRole = u.uid === SUPER_UID ? 'superintendente' : 'recepcionista';
            const baseData = { email: u.email || '', nome: u.displayName || '', role: baseRole, cras_id: '' };
            setUserProfile({ id: u.uid, ...baseData });

            const userDocRef = doc(dbInstance, `artifacts/${appId}/public/data/users`, u.uid);
            const snap = await getDoc(userDocRef);
            if (snap.exists()) {
              setUserProfile({ id: u.uid, ...snap.data() });
            } else {
              const byEmailRef = doc(dbInstance, `artifacts/${appId}/public/data/users_by_email`, u.email || '');
              const emailSnap = await getDoc(byEmailRef);
              if (emailSnap.exists()) {
                const data = emailSnap.data();
                try { await updateDoc(userDocRef, data); } catch (_) { try { await setDoc(userDocRef, data); } catch (_) {} }
                setUserProfile({ id: u.uid, ...data });
              } else {
                try { await setDoc(userDocRef, baseData); } catch (_) {}
              }
            }
          } catch (e) {
            // mantém baseData já setado em memória
          }
        } else {
          setUserProfile(null);
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Erro ao inicializar Firebase:", e);
      setAuthError('Falha ao inicializar Firebase.');
      setIsAuthReady(false);
      setIsLoadingGlobalData(false);
    }
  }, [firebaseConfig.apiKey, appId]);

  // 2. Carregamento de Dados Globais (Firestore)
  useEffect(() => {
    if (!db) return;
    if (!user && page !== 'PainelTV') return;

    setIsLoadingGlobalData(true);

    const collectionsToFetch = [
      { path: `artifacts/${appId}/public/data/cras_unidades`, setter: setCrasUnidades },
      { path: `artifacts/${appId}/public/data/tipos_atendimento`, setter: setTiposAtendimento },
      { path: `artifacts/${appId}/public/data/atendentes`, setter: setAtendentesList },
    ];

    const unsubscribers = collectionsToFetch.map(({ path, setter }) => {
      const q = query(collection(db, path));
      return onSnapshot(q, (snapshot) => {
        const dataList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (path.includes('tipos_atendimento')) { dataList.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)); }
        setter(dataList);
        // Garante que o estado global de loading só termine depois de todas as coletas iniciais
        if (collectionsToFetch.every(c => c.setter)) setIsLoadingGlobalData(false);
      }, (err) => {
        console.error(`Erro ao buscar ${path}:`, err);
        // Permite que o app continue mesmo que uma coleção falhe, mas registra o erro
        setIsLoadingGlobalData(false);
      });
    });

    return () => { unsubscribers.forEach(unsub => unsub()); };
  }, [db, appId, user, page]);

  // 3. Controle de Rota (URL)
  useEffect(() => {
    const handleUrlChange = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const pageFromUrl = params.get('page');
        if (pageFromUrl) { setPage(pageFromUrl); }
      } catch (e) {
        console.error("Erro ao analisar URL:", e);
      }
    };
    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pageFromUrl = params.get('page');
      if (!pageFromUrl && userProfile?.role === 'superintendente') {
        setPage('Administracao');
      }
    } catch (_) {}
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;
    const params = new URLSearchParams(window.location.search);
    const pageFromUrl = params.get('page');
    const crasIdFromUrl = params.get('cras_id');
    if (page === 'PainelTV') {
      if (pageFromUrl === 'PainelTV') return;
      if (crasIdFromUrl) return;
      const role = userProfile.role;
      let start = 'PainelTV';
      if (role === 'superintendente') start = 'Administracao';
      else if (role === 'recepcionista') start = 'Recepcao';
      else if (role === 'atendente') start = 'Atendente';
      else if (role === 'coordenadora') start = 'Relatorios';
      setPage(start);
    }
  }, [userProfile, page]);

  const renderPage = () => {
    if (authError) {
      const retry = async () => {
        try {
          if (auth) {
            setAuthError(null);
            await signInAnonymously(auth);
          }
        } catch (e) {
          console.error("Erro ao tentar novamente:", e);
        }
      };
      return (
        <div className='flex flex-col items-center justify-center h-screen bg-gray-100'>
          <p className='text-lg text-red-600 mb-4'>{authError}</p>
          <button onClick={retry} className='bg-blue-600 text-white px-4 py-2 rounded-lg'>Tentar novamente</button>
        </div>
      );
    }

    if (page !== 'PainelTV' && (!isAuthReady || !user)) {
      return <Login auth={auth} db={db} appId={appId} />;
    }

    const pageProps = { db, auth, appId, user, userProfile, crasUnidades, tiposAtendimento, atendentesList };
    const role = userProfile?.role || '';
    const can = (p) => {
      if (p === 'PainelTV') return true;
      if (role === 'superintendente') return true;
      if (role === 'recepcionista') return ['Recepcao', 'PainelTV'].includes(p);
      if (role === 'atendente') return ['Atendente', 'PainelTV'].includes(p);
      if (role === 'coordenadora') return ['Recepcao','Atendente','PainelTV','Administracao'].includes(p);
      return false;
    };

    switch (page) {
      case 'Recepcao': return can('Recepcao') ? <Recepcao {...pageProps} /> : <PainelTV {...pageProps} />;
      case 'PainelTV': return <PainelTV {...pageProps} />;
      case 'Atendente': return can('Atendente') ? <Atendente {...pageProps} /> : <PainelTV {...pageProps} />;
      case 'Dashboard': return can('Dashboard') ? <Dashboard {...pageProps} /> : <PainelTV {...pageProps} />;
      case 'Relatorios': return can('Relatorios') ? <Relatorios {...pageProps} /> : <PainelTV {...pageProps} />;
      case 'Administracao': return can('Administracao') ? <Administracao {...pageProps} /> : <PainelTV {...pageProps} />;
      default: return <PainelTV {...pageProps} />;
    }
  };

  // PainelTV usa layout quando usuário está logado, caso contrário, renderiza direto
  if (page === 'PainelTV') {
    return user ? <Layout currentPage={page} setPage={setPage} user={user} userProfile={userProfile} auth={auth}>{renderPage()}</Layout> : renderPage();
  }

  // O restante do app usa o Layout
  return <Layout currentPage={page} setPage={setPage} user={user} userProfile={userProfile} auth={auth}>{renderPage()}</Layout>;
}
function Login({ auth, db, appId }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        const byEmailRef = doc(db, `artifacts/${appId}/public/data/users_by_email`, email);
        await setDoc(byEmailRef, { email, nome: cred.user.displayName || '', role: 'recepcionista', cras_id: '' });
      } else {
        await signInWithEmailAndPassword(auth, email, senha);
      }
    } catch (e2) {
      setError('Falha na autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{isRegister ? 'Cadastro' : 'Entrar'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full p-3 border rounded" />
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" required className="w-full p-3 border rounded" />
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded">{loading ? 'Aguarde...' : isRegister ? 'Cadastrar' : 'Entrar'}</button>
        </form>
        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        <button onClick={() => setIsRegister(!isRegister)} className="mt-4 text-blue-600">{isRegister ? 'Já tenho conta' : 'Criar nova conta'}</button>
      </div>
    </div>
  );
}

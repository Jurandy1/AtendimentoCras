import React, { useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import Card from './ui/Card';
import Button from './ui/Button';
import * as XLSX from 'xlsx';
import { Loader2, FileSpreadsheet, CheckCircle, AlertCircle, UserCheck, ShieldAlert } from 'lucide-react';

const RelatorioTecnicoPage = () => {
  // db e appId vindos do AuthContext — igual ao ExportacaoDadosPage
  const { user, userProfile, loading: authLoading, appId, db } = useAuth();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validarGestao = () => {
    if (!userProfile) return false;
    const cargoAtual = (
      userProfile.cargo ||
      userProfile.role ||
      userProfile.roleNorm ||
      ''
    ).toString().toLowerCase().trim();
    const termosGestao = ['coord', 'gestor', 'admin', 'master', 'super', 'superintendente'];
    return termosGestao.some(t => cargoAtual.includes(t));
  };

  const gerarRelatorioExcel = async () => {
    if (!user) {
      setError('Sessão não detectada. Faça login novamente.');
      return;
    }
    if (!validarGestao()) {
      const cargo = (userProfile?.cargo || userProfile?.role || 'Indefinido').toString();
      setError(`Acesso Negado: perfil (${cargo}) sem permissão de Coordenador/Gestor.`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // ─────────────────────────────────────────────────────────
      // PASSO 1 — Atendentes (igual ao ExportacaoDadosPage pattern)
      //           Monta mapa: atendente_id → { nome, cargo }
      //           e Set com IDs de técnicos (Psi / AS)
      // ─────────────────────────────────────────────────────────
      setStatus('Carregando atendentes...');

      const atendentesSnap = await getDocs(
        query(
          collection(db, `artifacts/${appId}/public/data/atendentes`),
          orderBy('nome'),
          limit(500)
        )
      );

      console.log('[RelTec] atendentes carregados:', atendentesSnap.size);

      const atendentesMap = new Map(); // id → { nome, cargo }
      const idsTecnicos   = new Set(); // apenas Psi / AS

      atendentesSnap.docs.forEach(d => {
        const data = d.data();
        const cargo = (data.cargo || '').toLowerCase();
        atendentesMap.set(d.id, { nome: data.nome || '', cargo: data.cargo || '' });

        const ehTecnico = ['psicólog', 'psicoló', 'psicologo', 'assistente social']
          .some(c => cargo.includes(c));
        if (ehTecnico) idsTecnicos.add(d.id);
      });

      console.log('[RelTec] IDs de técnicos (Psi/AS):', idsTecnicos.size, [...idsTecnicos]);

      // ─────────────────────────────────────────────────────────
      // PASSO 2 — Cidadãos
      //           Mesmo caminho e query do ExportacaoDadosPage
      // ─────────────────────────────────────────────────────────
      setStatus('Carregando cidadãos...');

      const cidadaosSnap = await getDocs(
        query(
          collection(db, `artifacts/${appId}/public/data/cidadaos`),
          orderBy('nome'),
          limit(10000)
        )
      );

      console.log('[RelTec] cidadãos carregados:', cidadaosSnap.size);

      const listaCidadaos = cidadaosSnap.docs.map(d => {
        const data = d.data();
        return {
          id           : d.id,
          nome         : data.nome         || 'N/A',
          cpf          : String(data.cpf   || '').replace(/\D/g, ''),
          cpfOriginal  : data.cpf          || 'N/A',
          tecnicoResp  : (
            data.tecnicoResponsavel        ||
            data.atendenteResponsavelNome  ||
            data.criadoPorNome             ||
            ''
          ).trim(),
        };
      });

      // ─────────────────────────────────────────────────────────
      // PASSO 2.5 — Usuários desligados
      //             Carrega CPFs da coleção usuarios_bloqueados
      //             e remove esses cidadãos da lista.
      // ─────────────────────────────────────────────────────────
      setStatus('Verificando usuários desligados...');

      const bloqueadosSnap = await getDocs(
        collection(db, `artifacts/${appId}/public/data/usuarios_bloqueados`)
      );
      const cpfsBloqueados = new Set(
        bloqueadosSnap.docs.map(d => String(d.data().cpf || d.id).replace(/\D/g, ''))
      );

      console.log('[RelTec] CPFs desligados:', cpfsBloqueados.size);

      const listaCidadaosAtivos = listaCidadaos.filter(
        cid => !cid.cpf || !cpfsBloqueados.has(cid.cpf)
      );

      console.log('[RelTec] cidadãos após filtro desligados:', listaCidadaosAtivos.length);

      setStatus(`${listaCidadaosAtivos.length} cidadãos ativos. Carregando atendimentos...`);

      // ─────────────────────────────────────────────────────────
      // PASSO 3 — Atendimentos
      //           Mesmo caminho do restante do app.
      //           SEM filtro por cargo (campo não existe no doc).
      //           Filtramos em memória via idsTecnicos.
      // ─────────────────────────────────────────────────────────
      const atendimentosSnap = await getDocs(
        query(
          collection(db, `artifacts/${appId}/public/data/atendimentos`),
          orderBy('hora_chegada', 'desc'),
          limit(10000)
        )
      );

      console.log('[RelTec] atendimentos carregados:', atendimentosSnap.size);

      // Filtra só atendimentos finalizados de Psi / AS e mantém ordem desc
      const historicoTecnicos = atendimentosSnap.docs
        .map(d => d.data())
        .filter(at =>
          at.status === 'finalizado' &&
          at.atendente_id &&
          idsTecnicos.has(at.atendente_id)
        );

      console.log('[RelTec] atendimentos de técnicos filtrados:', historicoTecnicos.length);

      // ─────────────────────────────────────────────────────────
      // PASSO 4 — Lookup CPF → nome do último técnico
      //           O CPF do cidadão fica em at.cidadao.cpf
      // ─────────────────────────────────────────────────────────
      const ultimoTecnicoPorCPF = new Map();

      historicoTecnicos.forEach(at => {
        const cpf = String(at.cidadao?.cpf || '').replace(/\D/g, '');
        if (!cpf || ultimoTecnicoPorCPF.has(cpf)) return;

        const atendente = atendentesMap.get(at.atendente_id);
        if (atendente?.nome) {
          ultimoTecnicoPorCPF.set(cpf, atendente.nome);
        }
      });

      console.log('[RelTec] CPFs com técnico encontrado:', ultimoTecnicoPorCPF.size);

      // ─────────────────────────────────────────────────────────
      // PASSO 5 — Montar linhas
      // ─────────────────────────────────────────────────────────
      const rows = listaCidadaosAtivos.map(cid => {
        let tecnico = cid.tecnicoResp;
        let fonte   = 'Cadastro';

        if (!tecnico && cid.cpf) {
          const porCPF = ultimoTecnicoPorCPF.get(cid.cpf) || '';
          if (porCPF) {
            tecnico = porCPF;
            fonte   = 'Último atendimento (Psi/AS)';
          } else {
            fonte = '—';
          }
        }

        return {
          'Nome Completo'       : cid.nome,
          'CPF'                 : cid.cpfOriginal,
          'Técnico Responsável' : tecnico || 'Não atribuído',
          'Fonte'               : fonte,
        };
      });

      console.log('[RelTec] linhas geradas:', rows.length, 'exemplo:', rows[0]);

      // ─────────────────────────────────────────────────────────
      // PASSO 6 — Exportar Excel
      // ─────────────────────────────────────────────────────────
      if (rows.length === 0) {
        setError('Nenhum cidadão encontrado. Verifique as permissões do Firestore ou se a coleção está correta.');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Relatorio_Tecnicos');

      ws['!cols'] = [
        { wch: 42 }, // Nome Completo
        { wch: 18 }, // CPF
        { wch: 32 }, // Técnico Responsável
        { wch: 28 }, // Fonte
      ];

      XLSX.writeFile(wb, 'Relatorio_Tecnico.xlsx');
      setSuccess(true);
      setStatus('Planilha gerada com sucesso!');

    } catch (err) {
      console.error('[RelTec] Erro:', err);
      if (err.code === 'permission-denied') {
        setError('Permissão negada pelo Firestore. Verifique seu perfil de acesso.');
      } else if (err.code === 'failed-precondition') {
        setError('Índice Firestore ausente. Abra o console do navegador, copie o link e crie o índice no Firebase.');
      } else {
        setError('Erro técnico: ' + (err.message || 'Erro desconhecido.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const isUserReady = !!user && !!userProfile && !authLoading;

  return (
    <div className="flex items-center justify-center min-h-[450px] p-4 bg-slate-50">
      <Card className="w-full max-w-lg p-8 shadow-2xl border-t-8 border-blue-600 bg-white rounded-lg">

        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-blue-50 text-blue-600 rounded-full mb-4 shadow-sm">
            <FileSpreadsheet size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Relatório de Cidadãos</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Técnico = campo do cadastro do cidadão.<br />
            Se vazio, usa o último Psicólogo / Assistente Social que o atendeu.
          </p>

          <div className="mt-4">
            {authLoading ? (
              <div className="flex items-center justify-center gap-2 text-slate-400 text-xs italic">
                <Loader2 size={14} className="animate-spin" /> Validando credenciais...
              </div>
            ) : isUserReady ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                  <UserCheck size={14} /> Sessão Ativa: {userProfile?.nome || user?.email}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Cargo: {userProfile?.cargo || userProfile?.role || 'Coordenador'}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                <ShieldAlert size={14} /> Utilizador não detectado
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={gerarRelatorioExcel}
          loading={loading}
          disabled={!isUserReady || loading}
          className="w-full py-8 text-xl font-black uppercase tracking-tighter shadow-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'A Gerar Planilha...' : 'Baixar Lista Técnica'}
        </Button>

        <div className="mt-8 min-h-[60px]">
          {loading && (
            <p className="text-center text-blue-600 font-bold animate-pulse text-sm">{status}</p>
          )}
          {success && (
            <div className="flex items-center justify-center gap-3 text-green-700 font-bold bg-green-50 p-4 rounded-xl border border-green-200">
              <CheckCircle size={24} strokeWidth={1.5} />
              <span>Planilha descarregada com sucesso!</span>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-2 text-red-700 font-bold bg-red-50 p-4 rounded-xl border border-red-200 text-center">
              <div className="flex items-center gap-2 uppercase text-xs tracking-tighter">
                <AlertCircle size={18} strokeWidth={1.5} />
                Erro ao gerar relatório
              </div>
              <p className="text-[10px] font-normal leading-tight opacity-80">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between text-[10px] text-slate-300 font-bold uppercase">
          <span>Firebase Auth Guard</span>
          <span>Excel Export v2.4</span>
        </div>
      </Card>
    </div>
  );
};

export default RelatorioTecnicoPage;

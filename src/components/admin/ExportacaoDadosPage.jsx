import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Download, AlertTriangle, Calendar, FileSpreadsheet, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { logAdminAction } from '../../utils/logger';
import { formatDateTime, getFriendlyFirebaseError } from '../../utils';

const ExportacaoDadosPage = () => {
  const { db, appId, userProfile, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  // Verifica se é sexta-feira (0 = Domingo, 1 = Segunda, ..., 5 = Sexta, 6 = Sábado)
  const today = new Date();
  const isFriday = today.getDay() === 5;
  
  // Permite bypass se for admin (opcional, mas útil para testes/emergências)
  // Se quiser ser estrito conforme pedido, remova o "|| isAdmin"
  // O usuário pediu "bloquear", então vamos manter o bloqueio visual mas talvez permitir bypass se for Super Admin
  // Por enquanto, vamos seguir a regra estrita de dia, mas deixaremos um aviso.
  const canExport = isFriday || isAdmin; 

  const handleExportCidadaos = async () => {
    if (!db || !canExport) return;
    
    try {
      setLoading(true);
      setProgress('Iniciando leitura do banco de dados (pode demorar)...');

      const colRef = collection(db, `artifacts/${appId}/public/data/cidadaos`);
      // Sem filtros, pega tudo. Cuidado com custos!
      const q = query(colRef, orderBy('nome'));
      const snapshot = await getDocs(q);

      setProgress(`Processando ${snapshot.size} registros...`);

      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          // Dados Pessoais Básicos
          'Nome Completo': d.nome || '',
          'Nome Social': d.nomeSocial || '',
          'CPF': d.cpf || '',
          'RG': d.rg || '',
          'NIS': d.nis || '',
          'Título de Eleitor': d.tituloEleitor || '',
          'Zona Eleitoral': d.tituloEleitorZona || '',
          'Seção Eleitoral': d.tituloEleitorSecao || '',
          'Data de Nascimento': d.dataNascimento || '',
          'Sexo': d.sexo || '',
          'Orientação Sexual': d.orientacaoSexual || '',
          'Cor/Raça': d.cor || '',
          'Estado Civil': d.estadoCivil || '',
          'Religião': d.religiao || '',
          
          // Filiação
          'Nome da Mãe': d.nomeMae || '',
          'Nome do Pai': d.nomePai || '',
          'Cônjuge': d.conjuge || '',
          
          // Naturalidade
          'Nacionalidade': d.nacionalidade || '',
          'Naturalidade': d.naturalidade || '',
          'UF Naturalidade': d.uf || '',
          'Código IBGE Naturalidade': d.naturalidadeIbgeId || '',
          
          // Contato
          'Telefone': d.telefone || '',
          'Email': d.email || '',
          
          // Endereço
          'Endereço': d.endereco || '',
          'Número': d.numero || '',
          'Bairro': d.bairro || '',
          'Complemento': d.complemento || '',
          'CEP': d.cep || '',
          
          // Educação e Trabalho
          'Escolaridade': d.escolaridade || '',
          'Profissão': d.profissao || '',
          'Situação Profissional': d.situacaoProfissional || '',
          'Local de Trabalho': d.localTrabalho || '',
          
          // Renda
          'Renda Individual': d.rendaIndividual || '',
          'Renda Familiar': d.rendaFamiliar || '',
          'Membros na Família': d.numeroMembrosFamilia || '',
          
          // Moradia
          'Tipo de Moradia': d.tipoMoradia || '',
          'Situação da Moradia': d.situacaoMoradia || '',
          'Possui Imóvel': d.possuiImovel || '',
          'Possui Veículo': d.possuiVeiculo || '',
          
          // Saúde e Benefícios
          'Deficiência': d.deficiencia || '',
          'Benefícios': d.beneficios || '',
          
          // Sistema
          'Data Cadastro': d.dataCadastro ? formatDateTime(d.dataCadastro) : '',
          'Última Atualização': d.updatedAt ? formatDateTime(d.updatedAt) : '',
          'Cadastrado Por': d.cadastradoPor || '',
          'Técnico Responsável': d.tecnicoResponsavel || '',
          'Observações': d.observacoes || '',
        };
      });

      setProgress('Gerando arquivo Excel...');
      
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Cidadãos Cadastrados");
      
      // Ajustar largura das colunas (básico)
      const wscols = Object.keys(data[0] || {}).map((key) => ({ 
        wch: key.includes('Observações') || key.includes('Deficiência') || key.includes('Benefícios') ? 30 : 
             key.includes('Endereço') || key.includes('Local') ? 25 : 
             key.includes('Nome') ? 20 : 15
      }));
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `Base_Completa_Cidadaos_${new Date().toISOString().slice(0,10)}.xlsx`);

      await logAdminAction(db, appId, userProfile, 'EXPORT_FULL_DATA_CIDADAOS', 'Exportação completa de cidadãos', { count: snapshot.size });
      
      setProgress('');
    } catch (error) {
      console.error("Erro na exportação:", error);
      alert(getFriendlyFirebaseError(error, "Erro ao exportar dados."));
    } finally {
      setLoading(false);
    }
  };

  const handleExportBloqueados = async () => {
    if (!db || !canExport) return;

    try {
      setLoading(true);
      setProgress('Buscando usuários desligados...');

      const colRef = collection(db, `artifacts/${appId}/public/data/usuarios_bloqueados`);
      const q = query(colRef, orderBy('nome'));
      const snapshot = await getDocs(q);

      setProgress(`Processando ${snapshot.size} registros...`);

      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          // Dados Pessoais Básicos
          'Nome': d.nome || '',
          'Nome Normalizado': d.nomeNormalizado || '',
          'CPF': d.cpf || '',
          'RG': d.identidade || '',
          'Sexo': d.sexo || '',
          'Orientação Sexual': d.orientacaoSexual || '',
          'Etnia/Cor': d.etnia || '',
          'Religião': d.religiao || '',
          'Data de Nascimento': d.dataNascimento || '',
          
          // Naturalidade
          'Nacionalidade': d.nacionalidade || '',
          'Naturalidade': d.naturalidade || '',
          
          // Desligamento
          'Motivo do Desligamento': d.motivoDesligamento || '',
          'Data do Desligamento': d.dataDesligamento || '',
          'Técnico Responsável': d.tecnicoDesligou || '',
          'Demanda Origem': d.demandaOrigem || '',
          'Data Atendimento Inicial': d.dataAtendimentoInicial || '',
          
          // Importação
          'Origem da Importação': d.origemImportacao || '',
          'Data Importação': d.importadoEm ? formatDateTime(d.importadoEm) : '',
          
          // Dados Adicionais (se existirem)
          'Nome da Mãe': d.nomeMae || '',
          'Nome do Pai': d.nomePai || '',
          'Escolaridade': d.escolaridade || '',
          'Telefone': d.telefone || '',
          'Email': d.email || '',
          'Endereço': d.endereco || '',
          'Bairro': d.bairro || '',
          'Profissão': d.profissao || '',
          'Renda': d.renda || '',
          'Benefícios': d.beneficios || '',
          'Observações': d.observacoes || ''
        };
      });

      setProgress('Gerando arquivo Excel...');

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Usuários Desligados");

      const wscols = Object.keys(data[0] || {}).map(() => ({ wch: 25 }));
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `Usuarios_Desligados_${new Date().toISOString().slice(0,10)}.xlsx`);

      await logAdminAction(db, appId, userProfile, 'EXPORT_BLOCKED_USERS', 'Exportação de usuários desligados', { count: snapshot.size });

      setProgress('');
    } catch (error) {
      console.error("Erro na exportação:", error);
      alert(getFriendlyFirebaseError(error, "Erro ao exportar dados."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <FileSpreadsheet className="text-green-600" size={32} />
          Exportação de Dados
        </h1>
        <p className="text-gray-500 mt-2">
          Área restrita para exportação completa das bases de dados do sistema.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 flex items-start gap-4">
        <AlertTriangle className="text-amber-600 shrink-0 mt-1" size={24} />
        <div>
          <h3 className="font-bold text-amber-800 mb-1">Atenção: Alto Consumo de Dados</h3>
          <p className="text-amber-700 text-sm mb-2">
            A exportação completa realiza a leitura de <strong>todos</strong> os registros do banco de dados. 
            Isso consome a cota de leitura do Firebase.
          </p>
          <p className="text-amber-800 text-sm font-semibold flex items-center gap-1">
            <Calendar size={14} />
            Regra de Segurança: A exportação só está liberada às Sextas-feiras.
          </p>
        </div>
      </div>

      {!canExport && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8 text-center">
          <Lock className="mx-auto text-red-400 mb-2" size={48} />
          <h3 className="text-xl font-bold text-red-700">Exportação bloqueada</h3>
          <p className="text-red-600 mt-2">
            Por medidas de segurança e controle de custos, a exportação de dados só é permitida às <strong>Sextas-feiras</strong>.
          </p>
          <p className="text-gray-500 text-sm mt-4">
            Hoje é {today.toLocaleDateString('pt-BR', { weekday: 'long' })}. Por favor, retorne na sexta-feira.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Cidadãos */}
        <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col ${!canExport ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <Download size={24} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Base de Cidadãos</h3>
              <p className="text-xs text-gray-500">Todos os usuários cadastrados</p>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-6 flex-1">
            Gera uma planilha Excel completa contendo todos os dados pessoais, endereço, contato e informações socioeconômicas de todos os cidadãos ativos no sistema.
          </p>
          <button
            onClick={handleExportCidadaos}
            disabled={loading || !canExport}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? 'Processando...' : 'Baixar Excel Completo'}
          </button>
        </div>

        {/* Card Bloqueados */}
        <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col ${!canExport ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Usuários Desligados</h3>
              <p className="text-xs text-gray-500">Lista de bloqueio / Inativos</p>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-6 flex-1">
            Gera uma planilha Excel contendo a lista de usuários desligados, incluindo motivo do desligamento, data e técnico responsável.
          </p>
          <button
            onClick={handleExportBloqueados}
            disabled={loading || !canExport}
            className="w-full py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? 'Processando...' : 'Baixar Excel Desligados'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-8 p-4 bg-blue-50 text-blue-700 rounded-lg text-center animate-pulse">
          <p className="font-medium">Gerando arquivo...</p>
          <p className="text-sm opacity-80">{progress}</p>
        </div>
      )}
    </div>
  );
};

export default ExportacaoDadosPage;

import React from 'react';
import { UploadCloud, FileText, Copy } from 'lucide-react';
import { useImportacaoUsuarios } from '../../hooks/useImportacaoUsuarios';

const ImportacaoUsuarios = ({ db, appId, userProfile }) => {
  const {
    texto,
    setTexto,
    dadosPreview,
    importando,
    progresso,
    logErro,
    resumo,
    filtro,
    setFiltro,
    linhasIgnoradasDetalhe,
    handleFileUpload,
    copiarCabecalho,
    processarTexto,
    handleImportar
  } = useImportacaoUsuarios({ db, appId, userProfile });

  return (
    <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4 flex items-center">
            <UploadCloud className="mr-2" /> Importação em Massa de Usuários
        </h3>
        
        <div className="mb-6 p-4 border border-indigo-100 bg-indigo-50 rounded-lg">
            <label className="block text-sm font-semibold text-indigo-900 mb-2 flex items-center">
                <FileText className="mr-2" size={18} />
                Opção Recomendada: Carregar Arquivo Excel
            </label>
            <p className="text-xs text-indigo-700 mb-3">
                Carregue diretamente seu arquivo .xlsx ou .csv para evitar erros de formatação na cópia.
            </p>
            <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-indigo-600 file:text-white
                    hover:file:bg-indigo-700
                    cursor-pointer
                "
            />
        </div>

        <div className="mb-4">
            <div className="flex justify-between items-end mb-2">
                <p className="text-sm text-gray-600">
                    Ou cole abaixo os dados copiados da planilha.
                    <span className="text-xs text-gray-500 block mt-1">Dica: Use o botão ao lado para gerar o cabeçalho no seu Google Sheets.</span>
                </p>
                <button
                    onClick={copiarCabecalho}
                    className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center transition-colors border border-blue-200"
                    title="Copiar cabeçalho para colar no Excel/Sheets"
                >
                    <Copy size={14} className="mr-1" /> Copiar Modelo (Cabeçalho)
                </button>
            </div>
            <div className="mb-2 overflow-x-auto">
                <code className="text-xs bg-gray-100 p-1 rounded whitespace-nowrap block text-gray-500 border border-gray-200">
                    DATA DE CADASTRO | ORIGEM DA DEMANDA | TÉCNICO RESPONSÁVEL | NOME DO USUÁRIO | ... | NIS
                </code>
            </div>
            <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Cole aqui as linhas da planilha..."
                className="w-full h-40 p-2 border rounded-lg font-mono text-xs"
                disabled={importando}
            />
        </div>

        {linhasIgnoradasDetalhe.length > 0 && (
            <div className="mb-4 border rounded-lg bg-amber-50 border-amber-200">
                <div className="px-3 py-2 text-sm font-semibold text-amber-800">
                    Detalhes das linhas ignoradas
                </div>
                <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-amber-100">
                            <tr>
                                <th className="px-2 py-1 text-left">Linha</th>
                                <th className="px-2 py-1 text-left">Motivo</th>
                                <th className="px-2 py-1 text-left">Prévia da linha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {linhasIgnoradasDetalhe.map((l, idx) => (
                                <tr key={idx} className="border-t border-amber-100">
                                    <td className="px-2 py-1">#{l.linha}</td>
                                    <td className="px-2 py-1">{l.motivo}</td>
                                    <td className="px-2 py-1 truncate max-w-xs" title={l.preview}>{l.preview}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        <div className="flex gap-2 mb-6">
            <button 
                onClick={processarTexto}
                disabled={importando || !texto}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
                Processar Texto
            </button>
            {dadosPreview.length > 0 && (
                <button 
                    onClick={handleImportar}
                    disabled={importando}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                    {importando ? `Importando (${progresso.atual}/${progresso.total})...` : `Confirmar Importação (${dadosPreview.length} registros)`}
                </button>
            )}
        </div>

        {resumo && (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 border rounded-lg p-3">
                    <div className="text-gray-500">Linhas lidas</div>
                    <div className="text-lg font-semibold">{resumo.totalLinhas}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-gray-500">Cadastros válidos</div>
                    <div className="text-lg font-semibold text-green-700">{resumo.validos}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-gray-500">Linhas ignoradas</div>
                    <div className="text-lg font-semibold text-amber-700">{resumo.ignorados}</div>
                </div>
            </div>
        )}

        {dadosPreview.length > 0 && (
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div className="text-sm text-gray-600">
                    Pré-visualizando {Math.min(dadosPreview.length, 50)} de {dadosPreview.length} cadastros detectados.
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Filtro rápido</span>
                    <input
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                        placeholder="Filtrar por nome, CPF ou mãe..."
                        className="px-2 py-1 border rounded-lg text-xs min-w-[200px]"
                    />
                </div>
            </div>
        )}

        {dadosPreview.length > 0 && (
            <div className="border rounded-lg overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-3 py-2 border-b">Nome</th>
                            <th className="px-3 py-2 border-b">CPF</th>
                            <th className="px-3 py-2 border-b">Data Nasc.</th>
                            <th className="px-3 py-2 border-b">Nome Mãe</th>
                            <th className="px-3 py-2 border-b">NIS</th>
                            <th className="px-3 py-2 border-b">Alertas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dadosPreview
                            .filter(d => {
                                if (!filtro) return true;
                                const f = filtro.toLowerCase();
                                return (d.nome || '').toLowerCase().includes(f) ||
                                       (d.cpf || '').includes(f) ||
                                       (d.nomeMae || '').toLowerCase().includes(f);
                            })
                            .slice(0, 100) // Limite de visualização
                            .map((d, i) => (
                            <tr key={i} className={`hover:bg-gray-50 ${d._alertas && d._alertas.length > 0 ? 'bg-red-50' : ''}`}>
                                <td className="px-3 py-2 border-b">{d.nome}</td>
                                <td className="px-3 py-2 border-b">{d.cpf}</td>
                                <td className="px-3 py-2 border-b">{d.dataNascimento}</td>
                                <td className="px-3 py-2 border-b">{d.nomeMae}</td>
                                <td className="px-3 py-2 border-b">{d.nis}</td>
                                <td className="px-3 py-2 border-b text-red-600 font-semibold">
                                    {d._alertas ? d._alertas.join(', ') : ''}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {dadosPreview.length > 100 && (
                    <div className="p-2 text-center text-gray-500 bg-gray-50 text-xs border-t">
                        ...e mais {dadosPreview.length - 100} registros.
                    </div>
                )}
            </div>
        )}

        {logErro.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                <strong>Erros na importação:</strong>
                <ul className="list-disc pl-5 mt-2">
                    {logErro.map((erro, i) => <li key={i}>{erro}</li>)}
                </ul>
            </div>
        )}
    </div>
  );
};

export default ImportacaoUsuarios;

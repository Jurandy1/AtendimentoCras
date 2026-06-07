import React from 'react';
import { UploadCloud } from 'lucide-react';
import { useImportacaoUsuariosBloqueados } from '../../hooks/useImportacaoUsuariosBloqueados';

const ImportacaoUsuariosBloqueados = ({ db, appId, userProfile }) => {
  const {
    texto,
    setTexto,
    dadosPreview,
    resumo,
    importando,
    progresso,
    filtro,
    setFiltro,
    linhasIgnoradasDetalhe,
    processarTexto,
    handleImportar
  } = useImportacaoUsuariosBloqueados({ db, appId, userProfile });

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-4 flex items-center">
        <UploadCloud className="mr-2" /> Importação de Usuários Desligados
      </h3>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          Cole abaixo os dados copiados da planilha. A ordem das colunas deve ser estritamente:
          <br />
          <code className="text-xs bg-gray-100 p-1 rounded">
            DATA DO DESLIGAMENTO | MOTIVO DO DESLIGAMENTO | DEMANDA : ESPONTÂNEA / OUTROS: CRAS/ CREAS/ CENTRO POP/ ABRIGO/ CAP´S AD/ ABORD. SOCIAL | TÉCNICO QUE DESLIGOU | ATENDIMENTO INICIAL (DATA) | GÊNERO (FEMININO/MASCULINO) | NOME DO USUÁRIO | ETNIA | ORIENT. SEXUAL | RELIGIÃO | DATA DE NASCIMENTO | NACIONALIDADE (PAÍS DE ORIGEM) | NATURALIDADE (CIDADE DE ORIGEM) | IDENTIDADE | CPF | ESCOLARIDADE | NOME DO PAI | NOME DA MÃE
          </code>
        </p>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Cole aqui as linhas da planilha de usuários desligados..."
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
                    <td className="px-2 py-1 truncate max-w-xs" title={l.preview}>
                      {l.preview}
                    </td>
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
            {importando
              ? `Importando (${progresso.atual}/${progresso.total})...`
              : `Confirmar Importação (${dadosPreview.length} registros)`}
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
              onChange={e => setFiltro(e.target.value)}
              placeholder="Filtrar por nome, CPF ou mãe..."
              className="px-2 py-1 border rounded-lg text-xs min-w-[200px]"
            />
          </div>
        </div>
      )}

      {dadosPreview.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-gray-100 font-bold">
              <tr>
                <th className="p-2">Data Desligamento</th>
                <th className="p-2">Motivo Desligamento</th>
                <th className="p-2">Demanda / Origem</th>
                <th className="p-2">Técnico Desligou</th>
                <th className="p-2">Atend. Inicial</th>
                <th className="p-2">Gênero</th>
                <th className="p-2">Nome</th>
                <th className="p-2">Etnia</th>
                <th className="p-2">Orient. Sexual</th>
                <th className="p-2">Religião</th>
                <th className="p-2">Data Nasc.</th>
                <th className="p-2">Nacionalidade</th>
                <th className="p-2">Naturalidade</th>
                <th className="p-2">Identidade</th>
                <th className="p-2">CPF</th>
                {/* Add more headers if needed */}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
                {dadosPreview
                .filter(d => 
                    !filtro || 
                    d.nome.toLowerCase().includes(filtro.toLowerCase()) || 
                    (d.cpf && d.cpf.includes(filtro)) ||
                    (d.nomeMae && d.nomeMae.toLowerCase().includes(filtro.toLowerCase()))
                )
                .slice(0, 50)
                .map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                        <td className="p-2">{d.dataDesligamento}</td>
                        <td className="p-2">{d.motivoDesligamento}</td>
                        <td className="p-2">{d.demandaOrigem}</td>
                        <td className="p-2">{d.tecnicoDesligou}</td>
                        <td className="p-2">{d.dataAtendimentoInicial}</td>
                        <td className="p-2">{d.sexo}</td>
                        <td className="p-2 font-medium">{d.nome}</td>
                        <td className="p-2">{d.etnia}</td>
                        <td className="p-2">{d.orientacaoSexual}</td>
                        <td className="p-2">{d.religiao}</td>
                        <td className="p-2">{d.dataNascimento}</td>
                        <td className="p-2">{d.nacionalidade}</td>
                        <td className="p-2">{d.naturalidade}</td>
                        <td className="p-2">{d.identidade}</td>
                        <td className="p-2">{d.cpf}</td>
                    </tr>
                ))}
            </tbody>
          </table>
          {dadosPreview.length > 50 && (
             <div className="p-2 text-center text-xs text-gray-500 bg-gray-50 border-t">
               E mais {dadosPreview.length - 50} registros...
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportacaoUsuariosBloqueados;

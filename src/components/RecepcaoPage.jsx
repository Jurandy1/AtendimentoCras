import React from 'react';
import { useRecepcao } from '../hooks/useRecepcao';
import { useAuth } from '../contexts/AuthContext';
import FormularioCidadao from './recepcao/FormularioCidadao';
import FilaRecepcao from './recepcao/FilaRecepcao';
import FilaAusentes from './recepcao/FilaAusentes';
import BloqueioNomeDialog from './recepcao/dialogs/BloqueioNomeDialog';
import RemanejarModal from './recepcao/dialogs/RemanejarModal';
import CancelarAtendimentoModal from './recepcao/dialogs/CancelarAtendimentoModal';
import { LogOut, UserCheck, TestTube2, CheckCircle2, AlertTriangle } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import InlineAlert from './ui/InlineAlert';
import ConfirmDialog from './ui/ConfirmDialog';
import OfflineBanner from './ui/OfflineBanner';
import { normalizeRole, getNomeCidadao } from '../utils';

const RecepcaoPage = ({ db, appId, crasUnidades, tiposAtendimento, atendentesList, userProfile }) => {
  const { isTestMode, toggleTestMode, user } = useAuth();
  const userProfileWithUid = React.useMemo(
    () => ({ ...userProfile, uid: userProfile?.uid || user?.uid }),
    [userProfile, user?.uid]
  );
  
  const {
    formData, handleChange,
    registrandoAtendimento, nomeRegistrado, error, successMsg, setSuccessMsg,
    buscandoCidadao,
    filaRecepcao, filaAusentes, filaError, filaBusy,
    cpfBloqueadoInfo, possiveisBloqueadosNome, mostrarModalBloqueioNome,
    admitirDesligadoConfirmado,
    cidadaoOutraUnidadeInfo,
    aceitarPreencherCidadaoOutraUnidade,
    cancelarCidadaoOutraUnidade,
    handleNomeBlur, handleCpfBlur, handleRegistrarAtendimento, handleLimparForm,
    handleCancelarAtendimento, handleReativarAusente,
    confirmarBloqueioPorNome, cancelarBloqueioPorNome,
    setMostrarModalBloqueioNome,
    psicologos,
    tipoById,
    expedienteIniciado,
    iniciarExpediente,
    encerrarExpediente,
    loadingExpediente,
    handleRemanejarAtendimento,
    handleAdmitirDesligado
  } = useRecepcao({ db, appId, userProfile: userProfileWithUid, crasUnidades, tiposAtendimento, atendentesList, isTestMode });

  const roleNorm = userProfileWithUid?.roleNorm || normalizeRole(userProfileWithUid?.role || userProfileWithUid?.cargo);
  const podeTrocarUnidade = ["admin", "superintendente", "master", "super_admin"].includes(roleNorm);
  const lockCrasId = !!userProfileWithUid?.cras_id && !podeTrocarUnidade;

  const [remanejoItem, setRemanejoItem] = React.useState(null);
  const [cancelarItem, setCancelarItem] = React.useState(null);
  const [showConfirmLogout, setShowConfirmLogout] = React.useState(false);

  const crasNome = crasUnidades?.find(c => c.id === formData.cras_id)?.nome || "";

  // Verifica se o usuário tem role que isenta do controle de expediente
  const isencaoExpediente = ["admin", "coordenador", "superintendente", "master", "super_admin"].includes(roleNorm);
  const isCoordenador = roleNorm === "coordenador";

  if (loadingExpediente) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 rounded-full border-t-transparent"></div>
        <span className="ml-3 text-gray-600 font-medium">Carregando status...</span>
      </div>
    );
  }

  if (!expedienteIniciado && !isencaoExpediente) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-4 animate-fadeIn">
        <Card className="max-w-md w-full p-8 text-center border-t-4 border-t-blue-600 shadow-lg">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600 border border-blue-100 shadow-sm">
            <UserCheck size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Recepção
          </h2>
          <p className="text-gray-600 mb-8">
            Olá, <span className="font-semibold text-blue-700">{userProfileWithUid?.nome || "Recepcionista"}</span>.
            <br />
            Para iniciar os atendimentos, confirme o início do seu expediente.
          </p>

          <Button 
            onClick={iniciarExpediente} 
            className="w-full py-3 text-lg font-bold shadow-md hover:shadow-lg transition-all"
            aria-label="Iniciar expediente da recepção"
          >
            INICIAR EXPEDIENTE
          </Button>
          
          <p className="text-xs text-gray-400 mt-6">
            Isso registrará sua presença para o Coordenador.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <OfflineBanner />
      <div className="flex flex-col xl:flex-row gap-6 items-start">
      {/* Coluna Principal: Status, Formulário e Fila Ativa */}
      <div className="flex-1 w-full space-y-6 min-w-0">
        
        {/* Barra de Status do Recepcionista */}
        <div className="bg-white border border-blue-100 p-4 rounded-xl shadow-sm flex flex-col gap-4">
           {successMsg && (
             <InlineAlert 
               variant="success" 
               icon={CheckCircle2}
               onClose={() => setSuccessMsg(null)}
               className="animate-fadeIn"
             >
               {successMsg}
             </InlineAlert>
           )}

           {cidadaoOutraUnidadeInfo && (
             <InlineAlert variant="warning" className="animate-fadeIn">
               <div className="flex items-start gap-2">
                 <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                 <div>
                   <div className="font-bold">CPF de outra unidade</div>
                   <div className="text-sm">
                     Cadastro: <strong>{cidadaoOutraUnidadeInfo.origemNome}</strong> • Atendimento selecionado: <strong>{cidadaoOutraUnidadeInfo.destinoNome}</strong>
                   </div>
                 </div>
               </div>
             </InlineAlert>
           )}
           
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600">
                   <UserCheck size={20} />
                </div>
                <div>
                   <p className="text-xs text-blue-500 font-bold uppercase tracking-wider">Recepcionista Ativo</p>
                   <p className="text-base font-bold text-slate-800">{userProfileWithUid?.nome || "Usuário"}</p>
                </div>
             </div>
             
             <div className="flex items-center gap-2">
               {isCoordenador && (
                 <Button
                   variant={isTestMode ? "warning" : "secondary"}
                   size="sm"
                   onClick={toggleTestMode}
                   className="flex items-center gap-2"
                   title="Ativar/Desativar Modo Teste"
                 >
                   <TestTube2 size={16} />
                   <span className="hidden sm:inline">{isTestMode ? "Modo Teste ATIVO" : "Modo Teste"}</span>
                 </Button>
               )}
               
               {!isencaoExpediente && (
                 <Button 
                   variant="outline"
                   size="sm"
                   onClick={() => setShowConfirmLogout(true)}
                   className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 flex items-center gap-2"
                   aria-label="Encerrar expediente"
                   title="Encerrar seu turno na recepção"
                 >
                   <LogOut size={14} />
                   <span className="hidden sm:inline">Encerrar Expediente</span>
                 </Button>
               )}
             </div>
           </div>
        </div>

        <FormularioCidadao
          formData={formData}
          handleChange={handleChange}
          handleNomeBlur={handleNomeBlur}
          handleCpfBlur={handleCpfBlur}
          handleRegistrarAtendimento={handleRegistrarAtendimento}
          handleLimparForm={handleLimparForm}
          registrandoAtendimento={registrandoAtendimento}
          nomeRegistrado={nomeRegistrado}
          successMsg={successMsg}
          error={error}
          buscandoCidadao={buscandoCidadao}
          crasUnidades={crasUnidades}
          tiposAtendimento={tiposAtendimento}
          psicologos={psicologos}
          cpfBloqueadoInfo={cpfBloqueadoInfo}
          cidadaoOutraUnidadeInfo={cidadaoOutraUnidadeInfo}
          onCancelarOutraUnidade={cancelarCidadaoOutraUnidade}
          onAceitarOutraUnidade={aceitarPreencherCidadaoOutraUnidade}
          lockCrasId={lockCrasId}
        />

        {/* Card de usuário desligado — aparece ao digitar CPF bloqueado */}
        {cpfBloqueadoInfo && (
          <Card className="border-l-4 border-l-red-500 bg-red-50 p-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 border border-red-200 mt-0.5">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-700 mb-1">
                  Usuário desligado
                </p>
                <p className="text-xs text-red-600 font-semibold mb-2">
                  {cpfBloqueadoInfo.nome || cpfBloqueadoInfo.nomeSocial || `CPF ${cpfBloqueadoInfo.cpf}`}
                </p>

                <div className="bg-white border border-red-200 rounded-lg px-3 py-2 mb-3 space-y-1">
                  <div>
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Motivo do desligamento</span>
                    <p className="text-xs text-gray-700 mt-0.5 leading-snug">
                      {cpfBloqueadoInfo.motivoDesligamento || cpfBloqueadoInfo.motivo || "Motivo não informado"}
                    </p>
                  </div>
                  {(cpfBloqueadoInfo.desligadoPorNome || cpfBloqueadoInfo.desligadoPor) && (
                    <div className="pt-1 border-t border-red-100">
                      <span className="text-[10px] text-gray-500">
                        <span className="font-semibold">Desligado por:</span>{" "}
                        {cpfBloqueadoInfo.desligadoPorNome || cpfBloqueadoInfo.desligadoPor}
                      </span>
                    </div>
                  )}
                  {(cpfBloqueadoInfo.desligadoEm || cpfBloqueadoInfo.criadoEm) && (
                    <div>
                      <span className="text-[10px] text-gray-400">
                        <span className="font-semibold">Em:</span>{" "}
                        {(() => {
                          try {
                            const ts = cpfBloqueadoInfo.desligadoEm || cpfBloqueadoInfo.criadoEm;
                            const d = ts?.toDate ? ts.toDate() : new Date(ts);
                            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                          } catch { return null; }
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleAdmitirDesligado}
                  disabled={!!filaBusy || admitirDesligadoConfirmado}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
                  aria-label="Atender usuário desligado como atendimento esporádico"
                >
                  {admitirDesligadoConfirmado ? (
                    <span>Autorizado para atendimento</span>
                  ) : (
                    <>
                      <UserCheck size={15} />
                      Atender mesmo desligado
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-gray-400 text-center mt-1.5 mb-3">
                  Registra o atendimento, mas não religa o vínculo. O painel do atendente mostrará o motivo do desligamento.
                </p>

                <p className="text-[10px] text-gray-400 text-center mt-1.5">
                  A recepção apenas autoriza o atendimento. A religação permanente é feita pelo Psicólogo(a) ou Assistente Social no painel do atendimento.
                </p>
              </div>
            </div>
          </Card>
        )}
        
        <FilaRecepcao
          filaRecepcao={filaRecepcao}
          filaBusy={filaBusy}
          filaError={filaError}
          crasId={formData.cras_id}
          crasNome={crasNome}
          handleCancelarAtendimento={setCancelarItem}
          handleRemanejarAtendimento={setRemanejoItem}
          tipoById={tipoById}
        />
      </div>

      {/* Coluna Lateral: Fila de Ausentes */}
      <div className="w-full xl:w-96 flex-shrink-0 space-y-6">
        <FilaAusentes
          filaAusentes={filaAusentes}
          filaBusy={filaBusy}
          handleReativarAusente={handleReativarAusente}
          tipoById={tipoById}
        />
      </div>

      {remanejoItem && (
        <RemanejarModal
          isOpen={!!remanejoItem}
          atendimento={remanejoItem}
          tiposAtendimento={tiposAtendimento}
          atendentesList={atendentesList}
          onClose={() => setRemanejoItem(null)}
          onConfirm={handleRemanejarAtendimento}
        />
      )}

      {cancelarItem && (
        <CancelarAtendimentoModal
          isOpen={!!cancelarItem}
          atendimentoNome={getNomeCidadao(cancelarItem)}
          onClose={() => setCancelarItem(null)}
          onConfirm={async () => {
            await handleCancelarAtendimento(cancelarItem.id);
          }}
        />
      )}

      {mostrarModalBloqueioNome && (
        <BloqueioNomeDialog
          isOpen={mostrarModalBloqueioNome}
          possiveisBloqueadosNome={possiveisBloqueadosNome}
          confirmarBloqueioPorNome={confirmarBloqueioPorNome}
          cancelarBloqueioPorNome={cancelarBloqueioPorNome}
          onClose={() => setMostrarModalBloqueioNome(false)}
        />
      )}

      <ConfirmDialog
        isOpen={showConfirmLogout}
        title="Encerrar Expediente"
        message="Deseja realmente encerrar seu expediente?"
        confirmText="Encerrar"
        cancelText="Voltar"
        onConfirm={() => {
          setShowConfirmLogout(false);
          encerrarExpediente();
        }}
        onCancel={() => setShowConfirmLogout(false)}
        type="warning"
      />
      </div>
    </div>
  );
};

export default RecepcaoPage;

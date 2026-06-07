import React from "react";
import {
  Play,
  PlayCircle,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Users,
  UserPlus,
  Clock,
  Save,
  PauseCircle,
  LogOut,
  MapPin,
  AlertTriangle,
  Power,
  Volume2,
  FileText,
  UserX
} from "lucide-react";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import Button from "./ui/Button";

export default function TutorialAtendente() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn pb-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Tutorial do Painel de Atendente
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Guia completo de como utilizar o sistema para gerenciar filas, realizar
          atendimentos e registrar observações de forma eficiente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Passo 1: Iniciar Expediente */}
        <Card className="p-6 border-l-4 border-l-blue-600">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
              1
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              Iniciando o Expediente
            </h2>
          </div>
          <div className="space-y-4 text-gray-600">
            <p>
              Ao acessar o painel, a primeira ação necessária é escolher sua{" "}
              <strong>Sala de Atendimento</strong> e iniciar o expediente.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="font-semibold text-blue-800 flex items-center gap-2 mb-2">
                <Clock size={18} /> Regras de Horário
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>
                  O sistema só permite iniciar expediente entre{" "}
                  <strong>07:00 e 18:00</strong>.
                </li>
                <li>
                  Fora desse horário, o botão ficará bloqueado (exceto para
                  Gestores).
                </li>
                <li>
                  Se você esquecer o expediente aberto, o sistema encerrará
                  automaticamente às 18:00.
                </li>
              </ul>
            </div>
            <p className="text-sm">
              <span className="font-semibold">Como fazer:</span> Selecione a
              sala no menu suspenso e clique em{" "}
              <Badge variant="green">Iniciar Expediente</Badge>.
            </p>
          </div>
        </Card>

        {/* Passo 2: Chamando da Fila */}
        <Card className="p-6 border-l-4 border-l-indigo-600">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
              2
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              Chamando o Próximo
            </h2>
          </div>
          <div className="space-y-4 text-gray-600">
            <p>
              Com o expediente iniciado (status <Badge variant="green">Online</Badge>), 
              você verá a lista de espera.
            </p>
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
              <h3 className="font-semibold text-indigo-800 flex items-center gap-2 mb-2">
                <Users size={18} /> Prioridade Automática
              </h3>
              <p className="text-sm mb-2">
                O sistema organiza a fila automaticamente:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm font-medium">
                <li>Atendimentos Preferenciais</li>
                <li>Ordem de Chegada</li>
              </ol>
            </div>
            <p>
              Clique no botão azul{" "}
              <span className="inline-flex items-center gap-1 bg-blue-800 text-white px-2 py-0.5 rounded text-xs font-bold">
                <Volume2 size={10} /> CHAMAR PRÓXIMO
              </span>{" "}
              para chamar o cidadão. O nome aparecerá no Painel de TV e o status
              mudará para <Badge variant="indigo">Chamando</Badge>.
            </p>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 mt-2">
               <h3 className="font-semibold text-yellow-800 flex items-center gap-2 mb-2 text-sm">
                  <AlertTriangle size={16} /> Usuário Ausente?
               </h3>
               <p className="text-sm text-gray-700">
                  Se o usuário não aparecer:
               </p>
               <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                  <li>Use o botão <strong>Rechamar</strong> (disponível a cada 1 minuto).</li>
                  <li>Se persistir, clique em <strong>Ausente</strong> para retirá-lo da fila.</li>
               </ul>
            </div>
          </div>
        </Card>

        {/* Passo 3: O Atendimento */}
        <Card className="p-6 border-l-4 border-l-green-600 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xl">
              3
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              Realizando o Atendimento
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-600">
            <div className="space-y-4">
              <p>
                A foto do cidadão aparecerá assim que você clicar em "Chamar". Quando ele chegar à mesa, clique em{" "}
                <Button variant="success" className="pointer-events-none inline-flex" icon={PlayCircle}>
                   Iniciar Atendimento
                </Button>
                . O cronômetro começará a rodar.
              </p>
              <h3 className="font-semibold text-gray-800">Registro de Informações</h3>
              <p>
                Utilize o campo <strong>Evolução Técnica / Diário de Atendimento</strong> para registrar o relato.
              </p>
              <div className="bg-green-50 p-3 rounded border border-green-100 text-sm">
                <strong className="text-green-800 flex items-center gap-1">
                  <Save size={14} /> Salvamento Automático
                </strong>
                <p>
                  Não se preocupe em perder dados. O sistema salva um rascunho
                  automaticamente no seu navegador e no servidor enquanto você digita.
                </p>
              </div>
              <p className="text-sm text-red-600 font-bold">
                Nota: O botão de "Pausa" não está disponível durante um atendimento ativo. Finalize o atendimento primeiro.
              </p>
            </div>
            <div className="space-y-4 border-l pl-4 md:border-l-gray-200">
               <h3 className="font-semibold text-gray-800">Dados do Usuário</h3>
               <p className="text-sm">
                 O painel exibe o <strong>Nome</strong>, <strong>CPF</strong>, <strong>Naturalidade</strong> e <strong>UF</strong> do usuário para confirmação.
               </p>
               <h3 className="font-semibold text-gray-800">RMA e CadÚnico</h3>
               <p className="text-sm">
                 O sistema exibe automaticamente os campos do RMA (Bloco B e C) conforme o perfil (Psicólogo ou CadÚnico).
               </p>
            </div>
          </div>
        </Card>

        {/* Passo 4: Finalizando ou Transferindo */}
        <Card className="p-6 border-l-4 border-l-orange-500 md:col-span-2">
           <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xl">
              4
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              Concluindo a Ação
            </h2>
          </div>
          <div className="space-y-6">
            <p className="text-gray-600">
              Ao terminar, utilize os botões de ação disponíveis:
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
               {/* Finalizar */}
               <div className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2 mb-2 font-bold text-gray-900">
                     <div className="p-1.5 bg-green-600 text-white rounded">
                        <CheckCircle2 size={16} />
                     </div>
                     Finalizar
                  </div>
                  <p className="text-sm text-gray-600">
                     Encerra o atendimento, salva o RMA e libera o guichê.
                  </p>
               </div>

               {/* Ausente */}
               <div className="border rounded-lg p-4 bg-yellow-50 hover:bg-yellow-100 transition-colors">
                  <div className="flex items-center gap-2 mb-2 font-bold text-yellow-800">
                     <div className="p-1.5 bg-yellow-500 text-white rounded">
                        <UserX size={16} /> {/* UserX from lucide-react doesn't exist in imports, using XCircle conceptually or adding import if needed. Wait, XCircle is imported. UserX is not imported in my snippet above? Let me check imports. */}
                     </div>
                     Ausente
                  </div>
                  <p className="text-sm text-gray-600">
                     Use se chamou o usuário várias vezes e ele não apareceu.
                  </p>
               </div>

               {/* Transferir */}
               <div className="border rounded-lg p-4 bg-orange-50 hover:bg-orange-100 transition-colors">
                  <div className="flex items-center gap-2 mb-2 font-bold text-orange-800">
                     <div className="p-1.5 bg-orange-500 text-white rounded">
                        <ArrowRightLeft size={16} />
                     </div>
                     Transferir
                  </div>
                  <p className="text-sm text-gray-600">
                     Encaminha o usuário para outra fila (CadÚnico, Psicologia ou Coordenador).
                  </p>
               </div>

               {/* Desligar (Psicólogos) */}
               <div className="border rounded-lg p-4 bg-red-50 hover:bg-red-100 transition-colors">
                  <div className="flex items-center gap-2 mb-2 font-bold text-red-800">
                     <div className="p-1.5 bg-red-600 text-white rounded">
                        <Power size={16} />
                     </div>
                     Desligar
                  </div>
                  <p className="text-sm text-gray-600">
                     (Apenas Psicologia) Encerra o vínculo do usuário com o serviço (alimenta lista de desligados).
                  </p>
               </div>
            </div>
          </div>
        </Card>

        {/* Passo 5: Pausas */}
        <Card className="p-6 border-l-4 border-l-gray-500">
           <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-xl">
              5
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              Pausas e Saída
            </h2>
          </div>
          <div className="space-y-3 text-gray-600">
             <div className="flex items-start gap-3">
                <PauseCircle className="text-blue-600 shrink-0 mt-1" />
                <div>
                   <strong className="text-gray-900">Pausar:</strong> 
                   <span className="block text-sm">Disponível apenas quando você está <strong>sem atendimento ativo</strong> (Ocioso). Use para breves intervalos.</span>
                </div>
             </div>
             <div className="flex items-start gap-3">
                <LogOut className="text-gray-800 shrink-0 mt-1" />
                <div>
                   <strong className="text-gray-900">Sair / Encerrar:</strong> 
                   <span className="block text-sm">Use ao final do dia para fechar o caixa de atendimentos.</span>
                </div>
             </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

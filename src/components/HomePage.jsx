import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Tv, Heart, Code, Info } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import { normalizeRole } from '../utils/helpers';

const HomePage = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const roleNorm = userProfile?.roleNorm || normalizeRole(userProfile?.role);
  const isAtendente = roleNorm === 'atendente' || roleNorm === 'recepcionista';

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 animate-fadeIn">
      {/* Welcome Section */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl font-bold text-blue-900 tracking-tight">
          Bem-vindo ao Sistema Centro Pop
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Plataforma integrada para gestão de atendimentos e chamadas da Secretaria Municipal da Criança e Assistência Social.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Info Card */}
        {!isAtendente && (
        <Card className="p-6 border-t-4 border-t-blue-600 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <Tv size={28} />
            </div>
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-slate-800">Painel de Chamadas</h2>
              <p className="text-slate-600 leading-relaxed">
                O sistema utiliza um painel inteligente para organizar o fluxo de atendimentos. 
                Os nomes são chamados automaticamente na TV, garantindo ordem e transparência 
                no atendimento aos cidadãos.
              </p>
              <ul className="space-y-2 text-sm text-slate-500 mt-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  Organização por prioridade
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  Alertas sonoros automáticos
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                  Histórico de chamadas em tempo real
                </li>
              </ul>
            </div>
          </div>
        </Card>
        )}

        {/* Tutorial Card */}
        <Card className="p-6 border-t-4 border-t-emerald-500 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
              <BookOpen size={28} />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Precisa de Ajuda?</h2>
              <p className="text-slate-600 leading-relaxed">
                Preparamos um tutorial completo explicando passo a passo como realizar atendimentos, 
                gerenciar filas e utilizar todos os recursos do sistema.
              </p>
              <div className="pt-2">
                <Button 
                  onClick={() => navigate('/tutorial')}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 flex items-center justify-center gap-2"
                >
                  <BookOpen size={20} />
                  Acessar Tutorial Completo
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Credits Section */}
      <div className="mt-12 border-t border-slate-200 pt-8">
        <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 rounded-2xl p-8 border border-slate-100">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center">
            
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-1">
                <Code size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Desenvolvimento</h3>
                <p className="text-lg font-bold text-slate-800">Jurandy Santana</p>
                <p className="text-xs text-slate-500">Engenharia de Software</p>
              </div>
            </div>

            <div className="hidden md:block w-px h-16 bg-slate-200"></div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center mb-1">
                <Heart size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Colaboração</h3>
                <p className="text-lg font-bold text-slate-800">Jucyara</p>
                <p className="text-xs text-slate-500">Apoio e Suporte</p>
              </div>
            </div>

          </div>
          
          <div className="text-center mt-6 text-xs text-slate-400">
            <p>Feito com dedicação para a SEMCAS • São Luís - MA</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;

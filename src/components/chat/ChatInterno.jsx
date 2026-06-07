import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, orderBy, limit, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Send, MessageCircle, X, Minimize2, Maximize2 } from 'lucide-react';
import Button from '../ui/Button';

const ChatInterno = () => {
  const { db, appId, userProfile, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // Efeito para buscar mensagens em tempo real
  useEffect(() => {
    if (!db || !appId) return;

    // Reduz limite para 30 mensagens para economizar banda inicial
    const q = query(
      collection(db, `artifacts/${appId}/public/data/chat_interno`),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Snapshot listener é inteligente: só cobra leituras de documentos novos/alterados
      // A carga inicial custa 30 leituras.
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse();
      
      // Só atualiza estado se realmente mudou algo para evitar re-render
      setMessages(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(msgs)) {
            // Lógica de notificação: Se não é a primeira carga (prev.length > 0)
            // E o chat está fechado, marca como nova mensagem
            if (prev.length > 0 && !isOpen && msgs.length > prev.length) {
                setHasNewMessage(true);
            }
            return msgs;
        }
        return prev;
      });
    });

    return () => unsubscribe();
  }, [db, appId]); // Removido isOpen das dependências para não recriar o listener ao abrir/fechar (economiza leituras)

  // Scroll para o final quando abrir ou nova mensagem chegar
  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      setHasNewMessage(false);
    }
  }, [messages, isOpen, isMinimized]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setIsSending(true);

    // Normaliza o cargo para exibição (ex: "Coordenadora" -> "Coordenador")
    let roleDisplay = userProfile?.cargo || userProfile?.role || "Indefinido";
    const roleLower = roleDisplay.toLowerCase();
    
    if (roleLower.includes('coordenadora') || roleLower.includes('coordenador')) {
      roleDisplay = "Coordenador(a)";
    } else if (roleLower.includes('psicólogo') || roleLower.includes('psicóloga') || roleLower.includes('psicologo') || roleLower.includes('psicologa')) {
      roleDisplay = "Psicólogo(a)";
    } else if (roleLower.includes('administrativo')) {
      roleDisplay = "Administrativo";
    } else if (roleLower.includes('cadunico') || roleLower.includes('cadúnico')) {
      roleDisplay = "Operador CadÚnico";
    } else if (roleLower.includes('recepcionista') || roleLower.includes('recepção')) {
      roleDisplay = "Recepção";
    } else if (roleLower.includes('atendente')) {
      roleDisplay = "Atendente";
    } else if (roleLower.includes('assistente social')) {
      roleDisplay = "Assistente Social";
    }

    try {
      await addDoc(collection(db, `artifacts/${appId}/public/data/chat_interno`), {
        text: newMessage,
        senderId: user?.uid || userProfile?.uid, // Usa UID do Auth ou do Perfil (garante que não seja undefined)
        senderName: userProfile?.nome || "Usuário",
        senderRole: roleDisplay, // Usa o cargo normalizado
        createdAt: serverTimestamp()
      });
      setNewMessage("");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsSending(false);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    setIsMinimized(false);
    if (!isOpen) setHasNewMessage(false);
  };

  if (!userProfile) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
      {/* Janela do Chat */}
      {isOpen && (
        <div className={`pointer-events-auto bg-white rounded-lg shadow-2xl border border-gray-200 mb-4 transition-all duration-300 overflow-hidden flex flex-col ${isMinimized ? 'w-72 h-12' : 'w-80 sm:w-96 h-[500px]'}`}>
          
          {/* Header */}
          <div 
            className="bg-blue-600 text-white p-3 flex justify-between items-center cursor-pointer hover:bg-blue-700 transition-colors"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <div className="flex items-center gap-2 font-bold">
              <MessageCircle size={18} />
              <span>Chat da Equipe</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="p-1 hover:bg-blue-500 rounded">
                {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="p-1 hover:bg-blue-500 rounded">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Corpo das Mensagens */}
          {!isMinimized && (
            <>
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-10">
                    Nenhuma mensagem ainda.<br/>Diga oi para a equipe!
                  </div>
                )}
                
                {messages.map((msg) => {
                  const isMe = msg.senderId === user?.uid || msg.senderId === userProfile?.uid;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] rounded-lg p-2 text-sm shadow-sm ${
                        isMe 
                          ? 'bg-blue-100 text-blue-900 rounded-tr-none' 
                          : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                      }`}>
                        {!isMe && (
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[10px] font-bold text-gray-600">{msg.senderName}</span>
                            <span className="text-[9px] text-gray-400 font-medium bg-gray-100 px-1 rounded uppercase">{msg.senderRole}</span>
                          </div>
                        )}
                        <div className="break-words">{msg.text}</div>
                      </div>
                      <span className="text-[9px] text-gray-400 mt-0.5 px-1">
                        {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 text-sm border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="rounded-full w-10 h-10 shrink-0"
                  disabled={!newMessage.trim() || isSending}
                >
                  <Send size={18} />
                </Button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Botão Flutuante (quando fechado) */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="pointer-events-auto bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 flex items-center justify-center relative group"
        >
          <MessageCircle size={24} />
          {hasNewMessage && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
          )}
          <span className="absolute right-full mr-3 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Chat Interno
          </span>
        </button>
      )}
    </div>
  );
};

export default ChatInterno;
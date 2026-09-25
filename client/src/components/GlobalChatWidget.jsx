import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User, Circle, AlertCircle, FileText } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { socket } from '../utils/socket';
import { playNotificationChime } from '../utils/audio';

// Helper function to format media JSON snippets in the widget chat list
const formatLastMessage = (text) => {
  if (!text) return '';
  try {
    if (text.startsWith('{') && text.endsWith('}')) {
      const media = JSON.parse(text);
      if (media.mediaType === 'image') return '📷 Imagem';
      if (media.mediaType === 'audio') return '🎵 Mensagem de voz';
      if (media.mediaType === 'video') return '🎥 Vídeo';
      if (media.mediaType === 'document') return `📄 ${media.fileName || 'Arquivo'}`;
    }
  } catch (e) {}
  return text;
};

export default function GlobalChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null); // contact phone number
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [whatsAppStatus, setWhatsAppStatus] = useState({ status: 'close', qr: null });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Fetch recent conversations and WhatsApp connection status
  const fetchChats = async () => {
    try {
      const data = await apiFetch('/whatsapp/conversas');
      setChats(data);
    } catch (err) {
      console.error('Erro ao buscar conversas do WhatsApp:', err);
    }
  };

  const fetchWhatsAppStatus = async () => {
    try {
      const data = await apiFetch('/whatsapp/status');
      setWhatsAppStatus(data);
    } catch (err) {
      console.error('Erro ao buscar status do WhatsApp:', err);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchWhatsAppStatus();

    // Listen to WhatsApp message socket events
    socket.on('whatsapp_mensagem', (msg) => {
      if (msg.direcao === 'inbound') {
        playNotificationChime();
        setIsFlashing(true);
        setUnreadCount(prev => prev + 1);
        fetchChats(); // Refresh list

        // If we currently have this chat open, append message
        if (activeChat && msg.contato_whatsapp === activeChat) {
          setMessages(prev => [...prev, msg]);
        }
      } else {
        // Outbound sent from server/another UI, refresh chat list and append if active
        fetchChats();
        if (activeChat && msg.contato_whatsapp === activeChat) {
          setMessages(prev => [...prev, msg]);
        }
      }
    });

    socket.on('whatsapp_mensagem_status', (data) => {
      setMessages(prev => prev.map(m => {
        if (m.mensagem_id === data.mensagem_id || m.id === data.id) {
          return { ...m, status: data.status };
        }
        return m;
      }));
    });

    // Listen to connection status events
    socket.on('whatsapp_status', (status) => {
      setWhatsAppStatus(status);
    });

    return () => {
      socket.off('whatsapp_mensagem');
      socket.off('whatsapp_mensagem_status');
      socket.off('whatsapp_status');
    };
  }, [activeChat]);

  // Scroll to bottom of chat thread when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (contact) => {
    try {
      const data = await apiFetch(`/whatsapp/conversas/${contact}`);
      setMessages(data);
      setActiveChat(contact);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    }
  };

  const handleOpenWidget = () => {
    setIsOpen(!isOpen);
    setIsFlashing(false);
    setUnreadCount(0);
    fetchChats();
    fetchWhatsAppStatus();
  };

  const handleSelectChat = (chat) => {
    loadMessages(chat.contato_whatsapp);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    try {
      await apiFetch('/whatsapp/enviar', {
        method: 'POST',
        body: { contact: activeChat, message: newMessage }
      });
      
      setNewMessage('');
      fetchChats(); // Update last message in chat list
    } catch (err) {
      alert(`Falha ao enviar mensagem: ${err.message}`);
    }
  };

  const getStatusColor = () => {
    if (whatsAppStatus.status === 'open') return 'bg-emerald-500';
    if (whatsAppStatus.status === 'connecting') return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getStatusLabel = () => {
    if (whatsAppStatus.status === 'open') return 'WhatsApp Online';
    if (whatsAppStatus.status === 'connecting') return 'Conectando...';
    return 'WhatsApp Offline';
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-body">
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <button
          onClick={handleOpenWidget}
          className={`flex items-center justify-center w-14 h-14 rounded-full text-white shadow-2xl relative transition-all duration-300 transform hover:scale-110 active:scale-95 ${
            isFlashing 
              ? 'bg-sp-magenta animate-bounce ring-4 ring-sp-magenta/30' 
              : 'bg-sp-blue hover:bg-sp-blue-light'
          }`}
        >
          <MessageSquare size={24} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-sp-magenta text-white font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-sp-dark animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Expanded Widget Window */}
      {isOpen && (
        <div className="w-96 h-[480px] rounded-2xl glass-panel shadow-2xl flex flex-direction-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-800/80">
            <div className="flex items-center gap-3">
              <MessageSquare className="text-sp-cyan" size={20} />
              <div>
                <h3 className="font-title font-bold text-sm text-white">Central de Atendimento</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                  <span className="text-[10px] text-slate-400 font-semibold">{getStatusLabel()}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => { setIsOpen(false); setActiveChat(null); }} 
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/40">
            {/* If WhatsApp is offline and not paired */}
            {whatsAppStatus.status !== 'open' && chats.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <AlertCircle size={36} className="text-sp-magenta mb-3 animate-pulse" />
                <p className="text-xs mb-2">O WhatsApp está desconectado do servidor local.</p>
                <p className="text-[10px] text-slate-500">Acesse a aba <strong>WhatsApp</strong> no painel lateral para ler o QR Code e parear o dispositivo.</p>
              </div>
            )}

            {/* General Chat Dashboard View */}
            {!activeChat && (whatsAppStatus.status === 'open' || chats.length > 0) && (
              <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                {chats.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Nenhuma conversa registrada.
                  </div>
                ) : (
                  chats.map((chat, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectChat(chat)}
                      className="p-3.5 flex items-start gap-3 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sp-cyan font-bold border border-white/10">
                        {chat.cliente_nome ? chat.cliente_nome[0].toUpperCase() : <User size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="text-xs font-bold text-white truncate pr-2">
                            {chat.cliente_nome}
                          </span>
                          <span className="text-[9px] text-slate-500 shrink-0">
                            {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {chat.direcao === 'outbound' ? 'Você: ' : ''}{formatLastMessage(chat.ultimo_texto)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Active Conversation Message Thread */}
            {activeChat && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Chat Partner Bar */}
                <div className="px-4 py-2 border-b border-white/5 bg-slate-800/20 flex items-center gap-2 text-xs">
                  <button 
                    onClick={() => setActiveChat(null)}
                    className="text-sp-cyan hover:underline mr-1 font-bold"
                  >
                    &larr; Voltar
                  </button>
                  <span className="text-white font-bold truncate">
                    {chats.find(c => c.contato_whatsapp === activeChat)?.cliente_nome || activeChat}
                  </span>
                </div>

                {/* Messages Log */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg, idx) => {
                    const isMe = msg.direcao === 'outbound';
                    return (
                      <div
                        key={idx}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-md ${
                            isMe
                              ? 'bg-sp-blue text-white rounded-tr-none'
                              : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'
                          }`}
                        >
                          <div className="leading-relaxed">
                            {(() => {
                              try {
                                if (msg.mensagem.startsWith('{') && msg.mensagem.endsWith('}')) {
                                  const media = JSON.parse(msg.mensagem);
                                  if (media && media.url) {
                                    const fullUrl = `http://localhost:3001${media.url}`;
                                    
                                    if (media.mediaType === 'image') {
                                      return (
                                        <div className="space-y-1">
                                          <img
                                            src={fullUrl}
                                            alt="Anexo"
                                            className="max-w-full max-h-32 rounded-lg cursor-pointer hover:opacity-90 transition border border-white/10"
                                            onClick={() => window.open(fullUrl, '_blank')}
                                          />
                                          {media.text && <p className="text-[10px] text-slate-200 mt-1">{media.text}</p>}
                                        </div>
                                      );
                                    }
                                    
                                    if (media.mediaType === 'audio') {
                                      return (
                                        <div className="space-y-1 py-0.5">
                                          <audio src={fullUrl} controls className="max-w-full h-8 bg-slate-900 rounded scale-90 origin-left" />
                                          {media.text && <p className="text-[10px] text-slate-200">{media.text}</p>}
                                        </div>
                                      );
                                    }

                                    if (media.mediaType === 'video') {
                                      return (
                                        <div className="space-y-1">
                                          <video src={fullUrl} controls className="max-w-full max-h-32 rounded-lg border border-white/10" />
                                          {media.text && <p className="text-[10px] text-slate-200 mt-1">{media.text}</p>}
                                        </div>
                                      );
                                    }

                                    if (media.mediaType === 'document') {
                                      return (
                                        <a
                                          href={fullUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 p-1.5 rounded bg-slate-900/60 hover:bg-slate-900/80 border border-white/5 transition text-sp-cyan hover:text-sp-cyan/80 font-bold"
                                        >
                                          <FileText size={14} className="shrink-0 text-sp-cyan" />
                                          <div className="text-left min-w-0 flex-1">
                                            <p className="text-[10px] font-bold truncate text-white">{media.fileName || 'Arquivo'}</p>
                                            <p className="text-[8px] text-slate-400">Clique para abrir</p>
                                          </div>
                                        </a>
                                      );
                                    }
                                  }
                                }
                              } catch (e) {
                                // Not JSON
                              }

                              return <p className="whitespace-pre-wrap">{msg.mensagem}</p>;
                            })()}
                          </div>
                          <span className="flex items-center justify-end gap-1 text-[8px] text-right mt-1 opacity-60 select-none">
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && (
                              <span className="inline-flex">
                                {msg.status === 4 ? (
                                  <svg className="w-3 h-3 text-sp-cyan font-bold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="1.5 12.5 7.75 18.75 22.5 4" />
                                    <polyline points="7.75 12.5 14 18.75 22.5 10" />
                                  </svg>
                                ) : msg.status === 3 ? (
                                  <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="1.5 12.5 7.75 18.75 22.5 4" />
                                    <polyline points="7.75 12.5 14 18.75 22.5 10" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 12 9 18 21 6" />
                                  </svg>
                                )}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input footer */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-slate-800/40 flex gap-2">
                  <input
                    type="text"
                    placeholder="Digite sua resposta..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={whatsAppStatus.status !== 'open'}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sp-cyan"
                  />
                  <button
                    type="submit"
                    disabled={whatsAppStatus.status !== 'open' || !newMessage.trim()}
                    className="px-3 py-1.5 rounded-xl bg-sp-blue text-white disabled:opacity-40 disabled:hover:scale-100 hover:bg-sp-blue-light transition-all flex items-center justify-center transform active:scale-95"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

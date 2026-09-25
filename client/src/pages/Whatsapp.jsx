import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, User, Circle, AlertCircle, RefreshCw, CheckCircle, Wifi, Shield, Phone, FileText, FastForward, LogOut } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { socket } from '../utils/socket';
import ModalCadastroCliente from '../components/ModalCadastroCliente';
import StatusBadge from '../components/StatusBadge';

// Helper function to format media JSON snippets in the sidebar chat list
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

export default function Whatsapp() {
  const [status, setStatus] = useState({ status: 'close', qr: null });
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // phone number
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  
  // Right sidebar details of selected customer
  const [clientInfo, setClientInfo] = useState(null);

  // Registration modal states
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  // Sidebar tabs and order creation states
  const [activeDetailsTab, setActiveDetailsTab] = useState('cadastro'); // 'cadastro', 'pedidos'
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [clientOrders, setClientOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderForm, setOrderForm] = useState({
    formaPagamento: 'Pix',
    detalhes: '',
    origem: 'whatsapp',
    retirada: 'Imediato',
    total: '0.00'
  });
  const [selectedFiles, setSelectedFiles] = useState({}); // msgId -> { selected: boolean, desc: string }

  const messagesEndRef = useRef(null);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const data = await apiFetch('/whatsapp/status');
      setStatus(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const fetchChats = async () => {
    setIsLoadingChats(true);
    try {
      const data = await apiFetch('/whatsapp/conversas');
      setChats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // On mount
  useEffect(() => {
    fetchStatus();
    fetchChats();

    // Listen to real-time events
    socket.on('whatsapp_mensagem', (msg) => {
      // Refresh chat list to update last message snippet
      fetchChats();

      // Append message if active
      if (activeChat && msg.contato_whatsapp === activeChat) {
        setMessages(prev => [...prev, msg]);
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

    socket.on('whatsapp_foto_atualizada', (data) => {
      setChats(prev => prev.map(c => {
        if (c.contato_whatsapp === data.contato_whatsapp) {
          return { ...c, foto_url: data.foto_url };
        }
        return c;
      }));
    });

    socket.on('whatsapp_status', (newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      socket.off('whatsapp_mensagem');
      socket.off('whatsapp_mensagem_status');
      socket.off('whatsapp_foto_atualizada');
      socket.off('whatsapp_status');
    };
  }, [activeChat]);

  // Scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load client metadata when selecting chat
  const handleSelectChat = async (contact) => {
    setActiveChat(contact);
    setClientInfo(null);
    try {
      // Load messages
      const msgData = await apiFetch(`/whatsapp/conversas/${contact}`);
      setMessages(msgData);

      // Try searching client table by phone number to display metadata
      const clientResult = await apiFetch(`/clientes?search=${contact}`);
      if (clientResult && clientResult.length > 0) {
        setClientInfo(clientResult[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;
    await sendTextMessage(newMessage.trim());
    setNewMessage('');
  };

  const sendTextMessage = async (text) => {
    try {
      await apiFetch('/whatsapp/enviar', {
        method: 'POST',
        body: { contact: activeChat, message: text }
      });
      fetchChats();
    } catch (err) {
      alert(`Erro ao enviar mensagem: ${err.message}`);
    }
  };

  const handleStartRegistration = () => {
    const activeChatObj = chats.find(c => c.contato_whatsapp === activeChat);
    let pushName = activeChatObj ? activeChatObj.cliente_nome : '';
    
    // If pushName looks like a phone number (e.g. starts with '+' or is purely numeric), leave it empty
    const isPhoneNumber = pushName && (pushName.startsWith('+') || /^\d+$/.test(pushName.replace(/\D/g, '')));
    if (isPhoneNumber) {
      pushName = '';
    }
    
    setEditingClient({
      id: null,
      nome: pushName || '',
      whatsapp: activeChat || '',
      email: '',
      tipo: 'Aluno',
      ra: '',
      curso_matricula: ''
    });
    setIsRegisterModalOpen(true);
  };

  const handleStartEditing = () => {
    if (!clientInfo) return;
    setEditingClient(clientInfo);
    setIsRegisterModalOpen(true);
  };

  const fetchClientHistory = async (clientId) => {
    if (!clientId) return;
    setIsLoadingOrders(true);
    try {
      const data = await apiFetch(`/clientes/${clientId}/historico`);
      setClientOrders(data.pedidos || []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (clientInfo) {
      fetchClientHistory(clientInfo.id);
    } else {
      setClientOrders([]);
      setActiveDetailsTab('cadastro');
      setIsCreatingOrder(false);
    }
  }, [clientInfo]);

  const handleStartOrderCreation = () => {
    setOrderForm({
      formaPagamento: 'Pix',
      detalhes: '',
      origem: 'whatsapp',
      retirada: 'Imediato',
      total: '0.00'
    });
    setSelectedFiles({});
    setIsCreatingOrder(true);
  };

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (isSavingOrder) return;
    setIsSavingOrder(true);
    try {
      const fileItems = Object.entries(selectedFiles)
        .filter(([_, fileData]) => fileData.selected)
        .map(([msgId, fileData]) => {
          const msg = messages.find(m => (m.mensagem_id === msgId || m.id.toString() === msgId));
          const media = JSON.parse(msg.mensagem);
          return {
            descricao: `[ARQUIVO] ${media.fileName || 'Sem Nome'} - ${fileData.desc || 'Sem observações'} | Link: ${media.url}`,
            quantidade: 1,
            valor_unitario: 0.00
          };
        });

      const firstSelectedKey = Object.keys(selectedFiles).find(k => selectedFiles[k].selected);
      let fileUrl = '';
      if (firstSelectedKey) {
        const msg = messages.find(m => (m.mensagem_id === firstSelectedKey || m.id.toString() === firstSelectedKey));
        const media = JSON.parse(msg.mensagem);
        fileUrl = media.url || '';
      }

      const payload = {
        cliente_id: clientInfo.id,
        forma_pagamento: orderForm.formaPagamento,
        total: Number(orderForm.total),
        caminho_arquivo: fileUrl,
        itens: [
          {
            descricao: `[Origem: ${orderForm.origem.toUpperCase()}] [Retirada: ${orderForm.retirada}] ${orderForm.detalhes}`,
            quantidade: 1,
            valor_unitario: Number(orderForm.total)
          },
          ...fileItems
        ],
        status_inicial: orderForm.formaPagamento === 'Pix' ? 'Aguardando Pagamento' : 'Na Fila / A Imprimir'
      };

      await apiFetch('/pedidos', {
        method: 'POST',
        body: payload
      });

      setIsCreatingOrder(false);
      fetchClientHistory(clientInfo.id);
    } catch (err) {
      alert(`Erro ao criar pedido: ${err.message}`);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente encerrar a conexão e limpar o histórico de mensagens local do WhatsApp?')) return;
    try {
      await apiFetch('/whatsapp/desconectar', { method: 'POST' });
      setActiveChat(null);
      setMessages([]);
      setChats([]);
      setClientInfo(null);
      fetchStatus();
    } catch (err) {
      alert(`Falha ao encerrar conexão: ${err.message}`);
    }
  };

  // Quick responses shortcuts
  const quickResponses = [
    { label: 'Retirada', text: 'Seu pedido está pronto para retirada! Pode vir buscá-lo no balcão da Sanpress. 🖨️' },
    { label: 'Boas-Vindas', text: 'Olá! Como posso ajudar você hoje?' },
    { label: 'Arquivo Recebido', text: 'Recebemos o seu arquivo de impressão! Vamos processar e colocá-lo na fila em breve. Retornamos assim que estiver pronto.' },
    { label: 'Chave Pix', text: 'Nossa chave Pix CNPJ é: 12.345.678/0001-99 (Sanpress Copiadora). Por favor envie o comprovante por aqui.' }
  ];

  return (
    <div className="p-6 space-y-6 font-body h-full flex flex-col min-h-0 text-slate-800 text-left">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 shrink-0 border-b border-slate-200/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-title">Atendimento WhatsApp</h1>
          <p className="text-slate-500 text-xs mt-1">Converse com clientes e lance pedidos diretamente na fila de produção.</p>
        </div>
        
        <div className="flex gap-2">
          {status.status === 'open' && (
            <button
              onClick={handleDisconnect}
              title="Encerrar Conexão"
              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition shadow-sm flex items-center justify-center gap-1.5 text-xs text-white"
            >
              <LogOut size={13} />
              <span>Desconectar</span>
            </button>
          )}
          <button
            onClick={fetchStatus}
            disabled={isLoadingStatus}
            title="Atualizar Conexão"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 hover:text-slate-800 transition shadow-sm flex items-center justify-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw size={13} className={isLoadingStatus ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Split QR/Connection Status or Full Chat Console */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        
        {/* If WhatsApp is NOT Connected, display pairing panel in full */}
        {status.status !== 'open' ? (
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-2xl space-y-6 shadow-sm">
            <div className="text-center max-w-md space-y-3">
              <Wifi size={48} className="mx-auto text-sp-magenta animate-pulse" />
              <h2 className="text-lg font-bold text-slate-900 font-title">Pareamento Necessário</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                O servidor local Node.js precisa estar pareado a uma conta do WhatsApp para que as automações de fila funcionem.
              </p>
            </div>

            {/* Render QR Code if generated, otherwise show connection loader or error */}
            {status.qr ? (
              <div className="flex flex-col items-center gap-4 p-6 border border-slate-200 rounded-2xl bg-white text-slate-900 shadow-2xl animate-in zoom-in-95 duration-200">
                <img src={status.qr} alt="WhatsApp QR Code" className="w-56 h-56" />
                <div className="text-center space-y-1">
                  <p className="text-xs font-black">Escaneie o QR Code no seu celular</p>
                  <p className="text-[10px] text-slate-500 max-w-[200px] leading-normal mx-auto">Abra o WhatsApp &gt; Dispositivos Conectados &gt; Conectar Dispositivo.</p>
                </div>
              </div>
            ) : status.status === 'connecting' ? (
              <div className="flex flex-col items-center gap-3 p-8 border border-slate-200 rounded-xl bg-slate-50">
                <RefreshCw size={36} className="text-sp-blue animate-spin" />
                <span className="text-xs font-bold text-slate-650">Inicializando conexão com o WhatsApp Web...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 border border-red-200 bg-red-50 rounded-xl text-center max-w-sm">
                <AlertCircle size={28} className="text-red-650" />
                <p className="text-xs text-red-700 font-bold">QR Code pendente ou expirado.</p>
                <p className="text-[10px] text-red-650">Aguardando geração do código. Clique no botão de atualizar acima.</p>
              </div>
            )}
          </div>
        ) : (
          /* WHATSAPP ONLINE: FULL CHAT CONSOLE WORKSPACE */
          <>
            {/* COLUMN 1: Active Conversations List */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col min-h-[300px] lg:h-full min-h-0 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-550 mb-3 flex items-center justify-between">
                <span>Conversas Recentes</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
              </h3>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {chats.length === 0 ? (
                  <div className="text-center text-[10px] text-slate-400 italic py-12">
                    Nenhuma conversa no banco de dados.
                  </div>
                ) : (
                  chats.map((chat) => (
                    <div
                      key={chat.contato_whatsapp}
                      onClick={() => handleSelectChat(chat.contato_whatsapp)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        activeChat === chat.contato_whatsapp
                          ? 'border-sp-blue bg-sp-blue/5 text-slate-900 shadow-sm'
                          : 'border-slate-100 bg-slate-50/50 text-slate-700 hover:border-slate-200 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-sp-blue/10 flex items-center justify-center font-bold text-xs shrink-0 text-sp-blue overflow-hidden">
                        {chat.foto_url ? (
                          <img src={chat.foto_url} alt={chat.cliente_nome} className="w-full h-full object-cover" />
                        ) : (
                          chat.cliente_nome ? chat.cliente_nome[0].toUpperCase() : <User size={14} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="text-xs font-bold truncate pr-1 text-slate-900">{chat.cliente_nome}</h4>
                          <span className="text-[9px] text-slate-400 shrink-0">
                            {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate leading-relaxed">
                          {chat.direcao === 'outbound' ? 'Você: ' : ''}{formatLastMessage(chat.ultimo_texto)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLUMN 2: Message Flow Thread */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl flex flex-col min-h-[400px] lg:h-full min-h-0 overflow-hidden shadow-sm">
              {activeChat ? (
                <>
                  {/* Chat Partner Header bar */}
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-3 shrink-0">
                    <div className="w-8 h-8 rounded-full bg-sp-blue/15 flex items-center justify-center font-bold text-xs shrink-0 text-sp-blue overflow-hidden">
                      {(() => {
                        const curChat = chats.find(c => c.contato_whatsapp === activeChat);
                        return curChat && curChat.foto_url ? (
                          <img src={curChat.foto_url} alt={curChat.cliente_nome} className="w-full h-full object-cover" />
                        ) : (
                          curChat && curChat.cliente_nome ? curChat.cliente_nome[0].toUpperCase() : <User size={14} />
                        );
                      })()}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {chats.find(c => c.contato_whatsapp === activeChat)?.cliente_nome || activeChat}
                      </h3>
                      <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">+{activeChat}</span>
                    </div>
                  </div>

                  {/* Message Bubble Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#eae6df]">
                    {messages.map((msg, idx) => {
                      const isMe = msg.direcao === 'outbound';
                      return (
                        <div
                          key={idx}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-sm space-y-1 ${
                              isMe
                                ? 'bg-sp-blue text-white rounded-tr-none'
                                : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/60'
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
                                          <div className="space-y-1.5 py-0.5">
                                            <img
                                              src={fullUrl}
                                              alt="Anexo de Imagem"
                                              className="max-w-full max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition border border-slate-200"
                                              onClick={() => window.open(fullUrl, '_blank')}
                                            />
                                            {media.text && <p className="text-[11px] whitespace-pre-wrap text-slate-650 mt-1">{media.text}</p>}
                                          </div>
                                        );
                                      }
                                      
                                      if (media.mediaType === 'audio') {
                                        return (
                                          <div className="space-y-1 py-1">
                                            <audio controls src={fullUrl} className="max-w-full" />
                                          </div>
                                        );
                                      }
                                      
                                      if (media.mediaType === 'video') {
                                        return (
                                          <div className="space-y-1.5 py-0.5">
                                            <video controls src={fullUrl} className="max-w-full max-h-48 rounded-lg border border-slate-200" />
                                            {media.text && <p className="text-[11px] whitespace-pre-wrap text-slate-655 mt-1">{media.text}</p>}
                                          </div>
                                        );
                                      }
                                      
                                      if (media.mediaType === 'document') {
                                        return (
                                          <div className="space-y-1 py-0.5">
                                            <a
                                              href={fullUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-1.5 font-bold text-sp-blue hover:underline"
                                            >
                                              <FileText size={16} />
                                              <span className="truncate max-w-[180px]">{media.fileName || 'Baixar Documento'}</span>
                                            </a>
                                            {media.text && <p className="text-[11px] whitespace-pre-wrap text-slate-655 mt-1">{media.text}</p>}
                                          </div>
                                        );
                                      }
                                    }
                                  }
                                } catch (e) {}

                                return <p className="whitespace-pre-wrap">{msg.mensagem}</p>;
                              })()}
                            </div>
                            <span className={`flex items-center justify-end gap-1 text-[8px] text-right opacity-70 mt-0.5 select-none ${isMe ? 'text-white' : 'text-slate-550'}`}>
                              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {msg.direcao === 'outbound' && (
                                <span className="inline-flex">
                                  {msg.status === 4 ? (
                                    <svg className="w-3 h-3 text-sp-cyan font-bold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="1.5 12.5 7.75 18.75 22.5 4" />
                                      <polyline points="7.75 12.5 14 18.75 22.5 10" />
                                    </svg>
                                  ) : msg.status === 3 ? (
                                    <svg className="w-3 h-3 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="1.5 12.5 7.75 18.75 22.5 4" />
                                      <polyline points="7.75 12.5 14 18.75 22.5 10" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
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

                  {/* Quick responses toolbar */}
                  <div className="px-4 py-2 bg-slate-55 border-t border-slate-200 flex gap-1.5 overflow-x-auto shrink-0 select-none">
                    {quickResponses.map((qr, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendTextMessage(qr.text)}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-sp-blue/5 border border-slate-200 text-[9px] font-bold text-sp-blue hover:text-sp-blue transition flex items-center gap-1 shrink-0 transform active:scale-95 shadow-sm"
                      >
                        <FastForward size={10} className="text-sp-blue" />
                        <span>{qr.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Text Input Message Area */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-slate-55 flex gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="Digite a mensagem de WhatsApp..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sp-blue focus:ring-1 focus:ring-sp-blue"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="px-5 py-2.5 rounded-xl bg-sp-blue text-white disabled:opacity-40 disabled:hover:scale-100 hover:bg-sp-blue-light transition-all flex items-center justify-center transform active:scale-95 shadow-md font-bold"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 italic">
                  <MessageSquare size={36} className="text-slate-300 mb-2" />
                  <p className="text-xs">Selecione uma conversa ao lado para responder.</p>
                </div>
              )}
            </div>

            {/* COLUMN 3: Client Details Context Panel */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col h-full min-h-0 overflow-y-auto shadow-sm">
              
              {/* Tab Selector */}
              {activeChat && clientInfo && (
                <div className="flex border-b border-slate-200 mb-4 shrink-0">
                  <button
                    onClick={() => { setActiveDetailsTab('cadastro'); setIsCreatingOrder(false); }}
                    className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider transition ${
                      activeDetailsTab === 'cadastro' ? 'border-b-2 border-sp-blue text-slate-850' : 'text-slate-400 hover:text-slate-650'
                    }`}
                  >
                    Cadastro
                  </button>
                  <button
                    onClick={() => setActiveDetailsTab('pedidos')}
                    className={`flex-1 pb-2 text-xs font-bold uppercase tracking-wider transition ${
                      activeDetailsTab === 'pedidos' ? 'border-b-2 border-sp-blue text-slate-850' : 'text-slate-400 hover:text-slate-650'
                    }`}
                  >
                    Pedidos ({clientOrders.length})
                  </button>
                </div>
              )}

              {(!activeChat || !clientInfo) && (
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4 pb-2 border-b border-slate-100">
                  Dados Cadastrados
                </h3>
              )}
   
              {activeChat ? (
                clientInfo ? (
                  activeDetailsTab === 'cadastro' ? (
                    <div className="space-y-6">
                      {/* Customer overview */}
                      <div className="text-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-sp-blue/15 text-sp-blue border border-sp-blue/10 flex items-center justify-center font-bold text-xl mx-auto overflow-hidden">
                          {(() => {
                            const curChat = chats.find(c => c.contato_whatsapp === activeChat);
                            return curChat && curChat.foto_url ? (
                              <img src={curChat.foto_url} alt={clientInfo.nome} className="w-full h-full object-cover" />
                            ) : (
                              clientInfo.nome[0]
                            );
                          })()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{clientInfo.nome}</h4>
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-bold uppercase mt-1.5 ${
                            clientInfo.tipo === 'Aluno' ? 'bg-sp-blue/10 text-sp-blue' : clientInfo.tipo === 'Professor' ? 'bg-sp-magenta/10 text-sp-magenta' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {clientInfo.tipo}
                          </span>
                        </div>
                      </div>
    
                      {/* Meta Fields list */}
                      <div className="space-y-4 text-xs text-slate-600">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Phone size={14} className="text-slate-400" />
                          <span>+{clientInfo.whatsapp}</span>
                        </div>
                        
                        {clientInfo.ra && (
                          <div className="space-y-1">
                            <span className="block text-[10px] font-black text-slate-550 uppercase">RA Acadêmico</span>
                            <span className="text-slate-800 font-semibold text-xs">{clientInfo.ra}</span>
                          </div>
                        )}
    
                        {clientInfo.curso_matricula && (
                          <div className="space-y-1">
                            <span className="block text-[10px] font-black text-slate-550 uppercase">Curso / Faculdade</span>
                            <span className="text-slate-800 font-semibold text-xs leading-relaxed">{clientInfo.curso_matricula}</span>
                          </div>
                        )}
    
                        {clientInfo.email && (
                          <div className="space-y-1">
                            <span className="block text-[10px] font-black text-slate-550 uppercase">E-mail</span>
                            <span className="text-slate-800 truncate block font-semibold text-xs">{clientInfo.email}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleStartEditing}
                        className="w-full py-2.5 rounded-xl border border-sp-blue/40 text-sp-blue hover:bg-sp-blue/5 font-bold text-xs transition flex items-center justify-center gap-1.5"
                      >
                        <User size={13} />
                        <span>Editar Perfil</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0 text-slate-800">
                      {isCreatingOrder ? (
                        <form onSubmit={handleSaveOrder} className="space-y-3.5 text-xs text-left flex-1">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Novo Pedido</h4>
                            <button
                              type="button"
                              onClick={() => setIsCreatingOrder(false)}
                              className="text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                            >
                              Voltar
                            </button>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="block text-[9px] font-black text-slate-500 uppercase">Forma de pagamento *</label>
                              <button
                                type="button"
                                onClick={() => sendTextMessage("Qual a forma de pagamento de sua preferência? Aceitamos Pix, Cartão de Crédito/Débito e Dinheiro.")}
                                className="text-[8px] font-bold text-sp-cyan hover:text-sp-cyan/80 flex items-center gap-1 bg-sp-blue/10 px-1.5 py-0.5 rounded transition"
                              >
                                <MessageSquare size={10} />
                                <span>Perguntar</span>
                              </button>
                            </div>
                            <select
                              value={orderForm.formaPagamento}
                              onChange={(e) => setOrderForm({...orderForm, formaPagamento: e.target.value})}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-855 text-xs bg-white"
                            >
                              <option value="Pix">Pix</option>
                              <option value="Dinheiro">Dinheiro</option>
                              <option value="Cartão Crédito">Cartão de Crédito</option>
                              <option value="Cartão Débito">Cartão de Débito</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[9px] font-black text-slate-500 uppercase">Valor Total (R$) *</label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={orderForm.total}
                                onChange={(e) => setOrderForm({...orderForm, total: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-855 text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[9px] font-black text-slate-500 uppercase">Origem *</label>
                              <select
                                value={orderForm.origem}
                                onChange={(e) => setOrderForm({...orderForm, origem: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-855 text-xs bg-white"
                              >
                                <option value="whatsapp">WhatsApp</option>
                                <option value="balcão">Balcão</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="block text-[9px] font-black text-slate-500 uppercase">Quando pretende pegar *</label>
                              <button
                                type="button"
                                onClick={() => sendTextMessage("Para quando você precisa deste material pronto? (Pode ser imediato ou em alguma data/hora específica).")}
                                className="text-[8px] font-bold text-sp-cyan hover:text-sp-cyan/80 flex items-center gap-1 bg-sp-blue/10 px-1.5 py-0.5 rounded transition"
                              >
                                <MessageSquare size={10} />
                                <span>Perguntar</span>
                              </button>
                            </div>
                            <input
                              type="text"
                              required
                              value={orderForm.retirada}
                              onChange={(e) => setOrderForm({...orderForm, retirada: e.target.value})}
                              placeholder="Ex: Imediato ou 05/08 às 16h"
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-855 text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="block text-[9px] font-black text-slate-500 uppercase">Detalhes do pedido *</label>
                              <button
                                type="button"
                                onClick={() => sendTextMessage("Poderia me detalhar como deseja o seu serviço (quantidade, tipo de papel, encadernação, etc.)?")}
                                className="text-[8px] font-bold text-sp-cyan hover:text-sp-cyan/80 flex items-center gap-1 bg-sp-blue/10 px-1.5 py-0.5 rounded transition"
                              >
                                <MessageSquare size={10} />
                                <span>Perguntar</span>
                              </button>
                            </div>
                            <textarea
                              required
                              rows={3}
                              value={orderForm.detalhes}
                              onChange={(e) => setOrderForm({...orderForm, detalhes: e.target.value})}
                              placeholder="Descreva o serviço..."
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-855 text-xs"
                            />
                          </div>

                          {/* File Selection Grid */}
                          {(() => {
                            const mediaMessages = messages.filter(msg => {
                              try {
                                if (msg.mensagem.startsWith('{') && msg.mensagem.endsWith('}')) {
                                  const parsed = JSON.parse(msg.mensagem);
                                  return parsed && parsed.url && parsed.mediaType !== 'audio';
                                }
                              } catch (e) {}
                              return false;
                            });

                            if (mediaMessages.length === 0) return null;

                            return (
                              <div className="space-y-2 border-t border-slate-150 pt-3">
                                <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">
                                  Vincular Arquivos do Chat ({mediaMessages.length})
                                </label>
                                <div className="max-h-36 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50">
                                  {mediaMessages.map((msg) => {
                                    const media = JSON.parse(msg.mensagem);
                                    const msgId = msg.mensagem_id || msg.id.toString();
                                    const isChecked = selectedFiles[msgId]?.selected || false;
                                    const fileDesc = selectedFiles[msgId]?.desc || '';

                                    // Display raw image name from URL or fallback to fileName
                                    const displayName = media.mediaType === 'image' && media.url
                                      ? media.url.split('/').pop()
                                      : (media.fileName || `${media.mediaType.toUpperCase()} de WhatsApp`);

                                    return (
                                      <div key={msgId} className="space-y-1.5 p-2 rounded-lg bg-white border border-slate-100 text-left">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => setSelectedFiles({
                                              ...selectedFiles,
                                              [msgId]: { selected: e.target.checked, desc: fileDesc }
                                            })}
                                            className="rounded text-sp-blue focus:ring-sp-blue w-3.5 h-3.5 cursor-pointer"
                                          />
                                          <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                                            <span className="text-[10px] font-bold text-slate-800 truncate" title={displayName}>
                                              {displayName}
                                            </span>
                                            <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase shrink-0">
                                              {media.mediaType}
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {isChecked && (
                                          <input
                                            type="text"
                                            placeholder="Descrição/Instruções para este arquivo..."
                                            value={fileDesc}
                                            onChange={(e) => setSelectedFiles({
                                              ...selectedFiles,
                                              [msgId]: { selected: true, desc: e.target.value }
                                            })}
                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-[9px] focus:outline-none focus:border-sp-blue text-slate-855"
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          <div className="flex gap-2 pt-3 border-t border-slate-100 justify-end">
                            <button
                              type="button"
                              onClick={() => setIsCreatingOrder(false)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold transition text-[10px]"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingOrder}
                              className="px-4 py-1.5 rounded-xl bg-sp-blue hover:bg-sp-blue-light disabled:opacity-50 text-white font-bold transition text-[10px] shadow-md flex items-center justify-center gap-1.5"
                            >
                              {isSavingOrder ? (
                                <>
                                  <RefreshCw size={10} className="animate-spin" />
                                  <span>Salvando...</span>
                                </>
                              ) : (
                                <span>Salvar Pedido</span>
                              )}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex-1 flex flex-col min-h-0 space-y-4">
                          <button
                            onClick={handleStartOrderCreation}
                            className="w-full py-2 rounded-xl bg-sp-magenta hover:bg-sp-magenta/90 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 transform active:scale-95 shrink-0"
                          >
                            <span>Criar Novo Pedido</span>
                          </button>
 
                          {isLoadingOrders ? (
                            <div className="flex-1 flex items-center justify-center text-[10px] text-slate-400 py-12">
                              <span>Carregando histórico...</span>
                            </div>
                          ) : clientOrders.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-center text-[10px] text-slate-500 italic py-12">
                              Nenhum pedido cadastrado para este cliente.
                            </div>
                          ) : (
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                              {clientOrders.map((order) => (
                                <div key={order.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50 space-y-2 text-left">
                                  <div className="flex justify-between items-center text-[9px] font-bold">
                                    <span className="text-slate-800">PEDIDO #{order.id}</span>
                                    <StatusBadge status={order.status} variant="inline" />
                                  </div>
                                  
                                  {order.itens && order.itens.filter(item => !item.descricao.startsWith('[')).map((item, idx) => (
                                    <p key={idx} className="text-[10px] text-slate-650 leading-normal flex justify-between items-center">
                                      <span>{item.quantidade}x {item.descricao}</span>
                                      <span className="font-semibold text-[9px] text-slate-500">R$ {(item.quantidade * item.valor_unitario).toFixed(2)}</span>
                                    </p>
                                  ))}
                                  {(!order.itens || order.itens.filter(item => !item.descricao.startsWith('[')).length === 0) && (
                                    <p className="text-[10px] text-slate-400 italic">Sem serviços detalhados</p>
                                  )}
 
                                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/50 text-[9px]">
                                    <span className="text-slate-400">{order.forma_pagamento}</span>
                                    <span className="font-bold text-slate-800">Total: R$ {Number(order.total).toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-4 text-slate-400">
                    <AlertCircle size={28} className="text-slate-650" />
                    <p className="text-[10px] leading-relaxed">
                      Este número não está associado a nenhum cliente cadastrado no sistema da copiadora.
                    </p>
                    <button
                      onClick={handleStartRegistration}
                      className="w-full py-2.5 rounded-xl bg-sp-blue hover:bg-sp-blue-light text-white font-bold text-xs transition shadow-md transform active:scale-[0.98]"
                    >
                      Cadastrar Cliente
                    </button>
                  </div>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-[10px] text-slate-500 italic py-12">
                  Selecione um chat para carregar os dados cadastrais.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Client Registration Modal (Unified ModalCadastroCliente) */}
      <ModalCadastroCliente
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setEditingClient(null);
        }}
        onSave={(savedClient) => {
          setClientInfo(savedClient);
          fetchChats();
        }}
        initialData={editingClient}
      />
    </div>
  );
}

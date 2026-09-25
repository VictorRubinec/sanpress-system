import React, { useState, useEffect } from 'react';
import { ShoppingCart, ListCollapse, Users, MessageSquare, BarChart2, Radio, FileText } from 'lucide-react';
import Atendimento from './pages/Atendimento';
import FilaProducao from './pages/FilaProducao';
import Pedidos from './pages/Pedidos';
import Clientes from './pages/Clientes';
import Whatsapp from './pages/Whatsapp';
import Dashboard from './pages/Dashboard';
import GlobalChatWidget from './components/GlobalChatWidget';
import { socket } from './utils/socket';

export default function App() {
  const [activeTab, setActiveTab] = useState('atendimento'); // atendimento, fila, clientes, whatsapp, dashboard
  const [whatsAppStatus, setWhatsAppStatus] = useState({ status: 'close', qr: null });

  useEffect(() => {
    // Listen for live WhatsApp status changes to show in sidebar indicator
    socket.on('whatsapp_status', (status) => {
      setWhatsAppStatus(status);
    });

    return () => {
      socket.off('whatsapp_status');
    };
  }, []);

  const getStatusDot = () => {
    if (whatsAppStatus.status === 'open') return 'bg-emerald-500';
    if (whatsAppStatus.status === 'connecting') return 'bg-amber-500 animate-pulse';
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (whatsAppStatus.status === 'open') return 'whatsApp ativo';
    if (whatsAppStatus.status === 'connecting') return 'conectando...';
    return 'whatsApp offline';
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-sp-dark text-slate-100 font-body">
      
      {/* LEFT SIDEBAR PANEL */}
      <aside className="w-64 bg-sp-blue flex flex-col justify-between shrink-0 text-white">
        
        {/* Top: Branding and Menu */}
        <div className="p-6 space-y-8">
          {/* Corporate Logo Asset */}
          <div className="space-y-1">
            <img src="/logo principal - branca@300x.png" alt="Sanpress Logo" className="h-10 object-contain" />
            <p className="text-[8px] text-blue-200/60 font-bold uppercase tracking-widest pl-0.5">Sistemas de Balcão & Fila</p>
          </div>
 
          {/* Navigation Menu */}
          <nav className="space-y-1.5">
            {[
              { id: 'atendimento', label: 'Atendimento', icon: <ShoppingCart size={16} /> },
              { id: 'fila', label: 'Fila de Produção', icon: <ListCollapse size={16} /> },
              { id: 'pedidos', label: 'Histórico de Pedidos', icon: <FileText size={16} /> },
              { id: 'clientes', label: 'Clientes', icon: <Users size={16} /> },
              { id: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare size={16} /> },
              { id: 'dashboard', label: 'Dashboard', icon: <BarChart2 size={16} /> }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === item.id
                    ? 'bg-sp-magenta text-white shadow-lg shadow-sp-magenta/20'
                    : 'text-blue-100/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
 
         {/* Bottom: Connection State and Brand Slogan */}
        <div className="p-6 border-t border-white/10 space-y-4 bg-black/15">
          
          {/* Live WhatsApp Status indicator */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 border border-white/10">
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-blue-200 shrink-0 animate-pulse" />
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wide">{getStatusText()}</span>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full border border-slate-900 shadow-sm ${getStatusDot()}`} />
          </div>
 
          <div className="text-center">
            <p className="text-[10px] text-sp-yellow font-bold italic tracking-wide">"Sua criatividade começa aqui"</p>
          </div>
        </div>
 
      </aside>
 
      {/* MAIN CONTENT VIEWPORT */}
      <main className="flex-1 min-w-0 bg-sp-offwhite relative light-theme">
        {activeTab === 'atendimento' && <Atendimento />}
        {activeTab === 'fila' && <FilaProducao />}
        {activeTab === 'pedidos' && <Pedidos />}
        {activeTab === 'clientes' && <Clientes />}
        {activeTab === 'whatsapp' && <Whatsapp />}
        {activeTab === 'dashboard' && <Dashboard />}
      </main>

      {/* GLOBAL CHAT FLOATING WIDGET (Condition: Hide on dedicated WhatsApp screen) */}
      {activeTab !== 'whatsapp' && <GlobalChatWidget />}

    </div>
  );
}

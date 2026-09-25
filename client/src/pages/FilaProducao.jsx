import React, { useState, useEffect } from 'react';
import { Play, Check, ChevronRight, FileText, ExternalLink, Printer, User, CreditCard, DollarSign, Clock, MessageSquare, Search, Filter, ArrowUpDown, X } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { socket } from '../utils/socket';
import { playNotificationChime } from '../utils/audio';
import ModalPedido from '../components/ModalPedido';
import { getStatusConfig } from '../components/StatusBadge';

export default function FilaProducao() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCancelOnly, setShowCancelOnly] = useState(false);
  const [fileOpeningId, setFileOpeningId] = useState(null);
  
  // Search, filtering and sorting states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos'); // Todos, Aguardando Pagamento, Na Fila, Em Impressão, Pronto
  const [originFilter, setOriginFilter] = useState('Todos'); // Todos, whatsapp, balcao
  const [sortBy, setSortBy] = useState('urgencia'); // urgencia, id_asc, id_desc

  // Fetch all active orders
  const fetchQueue = async () => {
    try {
      const data = await apiFetch('/pedidos');
      setOrders(data);
    } catch (err) {
      console.error('Erro ao carregar fila:', err);
    }
  };

  useEffect(() => {
    fetchQueue();

    // Listen to real-time order creation
    socket.on('pedido_criado', (newOrder) => {
      playNotificationChime();
      setOrders(prev => [...prev, newOrder]);
    });

    // Listen to real-time status updates
    socket.on('pedido_atualizado', ({ id, status }) => {
      if (status === 'Concluído / Entregue' || status === 'Cancelado') {
        // Remove from active queue board
        setOrders(prev => prev.filter(o => o.id !== id));
        if (selectedOrder && selectedOrder.id === id) {
          setSelectedOrder(null);
        }
      } else {
        // Update in-place
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      }
    });

    return () => {
      socket.off('pedido_criado');
      socket.off('pedido_atualizado');
    };
  }, [selectedOrder]);

  const handleOpenFile = async (e, orderId) => {
    e.stopPropagation(); // Avoid opening card details modal
    setFileOpeningId(orderId);
    try {
      const res = await apiFetch(`/pedidos/${orderId}/abrir-arquivo`, { method: 'POST' });
      alert(res.message);
    } catch (err) {
      alert(`Falha ao abrir arquivo: ${err.message}`);
    } finally {
      setFileOpeningId(null);
    }
  };

  const handleUpdateStatus = async (e, orderId, nextStatus) => {
    e.stopPropagation();
    try {
      await apiFetch(`/pedidos/${orderId}/status`, {
        method: 'PATCH',
        body: { status: nextStatus }
      });
    } catch (err) {
      alert(`Erro ao atualizar status: ${err.message}`);
    }
  };

  const handleStartCancellation = (order, e) => {
    if (e) e.stopPropagation();
    setSelectedOrder(order);
    setShowCancelOnly(true);
  };

  // Helper to resolve progress and next action based on status
  const getStatusStepInfo = (status) => {
    const config = getStatusConfig(status);
    switch (status) {
      case 'Aguardando Pagamento':
        return { percent: 15,  ...config, nextStatus: 'Na Fila / A Imprimir',   nextAction: 'Pedido Pago' };
      case 'Na Fila / A Imprimir':
        return { percent: 50,  ...config, nextStatus: 'Em Impressão',           nextAction: 'Iniciar Impressão' };
      case 'Em Impressão':
        return { percent: 80,  ...config, nextStatus: 'Pronto para Retirada',   nextAction: 'Pronto (Avisar)' };
      case 'Pronto para Retirada':
        return { percent: 100, ...config, nextStatus: 'Concluído / Entregue',   nextAction: 'Pedido Entregue' };
      default:
        return { percent: 0,   ...config, nextStatus: null, nextAction: null };
    }
  };

  // Filter and sort orders
  const getFilteredOrders = () => {
    let result = [...orders];

    // Search query (ID or client name)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.id.toString().includes(q) || 
        o.cliente_nome.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'Todos') {
      result = result.filter(o => o.status === statusFilter);
    }

    // Origin filter
    if (originFilter !== 'Todos') {
      result = result.filter(o => {
        const isWhatsapp = o.itens && o.itens.some(item => item.descricao.toLowerCase().includes('origem: whatsapp'));
        const isBalcao = o.itens && o.itens.some(item => item.descricao.toLowerCase().includes('origem: balcão'));
        if (originFilter === 'whatsapp') return isWhatsapp;
        if (originFilter === 'balcao') return isBalcao || (!isWhatsapp);
        return true;
      });
    }

    // Sorting
    if (sortBy === 'id_asc') {
      result.sort((a, b) => a.id - b.id);
    } else if (sortBy === 'id_desc') {
      result.sort((a, b) => b.id - a.id);
    } else if (sortBy === 'urgencia') {
      // Urgência ordering: "Em Impressão" -> "Na Fila" -> "Aguardando Pagamento" -> "Pronto"
      const statusPriority = {
        'Em Impressão': 1,
        'Na Fila / A Imprimir': 2,
        'Aguardando Pagamento': 3,
        'Pronto para Retirada': 4
      };
      result.sort((a, b) => {
        const priorityA = statusPriority[a.status] || 99;
        const priorityB = statusPriority[b.status] || 99;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        // Within same status, oldest first (cronológica)
        return new Date(a.created_at) - new Date(b.created_at);
      });
    }

    return result;
  };

  const filteredOrders = getFilteredOrders();

  const getClientTypeColor = (type) => {
    if (type === 'Aluno') return 'bg-sp-blue/10 text-sp-blue';
    if (type === 'Professor') return 'bg-sp-magenta/10 text-sp-magenta';
    return 'bg-slate-100 text-slate-650';
  };

  const getOrderOrigin = (order) => {
    const isWhatsapp = order.itens && order.itens.some(item => item.descricao.toLowerCase().includes('origem: whatsapp'));
    return isWhatsapp ? 'whatsapp' : 'balcao';
  };

  return (
    <div className="p-6 space-y-6 font-body h-full flex flex-col min-h-0 text-slate-800 text-left">
      {/* Header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-title">Fila de Produção & Balcão</h1>
        <p className="text-slate-500 text-xs mt-1">Monitore, ordene e processe os trabalhos de impressão da copiadora em tempo real.</p>
      </div>

      {/* Control Bar (Filters, Search and Sort) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 text-xs">
        {/* Left Side: Search and Origin */}
        <div className="flex flex-wrap items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Pesquise por ID ou Cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-xs bg-white text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-450 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
              <Filter size={12} /> Origem:
            </span>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue bg-white text-slate-700"
            >
              <option value="Todos">Todos</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="balcao">Balcão</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-450 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
              <ArrowUpDown size={12} /> Ordenar:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue bg-white text-slate-700"
            >
              <option value="urgencia">Prioridade de Fila</option>
              <option value="id_asc">Mais Antigos (#ID)</option>
              <option value="id_desc">Mais Recentes (#ID)</option>
            </select>
          </div>
        </div>

        {/* Right Side: Quick Status tab-pills */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {['Todos', 'Aguardando Pagamento', 'Na Fila / A Imprimir', 'Em Impressão', 'Pronto para Retirada'].map((status) => {
            const count = status === 'Todos' ? orders.length : orders.filter(o => o.status === status).length;
            const label = status === 'Na Fila / A Imprimir' ? 'Na Fila' : status === 'Pronto para Retirada' ? 'Pronto' : status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all text-[10px] flex items-center gap-1.5 border ${
                  statusFilter === status
                    ? 'bg-sp-blue border-sp-blue text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <span>{label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-black ${
                  statusFilter === status ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Linear Task List table container */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                <th className="p-4 pl-6 w-[80px]">ID</th>
                <th className="p-4 w-[160px]">Cliente / Origem</th>
                <th className="p-4 w-[28%]">Resumo dos Serviços</th>
                <th className="p-4 w-[140px]">Arquivo</th>
                <th className="p-4 w-[16%]">Status & Progresso</th>
                <th className="p-4 w-[120px] text-right pr-8">Total</th>
                <th className="p-4 w-[185px] text-right pr-6">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredOrders.map((order) => {
                const isWhatsapp = getOrderOrigin(order) === 'whatsapp';
                const step = getStatusStepInfo(order.status);
                
                return (
                  <tr 
                    key={order.id} 
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    {/* ID & Date */}
                    <td className="p-4 pl-6">
                      <p className="font-bold text-slate-900 font-title">#{order.id}</p>
                      <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* Client & Origin */}
                    <td className="p-4">
                      <p className="font-bold text-slate-800 truncate" title={order.cliente_nome}>{order.cliente_nome}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase shrink-0 ${getClientTypeColor(order.cliente_tipo)}`}>
                          {order.cliente_tipo}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-0.5 shrink-0 ${
                          isWhatsapp ? 'bg-emerald-50 text-emerald-650' : 'bg-blue-50 text-sp-blue'
                        }`}>
                          {isWhatsapp ? (
                            <>
                              <MessageSquare size={8} />
                              <span>Whats</span>
                            </>
                          ) : (
                            <>
                              <User size={8} />
                              <span>Balcão</span>
                            </>
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Items Description */}
                    <td className="p-4">
                      <p className="text-slate-650 font-medium line-clamp-2" title={order.itens?.[0]?.descricao}>
                        {order.itens?.[0]?.descricao || 'Serviço Gráfico'}
                      </p>
                      {order.itens && order.itens.length > 1 && (
                        <span className="text-[9px] text-sp-blue font-bold block mt-0.5">+ {order.itens.length - 1} arquivo(s) / item(ns)</span>
                      )}
                    </td>

                    {/* File Opener link */}
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      {order.caminho_arquivo ? (
                        <button
                          onClick={(e) => handleOpenFile(e, order.id)}
                          disabled={fileOpeningId === order.id}
                          className="flex items-center gap-1.5 text-[10px] text-sp-blue hover:text-sp-blue-light font-bold max-w-full bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 truncate transition group"
                        >
                          <FileText size={11} className="shrink-0 text-sp-blue" />
                          <span className="truncate" title={order.caminho_arquivo.split('/').pop()}>
                            {order.caminho_arquivo.split('/').pop()}
                          </span>
                          <ExternalLink size={10} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">Sem anexo</span>
                      )}
                    </td>

                    {/* Status & Progress Bar */}
                    <td className="p-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-bold">
                          <span className={`${step.text} uppercase tracking-wider`}>{step.label}</span>
                          <span className="text-slate-500">{step.percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${step.color} transition-all duration-500`} 
                            style={{ width: `${step.percent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Total Price */}
                    <td className="p-4 text-right pr-8">
                      <span className="text-sm font-black text-slate-900 font-title whitespace-nowrap">
                        R$ {order.total.toFixed(2)}
                      </span>
                    </td>

                    {/* Next Action Trigger */}
                    <td className="p-4 pr-6 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {step.nextStatus && step.nextAction ? (
                        <>
                          <button
                            onClick={(e) => handleUpdateStatus(e, order.id, step.nextStatus)}
                            className={`flex-1 py-2.5 px-3 whitespace-nowrap rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all transform active:scale-95 shadow-sm text-white ${{
                              'Aguardando Pagamento': 'bg-amber-500 hover:bg-amber-600',
                              'Na Fila / A Imprimir': 'bg-sp-blue hover:bg-sp-blue-light',
                              'Em Impressão':         'bg-sp-magenta hover:brightness-110',
                              'Pronto para Retirada': 'bg-emerald-600 hover:bg-emerald-500',
                            }[order.status] ?? 'bg-slate-500 hover:bg-slate-600'}`}
                          >
                            <span>{step.nextAction}</span>
                            <ChevronRight size={10} />
                          </button>
                          
                          <button
                            onClick={(e) => handleStartCancellation(order, e)}
                            title="Cancelar Pedido"
                            className="p-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center justify-center shrink-0 text-white"
                          >
                            <X size={10} />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Concluído</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-slate-400 italic">
                    Nenhum pedido ativo na fila de produção correspondente aos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ORDER DETAILS MODAL (Unified ModalPedido) */}
      {selectedOrder && (
        <ModalPedido
          order={selectedOrder}
          onClose={() => {
            setSelectedOrder(null);
            setShowCancelOnly(false);
          }}
          onRefresh={fetchQueue}
          mode="production"
          initialCancel={showCancelOnly}
        />
      )}
    </div>
  );
}

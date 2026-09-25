import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Phone, Mail, FileText, User, ShoppingBag, FolderOpen, ExternalLink, Calendar, Plus, X, Edit, Eye } from 'lucide-react';
import { apiFetch } from '../utils/api';
import ModalCadastroCliente from '../components/ModalCadastroCliente';
import StatusBadge from '../components/StatusBadge';

export default function Clientes() {
  const [clients, setClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null); // client ID
  const [profileData, setProfileData] = useState(null); // client + history
  const [profileTab, setProfileTab] = useState('orders'); // orders, files
  
  // Client form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const fetchClients = async () => {
    try {
      const data = await apiFetch(`/clientes${searchQuery ? `?search=${searchQuery}` : ''}`);
      setClients(data);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [searchQuery]);

  const handleOpenProfile = async (client) => {
    setSelectedProfile(client.id);
    setProfileData(null);
    setProfileTab('orders');
    try {
      const data = await apiFetch(`/clientes/${client.id}/historico`);
      setProfileData(data);
    } catch (err) {
      alert(`Erro ao carregar histórico: ${err.message}`);
    }
  };

  const handleStartEditing = (client, e) => {
    e.stopPropagation(); // Avoid triggering profile history modal
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleOpenFile = async (orderId) => {
    try {
      const res = await apiFetch(`/pedidos/${orderId}/abrir-arquivo`, { method: 'POST' });
      alert(res.message);
    } catch (err) {
      alert(`Falha ao abrir arquivo: ${err.message}`);
    }
  };

  // Extract distinct files from client orders history
  const getProcessedFiles = () => {
    if (!profileData || !profileData.pedidos) return [];
    const files = [];
    profileData.pedidos.forEach(order => {
      if (order.caminho_arquivo) {
        files.push({
          orderId: order.id,
          path: order.caminho_arquivo,
          date: order.created_at
        });
      }
    });
    return files;
  };

  return (
    <div className="p-6 space-y-6 font-body text-slate-800 text-left">
      {/* Header */}
      <div className="flex justify-between items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-title">Banco de Clientes</h1>
          <p className="text-slate-500 text-xs mt-1">Gerencie cadastros, verifique perfis de consumo e rastreie arquivos enviados.</p>
        </div>
        <button
          onClick={() => {
            setEditingClient(null);
            setIsFormOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-sp-blue hover:bg-sp-blue-light text-white text-xs font-bold flex items-center gap-1.5 transition-all transform active:scale-95 shadow-md"
        >
          <UserPlus size={16} />
          <span>Cadastrar Cliente</span>
        </button>
      </div>

      {/* Search Input bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
        <input
          type="text"
          placeholder="Busque por Nome, E-mail, WhatsApp ou RA..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-sp-blue text-xs text-slate-800 bg-white"
        />
      </div>

      {/* Clean Table list View */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4 pl-6">Nome / Tipo</th>
                <th className="p-4">WhatsApp</th>
                <th className="p-4">RA Acadêmico</th>
                <th className="p-4">Curso / Setor</th>
                <th className="p-4">E-mail</th>
                <th className="p-4 text-center pr-6 animate-none">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 pl-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-sp-blue/15 text-sp-blue flex items-center justify-center font-bold text-xs shrink-0">
                      {client.nome[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{client.nome}</p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase mt-0.5 ${
                        client.tipo === 'Aluno' ? 'bg-sp-blue/10 text-sp-blue' :
                        client.tipo === 'Professor' ? 'bg-sp-magenta/10 text-sp-magenta' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {client.tipo}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 font-semibold text-slate-650">+{client.whatsapp}</td>
                  <td className="p-4 text-slate-600 font-medium">{client.ra || '-'}</td>
                  <td className="p-4 text-slate-600 truncate max-w-[150px]">{client.curso_matricula || '-'}</td>
                  <td className="p-4 text-slate-500 truncate max-w-[180px]">{client.email || '-'}</td>
                  <td className="p-4 text-center pr-6 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleOpenProfile(client)}
                      title="Visualizar Histórico"
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-sp-blue hover:bg-slate-105 transition"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => handleStartEditing(client, e)}
                      title="Editar Perfil"
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-sp-magenta hover:bg-slate-105 transition"
                    >
                      <Edit size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-400 italic">
                    Nenhum cliente cadastrado correspondente à busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CLIENT HISTORICAL PROFILE MODAL (Theme Light Optimized) */}
      {selectedProfile && (
        <div className="fixed z-50 !m-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ inset: '-10px' }}>
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-800">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
              {profileData ? (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-sp-blue/15 text-sp-blue border border-sp-blue/10 flex items-center justify-center font-bold text-lg">
                    {profileData.cliente.nome[0].toUpperCase()}
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-bold text-slate-900 font-title">{profileData.cliente.nome}</h3>
                    <p className="text-[10px] text-slate-500 mt-1 flex gap-3 font-semibold">
                      <span className="uppercase text-sp-blue">{profileData.cliente.tipo}</span>
                      {profileData.cliente.ra && <span>RA: {profileData.cliente.ra}</span>}
                      <span>WhatsApp: +{profileData.cliente.whatsapp}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-40 bg-slate-200 rounded" />
                    <div className="h-3 w-28 bg-slate-200 rounded" />
                  </div>
                </div>
              )}
              <button
                onClick={() => setSelectedProfile(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 px-4">
              <button
                onClick={() => setProfileTab('orders')}
                className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
                  profileTab === 'orders'
                    ? 'border-sp-blue text-sp-blue font-black'
                    : 'border-transparent text-slate-450 hover:text-slate-650'
                }`}
              >
                <ShoppingBag size={14} />
                <span>Histórico de Pedidos ({profileData?.pedidos?.length || 0})</span>
              </button>
              
              <button
                onClick={() => setProfileTab('files')}
                className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
                  profileTab === 'files'
                    ? 'border-sp-blue text-sp-blue font-black'
                    : 'border-transparent text-slate-450 hover:text-slate-650'
                }`}
              >
                <FolderOpen size={14} />
                <span>Arquivos Processados ({getProcessedFiles().length})</span>
              </button>
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-white">
              {!profileData ? (
                <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                  Carregando dados históricos do cliente...
                </div>
              ) : (
                <>
                  {/* ORDERS HISTORY TAB */}
                  {profileTab === 'orders' && (
                    <div className="space-y-4">
                      {profileData.pedidos.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400 italic">
                          Nenhum pedido realizado até o momento.
                        </div>
                      ) : (
                        profileData.pedidos.map((order) => (
                          <div
                            key={order.id}
                            className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3 shadow-sm text-left"
                          >
                            <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                              <span className="font-bold text-slate-800">Pedido #{order.id}</span>
                              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                                <Calendar size={12} className="text-slate-400" />
                                {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            
                            {/* Items details */}
                            <div className="space-y-1">
                              {order.itens && order.itens.filter(item => !item.descricao.startsWith('[')).map((item, idx) => (
                                <div key={idx} className="flex justify-between text-[11px] text-slate-600 font-medium">
                                  <span>{item.quantidade}x {item.descricao}</span>
                                  <span className="font-bold text-slate-700">R$ {(item.quantidade * item.valor_unitario).toFixed(2)}</span>
                                </div>
                              ))}
                              {(!order.itens || order.itens.filter(item => !item.descricao.startsWith('[')).length === 0) && (
                                <span className="text-[10px] text-slate-400 italic block mt-0.5">Sem serviços detalhados</span>
                              )}
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                              <div className="flex items-center gap-3">
                                <StatusBadge status={order.status} variant="inline" />
                                <span className="text-[10px] text-slate-500">
                                  {order.forma_pagamento ? `Pago via ${order.forma_pagamento}` : 'Pendente de Pagamento'}
                                </span>
                              </div>
                              <span className="font-black text-sp-blue">Total: R$ {order.total.toFixed(2)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* FILES PROCESSED TAB */}
                  {profileTab === 'files' && (
                    <div className="space-y-3">
                      {getProcessedFiles().length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400 italic">
                          Nenhum arquivo processado para este cliente.
                        </div>
                      ) : (
                        getProcessedFiles().map((file, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs gap-3 text-left animate-in slide-in-from-bottom-2 duration-150"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText size={16} className="text-sp-blue shrink-0" />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 truncate">{file.path.split('/').pop()}</p>
                                <p className="text-[9px] text-slate-400 truncate mt-0.5">{file.path}</p>
                              </div>
                            </div>
                            
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => handleOpenFile(file.orderId)}
                                className="px-2.5 py-1.5 rounded-lg bg-sp-blue hover:bg-sp-blue-light text-white font-bold text-[9px] flex items-center gap-1 transition-all shadow-sm"
                              >
                                <ExternalLink size={10} />
                                <span>Abrir no PC</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW/EDIT CLIENT FORM MODAL (Unified ModalCadastroCliente) */}
      <ModalCadastroCliente
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingClient(null);
        }}
        onSave={() => fetchClients()}
        initialData={editingClient}
      />
    </div>
  );
}

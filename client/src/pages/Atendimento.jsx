import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, ShoppingCart, FileText, CreditCard, DollarSign, QrCode, ArrowRight, UserPlus, CheckCircle, RefreshCw } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function Atendimento() {
  // Client search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Registration modal states
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    nome: '',
    whatsapp: '',
    email: '',
    tipo: 'Aluno',
    ra: '',
    curso_matricula: ''
  });

  // Cart states
  const [cart, setCart] = useState([]);
  const [itemInput, setItemInput] = useState({
    descricao: '',
    quantidade: 1,
    valor_unitario: ''
  });
  const [caminhoArquivo, setCaminhoArquivo] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('Pix');

  // Checkout overlay states
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState('idle'); // idle, processing_stone, success, error
  const [checkoutMessage, setCheckoutMessage] = useState('');

  const searchInputRef = useRef(null);
  const itemDescRef = useRef(null);

  // Search clients when query changes
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const delayDebounce = setTimeout(async () => {
        try {
          const clients = await apiFetch(`/clientes?search=${searchQuery}`);
          setSearchResults(clients);
        } catch (err) {
          console.error(err);
        }
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Keyboard shortcut to focus client search on load
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setSearchQuery('');
    setSearchResults([]);
    itemDescRef.current?.focus(); // Auto focus cart input
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      const client = await apiFetch('/clientes', {
        method: 'POST',
        body: newClient
      });
      setSelectedClient(client);
      setIsRegisterOpen(false);
      setNewClient({
        nome: '',
        whatsapp: '',
        email: '',
        tipo: 'Aluno',
        ra: '',
        curso_matricula: ''
      });
      itemDescRef.current?.focus();
    } catch (err) {
      alert(`Falha ao cadastrar cliente: ${err.message}`);
    }
  };

  const handleAddToCart = (e) => {
    e?.preventDefault();
    if (!itemInput.descricao.trim() || !itemInput.quantidade || !itemInput.valor_unitario) return;

    const newItem = {
      id: Date.now(),
      descricao: itemInput.descricao.trim(),
      quantidade: Number(itemInput.quantidade),
      valor_unitario: Number(itemInput.valor_unitario)
    };

    setCart([...cart, newItem]);
    setItemInput({
      descricao: '',
      quantidade: 1,
      valor_unitario: ''
    });
    itemDescRef.current?.focus();
  };

  const handleRemoveFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const getCartTotal = () => {
    return cart.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0);
  };

  const handleCheckout = async (payOnArrival = false) => {
    if (!selectedClient) {
      alert('Selecione um cliente antes de finalizar.');
      return;
    }
    if (cart.length === 0) {
      alert('Adicione pelo menos um item ao carrinho.');
      return;
    }

    const total = getCartTotal();
    const finalFormaPagamento = payOnArrival ? null : formaPagamento;
    const initialStatus = payOnArrival ? 'Aguardando Pagamento' : 'Na Fila / A Imprimir';

    setIsProcessingCheckout(true);
    setCheckoutMessage('');

    if (!payOnArrival && (formaPagamento === 'Cartão Crédito' || formaPagamento === 'Cartão Débito')) {
      setCheckoutStep('processing_stone');
      setCheckoutMessage('Aguardando inserção/aproximação do cartão na maquininha Stone...');
    } else {
      setCheckoutStep('saving');
      setCheckoutMessage('Salvando pedido no banco de dados...');
    }

    try {
      const order = await apiFetch('/pedidos', {
        method: 'POST',
        body: {
          cliente_id: selectedClient.id,
          forma_pagamento: finalFormaPagamento,
          total,
          caminho_arquivo: caminhoArquivo,
          status_inicial: initialStatus,
          itens: cart
        }
      });

      setCheckoutStep('success');
      setCheckoutMessage(payOnArrival ? 'Pedido enviado para a Fila (Aguardando Pagamento).' : 'Venda processada com sucesso!');
      
      // Reset state after 2 seconds
      setTimeout(() => {
        setIsProcessingCheckout(false);
        setCheckoutStep('idle');
        setCart([]);
        setSelectedClient(null);
        setCaminhoArquivo('');
        searchInputRef.current?.focus();
      }, 2000);

    } catch (err) {
      setCheckoutStep('error');
      setCheckoutMessage(err.message || 'Falha ao processar checkout.');
    }
  };

  return (
    <div className="p-6 space-y-6 font-body">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atendimento & Recepção</h1>
          <p className="text-slate-400 text-xs mt-1">Crie novos pedidos e faça checkouts integrados em tempo real.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Client Search & Setup */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Client Selector Panel */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">1. Seleção do Cliente</h2>
            
            {!selectedClient ? (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
                    <input
                      type="text"
                      ref={searchInputRef}
                      placeholder="Pesquise por Nome, WhatsApp ou RA..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs"
                    />
                  </div>
                  <button
                    onClick={() => setIsRegisterOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-sp-blue hover:bg-sp-blue-light text-white text-xs font-bold flex items-center gap-1.5 transition-all transform active:scale-95"
                  >
                    <UserPlus size={16} />
                    <span>Novo</span>
                  </button>
                </div>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-20 max-h-60 overflow-y-auto">
                    {searchResults.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => handleSelectClient(client)}
                        className="p-3 hover:bg-white/5 cursor-pointer flex justify-between items-center transition-colors border-b border-white/5 last:border-b-0"
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{client.nome}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {client.tipo} {client.ra ? `• RA: ${client.ra}` : ''} • ({client.whatsapp.slice(2)})
                          </p>
                        </div>
                        <ArrowRight size={14} className="text-sp-cyan" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-850 border border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sp-blue/20 text-sp-cyan flex items-center justify-center font-bold text-sm">
                    {selectedClient.nome[0]}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">{selectedClient.nome}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {selectedClient.tipo} {selectedClient.ra ? `• RA: ${selectedClient.ra}` : ''} • WhatsApp: +{selectedClient.whatsapp}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="text-xs text-red-400 hover:text-red-300 font-bold hover:underline"
                >
                  Alterar
                </button>
              </div>
            )}
          </div>

          {/* Cart Items Table Panel */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">2. Detalhamento do Carrinho</h2>
            
            {/* Input Form for Cart Items */}
            <form onSubmit={handleAddToCart} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div className="md:col-span-3">
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5">Descrição do Item</label>
                <input
                  type="text"
                  ref={itemDescRef}
                  placeholder="Ex: Impressão A4 Mono Sulfite"
                  value={itemInput.descricao}
                  onChange={(e) => setItemInput({ ...itemInput, descricao: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl glass-input text-xs"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5">Qtd</label>
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={itemInput.quantidade}
                  onChange={(e) => setItemInput({ ...itemInput, quantidade: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs text-center"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5">Preço Unit. (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={itemInput.valor_unitario}
                  onChange={(e) => setItemInput({ ...itemInput, valor_unitario: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs text-center"
                />
              </div>
              <div className="md:col-span-1">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-sp-magenta hover:brightness-110 text-white text-xs font-bold flex items-center justify-center gap-1 transition-all transform active:scale-95"
                >
                  <Plus size={16} />
                  <span>Add</span>
                </button>
              </div>
            </form>

            {/* List of Cart Items */}
            <div className="border border-white/5 rounded-xl overflow-hidden mt-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 font-bold uppercase text-[9px] tracking-wider border-b border-white/5">
                    <th className="p-3">Descrição</th>
                    <th className="p-3 text-center">Quantidade</th>
                    <th className="p-3 text-right">Valor Unitário</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 italic">
                        O carrinho está vazio. Adicione itens acima.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item) => (
                      <tr key={item.id} className="hover:bg-white/2">
                        <td className="p-3 font-semibold text-white">{item.descricao}</td>
                        <td className="p-3 text-center font-bold">{item.quantidade}</td>
                        <td className="p-3 text-right text-slate-300">R$ {item.valor_unitario.toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-sp-cyan">R$ {(item.quantidade * item.valor_unitario).toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Checkout Details */}
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-5 space-y-6 flex flex-col justify-between h-full min-h-[400px]">
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">3. Checkout & Vínculo</h2>

              {/* Shared File Attachment */}
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Caminho do Arquivo (Rede Compartilhada)</label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3 text-slate-500" size={16} />
                  <input
                    type="text"
                    placeholder="Ex: C:/Compartilhado/trabalho.pdf"
                    value={caminhoArquivo}
                    onChange={(e) => setCaminhoArquivo(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
                <span className="text-[9px] text-slate-500 leading-normal block">Vincule o arquivo salvo no HD compartilhado da rede para que a fila de impressão consiga abri-lo instantaneamente.</span>
              </div>

              {/* Payment Methods Selection */}
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-3">Método de Pagamento</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Pix', icon: <QrCode size={16} />, label: 'Pix' },
                    { id: 'Dinheiro', icon: <DollarSign size={16} />, label: 'Dinheiro' },
                    { id: 'Cartão Crédito', icon: <CreditCard size={16} />, label: 'Crédito' },
                    { id: 'Cartão Débito', icon: <CreditCard size={16} />, label: 'Débito' }
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setFormaPagamento(method.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        formaPagamento === method.id
                          ? 'border-sp-cyan bg-sp-cyan/15 text-white shadow-md'
                          : 'border-white/5 bg-slate-900/60 text-slate-400 hover:border-white/10 hover:text-slate-200'
                      }`}
                    >
                      {method.icon}
                      <span>{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Price Calculations Summary & Submission */}
            <div className="space-y-4 border-t border-white/5 pt-6 mt-6">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-400 font-bold uppercase">Valor Total</span>
                <span className="text-2xl font-black font-title text-sp-cyan">R$ {getCartTotal().toFixed(2)}</span>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleCheckout(false)}
                  disabled={cart.length === 0 || !selectedClient}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all transform active:scale-95 shadow-lg"
                >
                  <ShoppingCart size={16} />
                  <span>Confirmar & Receber</span>
                </button>

                <button
                  onClick={() => handleCheckout(true)}
                  disabled={cart.length === 0 || !selectedClient}
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-white/5 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all transform active:scale-95"
                >
                  <span>Mandar Pagar no Balcão</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK NEW CLIENT REGISTER MODAL */}
      {isRegisterOpen && (
        <div className="fixed z-50 !m-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ inset: '-10px' }}>
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white font-title">Cadastro Rápido de Cliente</h3>
                <p className="text-[10px] text-slate-400 mt-1">Preencha os dados do cliente para adicioná-lo ao banco de dados local.</p>
              </div>
              <button 
                onClick={() => setIsRegisterOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={newClient.nome}
                    onChange={(e) => setNewClient({ ...newClient, nome: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">WhatsApp (DDD + N°)</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: 11999998888"
                    value={newClient.whatsapp}
                    onChange={(e) => setNewClient({ ...newClient, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Tipo de Cliente</label>
                  <select
                    value={newClient.tipo}
                    onChange={(e) => setNewClient({ ...newClient, tipo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-slate-100 text-xs"
                  >
                    <option value="Aluno">Aluno</option>
                    <option value="Professor">Professor</option>
                    <option value="Externo">Externo</option>
                  </select>
                </div>

                {newClient.tipo === 'Aluno' && (
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Registro Acadêmico (RA)</label>
                    <input
                      type="text"
                      required={newClient.tipo === 'Aluno'}
                      value={newClient.ra}
                      onChange={(e) => setNewClient({ ...newClient, ra: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>
                )}

                <div className={newClient.tipo === 'Aluno' ? 'col-span-1' : 'col-span-2'}>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                    {newClient.tipo === 'Aluno' ? 'Curso / Faculdade' : newClient.tipo === 'Professor' ? 'Departamento' : 'Empresa / Observação'}
                  </label>
                  <input
                    type="text"
                    value={newClient.curso_matricula}
                    onChange={(e) => setNewClient({ ...newClient, curso_matricula: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">E-mail (Opcional)</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 rounded-xl hover:bg-white/5 border border-white/5 text-slate-400 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sp-blue hover:bg-sp-blue-light text-white text-xs font-bold"
                >
                  Cadastrar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHECKOUT PROGRESS OVERLAY */}
      {isProcessingCheckout && (
        <div className="fixed z-50 !m-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" style={{ inset: '-10px' }}>
          <div className="w-full max-w-sm glass-panel border border-white/10 rounded-2xl p-6 text-center space-y-6">
            {checkoutStep === 'processing_stone' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <RefreshCw className="animate-spin text-sp-cyan shrink-0" size={48} />
                </div>
                <h3 className="font-title font-bold text-white">Processando Cartão...</h3>
                <p className="text-xs text-slate-400 leading-normal">{checkoutMessage}</p>
                <div className="text-[10px] text-slate-500 italic mt-2">Valor da Transação: R$ {getCartTotal().toFixed(2)}</div>
              </div>
            )}

            {checkoutStep === 'saving' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <RefreshCw className="animate-spin text-sp-magenta shrink-0" size={48} />
                </div>
                <h3 className="font-title font-bold text-white">Criando Pedido...</h3>
                <p className="text-xs text-slate-400">{checkoutMessage}</p>
              </div>
            )}

            {checkoutStep === 'success' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="text-emerald-500 shrink-0" size={48} />
                </div>
                <h3 className="font-title font-bold text-white">Aprovado!</h3>
                <p className="text-xs text-emerald-400">{checkoutMessage}</p>
              </div>
            )}

            {checkoutStep === 'error' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-xl">X</div>
                </div>
                <h3 className="font-title font-bold text-red-400">Falha no Pagamento</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{checkoutMessage}</p>
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setIsProcessingCheckout(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white"
                  >
                    Tentar Novamente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


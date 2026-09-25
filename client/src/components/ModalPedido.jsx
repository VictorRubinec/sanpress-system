import React, { useState, useEffect } from 'react';
import { FileText, ExternalLink, CreditCard, DollarSign, Clock, Play, Check, X, Edit, Plus, Trash2, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function ModalPedido({ order, onClose, onRefresh, mode = 'production', initialCancel = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [itemsList, setItemsList] = useState([]);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [isFileOpening, setIsFileOpening] = useState(false);

  // Cancellation sub-flow states
  const [showCancelForm, setShowCancelForm] = useState(initialCancel);
  const [isSavingCancellation, setIsSavingCancellation] = useState(false);
  const [cancelForm, setCancelForm] = useState({
    motivo: '',
    produzido: 'Não',
    pago: 'Não',
    devolvido: 'Não aplicável'
  });

  // Load and filter user-facing order items
  useEffect(() => {
    if (order && order.itens) {
      // Show only non-metadata items (descriptions not starting with '[')
      const userItems = order.itens.filter(item => !item.descricao.startsWith('['));
      setItemsList(userItems.map(item => ({
        id: item.id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario
      })));
    }
  }, [order]);

  if (!order) return null;

  const handleOpenFile = async () => {
    setIsFileOpening(true);
    try {
      const res = await apiFetch(`/pedidos/${order.id}/abrir-arquivo`, { method: 'POST' });
      alert(res.message);
    } catch (err) {
      alert(`Falha ao abrir arquivo: ${err.message}`);
    } finally {
      setIsFileOpening(false);
    }
  };

  const handleUpdateStatus = async (nextStatus) => {
    try {
      await apiFetch(`/pedidos/${order.id}/status`, {
        method: 'PATCH',
        body: { status: nextStatus }
      });
      onRefresh();
      onClose();
    } catch (err) {
      alert(`Erro ao atualizar status: ${err.message}`);
    }
  };

  // Items Editing handlers
  const handleAddItemRow = () => {
    setItemsList(prev => [
      ...prev,
      { id: `new-${Date.now()}`, descricao: '', quantidade: 1, valor_unitario: 0.00 }
    ]);
  };

  const handleRemoveItemRow = (index) => {
    setItemsList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItemsList(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSaveItems = async () => {
    // Basic validation
    const hasInvalidItem = itemsList.some(item => !item.descricao.trim());
    if (hasInvalidItem) {
      alert('Por favor, preencha a descrição de todos os itens.');
      return;
    }

    setIsSavingItems(true);
    try {
      await apiFetch(`/pedidos/${order.id}/itens`, {
        method: 'PUT',
        body: { items: itemsList }
      });
      setIsEditing(false);
      onRefresh();
      // Keep modal open but let parent reload order details
      alert('Itens do pedido salvos com sucesso!');
    } catch (err) {
      alert(`Falha ao salvar itens: ${err.message}`);
    } finally {
      setIsSavingItems(false);
    }
  };

  // Calculate live total price for items list
  const calculateLiveTotal = () => {
    return itemsList.reduce((sum, item) => sum + (Number(item.quantidade) * Number(item.valor_unitario)), 0);
  };

  // Cancellation Questionnaire Flow handlers
  const handleStartCancellation = () => {
    setCancelForm({
      motivo: '',
      produzido: 'Não',
      pago: order.status !== 'Aguardando Pagamento' ? 'Sim' : 'Não',
      devolvido: order.status !== 'Aguardando Pagamento' ? 'Não' : 'Não aplicável'
    });
    setShowCancelForm(true);
  };

  const handleSaveCancellation = async (e) => {
    e.preventDefault();
    if (isSavingCancellation) return;
    setIsSavingCancellation(true);
    try {
      await apiFetch(`/pedidos/${order.id}/status`, {
        method: 'PATCH',
        body: {
          status: 'Cancelado',
          cancelDetails: {
            motivo: cancelForm.motivo,
            produzido: cancelForm.produzido,
            pago: cancelForm.pago,
            devolvido: cancelForm.devolvido
          }
        }
      });
      setShowCancelForm(false);
      onRefresh();
      onClose();
    } catch (err) {
      alert(`Erro ao cancelar pedido: ${err.message}`);
    } finally {
      setIsSavingCancellation(false);
    }
  };

  const getClientTypeColor = (type) => {
    if (type === 'Aluno') return 'bg-sp-blue/10 text-sp-blue';
    if (type === 'Professor') return 'bg-sp-magenta/10 text-sp-magenta';
    return 'bg-slate-100 text-slate-650';
  };

  return (
    <div className="fixed z-50 !m-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ inset: '-10px' }}>
      
      {/* 1. MAIN ORDER DETAILS MODAL */}
      {!showCancelForm ? (
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-800 text-left">
          
          {/* Modal Header - Fixed */}
          <div className="flex justify-between items-start p-6 pb-3 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="text-xs font-black text-slate-500 font-title uppercase tracking-widest">Detalhes do Pedido #{order.id}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Criado em: {new Date(order.created_at).toLocaleString()}</p>
            </div>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-650 p-1.5 rounded-lg hover:bg-slate-100 transition-colors font-bold text-xs"
            >
              ✕
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            
            {/* Client Summary card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sp-blue/15 text-sp-blue border border-sp-blue/10 flex items-center justify-center font-bold text-sm">
                {order.cliente_nome[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate">{order.cliente_nome}</h4>
                <p className="text-[9px] text-slate-500 mt-0.5 font-semibold flex gap-2">
                  <span className="uppercase text-sp-blue">{order.cliente_tipo}</span>
                  {order.cliente_ra && <span>• RA: {order.cliente_ra}</span>}
                  <span>• Tel: +{order.cliente_whatsapp}</span>
                </p>
              </div>
            </div>

            {/* Dynamic Items List & Editor */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-[9px] text-slate-550 font-black uppercase tracking-wider">Itens do Pedido</h4>
                
                {order.status !== 'Cancelado' && order.status !== 'Concluído / Entregue' && (
                  <button
                    onClick={() => {
                      if (isEditing) {
                        // Undo edits
                        setIsEditing(false);
                        const userItems = order.itens.filter(item => !item.descricao.startsWith('['));
                        setItemsList(userItems);
                      } else {
                        setIsEditing(true);
                      }
                    }}
                    className="px-2.5 py-1 text-[9px] font-bold text-sp-blue bg-blue-50 border border-blue-150 rounded-lg hover:bg-blue-100 transition flex items-center gap-1"
                  >
                    <Edit size={10} />
                    <span>{isEditing ? 'Cancelar Edição' : 'Editar Itens'}</span>
                  </button>
                )}
              </div>

              {isEditing ? (
                /* EDITING STATE LIST */
                <div className="space-y-2">
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50 overflow-hidden">
                    {itemsList.map((item, idx) => (
                      <div key={item.id} className="p-3 space-y-2 text-xs">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Descrição do serviço (ex: Encadernação A4)"
                            value={item.descricao}
                            onChange={(e) => handleItemChange(idx, 'descricao', e.target.value)}
                            className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:border-sp-blue"
                          />
                          <button
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition shrink-0"
                            title="Remover Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Qtd:</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) => handleItemChange(idx, 'quantidade', parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 text-center focus:outline-none focus:border-sp-blue"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Unitário: R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.valor_unitario}
                              onChange={(e) => handleItemChange(idx, 'valor_unitario', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:border-sp-blue"
                            />
                          </div>
                          <div className="flex-1 text-right self-center font-bold text-sp-blue text-[11px]">
                            R$ {(item.quantidade * item.valor_unitario).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}

                    {itemsList.length === 0 && (
                      <div className="p-4 text-center text-slate-400 italic text-[11px] bg-white">
                        Nenhum item adicionado. Clique no botão "+" abaixo para inserir.
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddItemRow}
                      className="flex-1 py-2 border border-dashed border-slate-300 rounded-xl hover:border-sp-blue text-slate-500 hover:text-sp-blue font-bold flex items-center justify-center gap-1.5 transition text-[11px]"
                    >
                      <Plus size={12} />
                      <span>Adicionar Serviço</span>
                    </button>

                    {itemsList.length > 0 && (
                      <button
                        onClick={handleSaveItems}
                        disabled={isSavingItems}
                        className="px-4 py-2 bg-sp-blue hover:bg-sp-blue-light disabled:opacity-50 text-white font-bold rounded-xl text-[11px] flex items-center gap-1 transition shadow-md"
                      >
                        {isSavingItems ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Save size={12} />
                        )}
                        <span>Salvar</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* READONLY STATE LIST */
                <div className="border border-slate-150 rounded-xl divide-y divide-slate-100 bg-slate-50 overflow-hidden">
                  {itemsList.map((item, idx) => (
                    <div key={idx} className="p-3 flex justify-between items-center text-xs">
                      <div className="pr-4">
                        <p className="font-semibold text-slate-800">{item.descricao}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{item.quantidade}x R$ {item.valor_unitario.toFixed(2)}</p>
                      </div>
                      <span className="font-bold text-sp-blue shrink-0">R$ {(item.quantidade * item.valor_unitario).toFixed(2)}</span>
                    </div>
                  ))}

                  {itemsList.length === 0 && (
                    <div className="p-4 text-center text-slate-400 italic text-[11px] bg-white">
                      Nenhum item de serviço cadastrado. Clique em "Editar Itens" para adicionar.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Attachment details */}
            {order.caminho_arquivo && (
              <div className="space-y-2">
                <h4 className="text-[9px] text-slate-550 font-black uppercase tracking-wider">Arquivo Vinculado</h4>
                <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText size={16} className="text-sp-blue shrink-0" />
                    <span className="text-[10px] truncate text-slate-700 font-bold">{order.caminho_arquivo.split('/').pop()}</span>
                  </div>
                  <button
                    onClick={handleOpenFile}
                    disabled={isFileOpening}
                    className="px-3 py-1.5 rounded-lg bg-sp-blue hover:bg-sp-blue-light disabled:opacity-50 text-white font-bold text-[9px] flex items-center gap-1 transition-all shadow-sm text-white shrink-0"
                  >
                    <ExternalLink size={12} />
                    <span>Abrir PC</span>
                  </button>
                </div>
              </div>
            )}

            {/* Render cancellation log inside history if details exist */}
            {order.itens && order.itens.some(item => item.descricao.startsWith('[CANCELAMENTO]')) && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <h4 className="text-[9px] text-red-500 font-black uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle size={10} /> Histórico de Cancelamento
                </h4>
                <div className="p-3 rounded-xl bg-red-50/50 border border-red-150 text-[10px] text-red-800 space-y-1 font-medium">
                  {order.itens.filter(item => item.descricao.startsWith('[CANCELAMENTO]')).map((item, idx) => (
                    <p key={idx}>{item.descricao.replace('[CANCELAMENTO]', '')}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Status Management: Depending on MODE prop */}
            {mode === 'history' ? (
              /* HISTORY MODE OVERWRITE CONTROLS */
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <h4 className="text-[9px] text-slate-550 font-black uppercase tracking-wider">Gerenciamento de Status</h4>
                <div className="flex items-center gap-3">
                  <select
                    value={order.status}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs bg-white flex-1"
                  >
                    <option value="Aguardando Pagamento">Aguardando Pagamento</option>
                    <option value="Na Fila / A Imprimir">Na Fila / A Imprimir</option>
                    <option value="Em Impressão">Em Impressão</option>
                    <option value="Pronto para Retirada">Pronto para Retirada</option>
                    <option value="Concluído / Entregue">Concluído / Entregue</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                  
                  {order.status !== 'Cancelado' && order.status !== 'Concluído / Entregue' && (
                    <button
                      onClick={handleStartCancellation}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition shadow-sm text-white shrink-0"
                    >
                      <X size={14} />
                      <span>Cancelar</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {/* Payment Summary */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-black uppercase">Forma de Pagamento</span>
                <div className="flex items-center gap-1 text-slate-800 font-bold">
                  {order.forma_pagamento ? (
                    <>
                      {order.forma_pagamento === 'Pix' && <Clock size={13} className="text-sp-blue" />}
                      {(order.forma_pagamento === 'Cartão Crédito' || order.forma_pagamento === 'Cartão Débito') && <CreditCard size={13} className="text-sp-magenta" />}
                      {order.forma_pagamento === 'Dinheiro' && <DollarSign size={13} className="text-emerald-600" />}
                      <span>{order.forma_pagamento}</span>
                    </>
                  ) : (
                    <span className="text-red-500 font-bold italic">Pagar ao Retirar</span>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-right">
                <span className="text-[9px] text-slate-500 font-black uppercase block">Valor Total</span>
                <span className="text-lg font-black text-sp-blue font-title">
                  R$ {(isEditing ? calculateLiveTotal() : order.total).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Actions Footer - Fixed */}
          <div className="flex gap-2 border-t border-slate-100 p-6 pt-3 justify-between shrink-0">
            
            {/* Left action (Cancel) - ONLY IN PRODUCTION MODE */}
            {mode === 'production' && order.status !== 'Cancelado' && order.status !== 'Concluído / Entregue' ? (
              <button
                onClick={handleStartCancellation}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm text-white"
              >
                <X size={14} />
                <span>Cancelar Pedido</span>
              </button>
            ) : <div />}

            <div className="flex gap-2">
              {/* Right context actions - ONLY IN PRODUCTION MODE */}
              {mode === 'production' && (
                <>
                  {order.status === 'Aguardando Pagamento' && (
                    <button
                      onClick={() => handleUpdateStatus('Na Fila / A Imprimir')}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm text-white"
                    >
                      <Check size={14} />
                      <span>Pedido Pago</span>
                    </button>
                  )}

                  {order.status === 'Na Fila / A Imprimir' && (
                    <button
                      onClick={() => handleUpdateStatus('Em Impressão')}
                      className="px-4 py-2 bg-sp-blue hover:bg-sp-blue-light text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm text-white"
                    >
                      <Play size={14} />
                      <span>Iniciar Impressão</span>
                    </button>
                  )}

                  {order.status === 'Em Impressão' && (
                    <button
                      onClick={() => handleUpdateStatus('Pronto para Retirada')}
                      className="px-4 py-2 bg-sp-magenta hover:brightness-110 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm text-white"
                    >
                      <Check size={14} />
                      <span>Marcar Pronto</span>
                    </button>
                  )}

                  {order.status === 'Pronto para Retirada' && (
                    <button
                      onClick={() => handleUpdateStatus('Concluído / Entregue')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm text-white"
                    >
                      <Check size={14} />
                      <span>Pedido Entregue</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold transition text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 2. NESTED CANCELLATION QUESTIONNAIRE VIEW */
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl text-slate-800 text-left animate-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wide font-title text-red-600">
                Confirmar Cancelamento do Pedido #{order.id}
              </h3>
            </div>
            <button 
              onClick={() => setShowCancelForm(false)}
              className="text-slate-400 hover:text-slate-655 font-bold"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSaveCancellation} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="block text-[9px] font-black text-slate-550 uppercase">Motivo do Cancelamento *</label>
              <textarea
                required
                rows={3}
                placeholder="Explique detalhadamente o motivo do cancelamento..."
                value={cancelForm.motivo}
                onChange={(e) => setCancelForm({ ...cancelForm, motivo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-550 uppercase">Material Produzido? *</label>
                <select
                  value={cancelForm.produzido}
                  onChange={(e) => setCancelForm({ ...cancelForm, produzido: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs bg-white"
                >
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-550 uppercase">Pedido Pago? *</label>
                <select
                  value={cancelForm.pago}
                  onChange={(e) => setCancelForm({ ...cancelForm, pago: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs bg-white"
                >
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>

              <div className="col-span-2 space-y-1">
                <label className="block text-[9px] font-black text-slate-550 uppercase">Pagamento Devolvido ao Cliente? *</label>
                <select
                  value={cancelForm.devolvido}
                  onChange={(e) => setCancelForm({ ...cancelForm, devolvido: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs bg-white"
                >
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                  <option value="Não aplicável">Não aplicável</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100 justify-end">
              <button
                type="button"
                onClick={() => setShowCancelForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold transition text-xs"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={isSavingCancellation}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition text-xs shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 text-white"
              >
                {isSavingCancellation ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

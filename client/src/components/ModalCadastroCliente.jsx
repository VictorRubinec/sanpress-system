import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export default function ModalCadastroCliente({ isOpen, onClose, onSave, initialData = null, prefilledWhatsapp = '' }) {
  const [clientForm, setClientForm] = useState({
    id: null,
    nome: '',
    whatsapp: '',
    email: '',
    tipo: 'Aluno',
    ra: '',
    curso_matricula: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setClientForm({
          id: initialData.id || null,
          nome: initialData.nome || '',
          whatsapp: initialData.whatsapp || '',
          email: initialData.email || '',
          tipo: initialData.tipo || 'Aluno',
          ra: initialData.ra || '',
          curso_matricula: initialData.curso_matricula || ''
        });
      } else {
        setClientForm({
          id: null,
          nome: '',
          whatsapp: prefilledWhatsapp || '',
          email: '',
          tipo: 'Aluno',
          ra: '',
          curso_matricula: ''
        });
      }
    }
  }, [initialData, prefilledWhatsapp, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const isEditMode = !!clientForm.id;
      const url = isEditMode ? `/clientes/${clientForm.id}` : '/clientes';
      const method = isEditMode ? 'PUT' : 'POST';

      const savedClient = await apiFetch(url, {
        method: method,
        body: clientForm
      });

      alert(isEditMode ? 'Cadastro do cliente atualizado com sucesso!' : 'Novo cliente cadastrado com sucesso!');
      if (onSave) {
        onSave(savedClient || clientForm);
      }
      onClose();
    } catch (err) {
      alert(`Falha ao salvar dados do cliente: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 !m-0 animate-in fade-in duration-200" style={{ inset: '-10px' }}>
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-slate-800 text-left">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <h3 className="text-xs font-black uppercase tracking-wide font-title text-slate-900">
            {clientForm.id ? 'Editar Perfil do Cliente' : 'Cadastrar Novo Cliente'}
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-655 font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          
          {/* Nome */}
          <div className="space-y-1">
            <label className="block text-[9px] font-black text-slate-500 uppercase">Nome Completo *</label>
            <input
              type="text"
              required
              value={clientForm.nome}
              onChange={(e) => setClientForm({ ...clientForm, nome: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs bg-white"
            />
          </div>

          {/* WhatsApp */}
          <div className="space-y-1">
            <label className="block text-[9px] font-black text-slate-500 uppercase">WhatsApp (DDD + N° sem formatação) *</label>
            <input
              type="text"
              required
              placeholder="ex: 11999998888"
              value={clientForm.whatsapp}
              onChange={(e) => setClientForm({ ...clientForm, whatsapp: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs bg-white"
            />
          </div>

          {/* Tipo and RA Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[9px] font-black text-slate-500 uppercase">Tipo de Cliente *</label>
              <select
                value={clientForm.tipo}
                onChange={(e) => {
                  const newType = e.target.value;
                  setClientForm({ 
                    ...clientForm, 
                    tipo: newType,
                    ra: newType !== 'Aluno' ? '' : clientForm.ra 
                  });
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs bg-white"
              >
                <option value="Aluno">Aluno</option>
                <option value="Professor">Professor</option>
                <option value="Externo">Externo</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[9px] font-black text-slate-500 uppercase">
                RA Acadêmico {clientForm.tipo === 'Aluno' && '*'}
              </label>
              <input
                type="text"
                required={clientForm.tipo === 'Aluno'}
                disabled={clientForm.tipo !== 'Aluno'}
                placeholder={clientForm.tipo === 'Aluno' ? "Obrigatório" : "Não aplicável"}
                value={clientForm.tipo === 'Aluno' ? clientForm.ra : ''}
                onChange={(e) => setClientForm({ ...clientForm, ra: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs disabled:bg-slate-50 disabled:text-slate-400 bg-white"
              />
            </div>
          </div>

          {/* Curso / Faculdade / Departamento / Empresa */}
          <div className="space-y-1">
            <label className="block text-[9px] font-black text-slate-550 uppercase">
              {clientForm.tipo === 'Aluno' ? 'Curso / Faculdade' : clientForm.tipo === 'Professor' ? 'Departamento / Setor' : 'Empresa / Observação'}
            </label>
            <input
              type="text"
              value={clientForm.curso_matricula}
              onChange={(e) => setClientForm({ ...clientForm, curso_matricula: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs bg-white"
            />
          </div>

          {/* E-mail */}
          <div className="space-y-1">
            <label className="block text-[9px] font-black text-slate-550 uppercase">E-mail (Opcional)</label>
            <input
              type="email"
              value={clientForm.email}
              onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-sp-blue text-slate-800 text-xs bg-white"
            />
          </div>

          {/* Form Actions Footer */}
          <div className="flex gap-2 pt-3 border-t border-slate-100 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold transition text-xs bg-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-sp-blue hover:bg-sp-blue-light disabled:opacity-50 text-white font-bold transition text-xs shadow-md text-white"
            >
              {isSaving ? 'Salvando...' : clientForm.id ? 'Salvar Alterações' : 'Confirmar Cadastro'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp, ShoppingBag, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/dashboard/stats');
      setStats(data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const COLORS = ['#2158a5', '#e6007e', '#ffc400', '#00b8e6'];

  if (isLoading || !stats) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-80px)] text-xs text-slate-400 animate-pulse font-body">
        <div className="text-center space-y-2">
          <RefreshCw className="animate-spin text-sp-cyan shrink-0 mx-auto" size={24} />
          <p>Processando relatórios e gerando gráficos...</p>
        </div>
      </div>
    );
  }

  const { resumo, faturamento_diario, distribuicao_pagamento, distribuicao_cliente, horarios_pico } = stats;

  return (
    <div className="p-6 space-y-6 font-body overflow-y-auto max-h-[calc(100vh-10px)] pb-12">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Indicadores & Analytics</h1>
          <p className="text-slate-400 text-xs mt-1">Monitore faturamento, horários de pico e desempenho operacional.</p>
        </div>
        <button
          onClick={fetchStats}
          className="p-2 rounded-xl bg-slate-800 border border-white/5 text-slate-300 hover:text-white flex items-center gap-2 text-xs transition"
        >
          <RefreshCw size={14} />
          <span>Recarregar Dados</span>
        </button>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        {[
          { label: 'Faturamento Hoje', value: `R$ ${resumo.faturamento_hoje.toFixed(2)}`, icon: <DollarSign size={20} className="text-emerald-400" />, desc: 'Vendas confirmadas hoje' },
          { label: 'Pedidos Hoje', value: resumo.pedidos_hoje, icon: <ShoppingBag size={20} className="text-sp-cyan" />, desc: 'Trabalhos na fila hoje' },
          { label: 'Faturamento do Mês', value: `R$ ${resumo.faturamento_mes.toFixed(2)}`, icon: <TrendingUp size={20} className="text-sp-magenta" />, desc: 'Acumulado do mês corrente' },
          { label: 'Pedidos do Mês', value: resumo.pedidos_mes, icon: <Calendar size={20} className="text-sp-yellow" />, desc: 'Total processado no mês' }
        ].map((card, idx) => (
          <div key={idx} className="glass-panel p-5 rounded-2xl flex items-center gap-4 shadow-md">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-white/5 flex items-center justify-center shrink-0">
              {card.icon}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{card.label}</p>
              <h3 className="text-lg font-black font-title text-white mt-1">{card.value}</h3>
              <p className="text-[9px] text-slate-500 mt-0.5">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. Line Chart: Daily Billing */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl space-y-4 shadow-md flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Faturamento Diário (Últimos 30 dias)</h3>
          <div className="h-64 w-full">
            {faturamento_diario.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">Nenhum dado financeiro para o período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={faturamento_diario} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="data" stroke="#94a3b8" fontSize={9} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickFormatter={(val) => `R$${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}
                    labelStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#fff' }}
                    itemStyle={{ fontSize: '10px', color: '#00b8e6' }}
                    formatter={(val) => [`R$ ${Number(val).toFixed(2)}`, 'Faturamento']}
                  />
                  <Line type="monotone" dataKey="faturamento" stroke="#00b8e6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 2. Pie Chart: Payment Split */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 shadow-md flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Métodos de Pagamento</h3>
          <div className="h-64 w-full relative flex items-center justify-center">
            {distribuicao_pagamento.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">Nenhum dado registrado.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribuicao_pagamento}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {distribuicao_pagamento.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}
                    itemStyle={{ fontSize: '10px', color: '#fff' }}
                    formatter={(val) => [`R$ ${Number(val).toFixed(2)}`, 'Total']}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    iconSize={10} 
                    formatter={(value) => <span className="text-[10px] text-slate-400 font-bold">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 3. Bar Chart: Customer Type split */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 shadow-md flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Faturamento por Categoria de Cliente</h3>
          <div className="h-64 w-full">
            {distribuicao_cliente.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">Sem registros.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribuicao_cliente} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickFormatter={(val) => `R$${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}
                    labelStyle={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }}
                    itemStyle={{ fontSize: '10px', color: '#ffc400' }}
                    formatter={(val) => [`R$ ${Number(val).toFixed(2)}`, 'Faturamento']}
                  />
                  <Bar dataKey="value" fill="#ffc400" radius={[8, 8, 0, 0]}>
                    {distribuicao_cliente.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'Aluno' ? '#00b8e6' : entry.name === 'Professor' ? '#e6007e' : '#ffc400'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 4. Bar Chart: Peak Hours */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 shadow-md flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">Horários de Pico (Volume de Pedidos)</h3>
          <div className="h-64 w-full">
            {horarios_pico.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">Sem registro de horários de pedidos.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={horarios_pico} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hora" stroke="#94a3b8" fontSize={9} />
                  <YAxis stroke="#94a3b8" fontSize={9} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}
                    labelStyle={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }}
                    itemStyle={{ fontSize: '10px', color: '#e6007e' }}
                    formatter={(val) => [val, 'Qtd de Pedidos']}
                  />
                  <Bar dataKey="quantidade" fill="#e6007e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

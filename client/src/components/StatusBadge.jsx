/**
 * StatusBadge — Componente unificado de badge de status de pedido.
 *
 * Props:
 *   status  {string} — Valor do status do pedido (ex: 'Em Impressão')
 *   variant {string} — 'pill' (padrão, com borda, usado em tabelas)
 *                      'inline' (menor, sem borda, usado em cards/sidebars)
 *
 * Também exporta getStatusConfig(status) para consumo programático
 * (ex: obter cor da barra de progresso em FilaProducao.jsx)
 */

export const STATUS_CONFIG = {
  'Aguardando Pagamento': {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200/60',
    dot: 'bg-amber-500',
    label: 'Aguardando Pagamento',
    labelShort: 'Aguardando Pag.',
  },
  'Na Fila / A Imprimir': {
    bg: 'bg-blue-50',
    text: 'text-sp-blue',
    border: 'border-blue-150',
    dot: 'bg-sp-blue',
    label: 'Na Fila',
    labelShort: 'Na Fila',
  },
  'Em Impressão': {
    bg: 'bg-magenta-50',
    text: 'text-sp-magenta',
    border: 'border-magenta-150',
    dot: 'bg-sp-magenta',
    label: 'Em Impressão',
    labelShort: 'Em Impressão',
  },
  'Pronto para Retirada': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-650',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Pronto',
    labelShort: 'Pronto',
  },
  'Concluído / Entregue': {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
    label: 'Finalizado',
    labelShort: 'Finalizado',
  },
  Cancelado: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200/60',
    dot: 'bg-red-500',
    label: 'Cancelado',
    labelShort: 'Cancelado',
  },
};

/** Fallback para status desconhecidos */
const FALLBACK_CONFIG = {
  bg: 'bg-slate-50',
  text: 'text-slate-600',
  border: 'border-slate-150',
  dot: 'bg-slate-400',
  label: null,
  labelShort: null,
};

/** Exporta a config de um status para uso programático */
export function getStatusConfig(status) {
  return STATUS_CONFIG[status] ?? FALLBACK_CONFIG;
}

export default function StatusBadge({ status, variant = 'pill' }) {
  const config = getStatusConfig(status);
  const displayLabel = config.label ?? status;

  if (variant === 'inline') {
    return (
      <span
        className={`
          px-1.5 py-0.5 rounded text-[8px] font-black uppercase
          ${config.bg} ${config.text}
        `}
      >
        {displayLabel}
      </span>
    );
  }

  // Default: pill (com borda, tamanho completo)
  return (
    <span
      className={`
        px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider
        border inline-block
        ${config.bg} ${config.text} ${config.border}
      `}
    >
      {displayLabel}
    </span>
  );
}

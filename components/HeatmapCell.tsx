
import React from 'react';

interface HeatmapCellProps {
  value: number;
  percentage: boolean;
  baseValue?: number;
  isStatColumn?: boolean;
}

export const HeatmapCell: React.FC<HeatmapCellProps> = ({ value, percentage, baseValue, isStatColumn }) => {
  // O ratio define a cor baseado na retenção relativa ao total de contratos
  const ratio = percentage ? value : (baseValue && baseValue > 0 ? value / baseValue : 0);
  
  const getBackgroundColor = (r: number) => {
    if (isStatColumn) return 'bg-white text-slate-900';
    
    // Escala de Retenção Crítica
    if (r >= 0.95) return 'bg-[#16a34a] text-white'; // Verde Escuro (Excelente)
    if (r >= 0.85) return 'bg-[#22c55e] text-white'; // Verde (Ótimo)
    if (r >= 0.70) return 'bg-[#86efac] text-slate-800'; // Verde Claro (Bom)
    if (r >= 0.50) return 'bg-[#facc15] text-slate-900'; // Amarelo (Atenção)
    if (r >= 0.30) return 'bg-[#fb923c] text-white'; // Laranja (Risco)
    if (r > 0) return 'bg-[#ef4444] text-white'; // Vermelho (Crítico)
    return 'bg-slate-100 text-slate-300'; // Vazio / Churn Total
  };

  const displayValue = percentage 
    ? `${(value * 100).toFixed(2)}%`.replace('.', ',')
    : value.toLocaleString('pt-BR');

  return (
    <div className={`px-2 py-3 text-center text-[10px] font-black border-r border-b border-slate-200/50 transition-all ${getBackgroundColor(ratio)}`}>
      {displayValue}
    </div>
  );
};


import React from 'react';

interface HeatmapCellProps {
  value: number;
  percentage: boolean;
  baseValue?: number;
  isStatColumn?: boolean;
}

export const HeatmapCell: React.FC<HeatmapCellProps> = ({ value, percentage, baseValue, isStatColumn }) => {
  const ratio = percentage ? value : (baseValue && baseValue > 0 ? value / baseValue : 0);
  
  // Custom Red-Yellow-Green Heatmap Scale
  const getBackgroundColor = (r: number) => {
    if (isStatColumn) return 'bg-white text-slate-900';
    
    if (r >= 0.9) return 'bg-[#22c55e] text-white'; // Success Green
    if (r >= 0.75) return 'bg-[#86efac] text-slate-900'; // Light Green
    if (r >= 0.5) return 'bg-[#fde047] text-slate-900'; // Yellow
    if (r >= 0.3) return 'bg-[#fb923c] text-white'; // Orange
    if (r > 0) return 'bg-[#ef4444] text-white'; // Red
    return 'bg-[#fee2e2] text-slate-400'; // Very Low/Empty
  };

  const displayValue = percentage 
    ? `${(value * 100).toFixed(2)}%` 
    : value.toLocaleString();

  return (
    <div className={`px-2 py-3 text-center text-[10px] font-semibold border-r border-b border-slate-200 transition-colors ${getBackgroundColor(ratio)}`}>
      {displayValue}
    </div>
  );
};

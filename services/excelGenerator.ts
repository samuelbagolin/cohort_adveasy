
import * as XLSX from 'xlsx';
import { CohortStats, ProcessedCustomer } from '../types';
import { formatCohortName } from './dataProcessor';

export const generateCohortExcel = (
  originalData: any[],
  stats: CohortStats,
  processedCustomers: any[]
) => {
  const wb = XLSX.utils.book_new();

  // Tab 1: Dados Processados
  const dataForTab1 = processedCustomers.map(c => {
    return {
      ...c.originalData,
      'Mês Cohort': formatCohortName(c.cohortMonth),
      'Permanência Ajustada (Meses)': c.tenureMonths
    };
  });
  const wsData = XLSX.utils.json_to_sheet(dataForTab1);
  XLSX.utils.book_append_sheet(wb, wsData, "Dados");

  // Tab 2: Análise de Cohort (Valores Absolutos)
  const cohortRows = stats.cohorts.map(row => {
    const obj: any = { 
        'Mês do Cohort': formatCohortName(row.cohort), 
        'Contratos (Iniciados)': row.totalStarters 
    };
    row.retention.forEach((val, idx) => {
      obj[`Mês ${idx}`] = val;
    });
    obj['Média Retenção'] = row.average;
    obj['Tendência (Trend)'] = row.growth;
    return obj;
  });
  const wsCohort = XLSX.utils.json_to_sheet(cohortRows);
  XLSX.utils.book_append_sheet(wb, wsCohort, "Análise Absoluta");

  // Tab 3: Retenção %
  const percentRows = stats.cohorts.map(row => {
    const obj: any = { 
        'Mês do Cohort': formatCohortName(row.cohort), 
        'Contratos (Iniciados)': row.totalStarters 
    };
    const base = row.retention[0];
    row.retention.forEach((val, idx) => {
      obj[`Mês ${idx}`] = base > 0 ? (val / base) : 0;
    });
    obj['Média Retenção %'] = row.average;
    obj['Tendência %'] = row.growth;
    return obj;
  });
  const wsPercent = XLSX.utils.json_to_sheet(percentRows);
  XLSX.utils.book_append_sheet(wb, wsPercent, "Retenção Percentual");

  XLSX.writeFile(wb, `Analise_Retencao_AdvEasy_${new Date().getTime()}.xlsx`);
};

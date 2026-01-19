
import { differenceInCalendarMonths, format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RawSubscriptionRow, ProcessedCustomer, CohortStats, CohortMatrixRow } from '../types';

export const processSubscriptionData = (data: RawSubscriptionRow[]): CohortStats => {
  const processedCustomers: ProcessedCustomer[] = [];
  const now = new Date();

  data.forEach((row) => {
    const keys = Object.keys(row);
    const startKey = keys.find(k => k.toLowerCase().includes('iniciou')) || keys[18];
    const cancelKey = keys.find(k => k.toLowerCase().includes('cancelou')) || keys[21];

    const rawStart = row[startKey];
    const rawCancel = row[cancelKey];

    const startDate = parseDate(rawStart);
    if (!startDate || !isValid(startDate)) return;

    const cancelDate = rawCancel ? parseDate(rawCancel) : null;
    
    let tenureMonths = 0;
    if (!cancelDate) {
      tenureMonths = differenceInCalendarMonths(now, startDate) + 1;
    } else {
      // Se cancelou no mesmo mês, tenure é 0. Se cancelou no mês seguinte, tenure é 1.
      tenureMonths = differenceInCalendarMonths(cancelDate, startDate);
    }

    processedCustomers.push({
      originalData: row,
      cohortMonth: format(startDate, 'yyyy-MM'),
      startDate,
      cancelDate,
      tenureMonths
    });
  });

  const cohortsMap: Record<string, ProcessedCustomer[]> = {};
  processedCustomers.forEach(c => {
    if (!cohortsMap[c.cohortMonth]) cohortsMap[c.cohortMonth] = [];
    cohortsMap[c.cohortMonth].push(c);
  });

  const sortedCohortKeys = Object.keys(cohortsMap).sort();
  const matrix: CohortMatrixRow[] = [];
  const maxRequestedMonths = 24;

  sortedCohortKeys.forEach((cohortKey, index) => {
    const customers = cohortsMap[cohortKey];
    const starters = customers.length; // Denominador real (total de contratos adquiridos)
    const cohortStartDate = parse(cohortKey, 'yyyy-MM', new Date());
    
    // Mês 0: Clientes que não cancelaram no ato (permanência >= 1 mês de faturamento/uso)
    const month0Active = customers.filter(c => c.tenureMonths >= 1).length;
    const retention: number[] = [month0Active];

    for (let m = 1; m <= maxRequestedMonths; m++) {
      const activeCount = customers.filter(c => c.tenureMonths >= (m + 1)).length;
      retention.push(activeCount);
    }

    // LÓGICA DE MÉDIA EXECUTIVA:
    const monthsElapsedSinceStart = differenceInCalendarMonths(now, cohortStartDate);
    
    // numRealizedMonths define até onde a linha do tempo já chegou para este cohort
    const numRealizedMonths = Math.max(1, Math.min(monthsElapsedSinceStart + 1, retention.length));
    
    const realizedRetention = retention.slice(0, numRealizedMonths);
    
    // A média agora usa 'starters' (Total de Contratos) como base para refletir perdas imediatas
    const average = realizedRetention.length > 0 
      ? realizedRetention.reduce((acc, v) => acc + (starters > 0 ? v / starters : 0), 0) / realizedRetention.length 
      : 0;

    let growth = 0;
    if (index > 0) {
      const prevRow = matrix[index - 1];
      growth = average - prevRow.average;
    }

    matrix.push({
      cohort: cohortKey,
      totalStarters: starters,
      retention,
      average,
      growth
    });
  });

  return {
    cohorts: matrix,
    maxMonths: maxRequestedMonths
  };
};

function parseDate(val: any): Date | null {
  if (val instanceof Date) return val;
  if (!val) return null;
  const str = String(val).trim();
  const formats = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'dd/MM/yyyy HH:mm:ss'];
  for (const f of formats) {
    const d = parse(str, f, new Date());
    if (isValid(d)) return d;
  }
  const timestamp = Date.parse(str);
  return isNaN(timestamp) ? null : new Date(timestamp);
}

export const formatCohortName = (key: string): string => {
  const date = parse(key, 'yyyy-MM', new Date());
  return format(date, "MMM/yy", { locale: ptBR });
};

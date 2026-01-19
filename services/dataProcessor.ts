
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
    const starters = customers.length;
    const cohortStartDate = parse(cohortKey, 'yyyy-MM', new Date());
    
    const month0Active = customers.filter(c => c.tenureMonths >= 1).length;
    const retention: number[] = [month0Active];

    for (let m = 1; m <= maxRequestedMonths; m++) {
      const activeCount = customers.filter(c => c.tenureMonths >= (m + 1)).length;
      retention.push(activeCount);
    }

    // LÓGICA DE MÉDIA CORRIGIDA:
    // Considerar apenas meses que já ocorreram em relação ao 'now'
    const monthsElapsedSinceStart = differenceInCalendarMonths(now, cohortStartDate);
    
    // Definimos quantos meses da array de retenção são "reais" (decorridos)
    // Mês 0 conta como 1, Mês 1 conta como 2, etc.
    const numRealizedMonths = Math.max(1, Math.min(monthsElapsedSinceStart + 1, retention.length));
    
    const base = retention[0];
    const realizedRetention = retention.slice(0, numRealizedMonths);
    
    // Calculamos a média apenas sobre a fatia de meses que já passaram
    const average = realizedRetention.length > 0 
      ? realizedRetention.reduce((acc, v) => acc + (base > 0 ? v / base : 0), 0) / realizedRetention.length 
      : 0;

    // Growth (Crescimento) é current average - previous average
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
  if (!isNaN(timestamp)) return new Date(timestamp);

  return null;
}

export const formatCohortName = (key: string): string => {
  const date = parse(key, 'yyyy-MM', new Date());
  return format(date, "MMM/yy", { locale: ptBR });
};

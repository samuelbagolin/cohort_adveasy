
export interface RawSubscriptionRow {
  [key: string]: any;
}

export interface ProcessedCustomer {
  originalData: RawSubscriptionRow;
  cohortMonth: string; // Format: "YYYY-MM"
  startDate: Date;
  cancelDate: Date | null;
  tenureMonths: number;
}

export interface CohortMatrixRow {
  cohort: string;
  totalStarters: number;
  retention: number[]; // Index 0 is Month 0, 1 is Month 1, etc.
  average: number;
  growth: number;
}

export interface CohortStats {
  cohorts: CohortMatrixRow[];
  maxMonths: number;
}

export interface Declaration {
  id?: number;
  date: string; // ISO date string YYYY-MM-DD
  status: 'validated' | 'zero_cases' | 'pending' | 'draft' | 'Validé' | 'Zéro cas à déclarer' | 'Zéro cas';
  cases: CaseData[];
  created_at?: string;
}

export interface CaseData {
  sex: string;
  ageGroup: string;
  pathology: string;
  symptoms?: string[];
}

export const PATHOLOGIES = [
  "Varicelle",
  "Diarrhée aiguë",
  "IRA",
  "Syndrome grippaux"
] as const;
export const AGE_GROUPS = ["0-4 ans", "5-14 ans", "15-24 ans", "25-44 ans", "45-64 ans", "plus de 65 ans"] as const;
export const SEXES = ["M", "F"] as const;

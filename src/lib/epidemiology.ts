/**
 * Epidemiology calculation engine — IARC/WHO standard methods
 * Replaces CanReg5 statistical computations
 * Standards: CI5, GLOBOCAN, SEER methodology
 */

// ── Standard Populations ──

/** Segi World Standard Population weights (per 100,000) */
export const SEGI_WEIGHTS: Record<string, number> = {
  '0-4': 12000, '5-9': 10000, '10-14': 9000, '15-19': 9000,
  '20-24': 8000, '25-29': 8000, '30-34': 6000, '35-39': 6000,
  '40-44': 6000, '45-49': 6000, '50-54': 5000, '55-59': 4000,
  '60-64': 4000, '65-69': 3000, '70-74': 2000, '75-79': 1000,
  '80-84': 500, '85+': 500,
};
export const SEGI_TOTAL = 100000;

/** WHO 2000 World Standard Population (revised) */
export const WHO2000_WEIGHTS: Record<string, number> = {
  '0-4': 8860, '5-9': 8690, '10-14': 8600, '15-19': 8470,
  '20-24': 8220, '25-29': 7930, '30-34': 7610, '35-39': 7150,
  '40-44': 6590, '45-49': 6040, '50-54': 5370, '55-59': 4550,
  '60-64': 3720, '65-69': 2960, '70-74': 2210, '75-79': 1520,
  '80-84': 910, '85+': 640,
};
export const WHO2000_TOTAL = 100000;

/** European Standard Population (ESP 2013) */
export const EUROPEAN_WEIGHTS: Record<string, number> = {
  '0-4': 5000, '5-9': 5500, '10-14': 5500, '15-19': 5500,
  '20-24': 6000, '25-29': 6000, '30-34': 6500, '35-39': 7000,
  '40-44': 7000, '45-49': 7000, '50-54': 7000, '55-59': 6500,
  '60-64': 6000, '65-69': 5500, '70-74': 5000, '75-79': 4000,
  '80-84': 2500, '85+': 2500,
};

export const AGE_GROUPS = Object.keys(SEGI_WEIGHTS);

// ── Core Calculations ──

/** Map a birth date to the 5-year age group */
export function getAgeGroup(birthDate: string, refDate: string = new Date().toISOString()): string {
  const birth = new Date(birthDate);
  const ref = new Date(refDate);
  const age = ref.getFullYear() - birth.getFullYear() -
    (ref.getMonth() < birth.getMonth() || (ref.getMonth() === birth.getMonth() && ref.getDate() < birth.getDate()) ? 1 : 0);
  if (age < 0) return '0-4';
  if (age >= 85) return '85+';
  const lower = Math.floor(age / 5) * 5;
  return `${lower}-${lower + 4}`;
}

/** Get numeric age from birth date */
export function getAge(birthDate: string, refDate: string = new Date().toISOString()): number {
  const birth = new Date(birthDate);
  const ref = new Date(refDate);
  return ref.getFullYear() - birth.getFullYear() -
    (ref.getMonth() < birth.getMonth() || (ref.getMonth() === birth.getMonth() && ref.getDate() < birth.getDate()) ? 1 : 0);
}

/** Crude incidence rate per 100,000 */
export function crudeRate(cases: number, population: number): number {
  if (population <= 0) return 0;
  return (cases / population) * 100000;
}

/** Age-Specific Rate per 100,000 for a single age group */
export function ageSpecificRate(cases: number, population: number): number {
  if (population <= 0) return 0;
  return (cases / population) * 100000;
}

/**
 * Age-Standardized Rate (ASR) — Direct method
 * Returns rate per 100,000 using specified standard population
 */
export function calculateASR(
  casesByAge: Record<string, number>,
  populationByAge: Record<string, number>,
  weights: Record<string, number> = SEGI_WEIGHTS,
  totalWeight: number = SEGI_TOTAL
): number {
  let asr = 0;
  for (const ag of AGE_GROUPS) {
    const cases = casesByAge[ag] || 0;
    const pop = populationByAge[ag] || 0;
    const w = weights[ag] || 0;
    if (pop > 0) {
      asr += (cases / pop) * w;
    }
  }
  return (asr / totalWeight) * 100000;
}

/**
 * ASR Standard Error — for confidence intervals
 * SE(ASR) = (1/T²) × sqrt(Σ wi² × ci / ni²) where T = total weight
 */
export function asrStandardError(
  casesByAge: Record<string, number>,
  populationByAge: Record<string, number>,
  weights: Record<string, number> = SEGI_WEIGHTS,
  totalWeight: number = SEGI_TOTAL
): number {
  let sumVar = 0;
  for (const ag of AGE_GROUPS) {
    const c = casesByAge[ag] || 0;
    const n = populationByAge[ag] || 0;
    const w = weights[ag] || 0;
    if (n > 0 && c > 0) {
      sumVar += (w * w * c) / (n * n);
    }
  }
  return (Math.sqrt(sumVar) / totalWeight) * 100000;
}

/** ASR with 95% CI */
export function asrWithCI(
  casesByAge: Record<string, number>,
  populationByAge: Record<string, number>,
  weights: Record<string, number> = SEGI_WEIGHTS,
  totalWeight: number = SEGI_TOTAL
): { asr: number; lower: number; upper: number; se: number } {
  const asr = calculateASR(casesByAge, populationByAge, weights, totalWeight);
  const se = asrStandardError(casesByAge, populationByAge, weights, totalWeight);
  return {
    asr,
    se,
    lower: Math.max(0, asr - 1.96 * se),
    upper: asr + 1.96 * se,
  };
}

/**
 * Truncated ASR (35-64 years) — used in CI5 volumes
 * Focuses on the ages where cancer incidence is most comparable across populations
 */
export function truncatedASR(
  casesByAge: Record<string, number>,
  populationByAge: Record<string, number>,
  weights: Record<string, number> = SEGI_WEIGHTS,
  ageFrom: number = 35,
  ageTo: number = 64
): number {
  let numerator = 0;
  let weightSum = 0;
  for (const ag of AGE_GROUPS) {
    const lower = parseInt(ag.split('-')[0]);
    if (lower >= ageFrom && lower <= ageTo) {
      const c = casesByAge[ag] || 0;
      const pop = populationByAge[ag] || 0;
      const w = weights[ag] || 0;
      if (pop > 0) {
        numerator += (c / pop) * w;
      }
      weightSum += w;
    }
  }
  if (weightSum <= 0) return 0;
  return (numerator / weightSum) * 100000;
}

/** 95% Confidence Interval for a crude rate (Poisson approximation) */
export function confidenceInterval95(cases: number, population: number): [number, number] {
  if (population <= 0 || cases <= 0) return [0, 0];
  const rate = (cases / population) * 100000;
  const se = rate / Math.sqrt(cases);
  return [Math.max(0, rate - 1.96 * se), rate + 1.96 * se];
}

/** Cumulative risk 0-74 years (IARC standard) */
export function cumulativeRate074(
  casesByAge: Record<string, number>,
  populationByAge: Record<string, number>
): number {
  const groups074 = AGE_GROUPS.filter(ag => {
    const lower = parseInt(ag.split('-')[0]);
    return lower < 75;
  });
  let cumRate = 0;
  for (const ag of groups074) {
    const cases = casesByAge[ag] || 0;
    const pop = populationByAge[ag] || 0;
    if (pop > 0) {
      cumRate += (cases / pop) * 5;
    }
  }
  return (1 - Math.exp(-cumRate)) * 100;
}

/** Sex ratio M/F for a given cancer type */
export function sexRatio(maleCount: number, femaleCount: number): number {
  if (femaleCount <= 0) return maleCount > 0 ? Infinity : 0;
  return Math.round((maleCount / femaleCount) * 100) / 100;
}

/**
 * Annual Percent Change (APC) — SEER/NCI method
 * Uses log-linear regression: ln(rate) = a + b*year
 * APC = (e^b - 1) × 100
 */
export function annualPercentChange(yearRates: { year: number; rate: number }[]): {
  apc: number; pValue: number; significant: boolean;
} {
  const valid = yearRates.filter(yr => yr.rate > 0);
  if (valid.length < 3) return { apc: 0, pValue: 1, significant: false };

  const n = valid.length;
  const x = valid.map(v => v.year);
  const y = valid.map(v => Math.log(v.rate));

  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let ssxy = 0, ssxx = 0, ssyy = 0;
  for (let i = 0; i < n; i++) {
    ssxy += (x[i] - meanX) * (y[i] - meanY);
    ssxx += (x[i] - meanX) ** 2;
    ssyy += (y[i] - meanY) ** 2;
  }

  if (ssxx === 0) return { apc: 0, pValue: 1, significant: false };

  const b = ssxy / ssxx;
  const apc = (Math.exp(b) - 1) * 100;

  // t-test for significance
  const residualSS = ssyy - (ssxy * ssxy) / ssxx;
  const se = Math.sqrt(residualSS / ((n - 2) * ssxx));
  const tStat = Math.abs(b / se);
  // Approximate p-value (2-tailed) using normal approximation for simplicity
  const pValue = 2 * (1 - normalCDF(tStat));
  const significant = pValue < 0.05;

  return { apc: Math.round(apc * 100) / 100, pValue, significant };
}

/** Normal CDF approximation (Abramowitz & Stegun) */
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/**
 * Median age at diagnosis
 */
export function medianAge(cases: CaseWithPatient[]): number {
  const ages = cases
    .filter(c => c.patients?.date_naissance)
    .map(c => getAge(c.patients!.date_naissance!, c.date_diagnostic))
    .sort((a, b) => a - b);
  if (ages.length === 0) return 0;
  const mid = Math.floor(ages.length / 2);
  return ages.length % 2 === 0 ? (ages[mid - 1] + ages[mid]) / 2 : ages[mid];
}

/**
 * Mean age at diagnosis
 */
export function meanAge(cases: CaseWithPatient[]): number {
  const ages = cases
    .filter(c => c.patients?.date_naissance)
    .map(c => getAge(c.patients!.date_naissance!, c.date_diagnostic));
  if (ages.length === 0) return 0;
  return ages.reduce((s, a) => s + a, 0) / ages.length;
}

// ── Data Quality Indicators (CI5/IARC) ──

/**
 * Percentage of Microscopically Verified cases (MV%)
 * Gold standard: IARC recommends >80% for high-quality registries
 */
export function microscopicVerification(cases: CaseWithPatient[]): number {
  if (cases.length === 0) return 0;
  const verified = cases.filter(c => c.resultat_anapath && c.resultat_anapath.trim().length > 0).length;
  return (verified / cases.length) * 100;
}

/**
 * Percentage of cases with unknown primary site
 */
export function unknownPrimarySite(cases: CaseWithPatient[]): number {
  if (cases.length === 0) return 0;
  const unknown = cases.filter(c =>
    !c.type_cancer || c.type_cancer === 'Inconnu' || c.type_cancer === 'Autre'
  ).length;
  return (unknown / cases.length) * 100;
}

/**
 * Percentage of cases with TNM staging
 */
export function stagingCompleteness(cases: CaseWithPatient[]): number {
  if (cases.length === 0) return 0;
  const staged = cases.filter(c => c.stade_tnm && c.stade_tnm.trim().length > 0).length;
  return (staged / cases.length) * 100;
}

/**
 * ASR by individual cancer type — key for GLOBOCAN-style reports
 */
export function asrByCancerType(
  cases: CaseWithPatient[],
  populationByAge: Record<string, number>,
  weights: Record<string, number> = SEGI_WEIGHTS,
  totalWeight: number = SEGI_TOTAL
): {
  type: string; count: number; male: number; female: number;
  asr: number; asrMale: number; asrFemale: number;
  crude: number; percentage: number; medianAge: number;
}[] {
  const totalPop = Object.values(populationByAge).reduce((s, v) => s + v, 0);
  const popByAgeMale: Record<string, number> = {};
  const popByAgeFemale: Record<string, number> = {};
  // Approximate 50/50 split if we don't have sex-specific pop
  for (const ag of AGE_GROUPS) {
    popByAgeMale[ag] = Math.round((populationByAge[ag] || 0) * 0.5);
    popByAgeFemale[ag] = Math.round((populationByAge[ag] || 0) * 0.5);
  }

  const types = new Map<string, CaseWithPatient[]>();
  cases.forEach(c => {
    const t = c.type_cancer || 'Inconnu';
    if (!types.has(t)) types.set(t, []);
    types.get(t)!.push(c);
  });

  const total = cases.length || 1;

  return Array.from(types.entries())
    .map(([type, typeCases]) => {
      const cByAge = casesToAgeMap(typeCases);
      const cByAgeMale = casesToAgeMap(typeCases, 'M');
      const cByAgeFemale = casesToAgeMap(typeCases, 'F');
      const maleCount = typeCases.filter(c => c.patients?.sexe === 'M').length;
      const femaleCount = typeCases.filter(c => c.patients?.sexe === 'F').length;

      return {
        type,
        count: typeCases.length,
        male: maleCount,
        female: femaleCount,
        asr: calculateASR(cByAge, populationByAge, weights, totalWeight),
        asrMale: calculateASR(cByAgeMale, popByAgeMale, weights, totalWeight),
        asrFemale: calculateASR(cByAgeFemale, popByAgeFemale, weights, totalWeight),
        crude: crudeRate(typeCases.length, totalPop),
        percentage: Math.round((typeCases.length / total) * 1000) / 10,
        medianAge: medianAge(typeCases),
      };
    })
    .sort((a, b) => b.count - a.count);
}

// ── Data Structures ──

export interface CaseWithPatient {
  type_cancer: string;
  date_diagnostic: string;
  stade_tnm?: string | null;
  resultat_anapath?: string | null;
  code_icdo?: string | null;
  patients: { sexe: string | null; date_naissance: string | null; wilaya?: string; commune?: string } | null;
}

export interface AgeGroupData {
  ageGroup: string;
  male: number;
  female: number;
  total: number;
}

export function groupByAgeAndSex(cases: CaseWithPatient[]): AgeGroupData[] {
  const groups: Record<string, { male: number; female: number }> = {};
  AGE_GROUPS.forEach(ag => { groups[ag] = { male: 0, female: 0 }; });

  cases.forEach(c => {
    if (!c.patients?.date_naissance) return;
    const ag = getAgeGroup(c.patients.date_naissance, c.date_diagnostic);
    if (groups[ag]) {
      if (c.patients.sexe === 'M') groups[ag].male++;
      else groups[ag].female++;
    }
  });

  return AGE_GROUPS.map(ag => ({
    ageGroup: ag,
    male: groups[ag].male,
    female: groups[ag].female,
    total: groups[ag].male + groups[ag].female,
  }));
}

export interface LocationRank {
  location: string;
  count: number;
  male: number;
  female: number;
  ratio: number;
  percentage: number;
}

export function topLocations(cases: CaseWithPatient[], n: number = 10): LocationRank[] {
  const counts: Record<string, { total: number; male: number; female: number }> = {};
  cases.forEach(c => {
    const loc = c.type_cancer || 'Inconnu';
    if (!counts[loc]) counts[loc] = { total: 0, male: 0, female: 0 };
    counts[loc].total++;
    if (c.patients?.sexe === 'M') counts[loc].male++;
    else counts[loc].female++;
  });

  const total = cases.length || 1;
  return Object.entries(counts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, n)
    .map(([location, v]) => ({
      location,
      count: v.total,
      male: v.male,
      female: v.female,
      ratio: sexRatio(v.male, v.female),
      percentage: Math.round((v.total / total) * 1000) / 10,
    }));
}

export function casesToAgeMap(cases: CaseWithPatient[], sex?: 'M' | 'F'): Record<string, number> {
  const map: Record<string, number> = {};
  AGE_GROUPS.forEach(ag => { map[ag] = 0; });
  cases.forEach(c => {
    if (!c.patients?.date_naissance) return;
    if (sex && c.patients.sexe !== sex) return;
    const ag = getAgeGroup(c.patients.date_naissance, c.date_diagnostic);
    if (map[ag] !== undefined) map[ag]++;
  });
  return map;
}

export interface PopulationRow {
  tranche_age: string;
  sexe: string;
  population: number;
}

export function populationToAgeMap(rows: PopulationRow[], sex?: 'M' | 'F'): Record<string, number> {
  const map: Record<string, number> = {};
  AGE_GROUPS.forEach(ag => { map[ag] = 0; });
  rows.forEach(r => {
    if (sex && r.sexe !== sex) return;
    if (map[r.tranche_age] !== undefined) {
      map[r.tranche_age] += r.population;
    }
  });
  return map;
}

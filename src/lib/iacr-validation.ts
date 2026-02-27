/**
 * IARC/OMS Validation Rules Engine for Cancer Registry
 * Based on CanReg5 and IACR data quality standards
 */

export interface ValidationError {
  field: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface CaseData {
  nom?: string;
  prenom?: string;
  dateNaissance?: string;
  sexe?: string;
  dateDiagnostic?: string;
  typeCancer?: string;
  topographieIcdo?: string;
  morphologieIcdo?: string;
  codeIcdo?: string;
  stadeTnm?: string;
  resultatAnapath?: string;
  methodeDiagnostic?: string;
  commune?: string;
  wilaya?: string;
}

// ICD-O3 Topography-Morphology incompatibility rules (simplified)
const TOPO_MORPHO_RULES: Record<string, string[]> = {
  // Glioblastoma only valid for CNS sites
  '9440': ['C71', 'C72'],
  // Hepatocellular carcinoma only for liver
  '8170': ['C22'],
  // Renal cell carcinoma only for kidney
  '8312': ['C64'],
  // Transitional cell carcinoma for urinary tract
  '8120': ['C65', 'C66', 'C67', 'C68'],
};

// Sex-specific cancer sites
const MALE_ONLY_SITES = ['C61', 'C62', 'C63']; // Prostate, testis
const FEMALE_ONLY_SITES = ['C51', 'C52', 'C53', 'C54', 'C55', 'C56', 'C57', 'C58']; // Female genital

export function validateCase(data: CaseData): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule 1: Required fields
  if (!data.nom?.trim()) errors.push({ field: 'nom', rule: 'required', severity: 'error', message: 'Le nom est obligatoire' });
  if (!data.prenom?.trim()) errors.push({ field: 'prenom', rule: 'required', severity: 'error', message: 'Le prénom est obligatoire' });
  if (!data.sexe) errors.push({ field: 'sexe', rule: 'required', severity: 'error', message: 'Le sexe est obligatoire' });
  if (!data.dateDiagnostic) errors.push({ field: 'dateDiagnostic', rule: 'required', severity: 'error', message: 'La date de diagnostic est obligatoire' });
  if (!data.typeCancer) errors.push({ field: 'typeCancer', rule: 'required', severity: 'error', message: 'Le type de cancer est obligatoire' });

  // Rule 2: Date coherence - diagnostic date vs birth date (max 120 years)
  if (data.dateNaissance && data.dateDiagnostic) {
    const birth = new Date(data.dateNaissance);
    const diag = new Date(data.dateDiagnostic);
    const ageAtDiag = (diag.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (ageAtDiag < 0) {
      errors.push({ field: 'dateDiagnostic', rule: 'date_coherence', severity: 'error', message: 'Date de diagnostic antérieure à la naissance' });
    }
    if (ageAtDiag > 120) {
      errors.push({ field: 'dateDiagnostic', rule: 'date_coherence', severity: 'error', message: 'Âge au diagnostic > 120 ans — vérifier les dates' });
    }
    if (diag > new Date()) {
      errors.push({ field: 'dateDiagnostic', rule: 'future_date', severity: 'error', message: 'Date de diagnostic dans le futur' });
    }
  }

  // Rule 3: Topography-Morphology incompatibility
  if (data.morphologieIcdo && data.topographieIcdo) {
    const morphCode = data.morphologieIcdo.split('/')[0];
    const topoCode = data.topographieIcdo.substring(0, 3);
    
    if (TOPO_MORPHO_RULES[morphCode]) {
      const allowedSites = TOPO_MORPHO_RULES[morphCode];
      if (!allowedSites.some(s => data.topographieIcdo?.startsWith(s))) {
        errors.push({
          field: 'morphologieIcdo',
          rule: 'topo_morpho_check',
          severity: 'error',
          message: `Morphologie ${data.morphologieIcdo} incompatible avec topographie ${data.topographieIcdo}`,
        });
      }
    }
  }

  // Rule 4: Sex-site coherence
  if (data.sexe && data.topographieIcdo) {
    const topo = data.topographieIcdo.substring(0, 3);
    if (data.sexe === 'M' && FEMALE_ONLY_SITES.includes(topo)) {
      errors.push({ field: 'topographieIcdo', rule: 'sex_site', severity: 'error', message: 'Site anatomique féminin pour un patient masculin' });
    }
    if (data.sexe === 'F' && MALE_ONLY_SITES.includes(topo)) {
      errors.push({ field: 'topographieIcdo', rule: 'sex_site', severity: 'error', message: 'Site anatomique masculin pour un patient féminin' });
    }
  }

  // Rule 5: MV check - No microscopic verification for solid tumors > 3 months
  if (data.dateDiagnostic && !data.resultatAnapath && data.methodeDiagnostic !== 'clinique') {
    const diagDate = new Date(data.dateDiagnostic);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    if (diagDate < threeMonthsAgo) {
      errors.push({
        field: 'resultatAnapath',
        rule: 'mv_delay',
        severity: 'warning',
        message: 'Pas de vérification microscopique > 3 mois après diagnostic',
      });
    }
  }

  // Rule 6: ICD-O format validation
  if (data.topographieIcdo && !/^C\d{2}(\.\d)?$/.test(data.topographieIcdo)) {
    errors.push({ field: 'topographieIcdo', rule: 'icdo_format', severity: 'error', message: 'Format topographie ICD-O invalide (ex: C34.1)' });
  }
  if (data.morphologieIcdo && !/^\d{4}\/\d$/.test(data.morphologieIcdo)) {
    errors.push({ field: 'morphologieIcdo', rule: 'icdo_format', severity: 'error', message: 'Format morphologie ICD-O invalide (ex: 8140/3)' });
  }

  // Rule 7: TNM format
  if (data.stadeTnm && !/^T[0-4X]N[0-3X]M[01X]/.test(data.stadeTnm)) {
    errors.push({ field: 'stadeTnm', rule: 'tnm_format', severity: 'warning', message: 'Format TNM non standard (attendu: T0-4 N0-3 M0-1)' });
  }

  return errors;
}

// ICD-O3 Topography codes for search
export const ICDO3_TOPOGRAPHY = [
  { code: 'C00', label: 'Lèvre' },
  { code: 'C01', label: 'Base de la langue' },
  { code: 'C02', label: 'Autres parties de la langue' },
  { code: 'C03', label: 'Gencive' },
  { code: 'C04', label: 'Plancher buccal' },
  { code: 'C05', label: 'Palais' },
  { code: 'C06', label: 'Autres bouche' },
  { code: 'C07', label: 'Glande parotide' },
  { code: 'C08', label: 'Autres glandes salivaires' },
  { code: 'C09', label: 'Amygdale' },
  { code: 'C10', label: 'Oropharynx' },
  { code: 'C11', label: 'Nasopharynx' },
  { code: 'C12', label: 'Sinus piriforme' },
  { code: 'C13', label: 'Hypopharynx' },
  { code: 'C14', label: 'Autres pharynx' },
  { code: 'C15', label: 'Œsophage' },
  { code: 'C16', label: 'Estomac' },
  { code: 'C17', label: 'Intestin grêle' },
  { code: 'C18', label: 'Côlon' },
  { code: 'C19', label: 'Jonction recto-sigmoïdienne' },
  { code: 'C20', label: 'Rectum' },
  { code: 'C21', label: 'Anus et canal anal' },
  { code: 'C22', label: 'Foie et voies biliaires intrahépatiques' },
  { code: 'C23', label: 'Vésicule biliaire' },
  { code: 'C24', label: 'Autres voies biliaires' },
  { code: 'C25', label: 'Pancréas' },
  { code: 'C30', label: 'Fosses nasales et oreille moyenne' },
  { code: 'C31', label: 'Sinus de la face' },
  { code: 'C32', label: 'Larynx' },
  { code: 'C33', label: 'Trachée' },
  { code: 'C34', label: 'Bronches et poumon' },
  { code: 'C37', label: 'Thymus' },
  { code: 'C38', label: 'Cœur, médiastin et plèvre' },
  { code: 'C40', label: 'Os des membres' },
  { code: 'C41', label: 'Os autres' },
  { code: 'C42', label: 'Système hématopoïétique' },
  { code: 'C44', label: 'Peau' },
  { code: 'C47', label: 'Nerfs périphériques' },
  { code: 'C48', label: 'Rétropéritoine et péritoine' },
  { code: 'C49', label: 'Tissu conjonctif' },
  { code: 'C50', label: 'Sein' },
  { code: 'C51', label: 'Vulve' },
  { code: 'C52', label: 'Vagin' },
  { code: 'C53', label: 'Col de l\'utérus' },
  { code: 'C54', label: 'Corps de l\'utérus' },
  { code: 'C55', label: 'Utérus SAI' },
  { code: 'C56', label: 'Ovaire' },
  { code: 'C57', label: 'Autres organes génitaux féminins' },
  { code: 'C60', label: 'Pénis' },
  { code: 'C61', label: 'Prostate' },
  { code: 'C62', label: 'Testicule' },
  { code: 'C64', label: 'Rein' },
  { code: 'C65', label: 'Bassinet' },
  { code: 'C66', label: 'Uretère' },
  { code: 'C67', label: 'Vessie' },
  { code: 'C68', label: 'Autres organes urinaires' },
  { code: 'C69', label: 'Œil' },
  { code: 'C70', label: 'Méninges' },
  { code: 'C71', label: 'Encéphale' },
  { code: 'C72', label: 'Moelle épinière et autres SNC' },
  { code: 'C73', label: 'Thyroïde' },
  { code: 'C74', label: 'Surrénale' },
  { code: 'C75', label: 'Autres glandes endocrines' },
  { code: 'C76', label: 'Localisations mal définies' },
  { code: 'C77', label: 'Ganglions lymphatiques' },
  { code: 'C80', label: 'Siège primitif inconnu' },
];

export const ICDO3_MORPHOLOGY = [
  { code: '8000/3', label: 'Néoplasme malin SAI' },
  { code: '8010/3', label: 'Carcinome SAI' },
  { code: '8012/3', label: 'Carcinome à grandes cellules' },
  { code: '8020/3', label: 'Carcinome indifférencié' },
  { code: '8041/3', label: 'Carcinome à petites cellules' },
  { code: '8050/3', label: 'Carcinome papillaire' },
  { code: '8070/3', label: 'Carcinome épidermoïde' },
  { code: '8140/3', label: 'Adénocarcinome SAI' },
  { code: '8170/3', label: 'Carcinome hépatocellulaire' },
  { code: '8200/3', label: 'Carcinome adénoïde kystique' },
  { code: '8211/3', label: 'Adénocarcinome tubuleux' },
  { code: '8230/3', label: 'Carcinome solide' },
  { code: '8240/3', label: 'Tumeur carcinoïde' },
  { code: '8260/3', label: 'Adénocarcinome papillaire' },
  { code: '8310/3', label: 'Adénocarcinome à cellules claires' },
  { code: '8312/3', label: 'Carcinome à cellules rénales' },
  { code: '8380/3', label: 'Adénocarcinome endométrioïde' },
  { code: '8440/3', label: 'Cystadénocarcinome séreux' },
  { code: '8480/3', label: 'Adénocarcinome mucineux' },
  { code: '8500/3', label: 'Carcinome canalaire infiltrant' },
  { code: '8520/3', label: 'Carcinome lobulaire' },
  { code: '8720/3', label: 'Mélanome malin' },
  { code: '8800/3', label: 'Sarcome SAI' },
  { code: '8850/3', label: 'Liposarcome' },
  { code: '8890/3', label: 'Léiomyosarcome' },
  { code: '8900/3', label: 'Rhabdomyosarcome' },
  { code: '9380/3', label: 'Gliome SAI' },
  { code: '9440/3', label: 'Glioblastome' },
  { code: '9500/3', label: 'Neuroblastome' },
  { code: '9650/3', label: 'Lymphome de Hodgkin' },
  { code: '9680/3', label: 'Lymphome diffus à grandes cellules B' },
  { code: '9700/3', label: 'Lymphome T' },
  { code: '9732/3', label: 'Myélome multiple' },
  { code: '9800/3', label: 'Leucémie SAI' },
  { code: '9861/3', label: 'Leucémie myéloïde aiguë' },
  { code: '9940/3', label: 'Leucémie myéloïde chronique' },
];

/**
 * CanReg5-compatible CSV export — Full IARC field mapping
 * Produces CSV files importable directly into CanReg5 / IARC tools
 */

export interface CanRegRecord {
  // Patient fields
  patient_id: string;
  code_patient: string;
  nom: string;
  prenom: string;
  sexe: string;
  date_naissance: string | null;
  commune: string | null;
  wilaya: string;
  telephone: string | null;
  num_dossier: string | null;
  // Tumour fields
  case_id: string;
  date_diagnostic: string;
  type_cancer: string;
  sous_type_cancer: string | null;
  topographie_icdo: string | null;
  morphologie_icdo: string | null;
  code_icdo: string | null;
  comportement: string | null;
  grade: string | null;
  lateralite: string | null;
  stade_tnm: string | null;
  methode_diagnostic: string | null;
  base_diagnostic: string | null;
  source_info: string | null;
  resultat_anapath: string | null;
  ref_anapath: string | null;
  medecin_anapath: string | null;
  date_anapath: string | null;
  anomalies_moleculaires: string | null;
  milieu: string | null;
  profession: string | null;
  tabagisme: string | null;
  alcool: string | null;
  sportif: string | null;
  statut: string;
  statut_vital: string | null;
  date_deces: string | null;
  cause_deces: string | null;
  date_derniere_nouvelle: string | null;
  created_at: string;
}

const CANREG5_HEADERS = [
  'RegistrationNumber', 'PatientID', 'FamilyName', 'FirstName',
  'Sex', 'BirthDate', 'Address', 'Wilaya', 'Commune',
  'Phone', 'MedicalRecordNumber',
  'IncidenceDate', 'TopographyICDO3', 'MorphologyICDO3', 'ICDOCode',
  'Behaviour', 'Grade', 'Laterality', 'TNMStage',
  'BasisOfDiagnosis', 'DiagnosticMethod', 'SourceOfInformation',
  'CancerType', 'CancerSubType', 'AnatomicalPathologyResult',
  'AnatomicalPathologyRef', 'AnatomicalPathologist', 'AnatomicalPathologyDate',
  'MolecularAbnormalities', 'Environment', 'Occupation',
  'Tobacco', 'Alcohol', 'PhysicalActivity',
  'Status', 'VitalStatus', 'DateOfDeath', 'CauseOfDeath',
  'DateOfLastContact', 'DateOfRegistration',
];

function escapeCSV(val: string | null | undefined): string {
  if (val == null || val === '') return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function generateCanReg5CSV(records: CanRegRecord[]): string {
  const lines: string[] = [CANREG5_HEADERS.join(',')];

  records.forEach(r => {
    lines.push([
      escapeCSV(r.case_id),
      escapeCSV(r.code_patient),
      escapeCSV(r.nom),
      escapeCSV(r.prenom),
      escapeCSV(r.sexe === 'M' ? '1' : r.sexe === 'F' ? '2' : '9'),
      escapeCSV(r.date_naissance),
      escapeCSV(r.commune),
      escapeCSV(r.wilaya),
      escapeCSV(r.commune),
      escapeCSV(r.telephone),
      escapeCSV(r.num_dossier),
      escapeCSV(r.date_diagnostic),
      escapeCSV(r.topographie_icdo),
      escapeCSV(r.morphologie_icdo),
      escapeCSV(r.code_icdo),
      escapeCSV(r.comportement),
      escapeCSV(r.grade),
      escapeCSV(r.lateralite),
      escapeCSV(r.stade_tnm),
      escapeCSV(r.base_diagnostic),
      escapeCSV(r.methode_diagnostic),
      escapeCSV(r.source_info),
      escapeCSV(r.type_cancer),
      escapeCSV(r.sous_type_cancer),
      escapeCSV(r.resultat_anapath),
      escapeCSV(r.ref_anapath),
      escapeCSV(r.medecin_anapath),
      escapeCSV(r.date_anapath),
      escapeCSV(r.anomalies_moleculaires),
      escapeCSV(r.milieu),
      escapeCSV(r.profession),
      escapeCSV(r.tabagisme),
      escapeCSV(r.alcool),
      escapeCSV(r.sportif),
      escapeCSV(r.statut),
      escapeCSV(r.statut_vital),
      escapeCSV(r.date_deces),
      escapeCSV(r.cause_deces),
      escapeCSV(r.date_derniere_nouvelle),
      escapeCSV(r.created_at?.slice(0, 10)),
    ].join(','));
  });

  return lines.join('\n');
}

export function downloadCSV(content: string, filename: string) {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

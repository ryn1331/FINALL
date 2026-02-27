import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Users, Database, BarChart3, FileText,
} from 'lucide-react';

type ImportType = 'patients' | 'population' | 'cases';

interface ParsedRow {
  [key: string]: string;
}

interface ImportResult {
  success: number;
  errors: string[];
  total: number;
}

const IMPORT_TYPES = [
  {
    id: 'patients' as ImportType,
    label: 'Patients',
    icon: Users,
    description: 'Importer des patients depuis un CSV (nom, prénom, sexe, date_naissance, commune, wilaya, etc.)',
    requiredFields: ['nom', 'prenom', 'sexe'],
    optionalFields: ['date_naissance', 'commune', 'wilaya', 'telephone', 'num_dossier', 'adresse'],
  },
  {
    id: 'population' as ImportType,
    label: 'Population de référence',
    icon: BarChart3,
    description: 'Importer les données de population par tranche d\'âge et sexe pour le calcul des taux standardisés (ASR)',
    requiredFields: ['tranche_age', 'sexe', 'population', 'annee'],
    optionalFields: ['wilaya'],
  },
  {
    id: 'cases' as ImportType,
    label: 'Cas de cancer (CanReg5)',
    icon: Database,
    description: 'Importer des cas depuis un fichier CanReg5 CSV ou format similaire. Les patients doivent exister.',
    requiredFields: ['code_patient', 'type_cancer', 'date_diagnostic'],
    optionalFields: [
      'topographie_icdo', 'morphologie_icdo', 'code_icdo', 'stade_tnm',
      'methode_diagnostic', 'resultat_anapath', 'grade', 'lateralite',
      'milieu', 'profession', 'tabagisme', 'alcool',
    ],
  },
];

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect separator
  const sep = lines[0].includes(';') ? ';' : ',';
  
  const headers = lines[0].split(sep).map(h => 
    h.trim().replace(/^["']|["']$/g, '').toLowerCase()
      .replace(/\s+/g, '_')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
  );

  return lines.slice(1).map(line => {
    const values = line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row: ParsedRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    return row;
  }).filter(row => Object.values(row).some(v => v !== ''));
}

// Map common alternative header names
function normalizeHeader(headers: string[], type: ImportType): Record<string, string> {
  const mapping: Record<string, string[]> = {
    nom: ['nom', 'familyname', 'family_name', 'last_name', 'lastname', 'name'],
    prenom: ['prenom', 'firstname', 'first_name', 'given_name'],
    sexe: ['sexe', 'sex', 'gender', 'genre'],
    date_naissance: ['date_naissance', 'birthdate', 'birth_date', 'dob', 'date_de_naissance'],
    commune: ['commune', 'city', 'ville', 'address_commune'],
    wilaya: ['wilaya', 'state', 'province', 'region'],
    telephone: ['telephone', 'phone', 'tel', 'mobile'],
    num_dossier: ['num_dossier', 'medicalrecordnumber', 'dossier', 'medical_record'],
    tranche_age: ['tranche_age', 'age_group', 'agegroup', 'tranche'],
    population: ['population', 'pop', 'count', 'effectif'],
    annee: ['annee', 'year', 'an'],
    code_patient: ['code_patient', 'patientid', 'patient_id', 'registrationnumber', 'code'],
    type_cancer: ['type_cancer', 'cancertype', 'cancer_type', 'diagnosis', 'tumour_type'],
    date_diagnostic: ['date_diagnostic', 'incidencedate', 'incidence_date', 'diagnosis_date'],
    topographie_icdo: ['topographie_icdo', 'topographyicdo3', 'topography', 'site'],
    morphologie_icdo: ['morphologie_icdo', 'morphologyicdo3', 'morphology', 'histology'],
    code_icdo: ['code_icdo', 'icdocode', 'icdo_code'],
    stade_tnm: ['stade_tnm', 'tnmstage', 'tnm_stage', 'stage', 'stade'],
    methode_diagnostic: ['methode_diagnostic', 'diagnosticmethod', 'basis_of_diagnosis', 'basisofdiagnosis'],
    resultat_anapath: ['resultat_anapath', 'anatomicalpathologyresult', 'pathology_result'],
    grade: ['grade', 'tumour_grade', 'differentiation'],
    lateralite: ['lateralite', 'laterality'],
    milieu: ['milieu', 'environment', 'setting'],
    profession: ['profession', 'occupation', 'job'],
    tabagisme: ['tabagisme', 'tobacco', 'smoking'],
    alcool: ['alcool', 'alcohol'],
  };

  const result: Record<string, string> = {};
  for (const [target, alternatives] of Object.entries(mapping)) {
    for (const alt of alternatives) {
      const found = headers.find(h => h === alt);
      if (found) {
        result[found] = target;
        break;
      }
    }
  }
  return result;
}

export default function DataImport() {
  const { user } = useAuth();
  const [importType, setImportType] = useState<ImportType>('patients');
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typeConfig = IMPORT_TYPES.find(t => t.id === importType)!;

  const handleFile = useCallback((file: File) => {
    setResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setParsedData(rows);

      if (rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const mapping = normalizeHeader(headers, importType);
        setHeaderMapping(mapping);
        toast.success(`${rows.length} lignes détectées dans ${file.name}`);
      } else {
        toast.warning('Fichier vide ou format non reconnu');
      }
    };
    reader.readAsText(file);
  }, [importType]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleImport = async () => {
    if (!user || parsedData.length === 0) return;
    setImporting(true);
    const errors: string[] = [];
    let success = 0;

    try {
      if (importType === 'patients') {
        for (let i = 0; i < parsedData.length; i++) {
          const row = parsedData[i];
          const mapped: Record<string, string> = {};
          for (const [src, target] of Object.entries(headerMapping)) {
            mapped[target] = row[src] || '';
          }
          // Also include unmapped fields that match directly
          for (const key of Object.keys(row)) {
            if (!mapped[key] && ['nom', 'prenom', 'sexe', 'date_naissance', 'commune', 'wilaya', 'telephone', 'num_dossier'].includes(key)) {
              mapped[key] = row[key];
            }
          }

          if (!mapped.nom || !mapped.prenom || !mapped.sexe) {
            errors.push(`Ligne ${i + 2}: champs requis manquants (nom, prénom, sexe)`);
            continue;
          }

          const code = mapped.num_dossier || `IMP-${Date.now().toString(36).toUpperCase()}-${i}`;
          const sexe = mapped.sexe.toUpperCase().startsWith('M') ? 'M' : mapped.sexe.toUpperCase().startsWith('F') ? 'F' : mapped.sexe;

          const { error } = await supabase.from('patients').insert({
            code_patient: code,
            nom: mapped.nom.toUpperCase(),
            prenom: mapped.prenom,
            sexe,
            date_naissance: mapped.date_naissance || null,
            commune: mapped.commune || null,
            wilaya: mapped.wilaya || 'Tlemcen',
            telephone: mapped.telephone || null,
            num_dossier: mapped.num_dossier || null,
            created_by: user.id,
          });

          if (error) errors.push(`Ligne ${i + 2}: ${error.message}`);
          else success++;
        }
      } else if (importType === 'population') {
        for (let i = 0; i < parsedData.length; i++) {
          const row = parsedData[i];
          const mapped: Record<string, string> = {};
          for (const [src, target] of Object.entries(headerMapping)) {
            mapped[target] = row[src] || '';
          }
          for (const key of Object.keys(row)) {
            if (!mapped[key] && ['tranche_age', 'sexe', 'population', 'annee', 'wilaya'].includes(key)) {
              mapped[key] = row[key];
            }
          }

          if (!mapped.tranche_age || !mapped.sexe || !mapped.population || !mapped.annee) {
            errors.push(`Ligne ${i + 2}: champs requis manquants`);
            continue;
          }

          const { error } = await supabase.from('population_reference').insert({
            tranche_age: mapped.tranche_age,
            sexe: mapped.sexe.toUpperCase().startsWith('M') ? 'M' : 'F',
            population: parseInt(mapped.population) || 0,
            annee: parseInt(mapped.annee) || new Date().getFullYear(),
            wilaya: mapped.wilaya || 'Tlemcen',
          });

          if (error) errors.push(`Ligne ${i + 2}: ${error.message}`);
          else success++;
        }
      } else if (importType === 'cases') {
        for (let i = 0; i < parsedData.length; i++) {
          const row = parsedData[i];
          const mapped: Record<string, string> = {};
          for (const [src, target] of Object.entries(headerMapping)) {
            mapped[target] = row[src] || '';
          }
          for (const key of Object.keys(row)) {
            if (!mapped[key]) mapped[key] = row[key];
          }

          if (!mapped.code_patient || !mapped.type_cancer || !mapped.date_diagnostic) {
            errors.push(`Ligne ${i + 2}: champs requis manquants (code_patient, type_cancer, date_diagnostic)`);
            continue;
          }

          // Find patient
          const { data: patient } = await supabase
            .from('patients')
            .select('id')
            .eq('code_patient', mapped.code_patient)
            .maybeSingle();

          if (!patient) {
            errors.push(`Ligne ${i + 2}: patient ${mapped.code_patient} introuvable`);
            continue;
          }

          const { error } = await supabase.from('cancer_cases').insert({
            patient_id: patient.id,
            type_cancer: mapped.type_cancer,
            date_diagnostic: mapped.date_diagnostic,
            topographie_icdo: mapped.topographie_icdo || null,
            morphologie_icdo: mapped.morphologie_icdo || null,
            code_icdo: mapped.code_icdo || null,
            stade_tnm: mapped.stade_tnm || null,
            methode_diagnostic: mapped.methode_diagnostic || 'histologie',
            resultat_anapath: mapped.resultat_anapath || null,
            grade: mapped.grade || null,
            lateralite: mapped.lateralite || null,
            milieu: mapped.milieu || null,
            profession: mapped.profession || null,
            tabagisme: mapped.tabagisme || null,
            alcool: mapped.alcool || null,
            created_by: user.id,
          });

          if (error) errors.push(`Ligne ${i + 2}: ${error.message}`);
          else success++;
        }
      }

      setResult({ success, errors, total: parsedData.length });
      if (success > 0) toast.success(`${success}/${parsedData.length} enregistrements importés`);
      if (errors.length > 0) toast.warning(`${errors.length} erreurs détectées`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur import');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setParsedData([]);
    setHeaderMapping({});
    setFileName('');
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Import type selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {IMPORT_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => { setImportType(t.id); reset(); }}
            className={cn(
              'stat-card !p-4 text-left transition-all hover:shadow-md',
              importType === t.id && 'ring-2 ring-primary'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <t.icon size={18} className={importType === t.id ? 'text-primary' : 'text-muted-foreground'} />
              <span className="font-semibold text-sm">{t.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload zone */}
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Upload size={18} className="text-primary" />
            Charger un fichier CSV
          </h3>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              dragOver ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40',
            )}
          >
            <input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <FileSpreadsheet size={36} className="mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium text-sm">
              {fileName || 'Glissez un fichier CSV ici'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              CSV, TSV · Séparateur virgule ou point-virgule · UTF-8
            </p>
          </div>

          {/* Required fields info */}
          <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
            <p className="font-medium">Champs requis :</p>
            <div className="flex flex-wrap gap-1">
              {typeConfig.requiredFields.map(f => (
                <Badge key={f} variant="destructive" className="text-[10px]">{f}</Badge>
              ))}
            </div>
            <p className="font-medium mt-2">Champs optionnels :</p>
            <div className="flex flex-wrap gap-1">
              {typeConfig.optionalFields.map(f => (
                <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Preview & mapping */}
        <div className="stat-card space-y-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Database size={18} className="text-primary" />
            Aperçu des données
            {parsedData.length > 0 && (
              <Badge variant="secondary">{parsedData.length} lignes</Badge>
            )}
          </h3>

          {parsedData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Chargez un fichier pour voir l'aperçu</p>
            </div>
          ) : (
            <>
              {/* Column mapping info */}
              <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1">
                <p className="font-medium">Colonnes détectées → Champ cible :</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(headerMapping).map(([src, target]) => (
                    <Badge key={src} className="text-[10px] bg-primary/10 text-primary">
                      {src} → {target}
                    </Badge>
                  ))}
                </div>
                {Object.keys(parsedData[0]).filter(k => !headerMapping[k]).length > 0 && (
                  <>
                    <p className="font-medium mt-1 text-warning">Non mappées :</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(parsedData[0]).filter(k => !headerMapping[k]).map(k => (
                        <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Data preview */}
              <div className="overflow-auto max-h-48 rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-2 py-1 text-left">#</th>
                      {Object.keys(parsedData[0]).slice(0, 6).map(h => (
                        <th key={h} className="px-2 py-1 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-border/30">
                        <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                        {Object.values(row).slice(0, 6).map((v, j) => (
                          <td key={j} className="px-2 py-1 truncate max-w-[120px]">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 5 && (
                  <p className="text-center text-[10px] text-muted-foreground py-1">
                    +{parsedData.length - 5} lignes supplémentaires
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={importing} className="flex-1">
                  {importing ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Upload size={14} className="mr-1.5" />}
                  Importer {parsedData.length} enregistrements
                </Button>
                <Button variant="outline" onClick={reset}>Réinitialiser</Button>
              </div>

              {/* Results */}
              {result && (
                <div className={cn(
                  'rounded-lg p-4 space-y-2',
                  result.errors.length === 0 ? 'bg-success/10 border border-success/20' : 'bg-warning/10 border border-warning/20'
                )}>
                  <div className="flex items-center gap-2">
                    {result.errors.length === 0 ? (
                      <CheckCircle2 size={18} className="text-success" />
                    ) : (
                      <AlertTriangle size={18} className="text-warning" />
                    )}
                    <span className="font-semibold text-sm">
                      {result.success}/{result.total} importés avec succès
                    </span>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="max-h-32 overflow-auto space-y-0.5">
                      {result.errors.slice(0, 10).map((err, i) => (
                        <p key={i} className="text-xs text-destructive flex items-center gap-1">
                          <XCircle size={10} /> {err}
                        </p>
                      ))}
                      {result.errors.length > 10 && (
                        <p className="text-xs text-muted-foreground">+{result.errors.length - 10} autres erreurs</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Loader2, AlertTriangle, User, Stethoscope, FlaskConical, HeartPulse,
  FileText, MapPin, Microscope, Activity, Shield, Search, CheckCircle2, XCircle, FolderOpen,
  ChevronLeft, ChevronRight, Save, ArrowRight, Scan, Film, Radio, Image,
  FileSpreadsheet, FileCheck, Camera, ShieldCheck, ClipboardList, Upload, X, Plus, Settings2,
} from 'lucide-react';
import GlobalVoiceButton from '@/components/GlobalVoiceButton';
import PatientFileUpload from '@/components/PatientFileUpload';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { validateCase, ICDO3_TOPOGRAPHY, ICDO3_MORPHOLOGY } from '@/lib/iacr-validation';

const CANCER_TYPES = [
  'Poumon', 'Colorectal', 'Sein', 'Prostate', 'Vessie', 'Estomac',
  'Foie', 'Pancréas', 'Rein', 'Thyroïde', 'Leucémie', 'Lymphome',
  'Mélanome', 'Col utérin', 'Ovaire', 'Cavité buccale', 'Larynx',
  'Œsophage', 'Cerveau/SNC', 'Sarcome', 'Myélome', 'Autre',
];

import { WILAYAS_ALGERIE, COMMUNES_TLEMCEN } from '@/lib/wilayas';

const METHODES_DIAGNOSTIC = [
  { value: 'histologie', label: 'Histologie' },
  { value: 'cytologie', label: 'Cytologie' },
  { value: 'clinique', label: 'Clinique seule' },
  { value: 'imagerie', label: 'Imagerie' },
  { value: 'biochimie', label: 'Marqueurs biochimiques' },
  { value: 'dco', label: 'Certificat de décès (DCO)' },
];

const GRADES = ['G1 — Bien différencié', 'G2 — Moyennement différencié', 'G3 — Peu différencié', 'G4 — Indifférencié', 'GX — Non évalué'];
const LATERALITES = ['Non applicable', 'Droite', 'Gauche', 'Bilatéral'];

const DOC_TYPES_PREVIEW = [
  { value: 'irm', label: 'IRM', icon: Scan, color: 'text-purple-500 bg-purple-500/10' },
  { value: 'scanner', label: 'Scanner / TDM', icon: Film, color: 'text-indigo-500 bg-indigo-500/10' },
  { value: 'pet_scan', label: 'PET Scan', icon: HeartPulse, color: 'text-pink-500 bg-pink-500/10' },
  { value: 'radio', label: 'Radiographie', icon: Radio, color: 'text-sky-500 bg-sky-500/10' },
  { value: 'echographie', label: 'Échographie', icon: Scan, color: 'text-cyan-500 bg-cyan-500/10' },
  { value: 'mammographie', label: 'Mammographie', icon: Image, color: 'text-rose-400 bg-rose-400/10' },
  { value: 'scintigraphie', label: 'Scintigraphie', icon: HeartPulse, color: 'text-amber-500 bg-amber-500/10' },
  { value: 'biopsie', label: 'Biopsie', icon: Microscope, color: 'text-blue-500 bg-blue-500/10' },
  { value: 'anapath', label: 'Anapath', icon: FileCheck, color: 'text-emerald-500 bg-emerald-500/10' },
  { value: 'biologie', label: 'Bilan Sanguin', icon: FileSpreadsheet, color: 'text-orange-500 bg-orange-500/10' },
  { value: 'compte_rendu', label: 'Compte-rendu', icon: ClipboardList, color: 'text-teal-500 bg-teal-500/10' },
  { value: 'consentement', label: 'Consentement', icon: ShieldCheck, color: 'text-rose-500 bg-rose-500/10' },
  { value: 'ordonnance', label: 'Ordonnance', icon: FileText, color: 'text-violet-500 bg-violet-500/10' },
  { value: 'photo', label: 'Photo clinique', icon: Camera, color: 'text-lime-600 bg-lime-600/10' },
  { value: 'autre', label: 'Autre', icon: FileText, color: 'text-muted-foreground bg-muted' },
];

const STEPS = [
  { id: 'identite', label: 'Identité', shortLabel: 'ID', icon: User },
  { id: 'epidemio', label: 'Épidémiologie', shortLabel: 'Épid', icon: MapPin },
  { id: 'diagnostic', label: 'Diagnostic', shortLabel: 'Diag', icon: Stethoscope },
  { id: 'topographie', label: 'Topographie', shortLabel: 'Topo', icon: Search },
  { id: 'morphologie', label: 'Morphologie', shortLabel: 'Morpho', icon: Microscope },
  { id: 'stade', label: 'Stade', shortLabel: 'TNM', icon: Shield },
  { id: 'traitement', label: 'Traitement', shortLabel: 'Trait', icon: FlaskConical },
  { id: 'suivi', label: 'Suivi', shortLabel: 'Suivi', icon: Activity },
  { id: 'documents', label: 'Documents', shortLabel: 'Docs', icon: FolderOpen },
];

// FieldGroup défini EN DEHORS de NewCase pour éviter le remontage à chaque frappe
function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-1.5', className)}>{children}</div>;
}

interface CustomField {
  id: string;
  label: string;
  field_key: string;
  field_type: string;
  step_id: string;
  options: string[] | null;
  required: boolean;
  active: boolean;
  sort_order: number;
}

export default function NewCase() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [topoSearch, setTopoSearch] = useState('');
  const [morphoSearch, setMorphoSearch] = useState('');
  const [savedPatientId, setSavedPatientId] = useState<string | null>(null);
  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);

  // Custom fields from admin
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchCustomFields = async () => {
      const { data } = await supabase.from('custom_fields').select('*').eq('active', true).order('sort_order');
      if (data) setCustomFields(data as CustomField[]);
    };
    fetchCustomFields();
  }, []);

  const updateCustomField = useCallback((fieldKey: string, value: string) => {
    setCustomFieldValues(prev => ({ ...prev, [fieldKey]: value }));
  }, []);

  const fieldsForStep = useCallback((stepId: string) => {
    return customFields.filter(f => f.step_id === stepId);
  }, [customFields]);

  // Pending documents (before patient is saved)
  const [pendingDocs, setPendingDocs] = useState<Array<{ file: File; docType: string }>>([]);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [docTypeForUpload, setDocTypeForUpload] = useState('');

  const addPendingFiles = useCallback((fileList: FileList | File[], docType: string) => {
    const arr = Array.from(fileList);
    const newDocs = arr.filter(f => f.size <= 20 * 1024 * 1024).map(f => ({ file: f, docType }));
    const oversized = arr.filter(f => f.size > 20 * 1024 * 1024);
    if (oversized.length) toast.error(`${oversized.length} fichier(s) > 20 MB ignoré(s)`);
    setPendingDocs(prev => [...prev, ...newDocs]);
  }, []);

  const removePendingDoc = useCallback((index: number) => {
    setPendingDocs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const uploadPendingDocs = useCallback(async (patientId: string, caseId: string | null) => {
    if (pendingDocs.length === 0 || !user) return;
    let count = 0;
    for (const { file, docType } of pendingDocs) {
      const storagePath = `${patientId}/${docType}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('patient-files').upload(storagePath, file);
      if (upErr) { toast.error(`Erreur upload ${file.name}`); continue; }
      const { error: dbErr } = await supabase.from('patient_files').insert({
        patient_id: patientId, case_id: caseId || null,
        file_name: file.name, file_path: storagePath,
        file_type: docType, file_size: file.size,
        mime_type: file.type, uploaded_by: user.id,
      });
      if (dbErr) toast.error(`Erreur DB ${file.name}`);
      else count++;
    }
    if (count > 0) toast.success(`${count} document(s) uploadé(s)`);
    setPendingDocs([]);
  }, [pendingDocs, user]);

  const [form, setForm] = useState({
    nom: '', prenom: '', dateNaissance: '', sexe: '', telephone: '', numDossier: '',
    wilaya: 'Tlemcen', commune: '', milieu: 'urbain', profession: '',
    methodeDiagnostic: 'histologie', dateDiagnostic: '', typeCancer: '', sourceInfo: '', baseDiagnostic: '',
    topographieIcdo: '', codeIcdo: '', lateralite: '',
    morphologieIcdo: '', comportement: '', sousTypeCancer: '', grade: '',
    stadeTnm: '', stadeChiffre: '', anomaliesMoleculaires: '',
    medecinAnapath: '', dateAnapath: '', refAnapath: '', resultatAnapath: '',
    biologieFns: '', biologieGlobules: '', biologieDate: '',
    tabagisme: 'non', tabagismeAnnees: '', alcool: 'non', sportif: 'non',
    symptomes: '', notes: '',
    dateDeces: '', causeDeces: '', dateDerniereNouvelle: '', statutVital: 'vivant',
  });

  const update = useCallback((key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const handleVoiceFields = useCallback((fields: Record<string, string>) => {
    setForm(f => {
      const updated = { ...f };
      for (const [key, value] of Object.entries(fields)) {
        if (key in updated && value) {
          if (['symptomes', 'notes', 'resultatAnapath'].includes(key)) {
            updated[key as keyof typeof updated] = updated[key as keyof typeof updated]
              ? updated[key as keyof typeof updated] + ' ' + value : value;
          } else if (!updated[key as keyof typeof updated]) {
            updated[key as keyof typeof updated] = value;
          }
        }
      }
      return updated;
    });
  }, []);

  const validationErrors = useMemo(() => validateCase({
    nom: form.nom, prenom: form.prenom, dateNaissance: form.dateNaissance,
    sexe: form.sexe, dateDiagnostic: form.dateDiagnostic, typeCancer: form.typeCancer,
    topographieIcdo: form.topographieIcdo, morphologieIcdo: form.morphologieIcdo,
    codeIcdo: form.codeIcdo, stadeTnm: form.stadeTnm, resultatAnapath: form.resultatAnapath,
    methodeDiagnostic: form.methodeDiagnostic,
  }), [form]);

  const errorCount = validationErrors.filter(e => e.severity === 'error').length;
  const warningCount = validationErrors.filter(e => e.severity === 'warning').length;

  const checkDuplicate = async () => {
    if (!form.nom || !form.prenom || !form.dateNaissance) return;
    const { data } = await supabase.from('patients').select('id')
      .ilike('nom', form.nom).ilike('prenom', form.prenom).eq('date_naissance', form.dateNaissance);
    setDuplicateWarning(!!data && data.length > 0);
  };

  const filteredTopo = topoSearch.length >= 1
    ? ICDO3_TOPOGRAPHY.filter(t => t.code.toLowerCase().includes(topoSearch.toLowerCase()) || t.label.toLowerCase().includes(topoSearch.toLowerCase()))
    : ICDO3_TOPOGRAPHY;

  const filteredMorpho = morphoSearch.length >= 1
    ? ICDO3_MORPHOLOGY.filter(m => m.code.includes(morphoSearch) || m.label.toLowerCase().includes(morphoSearch.toLowerCase()))
    : ICDO3_MORPHOLOGY;

  const handleSubmit = async () => {
    if (!user) return;
    // Only nom and prenom are truly required to save
    if (!form.nom.trim() || !form.prenom.trim()) {
      toast.error('Le nom et prénom du patient sont obligatoires');
      return;
    }

    setLoading(true);
    try {
      const code = form.numDossier || `P-${Date.now().toString(36).toUpperCase()}`;
      const { data: patient, error: patientErr } = await supabase.from('patients').insert({
        code_patient: code, nom: form.nom, prenom: form.prenom,
        date_naissance: form.dateNaissance || null, sexe: form.sexe || null,
        commune: form.commune || null, telephone: form.telephone || null,
        num_dossier: form.numDossier || null, wilaya: form.wilaya || 'Tlemcen', created_by: user.id,
      }).select().single();
      if (patientErr) throw patientErr;

      const tabagismeVal = form.tabagisme === 'oui' && form.tabagismeAnnees
        ? `Oui (${form.tabagismeAnnees} ans)` : form.tabagisme;

      const { data: caseData, error: caseErr } = await supabase.from('cancer_cases').insert({
        patient_id: patient.id, type_cancer: form.typeCancer || null,
        sous_type_cancer: form.sousTypeCancer || null, code_icdo: form.codeIcdo || null,
        topographie_icdo: form.topographieIcdo || null, morphologie_icdo: form.morphologieIcdo || null,
        comportement: form.comportement || null, grade: form.grade || null,
        lateralite: form.lateralite || null, methode_diagnostic: form.methodeDiagnostic,
        milieu: form.milieu, profession: form.profession || null,
        base_diagnostic: form.baseDiagnostic || null, source_info: form.sourceInfo || null,
        stade_tnm: form.stadeTnm || null, anomalies_moleculaires: form.anomaliesMoleculaires || null,
        date_diagnostic: form.dateDiagnostic || null, medecin_anapath: form.medecinAnapath || null,
        date_anapath: form.dateAnapath || null, ref_anapath: form.refAnapath || null,
        resultat_anapath: form.resultatAnapath || null, biologie_fns: form.biologieFns || null,
        biologie_globules: form.biologieGlobules || null, biologie_date: form.biologieDate || null,
        tabagisme: tabagismeVal, alcool: form.alcool, sportif: form.sportif,
        symptomes: form.symptomes || null, notes: form.notes || null,
        date_deces: form.dateDeces || null, cause_deces: form.causeDeces || null,
        date_derniere_nouvelle: form.dateDerniereNouvelle || null,
        statut_vital: form.statutVital, created_by: user.id,
      }).select('id').single();
      if (caseErr) throw caseErr;

      setSavedPatientId(patient.id);
      setSavedCaseId(caseData?.id || null);

      // Save custom field values
      if (caseData?.id) {
        const entries = Object.entries(customFieldValues).filter(([, v]) => v.trim());
        if (entries.length > 0) {
          const fieldMap: Record<string, string> = {};
          customFields.forEach(f => { fieldMap[f.field_key] = f.id; });
          const rows = entries
            .filter(([key]) => fieldMap[key])
            .map(([key, value]) => ({ case_id: caseData.id, field_id: fieldMap[key], value }));
          if (rows.length > 0) {
            await supabase.from('custom_field_values').upsert(rows, { onConflict: 'case_id,field_id' });
          }
        }
      }

      // Auto-upload pending documents
      if (pendingDocs.length > 0) {
        await uploadPendingDocs(patient.id, caseData?.id || null);
      }

      toast.success('✅ Cas enregistré');
      setCurrentStep(8); // Documents step
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const stepId = STEPS[currentStep].id;
  const isLastFormStep = currentStep === 7; // suivi
  const isDocStep = currentStep === 8;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-4">
          <h1 className="font-display text-lg md:text-xl font-bold">Nouveau Cas</h1>
          <p className="text-muted-foreground text-xs">Registre du Cancer · Standard IARC/OMS</p>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-primary">
              Étape {currentStep + 1}/{STEPS.length} — {STEPS[currentStep].label}
            </span>
            <div className="flex items-center gap-1.5">
              {errorCount === 0 && form.nom && form.prenom && (
                <Badge className="bg-success/10 text-success border-success/20 text-[10px] h-5 gap-0.5">
                  <CheckCircle2 size={10} /> OK
                </Badge>
              )}
            </div>
          </div>
          {/* Step dots */}
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(i)}
                className={cn(
                  'flex-1 h-1.5 rounded-full transition-all duration-300',
                  i < currentStep ? 'bg-primary' :
                  i === currentStep ? 'bg-primary shadow-sm shadow-primary/30' :
                  'bg-border'
                )}
              />
            ))}
          </div>
          {/* Step icons row - scrollable on mobile */}
          <div className="flex gap-0.5 mt-2 overflow-x-auto no-scrollbar">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(i)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-[3.2rem] shrink-0',
                  i === currentStep ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'
                )}
              >
                <s.icon size={14} />
                <span className="text-[9px] font-medium leading-none">{s.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30 text-warning mb-4">
            <AlertTriangle size={16} />
            <span className="text-xs font-medium">Doublon suspect — Un patient similaire existe déjà.</span>
          </div>
        )}

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={stepId}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="stat-card space-y-4"
          >
            {/* Step 1: Identité */}
            {stepId === 'identite' && (
              <>
                <StepHeader icon={User} title="Identité Patient" />
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup><Label>Nom *</Label><Input value={form.nom} onChange={e => update('nom', e.target.value)} onBlur={checkDuplicate} required placeholder="NOM" /></FieldGroup>
                    <FieldGroup><Label>Prénom *</Label><Input value={form.prenom} onChange={e => update('prenom', e.target.value)} onBlur={checkDuplicate} required placeholder="Prénom" /></FieldGroup>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup><Label>Date de naissance</Label><Input type="date" value={form.dateNaissance} onChange={e => update('dateNaissance', e.target.value)} onBlur={checkDuplicate} /></FieldGroup>
                    <FieldGroup>
                      <Label>Sexe *</Label>
                      <Select value={form.sexe} onValueChange={v => update('sexe', v)}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculin</SelectItem>
                          <SelectItem value="F">Féminin</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup><Label>N° Dossier</Label><Input value={form.numDossier} onChange={e => update('numDossier', e.target.value)} placeholder="DOS-2026-001" /></FieldGroup>
                    <FieldGroup><Label>Téléphone</Label><Input value={form.telephone} onChange={e => update('telephone', e.target.value)} placeholder="05XX XX XX XX" /></FieldGroup>
                  </div>
                </div>
                <CustomFieldsBlock fields={fieldsForStep('identite')} values={customFieldValues} onChange={updateCustomField} />
              </>
            )}

            {/* Step 2: Épidémiologie */}
            {stepId === 'epidemio' && (
              <>
                <StepHeader icon={MapPin} title="Épidémiologie" />
                <div className="grid grid-cols-1 gap-3">
                  <FieldGroup>
                    <Label>Wilaya *</Label>
                    <Select value={form.wilaya} onValueChange={v => { update('wilaya', v); update('commune', ''); }}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner la wilaya" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {WILAYAS_ALGERIE.map(w => (
                          <SelectItem key={w.code} value={w.name}>{w.code} — {w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup>
                      <Label>Commune</Label>
                      {form.wilaya === 'Tlemcen' ? (
                        <Select value={form.commune} onValueChange={v => update('commune', v)}>
                          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                          <SelectContent className="max-h-60">{COMMUNES_TLEMCEN.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input value={form.commune} onChange={e => update('commune', e.target.value)} placeholder="Saisir la commune" />
                      )}
                    </FieldGroup>
                    <FieldGroup>
                      <Label>Milieu</Label>
                      <Select value={form.milieu} onValueChange={v => update('milieu', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urbain">Urbain</SelectItem>
                          <SelectItem value="rural">Rural</SelectItem>
                          <SelectItem value="semi-urbain">Semi-urbain</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                  </div>
                  <FieldGroup><Label>Profession</Label><Input value={form.profession} onChange={e => update('profession', e.target.value)} placeholder="Ex: Agriculteur, Enseignant..." /></FieldGroup>
                </div>
                <CustomFieldsBlock fields={fieldsForStep('epidemio')} values={customFieldValues} onChange={updateCustomField} />
              </>
            )}

            {/* Step 3: Diagnostic */}
            {stepId === 'diagnostic' && (
              <>
                <StepHeader icon={Stethoscope} title="Diagnostic" />
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup>
                      <Label>Méthode *</Label>
                      <Select value={form.methodeDiagnostic} onValueChange={v => update('methodeDiagnostic', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{METHODES_DIAGNOSTIC.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </FieldGroup>
                    <FieldGroup><Label>Date diagnostic *</Label><Input type="date" value={form.dateDiagnostic} onChange={e => update('dateDiagnostic', e.target.value)} required /></FieldGroup>
                  </div>
                  <FieldGroup>
                    <Label>Type de cancer *</Label>
                    <Select value={form.typeCancer} onValueChange={v => update('typeCancer', v)}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>{CANCER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </FieldGroup>
                  <FieldGroup><Label>Source d'information</Label><Input value={form.sourceInfo} onChange={e => update('sourceInfo', e.target.value)} placeholder="Hôpital, laboratoire..." /></FieldGroup>
                  <FieldGroup><Label>Base du diagnostic</Label><Input value={form.baseDiagnostic} onChange={e => update('baseDiagnostic', e.target.value)} placeholder="Histologie tumeur primitive..." /></FieldGroup>
                </div>
                <CustomFieldsBlock fields={fieldsForStep('diagnostic')} values={customFieldValues} onChange={updateCustomField} />
              </>
            )}

            {/* Step 4: Topographie */}
            {stepId === 'topographie' && (
              <>
                <StepHeader icon={Search} title="Topographie ICD-O3" />
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={topoSearch} onChange={e => setTopoSearch(e.target.value)} placeholder="Rechercher (poumon, C34)..." className="pl-9" />
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border/40 divide-y divide-border/30">
                    {filteredTopo.slice(0, 20).map(t => (
                      <button key={t.code} type="button"
                        className={cn('w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 transition-colors flex items-center justify-between',
                          form.topographieIcdo === t.code && 'bg-primary/10 font-medium'
                        )}
                        onClick={() => { update('topographieIcdo', t.code); update('codeIcdo', t.code); }}
                      >
                        <span className="text-xs">{t.label}</span>
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0 ml-2">{t.code}</Badge>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup><Label>Code topographie</Label><Input value={form.topographieIcdo} onChange={e => update('topographieIcdo', e.target.value)} placeholder="C34.1" className="font-mono" /></FieldGroup>
                    <FieldGroup>
                      <Label>Latéralité</Label>
                      <Select value={form.lateralite} onValueChange={v => update('lateralite', v)}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>{LATERALITES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </FieldGroup>
                  </div>
                </div>
                <CustomFieldsBlock fields={fieldsForStep('topographie')} values={customFieldValues} onChange={updateCustomField} />
              </>
            )}

            {/* Step 5: Morphologie */}
            {stepId === 'morphologie' && (
              <>
                <StepHeader icon={Microscope} title="Morphologie ICD-O3" />
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={morphoSearch} onChange={e => setMorphoSearch(e.target.value)} placeholder="Rechercher (adénocarcinome, 8140)..." className="pl-9" />
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border/40 divide-y divide-border/30">
                    {filteredMorpho.slice(0, 20).map(m => (
                      <button key={m.code} type="button"
                        className={cn('w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 transition-colors flex items-center justify-between',
                          form.morphologieIcdo === m.code && 'bg-primary/10 font-medium'
                        )}
                        onClick={() => { update('morphologieIcdo', m.code); update('sousTypeCancer', m.label); }}
                      >
                        <span className="text-xs">{m.label}</span>
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0 ml-2">{m.code}</Badge>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FieldGroup><Label>Code morphologie</Label><Input value={form.morphologieIcdo} onChange={e => update('morphologieIcdo', e.target.value)} placeholder="8140/3" className="font-mono" /></FieldGroup>
                      <FieldGroup>
                        <Label>Grade</Label>
                        <Select value={form.grade} onValueChange={v => update('grade', v)}>
                          <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                          <SelectContent>{GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                        </Select>
                      </FieldGroup>
                    </div>
                    <FieldGroup><Label>Sous-type histologique</Label><Input value={form.sousTypeCancer} onChange={e => update('sousTypeCancer', e.target.value)} placeholder="Adénocarcinome" /></FieldGroup>
                  </div>
                </div>
                <CustomFieldsBlock fields={fieldsForStep('morphologie')} values={customFieldValues} onChange={updateCustomField} />
              </>
            )}

            {/* Step 6: Stade */}
            {stepId === 'stade' && (
              <>
                <StepHeader icon={Shield} title="Stadification TNM" />
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup><Label>Stade TNM</Label><Input value={form.stadeTnm} onChange={e => update('stadeTnm', e.target.value)} placeholder="T2N1M0" className="font-mono" /></FieldGroup>
                    <FieldGroup>
                      <Label>Stade clinique</Label>
                      <Select value={form.stadeChiffre} onValueChange={v => update('stadeChiffre', v)}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>
                          {['I', 'IA', 'IB', 'II', 'IIA', 'IIB', 'III', 'IIIA', 'IIIB', 'IIIC', 'IV', 'IVA', 'IVB'].map(s =>
                            <SelectItem key={s} value={s}>Stade {s}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                  </div>
                  <FieldGroup><Label>Anomalies moléculaires</Label><Input value={form.anomaliesMoleculaires} onChange={e => update('anomaliesMoleculaires', e.target.value)} placeholder="EGFR, ALK, KRAS, HER2, BRCA..." /></FieldGroup>
                </div>
                <CustomFieldsBlock fields={fieldsForStep('stade')} values={customFieldValues} onChange={updateCustomField} />
              </>
            )}

            {/* Step 7: Traitement / Anapath / Biologie */}
            {stepId === 'traitement' && (
              <>
                <StepHeader icon={FlaskConical} title="Anatomopathologie & Biologie" />
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup><Label>Médecin pathologiste</Label><Input value={form.medecinAnapath} onChange={e => update('medecinAnapath', e.target.value)} placeholder="Dr..." /></FieldGroup>
                    <FieldGroup><Label>Date anapath</Label><Input type="date" value={form.dateAnapath} onChange={e => update('dateAnapath', e.target.value)} /></FieldGroup>
                  </div>
                  <FieldGroup><Label>Référence</Label><Input value={form.refAnapath} onChange={e => update('refAnapath', e.target.value)} placeholder="AP-2026-XXX" /></FieldGroup>
                  <FieldGroup><Label>Résultat histologique</Label><Textarea value={form.resultatAnapath} onChange={e => update('resultatAnapath', e.target.value)} rows={3} placeholder="Description macro et microscopique..." /></FieldGroup>

                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Biologie</p>
                    <div className="grid grid-cols-3 gap-2">
                      <FieldGroup><Label className="text-[11px]">FNS</Label><Input value={form.biologieFns} onChange={e => update('biologieFns', e.target.value)} className="h-9 text-xs" /></FieldGroup>
                      <FieldGroup><Label className="text-[11px]">Globules</Label><Input value={form.biologieGlobules} onChange={e => update('biologieGlobules', e.target.value)} className="h-9 text-xs" /></FieldGroup>
                      <FieldGroup><Label className="text-[11px]">Date</Label><Input type="date" value={form.biologieDate} onChange={e => update('biologieDate', e.target.value)} className="h-9 text-xs" /></FieldGroup>
                    </div>
                  </div>
                </div>
                <CustomFieldsBlock fields={fieldsForStep('traitement')} values={customFieldValues} onChange={updateCustomField} />
              </>
            )}

            {/* Step 8: Suivi */}
            {stepId === 'suivi' && (
              <>
                <StepHeader icon={Activity} title="Suivi & Mode de Vie" />
                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup>
                      <Label>Statut vital</Label>
                      <Select value={form.statutVital} onValueChange={v => update('statutVital', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vivant">Vivant</SelectItem>
                          <SelectItem value="decede">Décédé</SelectItem>
                          <SelectItem value="perdu_de_vue">Perdu de vue</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                    <FieldGroup><Label>Dernière nouvelle</Label><Input type="date" value={form.dateDerniereNouvelle} onChange={e => update('dateDerniereNouvelle', e.target.value)} /></FieldGroup>
                  </div>
                  {form.statutVital === 'decede' && (
                    <div className="grid grid-cols-2 gap-3">
                      <FieldGroup><Label>Date décès</Label><Input type="date" value={form.dateDeces} onChange={e => update('dateDeces', e.target.value)} /></FieldGroup>
                      <FieldGroup><Label>Cause</Label><Input value={form.causeDeces} onChange={e => update('causeDeces', e.target.value)} /></FieldGroup>
                    </div>
                  )}

                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Mode de vie</p>
                    <div className="grid grid-cols-3 gap-2">
                      <FieldGroup>
                        <Label className="text-[11px]">Tabac</Label>
                        <Select value={form.tabagisme} onValueChange={v => update('tabagisme', v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="non">Non</SelectItem>
                            <SelectItem value="oui">Oui</SelectItem>
                            <SelectItem value="ancien">Ancien</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldGroup>
                      <FieldGroup>
                        <Label className="text-[11px]">Alcool</Label>
                        <Select value={form.alcool} onValueChange={v => update('alcool', v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="non">Non</SelectItem>
                            <SelectItem value="oui">Oui</SelectItem>
                            <SelectItem value="ancien">Ancien</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldGroup>
                      {(form.tabagisme === 'oui' || form.tabagisme === 'ancien') && (
                        <FieldGroup><Label className="text-[11px]">Années</Label><Input value={form.tabagismeAnnees} onChange={e => update('tabagismeAnnees', e.target.value)} placeholder="20" className="h-9 text-xs" /></FieldGroup>
                      )}
                    </div>
                  </div>
                  <FieldGroup><Label>Symptômes</Label><Textarea value={form.symptomes} onChange={e => update('symptomes', e.target.value)} rows={2} placeholder="Décrire les symptômes..." /></FieldGroup>
                  <FieldGroup><Label>Notes</Label><Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} placeholder="Notes complémentaires..." /></FieldGroup>
                </div>
                <CustomFieldsBlock fields={fieldsForStep('suivi')} values={customFieldValues} onChange={updateCustomField} />
              </>
            )}

            {/* Step 9: Documents */}
            {stepId === 'documents' && (
              <>
                <StepHeader icon={FolderOpen} title="Documents du Patient" />
                {savedPatientId ? (
                  <PatientFileUpload patientId={savedPatientId} caseId={savedCaseId || undefined} />
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Sélectionnez le type puis ajoutez vos fichiers. Ils seront uploadés à l'enregistrement du cas.
                    </p>

                    {/* Type selector + file input */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs mb-1 block">Type de document</Label>
                        <Select value={docTypeForUpload} onValueChange={setDocTypeForUpload}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Choisir le type" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {DOC_TYPES_PREVIEW.map(t => (
                              <SelectItem key={t.value} value={t.value}>
                                <span className="flex items-center gap-2">
                                  <t.icon size={14} className={t.color.split(' ')[0]} />
                                  {t.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <input
                        ref={docInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={e => {
                          if (e.target.files && docTypeForUpload) {
                            addPendingFiles(e.target.files, docTypeForUpload);
                            e.target.value = '';
                          } else if (!docTypeForUpload) {
                            toast.error('Choisissez d\'abord le type de document');
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5"
                        onClick={() => {
                          if (!docTypeForUpload) { toast.error('Choisissez d\'abord le type'); return; }
                          docInputRef.current?.click();
                        }}
                      >
                        <Plus size={14} /> Ajouter
                      </Button>
                    </div>

                    {/* Pending files list */}
                    {pendingDocs.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {pendingDocs.length} fichier(s) prêt(s) à uploader
                        </p>
                        {pendingDocs.map((doc, i) => {
                          const cat = DOC_TYPES_PREVIEW.find(t => t.value === doc.docType) || DOC_TYPES_PREVIEW[DOC_TYPES_PREVIEW.length - 1];
                          return (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/30">
                              <div className={cn('w-7 h-7 rounded flex items-center justify-center shrink-0', cat.color)}>
                                <cat.icon size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{doc.file.name}</p>
                                <p className="text-[10px] text-muted-foreground">{cat.label} · {(doc.file.size / 1024).toFixed(0)} KB</p>
                              </div>
                              <button type="button" onClick={() => removePendingDoc(i)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                                <X size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Document types grid */}
                    {pendingDocs.length === 0 && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-2">Types supportés</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                          {DOC_TYPES_PREVIEW.map(t => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => { setDocTypeForUpload(t.value); setTimeout(() => docInputRef.current?.click(), 100); }}
                              className={cn(
                                'flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/40 text-center transition-all hover:border-primary/40 hover:bg-primary/5',
                                docTypeForUpload === t.value && 'border-primary bg-primary/5'
                              )}
                            >
                              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', t.color)}>
                                <t.icon size={18} />
                              </div>
                              <span className="text-[11px] font-medium leading-tight">{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Bottom navigation - fixed on mobile */}
        <div className="fixed bottom-0 left-0 right-0 md:static md:mt-4 bg-card/95 backdrop-blur-md border-t md:border-t-0 border-border p-3 md:p-0 z-40 flex items-center justify-between gap-2"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="h-10 px-4"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline ml-1">Précédent</span>
          </Button>

          {/* Step indicator mobile */}
          <span className="text-xs text-muted-foreground font-medium md:hidden">
            {currentStep + 1} / {STEPS.length}
          </span>

          {isDocStep && savedPatientId ? (
            <Button onClick={() => navigate('/cas')} className="h-10 px-6">
              Terminer <ArrowRight size={16} className="ml-1" />
            </Button>
          ) : isLastFormStep || isDocStep ? (
            <Button
              onClick={handleSubmit}
              disabled={loading || !!savedPatientId}
              className="h-10 px-6"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {savedPatientId ? '✅ Enregistré' : <>
                <Save size={16} className="mr-1" /> Enregistrer
                {pendingDocs.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5">{pendingDocs.length} doc(s)</Badge>}
              </>}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1))}
              className="h-10 px-6"
            >
              Suivant <ChevronRight size={16} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
      <GlobalVoiceButton currentForm={form} onFieldsExtracted={handleVoiceFields} />
    </AppLayout>
  );
}

function StepHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-2 border-b border-border/30">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon size={16} className="text-primary" />
      </div>
      <h2 className="font-display font-semibold text-sm">{title}</h2>
    </div>
  );
}

function CustomFieldsBlock({
  fields,
  values,
  onChange,
}: {
  fields: CustomField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="border-t border-border/30 pt-3 mt-1">
      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
        <Settings2 size={12} /> Champs personnalisés
      </p>
      <div className="grid grid-cols-1 gap-3">
        {fields.map(f => {
          const val = values[f.field_key] || '';
          if (f.field_type === 'textarea') {
            return (
              <div key={f.id} className="space-y-1.5">
                <Label className="text-xs">{f.label}{f.required ? ' *' : ''}</Label>
                <Textarea value={val} onChange={e => onChange(f.field_key, e.target.value)} rows={2} placeholder={f.label} />
              </div>
            );
          }
          if (f.field_type === 'select' && f.options?.length) {
            return (
              <div key={f.id} className="space-y-1.5">
                <Label className="text-xs">{f.label}{f.required ? ' *' : ''}</Label>
                <Select value={val} onValueChange={v => onChange(f.field_key, v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{f.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            );
          }
          return (
            <div key={f.id} className="space-y-1.5">
              <Label className="text-xs">{f.label}{f.required ? ' *' : ''}</Label>
              <Input
                type={f.field_type === 'date' ? 'date' : f.field_type === 'number' ? 'number' : 'text'}
                value={val}
                onChange={e => onChange(f.field_key, e.target.value)}
                placeholder={f.label}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

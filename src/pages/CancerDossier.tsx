import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Loader2, ArrowLeft, User, Calendar, Activity, FolderOpen,
  Stethoscope, Shield, Plus, Pill, AlertCircle, FileText,
  Upload, Microscope, Heart, MapPin, Hash, Clock,
  CheckCircle2, XCircle, AlertTriangle, TrendingUp,
  FlaskConical, Dna, Target, Layers, ClipboardList,
} from 'lucide-react';
import PatientFileUpload from '@/components/PatientFileUpload';
import { cn } from '@/lib/utils';

const TYPES_EVENEMENT = ['rechute', 'metastase', 'progression', 'remission'];
const TYPES_TRAITEMENT = ['Chirurgie', 'Chimiothérapie', 'Radiothérapie', 'Immunothérapie', 'Hormonothérapie', 'Thérapie ciblée'];
const EFFICACITE_OPTIONS = ['Réponse complète', 'Réponse partielle', 'Stable', 'Progression'];

interface PatientInfo {
  id: string; nom: string; prenom: string; sexe: string; date_naissance: string | null; commune: string | null; wilaya: string; code_patient: string;
}

interface CaseInfo {
  id: string; type_cancer: string; sous_type_cancer: string | null; stade_tnm: string | null;
  date_diagnostic: string; statut: string; statut_vital: string | null; methode_diagnostic: string | null;
  topographie_icdo: string | null; morphologie_icdo: string | null; code_icdo: string | null;
  grade: string | null; lateralite: string | null; comportement: string | null;
  base_diagnostic: string | null; source_info: string | null; milieu: string | null;
  profession: string | null; tabagisme: string | null; alcool: string | null; sportif: string | null;
  symptomes: string | null; notes: string | null;
  ref_anapath: string | null; date_anapath: string | null; medecin_anapath: string | null;
  resultat_anapath: string | null; anomalies_moleculaires: string | null;
  biologie_date: string | null; biologie_fns: string | null; biologie_globules: string | null;
  cause_deces: string | null; date_deces: string | null; date_derniere_nouvelle: string | null;
  created_at: string;
}

interface Rechute { id: string; type_evenement: string; date_evenement: string; localisation: string | null; description: string | null; stade_tnm: string | null; traitement_propose: string | null; }
interface Traitement { id: string; type_traitement: string; date_debut: string; date_fin: string | null; protocole: string | null; efficacite: string | null; effets_secondaires: string | null; medecin_traitant: string | null; notes: string | null; }

function getAge(dob: string | null): string {
  if (!dob) return '—';
  const age = new Date().getFullYear() - new Date(dob).getFullYear();
  return `${age} ans`;
}

const vitalBadge = (s: string | null) => {
  if (s === 'decede') return <Badge variant="destructive" className="gap-1"><XCircle size={10} />Décédé</Badge>;
  if (s === 'perdu_de_vue') return <Badge variant="outline" className="gap-1 text-warning border-warning/30"><AlertTriangle size={10} />Perdu de vue</Badge>;
  return <Badge className="bg-success/10 text-success border-success/20 gap-1"><CheckCircle2 size={10} />Vivant</Badge>;
};

const eventColor = (type: string) => {
  switch (type) {
    case 'rechute': return 'bg-destructive/10 text-destructive border-destructive/20';
    case 'metastase': return 'bg-warning/10 text-warning border-warning/20';
    case 'progression': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'remission': return 'bg-success/10 text-success border-success/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

export default function CancerDossier() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [rechutes, setRechutes] = useState<Rechute[]>([]);
  const [traitements, setTraitements] = useState<Traitement[]>([]);

  const [showRechute, setShowRechute] = useState(false);
  const [showTraitement, setShowTraitement] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rechForm, setRechForm] = useState({ type_evenement: 'rechute', date_evenement: '', localisation: '', description: '', stade_tnm: '', traitement_propose: '' });
  const [traitForm, setTraitForm] = useState({ type_traitement: 'Chimiothérapie', date_debut: '', date_fin: '', protocole: '', efficacite: '', effets_secondaires: '', medecin_traitant: '', notes: '' });

  // OCR
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);

  const canEdit = role === 'medecin' || role === 'admin';

  useEffect(() => { if (id) fetchData(); }, [id]);

  const fetchData = async () => {
    setLoading(true);
    const { data: caseData } = await supabase
      .from('cancer_cases')
      .select('*, patients(id, nom, prenom, sexe, date_naissance, commune, wilaya, code_patient)')
      .eq('id', id!)
      .single();

    if (caseData) {
      const { patients, ...rest } = caseData as any;
      setCaseInfo(rest as CaseInfo);
      setPatient(patients as PatientInfo);
    }

    const [rechRes, traitRes] = await Promise.all([
      supabase.from('cancer_rechutes').select('*').eq('case_id', id!).order('date_evenement', { ascending: true }),
      supabase.from('traitements').select('*').eq('case_id', id!).order('date_debut', { ascending: true }),
    ]);
    setRechutes((rechRes.data as Rechute[]) || []);
    setTraitements((traitRes.data as Traitement[]) || []);
    setLoading(false);
  };

  const addRechute = async () => {
    if (!id || !user) return;
    setSaving(true);
    const { error } = await supabase.from('cancer_rechutes').insert({
      case_id: id, type_evenement: rechForm.type_evenement, date_evenement: rechForm.date_evenement,
      localisation: rechForm.localisation || null, description: rechForm.description || null,
      stade_tnm: rechForm.stade_tnm || null, traitement_propose: rechForm.traitement_propose || null, created_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success('Événement ajouté'); setShowRechute(false); fetchData(); }
    setSaving(false);
  };

  const addTraitement = async () => {
    if (!id || !user) return;
    setSaving(true);
    const { error } = await supabase.from('traitements').insert({
      case_id: id, type_traitement: traitForm.type_traitement, date_debut: traitForm.date_debut,
      date_fin: traitForm.date_fin || null, protocole: traitForm.protocole || null,
      efficacite: traitForm.efficacite || null, effets_secondaires: traitForm.effets_secondaires || null,
      medecin_traitant: traitForm.medecin_traitant || null, notes: traitForm.notes || null, created_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success('Traitement ajouté'); setShowTraitement(false); fetchData(); }
    setSaving(false);
  };

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') { toast.error('PDF uniquement'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10 Mo'); return; }
    setOcrLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf));
      const parts: string[] = [];
      const rx = /\(([^)]+)\)/g;
      let m;
      while ((m = rx.exec(text)) !== null) { if (m[1].length > 2 && /[a-zA-ZÀ-ÿ]/.test(m[1])) parts.push(m[1]); }
      let extracted = parts.join(' ');
      if (extracted.length < 50) extracted = text.replace(/[^\x20-\x7EÀ-ÿ\n]/g, ' ').replace(/\s+/g, ' ').trim();
      if (extracted.length < 20) { toast.error('PDF illisible'); setOcrLoading(false); return; }
      const { data, error } = await supabase.functions.invoke('ocr-anapath', { body: { text: extracted.slice(0, 8000) } });
      if (error) throw error;
      setOcrResult(data);
      toast.success('Données extraites par IA');
    } catch (err: any) { toast.error(err.message || 'Erreur OCR'); }
    finally { setOcrLoading(false); }
  };

  const applyOcr = async () => {
    if (!ocrResult || !id) return;
    setSaving(true);
    const u: any = {};
    if (ocrResult.medecinAnapath) u.medecin_anapath = ocrResult.medecinAnapath;
    if (ocrResult.dateAnapath) u.date_anapath = ocrResult.dateAnapath;
    if (ocrResult.refAnapath) u.ref_anapath = ocrResult.refAnapath;
    if (ocrResult.typeCancer) u.type_cancer = ocrResult.typeCancer;
    if (ocrResult.sousTypeCancer) u.sous_type_cancer = ocrResult.sousTypeCancer;
    if (ocrResult.anomaliesMoleculaires) u.anomalies_moleculaires = ocrResult.anomaliesMoleculaires;
    if (ocrResult.resultatAnapath) u.resultat_anapath = ocrResult.resultatAnapath;
    if (ocrResult.stadePathologique) u.stade_tnm = ocrResult.stadePathologique;
    const { error } = await supabase.from('cancer_cases').update(u).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Dossier mis à jour'); setOcrResult(null); fetchData(); }
    setSaving(false);
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div></AppLayout>;
  if (!caseInfo || !patient) return <AppLayout><div className="text-center py-20 text-muted-foreground">Cas non trouvé<br /><Link to="/cas"><Button className="mt-4" variant="secondary">Retour</Button></Link></div></AppLayout>;

  // Timeline
  const timeline = [
    { date: caseInfo.date_diagnostic, type: 'diagnostic', label: `Diagnostic: ${caseInfo.type_cancer}`, detail: caseInfo.stade_tnm },
    ...rechutes.map(r => ({ date: r.date_evenement, type: r.type_evenement, label: `${r.type_evenement.charAt(0).toUpperCase() + r.type_evenement.slice(1)}${r.localisation ? ` — ${r.localisation}` : ''}`, detail: r.description })),
    ...traitements.map(t => ({ date: t.date_debut, type: 'traitement', label: `${t.type_traitement}${t.protocole ? ` (${t.protocole})` : ''}`, detail: t.efficacite })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with dual navigation */}
        <div className="flex items-start gap-3">
          <Link to="/cas"><Button variant="ghost" size="icon" className="mt-1"><ArrowLeft size={18} /></Button></Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link to="/cas" className="hover:text-primary transition-colors">Cas</Link>
              <span>/</span>
              <Link to={`/dossier-patient/${patient.id}`} className="hover:text-primary transition-colors">
                {patient.nom.toUpperCase()} {patient.prenom}
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">Dossier Cancer</span>
            </div>
            <h1 className="font-display text-xl md:text-2xl font-bold flex items-center gap-3">
              {caseInfo.type_cancer}
              {caseInfo.sous_type_cancer && <span className="text-muted-foreground font-normal text-lg">— {caseInfo.sous_type_cancer}</span>}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to={`/dossier-patient/${patient.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <User size={13} /> Dossier Patient
              </Button>
            </Link>
            <div className="flex flex-col items-end gap-1">
              {caseInfo.statut === 'valide' ? <Badge className="bg-success/10 text-success border-success/20">Validé</Badge> : <Badge variant="secondary">En attente</Badge>}
              {vitalBadge(caseInfo.statut_vital)}
            </div>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard icon={Calendar} label="Diagnostic" value={new Date(caseInfo.date_diagnostic).toLocaleDateString('fr-DZ')} color="text-primary" />
          <SummaryCard icon={Shield} label="Stade TNM" value={caseInfo.stade_tnm || '—'} color="text-chart-3" />
          <SummaryCard icon={Target} label="Grade" value={caseInfo.grade?.split('—')[0]?.trim() || '—'} color="text-chart-5" />
          <SummaryCard icon={Pill} label="Traitements" value={String(traitements.length)} color="text-accent" />
          <SummaryCard icon={AlertCircle} label="Événements" value={String(rechutes.length)} color="text-destructive" />
        </div>

        <Tabs defaultValue="resume" className="space-y-4">
          <TabsList className="w-full flex overflow-x-auto h-11 gap-0">
            <TabsTrigger value="resume" className="text-xs gap-1 flex-1 min-w-0"><ClipboardList size={13} /> <span className="hidden sm:inline">Résumé</span></TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs gap-1 flex-1 min-w-0"><Activity size={13} /> <span className="hidden sm:inline">Timeline</span></TabsTrigger>
            <TabsTrigger value="traitements" className="text-xs gap-1 flex-1 min-w-0"><Pill size={13} /> <span className="hidden sm:inline">Traitement</span></TabsTrigger>
            <TabsTrigger value="rechutes" className="text-xs gap-1 flex-1 min-w-0"><AlertCircle size={13} /> <span className="hidden sm:inline">Événements</span></TabsTrigger>
            <TabsTrigger value="documents" className="text-xs gap-1 flex-1 min-w-0"><FolderOpen size={13} /> <span className="hidden sm:inline">Documents</span></TabsTrigger>
            <TabsTrigger value="anapath" className="text-xs gap-1 flex-1 min-w-0"><Microscope size={13} /> <span className="hidden sm:inline">Anapath</span></TabsTrigger>
          </TabsList>

          {/* --- RÉSUMÉ CLINIQUE --- */}
          <TabsContent value="resume">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tumeur */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Target size={16} className="text-primary" /> Tumeur</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Type" value={caseInfo.type_cancer} />
                  {caseInfo.sous_type_cancer && <Row label="Sous-type" value={caseInfo.sous_type_cancer} />}
                  <Row label="Date diagnostic" value={new Date(caseInfo.date_diagnostic).toLocaleDateString('fr-DZ')} />
                  <Row label="Méthode diagnostic" value={caseInfo.methode_diagnostic || '—'} />
                  {caseInfo.lateralite && caseInfo.lateralite !== 'Non applicable' && <Row label="Latéralité" value={caseInfo.lateralite} />}
                  {caseInfo.comportement && <Row label="Comportement" value={caseInfo.comportement} />}
                </CardContent>
              </Card>

              {/* Classification */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Layers size={16} className="text-chart-3" /> Classification ICD-O</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Stade TNM" value={caseInfo.stade_tnm || '—'} mono />
                  <Row label="Grade" value={caseInfo.grade || '—'} />
                  {caseInfo.topographie_icdo && <Row label="Topographie ICD-O" value={caseInfo.topographie_icdo} mono />}
                  {caseInfo.morphologie_icdo && <Row label="Morphologie ICD-O" value={caseInfo.morphologie_icdo} mono />}
                  {caseInfo.code_icdo && <Row label="Code ICD-O" value={caseInfo.code_icdo} mono />}
                  <Row label="Base diagnostic" value={caseInfo.base_diagnostic || '—'} />
                </CardContent>
              </Card>

              {/* Epidemio */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><TrendingUp size={16} className="text-accent" /> Épidémiologie</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Milieu" value={caseInfo.milieu || '—'} />
                  <Row label="Profession" value={caseInfo.profession || '—'} />
                  <Row label="Tabagisme" value={caseInfo.tabagisme || '—'} />
                  <Row label="Alcool" value={caseInfo.alcool || '—'} />
                  <Row label="Sportif" value={caseInfo.sportif || '—'} />
                  {caseInfo.symptomes && <Row label="Symptômes" value={caseInfo.symptomes} />}
                </CardContent>
              </Card>

              {/* Anapath */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Microscope size={16} className="text-chart-5" /> Anatomopathologie</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Réf. Anapath" value={caseInfo.ref_anapath || '—'} mono />
                  <Row label="Date" value={caseInfo.date_anapath ? new Date(caseInfo.date_anapath).toLocaleDateString('fr-DZ') : '—'} />
                  <Row label="Médecin" value={caseInfo.medecin_anapath || '—'} />
                  {caseInfo.resultat_anapath && <Row label="Résultat" value={caseInfo.resultat_anapath} />}
                  {caseInfo.anomalies_moleculaires && <Row label="Anomalies moléculaires" value={caseInfo.anomalies_moleculaires} />}
                </CardContent>
              </Card>

              {/* Biologie */}
              {(caseInfo.biologie_date || caseInfo.biologie_fns) && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FlaskConical size={16} className="text-chart-2" /> Biologie</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {caseInfo.biologie_date && <Row label="Date bilan" value={new Date(caseInfo.biologie_date).toLocaleDateString('fr-DZ')} />}
                    {caseInfo.biologie_fns && <Row label="FNS" value={caseInfo.biologie_fns} />}
                    {caseInfo.biologie_globules && <Row label="Globules" value={caseInfo.biologie_globules} />}
                  </CardContent>
                </Card>
              )}

              {/* Suivi */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Heart size={16} className="text-destructive" /> Suivi vital</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 mb-2">{vitalBadge(caseInfo.statut_vital)}</div>
                  {caseInfo.date_derniere_nouvelle && <Row label="Dernière nouvelle" value={new Date(caseInfo.date_derniere_nouvelle).toLocaleDateString('fr-DZ')} />}
                  {caseInfo.statut_vital === 'decede' && caseInfo.date_deces && <Row label="Date décès" value={new Date(caseInfo.date_deces).toLocaleDateString('fr-DZ')} />}
                  {caseInfo.cause_deces && <Row label="Cause décès" value={caseInfo.cause_deces} />}
                  {caseInfo.source_info && <Row label="Source info" value={caseInfo.source_info} />}
                </CardContent>
              </Card>

              {/* Notes */}
              {caseInfo.notes && (
                <Card className="md:col-span-2">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText size={16} className="text-muted-foreground" /> Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm whitespace-pre-wrap">{caseInfo.notes}</p></CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* --- TIMELINE --- */}
          <TabsContent value="timeline">
            <Card>
              <CardContent className="p-5">
                {timeline.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Aucun événement</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    {timeline.map((evt, i) => (
                      <div key={i} className="relative pl-10 pb-6 last:pb-0">
                        <div className={cn(
                          'absolute left-2 top-1 w-5 h-5 rounded-full border-2 border-background',
                          evt.type === 'diagnostic' ? 'bg-primary' : evt.type === 'traitement' ? 'bg-chart-2' : evt.type === 'remission' ? 'bg-success' : 'bg-destructive'
                        )} />
                        <div className="stat-card !p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">{new Date(evt.date).toLocaleDateString('fr-DZ')}</span>
                            <Badge variant="outline" className={cn('text-xs', eventColor(evt.type))}>{evt.type}</Badge>
                          </div>
                          <p className="text-sm font-medium">{evt.label}</p>
                          {evt.detail && <p className="text-xs text-muted-foreground mt-1">{evt.detail}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- TRAITEMENTS --- */}
          <TabsContent value="traitements" className="space-y-3">
            {canEdit && (
              <Dialog open={showTraitement} onOpenChange={setShowTraitement}>
                <DialogTrigger asChild><Button className="w-full h-11"><Plus size={16} className="mr-1" /> Ajouter un traitement</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nouveau Traitement</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Type *</Label>
                      <Select value={traitForm.type_traitement} onValueChange={v => setTraitForm(f => ({ ...f, type_traitement: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TYPES_TRAITEMENT.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Date début *</Label><Input type="date" value={traitForm.date_debut} onChange={e => setTraitForm(f => ({ ...f, date_debut: e.target.value }))} /></div>
                      <div><Label>Date fin</Label><Input type="date" value={traitForm.date_fin} onChange={e => setTraitForm(f => ({ ...f, date_fin: e.target.value }))} /></div>
                    </div>
                    <div><Label>Protocole</Label><Input value={traitForm.protocole} onChange={e => setTraitForm(f => ({ ...f, protocole: e.target.value }))} placeholder="Ex: FOLFOX, AC-T..." /></div>
                    <div><Label>Efficacité</Label>
                      <Select value={traitForm.efficacite} onValueChange={v => setTraitForm(f => ({ ...f, efficacite: v }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>{EFFICACITE_OPTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Effets secondaires</Label><Textarea value={traitForm.effets_secondaires} onChange={e => setTraitForm(f => ({ ...f, effets_secondaires: e.target.value }))} rows={2} /></div>
                    <div><Label>Médecin traitant</Label><Input value={traitForm.medecin_traitant} onChange={e => setTraitForm(f => ({ ...f, medecin_traitant: e.target.value }))} /></div>
                    <Button onClick={addTraitement} disabled={!traitForm.date_debut || saving} className="w-full">
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {traitements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Pill size={40} className="mx-auto mb-2 opacity-20" />Aucun traitement</div>
            ) : traitements.map(t => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className="bg-chart-2/10 text-chart-2 border-chart-2/20">{t.type_traitement}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.date_debut).toLocaleDateString('fr-DZ')}
                      {t.date_fin && ` → ${new Date(t.date_fin).toLocaleDateString('fr-DZ')}`}
                    </span>
                  </div>
                  {t.protocole && <p className="text-sm"><span className="font-medium">Protocole:</span> {t.protocole}</p>}
                  {t.efficacite && <p className="text-sm"><span className="font-medium">Résultat:</span> {t.efficacite}</p>}
                  {t.effets_secondaires && <p className="text-sm text-muted-foreground mt-1">{t.effets_secondaires}</p>}
                  {t.medecin_traitant && <p className="text-xs text-muted-foreground mt-1">Dr. {t.medecin_traitant}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* --- ÉVÉNEMENTS --- */}
          <TabsContent value="rechutes" className="space-y-3">
            {canEdit && (
              <Dialog open={showRechute} onOpenChange={setShowRechute}>
                <DialogTrigger asChild><Button variant="destructive" className="w-full h-11"><Plus size={16} className="mr-1" /> Ajouter un événement</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nouvel Événement</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Type *</Label>
                      <Select value={rechForm.type_evenement} onValueChange={v => setRechForm(f => ({ ...f, type_evenement: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TYPES_EVENEMENT.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Date *</Label><Input type="date" value={rechForm.date_evenement} onChange={e => setRechForm(f => ({ ...f, date_evenement: e.target.value }))} /></div>
                    <div><Label>Localisation</Label><Input value={rechForm.localisation} onChange={e => setRechForm(f => ({ ...f, localisation: e.target.value }))} placeholder="Ex: Foie, Os..." /></div>
                    <div><Label>Description</Label><Textarea value={rechForm.description} onChange={e => setRechForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
                    <div><Label>Stade TNM</Label><Input value={rechForm.stade_tnm} onChange={e => setRechForm(f => ({ ...f, stade_tnm: e.target.value }))} placeholder="Ex: T3N2M1" /></div>
                    <Button onClick={addRechute} disabled={!rechForm.date_evenement || saving} className="w-full">
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {rechutes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><AlertCircle size={40} className="mx-auto mb-2 opacity-20" />Aucun événement</div>
            ) : rechutes.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={eventColor(r.type_evenement)}>{r.type_evenement}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(r.date_evenement).toLocaleDateString('fr-DZ')}</span>
                  </div>
                  {r.localisation && <p className="text-sm"><span className="font-medium">Localisation:</span> {r.localisation}</p>}
                  {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                  {r.stade_tnm && <p className="text-sm"><span className="font-medium">Stade:</span> {r.stade_tnm}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* --- DOCUMENTS --- */}
          <TabsContent value="documents">
            <PatientFileUpload patientId={patient.id} caseId={caseInfo.id} />
          </TabsContent>

          {/* --- ANAPATH IA --- */}
          <TabsContent value="anapath" className="space-y-4">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><Upload className="text-primary" size={24} /></div>
                  <div>
                    <h3 className="font-display font-semibold">📄 OCR Anapath IA</h3>
                    <p className="text-muted-foreground text-xs">Uploadez un PDF de rapport anapath — l'IA extraira les données</p>
                  </div>
                </div>
                <Input type="file" accept=".pdf" onChange={handleOcrUpload} disabled={ocrLoading} />
                {ocrLoading && <div className="flex items-center gap-2 text-primary text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Analyse IA...</div>}
              </CardContent>
            </Card>
            {ocrResult && (
              <Card className="border-success/30 bg-success/5">
                <CardContent className="p-5 space-y-3">
                  <h3 className="font-semibold text-success flex items-center gap-2"><Badge className="bg-success/10 text-success border-success/20">IA vérifié</Badge> Données extraites</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {ocrResult.medecinAnapath && <p><span className="font-medium">Médecin:</span> {ocrResult.medecinAnapath}</p>}
                    {ocrResult.dateAnapath && <p><span className="font-medium">Date:</span> {ocrResult.dateAnapath}</p>}
                    {ocrResult.refAnapath && <p><span className="font-medium">Référence:</span> {ocrResult.refAnapath}</p>}
                    {ocrResult.typeCancer && <p><span className="font-medium">Type:</span> {ocrResult.typeCancer}</p>}
                    {ocrResult.sousTypeCancer && <p><span className="font-medium">Sous-type:</span> {ocrResult.sousTypeCancer}</p>}
                    {ocrResult.anomaliesMoleculaires && <p><span className="font-medium">Anomalies:</span> {ocrResult.anomaliesMoleculaires}</p>}
                    {ocrResult.stadePathologique && <p><span className="font-medium">Stade:</span> {ocrResult.stadePathologique}</p>}
                    {ocrResult.resultatAnapath && <p className="md:col-span-2"><span className="font-medium">Résultat:</span> {ocrResult.resultatAnapath}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={applyOcr} disabled={saving} className="flex-1">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Appliquer au dossier</Button>
                    <Button variant="secondary" onClick={() => setOcrResult(null)}>Annuler</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="kpi-card text-center">
      <Icon size={16} className={cn('mx-auto mb-1', color)} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold font-mono">{value}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground text-xs w-36 shrink-0 pt-0.5">{label}</span>
      <span className={cn('text-sm font-medium', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

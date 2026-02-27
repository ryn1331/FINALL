import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, ArrowLeft, Activity, Pill, AlertCircle, FileText, Upload, FolderOpen } from 'lucide-react';
import PatientFileUpload from '@/components/PatientFileUpload';
import { cn } from '@/lib/utils';

const TYPES_EVENEMENT = ['rechute', 'metastase', 'progression', 'remission'];
const TYPES_TRAITEMENT = ['Chirurgie', 'Chimiothérapie', 'Radiothérapie', 'Immunothérapie', 'Hormonothérapie', 'Thérapie ciblée'];
const EFFICACITE_OPTIONS = ['Réponse complète', 'Réponse partielle', 'Stable', 'Progression'];

interface PatientInfo {
  id: string;
  nom: string;
  prenom: string;
  sexe: string;
  date_naissance: string | null;
  commune: string | null;
}

interface CaseInfo {
  id: string;
  type_cancer: string;
  stade_tnm: string | null;
  date_diagnostic: string;
  statut: string;
  sous_type_cancer: string | null;
}

interface Rechute {
  id: string;
  type_evenement: string;
  date_evenement: string;
  localisation: string | null;
  description: string | null;
  stade_tnm: string | null;
  traitement_propose: string | null;
  created_at: string;
}

interface Traitement {
  id: string;
  type_traitement: string;
  date_debut: string;
  date_fin: string | null;
  protocole: string | null;
  efficacite: string | null;
  effets_secondaires: string | null;
  medecin_traitant: string | null;
  notes: string | null;
  created_at: string;
}

export default function PatientTimeline() {
  const { user, role } = useAuth();
  const [params] = useSearchParams();
  const caseId = params.get('case');

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [rechutes, setRechutes] = useState<Rechute[]>([]);
  const [traitements, setTraitements] = useState<Traitement[]>([]);

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);

  // Dialog states
  const [showRechute, setShowRechute] = useState(false);
  const [showTraitement, setShowTraitement] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rechForm, setRechForm] = useState({
    type_evenement: 'rechute', date_evenement: '', localisation: '', description: '', stade_tnm: '', traitement_propose: '',
  });
  const [traitForm, setTraitForm] = useState({
    type_traitement: 'Chimiothérapie', date_debut: '', date_fin: '', protocole: '', efficacite: '', effets_secondaires: '', medecin_traitant: '', notes: '',
  });

  useEffect(() => {
    if (caseId) fetchData();
  }, [caseId]);

  const fetchData = async () => {
    setLoading(true);
    const { data: caseData } = await supabase
      .from('cancer_cases')
      .select('id, type_cancer, stade_tnm, date_diagnostic, statut, sous_type_cancer, patients(id, nom, prenom, sexe, date_naissance, commune)')
      .eq('id', caseId!)
      .single();

    if (caseData) {
      setCaseInfo({
        id: caseData.id,
        type_cancer: caseData.type_cancer,
        stade_tnm: caseData.stade_tnm,
        date_diagnostic: caseData.date_diagnostic,
        statut: caseData.statut,
        sous_type_cancer: caseData.sous_type_cancer,
      });
      setPatient((caseData as any).patients);
    }

    const { data: rechData } = await supabase
      .from('cancer_rechutes')
      .select('*')
      .eq('case_id', caseId!)
      .order('date_evenement', { ascending: true });
    setRechutes((rechData as Rechute[]) || []);

    const { data: traitData } = await supabase
      .from('traitements')
      .select('*')
      .eq('case_id', caseId!)
      .order('date_debut', { ascending: true });
    setTraitements((traitData as Traitement[]) || []);

    setLoading(false);
  };

  const addRechute = async () => {
    if (!caseId || !user) return;
    setSaving(true);
    const { error } = await supabase.from('cancer_rechutes').insert({
      case_id: caseId,
      type_evenement: rechForm.type_evenement,
      date_evenement: rechForm.date_evenement,
      localisation: rechForm.localisation || null,
      description: rechForm.description || null,
      stade_tnm: rechForm.stade_tnm || null,
      traitement_propose: rechForm.traitement_propose || null,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success('Événement ajouté'); setShowRechute(false); fetchData(); }
    setSaving(false);
  };

  const addTraitement = async () => {
    if (!caseId || !user) return;
    setSaving(true);
    const { error } = await supabase.from('traitements').insert({
      case_id: caseId,
      type_traitement: traitForm.type_traitement,
      date_debut: traitForm.date_debut,
      date_fin: traitForm.date_fin || null,
      protocole: traitForm.protocole || null,
      efficacite: traitForm.efficacite || null,
      effets_secondaires: traitForm.effets_secondaires || null,
      medecin_traitant: traitForm.medecin_traitant || null,
      notes: traitForm.notes || null,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success('Traitement ajouté'); setShowTraitement(false); fetchData(); }
    setSaving(false);
  };

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 Mo)');
      return;
    }

    setOcrLoading(true);
    try {
      // Read PDF text (for text PDFs, we extract using simple method)
      const arrayBuffer = await file.arrayBuffer();
      const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(arrayBuffer));
      
      // Extract readable text portions from the PDF
      const textParts: string[] = [];
      const regex = /\(([^)]+)\)/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const part = match[1];
        if (part.length > 2 && /[a-zA-ZÀ-ÿ]/.test(part)) {
          textParts.push(part);
        }
      }
      
      let extractedText = textParts.join(' ');
      if (extractedText.length < 50) {
        // Fallback: send raw text content
        extractedText = text.replace(/[^\x20-\x7EÀ-ÿ\n]/g, ' ').replace(/\s+/g, ' ').trim();
      }

      if (extractedText.length < 20) {
        toast.error('Impossible d\'extraire le texte du PDF. Essayez un PDF textuel.');
        setOcrLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('ocr-anapath', {
        body: { text: extractedText.slice(0, 8000) },
      });

      if (error) throw error;
      setOcrResult(data);
      toast.success('📄 Données extraites par IA ! Vérifiez et appliquez.');
    } catch (err: any) {
      toast.error(err.message || 'Erreur OCR');
    } finally {
      setOcrLoading(false);
    }
  };

  const applyOcrToCase = async () => {
    if (!ocrResult || !caseId) return;
    setSaving(true);
    const updateData: any = {};
    if (ocrResult.medecinAnapath) updateData.medecin_anapath = ocrResult.medecinAnapath;
    if (ocrResult.dateAnapath) updateData.date_anapath = ocrResult.dateAnapath;
    if (ocrResult.refAnapath) updateData.ref_anapath = ocrResult.refAnapath;
    if (ocrResult.typeCancer) updateData.type_cancer = ocrResult.typeCancer;
    if (ocrResult.sousTypeCancer) updateData.sous_type_cancer = ocrResult.sousTypeCancer;
    if (ocrResult.anomaliesMoleculaires) updateData.anomalies_moleculaires = ocrResult.anomaliesMoleculaires;
    if (ocrResult.resultatAnapath) updateData.resultat_anapath = ocrResult.resultatAnapath;
    if (ocrResult.stadePathologique) updateData.stade_tnm = ocrResult.stadePathologique;

    const { error } = await supabase.from('cancer_cases').update(updateData).eq('id', caseId);
    if (error) toast.error(error.message);
    else { toast.success('✅ Dossier mis à jour avec les données anapath IA'); setOcrResult(null); fetchData(); }
    setSaving(false);
  };

  const canEdit = role === 'medecin' || role === 'admin';

  const eventColor = (type: string) => {
    switch (type) {
      case 'rechute': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'metastase': return 'bg-warning/10 text-warning border-warning/20';
      case 'progression': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'remission': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) return (
    <AppLayout>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
    </AppLayout>
  );

  if (!caseInfo || !patient) return (
    <AppLayout>
      <div className="text-center py-20">
        <p className="text-muted-foreground">Cas non trouvé</p>
        <Link to="/cas"><Button className="mt-4" variant="secondary">Retour à la liste</Button></Link>
      </div>
    </AppLayout>
  );

  // Build timeline
  const timeline = [
    { date: caseInfo.date_diagnostic, type: 'diagnostic', label: `Diagnostic: ${caseInfo.type_cancer}${caseInfo.sous_type_cancer ? ` (${caseInfo.sous_type_cancer})` : ''}`, detail: caseInfo.stade_tnm ? `Stade: ${caseInfo.stade_tnm}` : null },
    ...rechutes.map(r => ({ date: r.date_evenement, type: r.type_evenement, label: `${r.type_evenement.charAt(0).toUpperCase() + r.type_evenement.slice(1)}${r.localisation ? ` — ${r.localisation}` : ''}`, detail: r.description })),
    ...traitements.map(t => ({ date: t.date_debut, type: 'traitement', label: `${t.type_traitement}${t.protocole ? ` (${t.protocole})` : ''}`, detail: t.efficacite ? `Résultat: ${t.efficacite}` : null })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/cas"><Button variant="ghost" size="icon"><ArrowLeft size={18} /></Button></Link>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold">{patient.nom} {patient.prenom}</h1>
            <p className="text-muted-foreground text-sm">
              {patient.sexe === 'M' ? '♂' : '♀'} · {patient.commune || 'N/A'}
              {patient.date_naissance && ` · ${new Date().getFullYear() - new Date(patient.date_naissance).getFullYear()} ans`}
            </p>
          </div>
          <Badge className={caseInfo.statut === 'valide' ? 'bg-success/10 text-success' : ''}>
            {caseInfo.type_cancer}
          </Badge>
        </div>

        <Tabs defaultValue="timeline" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="timeline"><Activity size={14} className="mr-1" /> Timeline</TabsTrigger>
            <TabsTrigger value="traitements"><Pill size={14} className="mr-1" /> Traitements</TabsTrigger>
            <TabsTrigger value="rechutes"><AlertCircle size={14} className="mr-1" /> Rechutes</TabsTrigger>
            <TabsTrigger value="documents"><FolderOpen size={14} className="mr-1" /> Documents</TabsTrigger>
            <TabsTrigger value="anapath"><FileText size={14} className="mr-1" /> Anapath IA</TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <div className="stat-card space-y-0">
              {timeline.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Aucun événement enregistré</p>
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
            </div>
          </TabsContent>

          {/* Traitements Tab */}
          <TabsContent value="traitements" className="space-y-3">
            {canEdit && (
              <Dialog open={showTraitement} onOpenChange={setShowTraitement}>
                <DialogTrigger asChild>
                  <Button className="w-full h-11"><Plus size={16} className="mr-1" /> Ajouter un traitement</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nouveau Traitement</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Type *</Label>
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
                    <div>
                      <Label>Efficacité</Label>
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
              <div className="text-center py-8 text-muted-foreground">Aucun traitement enregistré</div>
            ) : traitements.map(t => (
              <div key={t.id} className="stat-card">
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
              </div>
            ))}
          </TabsContent>

          {/* Rechutes Tab */}
          <TabsContent value="rechutes" className="space-y-3">
            {canEdit && (
              <Dialog open={showRechute} onOpenChange={setShowRechute}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full h-11"><Plus size={16} className="mr-1" /> Ajouter un événement</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nouvel Événement</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Type *</Label>
                      <Select value={rechForm.type_evenement} onValueChange={v => setRechForm(f => ({ ...f, type_evenement: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TYPES_EVENEMENT.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Date *</Label><Input type="date" value={rechForm.date_evenement} onChange={e => setRechForm(f => ({ ...f, date_evenement: e.target.value }))} /></div>
                    <div><Label>Localisation</Label><Input value={rechForm.localisation} onChange={e => setRechForm(f => ({ ...f, localisation: e.target.value }))} placeholder="Ex: Foie, Os, Cerveau..." /></div>
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
              <div className="text-center py-8 text-muted-foreground">Aucune rechute/évolution enregistrée</div>
            ) : rechutes.map(r => (
              <div key={r.id} className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <Badge className={eventColor(r.type_evenement)}>{r.type_evenement}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(r.date_evenement).toLocaleDateString('fr-DZ')}</span>
                </div>
                {r.localisation && <p className="text-sm"><span className="font-medium">Localisation:</span> {r.localisation}</p>}
                {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                {r.stade_tnm && <p className="text-sm"><span className="font-medium">Stade:</span> {r.stade_tnm}</p>}
              </div>
            ))}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            <PatientFileUpload patientId={patient.id} caseId={caseInfo.id} />
          </TabsContent>

          {/* Anapath IA Tab */}
          <TabsContent value="anapath" className="space-y-4">
            <div className="stat-card space-y-4 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="text-primary" size={24} />
                </div>
                <div>
                  <h3 className="font-display font-semibold">📄 OCR Anapath IA</h3>
                  <p className="text-muted-foreground text-xs">Uploadez un PDF de rapport anapath — l'IA extraira les données automatiquement</p>
                </div>
              </div>
              <div>
                <Input type="file" accept=".pdf" onChange={handleOcrUpload} disabled={ocrLoading} />
                {ocrLoading && (
                  <div className="flex items-center gap-2 mt-2 text-primary text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Analyse IA du PDF en cours...
                  </div>
                )}
              </div>
            </div>

            {ocrResult && (
              <div className="stat-card space-y-3 border-success/30 bg-success/5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-success flex items-center gap-2">
                    <Badge className="bg-success/10 text-success border-success/20">IA vérifié</Badge>
                    Données extraites
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {ocrResult.medecinAnapath && <p><span className="font-medium">Médecin:</span> {ocrResult.medecinAnapath}</p>}
                  {ocrResult.dateAnapath && <p><span className="font-medium">Date:</span> {ocrResult.dateAnapath}</p>}
                  {ocrResult.refAnapath && <p><span className="font-medium">Référence:</span> {ocrResult.refAnapath}</p>}
                  {ocrResult.typeCancer && <p><span className="font-medium">Type:</span> {ocrResult.typeCancer}</p>}
                  {ocrResult.sousTypeCancer && <p><span className="font-medium">Sous-type:</span> {ocrResult.sousTypeCancer}</p>}
                  {ocrResult.anomaliesMoleculaires && <p><span className="font-medium">Anomalies:</span> {ocrResult.anomaliesMoleculaires}</p>}
                  {ocrResult.stadePathologique && <p><span className="font-medium">Stade path.:</span> {ocrResult.stadePathologique}</p>}
                  {ocrResult.grade && <p><span className="font-medium">Grade:</span> {ocrResult.grade}</p>}
                  {ocrResult.marges && <p><span className="font-medium">Marges:</span> {ocrResult.marges}</p>}
                  {ocrResult.resultatAnapath && <p className="md:col-span-2"><span className="font-medium">Résultat:</span> {ocrResult.resultatAnapath}</p>}
                </div>
                <div className="flex gap-2">
                  <Button onClick={applyOcrToCase} disabled={saving} className="flex-1">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} ✅ Appliquer au dossier
                  </Button>
                  <Button variant="secondary" onClick={() => setOcrResult(null)}>Annuler</Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

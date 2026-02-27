import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, Microscope, Clock, CheckCircle2, AlertTriangle, FileText, Upload, Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PendingCase {
  id: string;
  type_cancer: string;
  date_diagnostic: string;
  ref_anapath: string | null;
  resultat_anapath: string | null;
  date_anapath: string | null;
  medecin_anapath: string | null;
  code_icdo: string | null;
  patients: { nom: string; prenom: string; sexe: string; date_naissance: string | null } | null;
}

export default function Anapath() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<PendingCase[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<PendingCase | null>(null);
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Form state for editing a case's anapath results
  const [form, setForm] = useState({
    resultat_anapath: '',
    ref_anapath: '',
    date_anapath: '',
    medecin_anapath: '',
    code_icdo: '',
  });

  useEffect(() => { fetchCases(); }, []);

  const fetchCases = async () => {
    const { data, error } = await supabase
      .from('cancer_cases')
      .select('id, type_cancer, date_diagnostic, ref_anapath, resultat_anapath, date_anapath, medecin_anapath, code_icdo, patients(nom, prenom, sexe, date_naissance)')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erreur chargement');
    else setCases((data as any) || []);
    setLoading(false);
  };

  const pending = useMemo(() => cases.filter(c => !c.resultat_anapath || c.resultat_anapath.trim() === ''), [cases]);
  const completed = useMemo(() => cases.filter(c => c.resultat_anapath && c.resultat_anapath.trim() !== ''), [cases]);

  const filtered = (list: PendingCase[]) => list.filter(c =>
    search === '' ||
    c.patients?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    c.patients?.prenom?.toLowerCase().includes(search.toLowerCase()) ||
    c.type_cancer.toLowerCase().includes(search.toLowerCase()) ||
    c.ref_anapath?.toLowerCase().includes(search.toLowerCase())
  );

  const openCase = (c: PendingCase) => {
    setSelectedCase(c);
    setForm({
      resultat_anapath: c.resultat_anapath || '',
      ref_anapath: c.ref_anapath || '',
      date_anapath: c.date_anapath || new Date().toISOString().slice(0, 10),
      medecin_anapath: c.medecin_anapath || '',
      code_icdo: c.code_icdo || '',
    });
  };

  const saveResult = async () => {
    if (!selectedCase) return;
    setSaving(true);
    const { error } = await supabase
      .from('cancer_cases')
      .update({
        resultat_anapath: form.resultat_anapath,
        ref_anapath: form.ref_anapath || null,
        date_anapath: form.date_anapath || null,
        medecin_anapath: form.medecin_anapath || null,
        code_icdo: form.code_icdo || null,
      })
      .eq('id', selectedCase.id);

    if (error) toast.error(error.message);
    else {
      toast.success('Résultat anatomopathologique enregistré');
      setSelectedCase(null);
      fetchCases();
    }
    setSaving(false);
  };

  const handleOCR = async (file: File) => {
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Upload to storage first
      const fileName = `ocr_${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('anapath-documents')
        .upload(fileName, file);
      if (uploadErr) throw uploadErr;

      // Call OCR edge function
      const { data, error } = await supabase.functions.invoke('ocr-anapath', {
        body: { fileName },
      });
      if (error) throw error;

      if (data) {
        setForm(f => ({
          ...f,
          resultat_anapath: data.resultat || f.resultat_anapath,
          code_icdo: data.code_icdo || f.code_icdo,
          ref_anapath: data.reference || f.ref_anapath,
        }));
        toast.success('Document analysé par IA — Vérifiez les résultats');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur OCR');
    } finally {
      setOcrLoading(false);
    }
  };

  const stats = {
    total: cases.length,
    pending: pending.length,
    completed: completed.length,
    avgTurnaround: completed.length > 0
      ? Math.round(completed.reduce((sum, c) => {
          if (c.date_anapath && c.date_diagnostic) {
            return sum + (new Date(c.date_anapath).getTime() - new Date(c.date_diagnostic).getTime()) / (1000 * 60 * 60 * 24);
          }
          return sum;
        }, 0) / completed.length)
      : 0,
  };

  if (loading) return (
    <AppLayout>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold flex items-center gap-2">
            <Microscope size={24} className="text-primary" />
            Anatomopathologie
          </h1>
          <p className="text-muted-foreground text-sm">Gestion des résultats histologiques — Registre du Cancer</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total dossiers', value: stats.total, icon: FileText, color: 'text-primary' },
            { label: 'En attente', value: stats.pending, icon: Clock, color: 'text-warning' },
            { label: 'Complétés', value: stats.completed, icon: CheckCircle2, color: 'text-success' },
            { label: 'Délai moyen (j)', value: stats.avgTurnaround, icon: AlertTriangle, color: 'text-chart-3' },
          ].map(k => (
            <div key={k.label} className="kpi-card text-center">
              <k.icon size={20} className={cn('mx-auto mb-1', k.color)} />
              <p className={cn('text-2xl font-display font-bold', k.color)}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher par patient, cancer, référence..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock size={14} /> En attente ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5">
              <CheckCircle2 size={14} /> Complétés ({completed.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {filtered(pending).length === 0 ? (
              <div className="stat-card text-center py-12 text-muted-foreground">
                <Microscope size={40} className="mx-auto mb-3 opacity-30" />
                <p>Aucun dossier en attente d'analyse</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered(pending).map(c => (
                  <div key={c.id} className="stat-card flex items-center justify-between gap-4 !py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{c.patients?.nom} {c.patients?.prenom}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.type_cancer} · {new Date(c.date_diagnostic).toLocaleDateString('fr-DZ')}
                        {c.ref_anapath && ` · Réf: ${c.ref_anapath}`}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20 shrink-0">
                      En attente
                    </Badge>
                    <Button size="sm" onClick={() => openCase(c)} className="shrink-0">
                      <Microscope size={14} className="mr-1" /> Saisir résultat
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {filtered(completed).length === 0 ? (
              <div className="stat-card text-center py-12 text-muted-foreground">Aucun résultat trouvé</div>
            ) : (
              <div className="space-y-2">
                {filtered(completed).map(c => (
                  <div key={c.id} className="stat-card !py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{c.patients?.nom} {c.patients?.prenom}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.type_cancer} · Réf: {c.ref_anapath || '—'} · {c.date_anapath ? new Date(c.date_anapath).toLocaleDateString('fr-DZ') : '—'}
                        </p>
                      </div>
                      <Badge className="bg-success/10 text-success border-success/20 shrink-0">Complété</Badge>
                      <Button size="sm" variant="outline" onClick={() => openCase(c)} className="shrink-0">
                        <Eye size={14} className="mr-1" /> Voir/Modifier
                      </Button>
                    </div>
                    {c.resultat_anapath && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 bg-muted/30 rounded-md px-3 py-2">
                        {c.resultat_anapath}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={!!selectedCase} onOpenChange={open => !open && setSelectedCase(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Microscope size={20} className="text-primary" />
                Résultat Anatomopathologique
              </DialogTitle>
            </DialogHeader>

            {selectedCase && (
              <div className="space-y-4">
                {/* Patient info */}
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="font-medium">{selectedCase.patients?.nom} {selectedCase.patients?.prenom}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCase.patients?.sexe === 'M' ? '♂ Homme' : '♀ Femme'} · {selectedCase.type_cancer} · Diag: {new Date(selectedCase.date_diagnostic).toLocaleDateString('fr-DZ')}
                  </p>
                </div>

                {/* OCR Upload */}
                <div className="border border-dashed border-border rounded-lg p-4 text-center">
                  <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Scanner un document anapath (OCR IA)</p>
                  <p className="text-xs text-muted-foreground mb-3">PDF ou image du compte-rendu histologique</p>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    id="ocr-upload"
                    onChange={e => e.target.files?.[0] && handleOCR(e.target.files[0])}
                  />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('ocr-upload')?.click()} disabled={ocrLoading}>
                    {ocrLoading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Upload size={14} className="mr-1" />}
                    {ocrLoading ? 'Analyse en cours...' : 'Importer document'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Référence Anapath</Label>
                    <Input value={form.ref_anapath} onChange={e => setForm(f => ({ ...f, ref_anapath: e.target.value }))} placeholder="Ex: AP-2025-0042" className="mt-1" />
                  </div>
                  <div>
                    <Label>Date Analyse</Label>
                    <Input type="date" value={form.date_anapath} onChange={e => setForm(f => ({ ...f, date_anapath: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Médecin Pathologiste</Label>
                    <Input value={form.medecin_anapath} onChange={e => setForm(f => ({ ...f, medecin_anapath: e.target.value }))} placeholder="Dr..." className="mt-1" />
                  </div>
                  <div>
                    <Label>Code ICD-O (Morphologie)</Label>
                    <Input value={form.code_icdo} onChange={e => setForm(f => ({ ...f, code_icdo: e.target.value }))} placeholder="Ex: 8140/3" className="mt-1" />
                  </div>
                </div>

                <div>
                  <Label>Résultat Histologique</Label>
                  <Textarea
                    value={form.resultat_anapath}
                    onChange={e => setForm(f => ({ ...f, resultat_anapath: e.target.value }))}
                    rows={6}
                    placeholder="Description macroscopique, microscopique, diagnostic histologique, grade..."
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={saveResult} disabled={saving || !form.resultat_anapath} className="flex-1">
                    {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
                    Enregistrer le résultat
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedCase(null)}>Annuler</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

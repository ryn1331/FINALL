import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, ArrowLeft, User, Calendar, MapPin, Phone, FileText,
  Activity, FolderOpen, Clock, Stethoscope, Heart,
  CheckCircle2, XCircle, AlertTriangle, Hash, Building2,
} from 'lucide-react';
import PatientFileUpload from '@/components/PatientFileUpload';
import { cn } from '@/lib/utils';

interface Patient {
  id: string; code_patient: string; nom: string; prenom: string; sexe: string;
  date_naissance: string | null; wilaya: string; commune: string | null;
  adresse: string | null; telephone: string | null; num_dossier: string | null; created_at: string;
}
interface CaseRow {
  id: string; type_cancer: string; sous_type_cancer: string | null; stade_tnm: string | null;
  date_diagnostic: string; statut: string; statut_vital: string | null;
  topographie_icdo: string | null; morphologie_icdo: string | null; grade: string | null;
  lateralite: string | null; created_at: string;
}
interface RdvRow {
  id: string; titre: string; type_rdv: string; date_rdv: string;
  statut: string; medecin: string | null; lieu: string | null; duree_minutes: number;
}

function getAge(dob: string | null): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return `${age} ans`;
}

const statutBadge = (s: string) => {
  if (s === 'valide') return <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Validé</Badge>;
  if (s === 'rejete') return <Badge variant="destructive" className="text-[10px]">Rejeté</Badge>;
  return <Badge variant="secondary" className="text-[10px]">En attente</Badge>;
};
const vitalBadge = (s: string | null) => {
  if (s === 'decede') return <Badge variant="destructive" className="gap-1 text-[10px]"><XCircle size={10} />Décédé</Badge>;
  if (s === 'perdu_de_vue') return <Badge variant="outline" className="gap-1 text-warning border-warning/30 text-[10px]"><AlertTriangle size={10} />Perdu de vue</Badge>;
  return <Badge className="bg-success/10 text-success border-success/20 gap-1 text-[10px]"><CheckCircle2 size={10} />Vivant</Badge>;
};
const rdvTypeBadge = (t: string) => {
  const map: Record<string, string> = {
    consultation: 'bg-primary/10 text-primary', chimio: 'bg-chart-3/10 text-chart-3',
    radio: 'bg-chart-5/10 text-chart-5', chirurgie: 'bg-destructive/10 text-destructive',
    controle: 'bg-success/10 text-success', biopsie: 'bg-accent/10 text-accent',
  };
  return <Badge className={cn('text-[10px]', map[t] || 'bg-muted text-muted-foreground')}>{t}</Badge>;
};

export default function PatientDossier() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [rdvs, setRdvs] = useState<RdvRow[]>([]);
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => { if (id) fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    const [pRes, cRes, rRes, fRes] = await Promise.all([
      supabase.from('patients').select('*').eq('id', id!).single(),
      supabase.from('cancer_cases').select('*').eq('patient_id', id!).order('date_diagnostic', { ascending: false }),
      supabase.from('rendez_vous').select('*').eq('patient_id', id!).order('date_rdv', { ascending: false }).limit(20),
      supabase.from('patient_files').select('id', { count: 'exact', head: true }).eq('patient_id', id!),
    ]);
    if (pRes.data) setPatient(pRes.data as Patient);
    setCases((cRes.data as CaseRow[]) || []);
    setRdvs((rRes.data as RdvRow[]) || []);
    setFileCount(fRes.count || 0);
    setLoading(false);
  };

  if (loading) return <AppLayout><div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div></AppLayout>;
  if (!patient) return <AppLayout><div className="text-center py-20"><p className="text-muted-foreground">Patient non trouvé</p><Link to="/cas"><Button className="mt-4" variant="secondary">Retour</Button></Link></div></AppLayout>;

  const latestCase = cases[0];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link to="/cas"><Button variant="ghost" size="icon" className="mt-1"><ArrowLeft size={18} /></Button></Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-12 h-12 rounded-full medical-gradient flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md">
                {patient.prenom[0]}{patient.nom[0]}
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-xl md:text-2xl font-bold truncate">{patient.nom.toUpperCase()} {patient.prenom}</h1>
                <p className="text-muted-foreground text-sm flex items-center gap-2 flex-wrap">
                  <span>{patient.sexe === 'M' ? '♂ Masculin' : '♀ Féminin'}</span>
                  <span>·</span>
                  <span>{getAge(patient.date_naissance)}</span>
                  {patient.num_dossier && <><span>·</span><span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{patient.num_dossier}</span></>}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">{latestCase && vitalBadge(latestCase.statut_vital)}</div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Stethoscope} label="Cas cancer" value={String(cases.length)} color="text-primary" />
          <KpiCard icon={FolderOpen} label="Documents" value={String(fileCount)} color="text-accent" />
          <KpiCard icon={Calendar} label="Rendez-vous" value={String(rdvs.length)} color="text-chart-3" />
          <KpiCard icon={Clock} label="Suivi depuis" value={new Date(patient.created_at).toLocaleDateString('fr-DZ', { month: 'short', year: 'numeric' })} color="text-chart-5" />
        </div>

        <Tabs defaultValue="info" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4 h-11">
            <TabsTrigger value="info" className="gap-1.5 text-xs md:text-sm"><User size={14} /> Info</TabsTrigger>
            <TabsTrigger value="cases" className="gap-1.5 text-xs md:text-sm"><Stethoscope size={14} /> Cas ({cases.length})</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 text-xs md:text-sm"><FolderOpen size={14} /> Documents</TabsTrigger>
            <TabsTrigger value="rdv" className="gap-1.5 text-xs md:text-sm"><Calendar size={14} /> RDV</TabsTrigger>
          </TabsList>

          {/* INFORMATIONS */}
          <TabsContent value="info">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><User size={16} className="text-primary" /> État civil</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow icon={Hash} label="Code patient" value={patient.code_patient} mono />
                  {patient.num_dossier && <InfoRow icon={FileText} label="N° Dossier" value={patient.num_dossier} mono />}
                  <InfoRow icon={User} label="Nom complet" value={`${patient.nom.toUpperCase()} ${patient.prenom}`} />
                  <InfoRow icon={User} label="Sexe" value={patient.sexe === 'M' ? 'Masculin' : 'Féminin'} />
                  <InfoRow icon={Calendar} label="Date naissance" value={patient.date_naissance ? new Date(patient.date_naissance).toLocaleDateString('fr-DZ') : '—'} />
                  <InfoRow icon={Calendar} label="Âge" value={getAge(patient.date_naissance)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><MapPin size={16} className="text-accent" /> Coordonnées</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow icon={Building2} label="Wilaya" value={patient.wilaya} />
                  {patient.commune && <InfoRow icon={MapPin} label="Commune" value={patient.commune} />}
                  {patient.adresse && <InfoRow icon={MapPin} label="Adresse" value={patient.adresse} />}
                  {patient.telephone && <InfoRow icon={Phone} label="Téléphone" value={patient.telephone} />}
                  <Separator className="my-2" />
                  <InfoRow icon={Clock} label="Créé le" value={new Date(patient.created_at).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' })} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* CAS DE CANCER */}
          <TabsContent value="cases" className="space-y-3">
            {cases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Stethoscope size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Aucun cas de cancer enregistré</p>
              </div>
            ) : cases.map(c => (
              <Link key={c.id} to={`/dossier-cancer/${c.id}`} className="block group">
                <Card className="hover:shadow-md transition-all hover:border-primary/20 cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                          <Activity size={18} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm md:text-base">{c.type_cancer}{c.sous_type_cancer ? ` — ${c.sous_type_cancer}` : ''}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                            <span>Diag. {new Date(c.date_diagnostic).toLocaleDateString('fr-DZ')}</span>
                            {c.stade_tnm && <><span>·</span><span className="font-mono font-medium text-foreground">{c.stade_tnm}</span></>}
                            {c.grade && <><span>·</span><span>{c.grade.split('—')[0]?.trim()}</span></>}
                          </div>
                          {(c.topographie_icdo || c.morphologie_icdo) && (
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono">
                              {c.topographie_icdo && <Badge variant="outline" className="text-[10px] h-5 font-mono">T: {c.topographie_icdo}</Badge>}
                              {c.morphologie_icdo && <Badge variant="outline" className="text-[10px] h-5 font-mono">M: {c.morphologie_icdo}</Badge>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {statutBadge(c.statut)}
                        {vitalBadge(c.statut_vital)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </TabsContent>

          {/* DOCUMENTS */}
          <TabsContent value="documents">
            <PatientFileUpload patientId={patient.id} />
          </TabsContent>

          {/* RDV */}
          <TabsContent value="rdv" className="space-y-3">
            {rdvs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar size={48} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Aucun rendez-vous</p>
              </div>
            ) : rdvs.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-chart-3/10 flex items-center justify-center shrink-0">
                    <Calendar size={16} className="text-chart-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.titre}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.date_rdv).toLocaleDateString('fr-DZ', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {r.medecin && ` · Dr. ${r.medecin}`}{r.lieu && ` · ${r.lieu}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {rdvTypeBadge(r.type_rdv)}
                    <Badge variant={r.statut === 'effectue' ? 'default' : r.statut === 'annule' ? 'destructive' : 'secondary'} className="text-[10px]">{r.statut}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className="text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className={cn('text-sm font-medium', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

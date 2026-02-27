import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, UserPlus, Search, Calendar, Users, ClipboardList, Phone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PatientRow {
  id: string; nom: string; prenom: string; sexe: string; date_naissance: string | null;
  commune: string | null; telephone: string | null; code_patient: string; num_dossier: string | null;
  created_at: string;
}

interface RDVRow {
  id: string; titre: string; date_rdv: string; type_rdv: string; statut: string;
  duree_minutes: number; lieu: string | null; medecin: string | null;
  patients: { nom: string; prenom: string } | null;
}

export default function Assistante() {
  const { fullName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [rdvs, setRdvs] = useState<RDVRow[]>([]);
  const [search, setSearch] = useState('');
  const [pendingCases, setPendingCases] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from('patients').select('*').order('created_at', { ascending: false }),
      supabase.from('rendez_vous').select('*, patients(nom, prenom)').order('date_rdv', { ascending: true }),
      supabase.from('cancer_cases').select('id', { count: 'exact' }).eq('statut', 'en_attente'),
    ]).then(([pRes, rRes, cRes]) => {
      setPatients((pRes.data as PatientRow[]) || []);
      setRdvs((rRes.data as any) || []);
      setPendingCases(cRes.count || 0);
      setLoading(false);
    });
  }, []);

  const todayRdvs = useMemo(() =>
    rdvs.filter(r => isToday(parseISO(r.date_rdv)) && r.statut !== 'annule'),
  [rdvs]);

  const tomorrowRdvs = useMemo(() =>
    rdvs.filter(r => isTomorrow(parseISO(r.date_rdv)) && r.statut !== 'annule'),
  [rdvs]);

  const upcomingRdvs = useMemo(() =>
    rdvs.filter(r => new Date(r.date_rdv) >= new Date() && r.statut !== 'annule').slice(0, 20),
  [rdvs]);

  const recentPatients = useMemo(() => patients.slice(0, 10), [patients]);

  const filteredPatients = useMemo(() =>
    patients.filter(p =>
      search === '' ||
      p.nom.toLowerCase().includes(search.toLowerCase()) ||
      p.prenom.toLowerCase().includes(search.toLowerCase()) ||
      p.code_patient.toLowerCase().includes(search.toLowerCase()) ||
      p.num_dossier?.toLowerCase().includes(search.toLowerCase()) ||
      p.telephone?.includes(search)
    ),
  [patients, search]);

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  };

  const typeColor = (t: string) => {
    switch (t) {
      case 'chimio': return 'bg-destructive/10 text-destructive';
      case 'radio': return 'bg-warning/10 text-warning';
      case 'chirurgie': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'consultation': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) return (
    <AppLayout>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="hero-banner p-5 md:p-6 text-white">
          <div className="relative z-10">
            <p className="text-white/70 text-sm">{greeting()}, {fullName || 'Assistante'}</p>
            <h1 className="font-display text-xl md:text-2xl font-bold mt-1 text-gradient-hero">
              Espace Assistante
            </h1>
            <p className="text-white/60 text-xs mt-1">
              {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })} · {todayRdvs.length} RDV aujourd'hui
            </p>
          </div>
        </div>

        {/* Quick KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Patients enregistrés', value: patients.length, icon: Users, color: 'text-primary' },
            { label: "RDV aujourd'hui", value: todayRdvs.length, icon: Calendar, color: 'text-chart-2' },
            { label: 'RDV demain', value: tomorrowRdvs.length, icon: Calendar, color: 'text-chart-3' },
            { label: 'Cas en attente', value: pendingCases, icon: ClipboardList, color: 'text-warning' },
          ].map(k => (
            <div key={k.label} className="kpi-card text-center">
              <k.icon size={20} className={cn('mx-auto mb-1', k.color)} />
              <p className={cn('text-2xl font-display font-bold', k.color)}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Link to="/nouveau-cas">
            <Button className="gap-1.5">
              <UserPlus size={16} /> Nouveau Patient
            </Button>
          </Link>
          <Link to="/agenda">
            <Button variant="outline" className="gap-1.5">
              <Calendar size={16} /> Planifier RDV
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="today" className="space-y-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="today">📅 Aujourd'hui ({todayRdvs.length})</TabsTrigger>
            <TabsTrigger value="upcoming">📋 À venir ({upcomingRdvs.length})</TabsTrigger>
            <TabsTrigger value="patients">👥 Patients ({patients.length})</TabsTrigger>
          </TabsList>

          {/* Today's RDVs */}
          <TabsContent value="today">
            {todayRdvs.length === 0 ? (
              <div className="stat-card text-center py-12 text-muted-foreground">
                <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                <p>Aucun rendez-vous aujourd'hui</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayRdvs.map(r => (
                  <div key={r.id} className="stat-card !py-3 flex items-center gap-4">
                    <div className="text-center shrink-0 w-14">
                      <p className="text-lg font-bold font-display text-primary">
                        {format(parseISO(r.date_rdv), 'HH:mm')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{r.duree_minutes}min</p>
                    </div>
                    <div className="h-10 w-px bg-border" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{r.titre}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.patients?.nom} {r.patients?.prenom}
                        {r.lieu && ` · ${r.lieu}`}
                        {r.medecin && ` · Dr ${r.medecin}`}
                      </p>
                    </div>
                    <Badge className={typeColor(r.type_rdv)}>{r.type_rdv}</Badge>
                    {r.statut === 'planifie' && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Planifié</Badge>
                    )}
                    {r.statut === 'confirme' && (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">Confirmé</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Upcoming */}
          <TabsContent value="upcoming">
            <div className="space-y-2">
              {upcomingRdvs.map(r => (
                <div key={r.id} className="stat-card !py-3 flex items-center gap-4">
                  <div className="text-center shrink-0 w-20">
                    <p className="text-xs font-medium">{format(parseISO(r.date_rdv), 'dd MMM', { locale: fr })}</p>
                    <p className="text-sm font-bold text-primary">{format(parseISO(r.date_rdv), 'HH:mm')}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{r.titre}</p>
                    <p className="text-xs text-muted-foreground">{r.patients?.nom} {r.patients?.prenom}</p>
                  </div>
                  <Badge className={typeColor(r.type_rdv)}>{r.type_rdv}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Patients */}
          <TabsContent value="patients">
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, code, n° dossier, téléphone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="space-y-2">
              {filteredPatients.slice(0, 30).map(p => (
                <div key={p.id} className="stat-card !py-3 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {p.nom.charAt(0)}{p.prenom.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{p.nom} {p.prenom}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.sexe === 'M' ? '♂' : '♀'} · {p.commune || 'N/A'}
                      {p.num_dossier && ` · Dossier: ${p.num_dossier}`}
                      {p.telephone && ` · ${p.telephone}`}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {p.code_patient}
                  </span>
                  <Link to={`/patient?patient=${p.id}`}>
                    <Button variant="ghost" size="sm" className="h-8">
                      <ArrowRight size={14} />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

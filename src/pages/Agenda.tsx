import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

const TYPES_RDV = ['consultation', 'chimio', 'radio', 'controle', 'biopsie', 'chirurgie', 'suivi'];
const STATUTS_RDV = ['planifie', 'confirme', 'annule', 'termine'];

interface RDV {
  id: string;
  titre: string;
  date_rdv: string;
  duree_minutes: number;
  type_rdv: string;
  lieu: string | null;
  medecin: string | null;
  notes: string | null;
  statut: string;
  patient_id: string;
  patients?: { nom: string; prenom: string } | null;
}

export default function Agenda() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rdvs, setRdvs] = useState<RDV[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<{ id: string; nom: string; prenom: string }[]>([]);

  const [form, setForm] = useState({
    titre: '', patient_id: '', date_rdv: '', heure: '09:00', duree_minutes: '30',
    type_rdv: 'consultation', lieu: '', medecin: '', notes: '',
  });

  useEffect(() => {
    fetchRdvs();
    fetchPatients();
  }, []);

  const fetchRdvs = async () => {
    const { data, error } = await supabase
      .from('rendez_vous')
      .select('*, patients(nom, prenom)')
      .order('date_rdv', { ascending: true });
    if (error) toast.error('Erreur chargement RDV');
    else setRdvs((data as any) || []);
    setLoading(false);
  };

  const fetchPatients = async () => {
    const { data } = await supabase.from('patients').select('id, nom, prenom').order('nom');
    setPatients(data || []);
  };

  const addRdv = async () => {
    if (!user) return;
    setSaving(true);
    const dateTime = `${form.date_rdv}T${form.heure}:00`;
    const { error } = await supabase.from('rendez_vous').insert({
      titre: form.titre,
      patient_id: form.patient_id,
      date_rdv: dateTime,
      duree_minutes: parseInt(form.duree_minutes),
      type_rdv: form.type_rdv,
      lieu: form.lieu || null,
      medecin: form.medecin || null,
      notes: form.notes || null,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('RDV créé');
      setShowAdd(false);
      setForm({ titre: '', patient_id: '', date_rdv: '', heure: '09:00', duree_minutes: '30', type_rdv: 'consultation', lieu: '', medecin: '', notes: '' });
      fetchRdvs();
    }
    setSaving(false);
  };

  const updateStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from('rendez_vous').update({ statut }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Statut mis à jour'); fetchRdvs(); }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: fr });
  const calendarEnd = endOfWeek(monthEnd, { locale: fr });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const rdvsByDate = useMemo(() => {
    const map: Record<string, RDV[]> = {};
    rdvs.forEach(r => {
      const key = format(new Date(r.date_rdv), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [rdvs]);

  const selectedRdvs = selectedDate ? rdvsByDate[format(selectedDate, 'yyyy-MM-dd')] || [] : [];

  const typeColor = (t: string) => {
    switch (t) {
      case 'chimio': return 'bg-destructive/10 text-destructive';
      case 'radio': return 'bg-warning/10 text-warning';
      case 'chirurgie': return 'bg-purple-100 text-purple-700';
      case 'consultation': return 'bg-primary/10 text-primary';
      case 'controle': return 'bg-chart-2/10 text-chart-2';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statutColor = (s: string) => {
    switch (s) {
      case 'confirme': return 'bg-success/10 text-success border-success/20';
      case 'annule': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'termine': return 'bg-muted text-muted-foreground';
      default: return 'bg-primary/10 text-primary border-primary/20';
    }
  };

  const canEdit = role === 'medecin' || role === 'admin' || role === 'assistante';

  if (loading) return (
    <AppLayout>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold">Agenda</h1>
            <p className="text-muted-foreground text-sm">{rdvs.filter(r => r.statut !== 'annule').length} rendez-vous</p>
          </div>
          {canEdit && (
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild>
                <Button className="h-11"><Plus size={16} className="mr-1" /> Nouveau RDV</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nouveau Rendez-vous</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Titre *</Label><Input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Ex: Chimio cycle 3" /></div>
                  <div>
                    <Label>Patient *</Label>
                    <Select value={form.patient_id} onValueChange={v => setForm(f => ({ ...f, patient_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.nom} {p.prenom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date *</Label><Input type="date" value={form.date_rdv} onChange={e => setForm(f => ({ ...f, date_rdv: e.target.value }))} /></div>
                    <div><Label>Heure *</Label><Input type="time" value={form.heure} onChange={e => setForm(f => ({ ...f, heure: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Type</Label>
                      <Select value={form.type_rdv} onValueChange={v => setForm(f => ({ ...f, type_rdv: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TYPES_RDV.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Durée (min)</Label><Input type="number" value={form.duree_minutes} onChange={e => setForm(f => ({ ...f, duree_minutes: e.target.value }))} /></div>
                  </div>
                  <div><Label>Lieu</Label><Input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Ex: Service Oncologie" /></div>
                  <div><Label>Médecin</Label><Input value={form.medecin} onChange={e => setForm(f => ({ ...f, medecin: e.target.value }))} /></div>
                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
                  <Button onClick={addRdv} disabled={!form.titre || !form.patient_id || !form.date_rdv || saving} className="w-full">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Créer RDV
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar */}
          <div className="stat-card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}><ChevronLeft size={18} /></Button>
              <h3 className="font-display font-semibold capitalize">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</h3>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}><ChevronRight size={18} /></Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const dayRdvs = rdvsByDate[key] || [];
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'relative p-2 rounded-lg text-sm transition-colors min-h-[48px] flex flex-col items-center',
                      !isSameMonth(day, currentMonth) && 'text-muted-foreground/40',
                      isSelected && 'bg-primary text-primary-foreground',
                      isToday && !isSelected && 'bg-primary/10 font-bold',
                      !isSelected && 'hover:bg-muted'
                    )}
                  >
                    {format(day, 'd')}
                    {dayRdvs.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {dayRdvs.slice(0, 3).map((r, i) => (
                          <div key={i} className={cn('w-1.5 h-1.5 rounded-full', isSelected ? 'bg-primary-foreground' : r.type_rdv === 'chimio' ? 'bg-destructive' : 'bg-primary')} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day RDVs */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold">
              {selectedDate ? format(selectedDate, 'EEEE d MMMM', { locale: fr }) : 'Sélectionner un jour'}
            </h3>
            {selectedRdvs.length === 0 ? (
              <div className="stat-card text-center text-muted-foreground text-sm py-8">Aucun RDV ce jour</div>
            ) : selectedRdvs.map(r => (
              <div key={r.id} className="stat-card space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={typeColor(r.type_rdv)}>{r.type_rdv}</Badge>
                  <Badge variant="outline" className={statutColor(r.statut)}>{r.statut}</Badge>
                </div>
                <p className="font-medium text-sm">{r.titre}</p>
                <p className="text-xs text-muted-foreground">
                  {(r as any).patients?.nom} {(r as any).patients?.prenom}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock size={12} />{format(new Date(r.date_rdv), 'HH:mm')} ({r.duree_minutes}min)</span>
                  {r.lieu && <span className="flex items-center gap-1"><MapPin size={12} />{r.lieu}</span>}
                </div>
                {canEdit && r.statut === 'planifie' && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="secondary" onClick={() => updateStatut(r.id, 'confirme')} className="flex-1 h-8 text-xs">Confirmer</Button>
                    <Button size="sm" variant="ghost" onClick={() => updateStatut(r.id, 'annule')} className="flex-1 h-8 text-xs text-destructive">Annuler</Button>
                  </div>
                )}
                {canEdit && r.statut === 'confirme' && (
                  <Button size="sm" variant="secondary" onClick={() => updateStatut(r.id, 'termine')} className="w-full h-8 text-xs">Marquer terminé</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

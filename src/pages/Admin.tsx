import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, Shield, Users, CheckCircle, XCircle, AlertTriangle,
  PlusCircle, Trash2, GripVertical, ToggleLeft, ToggleRight, Settings2,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { SERVICES_MEDICAUX, SPECIALITES } from '@/lib/wilayas';
import { cn } from '@/lib/utils';

interface UserRow {
  user_id: string;
  full_name: string;
  role: string;
  service: string | null;
  specialite: string | null;
}

interface PendingCase {
  id: string;
  type_cancer: string | null;
  stade_tnm: string | null;
  date_diagnostic: string | null;
  statut: string;
  patients: { nom: string; prenom: string; commune: string | null } | null;
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

const STEP_OPTIONS = [
  { id: 'identite', label: 'Identité' },
  { id: 'epidemio', label: 'Épidémiologie' },
  { id: 'diagnostic', label: 'Diagnostic' },
  { id: 'topographie', label: 'Topographie' },
  { id: 'morphologie', label: 'Morphologie' },
  { id: 'stade', label: 'Stade TNM' },
  { id: 'traitement', label: 'Traitement / Anapath' },
  { id: 'suivi', label: 'Suivi & Mode de Vie' },
];

const FIELD_TYPES = [
  { id: 'text', label: 'Texte' },
  { id: 'number', label: 'Nombre' },
  { id: 'date', label: 'Date' },
  { id: 'textarea', label: 'Texte long' },
  { id: 'select', label: 'Liste déroulante' },
];

export default function Admin() {
  const { role, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'cases' | 'users' | 'fields'>('cases');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pendingCases, setPendingCases] = useState<PendingCase[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  // New field form
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('text');
  const [newStep, setNewStep] = useState('diagnostic');
  const [newOptions, setNewOptions] = useState('');
  const [addingField, setAddingField] = useState(false);

  useEffect(() => {
    if (role === 'admin') fetchData();
  }, [role]);

  // Only admin can access
  if (role && role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const fetchData = async () => {
    const [usersRes, casesRes, fieldsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, service, specialite'),
      supabase.from('cancer_cases')
        .select('id, type_cancer, stade_tnm, date_diagnostic, statut, patients(nom, prenom, commune)')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false }),
      supabase.from('custom_fields').select('*').order('sort_order', { ascending: true }),
    ]);

    if (usersRes.data) {
      const rolesRes = await supabase.from('user_roles').select('user_id, role');
      const roleMap: Record<string, string> = {};
      rolesRes.data?.forEach((r: any) => { roleMap[r.user_id] = r.role; });

      setUsers(usersRes.data.map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        role: roleMap[p.user_id] || 'medecin',
        service: p.service || null,
        specialite: p.specialite || null,
      })));
    }

    setPendingCases((casesRes.data as any) || []);
    setCustomFields((fieldsRes.data as any) || []);
    setLoading(false);
  };

  const updateRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole as any })
      .eq('user_id', userId);

    if (error) {
      toast.error('Erreur: ' + error.message);
    } else {
      toast.success('Rôle mis à jour');
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, role: newRole } : u));
    }
  };

  const updateProfile = async (userId: string, field: 'service' | 'specialite', value: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value || null })
      .eq('user_id', userId);

    if (error) {
      toast.error('Erreur: ' + error.message);
    } else {
      toast.success(`${field === 'service' ? 'Service' : 'Spécialité'} mis à jour`);
      setUsers((prev) => prev.map((u) => u.user_id === userId ? { ...u, [field]: value } : u));
    }
  };

  const validateCase = async (caseId: string, action: 'valider' | 'rejeter') => {
    setValidatingId(caseId);
    try {
      const res = await supabase.functions.invoke('validate-case', {
        body: { case_id: caseId, action },
      });
      if (res.error) throw res.error;
      if (res.data?.success) {
        toast.success(`Cas ${action === 'valider' ? 'validé' : 'rejeté'}`);
        setPendingCases(prev => prev.filter(c => c.id !== caseId));
      } else {
        throw new Error(res.data?.error || 'Erreur inconnue');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur de validation');
    } finally {
      setValidatingId(null);
    }
  };

  // Custom fields CRUD
  const addCustomField = async () => {
    if (!newLabel.trim()) { toast.error('Le libellé est obligatoire'); return; }
    const key = 'custom_' + newLabel.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');

    const opts = newType === 'select' ? newOptions.split(',').map(o => o.trim()).filter(Boolean) : null;

    setAddingField(true);
    const { data, error } = await supabase.from('custom_fields').insert({
      label: newLabel.trim(),
      field_key: key,
      field_type: newType,
      step_id: newStep,
      options: opts,
      sort_order: customFields.length,
      created_by: user?.id,
    }).select().single();

    if (error) {
      toast.error('Erreur: ' + error.message);
    } else {
      toast.success(`Champ "${newLabel}" ajouté`);
      setCustomFields(prev => [...prev, data as any]);
      setNewLabel('');
      setNewOptions('');
    }
    setAddingField(false);
  };

  const toggleField = async (field: CustomField) => {
    const { error } = await supabase.from('custom_fields').update({ active: !field.active }).eq('id', field.id);
    if (error) { toast.error('Erreur'); return; }
    setCustomFields(prev => prev.map(f => f.id === field.id ? { ...f, active: !f.active } : f));
    toast.success(field.active ? 'Champ désactivé' : 'Champ activé');
  };

  const deleteField = async (field: CustomField) => {
    if (!confirm(`Supprimer le champ "${field.label}" ? Les données associées seront perdues.`)) return;
    const { error } = await supabase.from('custom_fields').delete().eq('id', field.id);
    if (error) { toast.error('Erreur: ' + error.message); return; }
    setCustomFields(prev => prev.filter(f => f.id !== field.id));
    toast.success('Champ supprimé');
  };

  if (loading) return (
    <AppLayout>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="text-primary" size={24} />
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold">Administration</h1>
            <p className="text-muted-foreground text-sm">Utilisateurs, validation, champs personnalisés</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border pb-0 overflow-x-auto no-scrollbar">
          {([
            { id: 'cases' as const, label: 'Validation', count: pendingCases.length },
            { id: 'users' as const, label: 'Utilisateurs', count: users.length },
            { id: 'fields' as const, label: 'Champs perso.', count: customFields.length },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-[2px] whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1.5">{tab.count}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Pending Cases */}
        {activeTab === 'cases' && (
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={18} className="text-warning" />
              <h3 className="font-display font-semibold">Cas en attente ({pendingCases.length})</h3>
            </div>
            {pendingCases.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Aucun cas en attente</p>
            ) : (
              <div className="space-y-3">
                {pendingCases.map(c => (
                  <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div>
                      <p className="font-medium">{c.patients?.nom} {c.patients?.prenom}</p>
                      <p className="text-sm text-primary">{c.type_cancer || 'Type non précisé'} {c.stade_tnm ? `— ${c.stade_tnm}` : ''}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.date_diagnostic ? new Date(c.date_diagnostic).toLocaleDateString('fr-DZ') : 'Date N/A'} · {c.patients?.commune || 'N/A'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-9 bg-success hover:bg-success/90 text-success-foreground"
                        onClick={() => validateCase(c.id, 'valider')} disabled={validatingId === c.id}>
                        {validatingId === c.id ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle size={14} className="mr-1" />}
                        Valider
                      </Button>
                      <Button size="sm" variant="destructive" className="h-9"
                        onClick={() => validateCase(c.id, 'rejeter')} disabled={validatingId === c.id}>
                        <XCircle size={14} className="mr-1" /> Rejeter
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Users */}
        {activeTab === 'users' && (
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-primary" />
              <h3 className="font-display font-semibold">Utilisateurs ({users.length})</h3>
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Nom</th>
                    <th className="pb-3 font-medium">Rôle</th>
                    <th className="pb-3 font-medium">Service</th>
                    <th className="pb-3 font-medium">Spécialité</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.user_id} className="border-b border-border/50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                            {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span className="font-medium">{u.full_name || 'Sans nom'}</span>
                          {u.user_id === user?.id && <Badge variant="secondary" className="text-[10px]">Vous</Badge>}
                        </div>
                      </td>
                      <td className="py-3">
                        <Select value={u.role} onValueChange={v => updateRole(u.user_id, v)} disabled={u.user_id === user?.id}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrateur</SelectItem>
                            <SelectItem value="medecin">Médecin</SelectItem>
                            <SelectItem value="epidemiologiste">Épidémiologiste</SelectItem>
                            <SelectItem value="anapath">Anatomopathologiste</SelectItem>
                            <SelectItem value="assistante">Assistante Médicale</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3">
                        <Select value={u.service || ''} onValueChange={v => updateProfile(u.user_id, 'service', v)}>
                          <SelectTrigger className="w-44"><SelectValue placeholder="Aucun" /></SelectTrigger>
                          <SelectContent>{SERVICES_MEDICAUX.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="py-3">
                        <Select value={u.specialite || ''} onValueChange={v => updateProfile(u.user_id, 'specialite', v)}>
                          <SelectTrigger className="w-44"><SelectValue placeholder="Aucune" /></SelectTrigger>
                          <SelectContent>{SPECIALITES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {users.map(u => (
                <div key={u.user_id} className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                        {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <span className="font-medium text-sm">{u.full_name || 'Sans nom'}</span>
                        {u.service && <p className="text-[10px] text-muted-foreground">{u.service}</p>}
                      </div>
                    </div>
                    {u.user_id === user?.id && <Badge variant="secondary" className="text-[10px]">Vous</Badge>}
                  </div>
                  <Select value={u.role} onValueChange={v => updateRole(u.user_id, v)} disabled={u.user_id === user?.id}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrateur</SelectItem>
                      <SelectItem value="medecin">Médecin</SelectItem>
                      <SelectItem value="epidemiologiste">Épidémiologiste</SelectItem>
                      <SelectItem value="anapath">Anatomopathologiste</SelectItem>
                      <SelectItem value="assistante">Assistante Médicale</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={u.service || ''} onValueChange={v => updateProfile(u.user_id, 'service', v)}>
                    <SelectTrigger><SelectValue placeholder="Service..." /></SelectTrigger>
                    <SelectContent>{SERVICES_MEDICAUX.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Custom Fields */}
        {activeTab === 'fields' && (
          <div className="space-y-4">
            {/* Add new field */}
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-4">
                <PlusCircle size={18} className="text-primary" />
                <h3 className="font-display font-semibold">Ajouter un champ</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Libellé du champ *</Label>
                  <Input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    placeholder="Ex: Globules blancs, Poids, IMC..." className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Onglet destination *</Label>
                  <Select value={newStep} onValueChange={setNewStep}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STEP_OPTIONS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Type de champ</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {newType === 'select' && (
                  <div>
                    <Label className="text-xs">Options (séparées par des virgules)</Label>
                    <Input value={newOptions} onChange={e => setNewOptions(e.target.value)}
                      placeholder="Option 1, Option 2, Option 3" className="mt-1" />
                  </div>
                )}
              </div>
              <Button onClick={addCustomField} disabled={addingField || !newLabel.trim()} className="mt-4">
                {addingField && <Loader2 size={14} className="animate-spin mr-2" />}
                <PlusCircle size={14} className="mr-1" /> Ajouter le champ
              </Button>
            </div>

            {/* Existing fields */}
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 size={18} className="text-primary" />
                <h3 className="font-display font-semibold">Champs personnalisés ({customFields.length})</h3>
              </div>
              {customFields.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Aucun champ personnalisé. Ajoutez-en un ci-dessus pour enrichir le formulaire médecin.
                </p>
              ) : (
                <div className="space-y-2">
                  {customFields.map(field => {
                    const step = STEP_OPTIONS.find(s => s.id === field.step_id);
                    const type = FIELD_TYPES.find(t => t.id === field.field_type);
                    return (
                      <div key={field.id} className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                        field.active ? 'bg-muted/30 border-border/50' : 'bg-muted/10 border-border/20 opacity-60'
                      )}>
                        <GripVertical size={14} className="text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{field.label}</span>
                            <Badge variant="outline" className="text-[10px] h-4">{step?.label}</Badge>
                            <Badge variant="secondary" className="text-[10px] h-4">{type?.label}</Badge>
                            {!field.active && <Badge variant="destructive" className="text-[10px] h-4">Désactivé</Badge>}
                          </div>
                          {field.options && field.options.length > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Options: {field.options.join(', ')}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                            onClick={() => toggleField(field)} title={field.active ? 'Désactiver' : 'Activer'}>
                            {field.active
                              ? <ToggleRight size={16} className="text-success" />
                              : <ToggleLeft size={16} className="text-muted-foreground" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteField(field)} title="Supprimer">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

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
import { Loader2, Shield, Users, CheckCircle, XCircle, Webhook, AlertTriangle, Building2, Stethoscope } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { SERVICES_MEDICAUX, SPECIALITES } from '@/lib/wilayas';

interface UserRow {
  user_id: string;
  full_name: string;
  role: string;
  service: string | null;
  specialite: string | null;
}

interface PendingCase {
  id: string;
  type_cancer: string;
  stade_tnm: string | null;
  date_diagnostic: string;
  statut: string;
  patients: { nom: string; prenom: string; commune: string | null } | null;
}

export default function Admin() {
  const { role, user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pendingCases, setPendingCases] = useState<PendingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('n8n_webhook_url') || '');
  const [validatingId, setValidatingId] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'admin') fetchData();
  }, [role]);

  // Only admin can access
  if (role && role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const fetchData = async () => {
    const [usersRes, casesRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, service, specialite'),
      supabase.from('cancer_cases')
        .select('id, type_cancer, stade_tnm, date_diagnostic, statut, patients(nom, prenom, commune)')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false }),
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

    // Save webhook URL
    if (webhookUrl) localStorage.setItem('n8n_webhook_url', webhookUrl);

    try {
      const res = await supabase.functions.invoke('validate-case', {
        body: {
          case_id: caseId,
          action,
          webhook_url: webhookUrl || null,
        },
      });

      if (res.error) throw res.error;

      const result = res.data;
      if (result.success) {
        toast.success(`Cas ${action === 'valider' ? 'validé' : 'rejeté'} avec succès`);
        if (result.webhook?.ok) {
          toast.success('Webhook n8n déclenché ✓');
        } else if (result.webhook?.error) {
          toast.error('Webhook n8n échoué: ' + result.webhook.error);
        }
        setPendingCases((prev) => prev.filter((c) => c.id !== caseId));
      } else {
        throw new Error(result.error || 'Erreur inconnue');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur de validation');
    } finally {
      setValidatingId(null);
    }
  };

  const roleLabel = (r: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrateur', medecin: 'Médecin', epidemiologiste: 'Épidémiologiste',
      anapath: 'Anatomopathologiste', assistante: 'Assistante Médicale',
    };
    return labels[r] || r;
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
            <p className="text-muted-foreground text-sm">Gestion des utilisateurs et validation des cas</p>
          </div>
        </div>

        {/* n8n Webhook Config */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <Webhook size={18} className="text-primary" />
            <h3 className="font-display font-semibold">Webhook n8n</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="webhook">URL du webhook n8n</Label>
              <Input
                id="webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://votre-instance.n8n.cloud/webhook/..."
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={() => { localStorage.setItem('n8n_webhook_url', webhookUrl); toast.success('URL sauvegardée'); }}>
                Sauvegarder
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Chaque validation/rejet déclenchera ce webhook avec les données du cas.
          </p>
        </div>

        {/* Pending Cases */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-warning" />
            <h3 className="font-display font-semibold">Cas en attente de validation ({pendingCases.length})</h3>
          </div>

          {pendingCases.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Aucun cas en attente</p>
          ) : (
            <div className="space-y-3">
              {pendingCases.map((c) => (
                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <p className="font-medium">{c.patients?.nom} {c.patients?.prenom}</p>
                    <p className="text-sm text-primary">{c.type_cancer} {c.stade_tnm ? `— ${c.stade_tnm}` : ''}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.date_diagnostic).toLocaleDateString('fr-DZ')} · {c.patients?.commune || 'N/A'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-9 bg-success hover:bg-success/90 text-success-foreground"
                      onClick={() => validateCase(c.id, 'valider')}
                      disabled={validatingId === c.id}
                    >
                      {validatingId === c.id ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle size={14} className="mr-1" />}
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-9"
                      onClick={() => validateCase(c.id, 'rejeter')}
                      disabled={validatingId === c.id}
                    >
                      <XCircle size={14} className="mr-1" /> Rejeter
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Users Management */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-primary" />
            <h3 className="font-display font-semibold">Utilisateurs ({users.length})</h3>
          </div>

          {/* Desktop Table */}
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
                 {users.map((u) => (
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
                       <Select value={u.role} onValueChange={(v) => updateRole(u.user_id, v)} disabled={u.user_id === user?.id}>
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
                       <Select value={u.service || ''} onValueChange={(v) => updateProfile(u.user_id, 'service', v)}>
                         <SelectTrigger className="w-44"><SelectValue placeholder="Aucun" /></SelectTrigger>
                         <SelectContent>
                           {SERVICES_MEDICAUX.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                         </SelectContent>
                       </Select>
                     </td>
                     <td className="py-3">
                       <Select value={u.specialite || ''} onValueChange={(v) => updateProfile(u.user_id, 'specialite', v)}>
                         <SelectTrigger className="w-44"><SelectValue placeholder="Aucune" /></SelectTrigger>
                         <SelectContent>
                           {SPECIALITES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                         </SelectContent>
                       </Select>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>

          {/* Mobile Cards */}
           <div className="md:hidden space-y-3">
             {users.map((u) => (
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
                 <Select value={u.role} onValueChange={(v) => updateRole(u.user_id, v)} disabled={u.user_id === user?.id}>
                   <SelectTrigger><SelectValue /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="admin">Administrateur</SelectItem>
                     <SelectItem value="medecin">Médecin</SelectItem>
                     <SelectItem value="epidemiologiste">Épidémiologiste</SelectItem>
                     <SelectItem value="anapath">Anatomopathologiste</SelectItem>
                     <SelectItem value="assistante">Assistante Médicale</SelectItem>
                   </SelectContent>
                 </Select>
                 <Select value={u.service || ''} onValueChange={(v) => updateProfile(u.user_id, 'service', v)}>
                   <SelectTrigger><SelectValue placeholder="Service..." /></SelectTrigger>
                   <SelectContent>{SERVICES_MEDICAUX.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                 </Select>
               </div>
             ))}
           </div>
        </div>
      </div>
    </AppLayout>
  );
}

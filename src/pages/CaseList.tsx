import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Eye, Trash2, Loader2, User, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface CaseRow {
  id: string;
  type_cancer: string;
  stade_tnm: string | null;
  date_diagnostic: string;
  statut: string;
  created_at: string;
  patient_id: string;
  patients: {
    nom: string;
    prenom: string;
    sexe: string;
    date_naissance: string | null;
    commune: string | null;
  } | null;
}

export default function CaseList() {
  const { role } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSexe, setFilterSexe] = useState('all');

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    const { data, error } = await supabase
      .from('cancer_cases')
      .select('id, type_cancer, stade_tnm, date_diagnostic, statut, created_at, patient_id, patients(nom, prenom, sexe, date_naissance, commune)')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erreur lors du chargement');
      console.error(error);
    } else {
      setCases((data as any) || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce cas ?')) return;
    const { error } = await supabase.from('cancer_cases').delete().eq('id', id);
    if (error) {
      toast.error('Erreur de suppression');
    } else {
      toast.success('Cas supprimé');
      setCases((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const filtered = cases.filter((c) => {
    const matchSearch = search === '' ||
      c.type_cancer.toLowerCase().includes(search.toLowerCase()) ||
      c.patients?.nom?.toLowerCase().includes(search.toLowerCase()) ||
      c.patients?.prenom?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || c.type_cancer === filterType;
    const matchSexe = filterSexe === 'all' || c.patients?.sexe === filterSexe;
    return matchSearch && matchType && matchSexe;
  });

  const uniqueTypes = [...new Set(cases.map((c) => c.type_cancer))];

  const statutBadge = (s: string) => {
    if (s === 'valide') return <Badge className="bg-success/10 text-success border-success/20">Validé</Badge>;
    if (s === 'rejete') return <Badge variant="destructive">Rejeté</Badge>;
    return <Badge variant="secondary">En attente</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold">Liste des Cas</h1>
            <p className="text-muted-foreground text-sm">{filtered.length} cas trouvé(s)</p>
          </div>
          <Link to="/nouveau-cas">
            <Button className="h-11 w-full sm:w-auto">
              <Plus size={16} className="mr-1" /> Nouveau Cas
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {uniqueTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSexe} onValueChange={setFilterSexe}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Sexe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="M">Masculin</SelectItem>
              <SelectItem value="F">Féminin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cases Table/Cards */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={32} /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Aucun cas trouvé</p>
            <p className="text-sm mt-1">Commencez par ajouter un nouveau cas</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Patient</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Stade</th>
                    <th className="pb-3 font-medium">Date Diag.</th>
                    <th className="pb-3 font-medium">Statut</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3">
                        <p className="font-medium">{c.patients?.nom} {c.patients?.prenom}</p>
                        <p className="text-xs text-muted-foreground">{c.patients?.sexe === 'M' ? '♂' : '♀'} · {c.patients?.commune || 'N/A'}</p>
                      </td>
                      <td className="py-3">{c.type_cancer}</td>
                      <td className="py-3">{c.stade_tnm || '—'}</td>
                      <td className="py-3">{new Date(c.date_diagnostic).toLocaleDateString('fr-DZ')}</td>
                      <td className="py-3">{statutBadge(c.statut)}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Link to={`/dossier-patient/${c.patient_id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Dossier patient"><User size={14} /></Button>
                          </Link>
                          <Link to={`/dossier-cancer/${c.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Dossier cancer"><FileText size={14} /></Button>
                          </Link>
                          {role === 'admin' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}>
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((c) => (
                <div key={c.id} className="stat-card">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{c.patients?.nom} {c.patients?.prenom}</p>
                      <p className="text-xs text-muted-foreground">{c.patients?.sexe === 'M' ? '♂' : '♀'} · {c.patients?.commune || 'N/A'}</p>
                    </div>
                    {statutBadge(c.statut)}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-sm font-medium text-primary">{c.type_cancer}</p>
                      <p className="text-xs text-muted-foreground">{new Date(c.date_diagnostic).toLocaleDateString('fr-DZ')}</p>
                    </div>
                    <div className="flex gap-1">
                      <Link to={`/dossier-patient/${c.patient_id}`}>
                        <Button variant="outline" size="sm" className="h-9 gap-1"><User size={14} /> Patient</Button>
                      </Link>
                      <Link to={`/dossier-cancer/${c.id}`}>
                        <Button variant="secondary" size="sm" className="h-9 gap-1"><FileText size={14} /> Cancer</Button>
                      </Link>
                      {role === 'admin' && (
                        <Button variant="ghost" size="sm" className="h-9 text-destructive" onClick={() => handleDelete(c.id)}>
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

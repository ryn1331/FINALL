import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, BarChart3, Shield, Database, Download, Globe, Microscope, Target, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import EpidemiologyDashboard from '@/components/stats/EpidemiologyDashboard';
import DetailedAnalysis from '@/components/stats/DetailedAnalysis';
import ReportEditor from '@/components/stats/ReportEditor';
import CanRegExport from '@/components/stats/CanRegExport';
import DataImport from '@/components/stats/DataImport';
import type { CaseWithPatient, PopulationRow } from '@/lib/epidemiology';
import { microscopicVerification, stagingCompleteness, unknownPrimarySite } from '@/lib/epidemiology';

interface RawCase {
  id: string; type_cancer: string; date_diagnostic: string; statut: string;
  stade_tnm: string | null; resultat_anapath: string | null; code_icdo: string | null;
  patients: { sexe: string | null; date_naissance: string | null; commune: string | null } | null;
}

export default function EpidemiologisteDashboard() {
  const { fullName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<RawCase[]>([]);
  const [population, setPopulation] = useState<PopulationRow[]>([]);
  const [traitements, setTraitements] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('cancer_cases').select('id, type_cancer, date_diagnostic, statut, stade_tnm, resultat_anapath, code_icdo, patients(sexe, date_naissance, commune)'),
      supabase.from('population_reference').select('tranche_age, sexe, population'),
      supabase.from('traitements').select('type_traitement, efficacite, effets_secondaires'),
    ]).then(([cRes, pRes, tRes]) => {
      setCases((cRes.data as RawCase[]) || []);
      setPopulation((pRes.data as PopulationRow[]) || []);
      setTraitements(tRes.data || []);
      setLoading(false);
    });
  }, []);

  const casesForEpi: CaseWithPatient[] = cases.map(c => ({
    type_cancer: c.type_cancer,
    date_diagnostic: c.date_diagnostic,
    stade_tnm: c.stade_tnm,
    resultat_anapath: c.resultat_anapath,
    code_icdo: c.code_icdo,
    patients: c.patients,
  }));

  // Data quality summary
  const mv = useMemo(() => microscopicVerification(casesForEpi), [casesForEpi]);
  const staging = useMemo(() => stagingCompleteness(casesForEpi), [casesForEpi]);
  const unknown = useMemo(() => unknownPrimarySite(casesForEpi), [casesForEpi]);

  const validatedCases = cases.filter(c => c.statut === 'valide').length;
  const pendingCases = cases.filter(c => c.statut === 'en_attente').length;

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
            <p className="text-white/70 text-sm">Espace Épidémiologiste</p>
            <h1 className="font-display text-xl md:text-2xl font-bold mt-1 text-gradient-hero">
              Registre du Cancer — Wilaya de Tlemcen
            </h1>
            <p className="text-white/60 text-xs mt-1">
              Standards IARC/OMS · {cases.length} cas · {validatedCases} validés · {pendingCases} en attente
            </p>
          </div>
        </div>

        {/* Quick quality overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total cas', value: cases.length, icon: Database, color: 'text-primary' },
            { label: 'Validés', value: validatedCases, icon: Shield, color: 'text-success' },
            { label: 'MV%', value: mv.toFixed(0) + '%', icon: Microscope, color: mv >= 75 ? 'text-success' : 'text-warning' },
            { label: 'Staging%', value: staging.toFixed(0) + '%', icon: Target, color: staging >= 60 ? 'text-success' : 'text-warning' },
            { label: 'Site inconnu', value: unknown.toFixed(0) + '%', icon: AlertTriangle, color: unknown <= 10 ? 'text-success' : 'text-destructive' },
          ].map(k => (
            <div key={k.label} className="kpi-card text-center">
              <k.icon size={18} className={cn('mx-auto mb-1', k.color)} />
              <p className={cn('text-xl font-display font-bold', k.color)}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard">📊 Tableau de bord</TabsTrigger>
            <TabsTrigger value="analysis">🔬 Analyse détaillée</TabsTrigger>
            <TabsTrigger value="reports">📄 Rapports</TabsTrigger>
            <TabsTrigger value="export">📤 Export CanReg5</TabsTrigger>
            <TabsTrigger value="import">📥 Import données</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <EpidemiologyDashboard cases={casesForEpi} population={population} />
          </TabsContent>

          <TabsContent value="analysis">
            <DetailedAnalysis cases={casesForEpi} population={population} traitements={traitements} />
          </TabsContent>

          <TabsContent value="reports">
            <ReportEditor cases={casesForEpi} population={population} traitements={traitements} />
          </TabsContent>

          <TabsContent value="export">
            <CanRegExport cases={casesForEpi} population={population} />
          </TabsContent>

          <TabsContent value="import">
            <DataImport />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

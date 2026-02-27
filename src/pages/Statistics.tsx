import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Loader2, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import EpidemiologyDashboard from '@/components/stats/EpidemiologyDashboard';
import DetailedAnalysis from '@/components/stats/DetailedAnalysis';
import ReportEditor from '@/components/stats/ReportEditor';
import CrossTabAnalysis from '@/components/stats/CrossTabAnalysis';
import CanRegExport from '@/components/stats/CanRegExport';
import DataImport from '@/components/stats/DataImport';
import type { CaseWithPatient, PopulationRow } from '@/lib/epidemiology';

/* ── Filter constants ── */
const AGE_OPTIONS = ['Tous', '0-20', '21-40', '41-60', '61+'] as const;
const SEXE_OPTIONS = ['Tous', 'Homme', 'Femme'] as const;
const CANCER_OPTIONS = ['Tous', 'Poumon', 'Sein', 'Colorectal', 'Foie', 'Prostate', 'Vessie'] as const;
const YEAR_INTERVALS = [
  { label: '2 ans', value: 2 },
  { label: '5 ans', value: 5 },
  { label: '10 ans', value: 10 },
  { label: 'Tout', value: 0 },
] as const;

function FilterDropdown({ label, options, value, onChange }: {
  label: string; options: readonly string[]; value: string; onChange: (v: string) => void;
}) {
  const isActive = value !== 'Tous';
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(
          'group relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          'border border-transparent hover:border-border hover:bg-accent/50 hover:shadow-sm',
          isActive && 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'
        )}>
          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
          <span className={cn('font-semibold', isActive ? 'text-primary' : 'text-foreground')}>{value}</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1.5" sideOffset={6}>
        <div className="space-y-0.5">
          {options.map(opt => (
            <button key={opt} onClick={() => onChange(opt)}
              className={cn('w-full text-left px-3 py-2 rounded-md text-sm transition-all', 'hover:bg-accent',
                value === opt && 'bg-primary/10 text-primary font-semibold'
              )}>{opt}</button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function YearIntervalSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
      {YEAR_INTERVALS.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            value === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}>{opt.label}</button>
      ))}
    </div>
  );
}

interface RawCase {
  id: string; type_cancer: string; date_diagnostic: string; statut: string;
  stade_tnm: string | null; resultat_anapath: string | null; code_icdo: string | null;
  milieu: string | null; methode_diagnostic: string | null;
  patients: { sexe: string | null; date_naissance: string | null; commune: string | null } | null;
}

export default function Statistics() {
  const [loading, setLoading] = useState(true);
  const [allCases, setAllCases] = useState<RawCase[]>([]);
  const [allTraitements, setAllTraitements] = useState<any[]>([]);
  const [population, setPopulation] = useState<PopulationRow[]>([]);
  const [filterAge, setFilterAge] = useState('Tous');
  const [filterSexe, setFilterSexe] = useState('Tous');
  const [filterCancer, setFilterCancer] = useState('Tous');
  const [yearInterval, setYearInterval] = useState(0);

  useEffect(() => {
    Promise.all([
      supabase.from('cancer_cases').select('id, type_cancer, date_diagnostic, statut, stade_tnm, resultat_anapath, code_icdo, milieu, methode_diagnostic, patients(sexe, date_naissance, commune)'),
      supabase.from('traitements').select('type_traitement, efficacite, effets_secondaires'),
      supabase.from('population_reference').select('tranche_age, sexe, population'),
    ]).then(([casesRes, traitRes, popRes]) => {
      setAllCases((casesRes.data as RawCase[]) || []);
      setAllTraitements(traitRes.data || []);
      setPopulation((popRes.data as PopulationRow[]) || []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const cutoffYear = yearInterval > 0 ? now.getFullYear() - yearInterval : 0;
    return allCases.filter(c => {
      const diagYear = new Date(c.date_diagnostic).getFullYear();
      if (cutoffYear > 0 && diagYear < cutoffYear) return false;
      if (filterAge !== 'Tous' && c.patients?.date_naissance) {
        const age = now.getFullYear() - new Date(c.patients.date_naissance).getFullYear();
        if (filterAge === '0-20' && age > 20) return false;
        if (filterAge === '21-40' && (age < 21 || age > 40)) return false;
        if (filterAge === '41-60' && (age < 41 || age > 60)) return false;
        if (filterAge === '61+' && age < 61) return false;
      }
      if (filterSexe === 'Homme' && c.patients?.sexe !== 'M') return false;
      if (filterSexe === 'Femme' && c.patients?.sexe !== 'F') return false;
      if (filterCancer !== 'Tous' && c.type_cancer !== filterCancer) return false;
      return true;
    });
  }, [allCases, filterAge, filterSexe, filterCancer, yearInterval]);

  const casesForEpi: CaseWithPatient[] = filtered.map(c => ({
    type_cancer: c.type_cancer,
    date_diagnostic: c.date_diagnostic,
    stade_tnm: c.stade_tnm,
    resultat_anapath: c.resultat_anapath,
    code_icdo: c.code_icdo,
    patients: c.patients,
    milieu: c.milieu,
    methode_diagnostic: c.methode_diagnostic,
  } as any));

  const activeFilterCount = [filterAge, filterSexe, filterCancer].filter(v => v !== 'Tous').length + (yearInterval !== 0 ? 1 : 0);

  if (loading) return (
    <AppLayout>
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold">Module Épidémiologique</h1>
          <p className="text-muted-foreground text-sm">
            Standards IARC/OMS · Wilaya de Tlemcen · {filtered.length} cas
            {activeFilterCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{activeFilterCount}</span>
            )}
          </p>
        </div>

        {/* Filters */}
        <div className="stat-card !p-2 flex flex-wrap items-center gap-1">
          <div className="flex items-center gap-1 px-2 text-muted-foreground">
            <SlidersHorizontal size={14} />
            <span className="text-xs font-medium hidden sm:inline">Filtres</span>
          </div>
          <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
          <FilterDropdown label="Âge" options={AGE_OPTIONS} value={filterAge} onChange={setFilterAge} />
          <FilterDropdown label="Sexe" options={SEXE_OPTIONS} value={filterSexe} onChange={setFilterSexe} />
          <FilterDropdown label="Cancer" options={CANCER_OPTIONS} value={filterCancer} onChange={setFilterCancer} />
          <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
          <YearIntervalSelector value={yearInterval} onChange={setYearInterval} />
          {activeFilterCount > 0 && (
            <button onClick={() => { setFilterAge('Tous'); setFilterSexe('Tous'); setFilterCancer('Tous'); setYearInterval(0); }}
              className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1">Réinitialiser</button>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="dashboard">📊 Tableau de bord</TabsTrigger>
            <TabsTrigger value="analysis">🔬 Analyse détaillée</TabsTrigger>
            <TabsTrigger value="crosstab">🔀 Croisement</TabsTrigger>
            <TabsTrigger value="reports">📄 Rapports</TabsTrigger>
            <TabsTrigger value="export">📤 Export</TabsTrigger>
            <TabsTrigger value="import">📥 Import</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <EpidemiologyDashboard cases={casesForEpi} population={population} />
          </TabsContent>

          <TabsContent value="analysis">
            <DetailedAnalysis cases={casesForEpi} population={population} traitements={allTraitements} />
          </TabsContent>

          <TabsContent value="crosstab">
            <CrossTabAnalysis cases={casesForEpi} population={population} traitements={allTraitements} />
          </TabsContent>

          <TabsContent value="reports">
            <ReportEditor cases={casesForEpi} population={population} traitements={allTraitements} />
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

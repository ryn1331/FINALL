import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  type CaseWithPatient, type PopulationRow,
  AGE_GROUPS, getAge, getAgeGroup, casesToAgeMap, populationToAgeMap,
  calculateASR, crudeRate, sexRatio, medianAge, meanAge,
  SEGI_WEIGHTS, SEGI_TOTAL,
} from '@/lib/epidemiology';

const COLORS = [
  'hsl(213, 80%, 50%)', 'hsl(170, 60%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 55%)', 'hsl(280, 60%, 55%)', 'hsl(200, 70%, 50%)',
  'hsl(30, 80%, 50%)', 'hsl(160, 50%, 45%)', 'hsl(320, 60%, 50%)',
  'hsl(50, 80%, 45%)', 'hsl(240, 50%, 55%)', 'hsl(100, 50%, 40%)',
];

type Axis = 'type_cancer' | 'sexe' | 'tranche_age' | 'commune' | 'annee' | 'stade' | 'milieu' | 'methode_diag';
type ChartType = 'bar' | 'hbar' | 'pie' | 'line' | 'area' | 'radar' | 'scatter' | 'heatmap' | 'pyramid' | 'table';

const AXIS_OPTIONS: { value: Axis; label: string }[] = [
  { value: 'type_cancer', label: 'Type de cancer' },
  { value: 'sexe', label: 'Sexe' },
  { value: 'tranche_age', label: "Tranche d'âge" },
  { value: 'commune', label: 'Commune' },
  { value: 'annee', label: 'Année de diagnostic' },
  { value: 'stade', label: 'Stade TNM' },
  { value: 'milieu', label: 'Milieu (Urbain/Rural)' },
  { value: 'methode_diag', label: 'Méthode diagnostique' },
];

const CHART_OPTIONS: { value: ChartType; label: string; icon: string }[] = [
  { value: 'bar', label: 'Barres verticales', icon: '📊' },
  { value: 'hbar', label: 'Barres horizontales', icon: '📊' },
  { value: 'pie', label: 'Camembert', icon: '🥧' },
  { value: 'line', label: 'Courbe', icon: '📈' },
  { value: 'area', label: 'Aire', icon: '📉' },
  { value: 'radar', label: 'Radar', icon: '🕸️' },
  { value: 'heatmap', label: 'Carte de chaleur', icon: '🔥' },
  { value: 'pyramid', label: "Pyramide des âges", icon: '🏛️' },
  { value: 'table', label: 'Tableau croisé', icon: '📋' },
];

interface Props {
  cases: CaseWithPatient[];
  population: PopulationRow[];
  traitements: any[];
}

function getAxisValue(c: CaseWithPatient, axis: Axis): string {
  switch (axis) {
    case 'type_cancer': return c.type_cancer || 'Inconnu';
    case 'sexe': return c.patients?.sexe === 'M' ? 'Homme' : c.patients?.sexe === 'F' ? 'Femme' : 'Inconnu';
    case 'tranche_age':
      if (!c.patients?.date_naissance) return 'Inconnu';
      return getAgeGroup(c.patients.date_naissance, c.date_diagnostic);
    case 'commune': return c.patients?.commune || 'Non précisé';
    case 'annee': return new Date(c.date_diagnostic).getFullYear().toString();
    case 'stade': return (c as any).stade_tnm || 'Non précisé';
    case 'milieu': return (c as any).milieu || 'Non précisé';
    case 'methode_diag': return (c as any).methode_diagnostic || 'Non précisé';
  }
}

function crossTabulate(cases: CaseWithPatient[], rowAxis: Axis, colAxis: Axis) {
  const rowValues = new Set<string>();
  const colValues = new Set<string>();
  const matrix: Record<string, Record<string, number>> = {};

  cases.forEach(c => {
    const rv = getAxisValue(c, rowAxis);
    const cv = getAxisValue(c, colAxis);
    rowValues.add(rv);
    colValues.add(cv);
    if (!matrix[rv]) matrix[rv] = {};
    matrix[rv][cv] = (matrix[rv][cv] || 0) + 1;
  });

  const rows = [...rowValues].sort();
  const cols = [...colValues].sort();
  return { rows, cols, matrix };
}

export default function CrossTabAnalysis({ cases, population, traitements }: Props) {
  const [rowAxis, setRowAxis] = useState<Axis>('type_cancer');
  const [colAxis, setColAxis] = useState<Axis>('sexe');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [presetTab, setPresetTab] = useState('custom');

  // Cross-tab data
  const { rows, cols, matrix } = useMemo(() => crossTabulate(cases, rowAxis, colAxis), [cases, rowAxis, colAxis]);

  // Flattened chart data
  const chartData = useMemo(() => {
    return rows.map(r => {
      const row: Record<string, any> = { name: r, total: 0 };
      cols.forEach(c => {
        row[c] = matrix[r]?.[c] || 0;
        row.total += row[c];
      });
      return row;
    }).sort((a, b) => b.total - a.total);
  }, [rows, cols, matrix]);

  // Pie data (uses row axis only)
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    cases.forEach(c => {
      const v = getAxisValue(c, rowAxis);
      counts[v] = (counts[v] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [cases, rowAxis]);

  // Pyramid data
  const pyramidData = useMemo(() => {
    const bins: Record<string, { male: number; female: number }> = {};
    const ageLabels = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80+'];
    ageLabels.forEach(a => { bins[a] = { male: 0, female: 0 }; });
    cases.forEach(c => {
      if (!c.patients?.date_naissance) return;
      const age = getAge(c.patients.date_naissance, c.date_diagnostic);
      let bin: string;
      if (age < 10) bin = '0-9';
      else if (age < 20) bin = '10-19';
      else if (age < 30) bin = '20-29';
      else if (age < 40) bin = '30-39';
      else if (age < 50) bin = '40-49';
      else if (age < 60) bin = '50-59';
      else if (age < 70) bin = '60-69';
      else if (age < 80) bin = '70-79';
      else bin = '80+';
      if (c.patients.sexe === 'M') bins[bin].male++;
      else bins[bin].female++;
    });
    return ageLabels.map(age => ({ age, male: -bins[age].male, female: bins[age].female, maleAbs: bins[age].male, femaleAbs: bins[age].female }));
  }, [cases]);

  // Heatmap max
  const heatMax = useMemo(() => Math.max(...Object.values(matrix).flatMap(r => Object.values(r)), 1), [matrix]);

  // Preset analyses
  const presets = useMemo(() => ({
    incidence_age_sexe: { row: 'tranche_age' as Axis, col: 'sexe' as Axis, chart: 'bar' as ChartType, label: 'Incidence par âge et sexe' },
    cancer_commune: { row: 'type_cancer' as Axis, col: 'commune' as Axis, chart: 'hbar' as ChartType, label: 'Cancer par commune' },
    cancer_annee: { row: 'annee' as Axis, col: 'type_cancer' as Axis, chart: 'line' as ChartType, label: 'Évolution par type' },
    stade_cancer: { row: 'type_cancer' as Axis, col: 'stade' as Axis, chart: 'heatmap' as ChartType, label: 'Stade par cancer' },
    milieu_sexe: { row: 'milieu' as Axis, col: 'sexe' as Axis, chart: 'pie' as ChartType, label: 'Milieu par sexe' },
    methode_cancer: { row: 'type_cancer' as Axis, col: 'methode_diag' as Axis, chart: 'hbar' as ChartType, label: 'Méthode diagnostique' },
    age_pyramid: { row: 'tranche_age' as Axis, col: 'sexe' as Axis, chart: 'pyramid' as ChartType, label: "Pyramide des âges" },
    cancer_radar: { row: 'type_cancer' as Axis, col: 'sexe' as Axis, chart: 'radar' as ChartType, label: 'Radar par cancer' },
  }), []);

  const applyPreset = (key: string) => {
    const p = (presets as any)[key];
    if (p) {
      setRowAxis(p.row);
      setColAxis(p.col);
      setChartType(p.chart);
    }
  };

  const renderChart = () => {
    const displayData = chartData.slice(0, 25);
    const displayCols = cols.slice(0, 12);

    switch (chartType) {
      case 'bar':
        return (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend />
                {displayCols.map((c, i) => (
                  <Bar key={c} dataKey={c} name={c} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} stackId={displayCols.length > 3 ? 'stack' : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'hbar':
        return (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend />
                {displayCols.map((c, i) => (
                  <Bar key={c} dataKey={c} name={c} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} stackId={displayCols.length > 3 ? 'stack' : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'pie':
        return (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.slice(0, 12)}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={110}
                  paddingAngle={2} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.slice(0, 12).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      case 'line':
        return (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend />
                {displayCols.map((c, i) => (
                  <Line key={c} type="monotone" dataKey={c} name={c} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case 'area':
        return (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend />
                {displayCols.map((c, i) => (
                  <Area key={c} type="monotone" dataKey={c} name={c} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );

      case 'radar':
        const radarData = displayData.slice(0, 8).map(d => {
          const entry: Record<string, any> = { subject: d.name };
          displayCols.forEach(c => { entry[c] = d[c] || 0; });
          return entry;
        });
        return (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis tick={{ fontSize: 10 }} />
                {displayCols.map((c, i) => (
                  <Radar key={c} name={c} dataKey={c} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
                ))}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'pyramid':
        return (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pyramidData} layout="vertical" stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => Math.abs(v).toString()} />
                <YAxis dataKey="age" type="category" width={50} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => Math.abs(v)} contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend />
                <Bar dataKey="male" name="Hommes" fill="hsl(213, 80%, 50%)" radius={[4, 0, 0, 4]} />
                <Bar dataKey="female" name="Femmes" fill="hsl(340, 65%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'heatmap':
        const displayRows = rows.slice(0, 20);
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pr-2 text-left font-medium text-muted-foreground sticky left-0 bg-card z-10">↓ Lignes / Colonnes →</th>
                  {displayCols.map(c => (
                    <th key={c} className="pb-2 px-1 text-center font-medium text-muted-foreground min-w-[55px]">{c}</th>
                  ))}
                  <th className="pb-2 px-1 text-center font-bold text-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(r => {
                  const rowTotal = displayCols.reduce((s, c) => s + (matrix[r]?.[c] || 0), 0);
                  return (
                    <tr key={r} className="border-b border-border/20">
                      <td className="py-1.5 pr-2 font-medium text-muted-foreground sticky left-0 bg-card z-10">{r}</td>
                      {displayCols.map(c => {
                        const val = matrix[r]?.[c] || 0;
                        const intensity = val / heatMax;
                        return (
                          <td key={c} className="py-1.5 px-1 text-center">
                            {val > 0 ? (
                              <span
                                className="inline-flex items-center justify-center w-9 h-6 rounded text-[10px] font-bold"
                                style={{
                                  background: `hsl(213, 80%, ${88 - intensity * 50}%)`,
                                  color: intensity > 0.4 ? 'white' : 'hsl(213, 80%, 25%)',
                                }}
                              >
                                {val}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/20">·</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-1.5 px-1 text-center font-bold">{rowTotal}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border">
                  <td className="py-2 pr-2 font-bold sticky left-0 bg-card z-10">Total</td>
                  {displayCols.map(c => {
                    const colTotal = displayRows.reduce((s, r) => s + (matrix[r]?.[c] || 0), 0);
                    return <td key={c} className="py-2 px-1 text-center font-bold">{colTotal}</td>;
                  })}
                  <td className="py-2 px-1 text-center font-bold text-primary">
                    {displayRows.reduce((s, r) => s + displayCols.reduce((s2, c) => s2 + (matrix[r]?.[c] || 0), 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      case 'table':
        return renderChart(); // same as heatmap
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      {/* Preset analyses */}
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-3">⚡ Analyses Prédéfinies (style CanReg5)</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(presets).map(([key, p]) => (
            <button
              key={key}
              onClick={() => { applyPreset(key); setPresetTab('custom'); }}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium transition-all border',
                'border-border/50 hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
                'active:scale-95'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom cross-tab builder */}
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">🔀 Croisement Personnalisé</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Axe des lignes (Y)</Label>
            <Select value={rowAxis} onValueChange={v => setRowAxis(v as Axis)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AXIS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Axe des colonnes (X)</Label>
            <Select value={colAxis} onValueChange={v => setColAxis(v as Axis)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AXIS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Type de graphique</Label>
            <Select value={chartType} onValueChange={v => setChartType(v as ChartType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHART_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.icon} {o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-muted/20 rounded-lg p-1 mb-4">
          <p className="text-xs text-muted-foreground text-center py-1">
            <strong>{AXIS_OPTIONS.find(a => a.value === rowAxis)?.label}</strong> × <strong>{AXIS_OPTIONS.find(a => a.value === colAxis)?.label}</strong>
            {' — '}{cases.length} cas · {rows.length} lignes × {cols.length} colonnes
          </p>
        </div>

        {renderChart()}
      </div>

      {/* Summary stats */}
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-3">📋 Résumé du Croisement</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: 'Total cas', v: cases.length },
            { l: 'Lignes uniques', v: rows.length },
            { l: 'Colonnes uniques', v: cols.length },
            { l: 'Cellules non-vides', v: Object.values(matrix).reduce((s, r) => s + Object.keys(r).length, 0) },
          ].map(item => (
            <div key={item.l} className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-xl font-bold font-display text-primary">{item.v}</p>
              <p className="text-[10px] text-muted-foreground">{item.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

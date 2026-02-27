import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { MapPin, TrendingUp } from 'lucide-react';
import {
  type CaseWithPatient, type PopulationRow,
  AGE_GROUPS, casesToAgeMap, populationToAgeMap, ageSpecificRate,
  annualPercentChange, crudeRate, getAge,
} from '@/lib/epidemiology';
import { cn } from '@/lib/utils';

const MALE_COLOR = 'hsl(213, 80%, 50%)';
const FEMALE_COLOR = 'hsl(340, 65%, 55%)';
const COLORS = [MALE_COLOR, 'hsl(170,60%,42%)', 'hsl(38,92%,50%)', 'hsl(0,72%,55%)', 'hsl(280,60%,55%)', 'hsl(200,70%,50%)', 'hsl(30,80%,50%)'];

interface Props {
  cases: CaseWithPatient[];
  population: PopulationRow[];
  traitements: any[];
}

export default function DetailedAnalysis({ cases, population, traitements }: Props) {
  // Age-specific incidence by sex
  const ageSpecific = useMemo(() => {
    const mCases = casesToAgeMap(cases, 'M');
    const fCases = casesToAgeMap(cases, 'F');
    const mPop = populationToAgeMap(population, 'M');
    const fPop = populationToAgeMap(population, 'F');
    return AGE_GROUPS.map(ag => ({
      ageGroup: ag,
      male: parseFloat(ageSpecificRate(mCases[ag] || 0, mPop[ag] || 0).toFixed(1)),
      female: parseFloat(ageSpecificRate(fCases[ag] || 0, fPop[ag] || 0).toFixed(1)),
    }));
  }, [cases, population]);

  // Stage distribution
  const stageData = useMemo(() => {
    const counts: Record<string, number> = {};
    cases.forEach(c => {
      const stade = c.stade_tnm || 'Non précisé';
      counts[stade] = (counts[stade] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [cases]);

  // Heatmap: age group × cancer type
  const heatmapData = useMemo(() => {
    const types = [...new Set(cases.map(c => c.type_cancer))].slice(0, 8);
    const matrix: { ageGroup: string; cancer: string; count: number }[] = [];
    for (const ag of AGE_GROUPS) {
      for (const type of types) {
        const count = cases.filter(c => {
          if (!c.patients?.date_naissance || c.type_cancer !== type) return false;
          const age = getAge(c.patients.date_naissance, c.date_diagnostic);
          const lower = parseInt(ag.split('-')[0]);
          const upper = ag === '85+' ? 200 : lower + 4;
          return age >= lower && age <= upper;
        }).length;
        if (count > 0) matrix.push({ ageGroup: ag, cancer: type, count });
      }
    }
    return matrix;
  }, [cases]);

  const heatmapMax = Math.max(...heatmapData.map(d => d.count), 1);

  // Geographic distribution by commune
  const geoData = useMemo(() => {
    const communes: Record<string, number> = {};
    cases.forEach(c => {
      const commune = c.patients?.commune || 'Non précisé';
      communes[commune] = (communes[commune] || 0) + 1;
    });
    return Object.entries(communes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, value]) => ({ name, value }));
  }, [cases]);

  // APC per cancer type (top 5)
  const apcByType = useMemo(() => {
    const types = [...new Set(cases.map(c => c.type_cancer))];
    const totalPop = population.reduce((s, r) => s + r.population, 0);
    return types.map(type => {
      const typeCases = cases.filter(c => c.type_cancer === type);
      const yearCounts: Record<number, number> = {};
      typeCases.forEach(c => {
        const y = new Date(c.date_diagnostic).getFullYear();
        yearCounts[y] = (yearCounts[y] || 0) + 1;
      });
      const yearRates = Object.entries(yearCounts)
        .sort()
        .map(([y, count]) => ({ year: parseInt(y), rate: totalPop > 0 ? (count / totalPop) * 100000 : 0 }));
      const result = annualPercentChange(yearRates);
      return { type, count: typeCases.length, ...result };
    })
    .filter(r => r.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  }, [cases, population]);

  // Treatment stats
  const traitData = useMemo(() => {
    const traitCounts: Record<string, { total: number; efficace: number; effets: number }> = {};
    traitements.forEach((t: any) => {
      if (!traitCounts[t.type_traitement]) traitCounts[t.type_traitement] = { total: 0, efficace: 0, effets: 0 };
      traitCounts[t.type_traitement].total++;
      if (t.efficacite === 'Réponse complète' || t.efficacite === 'Réponse partielle') traitCounts[t.type_traitement].efficace++;
      if (t.effets_secondaires) traitCounts[t.type_traitement].effets++;
    });
    return Object.entries(traitCounts).map(([name, v]) => ({
      name, total: v.total,
      efficacite: v.total > 0 ? Math.round((v.efficace / v.total) * 100) : 0,
      effets: v.total > 0 ? Math.round((v.effets / v.total) * 100) : 0,
    }));
  }, [traitements]);

  // Age distribution histogram
  const ageHistogram = useMemo(() => {
    const bins: Record<string, { male: number; female: number }> = {};
    ['0-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80+'].forEach(b => { bins[b] = { male: 0, female: 0 }; });
    cases.forEach(c => {
      if (!c.patients?.date_naissance) return;
      const age = getAge(c.patients.date_naissance, c.date_diagnostic);
      let bin: string;
      if (age < 20) bin = '0-19';
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
    return Object.entries(bins).map(([age, v]) => ({ age, male: v.male, female: v.female, total: v.male + v.female }));
  }, [cases]);

  return (
    <div className="space-y-6">
      {/* Row 1: Age-specific + Stage */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">📉 Incidence Spécifique par Âge et Sexe (/100k)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ageSpecific}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="ageGroup" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="male" stroke={MALE_COLOR} strokeWidth={2} dot={{ r: 3 }} name="Hommes (/100k)" />
                <Line type="monotone" dataKey="female" stroke={FEMALE_COLOR} strokeWidth={2} dot={{ r: 3 }} name="Femmes (/100k)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">🎯 Répartition par Stade au Diagnostic</h3>
          {stageData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Bar dataKey="value" name="Cas" radius={[0, 4, 4, 0]}>
                    {stageData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée de stade disponible</p>
          )}
        </div>
      </div>

      {/* Row 2: Age histogram + Geographic */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">📊 Distribution par Tranche d'Âge et Sexe</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageHistogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="male" name="Hommes" fill={MALE_COLOR} radius={[2, 2, 0, 0]} />
                <Bar dataKey="female" name="Femmes" fill={FEMALE_COLOR} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            Répartition Géographique (Top 15 Communes)
          </h3>
          {geoData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={geoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  <Bar dataKey="value" name="Cas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Aucune donnée géographique</p>
          )}
        </div>
      </div>

      {/* Row 3: Heatmap Age × Cancer */}
      <div className="stat-card">
        <h3 className="font-display font-semibold mb-4">🔥 Carte de Chaleur — Âge × Localisation Tumorale</h3>
        {heatmapData.length > 0 ? (
          <div className="overflow-x-auto">
            {(() => {
              const cancerTypes = [...new Set(heatmapData.map(d => d.cancer))];
              const ageGroups = [...new Set(heatmapData.map(d => d.ageGroup))];
              return (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 font-medium text-muted-foreground text-left pr-2">Âge</th>
                      {cancerTypes.map(t => (
                        <th key={t} className="pb-2 font-medium text-muted-foreground text-center px-1 min-w-[60px]">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ageGroups.map(ag => (
                      <tr key={ag} className="border-b border-border/20">
                        <td className="py-1.5 pr-2 font-medium text-muted-foreground">{ag}</td>
                        {cancerTypes.map(ct => {
                          const cell = heatmapData.find(d => d.ageGroup === ag && d.cancer === ct);
                          const count = cell?.count || 0;
                          const intensity = count / heatmapMax;
                          return (
                            <td key={ct} className="py-1.5 px-1 text-center">
                              {count > 0 ? (
                                <span
                                  className="inline-flex items-center justify-center w-8 h-6 rounded text-[10px] font-bold"
                                  style={{
                                    background: `hsl(213, 80%, ${85 - intensity * 45}%)`,
                                    color: intensity > 0.5 ? 'white' : 'hsl(213, 80%, 25%)',
                                  }}
                                >
                                  {count}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/30">·</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Données insuffisantes</p>
        )}
      </div>

      {/* Row 4: APC by type + Treatment */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* APC trends per cancer */}
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" />
            Tendances APC par Localisation (NCI/SEER)
          </h3>
          {apcByType.length > 0 ? (
            <div className="space-y-2">
              {apcByType.map(row => (
                <div key={row.type} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
                  <span className="text-sm font-medium flex-1 truncate">{row.type}</span>
                  <span className="text-xs text-muted-foreground">{row.count} cas</span>
                  <span className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-full min-w-[70px] text-center',
                    row.significant
                      ? row.apc > 0 ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-600'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {row.apc > 0 ? '+' : ''}{row.apc}%
                    {row.significant ? ' *' : ''}
                  </span>
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground mt-2">
                * Statistiquement significatif (p&lt;0.05). APC = Annual Percent Change.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Données insuffisantes pour calculer les tendances</p>
          )}
        </div>

        {/* Treatment stats */}
        <div className="stat-card">
          <h3 className="font-display font-semibold mb-4">💊 Statistiques Traitements</h3>
          {traitData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Traitement</th>
                    <th className="pb-2 font-medium text-center">Total</th>
                    <th className="pb-2 font-medium text-center">Efficacité</th>
                    <th className="pb-2 font-medium text-center">Effets 2ndaires</th>
                  </tr>
                </thead>
                <tbody>
                  {traitData.map(t => (
                    <tr key={t.name} className="border-b border-border/30">
                      <td className="py-2.5 font-medium">{t.name}</td>
                      <td className="py-2.5 text-center">{t.total}</td>
                      <td className="py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 bg-muted rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${t.efficacite}%`, background: 'hsl(152, 60%, 42%)' }} />
                          </div>
                          <span className="text-xs font-medium" style={{ color: 'hsl(152, 60%, 42%)' }}>{t.efficacite}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 bg-muted rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${t.effets}%`, background: 'hsl(38, 92%, 50%)' }} />
                          </div>
                          <span className="text-xs font-medium" style={{ color: 'hsl(38, 92%, 50%)' }}>{t.effets}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée de traitement</p>
          )}
        </div>
      </div>
    </div>
  );
}

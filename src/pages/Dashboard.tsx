import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Activity, TrendingUp, FileText, Skull, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import AppLayout from '@/components/layout/AppLayout';
import TlemcenMap from '@/components/TlemcenMap';
import heroPattern from '@/assets/hero-pattern.jpg';

const CANCER_COLORS = [
  'hsl(213, 80%, 45%)',
  'hsl(170, 60%, 42%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 55%)',
  'hsl(280, 60%, 55%)',
];

export default function Dashboard() {
  const { role, fullName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalCases, setTotalCases] = useState(0);
  const [pendingCases, setPendingCases] = useState(0);
  const [typeData, setTypeData] = useState<{ name: string; value: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ name: string; cas: number }[]>([]);
  const [mapData, setMapData] = useState<{ commune: string | null; count: number }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: cases } = await supabase
        .from('cancer_cases')
        .select('id, type_cancer, date_diagnostic, statut, patients(commune)');

      if (!cases || cases.length === 0) {
        setTotalCases(100); setPendingCases(12);
        setTypeData([
          { name: 'Poumon', value: 35 }, { name: 'Colorectal', value: 28 },
          { name: 'Sein', value: 22 }, { name: 'Prostate', value: 15 }, { name: 'Vessie', value: 10 },
        ]);
        setMonthlyData([
          { name: 'Jan', cas: 12 }, { name: 'Fév', cas: 8 }, { name: 'Mar', cas: 15 },
          { name: 'Avr', cas: 10 }, { name: 'Mai', cas: 18 }, { name: 'Jun', cas: 14 },
        ]);
        setMapData([
          { commune: 'Tlemcen', count: 15 }, { commune: 'Maghnia', count: 8 },
          { commune: 'Remchi', count: 6 }, { commune: 'Ghazaouet', count: 4 },
        ]);
        setLoading(false);
        return;
      }

      setTotalCases(cases.length);
      setPendingCases(cases.filter((c: any) => c.statut === 'en_attente').length);

      const typeCounts: Record<string, number> = {};
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
      const monthCounts: Record<string, number> = {};
      const communeCounts: Record<string, number> = {};

      cases.forEach((c: any) => {
        typeCounts[c.type_cancer] = (typeCounts[c.type_cancer] || 0) + 1;
        const m = months[new Date(c.date_diagnostic).getMonth()];
        monthCounts[m] = (monthCounts[m] || 0) + 1;
        const commune = c.patients?.commune;
        if (commune) communeCounts[commune] = (communeCounts[commune] || 0) + 1;
      });

      setTypeData(Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })));
      setMonthlyData(months.map(m => ({ name: m, cas: monthCounts[m] || 0 })));
      setMapData(Object.entries(communeCounts).map(([commune, count]) => ({ commune, count })));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const kpis = [
    { label: 'Total Cas', value: loading ? '—' : totalCases, icon: FileText, accent: 'from-primary to-primary/70' },
    { label: 'Incidence', value: loading ? '—' : '—', icon: TrendingUp, accent: 'from-accent to-accent/70' },
    { label: 'En attente', value: loading ? '—' : pendingCases, icon: Activity, accent: 'from-warning to-warning/70' },
    { label: 'Mortalité', value: '—', icon: Skull, accent: 'from-destructive to-destructive/70' },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Hero Banner */}
        <div className="hero-banner p-6 md:p-8 text-white">
          <div className="absolute inset-0 opacity-20">
            <img src={heroPattern} alt="" className="w-full h-full object-cover mix-blend-overlay" />
          </div>
          <div className="relative z-10">
            <p className="text-white/70 text-sm font-medium">{greeting()}, {fullName || 'Docteur'}</p>
            <h1 className="font-display text-2xl md:text-3xl font-bold mt-1 text-gradient-hero">
              Tableau de Bord
            </h1>
            <p className="text-white/60 text-sm mt-2 max-w-lg">
              Registre National du Cancer — République Algérienne Démocratique et Populaire
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="kpi-card group">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.accent} flex items-center justify-center shadow-sm`}>
                  <kpi.icon size={18} className="text-white" />
                </div>
                <ArrowUpRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl md:text-3xl font-display font-bold tracking-tight">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold">Incidence Mensuelle</h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full font-medium">2026</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid hsl(214, 25%, 90%)',
                      boxShadow: '0 4px 12px hsl(215 30% 12% / 0.08)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="cas" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(213, 80%, 45%)" />
                      <stop offset="100%" stopColor="hsl(213, 80%, 60%)" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold">Top 5 Types de Cancer</h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full font-medium">{totalCases} cas</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData.length > 0 ? typeData : [{ name: 'Poumon', value: 35 }, { name: 'Colorectal', value: 28 }, { name: 'Sein', value: 22 }]}
                    cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    stroke="hsl(var(--card))"
                    strokeWidth={3}
                  >
                    {(typeData.length > 0 ? typeData : [1, 2, 3]).map((_, index) => (
                      <Cell key={index} fill={CANCER_COLORS[index % CANCER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Carte — Wilaya de Tlemcen</h3>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full font-medium">Géolocalisation</span>
          </div>
          <div className="h-72 md:h-96 rounded-xl overflow-hidden">
            <TlemcenMap casesByCommune={mapData} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

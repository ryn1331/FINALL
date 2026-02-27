import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { AgeGroupData } from '@/lib/epidemiology';

interface Props {
  data: AgeGroupData[];
}

export default function AgePyramid({ data }: Props) {
  const pyramidData = data.map(d => ({
    ageGroup: d.ageGroup,
    male: -d.male,
    female: d.female,
  }));

  const maxVal = Math.max(...data.map(d => Math.max(d.male, d.female)), 1);

  return (
    <div className="h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pyramidData} layout="vertical" barCategoryGap="12%">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis
            type="number"
            domain={[-maxVal * 1.1, maxVal * 1.1]}
            tickFormatter={(v: number) => Math.abs(v).toString()}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            dataKey="ageGroup"
            type="category"
            width={45}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            formatter={(value: number, name: string) => [Math.abs(value), name === 'male' ? 'Hommes' : 'Femmes']}
            labelFormatter={(label: string) => `Tranche : ${label}`}
            contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
          />
          <ReferenceLine x={0} stroke="hsl(var(--border))" />
          <Bar dataKey="male" name="male" radius={[4, 0, 0, 4]}>
            {pyramidData.map((_, i) => (
              <Cell key={i} fill="hsl(213, 80%, 50%)" />
            ))}
          </Bar>
          <Bar dataKey="female" name="female" radius={[0, 4, 4, 0]}>
            {pyramidData.map((_, i) => (
              <Cell key={i} fill="hsl(340, 65%, 55%)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(213, 80%, 50%)' }} /> Hommes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'hsl(340, 65%, 55%)' }} /> Femmes
        </span>
      </div>
    </div>
  );
}

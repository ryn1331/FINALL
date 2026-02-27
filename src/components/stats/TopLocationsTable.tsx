import type { LocationRank } from '@/lib/epidemiology';

interface Props {
  data: LocationRank[];
}

export default function TopLocationsTable({ data }: Props) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 font-medium w-8">#</th>
            <th className="pb-2 font-medium">Localisation</th>
            <th className="pb-2 font-medium text-center">Cas</th>
            <th className="pb-2 font-medium text-center">H</th>
            <th className="pb-2 font-medium text-center">F</th>
            <th className="pb-2 font-medium text-center">Ratio M/F</th>
            <th className="pb-2 font-medium text-right">%</th>
            <th className="pb-2 font-medium w-32"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((loc, i) => (
            <tr key={loc.location} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
              <td className="py-2.5 font-bold text-muted-foreground">{i + 1}</td>
              <td className="py-2.5 font-medium">{loc.location}</td>
              <td className="py-2.5 text-center font-semibold">{loc.count}</td>
              <td className="py-2.5 text-center text-blue-600">{loc.male}</td>
              <td className="py-2.5 text-center text-pink-600">{loc.female}</td>
              <td className="py-2.5 text-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted font-medium">
                  {loc.ratio === Infinity ? '∞' : loc.ratio.toFixed(2)}
                </span>
              </td>
              <td className="py-2.5 text-right text-muted-foreground">{loc.percentage}%</td>
              <td className="py-2.5">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${(loc.count / maxCount) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

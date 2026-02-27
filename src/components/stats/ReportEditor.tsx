import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Brain, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  type CaseWithPatient, type PopulationRow, type LocationRank,
  topLocations, groupByAgeAndSex, casesToAgeMap, populationToAgeMap,
  calculateASR, crudeRate, sexRatio, SEGI_WEIGHTS, SEGI_TOTAL,
} from '@/lib/epidemiology';

const TEMPLATES = [
  { id: 'annual', label: 'Rapport Annuel' },
  { id: 'location', label: 'Rapport par Localisation' },
  { id: 'iarc', label: 'Fiche IARC CI5' },
] as const;

const SECTIONS = [
  { id: 'summary', label: 'Résumé IA' },
  { id: 'top10', label: 'Top 10 Localisations' },
  { id: 'pyramid', label: 'Pyramide des âges' },
  { id: 'evolution', label: 'Évolution temporelle' },
  { id: 'treatments', label: 'Statistiques traitements' },
  { id: 'asr', label: 'Taux standardisés (ASR)' },
] as const;

interface Props {
  cases: CaseWithPatient[];
  population: PopulationRow[];
  traitements: any[];
}

export default function ReportEditor({ cases, population, traitements }: Props) {
  const [template, setTemplate] = useState<string>('annual');
  const [selectedSections, setSelectedSections] = useState<string[]>(['top10', 'pyramid', 'asr']);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  const toggleSection = (id: string) => {
    setSelectedSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const top10 = topLocations(cases, 10);
  const ageData = groupByAgeAndSex(cases);
  const totalPop = population.reduce((s, r) => s + r.population, 0);
  const casesByAge = casesToAgeMap(cases);
  const popByAge = populationToAgeMap(population);
  const crude = crudeRate(cases.length, totalPop);
  const asr = calculateASR(casesByAge, popByAge, SEGI_WEIGHTS, SEGI_TOTAL);
  const maleCount = cases.filter(c => c.patients?.sexe === 'M').length;
  const femaleCount = cases.filter(c => c.patients?.sexe === 'F').length;

  const generateAiSummary = async () => {
    setAiLoading(true);
    try {
      const stats = {
        totalCas: cases.length, tauxBrut: crude.toFixed(1), asr: asr.toFixed(1),
        ratioMF: sexRatio(maleCount, femaleCount).toFixed(2),
        top5: top10.slice(0, 5).map(l => `${l.location}: ${l.count}`).join(', '),
      };
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { stats, wilaya: 'Tlemcen', period: 'Toutes périodes' },
      });
      if (error) throw error;
      setAiSummary(data.report);
      if (!selectedSections.includes('summary')) setSelectedSections(prev => [...prev, 'summary']);
    } catch (err: any) {
      toast.error(err.message || 'Erreur IA');
    } finally { setAiLoading(false); }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString('fr-DZ');
    const templateLabel = TEMPLATES.find(t => t.id === template)?.label || 'Rapport';

    // Header
    doc.setFontSize(16);
    doc.text(`${templateLabel} — Registre du Cancer`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Wilaya de Tlemcen — Généré le ${now}`, 14, 28);
    doc.text('Conforme standards IARC/OMS', 14, 33);
    let y = 42;

    if (selectedSections.includes('asr')) {
      doc.setFontSize(12);
      doc.text('Indicateurs Épidémiologiques', 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Indicateur', 'Valeur']],
        body: [
          ['Total Cas', cases.length.toString()],
          ['Population', totalPop.toLocaleString()],
          ['Taux Brut (/100k)', crude.toFixed(1)],
          ['ASR Monde (/100k)', asr.toFixed(1)],
          ['Ratio M/F', sexRatio(maleCount, femaleCount).toFixed(2)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [41, 98, 168] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (selectedSections.includes('top10')) {
      doc.setFontSize(12);
      doc.text('Top 10 Localisations Tumorales', 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['#', 'Localisation', 'Cas', 'H', 'F', 'Ratio M/F', '%']],
        body: top10.map((l, i) => [
          (i + 1).toString(), l.location, l.count.toString(),
          l.male.toString(), l.female.toString(),
          l.ratio === Infinity ? '∞' : l.ratio.toFixed(2), l.percentage + '%',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [41, 98, 168] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (selectedSections.includes('pyramid')) {
      doc.setFontSize(12);
      doc.text('Répartition par Tranche d\'Âge et Sexe', 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Tranche', 'Hommes', 'Femmes', 'Total']],
        body: ageData.map(d => [d.ageGroup, d.male.toString(), d.female.toString(), d.total.toString()]),
        theme: 'striped',
        headStyles: { fillColor: [41, 98, 168] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (selectedSections.includes('summary') && aiSummary) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.text('Résumé Interprétatif (IA)', 14, y);
      y += 6;
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(aiSummary, 180);
      doc.text(lines, 14, y);
    }

    doc.save(`${templateLabel.replace(/ /g, '_')}_${now}.pdf`);
    toast.success('PDF exporté avec succès');
  };

  const exportCSV = () => {
    let csv = 'Localisation,Cas,Hommes,Femmes,Ratio,Pourcentage\n';
    top10.forEach(l => {
      csv += `${l.location},${l.count},${l.male},${l.female},${l.ratio},${l.percentage}%\n`;
    });
    csv += '\nTrancheAge,Hommes,Femmes,Total\n';
    ageData.forEach(d => {
      csv += `${d.ageGroup},${d.male},${d.female},${d.total}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rapport_cancer_tlemcen_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('CSV exporté avec succès');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Config panel */}
      <div className="stat-card space-y-5">
        <h3 className="font-display font-semibold">⚙️ Configuration</h3>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Template</label>
          <Select value={template} onValueChange={setTemplate}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEMPLATES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Sections à inclure</label>
          <div className="space-y-2">
            {SECTIONS.map(s => (
              <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
                <Checkbox
                  checked={selectedSections.includes(s.id)}
                  onCheckedChange={() => toggleSection(s.id)}
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <Button onClick={generateAiSummary} disabled={aiLoading} variant="outline" className="w-full">
            {aiLoading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Brain size={14} className="mr-1.5" />}
            Générer Résumé IA
          </Button>
          <Button onClick={exportPDF} className="w-full">
            <FileText size={14} className="mr-1.5" /> Exporter PDF
          </Button>
          <Button onClick={exportCSV} variant="secondary" className="w-full">
            <Download size={14} className="mr-1.5" /> Exporter CSV
          </Button>
        </div>
      </div>

      {/* Preview panel */}
      <div className="stat-card lg:col-span-2 space-y-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          Prévisualisation — {TEMPLATES.find(t => t.id === template)?.label}
        </h3>

        <div className="text-xs text-muted-foreground border-b border-border pb-2">
          Wilaya de Tlemcen · {cases.length} cas · Population : {totalPop.toLocaleString()}
        </div>

        {selectedSections.includes('asr') && (
          <div className="border border-border rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2">Indicateurs Épidémiologiques</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[
                { l: 'Taux Brut', v: crude.toFixed(1) },
                { l: 'ASR Monde', v: asr.toFixed(1) },
                { l: 'Ratio M/F', v: sexRatio(maleCount, femaleCount).toFixed(2) },
                { l: 'Total', v: cases.length },
              ].map(k => (
                <div key={k.l} className="bg-muted/50 rounded-md p-2">
                  <p className="text-lg font-bold">{k.v}</p>
                  <p className="text-[10px] text-muted-foreground">{k.l}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedSections.includes('top10') && (
          <div className="border border-border rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2">Top 10 Localisations</h4>
            <div className="space-y-1.5">
              {top10.slice(0, 5).map((l, i) => (
                <div key={l.location} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-muted-foreground font-mono">{i + 1}.</span>
                  <span className="flex-1">{l.location}</span>
                  <span className="font-semibold">{l.count}</span>
                  <span className="text-muted-foreground text-xs">({l.percentage}%)</span>
                </div>
              ))}
              {top10.length > 5 && <p className="text-xs text-muted-foreground">+{top10.length - 5} autres...</p>}
            </div>
          </div>
        )}

        {selectedSections.includes('pyramid') && (
          <div className="border border-border rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2">Pyramide des Âges</h4>
            <div className="grid grid-cols-3 gap-1 text-xs">
              <span className="font-medium text-muted-foreground">Tranche</span>
              <span className="font-medium text-muted-foreground text-center">H</span>
              <span className="font-medium text-muted-foreground text-center">F</span>
              {ageData.filter(d => d.total > 0).map(d => (
                <> 
                  <span key={d.ageGroup + 'a'}>{d.ageGroup}</span>
                  <span key={d.ageGroup + 'm'} className="text-center text-blue-600">{d.male}</span>
                  <span key={d.ageGroup + 'f'} className="text-center text-pink-600">{d.female}</span>
                </>
              ))}
            </div>
          </div>
        )}

        {selectedSections.includes('summary') && aiSummary && (
          <div className="border border-border rounded-lg p-4">
            <h4 className="font-semibold text-sm mb-2">Résumé IA</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{aiSummary}</p>
          </div>
        )}

        {selectedSections.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">Sélectionnez des sections à inclure dans le rapport</p>
        )}
      </div>
    </div>
  );
}

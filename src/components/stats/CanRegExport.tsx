import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Loader2, Database, Filter } from 'lucide-react';
import { generateCanReg5CSV, downloadCSV, type CanRegRecord } from '@/lib/canreg-export';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  type CaseWithPatient, type PopulationRow,
  topLocations, groupByAgeAndSex, casesToAgeMap, populationToAgeMap,
  calculateASR, crudeRate, sexRatio, medianAge, meanAge,
  microscopicVerification, stagingCompleteness, unknownPrimarySite,
  asrByCancerType, asrWithCI, cumulativeRate074,
  SEGI_WEIGHTS, SEGI_TOTAL,
} from '@/lib/epidemiology';

interface Props {
  cases: CaseWithPatient[];
  population: PopulationRow[];
}

const STATUT_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'valide', label: 'Validés uniquement' },
  { value: 'en_attente', label: 'En attente' },
];

export default function CanRegExport({ cases, population }: Props) {
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [statutFilter, setStatutFilter] = useState('all');
  const [includePatientInfo, setIncludePatientInfo] = useState(true);
  const [includeTreatment, setIncludeTreatment] = useState(true);
  const [includeLifestyle, setIncludeLifestyle] = useState(true);

  const handleCanRegExport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('cancer_cases')
        .select(`
          id, type_cancer, sous_type_cancer, date_diagnostic, statut, stade_tnm,
          resultat_anapath, code_icdo, topographie_icdo, morphologie_icdo,
          comportement, grade, lateralite, methode_diagnostic, base_diagnostic,
          source_info, ref_anapath, medecin_anapath, date_anapath,
          anomalies_moleculaires, milieu, profession, tabagisme, alcool, sportif,
          statut_vital, date_deces, cause_deces, date_derniere_nouvelle, created_at,
          patients(id, code_patient, nom, prenom, sexe, date_naissance, commune, wilaya, telephone, num_dossier)
        `);

      if (statutFilter !== 'all') {
        query = query.eq('statut', statutFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.warning('Aucun cas à exporter');
        setLoading(false);
        return;
      }

      const records: CanRegRecord[] = data.map((c: any) => ({
        patient_id: c.patients?.id || '',
        code_patient: c.patients?.code_patient || '',
        nom: includePatientInfo ? (c.patients?.nom || '') : '***',
        prenom: includePatientInfo ? (c.patients?.prenom || '') : '***',
        sexe: c.patients?.sexe || '',
        date_naissance: c.patients?.date_naissance || null,
        commune: c.patients?.commune || null,
        wilaya: c.patients?.wilaya || 'Tlemcen',
        telephone: includePatientInfo ? (c.patients?.telephone || null) : null,
        num_dossier: c.patients?.num_dossier || null,
        case_id: c.id,
        date_diagnostic: c.date_diagnostic,
        type_cancer: c.type_cancer,
        sous_type_cancer: c.sous_type_cancer,
        topographie_icdo: c.topographie_icdo,
        morphologie_icdo: c.morphologie_icdo,
        code_icdo: c.code_icdo,
        comportement: c.comportement,
        grade: c.grade,
        lateralite: c.lateralite,
        stade_tnm: c.stade_tnm,
        methode_diagnostic: c.methode_diagnostic,
        base_diagnostic: c.base_diagnostic,
        source_info: c.source_info,
        resultat_anapath: c.resultat_anapath,
        ref_anapath: c.ref_anapath,
        medecin_anapath: c.medecin_anapath,
        date_anapath: c.date_anapath,
        anomalies_moleculaires: c.anomalies_moleculaires,
        milieu: c.milieu,
        profession: includeLifestyle ? c.profession : null,
        tabagisme: includeLifestyle ? c.tabagisme : null,
        alcool: includeLifestyle ? c.alcool : null,
        sportif: includeLifestyle ? c.sportif : null,
        statut: c.statut,
        statut_vital: c.statut_vital,
        date_deces: c.date_deces,
        cause_deces: c.cause_deces,
        date_derniere_nouvelle: c.date_derniere_nouvelle,
        created_at: c.created_at,
      }));

      const csv = generateCanReg5CSV(records);
      const date = new Date().toISOString().slice(0, 10);
      downloadCSV(csv, `CanReg5_Tlemcen_${date}_${records.length}cas.csv`);
      toast.success(`${records.length} cas exportés au format CanReg5`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur export');
    } finally {
      setLoading(false);
    }
  };

  const handleFullPDFReport = () => {
    setPdfLoading(true);
    try {
      const doc = new jsPDF();
      const now = new Date().toLocaleDateString('fr-DZ');
      const totalPop = population.reduce((s, r) => s + r.population, 0);
      const popByAge = populationToAgeMap(population);
      const casesByAge = casesToAgeMap(cases);
      const top10 = topLocations(cases, 10);
      const ageData = groupByAgeAndSex(cases);
      const maleCount = cases.filter(c => c.patients?.sexe === 'M').length;
      const femaleCount = cases.filter(c => c.patients?.sexe === 'F').length;
      const crude = crudeRate(cases.length, totalPop);
      const asrResult = asrWithCI(casesByAge, popByAge);
      const cumRate = cumulativeRate074(casesByAge, popByAge);
      const mv = microscopicVerification(cases);
      const staging = stagingCompleteness(cases);
      const unknownSite = unknownPrimarySite(cases);
      const median = medianAge(cases);
      const mean = meanAge(cases);
      const byType = asrByCancerType(cases, popByAge);

      // Page 1: Header
      doc.setFontSize(18);
      doc.text('Rapport Épidémiologique — IARC Standard', 14, 22);
      doc.setFontSize(11);
      doc.text('Registre du Cancer de la Wilaya de Tlemcen', 14, 30);
      doc.setFontSize(9);
      doc.text(`Généré le ${now} · Conforme CI5/GLOBOCAN/OMS`, 14, 36);
      doc.text(`Période : Toutes les données disponibles · ${cases.length} cas`, 14, 41);

      let y = 50;

      // KPIs Table
      doc.setFontSize(13);
      doc.text('1. Indicateurs Clés', 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Indicateur', 'Valeur', 'Standard IARC']],
        body: [
          ['Total cas', cases.length.toString(), '-'],
          ['Population de référence', totalPop.toLocaleString(), '-'],
          ['Taux brut (/100 000)', crude.toFixed(2), '-'],
          ['ASR Monde (/100 000)', asrResult.asr.toFixed(2), '> 0'],
          ['IC 95% ASR', `[${asrResult.lower.toFixed(2)} – ${asrResult.upper.toFixed(2)}]`, '-'],
          ['Risque cumulé 0-74 ans (%)', cumRate.toFixed(2), '-'],
          ['Ratio M/F', sexRatio(maleCount, femaleCount).toFixed(2), '-'],
          ['Hommes / Femmes', `${maleCount} / ${femaleCount}`, '-'],
          ['Âge médian au diagnostic', median.toFixed(1), '-'],
          ['Âge moyen au diagnostic', mean.toFixed(1), '-'],
          ['MV% (Vérification morpho)', mv.toFixed(1) + '%', '≥ 80%'],
          ['Staging TNM %', staging.toFixed(1) + '%', '≥ 60%'],
          ['Site primaire inconnu %', unknownSite.toFixed(1) + '%', '≤ 10%'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 8 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Top 10
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.text('2. Top 10 Localisations Tumorales', 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['#', 'Localisation', 'Cas', 'H', 'F', 'ASR', 'Ratio M/F', '%']],
        body: byType.slice(0, 10).map((t, i) => [
          (i + 1).toString(), t.type, t.count.toString(),
          t.male.toString(), t.female.toString(),
          t.asr.toFixed(2), sexRatio(t.male, t.female).toFixed(2),
          t.percentage + '%',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 8 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Pyramid
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.text('3. Répartition par Tranche d\'Âge et Sexe', 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Tranche', 'Hommes', 'Femmes', 'Total', 'Taux spécifique H', 'Taux spécifique F']],
        body: ageData.map(d => {
          const pop = popByAge[d.ageGroup] || 0;
          const rateH = pop > 0 ? ((d.male / (pop * 0.5)) * 100000).toFixed(1) : '-';
          const rateF = pop > 0 ? ((d.female / (pop * 0.5)) * 100000).toFixed(1) : '-';
          return [d.ageGroup, d.male.toString(), d.female.toString(), d.total.toString(), rateH, rateF];
        }),
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 8 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // ASR by type detail
      if (y > 200) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.text('4. ASR par Type de Cancer (Segi World)', 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Type', 'Cas', 'ASR Global', 'ASR H', 'ASR F', 'Taux brut', 'Âge médian', '%']],
        body: byType.map(t => [
          t.type, t.count.toString(), t.asr.toFixed(2),
          t.asrMale.toFixed(2), t.asrFemale.toFixed(2),
          t.crude.toFixed(2), t.medianAge.toFixed(0), t.percentage + '%',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 7 },
      });

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.text(
          `Registre du Cancer — Wilaya de Tlemcen · Page ${i}/${totalPages} · Conforme IARC/CI5`,
          14, doc.internal.pageSize.height - 8
        );
      }

      doc.save(`Rapport_IARC_Tlemcen_${now.replace(/\//g, '-')}.pdf`);
      toast.success('Rapport PDF IARC généré avec succès');
    } catch (err: any) {
      toast.error(err.message || 'Erreur PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CanReg5 CSV Export */}
      <div className="stat-card space-y-5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-primary" />
          <h3 className="font-display font-semibold">Export CanReg5 CSV</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          Fichier CSV compatible CanReg5/IARC avec tous les champs standardisés.
          Importable directement dans CanReg5, GLOBOCAN et CI5.
        </p>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Filtrer par statut</label>
          <Select value={statutFilter} onValueChange={setStatutFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground block">Options d'export</label>
          {[
            { id: 'patient', label: 'Informations patient (nom, tél)', checked: includePatientInfo, toggle: () => setIncludePatientInfo(v => !v) },
            { id: 'treatment', label: 'Données de traitement', checked: includeTreatment, toggle: () => setIncludeTreatment(v => !v) },
            { id: 'lifestyle', label: 'Mode de vie (tabac, alcool)', checked: includeLifestyle, toggle: () => setIncludeLifestyle(v => !v) },
          ].map(opt => (
            <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5">
              <Checkbox checked={opt.checked} onCheckedChange={opt.toggle} />
              {opt.label}
            </label>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Database size={14} />
          <span>{cases.length} cas disponibles · Format UTF-8 BOM (Excel compatible)</span>
        </div>

        <Button onClick={handleCanRegExport} disabled={loading} className="w-full">
          {loading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Download size={14} className="mr-1.5" />}
          Exporter CanReg5 CSV
        </Button>
      </div>

      {/* PDF Report */}
      <div className="stat-card space-y-5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={20} className="text-destructive" />
          <h3 className="font-display font-semibold">Rapport PDF IARC</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          Rapport complet conforme aux standards IARC/CI5/GLOBOCAN avec ASR,
          intervalles de confiance, pyramide des âges et qualité des données.
        </p>

        <div className="space-y-2 text-sm">
          <p className="font-medium text-muted-foreground">Contenu du rapport :</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {[
              'Indicateurs clés (ASR, IC 95%, risque cumulé, MV%, staging)',
              'Top 10 localisations avec ASR par type',
              'Pyramide des âges avec taux spécifiques',
              'ASR détaillé par cancer (Segi World Standard)',
              'Pied de page IARC/CI5 sur toutes les pages',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Database size={14} />
          <span>{cases.length} cas · Population: {population.reduce((s, r) => s + r.population, 0).toLocaleString()}</span>
        </div>

        <Button onClick={handleFullPDFReport} disabled={pdfLoading} variant="destructive" className="w-full">
          {pdfLoading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Download size={14} className="mr-1.5" />}
          Générer Rapport PDF IARC
        </Button>
      </div>
    </div>
  );
}

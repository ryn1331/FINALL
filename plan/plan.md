

# Module Statistiques Professionnel -- Remplacement CanReg5

## Contexte

CanReg5 (IARC/OMS) est le standard mondial pour les registres de cancer populationnels. Il n'a pas de successeur web officiel. Ce plan transforme votre module statistiques en un veritable outil epidemiologique de niveau IARC, avec les calculs reels utilises dans tous les registres du monde.

## Ce qui manque actuellement

Le module actuel affiche des graphiques basiques (bar, pie, line) avec des comptages simples. Pour un registre national algerien, il faut :

- **Taux d'incidence brute** (pour 100 000 habitants) -- pas juste des comptages
- **Taux standardise sur l'age (ASR)** -- methode de reference mondiale (population standard Segi/OMS)
- **Incidence specifique par age** -- taux par tranche de 5 ans
- **Rapports M/F** (sex-ratio par localisation)
- **Top 10 localisations** avec classement automatique
- **Pyramide des ages** reelle (hommes a gauche, femmes a droite)
- **Editeur de rapports** integre pour generer des rapports annuels personnalises
- **Donnees de population de reference** pour calculer les vrais taux

## Architecture proposee

### 1. Table de population de reference (nouvelle table)

Pour calculer les vrais taux d'incidence, il faut les denominateurs (population). Creation d'une table `population_reference` :

```text
population_reference
- id (uuid)
- wilaya (text)
- annee (int)
- tranche_age (text: "0-4", "5-9", ..., "85+")
- sexe (text: "M" / "F")
- population (int)
- created_at
```

Pre-remplir avec les donnees ONS (Office National des Statistiques) de la wilaya de Tlemcen. L'admin pourra ensuite ajouter/modifier les populations des autres wilayas.

### 2. Calculs epidemiologiques reels (cote client)

Module utilitaire `src/lib/epidemiology.ts` avec :

- **Taux brut** = (nb cas / population) x 100 000
- **ASR (Age-Standardized Rate)** = somme des (taux specifique par age x poids standard Segi) -- methode directe, standard mondial
- **Population standard Segi** integree en dur (18 tranches de 5 ans, poids connus)
- **Intervalle de confiance a 95%** sur les taux
- **Ratio Homme/Femme** par localisation
- **Cumulative rate 0-74** (risque cumule)

### 3. Refonte de la page Statistiques

La page sera reorganisee en onglets professionnels :

**Onglet 1 -- Tableau de bord epidemiologique**
- KPI : Total cas, Taux brut, ASR (Monde), ASR (Europe), Ratio M/F
- Top 10 localisations tumorales (tableau + barre horizontale)
- Pyramide des ages (bar chart horizontal symetrique H/F)
- Evolution temporelle des taux (pas des comptages)

**Onglet 2 -- Analyse detaillee**
- Incidence specifique par age et sexe (courbes superposees)
- Repartition par stade au diagnostic
- Carte de chaleur age x localisation
- Statistiques traitements (existant, ameliore)

**Onglet 3 -- Editeur de rapports**
- Templates pre-configures : Rapport annuel, Rapport par localisation, Fiche IARC CI5
- Sections drag-and-drop : l'utilisateur choisit quels tableaux/graphiques inclure
- Parametres : periode, wilayas, sexe, localisations
- Previsualisation en temps reel
- Export PDF professionnel (en-tete registre, tableaux OMS, graphiques)
- Export Excel (donnees brutes + tableaux calcules)
- Generation IA d'un resume interpretatif (existant, integre dans le rapport)

### 4. Barre de filtres amelioree

Conserve la barre actuelle avec ajout de :
- Filtre par wilaya (multi-select pour le futur national)
- Filtre par code CIM-O-3 / topographie
- Intervalle d'annees personnalise (slider ou date range)

## Details techniques

### Fichiers a creer
- `src/lib/epidemiology.ts` -- Fonctions de calcul ASR, taux bruts, IC95%
- `src/components/stats/EpidemiologyDashboard.tsx` -- Onglet 1
- `src/components/stats/DetailedAnalysis.tsx` -- Onglet 2
- `src/components/stats/ReportEditor.tsx` -- Onglet 3 (editeur de rapports)
- `src/components/stats/AgePyramid.tsx` -- Composant pyramide des ages
- `src/components/stats/TopLocationsTable.tsx` -- Top 10 avec barres

### Fichiers a modifier
- `src/pages/Statistics.tsx` -- Refactoring en onglets, integration des nouveaux composants
- Migration SQL -- Creation de `population_reference` avec donnees Tlemcen

### Formule ASR implementee

```text
ASR = somme(i=1..18) [ (cas_i / pop_i) x 100000 x poids_segi_i ]

Ou :
- cas_i = nombre de cas dans la tranche d'age i
- pop_i = population de la tranche d'age i
- poids_segi_i = proportion de la population standard Segi pour la tranche i
```

### Population standard Segi (poids)

```text
0-4: 12000, 5-9: 10000, 10-14: 9000, 15-19: 9000,
20-24: 8000, 25-29: 8000, 30-34: 6000, 35-39: 6000,
40-44: 6000, 45-49: 6000, 50-54: 5000, 55-59: 4000,
60-64: 4000, 65-69: 3000, 70-74: 2000, 75-79: 1000,
80-84: 500, 85+: 500
Total: 100000
```

### Editeur de rapports

L'editeur sera integre directement dans l'onglet 3, pas un outil externe. Il fonctionnera comme suit :
- L'utilisateur selectionne un template (rapport annuel, rapport localisation)
- Il coche les sections a inclure (resume, top 10, pyramide, evolution, traitements)
- Il ajuste les parametres (periode, sexe, wilayas)
- Previsualisation live dans un panneau lateral
- Bouton "Exporter PDF" genere un document professionnel avec jsPDF + autoTable
- Bouton "Exporter Excel" genere un fichier CSV structure

Pas besoin de librairie externe -- on utilise jsPDF (deja installe) et les composants Recharts existants.

## Resume

Ce plan transforme un affichage de comptages basique en un veritable outil epidemiologique conforme aux standards IARC/OMS, avec les memes indicateurs que CanReg5 mais dans une interface web moderne. L'editeur de rapports integre remplace le module de reporting de CanReg5 sans dependance externe.


# Registre National du Cancer — Algérie

Application web de gestion et d'analyse épidémiologique des cas de cancer (saisie clinique, suivi patient, statistiques, exports et outils d'aide au reporting).

## Stack technique

- React + TypeScript
- Vite
- Tailwind CSS + composants UI
- Supabase (base de données, authentification, fonctions Edge)

## Prérequis

- Node.js 18+
- npm 9+

## Installation locale

```bash
npm install
```

## Lancer le projet

```bash
npm run dev
```

Application disponible par défaut sur `http://localhost:8080`.

## Build production

```bash
npm run build
npm run preview
```

## Tests

```bash
npm run test
```

## Variables d'environnement (fonctions Edge)

Les fonctions IA côté Supabase utilisent :

- `AI_API_KEY` : clé d'accès au provider IA
- `AI_CHAT_COMPLETIONS_URL` : endpoint Chat Completions (optionnel, défaut: endpoint OpenAI)

## Structure principale

- `src/pages` : pages applicatives
- `src/components` : composants UI/métier
- `src/lib` : utilitaires métier
- `supabase/functions` : fonctions Edge (OCR, parsing vocal, génération de rapport)

## Conformité

Le projet inclut des éléments orientés conformité et santé publique (IARC/OMS, contexte ANPDP) dans les écrans et rapports.

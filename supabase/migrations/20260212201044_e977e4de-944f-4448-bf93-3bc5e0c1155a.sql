
-- Add new columns to patients table
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS telephone TEXT,
  ADD COLUMN IF NOT EXISTS num_dossier TEXT;

-- Add new columns to cancer_cases table  
ALTER TABLE public.cancer_cases
  ADD COLUMN IF NOT EXISTS sous_type_cancer TEXT,
  ADD COLUMN IF NOT EXISTS anomalies_moleculaires TEXT,
  ADD COLUMN IF NOT EXISTS medecin_anapath TEXT,
  ADD COLUMN IF NOT EXISTS date_anapath DATE,
  ADD COLUMN IF NOT EXISTS ref_anapath TEXT,
  ADD COLUMN IF NOT EXISTS biologie_fns TEXT,
  ADD COLUMN IF NOT EXISTS biologie_globules TEXT,
  ADD COLUMN IF NOT EXISTS biologie_date DATE,
  ADD COLUMN IF NOT EXISTS tabagisme TEXT DEFAULT 'non',
  ADD COLUMN IF NOT EXISTS alcool TEXT DEFAULT 'non',
  ADD COLUMN IF NOT EXISTS sportif TEXT DEFAULT 'non',
  ADD COLUMN IF NOT EXISTS symptomes TEXT;

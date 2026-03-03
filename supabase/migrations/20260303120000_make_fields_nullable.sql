-- Make sexe nullable (optional during initial entry)
ALTER TABLE public.patients ALTER COLUMN sexe DROP NOT NULL;
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_sexe_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_sexe_check CHECK (sexe IS NULL OR sexe IN ('M', 'F'));

-- Make type_cancer and date_diagnostic nullable (can be filled later)
ALTER TABLE public.cancer_cases ALTER COLUMN type_cancer DROP NOT NULL;
ALTER TABLE public.cancer_cases ALTER COLUMN date_diagnostic DROP NOT NULL;

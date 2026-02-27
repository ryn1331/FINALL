
-- Table de population de reference pour calculs epidemiologiques
CREATE TABLE public.population_reference (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wilaya TEXT NOT NULL DEFAULT 'Tlemcen',
  annee INTEGER NOT NULL,
  tranche_age TEXT NOT NULL,
  sexe TEXT NOT NULL CHECK (sexe IN ('M', 'F')),
  population INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.population_reference ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Authenticated can view population" ON public.population_reference
FOR SELECT TO authenticated USING (true);

-- Only admin can modify
CREATE POLICY "Admin can insert population" ON public.population_reference
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update population" ON public.population_reference
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete population" ON public.population_reference
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast lookups
CREATE INDEX idx_pop_ref_lookup ON public.population_reference (wilaya, annee, sexe, tranche_age);

-- Pre-fill with Tlemcen ONS 2024 estimates (wilaya pop ~1.1M)
INSERT INTO public.population_reference (wilaya, annee, tranche_age, sexe, population) VALUES
('Tlemcen', 2024, '0-4', 'M', 55000), ('Tlemcen', 2024, '0-4', 'F', 52000),
('Tlemcen', 2024, '5-9', 'M', 52000), ('Tlemcen', 2024, '5-9', 'F', 49000),
('Tlemcen', 2024, '10-14', 'M', 48000), ('Tlemcen', 2024, '10-14', 'F', 46000),
('Tlemcen', 2024, '15-19', 'M', 45000), ('Tlemcen', 2024, '15-19', 'F', 43000),
('Tlemcen', 2024, '20-24', 'M', 47000), ('Tlemcen', 2024, '20-24', 'F', 45000),
('Tlemcen', 2024, '25-29', 'M', 46000), ('Tlemcen', 2024, '25-29', 'F', 44000),
('Tlemcen', 2024, '30-34', 'M', 42000), ('Tlemcen', 2024, '30-34', 'F', 41000),
('Tlemcen', 2024, '35-39', 'M', 38000), ('Tlemcen', 2024, '35-39', 'F', 37000),
('Tlemcen', 2024, '40-44', 'M', 34000), ('Tlemcen', 2024, '40-44', 'F', 33000),
('Tlemcen', 2024, '45-49', 'M', 30000), ('Tlemcen', 2024, '45-49', 'F', 29000),
('Tlemcen', 2024, '50-54', 'M', 26000), ('Tlemcen', 2024, '50-54', 'F', 25000),
('Tlemcen', 2024, '55-59', 'M', 22000), ('Tlemcen', 2024, '55-59', 'F', 21000),
('Tlemcen', 2024, '60-64', 'M', 18000), ('Tlemcen', 2024, '60-64', 'F', 17000),
('Tlemcen', 2024, '65-69', 'M', 14000), ('Tlemcen', 2024, '65-69', 'F', 13500),
('Tlemcen', 2024, '70-74', 'M', 10000), ('Tlemcen', 2024, '70-74', 'F', 10500),
('Tlemcen', 2024, '75-79', 'M', 6000), ('Tlemcen', 2024, '75-79', 'F', 6500),
('Tlemcen', 2024, '80-84', 'M', 3000), ('Tlemcen', 2024, '80-84', 'F', 3500),
('Tlemcen', 2024, '85+', 'M', 1500), ('Tlemcen', 2024, '85+', 'F', 2000);

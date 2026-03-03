-- Custom fields table: admin-defined fields for the NewCase form
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  field_key TEXT NOT NULL UNIQUE,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'textarea')),
  step_id TEXT NOT NULL CHECK (step_id IN ('identite', 'epidemio', 'diagnostic', 'topographie', 'morphologie', 'stade', 'traitement', 'suivi')),
  options TEXT[] DEFAULT NULL, -- for select type
  required BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

-- Everyone can read active custom fields
CREATE POLICY "Anyone can read custom fields" ON public.custom_fields FOR SELECT TO authenticated USING (true);
-- Only admin can manage
CREATE POLICY "Admin can manage custom fields" ON public.custom_fields FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Store custom field values per cancer case
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cancer_cases(id) ON DELETE CASCADE NOT NULL,
  field_id UUID REFERENCES public.custom_fields(id) ON DELETE CASCADE NOT NULL,
  value TEXT,
  UNIQUE (case_id, field_id)
);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read custom field values" ON public.custom_field_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Medecin/admin can insert custom field values" ON public.custom_field_values FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'medecin') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Medecin/admin can update custom field values" ON public.custom_field_values FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'medecin') OR public.has_role(auth.uid(), 'admin')
);

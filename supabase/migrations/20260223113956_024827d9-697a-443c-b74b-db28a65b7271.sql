
-- Table for medical file metadata
CREATE TABLE public.patient_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cancer_cases(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'autre',
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_patient_files_patient ON public.patient_files(patient_id);
CREATE INDEX idx_patient_files_case ON public.patient_files(case_id);

-- Enable RLS
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view files
CREATE POLICY "Authenticated can view files"
ON public.patient_files FOR SELECT
TO authenticated
USING (true);

-- Medecin, admin, assistante, anapath can upload
CREATE POLICY "Staff can insert files"
ON public.patient_files FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'medecin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'assistante'::app_role) OR
  has_role(auth.uid(), 'anapath'::app_role)
);

-- Medecin, admin can update
CREATE POLICY "Staff can update files"
ON public.patient_files FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'medecin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- Admin can delete
CREATE POLICY "Admin can delete files"
ON public.patient_files FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_patient_files_updated_at
BEFORE UPDATE ON public.patient_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for patient medical files
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-files', 'patient-files', false);

-- Storage policies
CREATE POLICY "Authenticated can view patient files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'patient-files');

CREATE POLICY "Staff can upload patient files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'patient-files');

CREATE POLICY "Staff can update patient files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'patient-files');

CREATE POLICY "Admin can delete patient files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'patient-files' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Add columns to cancer_cases for IARC fields
ALTER TABLE public.cancer_cases 
ADD COLUMN IF NOT EXISTS methode_diagnostic TEXT DEFAULT 'histologie',
ADD COLUMN IF NOT EXISTS topographie_icdo TEXT,
ADD COLUMN IF NOT EXISTS morphologie_icdo TEXT,
ADD COLUMN IF NOT EXISTS comportement TEXT,
ADD COLUMN IF NOT EXISTS grade TEXT,
ADD COLUMN IF NOT EXISTS lateralite TEXT,
ADD COLUMN IF NOT EXISTS milieu TEXT DEFAULT 'urbain',
ADD COLUMN IF NOT EXISTS profession TEXT,
ADD COLUMN IF NOT EXISTS base_diagnostic TEXT,
ADD COLUMN IF NOT EXISTS source_info TEXT,
ADD COLUMN IF NOT EXISTS date_deces DATE,
ADD COLUMN IF NOT EXISTS cause_deces TEXT,
ADD COLUMN IF NOT EXISTS date_derniere_nouvelle DATE,
ADD COLUMN IF NOT EXISTS statut_vital TEXT DEFAULT 'vivant';

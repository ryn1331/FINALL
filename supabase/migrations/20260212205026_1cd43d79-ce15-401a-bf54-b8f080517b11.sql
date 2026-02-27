
-- Table pour les rechutes / évolutions du cancer
CREATE TABLE public.cancer_rechutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cancer_cases(id) ON DELETE CASCADE,
  type_evenement text NOT NULL DEFAULT 'rechute', -- rechute, metastase, progression, remission
  date_evenement date NOT NULL,
  localisation text,
  description text,
  stade_tnm text,
  traitement_propose text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cancer_rechutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view rechutes" ON public.cancer_rechutes FOR SELECT USING (true);
CREATE POLICY "Medecin can insert rechutes" ON public.cancer_rechutes FOR INSERT WITH CHECK (has_role(auth.uid(), 'medecin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Medecin can update rechutes" ON public.cancer_rechutes FOR UPDATE USING (has_role(auth.uid(), 'medecin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete rechutes" ON public.cancer_rechutes FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_rechutes_updated_at BEFORE UPDATE ON public.cancer_rechutes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table pour les traitements
CREATE TABLE public.traitements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cancer_cases(id) ON DELETE CASCADE,
  type_traitement text NOT NULL, -- Chirurgie, Chimiothérapie, Radiothérapie, Immunothérapie, Hormonothérapie, Thérapie ciblée
  date_debut date NOT NULL,
  date_fin date,
  protocole text,
  efficacite text, -- Réponse complète, Réponse partielle, Stable, Progression
  effets_secondaires text,
  medecin_traitant text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.traitements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view traitements" ON public.traitements FOR SELECT USING (true);
CREATE POLICY "Medecin can insert traitements" ON public.traitements FOR INSERT WITH CHECK (has_role(auth.uid(), 'medecin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Medecin can update traitements" ON public.traitements FOR UPDATE USING (has_role(auth.uid(), 'medecin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete traitements" ON public.traitements FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_traitements_updated_at BEFORE UPDATE ON public.traitements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table pour les RDV
CREATE TABLE public.rendez_vous (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cancer_cases(id) ON DELETE SET NULL,
  titre text NOT NULL,
  date_rdv timestamptz NOT NULL,
  duree_minutes int NOT NULL DEFAULT 30,
  type_rdv text NOT NULL DEFAULT 'consultation', -- consultation, chimio, radio, controle, biopsie
  lieu text,
  medecin text,
  notes text,
  rappel_envoye boolean NOT NULL DEFAULT false,
  statut text NOT NULL DEFAULT 'planifie', -- planifie, confirme, annule, termine
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rendez_vous ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view rdv" ON public.rendez_vous FOR SELECT USING (true);
CREATE POLICY "Medecin can insert rdv" ON public.rendez_vous FOR INSERT WITH CHECK (has_role(auth.uid(), 'medecin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Medecin can update rdv" ON public.rendez_vous FOR UPDATE USING (has_role(auth.uid(), 'medecin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete rdv" ON public.rendez_vous FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_rdv_updated_at BEFORE UPDATE ON public.rendez_vous FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket pour les PDFs anapath
INSERT INTO storage.buckets (id, name, public) VALUES ('anapath-documents', 'anapath-documents', false);

CREATE POLICY "Authenticated can upload anapath docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'anapath-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated can view anapath docs" ON storage.objects FOR SELECT USING (bucket_id = 'anapath-documents' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete own anapath docs" ON storage.objects FOR DELETE USING (bucket_id = 'anapath-documents' AND auth.role() = 'authenticated');

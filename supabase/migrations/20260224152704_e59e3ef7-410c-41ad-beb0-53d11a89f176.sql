
-- Add service/department to profiles for multi-doctor, oncology service tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS service text DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialite text DEFAULT NULL;

-- Add index for service-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_service ON public.profiles(service);

-- Prevent duplicate patients based on nom + prenom + date_naissance (case-insensitive)
-- First, create a unique index on lower(nom), lower(prenom), date_naissance
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_unique_identity
  ON patients (lower(nom), lower(prenom), date_naissance)
  WHERE date_naissance IS NOT NULL;

-- Also add a partial unique index for cases without date_naissance (nom+prenom only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_unique_identity_no_dob
  ON patients (lower(nom), lower(prenom))
  WHERE date_naissance IS NULL;

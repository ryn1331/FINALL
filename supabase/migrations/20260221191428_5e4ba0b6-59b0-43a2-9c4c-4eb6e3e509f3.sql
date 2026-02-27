
-- Add new roles to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'anapath';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistante';

/*
  # Auto-update caregiver statistics

  ## Changes

  ### 1. New column: first_service_at (caregivers)
  - Stores the timestamp of the first completed service
  - Used to calculate experience automatically

  ### 2. Trigger: update_caregiver_stats_on_completion
  - Fires after UPDATE on care_requests
  - When status transitions to 'completed', 'finalizado', or 'paid':
    - Increments total_services on the caregiver
    - Sets first_service_at if not already set

  ### 3. Identity verifications table
  - Stores caregiver identity verification documents
  - Accepts RG, CPF, and selfie uploads (Supabase Storage URLs)
  - Status: pending | in_review | verified | rejected
*/

-- Add first_service_at column to caregivers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'caregivers' AND column_name = 'first_service_at'
  ) THEN
    ALTER TABLE caregivers ADD COLUMN first_service_at timestamptz;
  END IF;
END $$;

-- Backfill total_services from existing completed care_requests
UPDATE caregivers c
SET total_services = (
  SELECT COUNT(*)
  FROM care_requests cr
  WHERE cr.caregiver_id = c.id
    AND cr.status IN ('completed', 'finalizado', 'paid', 'concluido', 'pago')
);

-- Backfill first_service_at from earliest completed request
UPDATE caregivers c
SET first_service_at = (
  SELECT MIN(cr.updated_at)
  FROM care_requests cr
  WHERE cr.caregiver_id = c.id
    AND cr.status IN ('completed', 'finalizado', 'paid', 'concluido', 'pago')
)
WHERE first_service_at IS NULL;

-- Trigger function to update stats when a care request is completed
CREATE OR REPLACE FUNCTION public.update_caregiver_stats_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on status transitions into a "done" state
  IF NEW.status IN ('completed', 'finalizado', 'paid', 'concluido', 'pago')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'finalizado', 'paid', 'concluido', 'pago'))
     AND NEW.caregiver_id IS NOT NULL
  THEN
    UPDATE caregivers
    SET
      total_services = COALESCE(total_services, 0) + 1,
      first_service_at = COALESCE(first_service_at, NOW())
    WHERE id = NEW.caregiver_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_caregiver_stats_on_completion() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_update_caregiver_stats ON care_requests;
CREATE TRIGGER trg_update_caregiver_stats
  AFTER UPDATE ON care_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_caregiver_stats_on_completion();

-- ============================================================
-- Identity verifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rg_url text,
  cpf_url text,
  selfie_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'verified', 'rejected')),
  rejection_reason text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caregiver can view own verification"
  ON identity_verifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Caregiver can insert own verification"
  ON identity_verifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Caregiver can update own verification"
  ON identity_verifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

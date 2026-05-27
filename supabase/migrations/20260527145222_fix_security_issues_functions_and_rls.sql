/*
  # Fix Security Issues

  ## Issues Fixed

  ### 1. Function Search Path Mutable
  - `update_caregiver_balance_on_transaction`: added SET search_path = public
  - `update_caregiver_rating`: added SET search_path = public

  ### 2. Public/Authenticated Can Execute SECURITY DEFINER Functions
  - Both are trigger-only functions, not meant to be called via RPC
  - Revoked EXECUTE from anon and authenticated roles

  ### 3. RLS Policy Always True — caregivers UPDATE
  - Dropped unrestricted "Authenticated users can update caregiver balances"
  - Added policy scoped to own row only (user_id = auth.uid())

  ### 4. RLS Policy Always True — notifications INSERT
  - Dropped unrestricted "System can insert notifications"
  - Added policy: users can only insert notifications for themselves

  ### 5. RLS Policy Always True — transactions INSERT
  - Dropped unrestricted "Authenticated users can insert transactions"
  - Added policy: users can only insert transactions for their own caregiver record
*/

-- ============================================================
-- 1. Fix update_caregiver_balance_on_transaction: set search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_caregiver_balance_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'payment' THEN
    UPDATE caregivers
    SET available_balance = COALESCE(available_balance, 0) + NEW.amount
    WHERE id = NEW.caregiver_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_caregiver_balance_on_transaction() FROM anon, authenticated;

-- ============================================================
-- 2. Fix update_caregiver_rating: set search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_caregiver_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT user_id INTO target_user_id
  FROM caregivers
  WHERE user_id = NEW.reviewed_id;

  IF target_user_id IS NOT NULL THEN
    UPDATE caregivers
    SET
      avg_rating = (
        SELECT ROUND(AVG(score)::numeric, 2)
        FROM ratings
        WHERE reviewed_id = NEW.reviewed_id
      ),
      total_ratings = (
        SELECT COUNT(*)
        FROM ratings
        WHERE reviewed_id = NEW.reviewed_id
      )
    WHERE user_id = NEW.reviewed_id;
  END IF;

  UPDATE patients
  SET
    avg_rating = (
      SELECT ROUND(AVG(score)::numeric, 2)
      FROM ratings
      WHERE reviewed_id = NEW.reviewed_id
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM ratings
      WHERE reviewed_id = NEW.reviewed_id
    )
  WHERE user_id = NEW.reviewed_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_caregiver_rating() FROM anon, authenticated;

-- ============================================================
-- 3. Fix caregivers UPDATE policy (was always true)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can update caregiver balances" ON caregivers;

CREATE POLICY "Caregiver can update own profile"
  ON caregivers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 4. Fix notifications INSERT policy (was always true)
-- ============================================================
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 5. Fix transactions INSERT policy (was always true)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON transactions;

CREATE POLICY "Caregiver can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM caregivers
      WHERE caregivers.id = transactions.caregiver_id
        AND caregivers.user_id = auth.uid()
    )
  );

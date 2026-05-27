/*
  # Fix caregiver balance: recalculate from payments and fix trigger

  ## Problem
  The available_balance was not being updated correctly because:
  1. The old trigger only fired on `transactions` INSERT, not on `payments` INSERT
  2. The new trigger had a deduplication check that blocked updates when transactions
     already existed for older payments
  3. Historical payments were never reflected in the balance

  ## Fix
  1. Recalculate and correct available_balance for all caregivers based on actual
     completed payments minus withdrawals
  2. Replace the trigger with a simpler, reliable version that doesn't double-count
     by checking the payments table directly instead of transactions
*/

-- Step 1: Recalculate correct balance for all caregivers
UPDATE caregivers c
SET available_balance = (
  SELECT COALESCE(SUM(
    CASE WHEN p.payment_method <> 'cash' THEN p.net_amount ELSE 0 END
  ), 0)
  FROM care_requests cr
  JOIN payments p ON p.request_id = cr.id AND p.status = 'completed'
  WHERE cr.caregiver_id = c.id
) - (
  SELECT COALESCE(SUM(w.amount), 0)
  FROM withdrawals w
  WHERE w.caregiver_id = c.id
    AND w.status IN ('completed', 'processing')
);

-- Step 2: Replace the payment trigger with a reliable version
-- Strategy: on each payment INSERT with status=completed, recalculate the full balance
-- This is idempotent and avoids any double-counting risk.

CREATE OR REPLACE FUNCTION public.update_caregiver_balance_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caregiver_id uuid;
BEGIN
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT caregiver_id INTO v_caregiver_id
  FROM care_requests
  WHERE id = NEW.request_id;

  IF v_caregiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Recalculate balance from scratch to avoid any drift
  UPDATE caregivers
  SET available_balance = (
    SELECT COALESCE(SUM(
      CASE WHEN p2.payment_method <> 'cash' THEN p2.net_amount ELSE 0 END
    ), 0)
    FROM care_requests cr2
    JOIN payments p2 ON p2.request_id = cr2.id AND p2.status = 'completed'
    WHERE cr2.caregiver_id = v_caregiver_id
  ) - (
    SELECT COALESCE(SUM(w.amount), 0)
    FROM withdrawals w
    WHERE w.caregiver_id = v_caregiver_id
      AND w.status IN ('completed', 'processing')
  )
  WHERE id = v_caregiver_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_caregiver_balance_on_payment() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_update_balance_on_payment ON payments;
CREATE TRIGGER trg_update_balance_on_payment
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_caregiver_balance_on_payment();

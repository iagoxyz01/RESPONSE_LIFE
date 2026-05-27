/*
  # Fix caregiver balance update on payment completion

  ## Problem
  The available_balance on caregivers was only updated when a row was inserted
  into the `transactions` table with type='payment'. But the CaregiverRequestPage
  (cash confirmation) only inserts into `payments` and `pending_fees`, never into
  `transactions`. This means the balance never updated for cash payments confirmed
  by the caregiver.

  ## Fix
  1. Create a trigger on the `payments` table that fires on INSERT when status='completed'
     - For non-cash payments: credit net_amount directly to available_balance
     - For cash payments: do NOT credit (fee is owed, handled separately via pending_fees)
  2. Also insert a record into transactions for audit trail in both cases

  ## Notes
  - The PaymentPage already manually updates the balance before this trigger was added.
    To avoid double-counting, we check if a transaction with this reference_id already exists.
*/

CREATE OR REPLACE FUNCTION public.update_caregiver_balance_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caregiver_id uuid;
BEGIN
  -- Only act on completed payments
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get caregiver_id from care_requests
  SELECT caregiver_id INTO v_caregiver_id
  FROM care_requests
  WHERE id = NEW.request_id;

  IF v_caregiver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Avoid double-counting: skip if a transaction for this payment already exists
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE reference_id = NEW.request_id::text
      AND type = 'payment'
      AND caregiver_id = v_caregiver_id
  ) THEN
    RETURN NEW;
  END IF;

  -- For non-cash payments: credit net_amount to available_balance
  IF NEW.payment_method <> 'cash' THEN
    UPDATE caregivers
    SET available_balance = COALESCE(available_balance, 0) + NEW.net_amount
    WHERE id = v_caregiver_id;
  END IF;

  -- Always insert a transaction record for audit trail
  INSERT INTO transactions (caregiver_id, type, amount, description, reference_id)
  VALUES (
    v_caregiver_id,
    'payment',
    NEW.net_amount,
    'Pagamento via ' || NEW.payment_method || ' - ' || LEFT(NEW.request_id::text, 8),
    NEW.request_id::text
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_caregiver_balance_on_payment() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_update_balance_on_payment ON payments;
CREATE TRIGGER trg_update_balance_on_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_caregiver_balance_on_payment();

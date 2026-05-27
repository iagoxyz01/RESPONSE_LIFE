/*
  # Add increment_caregiver_balance RPC function

  Used by the cancel-request Edge Function to atomically credit
  the caregiver's available_balance when a cancellation fee applies.
*/

CREATE OR REPLACE FUNCTION increment_caregiver_balance(
  p_caregiver_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE caregivers
  SET available_balance = COALESCE(available_balance, 0) + p_amount,
      updated_at = now()
  WHERE id = p_caregiver_id;
END;
$$;

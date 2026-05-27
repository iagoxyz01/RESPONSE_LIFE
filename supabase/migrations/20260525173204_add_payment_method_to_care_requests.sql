/*
  # Add payment_method to care_requests

  ## Changes
  - Add `payment_method` column to care_requests table
  - Values: 'card', 'pix', 'cash' (same as payments table)
  - This allows the patient to choose payment method upfront during request creation
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'care_requests' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE care_requests ADD COLUMN payment_method text CHECK (payment_method IN ('card', 'pix', 'cash'));
  END IF;
END $$;

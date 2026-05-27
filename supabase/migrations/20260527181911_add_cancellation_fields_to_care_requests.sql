/*
  # Add cancellation fields to care_requests

  ## Changes
  - `cancelled_at` (timestamptz): when the request was cancelled
  - `cancelled_by` (uuid): user id who cancelled
  - `cancellation_reason` (text): optional reason provided

  ## Security
  - No new tables; existing RLS on care_requests covers these columns.
  - Patients may only cancel/delete their own requests (enforced by existing RLS).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'care_requests' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE care_requests ADD COLUMN cancelled_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'care_requests' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE care_requests ADD COLUMN cancelled_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'care_requests' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE care_requests ADD COLUMN cancellation_reason text;
  END IF;
END $$;

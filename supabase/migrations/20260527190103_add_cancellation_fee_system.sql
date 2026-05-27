/*
  # Cancellation Fee System

  ## Overview
  Implements automatic cancellation fees when a patient cancels a confirmed
  care request within 10 hours of the scheduled start time.

  ## Fee Rules
  - Only applies when caregiver has already been assigned (status: scheduled, awaiting_payment)
  - Only applies when cancellation is within 10 hours of scheduled_at
  - Fee = 20% of proposed_value
    - 10% → caregiver (credited to caregiver balance)
    - 10% → platform

  ## New Columns on care_requests
  - `cancellation_fee_applied` (boolean) — whether a fee was charged
  - `cancellation_fee_total`   (numeric) — total fee amount (20%)
  - `cancellation_fee_caregiver` (numeric) — caregiver share (10%)
  - `cancellation_fee_platform`  (numeric) — platform share (10%)

  ## New Table: cancellation_fees
  Full audit record of every cancellation fee event.
  Linked to care_requests and caregivers for financial reporting.
*/

-- 1. Add fee columns to care_requests
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='care_requests' AND column_name='cancellation_fee_applied') THEN
    ALTER TABLE care_requests ADD COLUMN cancellation_fee_applied boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='care_requests' AND column_name='cancellation_fee_total') THEN
    ALTER TABLE care_requests ADD COLUMN cancellation_fee_total numeric(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='care_requests' AND column_name='cancellation_fee_caregiver') THEN
    ALTER TABLE care_requests ADD COLUMN cancellation_fee_caregiver numeric(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='care_requests' AND column_name='cancellation_fee_platform') THEN
    ALTER TABLE care_requests ADD COLUMN cancellation_fee_platform numeric(10,2);
  END IF;
END $$;

-- 2. cancellation_fees audit table
CREATE TABLE IF NOT EXISTS cancellation_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES care_requests(id) ON DELETE CASCADE,
  caregiver_id uuid REFERENCES caregivers(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  cancelled_by uuid REFERENCES auth.users(id),
  proposed_value numeric(10,2) NOT NULL,
  fee_total numeric(10,2) NOT NULL,
  fee_caregiver numeric(10,2) NOT NULL,
  fee_platform numeric(10,2) NOT NULL,
  hours_before_start numeric(6,2) NOT NULL,
  cancellation_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cancellation_fees ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cancellation_fees_request_id   ON cancellation_fees (request_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_fees_caregiver_id ON cancellation_fees (caregiver_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_fees_created_at   ON cancellation_fees (created_at DESC);

-- Only service role (edge functions) can read/write cancellation_fees
CREATE POLICY "Authenticated users can view own cancellation fees"
  ON cancellation_fees FOR SELECT
  TO authenticated
  USING (cancelled_by = auth.uid());

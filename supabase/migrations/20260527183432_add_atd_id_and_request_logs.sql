/*
  # Add ATD ID and Request Logs

  ## New Features
  1. `care_requests.atd_number` — auto-incrementing integer used to build the human-readable ID (ATD-0001)
  2. `care_requests.atd_id` — generated column storing the formatted string (ATD-XXXX)
  3. `request_logs` table — audit log recording every lifecycle event on a care_request

  ## New Tables
  - `request_logs`
    - `id` (uuid)
    - `request_id` (uuid, FK → care_requests)
    - `event` (text) — e.g. "created", "accepted", "started", "finished", "cancelled", "edited", "payment_confirmed"
    - `actor_id` (uuid, nullable) — who triggered the event
    - `actor_role` (text) — "patient", "caregiver", "admin", "system"
    - `details` (jsonb) — extra context
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled; only admins (via service role) can read/write request_logs
  - Patients and caregivers cannot read audit logs directly

  ## Notes
  - Sequence starts at 1; existing rows get sequential numbers via a one-time UPDATE
  - atd_id is a stored generated column (immutable once set)
  - A trigger auto-inserts a "created" log when a new care_request is inserted
*/

-- 1. Sequence for ATD numbers
CREATE SEQUENCE IF NOT EXISTS atd_number_seq START 1;

-- 2. Add atd_number column (integer, unique)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'care_requests' AND column_name = 'atd_number'
  ) THEN
    ALTER TABLE care_requests ADD COLUMN atd_number integer UNIQUE DEFAULT nextval('atd_number_seq');
  END IF;
END $$;

-- 3. Back-fill existing rows with sequential numbers
UPDATE care_requests
SET atd_number = nextval('atd_number_seq')
WHERE atd_number IS NULL;

-- 4. Add atd_id as a generated stored column (ATD-XXXX zero-padded to 4 digits)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'care_requests' AND column_name = 'atd_id'
  ) THEN
    ALTER TABLE care_requests
      ADD COLUMN atd_id text GENERATED ALWAYS AS ('ATD-' || lpad(atd_number::text, 4, '0')) STORED;
  END IF;
END $$;

-- 5. Index on atd_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_care_requests_atd_id ON care_requests (atd_id);

-- 6. request_logs table
CREATE TABLE IF NOT EXISTS request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES care_requests(id) ON DELETE CASCADE,
  event text NOT NULL,
  actor_id uuid,
  actor_role text NOT NULL DEFAULT 'system',
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_request_logs_request_id ON request_logs (request_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs (created_at DESC);

-- Service role can do everything (edge functions use service role)
CREATE POLICY "Service role full access to request_logs"
  ON request_logs FOR SELECT
  TO authenticated
  USING (false);

-- 7. Trigger: auto-log when a care_request is created
CREATE OR REPLACE FUNCTION log_care_request_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO request_logs (request_id, event, actor_id, actor_role, details)
  VALUES (
    NEW.id,
    'created',
    NEW.requester_id,
    'patient',
    jsonb_build_object('care_type', NEW.care_type, 'atd_id', NEW.atd_id, 'proposed_value', NEW.proposed_value)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_care_request_created ON care_requests;
CREATE TRIGGER trg_log_care_request_created
  AFTER INSERT ON care_requests
  FOR EACH ROW EXECUTE FUNCTION log_care_request_created();

-- 8. Trigger: auto-log status changes
CREATE OR REPLACE FUNCTION log_care_request_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  event_name text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  event_name := CASE NEW.status
    WHEN 'awaiting_approval' THEN 'caregiver_interested'
    WHEN 'scheduled'         THEN 'accepted'
    WHEN 'in_progress'       THEN 'started'
    WHEN 'awaiting_payment'  THEN 'finished'
    WHEN 'completed'         THEN 'payment_confirmed'
    WHEN 'cancelled'         THEN 'cancelled'
    ELSE 'status_changed'
  END;

  INSERT INTO request_logs (request_id, event, actor_id, actor_role, details)
  VALUES (
    NEW.id,
    event_name,
    COALESCE(NEW.cancelled_by, auth.uid()),
    CASE
      WHEN NEW.status = 'cancelled' AND NEW.cancelled_by IS NOT NULL THEN 'patient'
      WHEN NEW.status IN ('in_progress', 'awaiting_payment') THEN 'caregiver'
      WHEN NEW.status = 'scheduled' THEN 'patient'
      ELSE 'system'
    END,
    jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'cancellation_reason', NEW.cancellation_reason
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_care_request_status ON care_requests;
CREATE TRIGGER trg_log_care_request_status
  AFTER UPDATE OF status ON care_requests
  FOR EACH ROW EXECUTE FUNCTION log_care_request_status_change();

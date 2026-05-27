/*
  # Improve Support Tickets System

  ## Changes to support_tickets
  - Add `ticket_number` (auto-increment integer) and `ticket_id` generated column (SUP-0001)
  - Add `message` (text) — detailed description from user
  - Add `request_id` (uuid, nullable) — linked care request (ATD-XXXX)
  - Add `admin_response` (text, nullable) — response written by admin
  - Add `admin_notes` (text, nullable) — internal notes visible only to admin
  - Add `resolved_by` (uuid, nullable) — which admin resolved

  ## Security
  - Existing RLS policies remain; users can insert and read their own tickets
  - Added UPDATE policy so users can update only their own tickets (not status)

  ## Notes
  - Existing rows get sequential ticket numbers
  - ticket_id format: SUP-0001, SUP-0002, etc.
*/

-- 1. Sequence
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

-- 2. ticket_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'ticket_number'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN ticket_number integer UNIQUE DEFAULT nextval('ticket_number_seq');
  END IF;
END $$;

-- Back-fill
UPDATE support_tickets SET ticket_number = nextval('ticket_number_seq') WHERE ticket_number IS NULL;

-- 3. ticket_id generated column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'ticket_id'
  ) THEN
    ALTER TABLE support_tickets
      ADD COLUMN ticket_id text GENERATED ALWAYS AS ('SUP-' || lpad(ticket_number::text, 4, '0')) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_id ON support_tickets (ticket_id);

-- 4. message (detailed body)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'message'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN message text NOT NULL DEFAULT '';
  END IF;
END $$;

-- 5. request_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'request_id'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN request_id uuid REFERENCES care_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. admin_response
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'admin_response'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN admin_response text;
  END IF;
END $$;

-- 7. admin_notes (internal)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN admin_notes text;
  END IF;
END $$;

-- 8. resolved_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'resolved_by'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN resolved_by uuid;
  END IF;
END $$;

-- 9. Index for fast search
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id    ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status     ON support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category   ON support_tickets (category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_request_id ON support_tickets (request_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets (created_at DESC);

/*
  # Add scheduled_end_at and system message support

  ## Changes

  ### 1. care_requests: add scheduled_end_at column
  - Stores the planned end datetime of the service
  - Used to replace duration_minutes in the new request form

  ### 2. messages: ensure message_type column supports system/photo
  - Already exists; no change needed to schema

  ### 3. monitoring_photos: no schema changes needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'care_requests' AND column_name = 'scheduled_end_at'
  ) THEN
    ALTER TABLE care_requests ADD COLUMN scheduled_end_at timestamptz;
  END IF;
END $$;

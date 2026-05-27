/*
  # Fix Rating System — Add trigger to auto-update averages

  ## Problems
  1. The ratings INSERT policy requires `caregiver_id` to match, but after 
     service completion the request uses `requester_id` for patients.
  2. Updating average ratings from the client side fails due to RLS — 
     patients can't update caregivers table and vice versa.
  3. The caregiver trying to rate uses `reviewer_id = auth.uid()` but the 
     policy checks `caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())`
     which works, BUT the patient policy only checks `requester_id = auth.uid()`.
     Family members who created the request might have a different user_id than the patient.

  ## Changes
  1. Relax the ratings INSERT policy — allow any authenticated user who is 
     a participant in the request (requester, patient, or assigned caregiver)
  2. Create a database trigger that automatically updates the average rating
     on caregivers and patients tables whenever a new rating is inserted
  3. This removes the need for client-side rating average updates
*/

-- Drop old restrictive INSERT policy
DROP POLICY IF EXISTS "Participants can leave ratings" ON ratings;

-- New broader INSERT policy
CREATE POLICY "Request participants can leave ratings"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  );

-- Function to update average rating on caregivers table
CREATE OR REPLACE FUNCTION update_caregiver_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find the user_id of the reviewed caregiver
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

  -- Also try updating patient if the reviewed_id is a patient user_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_rating_inserted ON ratings;

-- Create trigger
CREATE TRIGGER on_rating_inserted
  AFTER INSERT ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_caregiver_rating();

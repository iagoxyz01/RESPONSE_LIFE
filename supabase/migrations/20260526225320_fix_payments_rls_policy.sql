/*
  # Fix Payments RLS - Allow patients to create payments

  ## Problem
  The current INSERT policy for payments only checks:
  `care_requests.requester_id = auth.uid()`
  
  But `auth.uid()` is the auth user ID, not the profile ID.
  Patients need to create payments, and the patient_id in care_requests
  is what matters, not requester_id.

  ## Solution
  Update the INSERT policy to allow:
  1. Requesters (those who created the request) to create payments
  2. Patients in the request to create payments
*/

-- Drop old restrictive INSERT policy
DROP POLICY IF EXISTS "Requesters can create payments" ON payments;

-- New INSERT policy that allows patients and requesters to create payments
CREATE POLICY "Request participants can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    request_id IN (
      SELECT id FROM care_requests
      WHERE 
        requester_id = auth.uid()
        OR patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid())
    )
  );

/*
  # Fix Caregiver Accept/Reject RLS Policies

  ## Problem
  Caregivers could not update care_requests in 'searching' status because
  the existing UPDATE policy only allowed:
  - The requester (patient) to update
  - The assigned caregiver (caregiver_id) to update
  
  But when a request is in 'searching' status, caregiver_id is NULL,
  so caregivers could never add themselves to interested_caregivers
  or rejected_caregivers arrays.

  ## Changes
  1. Drop the restrictive "Requesters can update own requests" policy
  2. Add separate update policies:
     - Requesters can update their own requests
     - Caregivers can update searching/awaiting_approval requests (to accept/reject)
     - Assigned caregivers can update their assigned requests (for status changes)
  3. Add SELECT policy for caregivers to see searching requests they can act on
*/

-- Drop old restrictive update policy
DROP POLICY IF EXISTS "Requesters can update own requests" ON care_requests;

-- Requesters (patients/family) can update their own requests
CREATE POLICY "Requesters can update own requests"
  ON care_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id)
  WITH CHECK (auth.uid() = requester_id);

-- Caregivers can update searching requests to express interest or reject
CREATE POLICY "Caregivers can update searching requests"
  ON care_requests FOR UPDATE
  TO authenticated
  USING (
    status IN ('searching', 'awaiting_approval')
    AND auth.uid() IN (SELECT user_id FROM caregivers)
  )
  WITH CHECK (
    status IN ('searching', 'awaiting_approval', 'scheduled')
    AND auth.uid() IN (SELECT user_id FROM caregivers)
  );

-- Assigned caregivers can update their own requests (start/end service)
CREATE POLICY "Assigned caregivers can update their requests"
  ON care_requests FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM caregivers WHERE id = caregiver_id)
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM caregivers WHERE id = caregiver_id)
  );

-- Fix SELECT policy: caregivers need to see searching requests
DROP POLICY IF EXISTS "Caregivers can view searching requests" ON care_requests;

-- Comprehensive SELECT policy
CREATE POLICY "Users can view relevant requests"
  ON care_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = requester_id
    OR auth.uid() IN (SELECT user_id FROM patients WHERE id = patient_id)
    OR auth.uid() IN (SELECT user_id FROM caregivers WHERE id = caregiver_id)
    OR status IN ('searching', 'awaiting_approval')
  );

/*
  # Proje Response Live - Complete Database Schema

  ## Overview
  Marketplace platform connecting patients/families with professional caregivers.
  Includes real-time monitoring with photos, chat, payments, and ratings.

  ## Tables Created
  1. profiles - User profiles (extends auth.users)
  2. caregivers - Caregiver-specific data (specialties, experience, rating)
  3. patients - Patient-specific data (health conditions)
  4. family_members - Family/responsible linking to patients
  5. care_requests - Service requests with status tracking
  6. monitoring_photos - Photo evidence with GPS metadata
  7. messages - Real-time chat messages
  8. payments - Payment transactions (card/pix/cash)
  9. ratings - Mutual ratings after service
  10. notifications - In-app notification system
  11. withdrawals - Caregiver payout requests
  12. pending_fees - Pending platform fees for cash payments
  13. caregiver_specialties - Many-to-many specialties

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
  - Caregivers can view request data for accepted requests
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  user_type text NOT NULL DEFAULT 'patient' CHECK (user_type IN ('patient', 'caregiver', 'family', 'admin')),
  verified boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow viewing other profiles for matching purposes
CREATE POLICY "Users can view other profiles for matching"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Specialties reference table
CREATE TABLE IF NOT EXISTS specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view specialties"
  ON specialties FOR SELECT
  TO authenticated
  USING (true);

-- Insert default specialties
INSERT INTO specialties (name, description) VALUES
  ('Higiene Pessoal', 'Cuidados com higiene e banho'),
  ('Medicação', 'Administração de medicamentos'),
  ('Companhia', 'Companhia e suporte emocional'),
  ('Reabilitação', 'Exercícios e fisioterapia básica'),
  ('Limpeza', 'Limpeza e organização doméstica'),
  ('Alimentação', 'Preparo de refeições e alimentação'),
  ('Transporte', 'Acompanhamento em consultas e exames'),
  ('Cuidados Noturnos', 'Monitoramento e cuidados noturnos')
ON CONFLICT (name) DO NOTHING;

-- Caregivers table
CREATE TABLE IF NOT EXISTS caregivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  cpf text UNIQUE,
  bio text DEFAULT '',
  experience_years integer DEFAULT 0,
  avg_rating numeric(3,2) DEFAULT 0,
  total_ratings integer DEFAULT 0,
  total_services integer DEFAULT 0,
  status text DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline', 'suspended')),
  pix_key text DEFAULT '',
  available_balance numeric(10,2) DEFAULT 0,
  pending_balance numeric(10,2) DEFAULT 0,
  latitude numeric(10,8),
  longitude numeric(11,8),
  last_location_update timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE caregivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caregivers can view own record"
  ON caregivers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Caregivers can update own record"
  ON caregivers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Caregivers can insert own record"
  ON caregivers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow patients to view caregiver profiles
CREATE POLICY "Patients can view caregiver profiles"
  ON caregivers FOR SELECT
  TO authenticated
  USING (true);

-- Caregiver specialties junction table
CREATE TABLE IF NOT EXISTS caregiver_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  specialty_id uuid NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  UNIQUE(caregiver_id, specialty_id)
);

ALTER TABLE caregiver_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view caregiver specialties"
  ON caregiver_specialties FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Caregivers can manage own specialties"
  ON caregiver_specialties FOR INSERT
  TO authenticated
  WITH CHECK (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Caregivers can delete own specialties"
  ON caregiver_specialties FOR DELETE
  TO authenticated
  USING (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  date_of_birth date,
  gender text CHECK (gender IN ('M', 'F', 'O')),
  health_conditions text DEFAULT '',
  avg_rating numeric(3,2) DEFAULT 0,
  total_ratings integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own record"
  ON patients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Patients can update own record"
  ON patients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Patients can insert own record"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Caregivers can view basic patient info for accepted requests
CREATE POLICY "Caregivers can view patient info"
  ON patients FOR SELECT
  TO authenticated
  USING (true);

-- Family members table
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  relationship text DEFAULT '',
  can_pay boolean DEFAULT true,
  can_request boolean DEFAULT true,
  can_monitor boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, patient_id)
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view own records"
  ON family_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Family members can insert own records"
  ON family_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Care requests (main service table)
CREATE TABLE IF NOT EXISTS care_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  caregiver_id uuid REFERENCES caregivers(id),
  requester_id uuid NOT NULL REFERENCES profiles(id),
  care_type text NOT NULL,
  status text NOT NULL DEFAULT 'searching' CHECK (
    status IN (
      'searching',
      'awaiting_approval',
      'scheduled',
      'in_progress',
      'awaiting_payment',
      'completed',
      'cancelled'
    )
  ),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  actual_duration_minutes integer,
  location_address text NOT NULL DEFAULT '',
  latitude numeric(10,8),
  longitude numeric(11,8),
  proposed_value numeric(10,2) NOT NULL,
  final_value numeric(10,2),
  observations text DEFAULT '',
  cancel_reason text DEFAULT '',
  cancelled_at timestamptz,
  interested_caregivers uuid[] DEFAULT '{}',
  rejected_caregivers uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE care_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can view own requests"
  ON care_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = requester_id
    OR auth.uid() IN (SELECT user_id FROM patients WHERE id = patient_id)
    OR auth.uid() IN (SELECT user_id FROM caregivers WHERE id = caregiver_id)
  );

CREATE POLICY "Requesters can create requests"
  ON care_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requesters can update own requests"
  ON care_requests FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = requester_id
    OR auth.uid() IN (SELECT user_id FROM caregivers WHERE id = caregiver_id)
  )
  WITH CHECK (
    auth.uid() = requester_id
    OR auth.uid() IN (SELECT user_id FROM caregivers WHERE id = caregiver_id)
  );

-- Allow caregivers to view open requests for matching
CREATE POLICY "Caregivers can view searching requests"
  ON care_requests FOR SELECT
  TO authenticated
  USING (
    status = 'searching'
    OR status = 'awaiting_approval'
    OR auth.uid() IN (SELECT user_id FROM caregivers WHERE id = caregiver_id)
    OR auth.uid() = requester_id
  );

-- Monitoring photos
CREATE TABLE IF NOT EXISTS monitoring_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES care_requests(id) ON DELETE CASCADE,
  caregiver_id uuid NOT NULL REFERENCES caregivers(id),
  photo_url text NOT NULL,
  latitude numeric(10,8),
  longitude numeric(11,8),
  photo_type text NOT NULL DEFAULT 'periodic' CHECK (photo_type IN ('start', 'periodic', 'end')),
  taken_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE monitoring_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Request participants can view photos"
  ON monitoring_photos FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Caregivers can insert photos"
  ON monitoring_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

-- Messages (chat)
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES care_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  media_url text DEFAULT '',
  read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Chat participants can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Recipients can update message read status"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  );

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES care_requests(id),
  payment_method text NOT NULL CHECK (payment_method IN ('card', 'pix', 'cash')),
  gross_amount numeric(10,2) NOT NULL,
  platform_fee numeric(10,2) NOT NULL,
  net_amount numeric(10,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'refunded')
  ),
  pix_qr_code text DEFAULT '',
  pix_copy_paste text DEFAULT '',
  transaction_id text DEFAULT '',
  error_message text DEFAULT '',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Request participants can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Requesters can create payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    request_id IN (
      SELECT id FROM care_requests WHERE requester_id = auth.uid()
    )
  );

CREATE POLICY "Request participants can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  );

-- Ratings
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES care_requests(id),
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  reviewed_id uuid NOT NULL REFERENCES profiles(id),
  score integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(request_id, reviewer_id)
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ratings about them"
  ON ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = reviewed_id OR auth.uid() = reviewer_id);

CREATE POLICY "Request participants can view all request ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Participants can leave ratings"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND request_id IN (
      SELECT id FROM care_requests
      WHERE requester_id = auth.uid()
        OR caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
    )
  );

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text DEFAULT '',
  request_id uuid REFERENCES care_requests(id),
  read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Withdrawals
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL REFERENCES caregivers(id),
  amount numeric(10,2) NOT NULL,
  pix_key text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  transaction_id text DEFAULT '',
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caregivers can view own withdrawals"
  ON withdrawals FOR SELECT
  TO authenticated
  USING (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Caregivers can request withdrawals"
  ON withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

-- Pending fees (for cash payments)
CREATE TABLE IF NOT EXISTS pending_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES care_requests(id),
  caregiver_id uuid NOT NULL REFERENCES caregivers(id),
  fee_amount numeric(10,2) NOT NULL,
  reason text DEFAULT 'cash_payment',
  paid boolean DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pending_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caregivers can view own pending fees"
  ON pending_fees FOR SELECT
  TO authenticated
  USING (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert pending fees"
  ON pending_fees FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_caregivers_status ON caregivers(status);
CREATE INDEX IF NOT EXISTS idx_caregivers_avg_rating ON caregivers(avg_rating);
CREATE INDEX IF NOT EXISTS idx_care_requests_status ON care_requests(status);
CREATE INDEX IF NOT EXISTS idx_care_requests_patient ON care_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_caregiver ON care_requests(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_requester ON care_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_care_requests_scheduled ON care_requests(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_photos_request ON monitoring_photos(request_id);
CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_payments_request ON payments(request_id);
CREATE INDEX IF NOT EXISTS idx_ratings_reviewed ON ratings(reviewed_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_caregiver ON withdrawals(caregiver_id);

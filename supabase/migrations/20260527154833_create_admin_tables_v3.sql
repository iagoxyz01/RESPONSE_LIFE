/*
  # Admin Panel Infrastructure v3
*/

CREATE TABLE IF NOT EXISTS admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name     text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'support'
                  CHECK (role IN ('master','moderator','financial','support')),
  totp_secret   text,
  totp_enabled  boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  last_login_ip text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL,
  ip_address   text,
  user_agent   text,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS admin_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_email  text NOT NULL DEFAULT '',
  action       text NOT NULL,
  target_type  text,
  target_id    text,
  details      jsonb,
  ip_address   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS support_tickets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  category     text NOT NULL DEFAULT 'general'
                 CHECK (category IN ('complaint','report','question','financial','other')),
  subject      text NOT NULL DEFAULT '',
  description  text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','in_progress','resolved','closed')),
  priority     text NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_tickets' AND policyname='Users can view own tickets') THEN
    CREATE POLICY "Users can view own tickets" ON support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_tickets' AND policyname='Users can create tickets') THEN
    CREATE POLICY "Users can create tickets" ON support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='suspended') THEN
    ALTER TABLE profiles ADD COLUMN suspended boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='identity_verifications' AND column_name='rejection_reason') THEN
    ALTER TABLE identity_verifications ADD COLUMN rejection_reason text;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars','avatars',true,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Authenticated users can upload avatars') THEN
    CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Anyone can view avatars') THEN
    CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Users can update own avatars') THEN
    CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Users can delete own avatars') THEN
    CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');
  END IF;
END $$;

-- Seed default admin (password: Admin@2024!)
INSERT INTO admin_users (email, password_hash, full_name, role)
VALUES ('admin@responselive.com','$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiUFo5XjpTwL0FLpAFpJXsYmqTBO','Administrador Master','master')
ON CONFLICT (email) DO NOTHING;

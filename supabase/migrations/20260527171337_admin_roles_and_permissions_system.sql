/*
  # Admin Roles and Permissions System

  ## Summary
  Extends the admin system with granular per-admin permissions, custom roles table,
  and session tracking improvements.

  ## New Tables
  - `admin_roles` — custom roles with a JSON permissions array (created by Master)

  ## Modified Tables
  - `admin_users` — adds `permissions` jsonb column for per-admin overrides,
    `role_id` uuid FK to admin_roles for custom roles (nullable, falls back to
    the `role` text column for built-in roles).

  ## New Columns on admin_logs
  - `user_agent` text — browser/device info (was stored in sessions, now also in logs)

  ## Security
  - All new tables use RLS restricted to service_role only
*/

-- admin_roles table for custom / extended roles
CREATE TABLE IF NOT EXISTS admin_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_roles' AND policyname='Service role select admin_roles') THEN
    CREATE POLICY "Service role select admin_roles" ON admin_roles FOR SELECT TO service_role USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_roles' AND policyname='Service role insert admin_roles') THEN
    CREATE POLICY "Service role insert admin_roles" ON admin_roles FOR INSERT TO service_role WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_roles' AND policyname='Service role update admin_roles') THEN
    CREATE POLICY "Service role update admin_roles" ON admin_roles FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_roles' AND policyname='Service role delete admin_roles') THEN
    CREATE POLICY "Service role delete admin_roles" ON admin_roles FOR DELETE TO service_role USING (true);
  END IF;
END $$;

-- Add permissions and role_id to admin_users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='permissions') THEN
    ALTER TABLE admin_users ADD COLUMN permissions jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='role_id') THEN
    ALTER TABLE admin_users ADD COLUMN role_id uuid REFERENCES admin_roles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add user_agent to admin_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_logs' AND column_name='user_agent') THEN
    ALTER TABLE admin_logs ADD COLUMN user_agent text;
  END IF;
END $$;

-- Seed default built-in roles as reference rows
INSERT INTO admin_roles (name, description, permissions)
VALUES
  ('moderator', 'Moderador padrão', '["view_users","ban_users","approve_caregivers","approve_documents","view_requests","view_support","view_logs"]'::jsonb),
  ('financial', 'Financeiro padrão', '["view_financial","approve_withdrawals","view_logs"]'::jsonb),
  ('support', 'Suporte padrão', '["view_users","view_support","view_logs"]'::jsonb),
  ('supervisor', 'Supervisor', '["view_users","ban_users","approve_caregivers","approve_documents","view_requests","view_financial","view_support","view_logs"]'::jsonb),
  ('verifier', 'Verificador de documentos', '["view_users","approve_documents","view_logs"]'::jsonb),
  ('attendant', 'Atendente', '["view_support","view_users","view_logs"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

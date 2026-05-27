/*
  # Fix Security Issues

  ## Summary
  Addresses all security advisories reported by Supabase:

  1. Storage Bucket Listing
     - Replaces broad SELECT policies on `avatars` and `monitoring-photos` buckets
       with object-level access so clients cannot list all files in the bucket.
       Access is restricted to the owner of each object.

  2. SECURITY DEFINER Functions Exposed to anon/authenticated via RPC
     - Revokes EXECUTE on the four trigger-only functions from `anon` and
       `authenticated` roles. These functions are invoked exclusively by internal
       database triggers and must never be callable via the REST API.

  3. Admin Tables Have RLS Enabled But No Policies
     - Adds service-role-only policies for admin_users, admin_sessions, and
       admin_logs. These tables are accessed exclusively through the Edge Function
       admin API using the service role key.
*/

-- ============================================================
-- 1. Fix storage SELECT policies (prevent bucket listing)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Anyone can view avatars') THEN
    DROP POLICY "Anyone can view avatars" ON storage.objects;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Users can view own avatars') THEN
    CREATE POLICY "Users can view own avatars"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'avatars' AND owner = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Authenticated can view monitoring photos') THEN
    DROP POLICY "Authenticated can view monitoring photos" ON storage.objects;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Users can view own monitoring photos') THEN
    CREATE POLICY "Users can view own monitoring photos"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'monitoring-photos' AND owner = auth.uid());
  END IF;
END $$;

-- ============================================================
-- 2. Revoke RPC access to SECURITY DEFINER trigger functions
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.update_caregiver_balance_on_payment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_caregiver_balance_on_transaction() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_caregiver_rating() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_caregiver_stats_on_completion() FROM anon, authenticated;

-- ============================================================
-- 3. Add RLS policies for admin tables (service role only)
-- ============================================================

-- admin_users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_users' AND policyname='Service role select admin_users') THEN
    CREATE POLICY "Service role select admin_users" ON admin_users FOR SELECT TO service_role USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_users' AND policyname='Service role insert admin_users') THEN
    CREATE POLICY "Service role insert admin_users" ON admin_users FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_users' AND policyname='Service role update admin_users') THEN
    CREATE POLICY "Service role update admin_users" ON admin_users FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_users' AND policyname='Service role delete admin_users') THEN
    CREATE POLICY "Service role delete admin_users" ON admin_users FOR DELETE TO service_role USING (true);
  END IF;
END $$;

-- admin_sessions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_sessions' AND policyname='Service role select admin_sessions') THEN
    CREATE POLICY "Service role select admin_sessions" ON admin_sessions FOR SELECT TO service_role USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_sessions' AND policyname='Service role insert admin_sessions') THEN
    CREATE POLICY "Service role insert admin_sessions" ON admin_sessions FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_sessions' AND policyname='Service role update admin_sessions') THEN
    CREATE POLICY "Service role update admin_sessions" ON admin_sessions FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_sessions' AND policyname='Service role delete admin_sessions') THEN
    CREATE POLICY "Service role delete admin_sessions" ON admin_sessions FOR DELETE TO service_role USING (true);
  END IF;
END $$;

-- admin_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_logs' AND policyname='Service role select admin_logs') THEN
    CREATE POLICY "Service role select admin_logs" ON admin_logs FOR SELECT TO service_role USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_logs' AND policyname='Service role insert admin_logs') THEN
    CREATE POLICY "Service role insert admin_logs" ON admin_logs FOR INSERT TO service_role WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_logs' AND policyname='Service role update admin_logs') THEN
    CREATE POLICY "Service role update admin_logs" ON admin_logs FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_logs' AND policyname='Service role delete admin_logs') THEN
    CREATE POLICY "Service role delete admin_logs" ON admin_logs FOR DELETE TO service_role USING (true);
  END IF;
END $$;

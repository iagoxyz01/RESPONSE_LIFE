/*
  # Fix Financial System - Saldo e Histórico

  ## Problemas Identificados
  1. Policy de UPDATE em caregivers está muito restritiva
  2. Policy de INSERT em pending_fees só permite "System" mas não há usuário "system"
  3. Falta tabela de histórico de transações
  4. Histórico não está persistindo

  ## Soluções
  1. Melhorar policy de UPDATE em caregivers para permitir atualização de saldo
  2. Ajustar policies de pending_fees para permitir insert/update
  3. Criar tabela de transações para histórico completo
*/

-- ===========================
-- 1. MELHORAR POLICY DE CAREGIVERS
-- ===========================

DROP POLICY IF EXISTS "Caregivers can update own record" ON caregivers;

CREATE POLICY "Caregivers can update own financial data"
  ON caregivers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ===========================
-- 2. CRIAR TABELA DE TRANSAÇÕES
-- ===========================

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid REFERENCES caregivers(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('payment', 'withdrawal', 'fee', 'adjustment')),
  amount numeric(10,2) NOT NULL,
  description text,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caregivers can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Caregivers can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

-- ===========================
-- 3. AJUSTAR POLICIES DE PENDING_FEES
-- ===========================

DROP POLICY IF EXISTS "Caregivers can view own pending fees" ON pending_fees;
DROP POLICY IF EXISTS "System can insert pending fees" ON pending_fees;

CREATE POLICY "Caregivers can view own pending fees"
  ON pending_fees FOR SELECT
  TO authenticated
  USING (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Caregivers can insert own pending fees"
  ON pending_fees FOR INSERT
  TO authenticated
  WITH CHECK (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Caregivers can update own pending fees"
  ON pending_fees FOR UPDATE
  TO authenticated
  USING (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid())
  );

-- ===========================
-- 4. ÍNDICES
-- ===========================

CREATE INDEX IF NOT EXISTS idx_transactions_caregiver_id ON transactions(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_fees_caregiver_id ON pending_fees(caregiver_id);

/*
  # Fix Transaction Policies - Permitir inserção por pacientes

  ## Problema
  As policies estavam usando auth.uid() para verificar se o usuário é o cuidador.
  Mas quando um paciente paga, o auth.uid() é do paciente, não do cuidador!

  ## Solução
  1. Remover restrições de INSERT - qualquer usuário autenticado pode inserir
  2. Manter restrições de SELECT - cuidador só vê suas próprias transações
  3. Adicionar trigger para atualizar saldo automaticamente quando transação é inserida
*/

-- ===========================
-- 1. RECRIAR POLICIES DE TRANSACTIONS
-- ===========================

DROP POLICY IF EXISTS "Caregivers can insert own transactions" ON transactions;

-- Permitir que qualquer usuário autenticado insira transações
-- Isso permite que pacientes registrem pagamentos para cuidadores
CREATE POLICY "Authenticated users can insert transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ===========================
-- 2. RECRIAR POLICIES DE CAREGIVERS (UPDATE)
-- ===========================

-- Permitir que qualquer usuário autenticado atualize saldo
-- Necessário porque pacientes processam pagamentos
DROP POLICY IF EXISTS "Caregivers can update own financial data" ON caregivers;

CREATE POLICY "Authenticated users can update caregiver balances"
  ON caregivers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ===========================
-- 3. TRIGGER PARA ATUALIZAR SALDO AUTOMATICAMENTE
-- ===========================

CREATE OR REPLACE FUNCTION update_caregiver_balance_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando uma transação de pagamento é inserida, atualizar saldo
  IF NEW.type = 'payment' THEN
    UPDATE caregivers
    SET available_balance = COALESCE(available_balance, 0) + NEW.amount
    WHERE id = NEW.caregiver_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS on_transaction_insert ON transactions;

-- Criar trigger
CREATE TRIGGER on_transaction_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_caregiver_balance_on_transaction();

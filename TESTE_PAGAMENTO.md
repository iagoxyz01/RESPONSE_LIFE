# Guia de Teste - Pagamento

## Problema Corrigido

A política de RLS (Row Level Security) do Supabase não permitia que pacientes criassem registros de pagamento. Isso foi corrigido atualizando a política para permitir que tanto o requisitante quanto o paciente possam criar pagamentos.

## Como Testar

### Pré-requisitos
1. Ter um atendimento no status `awaiting_payment`
2. Estar logado como paciente

### Passo a Passo

#### 1. Ir para a página de detalhes do atendimento
- Clique em "Histórico" ou "Início" (Dashboard)
- Procure por um atendimento com status "Aguardando Pagamento"
- Clique no atendimento

#### 2. Ver o botão de pagamento
- Na seção "Pagamento Pendente", clique em **"Ir para Pagamento"**
- A página de pagamento deve abrir mostrando o valor total

#### 3. Testar Pix
1. Clique em **"Pix"**
2. Você verá:
   - QR Code fictício
   - Código Pix para copiar
   - Botão "Copiar Código Pix"
3. Clique em **"Confirmar Pagamento"**
4. Aguarde 2 segundos (simulação de processamento)
5. Você verá a tela de sucesso com ✓

#### 4. Testar Cartão
1. Clique em **"Voltar"** e selecione **"Cartão de Crédito"**
2. Preencha os dados:
   - Nome no Cartão: qualquer nome
   - Número: qualquer número (será formatado em grupos de 4)
   - Validade: MM/AA (ex: 12/25)
   - CVV: 3 ou 4 dígitos
3. Clique em **"Pagar R$ XXX,XX"**
4. Aguarde 3 segundos
5. Você verá a tela de sucesso

#### 5. Testar Dinheiro
1. Clique em **"Voltar"** e selecione **"Dinheiro"**
2. Leia a mensagem (pagamento presencial)
3. Clique em **"Confirmar Pagamento Presencial"**
4. Aguarde 1.5 segundo
5. Você verá a tela de sucesso

### O Que Acontece Após o Pagamento

1. ✓ O status muda para "Concluído"
2. ✓ O valor é registrado no banco de dados
3. ✓ O cuidador recebe (net = valor - taxa 7,5%)
4. ✓ Você pode avaliar o cuidador
5. ✓ Se for dinheiro, uma taxa fica pendente para o cuidador cobrar

## Possíveis Erros e Soluções

### "Erro ao processar pagamento"
- Verifique sua conexão de internet
- Certifique-se de que está autenticado
- Recarregue a página e tente novamente

### "Solicitação não encontrada"
- O atendimento pode ter sido deletado
- Verifique o ID do atendimento
- Tente uma solicitação diferente

### Pix Code não gera
- Isso é normal em simulação
- O código é fictício apenas para demonstração
- Ignore e clique "Confirmar Pagamento"

## Onde os Dados São Salvos

Após confirmar o pagamento:

1. **Tabela payments**: novo registro com
   - request_id
   - payment_method (pix/card/cash)
   - gross_amount (total)
   - platform_fee (7,5%)
   - net_amount (o que o cuidador recebe)
   - status (completed)
   - paid_at (horário)

2. **Tabela care_requests**: status atualizado
   - status = 'completed'
   - final_value = valor pago

3. **Tabela caregivers**: saldo atualizado
   - available_balance += net_amount

## Debug

Se ainda houver problemas, verifique:

```bash
# Verifique se a RLS policy foi aplicada
SELECT * FROM pg_policies WHERE tablename = 'payments';

# Verifique se você é um patient
SELECT id FROM patients WHERE user_id = auth.uid();

# Verifique se há uma care_request para seu teste
SELECT id, patient_id, requester_id, status FROM care_requests LIMIT 5;
```

## Próximos Passos

Após testar o pagamento:
1. Verifique a Carteira (cuidador) para ver o saldo atualizado
2. Teste o saque de fundos
3. Teste a avaliação do cuidador

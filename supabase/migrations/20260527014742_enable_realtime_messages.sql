/*
  # Enable Realtime for Messages Table

  ## O que faz
  1. Adiciona tabela messages à publicação supabase_realtime
  2. Permite que o chat funcione em tempo real
  3. Habilita replica para a tabela
*/

-- Habilitar replica na tabela messages
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Adicionar tabela messages à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Verificar se foi adicionado
SELECT pubname, tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'messages';

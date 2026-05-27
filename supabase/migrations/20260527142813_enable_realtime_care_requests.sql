/*
  # Enable Realtime for care_requests table

  Habilita realtime na tabela care_requests para que o paciente
  veja atualizações de status em tempo real quando o cuidador aceitar.
*/

ALTER TABLE care_requests REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE care_requests;

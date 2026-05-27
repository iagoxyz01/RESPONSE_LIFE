/*
  # Reload PostgREST Schema Cache

  O PostgREST mantém um cache dos schemas das tabelas.
  Quando uma tabela é modificada, precisamos notificar o PostgREST
  para recarregar o cache.

  Execução: NOTIFY pgrst, 'reload schema'
*/

NOTIFY pgrst, 'reload schema';

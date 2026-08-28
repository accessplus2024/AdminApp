-- O Sentinel já tinha uma rede de segurança contra posts presos em "pending"
-- ("Processando" na tela): runDiscovery (api/sentinel.js, fluxo do
-- Instagram) devolvia pra fila qualquer coisa parada há mais de 10 min. Mas
-- isso só rodava quando alguém clicava em "Coletar", e devolvia pra fila SEM
-- LIMITE — se um item travar por um motivo estrutural (não por azar de
-- timing), ele reentra em pending, trava nesse mesmo passo de novo, e fica
-- girando pra sempre sem nunca virar um sinal de alerta pra alguém revisar.
--
-- Caso real (2026-08-23): 17 posts do Instagram ficaram presos em "pending"
-- desde 2026-08-20/21 porque ninguém clicou em "Coletar" nesse intervalo — a
-- rede de segurança existia, mas não tinha por que rodar sozinha.
--
-- stale_recoveries conta quantas vezes um post foi devolvido de "pending"
-- travado para a fila. Ao atingir o limite (ver MAX_STALE_RECOVERIES em
-- api/lib/staleRecovery.js), o post vai para "failed" em vez de voltar pra
-- fila de novo — assim quem trava de verdade aparece em Falhas pra revisão
-- humana, em vez de repetir o mesmo travamento silenciosamente.
alter table public.sentinel_posts
  add column stale_recoveries integer not null default 0 check (stale_recoveries >= 0);

comment on column public.sentinel_posts.stale_recoveries is
  'Quantas vezes este post foi devolvido de "pending" travado para a fila. Ao atingir o limite (ver api/lib/staleRecovery.js), vai para "failed" em vez de repetir.';

// api/lib/staleRecovery.js
//
// Rede de segurança compartilhada contra posts do Sentinel presos em
// "pending" (mostrado como "Processando" na tela) — acontece quando uma
// execução (Instagram ou pesquisa de sites) morre no meio (timeout do
// servidor, deploy, aba fechada, queda de rede) antes de devolver o item
// pra fila.
//
// Antes existia um sweep parecido só dentro de runDiscovery (api/sentinel.js,
// fluxo do Instagram), que rodava apenas quando alguém clicava em "Coletar" —
// e sempre devolvia pra fila, sem limite de tentativas. Um item que trava por
// um motivo estrutural (não por azar de timing) reentrava em "pending" e
// travava de novo no mesmo passo, pra sempre, sem nunca virar um sinal de
// alerta. Caso real (2026-08-23): 17 posts do Instagram presos desde
// 2026-08-20/21 simplesmente porque ninguém tinha clicado em "Coletar" nesse
// intervalo.
//
// releaseStalePendingPosts agora é chamada nos principais pontos de entrada
// do Sentinel (Instagram, coleta/pesquisa de sites) e:
//   1. Pega tudo que está "pending" há mais de STALE_MINUTES.
//   2. Quem ainda não estourou o limite de tentativas volta pra "queued"
//      (fila) com stale_recoveries+1.
//   3. Quem já estourou vai pra "failed" (revisão manual), em vez de ficar
//      girando pra sempre.
//
// Continua best-effort e silencioso do ponto de vista de quem clicou o
// botão — não é uma ação separada nem exige decisão humana pra rodar (o
// catálogo já tem "cancelar pesquisa" pra quem quer destravar uma execução
// específica na hora); isso aqui só evita que uma execução esquecida fique
// presa pra sempre sem ninguém perceber.
export const STALE_MINUTES = 10;
export const MAX_STALE_RECOVERIES = 3;

export async function releaseStalePendingPosts(supabase, {
  staleMinutes = STALE_MINUTES,
  maxRecoveries = MAX_STALE_RECOVERIES,
} = {}) {
  const staleBefore = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const { data: stuck, error: fetchError } = await supabase
    .from('sentinel_posts')
    .select('id, stale_recoveries')
    .eq('status', 'pending')
    .lt('updated_at', staleBefore);
  if (fetchError) throw fetchError;
  if (!stuck || !stuck.length) return { requeued: 0, failed: 0 };

  const toRequeue = stuck.filter((row) => (row.stale_recoveries || 0) < maxRecoveries);
  const toFail = stuck.filter((row) => (row.stale_recoveries || 0) >= maxRecoveries);
  const now = new Date().toISOString();

  if (toRequeue.length) {
    // Atualiza uma linha de cada vez pra poder gravar o stale_recoveries
    // individual de cada uma (um único .update().in() não permite expressões
    // do tipo "coluna = coluna + 1" via supabase-js). O .eq('status','pending')
    // extra evita reabrir algo que, entre a leitura acima e este update, já
    // tenha sido processado de verdade por uma execução em andamento.
    await Promise.all(toRequeue.map((row) => supabase.from('sentinel_posts').update({
      status: 'queued',
      run_id: null,
      stale_recoveries: (row.stale_recoveries || 0) + 1,
      error: `Travado em processamento por mais de ${staleMinutes} min; devolvido automaticamente para a fila (tentativa ${(row.stale_recoveries || 0) + 1}/${maxRecoveries}).`,
      updated_at: now,
    }).eq('id', row.id).eq('status', 'pending')));
  }
  if (toFail.length) {
    const { error: failError } = await supabase.from('sentinel_posts').update({
      status: 'failed',
      run_id: null,
      processed_at: now,
      updated_at: now,
      error: `Travado em processamento repetidamente (mais de ${maxRecoveries} tentativas) — movido para Falhas para revisão manual em vez de voltar à fila de novo.`,
    }).in('id', toFail.map((row) => row.id)).eq('status', 'pending');
    if (failError) throw failError;
  }
  return { requeued: toRequeue.length, failed: toFail.length };
}

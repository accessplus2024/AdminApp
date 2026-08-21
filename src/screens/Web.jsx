import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Checkbox, Table } from '../components';
import { Ic } from '../lib/icons';
import {
  collectSources, confirmEnrichment, deleteCandidates, findEnrichmentCandidates, fetchProcessedWebCandidates,
  fetchQueuedWebCandidates, researchCandidates, WEB_SOURCES,
} from '../lib/scraperWeb';

const PLATFORM_LABEL = { google: 'Google', youtube: 'YouTube', reddit: 'Reddit', instagram: 'Instagram' };

const STATUS_PROCESSADO_LABEL = {
  qualified: { label: 'Qualificada', variant: 'success' },
  duplicate: { label: 'Duplicada', variant: 'neutral' },
  rejected: { label: 'Rejeitada', variant: 'warning' },
  failed: { label: 'Falhou', variant: 'danger' },
};

export default function Web({ perms, onCatalogChanged }) {
  const [fila, setFila] = useState([]);
  const [processados, setProcessados] = useState([]);
  const [fontesEscolhidas, setFontesEscolhidas] = useState(new Set(WEB_SOURCES));
  const [selecionados, setSelecionados] = useState(new Set());
  const [selecionadosProcessados, setSelecionadosProcessados] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // rótulo do que está rodando agora, ou null
  const [error, setError] = useState('');
  const [enriquecimentos, setEnriquecimentos] = useState({}); // id do candidato -> { loading, data, error }

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    try {
      const [candidatos, resultados] = await Promise.all([
        fetchQueuedWebCandidates(), fetchProcessedWebCandidates(),
      ]);
      setFila(candidatos);
      setProcessados(resultados);
      setSelecionados((prev) => new Set([...prev].filter((id) => candidatos.some((c) => c.id === id))));
      setSelecionadosProcessados((prev) => new Set([...prev].filter((id) => resultados.some((r) => r.id === id))));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarTudo(); }, [carregarTudo]);

  const rodar = async (rotulo, acao) => {
    setBusy(rotulo);
    setError('');
    try {
      await acao();
      await carregarTudo();
      onCatalogChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const podeRodar = perms?.canWrite;
  const alternar = (id) => setSelecionados((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const todosMarcados = fila.length > 0 && selecionados.size === fila.length;

  const alternarProcessado = (id) => setSelecionadosProcessados((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const todosProcessadosMarcados = processados.length > 0 && selecionadosProcessados.size === processados.length;

  // Fase 3 (opcional): só faz sentido pra linhas 'qualified'. Dois passos —
  // busca + avaliação da IA primeiro (nada é salvo), você escolhe o que
  // aproveitar, e só então confirma. Cada linha tem seu próprio estado, então
  // enriquecer uma não trava as outras.
  const enriquecer = async (row) => {
    setEnriquecimentos((prev) => ({ ...prev, [row.id]: { loading: true } }));
    try {
      const resultado = await findEnrichmentCandidates(row.opportunityId);
      const selecionadosIniciais = new Set(resultado.candidatos.filter((c) => c.sugerido).map((c) => c.url));
      setEnriquecimentos((prev) => ({
        ...prev, [row.id]: { loading: false, resultado, selecionados: selecionadosIniciais },
      }));
    } catch (e) {
      setEnriquecimentos((prev) => ({ ...prev, [row.id]: { loading: false, error: e.message } }));
    }
  };

  const alternarCandidatoEnriquecimento = (rowId, url) => setEnriquecimentos((prev) => {
    const estado = prev[rowId];
    if (!estado) return prev;
    const next = new Set(estado.selecionados);
    if (next.has(url)) next.delete(url); else next.add(url);
    return { ...prev, [rowId]: { ...estado, selecionados: next } };
  });

  const confirmarEnriquecimentoDaLinha = async (row) => {
    const estado = enriquecimentos[row.id];
    if (!estado?.resultado) return;
    const escolhidos = estado.resultado.candidatos.filter((c) => estado.selecionados.has(c.url));
    setEnriquecimentos((prev) => ({ ...prev, [row.id]: { ...prev[row.id], salvando: true } }));
    try {
      const salvo = await confirmEnrichment(row.opportunityId, escolhidos);
      setEnriquecimentos((prev) => ({ ...prev, [row.id]: { ...prev[row.id], salvando: false, salvo, resultado: null } }));
    } catch (e) {
      setEnriquecimentos((prev) => ({ ...prev, [row.id]: { ...prev[row.id], salvando: false, error: e.message } }));
    }
  };

  const alternarFonte = (nome) => setFontesEscolhidas((prev) => {
    const next = new Set(prev);
    if (next.has(nome)) next.delete(nome); else next.add(nome);
    return next;
  });
  const todasFontesMarcadas = fontesEscolhidas.size === WEB_SOURCES.length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card flat>
        <CardHeader>
          <CardTitle>1. Buscar novidades</CardTitle>
        </CardHeader>
        <CardBody>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginTop: -4, marginBottom: 14 }}>
            Busca posts recentes das fontes marcadas e filtra por elegibilidade (ensino médio + auxílio
            financeiro). Isso NÃO gasta chamada de IA — só enfileira os candidatos pra você escolher
            quais valem uma pesquisa completa.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 14 }}>
            {WEB_SOURCES.map((nome) => (
              <Checkbox
                key={nome}
                label={nome}
                checked={fontesEscolhidas.has(nome)}
                onChange={() => alternarFonte(nome)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button
              variant="outline"
              onClick={() => setFontesEscolhidas(todasFontesMarcadas ? new Set() : new Set(WEB_SOURCES))}
            >
              {todasFontesMarcadas ? 'Desmarcar todas' : 'Marcar todas'}
            </Button>
            <Button
              variant="primary"
              disabled={!podeRodar || busy !== null || fontesEscolhidas.size === 0}
              iconLeft={Ic(busy === 'collect' ? 'loader' : 'search', 'ico-sm')}
              onClick={() => rodar('collect', () => collectSources([...fontesEscolhidas]))}
            >
              {busy === 'collect' ? 'Buscando…' : `Buscar (${fontesEscolhidas.size} ${fontesEscolhidas.size === 1 ? 'fonte' : 'fontes'})`}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card flat>
        <CardHeader>
          <CardTitle>2. Escolher o que pesquisar {fila.length > 0 && <Badge variant="primary">{fila.length}</Badge>}</CardTitle>
        </CardHeader>
        <CardBody>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginTop: -4, marginBottom: 14 }}>
            Esta etapa é a que custa: ela abre o link de verdade e usa IA pra extrair a oportunidade
            completa. Marque só o que parece valer a pena — o resto continua na fila pra depois.
          </p>
          {loading ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Carregando…</p>
          ) : fila.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Fila vazia — rode uma busca acima.</p>
          ) : (
            <>
              <Table
                columns={[
                  { key: 'sel', header: '', width: 32 },
                  { key: 'titulo', header: 'Título' },
                  { key: 'fonte', header: 'Fonte' },
                  { key: 'link', header: 'Link' },
                ]}
                data={fila}
                rowKey="id"
                renderCell={(row, col) => {
                  if (col.key === 'sel') return <Checkbox checked={selecionados.has(row.id)} onChange={() => alternar(row.id)} />;
                  if (col.key === 'link') return <a href={row.link} target="_blank" rel="noreferrer">{row.link}</a>;
                  return row[col.key];
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                <Button
                  variant="outline"
                  onClick={() => setSelecionados(todosMarcados ? new Set() : new Set(fila.map((c) => c.id)))}
                >
                  {todosMarcados ? 'Desmarcar todas' : 'Marcar todas'}
                </Button>
                <Button
                  variant="primary"
                  disabled={!podeRodar || busy !== null || selecionados.size === 0}
                  iconLeft={Ic(busy === 'research-sel' ? 'loader' : 'sparkles', 'ico-sm')}
                  onClick={() => rodar('research-sel', () => researchCandidates({ postIds: [...selecionados] }))}
                >
                  {busy === 'research-sel' ? 'Pesquisando…' : `Pesquisar selecionadas (${selecionados.size})`}
                </Button>
                <Button
                  variant="outline"
                  disabled={!podeRodar || busy !== null}
                  iconLeft={Ic(busy === 'research-10' ? 'loader' : 'sparkles', 'ico-sm')}
                  onClick={() => rodar('research-10', () => researchCandidates({ maxCandidates: 10 }))}
                >
                  {busy === 'research-10' ? 'Pesquisando…' : 'Pesquisar as 10 mais antigas'}
                </Button>
              </div>
            </>
          )}
          {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>{error}</p>}
        </CardBody>
      </Card>

      <Card flat>
        <CardHeader>
          <CardTitle>Já pesquisados {processados.length > 0 && <Badge variant="neutral">{processados.length}</Badge>}</CardTitle>
        </CardHeader>
        <CardBody>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginTop: -4, marginBottom: 14 }}>
            Resultado da pesquisa (fase 2), pra você acompanhar sem precisar abrir o Supabase. As
            "Qualificadas" já foram criadas no Catálogo com status "Revisar" — abra o Catálogo pra
            aprovar. Rejeitadas, duplicadas e falhas mostram o motivo exato aqui. Pra essa lista não
            crescer sem limite, rejeitadas/duplicadas/falhas com mais de 30 dias são apagadas
            automaticamente pelo cron diário — o botão abaixo deixa você limpar algo antes disso também.
          </p>
          {loading ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Carregando…</p>
          ) : processados.length === 0 ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Nada pesquisado ainda.</p>
          ) : (
            <>
              <Table
                columns={[
                  { key: 'sel', header: '', width: 32 },
                  { key: 'titulo', header: 'Título' },
                  { key: 'fonte', header: 'Fonte' },
                  { key: 'status', header: 'Status' },
                  { key: 'detalhe', header: 'Detalhe' },
                ]}
                data={processados}
                rowKey="id"
                renderCell={(row, col) => {
                  if (col.key === 'sel') return <Checkbox checked={selecionadosProcessados.has(row.id)} onChange={() => alternarProcessado(row.id)} />;
                  if (col.key === 'titulo') return <a href={row.link} target="_blank" rel="noreferrer">{row.titulo}</a>;
                  if (col.key === 'status') {
                    const info = STATUS_PROCESSADO_LABEL[row.status] || { label: row.status, variant: 'neutral' };
                    return <Badge variant={info.variant}>{info.label}</Badge>;
                  }
                  if (col.key === 'detalhe') {
                    const temMotivo = ['failed', 'rejected', 'duplicate'].includes(row.status) && row.error;
                    if (temMotivo) {
                      const cor = row.status === 'failed' ? 'var(--danger)' : 'var(--muted-foreground)';
                      return <span style={{ color: cor, fontSize: 13 }} title={row.error}>{row.error.length > 80 ? `${row.error.slice(0, 80)}…` : row.error}</span>;
                    }
                    if (row.status === 'qualified') {
                      const estado = enriquecimentos[row.id];
                      const candidatos = estado?.resultado?.candidatos || [];
                      // Item 7 (2026-08-21): row.status === 'qualified' só quer dizer
                      // que o Sentinel criou/achou uma oportunidade — não que ela já
                      // foi aprovada. Enriquecer antes da aprovação busca link extra
                      // pra algo que ainda pode ser rejeitado ou mudar de nome/tema
                      // na revisão humana (ver comentário em api/lib/enrichment.js).
                      if (row.opportunityStatus !== 'Aprovada') {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', maxWidth: 420 }}>
                            <span>Revisar no Catálogo</span>
                            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
                              Aguardando aprovação{row.opportunityQualificationStatus === 'pending' ? ' (elegibilidade pendente)' : ''} — o enriquecimento libera depois que a oportunidade for aprovada.
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', maxWidth: 420 }}>
                          <span>Revisar no Catálogo</span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={estado?.loading}
                            iconLeft={Ic(estado?.loading ? 'loader' : 'sparkles', 'ico-xs')}
                            onClick={() => enriquecer(row)}
                          >
                            {estado?.loading ? 'Buscando…' : 'Enriquecer (Serper/YouTube/Reddit)'}
                          </Button>
                          {estado?.error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{estado.error}</span>}
                          {estado?.resultado && candidatos.length === 0 && (
                            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>Nenhum link novo encontrado.</span>
                          )}
                          {candidatos.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                              {candidatos.map((c) => (
                                <label key={c.url} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12 }}>
                                  <Checkbox
                                    checked={estado.selecionados.has(c.url)}
                                    onChange={() => alternarCandidatoEnriquecimento(row.id, c.url)}
                                  />
                                  <span>
                                    <Badge variant={c.sugerido ? 'success' : 'neutral'}>{PLATFORM_LABEL[c.platform] || c.platform}</Badge>{' '}
                                    <a href={c.url} target="_blank" rel="noreferrer">{c.title || c.url}</a>
                                    <br />
                                    <span style={{ color: 'var(--muted-foreground)' }}>{c.motivo}</span>
                                  </span>
                                </label>
                              ))}
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={estado.salvando || estado.selecionados.size === 0}
                                onClick={() => confirmarEnriquecimentoDaLinha(row)}
                              >
                                {estado.salvando ? 'Salvando…' : `Adicionar selecionados (${estado.selecionados.size})`}
                              </Button>
                            </div>
                          )}
                          {estado?.salvo && (
                            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>
                              {estado.salvo.adicionados} recurso(s) adicionado(s) (total na oportunidade: {estado.salvo.total}).
                            </span>
                          )}
                          {estado?.resultado?.errors && (
                            <span style={{ color: 'var(--danger)', fontSize: 12 }}>
                              Alguma busca falhou: {Object.entries(estado.resultado.errors).map(([k, v]) => `${k}: ${v}`).join('; ')}
                            </span>
                          )}
                        </div>
                      );
                    }
                    return '—';
                  }
                  return row[col.key] ?? '—';
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                <Button
                  variant="outline"
                  onClick={() => setSelecionadosProcessados(todosProcessadosMarcados ? new Set() : new Set(processados.map((p) => p.id)))}
                >
                  {todosProcessadosMarcados ? 'Desmarcar todas' : 'Marcar todas'}
                </Button>
                <Button
                  variant="outline"
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  disabled={!podeRodar || busy !== null || selecionadosProcessados.size === 0}
                  iconLeft={Ic(busy === 'delete' ? 'loader' : 'trash', 'ico-sm')}
                  onClick={() => rodar('delete', () => deleteCandidates([...selecionadosProcessados]))}
                >
                  {busy === 'delete' ? 'Excluindo…' : `Excluir selecionadas (${selecionadosProcessados.size})`}
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

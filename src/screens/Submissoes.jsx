import { useEffect, useState } from 'react';
import { Card, Badge, Button, Input, Textarea } from '../components';
import { Ic } from '../lib/icons';
import { fetchSubmissions, approveSubmission, markSubmission, SUBMISSION_STATUS } from '../lib/submissions';

// Fila de oportunidades enviadas por organizações pelo formulário público do
// site — irmã da fila do Sentinel, mas em tela própria porque o formato dos
// dados é bem diferente (ver lib/submissions.js). Fica ao lado de "Sentinel"
// no menu, não escondida, pra revisar as duas sem precisar caçar.
export default function Submissoes({ perms = {} }) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [q, setQ] = useState('');
  const [processando, setProcessando] = useState(null);
  const [rejeitando, setRejeitando] = useState(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  const carregar = () => {
    setCarregando(true);
    fetchSubmissions()
      .then(setItens)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  };

  useEffect(carregar, []);

  const pendentes = itens.filter((s) => s.status === 'pending');
  const rows = q
    ? pendentes.filter((s) =>
        s.title.toLowerCase().includes(q.toLowerCase()) ||
        s.organization_name.toLowerCase().includes(q.toLowerCase()))
    : pendentes;

  const aprovar = async (sub) => {
    setProcessando(sub.id);
    try {
      await approveSubmission(sub);
      carregar();
    } catch (e) {
      alert('Erro ao aprovar: ' + e.message);
    } finally {
      setProcessando(null);
    }
  };

  const confirmarRejeicao = async (sub) => {
    setProcessando(sub.id);
    try {
      await markSubmission(sub, 'rejected', motivoRejeicao.trim() || null);
      setRejeitando(null);
      setMotivoRejeicao('');
      carregar();
    } catch (e) {
      alert('Erro ao rejeitar: ' + e.message);
    } finally {
      setProcessando(null);
    }
  };

  const marcarDuplicata = async (sub) => {
    setProcessando(sub.id);
    try {
      await markSubmission(sub, 'duplicate', 'Já existe uma oportunidade equivalente no catálogo.');
      carregar();
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setProcessando(null);
    }
  };

  if (carregando) {
    return <Card flat><div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)' }}>Carregando…</div></Card>;
  }
  if (erro) {
    return <Card flat><div style={{ padding: 48, textAlign: 'center', color: 'var(--destructive)' }}>{erro}</div></Card>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Input placeholder="Buscar por título ou organização…" icon={Ic('search', 'ico-sm')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Badge variant="warning">{pendentes.length} pendente{pendentes.length === 1 ? '' : 's'}</Badge>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {rows.map((sub) => (
          <Card key={sub.id}>
            <div style={{ display: 'flex', gap: 16, padding: '18px 20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', marginBottom: 4 }}>
                  {sub.title}
                </h3>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {Ic('building-2', 'ico-xs')} {sub.organization_name}
                </div>
                <p style={{ fontSize: 14, color: 'var(--foreground)', marginBottom: 12, maxWidth: '60ch' }}>
                  {sub.description}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  <Badge variant="neutral">{sub.type}</Badge>
                  <Badge variant="neutral">{sub.cost}</Badge>
                  <Badge variant="neutral">{sub.format}</Badge>
                  {(sub.level || []).map((n) => <Badge key={n} variant="neutral">{n}</Badge>)}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{Ic('link', 'ico-xs')} <a href={sub.link} target="_blank" rel="noreferrer">{sub.link}</a></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{Ic('calendar', 'ico-xs')} {sub.deadline}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{Ic('mail', 'ico-xs')} {sub.submitter_name} — {sub.submitter_email}</span>
                </div>
                {sub.submitter_note && (
                  <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 10, fontStyle: 'italic' }}>
                    "{sub.submitter_note}"
                  </p>
                )}

                {rejeitando === sub.id && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                    <Textarea
                      placeholder="Motivo da rejeição (opcional, ajuda quem revisar depois)"
                      value={motivoRejeicao}
                      onChange={(e) => setMotivoRejeicao(e.target.value)}
                      rows={2}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="destructive" size="sm" onClick={() => confirmarRejeicao(sub)} disabled={processando === sub.id}>
                        Confirmar rejeição
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setRejeitando(null); setMotivoRejeicao(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {perms.canWrite && rejeitando !== sub.id && (
                <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, width: 180 }}>
                  <Button variant="primary" size="sm" onClick={() => aprovar(sub)} disabled={processando === sub.id}
                    iconLeft={Ic('circle-check', 'ico-xs')}>
                    {processando === sub.id ? 'Aprovando…' : 'Aprovar'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => marcarDuplicata(sub)} disabled={processando === sub.id}>
                    Marcar duplicata
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRejeitando(sub.id)} disabled={processando === sub.id}>
                    Rejeitar
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}

        {rows.length === 0 && (
          <Card flat>
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)' }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Ic('inbox', 'ico')}</div>
              {pendentes.length === 0 ? 'Nenhuma submissão aguardando revisão.' : 'Nenhuma submissão encontrada com essa busca.'}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

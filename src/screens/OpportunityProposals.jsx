import { useCallback, useEffect, useState } from 'react';
import { applyResearchProposal, fetchOpportunityProposals, rejectResearchProposal } from '../lib/sentinel';
import { ProposalCard } from './Sentinel';

const reviewableFields = (proposal) => Object.keys(proposal.changes || {})
  .filter((field) => field !== 'qualification_reason' && proposal.evidence?.[field]?.kind !== 'qualification_gap');

// Painel lateral do detalhe da oportunidade: mostra a sugestão pendente mais
// recente do Sentinel pra essa oportunidade, com a mesma escolha campo a campo
// da tela Sentinel (marcar = aceitar, desmarcar = recusar, lápis = ajustar o
// valor antes de aplicar). Assim dá pra revisar sem sair da página.
export default function OpportunityProposals({ opportunityId, onApplied, canWrite }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState(null);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProposals(await fetchOpportunityProposals(opportunityId));
    } catch (error) {
      setNotice({ type: 'error', text: `Não foi possível carregar as sugestões: ${error.message}` });
    } finally { setLoading(false); }
  }, [opportunityId]);

  useEffect(() => { setSelection(null); setEdits({}); setNotice(null); load(); }, [load]);

  const latest = proposals[0];
  if (loading || (!latest && !notice)) return null;

  const fields = latest ? (selection || reviewableFields(latest)) : [];
  const toggle = (_proposal, field) => setSelection(fields.includes(field) ? fields.filter((f) => f !== field) : fields.concat(field));
  const edit = (_proposal, field, value) => setEdits((current) => ({ ...current, [field]: value }));
  const reset = (_proposal, field) => setEdits((current) => { const next = { ...current }; delete next[field]; return next; });

  const finish = async (text) => {
    setSelection(null); setEdits({});
    setNotice({ type: 'success', text });
    await load();
  };
  const apply = async (proposal, chosen, chosenEdits) => {
    setBusy(true); setNotice(null);
    try {
      await applyResearchProposal(proposal.id, chosen, chosenEdits);
      await onApplied?.();
      await finish(`${chosen.length} ${chosen.length === 1 ? 'mudança aplicada' : 'mudanças aplicadas'}; as demais foram recusadas.`);
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };
  const reject = async (proposal) => {
    setBusy(true); setNotice(null);
    try {
      await rejectResearchProposal(proposal.id);
      await finish('Sugestão descartada. Nada mudou no catálogo.');
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="opportunity-proposals">
      <div className="opportunity-proposals__heading">
        <strong>Sugestões do Sentinel</strong>
        {latest && <small>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(latest.created_at))}</small>}
      </div>
      {notice && <div className={`workflow-notice workflow-notice--${notice.type}`}>{notice.text}</div>}
      {latest && (
        <>
          <p className="opportunity-proposals__help">Marcado = aceitar, desmarcado = recusar. Clique no valor novo para ajustar antes de aplicar.</p>
          <ProposalCard
            compact
            proposal={latest}
            selection={fields}
            edits={edits}
            onToggleField={toggle}
            onEditField={edit}
            onResetField={reset}
            onApply={apply}
            onReject={reject}
            busy={busy || !canWrite}
          />
          {proposals.length > 1 && (
            <small className="opportunity-proposals__older">
              Há {proposals.length - 1} {proposals.length === 2 ? 'sugestão pendente mais antiga' : 'sugestões pendentes mais antigas'} para esta oportunidade — elas aparecem aqui depois que você decidir esta.
            </small>
          )}
        </>
      )}
    </div>
  );
}

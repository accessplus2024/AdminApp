import { useState, useEffect } from 'react';
import { Card, Table, Badge, Button, Avatar, Input, Select, Field, Dialog } from '../components';
import { Ic } from '../lib/icons';
import D from '../lib/data';
import { fetchTeam, inviteMember, removeMember } from '../lib/team';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Team({ perms = {} }) {
  const [q, setQ] = useState('');
  const [invite, setInvite] = useState(false);
  const [team, setTeam] = useState(D.team);   // começa no mock, troca pelo real

  // formulário do convite
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState('Editor');
  const [invBusy, setInvBusy] = useState(false);
  const [invErr, setInvErr] = useState('');
  const [remover, setRemover] = useState(null);   // membro a remover (confirmação)

  const recarregar = () => {
    fetchTeam().then((lista) => { if (lista.length) setTeam(lista); });
  };
  useEffect(() => {
    let ativo = true;
    fetchTeam().then((lista) => { if (ativo && lista.length) setTeam(lista); });
    return () => { ativo = false; };
  }, []);

  const enviarConvite = async () => {
    setInvErr(''); setInvBusy(true);
    try {
      await inviteMember({ email: invEmail, role: invRole });
      setInvite(false); setInvEmail(''); setInvRole('Editor');
      recarregar();
    } catch (e) { setInvErr(e.message); }
    finally { setInvBusy(false); }
  };

  const confirmarRemocao = async () => {
    try { await removeMember(remover.email); setRemover(null); recarregar(); }
    catch (e) { alert('Erro ao remover: ' + e.message); }
  };

  let rows = team;
  if (q) rows = rows.filter((m) =>
    m.nome.toLowerCase().includes(q.toLowerCase()) ||
    m.email.toLowerCase().includes(q.toLowerCase()) ||
    m.cargo.toLowerCase().includes(q.toLowerCase())
  );

  const cols = [
    { key: 'nome',   header: 'Membro' },
    { key: 'cargo',  header: 'Função' },
    { key: 'papel',  header: 'Permissão' },
    { key: 'status', header: 'Status' },
    { key: 'acoes',  header: '', align: 'right', width: 90 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 280 }}>
          <Input placeholder="Buscar membro…" icon={Ic('search', 'ico-sm')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        {perms.canManageTeam && (
          <Button variant="primary" iconLeft={Ic('user-plus', 'ico-sm')} onClick={() => setInvite(true)}>Convidar membro</Button>
        )}
      </div>

      <Card flat>
        <div className="ap-table-wrap">
        <Table columns={cols} data={rows} renderCell={(m, c) => {
          if (c.key === 'nome') return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <Avatar src={m.avatar} initials={m.iniciais} size="md" color={m.cor} />
              <div>
                <div style={{ fontWeight: 600 }}>{m.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{m.email}</div>
              </div>
            </div>
          );
          if (c.key === 'papel')  return <Badge variant={D.papelVariant[m.papel] || 'neutral'}>{m.papel}</Badge>;
          if (c.key === 'status') return <Badge variant={D.statusVariant[m.status]} dot>{m.status}</Badge>;
          if (c.key === 'acoes')  return perms.canManageTeam ? (
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
              <button className="row-action" aria-label="Remover" title="Remover do time" onClick={() => setRemover(m)}>
                {Ic('user-minus', 'ico-sm')}
              </button>
            </div>
          ) : null;
          return m[c.key];
        }} />
        </div>
      </Card>

      <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span><b style={{ color: 'var(--ink)' }}>Admin</b> — acesso total</span>
        <span><b style={{ color: 'var(--ink)' }}>Editor</b> — cria e edita oportunidades</span>
        <span><b style={{ color: 'var(--ink)' }}>Analista</b> — vê dados e relatórios</span>
        <span><b style={{ color: 'var(--ink)' }}>Viewer</b> — somente leitura</span>
      </div>

      <Dialog open={invite} onClose={() => setInvite(false)} width={460}
        title="Convidar membro" description="Adiciona o e-mail ao time. A pessoa entra com Google — o nome e a foto aparecem no primeiro acesso."
        footer={<>
          <Button variant="ghost" onClick={() => setInvite(false)}>Cancelar</Button>
          <Button variant="primary" iconLeft={Ic('user-plus', 'ico-sm')} onClick={enviarConvite} disabled={invBusy}>
            {invBusy ? 'Adicionando…' : 'Adicionar ao time'}
          </Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="E-mail (conta Google)" htmlFor="inv-e">
            <Input id="inv-e" type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)}
              placeholder="pessoa@gmail.com" />
          </Field>
          <Field label="Permissão" htmlFor="inv-p" hint="Admin: tudo + time · Editor: oportunidades · Viewer: só leitura.">
            <Select id="inv-p" value={invRole} onChange={(e) => setInvRole(e.target.value)}>
              <option>Admin</option><option>Editor</option><option>Viewer</option>
            </Select>
          </Field>
          {invErr && <div style={{ fontSize: 13, color: 'var(--vermelha)' }}>{invErr}</div>}
        </div>
      </Dialog>

      <Dialog open={!!remover} onClose={() => setRemover(null)} width={440}
        title="Remover do time?" description="A pessoa perde o acesso ao painel imediatamente."
        footer={<>
          <Button variant="ghost" onClick={() => setRemover(null)}>Cancelar</Button>
          <Button variant="destructive" iconLeft={Ic('user-minus', 'ico-sm')} onClick={confirmarRemocao}>Remover</Button>
        </>}>
        {remover && <>Remover <b>{remover.email}</b> da lista de administradores.</>}
      </Dialog>
    </div>
  );
}

// Team (Membros do time)
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const { Card, Table, Badge, Button, Avatar, Input, Select, Field, Dialog } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);

  function Team() {
    const [q, setQ] = React.useState('');
    const [invite, setInvite] = React.useState(false);
    let rows = D.team;
    if (q) rows = rows.filter((m) => m.nome.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase()) || m.cargo.toLowerCase().includes(q.toLowerCase()));

    const cols = [
      { key: 'nome', header: 'Membro' },
      { key: 'cargo', header: 'Função' },
      { key: 'papel', header: 'Permissão' },
      { key: 'status', header: 'Status' },
      { key: 'acoes', header: '', align: 'right', width: 90 },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 280 }}>
            <Input placeholder="Buscar membro…" icon={Ic('search', 'ico-sm')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ flex: 1 }} />
          <Button variant="primary" iconLeft={Ic('user-plus', 'ico-sm')} onClick={() => setInvite(true)}>Convidar membro</Button>
        </div>

        <Card flat>
          <Table columns={cols} data={rows} renderCell={(m, c) => {
            if (c.key === 'nome') return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar initials={m.iniciais} size="md" color={m.cor} />
                <div>
                  <div style={{ fontWeight: 600 }}>{m.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{m.email}</div>
                </div>
              </div>
            );
            if (c.key === 'papel') return <Badge variant={D.papelVariant[m.papel] || 'neutral'}>{m.papel}</Badge>;
            if (c.key === 'status') return <Badge variant={D.statusVariant[m.status]} dot>{m.status}</Badge>;
            if (c.key === 'acoes') return (
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                <button className="row-action" aria-label="Editar permissão">{Ic('pencil', 'ico-sm')}</button>
                <button className="row-action" aria-label="Remover">{Ic('user-minus', 'ico-sm')}</button>
              </div>
            );
            return m[c.key];
          }} />
        </Card>

        <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><b style={{ color: 'var(--ink)' }}>Admin</b> — acesso total</span>
          <span><b style={{ color: 'var(--ink)' }}>Editor</b> — cria e edita oportunidades</span>
          <span><b style={{ color: 'var(--ink)' }}>Analista</b> — vê dados e relatórios</span>
          <span><b style={{ color: 'var(--ink)' }}>Viewer</b> — somente leitura</span>
        </div>

        <Dialog open={invite} onClose={() => setInvite(false)} width={460}
          title="Convidar membro" description="Enviaremos um convite por e-mail para acessar o painel."
          footer={<>
            <Button variant="ghost" onClick={() => setInvite(false)}>Cancelar</Button>
            <Button variant="primary" iconLeft={Ic('send', 'ico-sm')} onClick={() => setInvite(false)}>Enviar convite</Button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome" htmlFor="inv-n"><Input id="inv-n" placeholder="Nome completo" /></Field>
            <Field label="E-mail" htmlFor="inv-e"><Input id="inv-e" type="email" placeholder="pessoa@accessplus.com.br" /></Field>
            <Field label="Permissão" htmlFor="inv-p">
              <Select id="inv-p" defaultValue="Editor"><option>Admin</option><option>Editor</option><option>Analista</option><option>Viewer</option></Select>
            </Field>
          </div>
        </Dialog>
      </div>
    );
  }
  window.Team = Team;
})();

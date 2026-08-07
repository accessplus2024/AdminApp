import { useState, useEffect } from 'react';
import { Button, Card, CardBody } from './components';
import { Ic } from './lib/icons';
import D from './lib/data';
import {
  fetchOpportunities, createOpportunity, updateOpportunity, deleteOpportunity,
  formParaLinha, idDoBanco, isSupabaseConfigured,
} from './lib/opportunities';
import { signInWithGoogle, signOut, getSession, onAuthChange, getMyRole, upsertMyProfile } from './lib/auth';
import Login from './screens/Login';
import AppShell from './screens/AppShell';
import Dashboard from './screens/Dashboard';
import Opportunities from './screens/Opportunities';
import OpportunityDetail from './screens/OpportunityDetail';
import OpportunityEditor from './screens/OpportunityEditor';
import Revisao from './screens/Revisao';
import Newsletter from './screens/Newsletter';
import Sentinel from './screens/Sentinel';
import Team from './screens/Team';

const TITLES = {
  dashboard:     'Visão geral',
  oportunidades: 'Oportunidades',
  revisao:       'Em revisão',
  sentinel:      'Sentinel',
  newsletter:    'Newsletter',
  time:          'Membros do time',
  //config:        'Configurações',
};
const SUBS = {
  dashboard:     'Acompanhe e gerencie as oportunidades em um só lugar.',
  oportunidades: 'Crie, filtre, edite e publique as oportunidades visíveis para os estudantes.',
  revisao:       'Oportunidades aguardando aprovação antes de irem pro ar.',
  sentinel:      'Encontre, filtre e pesquise oportunidades antes da revisão editorial.',
  newsletter:    'Monte edições com o catálogo e mantenha o histórico de cada oportunidade.',
  time:          'Gerencie quem tem acesso ao painel e suas permissões.',
};
const VALID_SCREENS = ['dashboard', 'oportunidades', 'revisao', 'sentinel', 'newsletter', 'time'];

export default function App() {
  // --- Autenticação ---
  // Com Supabase configurado: login real via Google + allowlist de admins.
  // Sem Supabase (dev): cai no login fake antigo (localStorage).
  const [session, setSession]   = useState(null);
  const [role, setRole]         = useState(null);   // 'Admin' | 'Editor' | 'Viewer' | null
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [fakeAuth, setFakeAuth] = useState(() => localStorage.getItem('ap_admin_auth') === '1');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let sub;
    const aplicar = async (s) => {
      setSession(s);
      if (s) { const r = await getMyRole(s.user.email); setRole(r); if (r) upsertMyProfile(s.user); }
      else setRole(null);
    };
    getSession().then(async (s) => { await aplicar(s); setAuthReady(true); });
    const { data } = onAuthChange((s) => { aplicar(s); });
    sub = data?.subscription;
    return () => sub && sub.unsubscribe();
  }, []);

  // Permissões derivadas do papel (sem Supabase = modo dev, tudo liberado).
  const perms = {
    canWrite:      !isSupabaseConfigured || role === 'Admin' || role === 'Editor',
    canManageTeam: !isSupabaseConfigured || role === 'Admin',
  };

  const [active, setActive] = useState(() => {
    const s = localStorage.getItem('ap_admin_screen');
    return VALID_SCREENS.includes(s) ? s : 'dashboard';
  });
  const [route, setRoute]   = useState({ mode: 'list', opp: null });
  const [opportunities, setOpportunities] = useState(() => D.opportunities.slice());
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(isSupabaseConfigured);
  const rerender = () => setOpportunities(D.opportunities.slice());

  const syncOpportunities = (lista) => {
    D.opportunities.length = 0;
    D.opportunities.push(...lista);
    setOpportunities(lista.slice());
  };

  const reloadOpportunities = async () => {
    if (!isSupabaseConfigured) {
      rerender();
      return D.opportunities.slice();
    }
    setOpportunitiesLoading(true);
    try {
      const lista = await fetchOpportunities({ throwOnError: true });
      syncOpportunities(lista);
      return lista;
    } finally {
      setOpportunitiesLoading(false);
    }
  };

  // Ao abrir o app, tenta carregar as oportunidades REAIS do Supabase.
  // Se conseguir, substitui os dados de exemplo (mock) que ja estao em D.
  // Se nao estiver configurado (ou der erro), o app segue com o mock.
  useEffect(() => {
    let ativo = true;
    if (!isSupabaseConfigured) return () => { ativo = false; };
    fetchOpportunities({ throwOnError: true })
      .then((lista) => { if (ativo) syncOpportunities(lista); })
      .catch((error) => console.error('[Access+] Erro ao sincronizar o catálogo:', error.message))
      .finally(() => { if (ativo) setOpportunitiesLoading(false); });
    return () => { ativo = false; };
  }, []);

  const go = (s) => {
    setActive(s);
    setRoute({ mode: 'list', opp: null });
    localStorage.setItem('ap_admin_screen', s);
  };
  // "from" deixa abrir o detalhe/editor a partir da tela de Oportunidades OU da
  // tela de Em revisão, sem perder o contexto (o botão "Voltar" volta pra onde
  // a pessoa estava, não sempre pra lista de Oportunidades).
  const openOpp   = (o, from = 'oportunidades') => { setActive(from); setRoute({ mode: 'detail', opp: o }); };
  const editOpp   = (o, from = 'oportunidades') => { setActive(from); setRoute({ mode: 'editor', opp: o }); };
  const newOpp    = ()  => { setActive('oportunidades'); setRoute({ mode: 'editor', opp: null }); };
  const backToList = ()  => setRoute({ mode: 'list', opp: null });

  const togglePublish = async (o) => {
    const novoUi = o.status === 'Publicada' ? 'Rascunho' : 'Publicada';
    if (isSupabaseConfigured) {
      try {
        const upd = await updateOpportunity(idDoBanco(o),
          { status: novoUi === 'Publicada' ? 'Aprovada' : 'Revisar' });
        Object.assign(o, upd);
      } catch (e) { alert('Erro ao mudar status: ' + e.message); return; }
    } else {
      o.status = novoUi; o.inscricoesAbertas = novoUi === 'Publicada';
    }
    setRoute({ mode: 'detail', opp: o }); rerender();
  };

  const deleteOpp = async (o) => {
    if (isSupabaseConfigured) {
      try { await deleteOpportunity(idDoBanco(o)); }
      catch (e) { alert('Erro ao excluir: ' + e.message); return; }
    }
    const i = D.opportunities.indexOf(o);
    if (i >= 0) D.opportunities.splice(i, 1);
    backToList(); rerender();
  };

  const saveOpp = async (form, uiStatus) => {
    if (isSupabaseConfigured) {
      try {
        if (route.opp) {
          const upd = await updateOpportunity(idDoBanco(route.opp),
            formParaLinha(form, uiStatus, route.opp._raw));
          Object.assign(route.opp, upd);
        } else {
          const criada = await createOpportunity(formParaLinha(form, uiStatus, null));
          D.opportunities.unshift(criada);
        }
      } catch (e) { alert('Erro ao salvar: ' + e.message); return; }
      backToList(); rerender();
      return;
    }
    // Fallback (sem Supabase): comportamento antigo, em memoria.
    const fields = {
      ...form,
      elegibilidade: form.elegibilidade.split('\n').map((s) => s.trim()).filter(Boolean),
      dicas:         form.dicas.split('\n').map((s) => s.trim()).filter(Boolean),
      tagsRelacionadas: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      status: uiStatus,
    };
    delete fields.tags;
    if (route.opp) {
      Object.assign(route.opp, fields);
    } else {
      D.opportunities.unshift(Object.assign({ id: Date.now(), recursos: [] }, fields));
    }
    backToList(); rerender();
  };

  // --- Portões de autenticação ---
  if (isSupabaseConfigured) {
    if (!authReady) {
      return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', color: 'var(--muted-foreground)' }}>Carregando…</div>;
    }
    if (!session) {
      return <Login onGoogle={() => signInWithGoogle()} />;
    }
    if (!role) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
          <Card flat style={{ maxWidth: 440 }}>
            <CardBody style={{ textAlign: 'center', padding: 32 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>Acesso não autorizado</h2>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginTop: 8 }}>
                Você entrou como <b>{session.user.email}</b>, mas este e-mail não está na lista de administradores do Access+.
                Peça para a administração adicionar seu e-mail.
              </p>
              <div style={{ marginTop: 18 }}>
                <Button variant="outline" onClick={() => signOut()}>Sair</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      );
    }
  } else if (!fakeAuth) {
    return (
      <Login onLogin={() => { setFakeAuth(true); localStorage.setItem('ap_admin_auth', '1'); }} />
    );
  }

  let screen;
  if (active === 'dashboard') {
    screen = <Dashboard onOpen={openOpp} onNew={newOpp} perms={perms} />;
  } else if (active === 'oportunidades') {
    if (route.mode === 'detail')
      screen = <OpportunityDetail opp={route.opp} onBack={backToList} onEdit={editOpp} onDelete={deleteOpp} onTogglePublish={togglePublish} perms={perms} />;
    else if (route.mode === 'editor')
      screen = <OpportunityEditor opp={route.opp} onCancel={backToList} onSave={saveOpp} onDelete={deleteOpp} />;
    else
      screen = <Opportunities onOpen={openOpp} onEdit={editOpp} onNew={newOpp} perms={perms} />;
  } else if (active === 'revisao') {
    if (route.mode === 'detail')
      screen = <OpportunityDetail opp={route.opp} onBack={backToList} onEdit={(o) => editOpp(o, 'revisao')} onDelete={deleteOpp} onTogglePublish={togglePublish} perms={perms} />;
    else if (route.mode === 'editor')
      screen = <OpportunityEditor opp={route.opp} onCancel={backToList} onSave={saveOpp} onDelete={deleteOpp} />;
    else
      screen = (
        <Revisao
          onOpen={(o) => openOpp(o, 'revisao')}
          onEdit={(o) => editOpp(o, 'revisao')}
          onApprove={togglePublish}
          perms={perms}
        />
      );
  } else if (active === 'sentinel') {
    screen = <Sentinel perms={perms} opportunities={opportunities} catalogLoading={opportunitiesLoading} onCatalogChanged={reloadOpportunities} />;
  } else if (active === 'newsletter') {
    screen = <Newsletter opportunities={opportunities} perms={perms} />;
  } else if (active === 'time') {
    screen = <Team perms={perms} />;
  } else {
    screen = (
      <Card flat style={{ display: 'grid', placeItems: 'center', minHeight: 420 }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>Configurações</h2>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginTop: 8 }}>Preferências do painel entram aqui.</p>
        </div>
      </Card>
    );
  }

  // Identidade do usuário logado (para o rodapé da sidebar).
  const _meta = session?.user?.user_metadata || {};
  const _nome = _meta.full_name || _meta.name || session?.user?.email || '';
  const currentUser = session ? {
    name: _nome,
    subtitle: session.user.email,
    avatar: _meta.avatar_url || _meta.picture || '',
    initials: (_nome.split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || _nome.slice(0, 2)).toUpperCase(),
  } : null;

  const onList    = !((active === 'oportunidades' || active === 'revisao') && route.mode !== 'list');
  const showNew   = perms.canWrite && (active === 'dashboard' || (active === 'oportunidades' && route.mode === 'list'));

  // Badge com a contagem de pendências no item "Em revisão" do menu.
  const emRevisaoCount = D.opportunities.filter((o) => o.status === 'Em revisão').length;
  const navComBadge = D.nav.map((item) =>
    item.id === 'revisao' ? { ...item, badge: emRevisaoCount || undefined } : item
  );
  const newBtn    = (
    <Button variant="primary" iconLeft={Ic('plus', 'ico-sm')} onClick={newOpp}>
      Nova oportunidade
    </Button>
  );

  return (
    <AppShell
      nav={navComBadge}
      active={active}
      onNav={go}
      title={TITLES[active] || 'Access+'}
      subtitle={onList ? SUBS[active] : null}
      actions={showNew ? newBtn : null}
      user={currentUser}
      onLogout={() => {
        if (isSupabaseConfigured) { signOut(); }
        else { setFakeAuth(false); localStorage.setItem('ap_admin_auth', '0'); }
      }}
    >
      {screen}
    </AppShell>
  );
}

import { useEffect, useState } from 'react';
import { Avatar, Badge, Button, Input } from '../components';
import { Ic } from '../lib/icons';

export default function AppShell({ nav, active, onNav, title, subtitle, actions, onLogout, user, children }) {
  // Sidebar vira um drawer (menu lateral) em telas pequenas — some por padrão e
  // abre por cima do conteúdo ao tocar no botão de menu (☰) da topbar.
  const [menuAberto, setMenuAberto] = useState(false);
  const fechar = () => setMenuAberto(false);

  // Fecha o menu automaticamente ao trocar de tela ou ao alargar a janela de novo.
  useEffect(() => { fechar(); }, [active]);
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 960) fechar(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navegar = (id) => { onNav(id); fechar(); };

  return (
    <div className="ap-shell">
      {/* Fundo escuro atrás do menu, em telas pequenas — clicar fecha o menu. */}
      <div className={'ap-shell-scrim' + (menuAberto ? ' is-open' : '')} onClick={fechar} aria-hidden="true" />

      {/* Sidebar */}
      <aside className={'ap-shell-sidebar' + (menuAberto ? ' is-open' : '')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px 18px' }}>
          <img src="/assets/icon-branco.png" alt="" style={{ width: 34, height: 34, borderRadius: '50%' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, color: '#fff', letterSpacing: '-0.01em' }}>
            Access<span style={{ color: 'var(--grifa-texto)' }}>+</span>Plus
          </span>
        </div>

        <div style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--sidebar-muted)', margin: '8px 6px 4px' }}>
          Gestão
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px' }}>
          {nav.map((item) => {
            const on = active === item.id;
            return (
              <button key={item.id} onClick={() => navegar(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                  padding: '9px 12px', borderRadius: 'var(--radius-md)', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: on ? 600 : 500,
                  background: on ? 'var(--sidebar-active)' : 'transparent',
                  color: on ? '#fff' : 'var(--sidebar-foreground)',
                  transition: 'background-color .14s ease',
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--sidebar-accent)'; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
              >
                {Ic(item.icon, 'nav-ico')}
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && <Badge variant="primary">{item.badge}</Badge>}
              </button>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--sidebar-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px 4px' }}>
            <Avatar src={user?.avatar} initials={user?.initials || 'AP'} size="sm" color="var(--grifa-topicos)" />
            <div style={{ lineHeight: 1.2, flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Access+'}</div>
              <div style={{ fontSize: 11, color: 'var(--sidebar-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.subtitle || 'Admin'}</div>
            </div>
            <button onClick={onLogout} aria-label="Sair" title="Sair"
              style={{ border: 'none', background: 'transparent', color: 'var(--sidebar-muted)', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'inline-flex' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'var(--sidebar-accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sidebar-muted)'; e.currentTarget.style.background = 'transparent'; }}>
              {Ic('log-out', 'nav-ico-sm')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="ap-shell-main">
        <header className="ap-shell-header">
          <button className="ap-menu-toggle topbar-icon-btn" aria-label="Abrir menu" onClick={() => setMenuAberto((v) => !v)}>
            {Ic(menuAberto ? 'x' : 'menu', 'ico-sm')}
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h1>
          </div>
          <div style={{ flex: 1 }} />
          {actions}
        </header>

        <main className="ap-shell-content">
          {subtitle && <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginTop: -8, marginBottom: 20 }}>{subtitle}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}

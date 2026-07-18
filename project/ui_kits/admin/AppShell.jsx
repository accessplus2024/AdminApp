// AppShell — dark sidebar + topbar chrome for the Access+ admin app.
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const { Avatar, Badge, Button, Input } = NS;
  const Ic = (n, cls) => window.Ic(n, cls);

  function AppShell({ nav, active, onNav, title, subtitle, actions, onLogout, children }) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
        {/* ---------------- Sidebar ---------------- */}
        <aside style={{
          width: 'var(--sidebar-width)', flex: 'none', background: 'var(--sidebar)',
          color: 'var(--sidebar-foreground)', display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100vh',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px 18px' }}>
            <img src="../../assets/icon-branco.png" alt="" style={{ width: 34, height: 34, borderRadius: '50%' }} />
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
                <button key={item.id} onClick={() => onNav(item.id)}
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
            <button onClick={() => onNav('config')}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '9px 12px',
                borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
                background: active === 'config' ? 'var(--sidebar-accent)' : 'transparent', color: 'var(--sidebar-foreground)',
              }}>
              {Ic('settings', 'nav-ico')}<span>Configurações</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px 4px' }}>
              <Avatar initials="CR" size="sm" color="var(--grifa-topicos)" />
              <div style={{ lineHeight: 1.2, flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Camila Rocha</div>
                <div style={{ fontSize: 11, color: 'var(--sidebar-muted)' }}>Curadoria · Admin</div>
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

        {/* ---------------- Main ---------------- */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <header style={{
            height: 'var(--topbar-height)', flex: 'none', display: 'flex', alignItems: 'center',
            gap: 16, padding: '0 28px', background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(8px)',
            borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 20,
          }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{title}</h1>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ width: 240, display: 'flex' }} className="topbar-search">
              <Input placeholder="Buscar…" icon={Ic('search', 'ico-sm')} />
            </div>
            <button className="topbar-icon-btn" aria-label="Notificações">
              {Ic('bell', 'ico')}
              <span className="topbar-dot" />
            </button>
            {actions}
          </header>

          <main style={{ flex: 1, padding: '26px 28px 40px', maxWidth: 1180, width: '100%' }}>
            {subtitle && <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginTop: -8, marginBottom: 20 }}>{subtitle}</p>}
            {children}
          </main>
        </div>
      </div>
    );
  }

  window.AppShell = AppShell;
})();

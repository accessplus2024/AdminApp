import { useState } from 'react';
import { Button, Input, Field, Checkbox } from '../components';
import { Ic } from '../lib/icons';

export default function Login({ onLogin, onGoogle }) {
  const [email, setEmail] = useState('camila@accessplus.com.br');
  const submit = (e) => { e.preventDefault(); onLogin && onLogin(); };
  const googleMode = typeof onGoogle === 'function';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', minHeight: '100vh', background: 'var(--card)' }} className="ap-login">
      {/* Brand panel */}
      <div className="ap-login-art" style={{ position: 'relative', overflow: 'hidden', background: 'var(--ink)' }}>
        <img
          src="/assets/login-keyvisual.png"
          alt="Access+Plus"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '32% center' }}
        />
        <div aria-hidden="true" style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%',
          background: 'linear-gradient(to top, rgba(14,0,51,0.72) 0%, rgba(14,0,51,0) 100%)',
        }} />
        <div style={{ position: 'absolute', left: 44, bottom: 40, display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
          <img src="/assets/icon-badge.png" alt="" style={{ width: 34, height: 34 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em' }}>
            Access<span style={{ color: 'var(--citacoes)' }}>+</span>Plus
          </span>
        </div>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
        <form onSubmit={submit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/assets/icon-badge.png" alt="" style={{ width: 40, height: 40 }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }}>
              Access<span style={{ color: 'var(--azul)' }}>+</span>Plus
            </span>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em' }}>Entrar no painel</h1>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginTop: 6 }}>Acesso restrito à equipe Access+.</p>
          </div>

          {googleMode ? (
            <Button variant="primary" size="lg" type="button" onClick={onGoogle}
              iconLeft={Ic('log-in', 'ico-sm')} style={{ width: '100%' }}>
              Entrar com Google
            </Button>
          ) : (
            <>
              <Field label="E-mail" htmlFor="lg-e">
                <Input id="lg-e" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  icon={Ic('mail', 'ico-sm')} placeholder="voce@accessplus.com.br" />
              </Field>
              <Field label="Senha" htmlFor="lg-p">
                <Input id="lg-p" type="password" defaultValue="senha-secreta" icon={Ic('lock', 'ico-sm')} />
              </Field>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Checkbox label="Manter conectado" defaultChecked />
                <a href="#" style={{ fontSize: 13, fontWeight: 500 }} onClick={(e) => e.preventDefault()}>Esqueci a senha</a>
              </div>

              <Button variant="primary" size="lg" type="submit" iconRight={Ic('arrow-right', 'ico-sm')} style={{ width: '100%' }}>
                Entrar
              </Button>
            </>
          )}

          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', marginTop: 4 }}>
            Problemas para acessar? Fale com a administração do time.
          </p>
        </form>
      </div>
    </div>
  );
}

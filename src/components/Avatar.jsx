import { useEffect, useState } from 'react';

// Foto de perfil (Google) com fallback pras iniciais.
// Bug corrigido: antes, se a foto do Google falhasse ao carregar (bloqueio de
// hotlink, URL expirada, offline), o <img> ficava quebrado/vazio em vez de
// mostrar as iniciais. Agora: (1) referrerPolicy evita bloqueio por referrer do
// Google, (2) onError troca pra iniciais, (3) reseta o erro se a src mudar
// (ex.: usuário troca de membro na lista).
export function Avatar({ src, alt = '', initials, size = 'md', color, className = '', ...props }) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => { setFalhou(false); }, [src]);

  const classes = ['ap-avatar', `ap-avatar--${size}`, className].filter(Boolean).join(' ');
  const style = color ? { background: color } : undefined;
  const mostrarFoto = !!src && !falhou;

  return (
    <span className={classes} style={style} {...props}>
      {mostrarFoto
        ? <img src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFalhou(true)} />
        : (initials || '').slice(0, 2).toUpperCase()}
    </span>
  );
}

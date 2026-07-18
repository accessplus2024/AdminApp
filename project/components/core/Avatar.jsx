import React, { useEffect, useState } from 'react';

/**
 * Round avatar. Falls back to initials (on a brand-coloured circle) when there's
 * no src, OR when the image fails to load (e.g. a Google profile photo blocked
 * by hotlink protection or an expired URL) — previously this showed a broken
 * image instead of the initials.
 */
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

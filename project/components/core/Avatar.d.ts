import * as React from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Image URL. When omitted, `initials` are shown on a coloured circle. */
  src?: string;
  alt?: string;
  /** 1–2 letters shown when there is no image. */
  initials?: string;
  size?: AvatarSize;
  /** Override the fallback circle colour (defaults to brand azul). */
  color?: string;
  className?: string;
}

export declare function Avatar(props: AvatarProps): JSX.Element;

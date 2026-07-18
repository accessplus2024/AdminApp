import * as LucideIcons from 'lucide-react';

const SIZES = {
  ico: 19, 'ico-sm': 16, 'ico-xs': 14, 'ico-star': 15,
  'nav-ico': 19, 'nav-ico-sm': 15,
};

function sizeFor(cls) {
  if (!cls) return 18;
  const parts = cls.split(' ');
  for (const [key, val] of Object.entries(SIZES)) {
    if (parts.includes(key)) return val;
  }
  return 18;
}

export function Ic(name, cls) {
  if (!name) return null;
  // Aceita PascalCase (ex.: 'LayoutDashboard'), kebab-case ('map-pin') E
  // palavra única minúscula ('calendar'). Sempre normaliza pra PascalCase,
  // que é como o lucide-react exporta os ícones.
  const iconName = String(name)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  const Icon = LucideIcons[iconName];
  if (!Icon) return null;
  const size = sizeFor(cls);
  return <Icon className={cls} size={size} aria-hidden="true" />;
}

Brand-styled button for the Access+ admin app — use for every clickable action; `primary` (azul) is reserved for the single main action per view.

```jsx
import { Button } from './Button';

<Button variant="primary" iconLeft={<i data-lucide="plus" />}>
  Nova oportunidade
</Button>

<Button variant="outline" size="sm">Cancelar</Button>
<Button variant="destructive">Excluir</Button>
<Button variant="ghost" size="icon" aria-label="Configurações">
  <i data-lucide="settings" />
</Button>
```

Variants: `primary` · `secondary` · `outline` · `ghost` · `destructive` · `link`.
Sizes: `sm` · `md` (default) · `lg` · `icon`. Add `pill` for a fully-rounded shape.
Pass `href` to render an anchor. Icons are Lucide `<i data-lucide="…" />` nodes via `iconLeft` / `iconRight`.

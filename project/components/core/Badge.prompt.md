Compact status or category label (pill-shaped). Use for opportunity status, application stages, and tags.

```jsx
import { Badge } from './Badge';

<Badge variant="success" dot>Publicada</Badge>
<Badge variant="warning" dot>Em revisão</Badge>
<Badge variant="primary">Bolsa integral</Badge>
<Badge variant="pink">Intercâmbio</Badge>
```

Variants: `neutral` · `primary` · `success` · `warning` · `danger` · `lime` · `pink` · `mint` · `solid`. Add `dot` for a leading status dot. Highlighter colours (lime/pink/mint) read as categories; status colours (success/warning/danger) read as state.

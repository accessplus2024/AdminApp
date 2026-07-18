Inline status banner for messages, confirmations and warnings.

```jsx
import { Alert } from './Alert';
<Alert variant="success" icon={<i data-lucide="check-circle" />} title="Oportunidade publicada">
  Já está visível para os estudantes.
</Alert>
<Alert variant="warning" icon={<i data-lucide="alert-triangle" />} title="Prazo encerra amanhã" />
```
Variants: `info` (mint) · `success` · `warning` · `danger`. `title` is the bold line; children are the description.

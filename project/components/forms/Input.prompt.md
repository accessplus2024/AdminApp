Text input matching the brand. Pair with `Field` for label/hint/error.

```jsx
import { Input } from './Input';
<Input placeholder="Buscar oportunidades" icon={<i data-lucide="search" />} />
<Input defaultValue="Errado" error />
```
Props: `icon` (leading Lucide node), `error` (red border). Forwards all native input attributes.

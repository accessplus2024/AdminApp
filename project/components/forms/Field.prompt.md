Wrapper that adds a label above and a hint/error below any control.

```jsx
import { Field } from './Field';
import { Input } from './Input';
<Field label="Título da oportunidade" htmlFor="t" hint="Apareça claro para o estudante">
  <Input id="t" placeholder="Ex.: Bolsa Santander" />
</Field>
<Field label="E-mail" error="E-mail inválido"><Input error /></Field>
```
Props: `label`, `htmlFor`, `hint`, `error` (overrides hint, turns red).

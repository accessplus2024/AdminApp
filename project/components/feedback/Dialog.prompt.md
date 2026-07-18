Centered modal with an indigo scrim. Controlled — render it always and drive `open`.

```jsx
import { Dialog } from './Dialog';
import { Button } from '../core/Button';

<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="Excluir oportunidade?"
  description="Esta ação não pode ser desfeita."
  footer={<>
    <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
    <Button variant="destructive" onClick={confirm}>Excluir</Button>
  </>}
/>
```
Scrim click calls `onClose`. Use `width` to size; body content goes in children.

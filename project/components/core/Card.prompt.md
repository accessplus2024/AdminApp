White surface container on the off-white canvas — the building block for every admin panel. Compose with the sub-components.

```jsx
import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter } from './Card';
import { Button } from '../core/Button';

<Card>
  <CardHeader>
    <CardTitle>Oportunidades em destaque</CardTitle>
    <CardDescription>Curadoria da semana</CardDescription>
  </CardHeader>
  <CardBody>…</CardBody>
  <CardFooter>
    <Button variant="primary">Publicar</Button>
    <Button variant="outline">Salvar rascunho</Button>
  </CardFooter>
</Card>
```

Add `interactive` for clickable cards (hover lift), `flat` to drop the shadow. Radius `--radius-lg`, hairline border, soft `--shadow-sm`.

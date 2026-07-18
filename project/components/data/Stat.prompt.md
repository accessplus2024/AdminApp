KPI block for dashboard tiles — label, big display number, optional icon tile and trend delta. Place inside a `Card`.

```jsx
import { Stat } from './Stat';
import { Card, CardBody } from '../core/Card';

<Card><CardBody>
  <Stat label="Oportunidades abertas" value="128" icon={<i data-lucide="briefcase" />} delta="+12%" deltaDir="up" />
</CardBody></Card>
```
`deltaDir="up"` is green, `"down"` is red. Value uses the heavy display font.

Segmented control / tab bar. Controlled via `value` + `onChange`.

```jsx
import { Tabs } from './Tabs';
const [tab, setTab] = React.useState('todas');
<Tabs
  value={tab}
  onChange={setTab}
  items={[
    { value: 'todas', label: 'Todas' },
    { value: 'abertas', label: 'Abertas' },
    { value: 'rascunho', label: 'Rascunhos' },
  ]}
/>
```
`variant="solid"` (default) is a pill segmented group; `variant="line"` is underline tabs for page-level navigation.

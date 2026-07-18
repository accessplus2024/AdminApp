Data table with brand header styling and hover rows. Define columns, pass row objects, customise cells with `renderCell`.

```jsx
import { Table } from './Table';
import { Badge } from '../core/Badge';

<Table
  columns={[
    { key: 'titulo', header: 'Oportunidade' },
    { key: 'categoria', header: 'Categoria' },
    { key: 'status', header: 'Status' },
    { key: 'prazo', header: 'Prazo', align: 'right' },
  ]}
  data={rows}
  renderCell={(row, col) =>
    col.key === 'status'
      ? <Badge variant={row.status === 'Publicada' ? 'success' : 'warning'} dot>{row.status}</Badge>
      : row[col.key]
  }
/>
```
Wrap in a `Card` (flat) for the standard list panel. Header is uppercase, rows hover-highlight.

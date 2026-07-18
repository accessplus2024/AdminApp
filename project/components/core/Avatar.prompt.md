Round avatar for students, mentors and team members. Shows an image, or initials on a brand-coloured circle as a fallback.

```jsx
import { Avatar } from './Avatar';

<Avatar src="/students/ana.jpg" alt="Ana Souza" size="md" />
<Avatar initials="AS" size="lg" />
<Avatar initials="MJ" color="var(--grifa-topicos)" />
```

Sizes: `sm` (28) · `md` (38) · `lg` (52). Initials are auto-uppercased and clipped to two characters.

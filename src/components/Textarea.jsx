export function Textarea({ error = false, className = '', ...props }) {
  return (
    <textarea
      className={['ap-textarea', error ? 'ap-textarea--error' : '', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

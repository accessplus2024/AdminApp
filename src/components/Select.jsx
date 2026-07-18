export function Select({ className = '', children, ...props }) {
  return (
    <div className="ap-select-wrap">
      <select className={['ap-select', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </select>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

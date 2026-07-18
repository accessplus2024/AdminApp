export function Switch({ label, className = '', ...props }) {
  return (
    <label className={['ap-switch', className].filter(Boolean).join(' ')}>
      <input type="checkbox" role="switch" {...props} />
      <span className="ap-switch-track"><span className="ap-switch-thumb" /></span>
      {label != null && <span>{label}</span>}
    </label>
  );
}

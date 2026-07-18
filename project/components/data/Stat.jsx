import React from 'react';

/** KPI / metric block. Pair inside a Card for dashboard tiles. */
export function Stat({ label, value, icon = null, delta, deltaDir = 'up', className = '' }) {
  return (
    <div className={['ap-stat', className].filter(Boolean).join(' ')}>
      <div className="ap-stat-label">
        {icon && <span className="ap-stat-icon">{icon}</span>}
        {label}
      </div>
      <div className="ap-stat-value">{value}</div>
      {delta != null && (
        <span className={`ap-stat-delta ap-stat-delta--${deltaDir}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
            {deltaDir === 'up' ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" />}
          </svg>
          {delta}
        </span>
      )}
    </div>
  );
}

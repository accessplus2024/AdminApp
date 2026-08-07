export function formatElapsedDuration(start, end, now = Date.now()) {
  if (!start) return '—';
  const seconds = Math.max(0, Math.round((new Date(end || now) - new Date(start)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}min ${seconds % 60}s`;
}

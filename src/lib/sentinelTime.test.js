import { describe, expect, test } from 'bun:test';
import { formatElapsedDuration } from './sentinelTime';

describe('formatElapsedDuration', () => {
  const start = '2026-08-07T13:00:00.000Z';

  test('uses the live clock while a run is active', () => {
    expect(formatElapsedDuration(start, null, new Date(start).getTime() + 61_000)).toBe('1min 1s');
  });

  test('freezes the duration when a run has completed', () => {
    expect(formatElapsedDuration(start, '2026-08-07T13:02:30.000Z', new Date(start).getTime() + 600_000)).toBe('2min 30s');
  });
});

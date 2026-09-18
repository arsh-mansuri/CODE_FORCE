// Calendar dates must use local time, not UTC (which can be yesterday/tomorrow).
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function minimumDate(field: string, answers: Record<string, unknown>): string {
  const today = localDate();
  const start = answers['profile.search.move_in_from'];
  return field === 'profile.search.move_in_by' && typeof start === 'string' && start > today ? start : today;
}

export function dateError(value: string, minimum = localDate()): string | null {
  const parsed = new Date(`${value}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || localDate(parsed) !== value) {
    return 'Choose a valid calendar date.';
  }
  if (value < localDate()) return 'Choose today or a future date. Past dates are not available.';
  if (value < minimum) return 'Your latest move-in date must be on or after your earliest date.';
  return null;
}

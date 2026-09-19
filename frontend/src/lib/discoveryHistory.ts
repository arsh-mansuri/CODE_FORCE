export interface DiscoveryHistory { choices: Record<string, 'like' | 'pass'>; reminderDismissed: boolean }
const key = (id: string) => `propvibe_discovery_${id}`;

export function historyFor(id: string): DiscoveryHistory {
  try {
    const stored = JSON.parse(localStorage.getItem(key(id)) || 'null');
    if (stored?.choices && typeof stored.choices === 'object' && !Array.isArray(stored.choices)) {
      return { choices: stored.choices, reminderDismissed: stored.reminderDismissed === true };
    }
  } catch { /* Start fresh if local data is unavailable. */ }
  return { choices: {}, reminderDismissed: false };
}

export function saveDiscoveryHistory(id: string, history: DiscoveryHistory) {
  try { localStorage.setItem(key(id), JSON.stringify(history)); } catch { /* In-memory state still works. */ }
}

export function shouldRefine(history: DiscoveryHistory, serverPasses = 0): boolean {
  return !history.reminderDismissed && Math.max(serverPasses, Object.values(history.choices).filter(value => value === 'pass').length) >= 2;
}

export function preferencesSaved(id: string) {
  saveDiscoveryHistory(id, { ...historyFor(id), reminderDismissed: true });
}

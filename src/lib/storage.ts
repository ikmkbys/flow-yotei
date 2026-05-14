export type HistoryEntry = { id: string; title: string; createdAt: number };

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export const storage = {
  getHistory: (): HistoryEntry[] =>
    safeParse(localStorage.getItem('yotei_history'), []),

  setHistory: (entries: HistoryEntry[]): void =>
    localStorage.setItem('yotei_history', JSON.stringify(entries)),

  getRequiredNames: (eventId: string): string[] =>
    safeParse(localStorage.getItem(`yotei_required_${eventId}`), []),

  setRequiredNames: (eventId: string, names: string[]): void =>
    localStorage.setItem(`yotei_required_${eventId}`, JSON.stringify(names)),
};

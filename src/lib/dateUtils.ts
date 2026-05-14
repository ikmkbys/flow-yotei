/* 日付を日本語表示（時刻あれば追加） */
export function formatDate(iso: string): string {
  const hasTime = iso.includes('T');
  const datePart = hasTime ? iso.split('T')[0] : iso;
  const timePart = hasTime ? iso.split('T')[1] : null;
  const d = new Date(datePart + 'T00:00:00');
  const dateStr = d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
  return timePart ? `${dateStr} ${timePart}〜` : dateStr;
}

/* 曜日カラー */
export function weekdayColor(iso: string): string {
  const datePart = iso.includes('T') ? iso.split('T')[0] : iso;
  const day = new Date(datePart + 'T00:00:00').getDay();
  if (day === 0) return '#ef4444';
  if (day === 6) return '#6366f1';
  return 'var(--text)';
}

/* Googleカレンダー登録URL生成 */
export function makeGCalUrl(iso: string, title: string, description?: string): string {
  const hasTime = iso.includes('T');
  if (hasTime) {
    const [date, time] = iso.split('T');
    const [h, m] = time.split(':').map(Number);
    const endH = String(h + 1).padStart(2, '0');
    const fmt = (d: string, hh: string, mm: string) =>
      `${d.replace(/-/g, '')}T${hh}${mm}00`;
    const start = fmt(date, String(h).padStart(2, '0'), String(m).padStart(2, '0'));
    const end   = fmt(date, endH, String(m).padStart(2, '0'));
    return `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${start}/${end}` +
      (description ? `&details=${encodeURIComponent(description)}` : '');
  } else {
    const d = new Date(iso + 'T00:00:00');
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const fmt = (dt: Date) => dt.toISOString().split('T')[0].replace(/-/g, '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${fmt(d)}/${fmt(next)}` +
      (description ? `&details=${encodeURIComponent(description)}` : '');
  }
}

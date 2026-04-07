import type { Availability } from './types';

/* Google Calendar FreeBusy API を使って候補日の空き状況を判定 */
export async function fetchFreeBusy(
  accessToken: string,
  dates: string[],                           // "2026-04-10" or "2026-04-10T19:00"
): Promise<Record<string, Availability>> {
  // 全候補日の最小〜最大をカバーするレンジで1回だけAPI呼出し
  const sorted = [...dates].sort();
  const earliest = sorted[0].split('T')[0];
  const latest   = sorted[sorted.length - 1].split('T')[0];
  const timeMin = `${earliest}T00:00:00+09:00`;
  const nextDay = new Date(latest + 'T00:00:00');
  nextDay.setDate(nextDay.getDate() + 1);
  const timeMax = `${nextDay.toISOString().split('T')[0]}T00:00:00+09:00`;

  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: 'primary' }],
    }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    throw new Error(`FreeBusy API error: ${res.status}`);
  }

  const data = await res.json();
  const busyPeriods: { start: string; end: string }[] =
    data.calendars?.primary?.busy ?? [];

  // busy期間をDate配列に変換
  const busy = busyPeriods.map(b => ({
    start: new Date(b.start).getTime(),
    end:   new Date(b.end).getTime(),
  }));

  const result: Record<string, Availability> = {};

  for (const date of dates) {
    const hasTime = date.includes('T');

    if (hasTime) {
      // 時刻指定あり：その1時間枠をチェック
      const start = new Date(date + ':00+09:00').getTime();
      const end   = start + 60 * 60 * 1000;                 // +1時間

      const overlapping = busy.filter(b => b.start < end && b.end > start);

      if (overlapping.length === 0) {
        result[date] = '○';                                  // 空き
      } else {
        // 完全にブロックされてるか判定
        const totalOverlap = overlapping.reduce((sum, b) => {
          const oStart = Math.max(b.start, start);
          const oEnd   = Math.min(b.end, end);
          return sum + (oEnd - oStart);
        }, 0);
        const ratio = totalOverlap / (end - start);
        result[date] = ratio >= 0.5 ? '×' : '△';            // 半分以上→×、それ未満→△
      }
    } else {
      // 終日：ビジネスアワー(9-18)の予定量で判定
      const dayStart = new Date(date + 'T09:00:00+09:00').getTime();
      const dayEnd   = new Date(date + 'T18:00:00+09:00').getTime();
      const bizHours = 9 * 60 * 60 * 1000;

      const totalBusy = busy.reduce((sum, b) => {
        if (b.end <= dayStart || b.start >= dayEnd) return sum;
        const oStart = Math.max(b.start, dayStart);
        const oEnd   = Math.min(b.end, dayEnd);
        return sum + (oEnd - oStart);
      }, 0);

      const busyRatio = totalBusy / bizHours;
      if (busyRatio >= 0.67) result[date] = '×';             // 6h以上→×
      else if (busyRatio >= 0.33) result[date] = '△';        // 3h以上→△
      else result[date] = '○';                                // それ以下→○
    }
  }

  return result;
}

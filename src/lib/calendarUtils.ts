'use client';

import { useState, useEffect } from 'react';

export type DateTuple = { date: string; time: string };

/* 30分刻みの時刻オプション（00:00〜23:30、先頭は空文字） */
export const TIME_OPTIONS = ['', ...Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
})];

/* カレンダーグリッド生成（null=空セル） */
export function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
}

/* 日付文字列を生成 */
export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* ソート＋重複排除 */
export function sortAndDedupeDates(dates: DateTuple[]): DateTuple[] {
  const sorted = [...dates].sort((a, b) =>
    (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))
  );
  const seen = new Set<string>();
  return sorted.filter(d => {
    const key = `${d.date}_${d.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* 重複チェック */
export function hasDuplicateDate(list: DateTuple[]): boolean {
  const keys = list.filter(d => d.date).map(d => `${d.date}_${d.time}`);
  return new Set(keys).size !== keys.length;
}

/* カレンダードラッグ選択フック */
export function useDragSelection(
  dates: DateTuple[],
  setDates: React.Dispatch<React.SetStateAction<DateTuple[]>>,
  sharedTime: string,
  year: number,
  month: number,
) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragAction, setDragAction] = useState<'add' | 'remove'>('add');

  useEffect(() => {
    const stop = () => setIsDragging(false);
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const applyDrag = (dateStr: string, action: 'add' | 'remove') => {
    if (action === 'add') {
      setDates(prev => {
        if (prev.some(d => d.date === dateStr && d.time === sharedTime)) return prev;
        return sortAndDedupeDates([...prev, { date: dateStr, time: sharedTime }]);
      });
    } else {
      setDates(prev => prev.filter(d => !(d.date === dateStr && d.time === sharedTime)));
    }
  };

  const startDrag = (day: number) => {
    const dateStr = toDateStr(year, month, day);
    const isSelected = dates.some(d => d.date === dateStr && d.time === sharedTime);
    const action = isSelected ? 'remove' : 'add';
    setIsDragging(true);
    setDragAction(action);
    applyDrag(dateStr, action);
  };

  const continueDrag = (day: number) => {
    if (!isDragging) return;
    applyDrag(toDateStr(year, month, day), dragAction);
  };

  return { startDrag, continueDrag };
}
